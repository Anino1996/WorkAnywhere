import Foundation
import SwiftUI

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage]
    @Published var draft: String = ""
    @Published var isStreaming: Bool = false
    @Published var streamingAssistantText: String = ""
    @Published var lastError: String?

    private let client: AnthropicClient
    private let model: String
    private var currentTask: Task<Void, Never>?

    init(
        client: AnthropicClient = AnthropicClient.shared,
        model: String = "claude-sonnet-4-5",
        seed: [ChatMessage] = []
    ) {
        self.client = client
        self.model = model
        self.messages = seed
    }

    func send() {
        let trimmed: String = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming else { return }

        let userMessage: ChatMessage = ChatMessage(content: trimmed, isUser: true)
        messages.append(userMessage)
        draft = ""
        lastError = nil
        isStreaming = true
        streamingAssistantText = ""

        let request: MessagesRequest = buildRequest()
        currentTask = Task { [weak self] in
            await self?.consume(request: request)
        }
    }

    func cancel() {
        currentTask?.cancel()
    }

    private func buildRequest() -> MessagesRequest {
        let history: [Message] = messages.map { msg in
            Message(
                role: msg.isUser ? .user : .assistant,
                content: [.text(msg.content)]
            )
        }
        return MessagesRequest(
            model: model,
            maxTokens: 4096,
            system: [SystemBlock(text: SystemPrompt.coding)],
            messages: history,
            tools: AnthropicTools.defaultTools(),
            toolChoice: .auto,
            temperature: 0.0,
            stream: true
        )
    }

    private func consume(request: MessagesRequest) async {
        do {
            let stream: AsyncThrowingStream<StreamEvent, Error> = try await client.streamMessage(request: request)
            for try await event in stream {
                switch event {
                case .contentBlockDelta(_, .textDelta(let chunk)):
                    streamingAssistantText.append(chunk)
                case .messageStop:
                    finalize(error: nil)
                    return
                case .error(_, let message):
                    finalize(error: message)
                    return
                default:
                    break
                }
            }
            finalize(error: nil)
        } catch is CancellationError {
            finalize(error: nil)
        } catch {
            finalize(error: error.localizedDescription)
        }
    }

    private func finalize(error: String?) {
        let captured: String = streamingAssistantText
        if !captured.isEmpty {
            messages.append(ChatMessage(content: captured, isUser: false))
        }
        streamingAssistantText = ""
        isStreaming = false
        lastError = error
        currentTask = nil
    }
}
