import Foundation

final class AnthropicClient: Sendable {
    static let shared: AnthropicClient = AnthropicClient()

    private let baseURL: URL
    private let session: URLSession
    private let keyStore: APIKeyStore
    private let anthropicVersion: String
    private let encoder: JSONEncoder

    init(
        baseURL: URL = URL(string: "https://api.anthropic.com")!,
        keyStore: APIKeyStore = APIKeyStore.shared,
        urlSession: URLSession? = nil,
        anthropicVersion: String = "2023-06-01"
    ) {
        self.baseURL = baseURL
        self.keyStore = keyStore
        self.anthropicVersion = anthropicVersion
        if let session: URLSession = urlSession {
            self.session = session
        } else {
            let config: URLSessionConfiguration = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 120
            config.timeoutIntervalForResource = 600
            config.waitsForConnectivity = true
            self.session = URLSession(configuration: config)
        }
        let encoder: JSONEncoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        self.encoder = encoder
    }

    func sendMessage(request: MessagesRequest) async throws -> MessagesResponse {
        var nonStreaming: MessagesRequest = request
        nonStreaming.stream = false
        let urlRequest: URLRequest = try buildRequest(body: nonStreaming)
        let (data, response): (Data, URLResponse) = try await session.data(for: urlRequest)
        try validate(response: response, body: data)
        do {
            return try JSONDecoder().decode(MessagesResponse.self, from: data)
        } catch {
            throw AnthropicError.decodingFailed(underlying: error.localizedDescription)
        }
    }

    func streamMessage(request: MessagesRequest) async throws -> AsyncThrowingStream<StreamEvent, Error> {
        var streaming: MessagesRequest = request
        streaming.stream = true
        let urlRequest: URLRequest = try buildRequest(body: streaming)

        let (bytes, response): (URLSession.AsyncBytes, URLResponse) = try await session.bytes(for: urlRequest)

        if let http: HTTPURLResponse = response as? HTTPURLResponse, http.statusCode != 200 {
            let body: String = try await collectBody(from: bytes)
            try mapHTTPError(status: http.statusCode, response: http, body: body)
        }

        return AsyncThrowingStream<StreamEvent, Error> { continuation in
            let task: Task<Void, Never> = Task {
                var parser: SSEParser = SSEParser()
                do {
                    for try await line in bytes.lines {
                        if Task.isCancelled {
                            continuation.finish(throwing: CancellationError())
                            return
                        }
                        if let raw: RawSSEEvent = parser.feed(line: line) {
                            try emit(raw: raw, continuation: continuation)
                        }
                    }
                    if let raw: RawSSEEvent = parser.finish() {
                        try emit(raw: raw, continuation: continuation)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    private func emit(raw: RawSSEEvent, continuation: AsyncThrowingStream<StreamEvent, Error>.Continuation) throws {
        do {
            if let event: StreamEvent = try StreamEventDecoder.decode(raw) {
                continuation.yield(event)
            }
        } catch let error as AnthropicError {
            throw error
        } catch {
            throw AnthropicError.decodingFailed(underlying: error.localizedDescription)
        }
    }

    private func buildRequest(body: MessagesRequest) throws -> URLRequest {
        guard let key: String = try keyStore.getAPIKey(), !key.isEmpty else {
            throw AnthropicError.missingAPIKey
        }

        let url: URL = baseURL.appendingPathComponent("v1/messages")
        var request: URLRequest = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue(anthropicVersion, forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("text/event-stream", forHTTPHeaderField: "accept")

        do {
            request.httpBody = try encoder.encode(body)
        } catch {
            throw AnthropicError.decodingFailed(underlying: "request encode failed: \(error.localizedDescription)")
        }

        return request
    }

    private func validate(response: URLResponse, body: Data) throws {
        guard let http: HTTPURLResponse = response as? HTTPURLResponse else {
            throw AnthropicError.invalidResponse
        }
        if http.statusCode == 200 { return }
        let bodyString: String = String(data: body, encoding: .utf8) ?? ""
        try mapHTTPError(status: http.statusCode, response: http, body: bodyString)
    }

    private func mapHTTPError(status: Int, response: HTTPURLResponse, body: String) throws {
        switch status {
        case 401:
            throw AnthropicError.invalidAPIKey
        case 429:
            let retryAfter: TimeInterval? = (response.value(forHTTPHeaderField: "retry-after") as NSString?)?.doubleValue
            throw AnthropicError.rateLimited(retryAfter: retryAfter)
        case 400...499:
            throw AnthropicError.clientError(status: status, body: body)
        case 500...599:
            throw AnthropicError.serverError(status: status, body: body)
        default:
            throw AnthropicError.serverError(status: status, body: body)
        }
    }

    private func collectBody(from bytes: URLSession.AsyncBytes) async throws -> String {
        var data: Data = Data()
        for try await byte in bytes {
            data.append(byte)
            if data.count > 64 * 1024 { break }
        }
        return String(data: data, encoding: .utf8) ?? ""
    }
}
