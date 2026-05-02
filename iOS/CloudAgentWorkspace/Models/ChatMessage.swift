import Foundation

struct ChatMessage: Identifiable {
    let id: String = UUID().uuidString
    let content: String
    let isUser: Bool
    let timestamp: Date = Date()
    let links: [ChatLink] = []
}

struct ChatLink: Identifiable {
    let id: String = UUID().uuidString
    let title: String
    let action: () -> Void
}
