import Foundation

nonisolated(unsafe) let sharedAPIClient: APIClient = APIClient()

class APIClient: NSObject, Sendable {
    static let shared: APIClient = sharedAPIClient

    private let baseURL: URL
    private let session: URLSession

    override init() {
        self.baseURL = URL(string: "http://localhost:8080")!
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
        super.init()
    }

    func getWorkspaces() async throws -> [Workspace] {
        let url = baseURL.appendingPathComponent("api/v1/workspaces")
        let (data, _) = try await session.data(from: url)
        return try JSONDecoder().decode([Workspace].self, from: data)
    }

    func getRecentProjects() async throws -> [Project] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/projects"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "limit", value: "3")]
        guard let url = components?.url else { throw URLError(.badURL) }
        let (data, _) = try await session.data(from: url)
        return try JSONDecoder().decode([Project].self, from: data)
    }

    func saveAIModelPreference(model: AIModel) async throws {
        let url = baseURL.appendingPathComponent("api/v1/user/settings")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["ai_model": model.rawValue]
        request.httpBody = try JSONEncoder().encode(body)
        _ = try await session.data(for: request)
    }
}
