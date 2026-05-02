import SwiftUI
import Combine

@MainActor
class HomeViewModel: ObservableObject {
    @Published var workspaces: [Workspace] = []
    @Published var recentProjects: [Project] = []
    @Published var selectedAIModel: AIModel = .claude
    @Published var isLoading: Bool = false

    private let apiClient: APIClient = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    func loadWorkspaces() async {
        isLoading = true
        do {
            workspaces = try await apiClient.getWorkspaces()
        } catch {
            print("Error loading workspaces: \(error)")
        }
        isLoading = false
    }

    func loadRecentProjects() async {
        do {
            recentProjects = try await apiClient.getRecentProjects()
        } catch {
            print("Error loading recent projects: \(error)")
        }
    }

    func startCoding() {
        print("Start Coding tapped")
    }

    func viewDiffs() {
        print("View Diffs tapped")
    }

    deinit {
        pollingTask?.cancel()
    }
}
