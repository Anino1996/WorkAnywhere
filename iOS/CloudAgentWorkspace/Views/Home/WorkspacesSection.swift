import SwiftUI

struct WorkspacesSection: View {
    let workspaces: [Workspace]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Workspaces")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    NewWorkspaceCard()

                    ForEach(workspaces) { workspace in
                        WorkspaceCard(workspace: workspace)
                    }

                    WorkspaceCard(workspace: Workspace(id: "test1", name: "Test1", status: "Active Session"))

                    WorkspaceCard(workspace: Workspace(id: "test2", name: "Test2", status: "Paused"))
                }
            }
        }
    }
}

struct WorkspaceCard: View {
    let workspace: Workspace

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "desktopcomputer")
                .font(.system(size: 20))
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(workspace.name)
                    .font(.subheadline)
                    .lineLimit(1)

                Text(workspace.status)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(height: 100, alignment: .center)
        .frame(minWidth: 110)
        .padding(12)
        .background(Color(.systemGray6).opacity(0.3))
        .cornerRadius(12)
    }
}

struct NewWorkspaceCard: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.blue)

            VStack(alignment: .center, spacing: 2) {
                Text("Start New")
                    .font(.subheadline)
                    .lineLimit(1)

                Text("Workspace")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(height: 100, alignment: .center)
        .frame(minWidth: 110)
        .padding(12)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.purple.opacity(0.2),
                    Color.pink.opacity(0.2)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(12)
    }
}

#Preview {
    WorkspacesSection(workspaces: [
        Workspace(id: "1", name: "Dev Server 1", status: "Active Session"),
        Workspace(id: "2", name: "Project Alpha", status: "Paused")
    ])
}
