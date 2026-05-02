import Foundation

enum StreamEvent: Sendable, Equatable {
    case messageStart(id: String, model: String, usage: Usage)
    case contentBlockStart(index: Int, block: StreamContentBlockStart)
    case contentBlockDelta(index: Int, delta: ContentBlockDelta)
    case contentBlockStop(index: Int)
    case messageDelta(stopReason: StopReason?, stopSequence: String?, usage: Usage?)
    case messageStop
    case ping
    case error(type: String, message: String)
}

enum StreamContentBlockStart: Sendable, Equatable {
    case text(String)
    case toolUse(id: String, name: String)
    case thinking
}

enum ContentBlockDelta: Sendable, Equatable {
    case textDelta(String)
    case inputJsonDelta(String)
    case thinkingDelta(String)
    case signatureDelta(String)
}

struct RawSSEEvent: Sendable, Equatable {
    let event: String
    let data: String
}

enum StreamEventDecoder {
    static func decode(_ raw: RawSSEEvent) throws -> StreamEvent? {
        if raw.event == "ping" {
            return .ping
        }

        guard let data: Data = raw.data.data(using: .utf8) else {
            throw AnthropicError.decodingFailed(underlying: "non-utf8 SSE payload")
        }

        let decoder: JSONDecoder = JSONDecoder()

        switch raw.event {
        case "message_start":
            let payload: MessageStartPayload = try decoder.decode(MessageStartPayload.self, from: data)
            return .messageStart(
                id: payload.message.id,
                model: payload.message.model,
                usage: payload.message.usage
            )

        case "content_block_start":
            let payload: ContentBlockStartPayload = try decoder.decode(ContentBlockStartPayload.self, from: data)
            let block: StreamContentBlockStart
            switch payload.contentBlock.type {
            case "text":
                block = .text(payload.contentBlock.text ?? "")
            case "tool_use":
                block = .toolUse(id: payload.contentBlock.id ?? "", name: payload.contentBlock.name ?? "")
            case "thinking":
                block = .thinking
            default:
                return nil
            }
            return .contentBlockStart(index: payload.index, block: block)

        case "content_block_delta":
            let payload: ContentBlockDeltaPayload = try decoder.decode(ContentBlockDeltaPayload.self, from: data)
            let delta: ContentBlockDelta
            switch payload.delta.type {
            case "text_delta":
                delta = .textDelta(payload.delta.text ?? "")
            case "input_json_delta":
                delta = .inputJsonDelta(payload.delta.partialJson ?? "")
            case "thinking_delta":
                delta = .thinkingDelta(payload.delta.thinking ?? "")
            case "signature_delta":
                delta = .signatureDelta(payload.delta.signature ?? "")
            default:
                return nil
            }
            return .contentBlockDelta(index: payload.index, delta: delta)

        case "content_block_stop":
            let payload: ContentBlockStopPayload = try decoder.decode(ContentBlockStopPayload.self, from: data)
            return .contentBlockStop(index: payload.index)

        case "message_delta":
            let payload: MessageDeltaPayload = try decoder.decode(MessageDeltaPayload.self, from: data)
            return .messageDelta(
                stopReason: payload.delta.stopReason,
                stopSequence: payload.delta.stopSequence,
                usage: payload.usage
            )

        case "message_stop":
            return .messageStop

        case "error":
            let payload: ErrorPayload = try decoder.decode(ErrorPayload.self, from: data)
            return .error(type: payload.error.type, message: payload.error.message)

        default:
            return nil
        }
    }
}

private struct MessageStartPayload: Codable {
    let type: String
    let message: Inner

    struct Inner: Codable {
        let id: String
        let model: String
        let usage: Usage
    }
}

private struct ContentBlockStartPayload: Codable {
    let type: String
    let index: Int
    let contentBlock: Inner

    private enum CodingKeys: String, CodingKey {
        case type
        case index
        case contentBlock = "content_block"
    }

    struct Inner: Codable {
        let type: String
        let id: String?
        let name: String?
        let text: String?
    }
}

private struct ContentBlockDeltaPayload: Codable {
    let type: String
    let index: Int
    let delta: Inner

    struct Inner: Codable {
        let type: String
        let text: String?
        let partialJson: String?
        let thinking: String?
        let signature: String?

        private enum CodingKeys: String, CodingKey {
            case type
            case text
            case partialJson = "partial_json"
            case thinking
            case signature
        }
    }
}

private struct ContentBlockStopPayload: Codable {
    let type: String
    let index: Int
}

private struct MessageDeltaPayload: Codable {
    let type: String
    let delta: Inner
    let usage: Usage?

    struct Inner: Codable {
        let stopReason: StopReason?
        let stopSequence: String?

        private enum CodingKeys: String, CodingKey {
            case stopReason = "stop_reason"
            case stopSequence = "stop_sequence"
        }
    }
}

private struct ErrorPayload: Codable {
    let type: String
    let error: Inner

    struct Inner: Codable {
        let type: String
        let message: String
    }
}
