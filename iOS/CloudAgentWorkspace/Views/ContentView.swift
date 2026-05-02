import SwiftUI

struct ContentView: View {
    @State private var selectedTab: Tab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(Tab.home)

            FilesView()
                .tabItem {
                    Label("Files", systemImage: "doc.fill")
                }
                .tag(Tab.files)

            ChatView()
                .tabItem {
                    Label("Chat", systemImage: "message.fill")
                }
                .tag(Tab.chat)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(Tab.settings)
        }
        .preferredColorScheme(.dark)
    }
}

enum Tab {
    case home
    case files
    case chat
    case settings
}

#Preview {
    ContentView()
}
