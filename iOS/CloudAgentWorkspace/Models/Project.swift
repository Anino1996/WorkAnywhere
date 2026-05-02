import Foundation

struct Project: Identifiable, Codable {
    let id: String
    let name: String
    let lastUpdated: String
    let workspaceId: String? = nil

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case lastUpdated = "last_updated"
        case workspaceId = "workspace_id"
    }
}
