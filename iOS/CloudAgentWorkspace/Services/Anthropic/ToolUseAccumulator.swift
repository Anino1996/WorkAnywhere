import Foundation

struct ToolUseAccumulator {
    struct PendingToolUse: Sendable, Equatable {
        let id: String
        let name: String
        var partialJson: String

        init(id: String, name: String) {
            self.id = id
            self.name = name
            self.partialJson = ""
        }
    }

    private var pendingByIndex: [Int: PendingToolUse] = [:]

    mutating func startToolUse(index: Int, id: String, name: String) {
        pendingByIndex[index] = PendingToolUse(id: id, name: name)
    }

    mutating func appendInputJson(index: Int, fragment: String) {
        guard var pending: PendingToolUse = pendingByIndex[index] else { return }
        pending.partialJson.append(fragment)
        pendingByIndex[index] = pending
    }

    mutating func finalize(index: Int) throws -> ContentBlock? {
        guard let pending: PendingToolUse = pendingByIndex.removeValue(forKey: index) else {
            return nil
        }
        let trimmed: String = pending.partialJson.trimmingCharacters(in: .whitespacesAndNewlines)
        let raw: String = trimmed.isEmpty ? "{}" : trimmed
        guard let data: Data = raw.data(using: .utf8) else {
            throw AnthropicError.decodingFailed(underlying: "tool_use partial_json non-utf8")
        }
        do {
            let value: JSONValue = try JSONDecoder().decode(JSONValue.self, from: data)
            return .toolUse(id: pending.id, name: pending.name, input: value)
        } catch {
            throw AnthropicError.decodingFailed(underlying: "tool_use input_json invalid: \(error.localizedDescription)")
        }
    }

    func hasPending(index: Int) -> Bool {
        return pendingByIndex[index] != nil
    }
}
