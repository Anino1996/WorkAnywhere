import Foundation

struct MessagesResponse: Codable, Sendable {
    let id: String
    let type: String
    let role: String
    let model: String
    let content: [ContentBlock]
    let stopReason: StopReason?
    let stopSequence: String?
    let usage: Usage

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case role
        case model
        case content
        case stopReason = "stop_reason"
        case stopSequence = "stop_sequence"
        case usage
    }
}

enum StopReason: String, Codable, Sendable {
    case endTurn = "end_turn"
    case toolUse = "tool_use"
    case maxTokens = "max_tokens"
    case stopSequence = "stop_sequence"
    case pauseTurn = "pause_turn"
    case refusal
}

struct Usage: Codable, Sendable, Equatable {
    let inputTokens: Int?
    let outputTokens: Int?
    let cacheCreationInputTokens: Int?
    let cacheReadInputTokens: Int?

    private enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case cacheCreationInputTokens = "cache_creation_input_tokens"
        case cacheReadInputTokens = "cache_read_input_tokens"
    }
}

struct AnthropicAPIErrorPayload: Codable, Sendable {
    let type: String
    let error: Inner

    struct Inner: Codable, Sendable {
        let type: String
        let message: String
    }
}
