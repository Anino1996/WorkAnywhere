import Foundation

struct SSEParser {
    private var currentEvent: String = ""
    private var currentData: String = ""
    private var hasContent: Bool = false

    mutating func feed(line: String) -> RawSSEEvent? {
        if line.isEmpty {
            return flush()
        }

        if line.hasPrefix(":") {
            return nil
        }

        if let separator: String.Index = line.firstIndex(of: ":") {
            let field: String = String(line[line.startIndex..<separator])
            var value: String = String(line[line.index(after: separator)...])
            if value.hasPrefix(" ") {
                value.removeFirst()
            }
            apply(field: field, value: value)
        } else {
            apply(field: line, value: "")
        }

        return nil
    }

    mutating func finish() -> RawSSEEvent? {
        return flush()
    }

    private mutating func apply(field: String, value: String) {
        switch field {
        case "event":
            currentEvent = value
            hasContent = true
        case "data":
            if !currentData.isEmpty {
                currentData.append("\n")
            }
            currentData.append(value)
            hasContent = true
        case "id", "retry":
            break
        default:
            break
        }
    }

    private mutating func flush() -> RawSSEEvent? {
        defer {
            currentEvent = ""
            currentData = ""
            hasContent = false
        }
        guard hasContent else { return nil }
        let event: String = currentEvent.isEmpty ? "message" : currentEvent
        return RawSSEEvent(event: event, data: currentData)
    }
}
