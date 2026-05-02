import Foundation

struct Workspace: Identifiable, Codable {
    let id: String
    let name: String
    let status: String
    let createdAt: Date? = nil
    let lastAccessedAt: Date? = nil

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case status
        case createdAt = "created_at"
        case lastAccessedAt = "last_accessed_at"
    }
}
