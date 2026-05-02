import SwiftUI

@main
struct CloudAgentWorkspaceApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .task {
                    try? APIKeyStore.shared.setAPIKey("sk-ant-REPLACE_ME")
                }
        }
    }
}
