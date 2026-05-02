import Foundation

enum ContentBlock: Codable, Sendable, Equatable {
    case text(String)
    case toolUse(id: String, name: String, input: JSONValue)
    case toolResult(toolUseId: String, content: String, isError: Bool?)
    case image(mediaType: String, base64Data: String)
    case thinking(text: String, signature: String?)

    private enum CodingKeys: String, CodingKey {
        case type
        case text
        case id
        case name
        case input
        case toolUseId = "tool_use_id"
        case content
        case isError = "is_error"
        case source
        case signature
    }

    private enum SourceKeys: String, CodingKey {
        case type
        case mediaType = "media_type"
        case data
    }

    init(from decoder: Decoder) throws {
        let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)
        let type: String = try container.decode(String.self, forKey: .type)
        switch type {
        case "text":
            let text: String = try container.decode(String.self, forKey: .text)
            self = .text(text)
        case "tool_use":
            let id: String = try container.decode(String.self, forKey: .id)
            let name: String = try container.decode(String.self, forKey: .name)
            let input: JSONValue = (try? container.decode(JSONValue.self, forKey: .input)) ?? .object([:])
            self = .toolUse(id: id, name: name, input: input)
        case "tool_result":
            let toolUseId: String = try container.decode(String.self, forKey: .toolUseId)
            let content: String = (try? container.decode(String.self, forKey: .content)) ?? ""
            let isError: Bool? = try container.decodeIfPresent(Bool.self, forKey: .isError)
            self = .toolResult(toolUseId: toolUseId, content: content, isError: isError)
        case "image":
            let source: KeyedDecodingContainer<SourceKeys> = try container.nestedContainer(keyedBy: SourceKeys.self, forKey: .source)
            let mediaType: String = try source.decode(String.self, forKey: .mediaType)
            let data: String = try source.decode(String.self, forKey: .data)
            self = .image(mediaType: mediaType, base64Data: data)
        case "thinking":
            let text: String = (try? container.decode(String.self, forKey: .text)) ?? ""
            let signature: String? = try container.decodeIfPresent(String.self, forKey: .signature)
            self = .thinking(text: text, signature: signature)
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown content block type \(type)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container: KeyedEncodingContainer<CodingKeys> = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let text):
            try container.encode("text", forKey: .type)
            try container.encode(text, forKey: .text)
        case .toolUse(let id, let name, let input):
            try container.encode("tool_use", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(name, forKey: .name)
            try container.encode(input, forKey: .input)
        case .toolResult(let toolUseId, let content, let isError):
            try container.encode("tool_result", forKey: .type)
            try container.encode(toolUseId, forKey: .toolUseId)
            try container.encode(content, forKey: .content)
            try container.encodeIfPresent(isError, forKey: .isError)
        case .image(let mediaType, let base64Data):
            try container.encode("image", forKey: .type)
            var source: KeyedEncodingContainer<SourceKeys> = container.nestedContainer(keyedBy: SourceKeys.self, forKey: .source)
            try source.encode("base64", forKey: .type)
            try source.encode(mediaType, forKey: .mediaType)
            try source.encode(base64Data, forKey: .data)
        case .thinking(let text, let signature):
            try container.encode("thinking", forKey: .type)
            try container.encode(text, forKey: .text)
            try container.encodeIfPresent(signature, forKey: .signature)
        }
    }
}
