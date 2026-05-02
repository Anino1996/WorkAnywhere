import SwiftUI

struct SettingsView: View {
    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            NavigationView {
                VStack {
                    Text("Settings")
                        .font(.title2)
                    Spacer()
                }
                .navigationTitle("Settings")
            }
        }
    }
}

#Preview {
    SettingsView()
}
