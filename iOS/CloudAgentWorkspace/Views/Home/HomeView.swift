import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel: HomeViewModel = HomeViewModel()

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            NavigationView {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                    HeaderView(userName: "Alex")

                    WorkspacesSection(workspaces: viewModel.workspaces)

                    AIModelSelector(
                        selectedModel: $viewModel.selectedAIModel
                    )

                    Button(action: { viewModel.startCoding() }) {
                        Text("Start Coding")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(16)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }

                    Button(action: { viewModel.viewDiffs() }) {
                        Text("View Diffs")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(Color.gray.opacity(0.3))
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }

                    Spacer(minLength: 20)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await viewModel.loadWorkspaces()
                await viewModel.loadRecentProjects()
            }
        }
        .onAppear {
            Task {
                await viewModel.loadWorkspaces()
                await viewModel.loadRecentProjects()
            }
            }
        }
    }
}

#Preview {
    HomeView()
}
