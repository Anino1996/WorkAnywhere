import SwiftUI

struct RecentProjectsSection: View {
    let projects: [Project]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Projects")
                    .font(.headline)

                Spacer()

                NavigationLink("See all", destination: Text("All Projects"))
                    .font(.subheadline)
                    .foregroundColor(.blue)
            }

            VStack(spacing: 0) {
                ForEach(projects) { project in
                    ProjectRow(project: project)

                    if project.id != projects.last?.id {
                        Divider()
                            .padding(.vertical, 12)
                    }
                }
            }
        }
    }
}

struct ProjectRow: View {
    let project: Project

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "folder.fill")
                .font(.system(size: 20))
                .foregroundColor(.blue)
                .frame(width: 40, height: 40)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)

            VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(project.lastUpdated)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
                .font(.system(size: 12, weight: .semibold))
        }
    }
}

#Preview {
    RecentProjectsSection(projects: [
        Project(id: "1", name: "E-commerce App", lastUpdated: "Updated 2h ago"),
        Project(id: "2", name: "API Backend", lastUpdated: "Updated 5h ago"),
        Project(id: "3", name: "Portfolio Site", lastUpdated: "Updated yesterday")
    ])
}
