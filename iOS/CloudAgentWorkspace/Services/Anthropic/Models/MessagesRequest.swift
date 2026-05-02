import Foundation

struct MessagesRequest: Codable, Sendable {
    var model: String
    var maxTokens: Int
    var system: [SystemBlock]?
    var messages: [Message]
    var tools: [ToolDefinition]?
    var toolChoice: ToolChoice?
    var temperature: Double?
    var topP: Double?
    var stopSequences: [String]?
    var stream: Bool?
    var metadata: Metadata?

    private enum CodingKeys: String, CodingKey {
        case model
        case maxTokens = "max_tokens"
        case system
        case messages
        case tools
        case toolChoice = "tool_choice"
        case temperature
        case topP = "top_p"
        case stopSequences = "stop_sequences"
        case stream
        case metadata
    }

    init(
        model: String,
        maxTokens: Int = 4096,
        system: [SystemBlock]? = nil,
        messages: [Message],
        tools: [ToolDefinition]? = nil,
        toolChoice: ToolChoice? = nil,
        temperature: Double? = 0.0,
        topP: Double? = nil,
        stopSequences: [String]? = nil,
        stream: Bool? = true,
        metadata: Metadata? = nil
    ) {
        self.model = model
        self.maxTokens = maxTokens
        self.system = system
        self.messages = messages
        self.tools = tools
        self.toolChoice = toolChoice
        self.temperature = temperature
        self.topP = topP
        self.stopSequences = stopSequences
        self.stream = stream
        self.metadata = metadata
    }
}

struct SystemBlock: Codable, Sendable, Equatable {
    let type: String
    let text: String
    let cacheControl: CacheControl?

    private enum CodingKeys: String, CodingKey {
        case type
        case text
        case cacheControl = "cache_control"
    }

    init(text: String, cacheControl: CacheControl? = .ephemeral) {
        self.type = "text"
        self.text = text
        self.cacheControl = cacheControl
    }
}

struct Message: Codable, Sendable, Equatable {
    let role: Role
    let content: [ContentBlock]

    enum Role: String, Codable, Sendable {
        case user
        case assistant
    }

    init(role: Role, content: [ContentBlock]) {
        self.role = role
        self.content = content
    }

    static func user(_ text: String) -> Message {
        return Message(role: .user, content: [.text(text)])
    }

    static func assistant(_ text: String) -> Message {
        return Message(role: .assistant, content: [.text(text)])
    }
}

struct Metadata: Codable, Sendable, Equatable {
    let userId: String?

    private enum CodingKeys: String, CodingKey {
        case userId = "user_id"
    }
}
