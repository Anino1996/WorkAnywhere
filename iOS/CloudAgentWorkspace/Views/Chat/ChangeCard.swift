import SwiftUI

struct FileChange: Identifiable {
    let id: String = UUID().uuidString
    let filename: String
    let additions: Int
    let deletions: Int
}

struct ChangeCard: View {
    let files: [FileChange]
    let totalFileCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Changes Ready")
                    .font(.system(.headline, design: .rounded))
                    .foregroundColor(.white)

                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.green)
            }

            VStack(alignment: .leading, spacing: 10) {
                ForEach(files.prefix(4)) { file in
                    FileChangeRow(file: file)
                }

                if totalFileCount > 4 {
                    Text("+\(totalFileCount - 4) more files")
                        .font(.system(.footnote, design: .rounded))
                        .foregroundColor(.gray)
                        .padding(.top, 2)
                }
            }

            HStack(spacing: 12) {
                Button(action: {}) {
                    Text("Review (\(totalFileCount) files)")
                        .font(.system(.footnote, design: .rounded).weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.blue)
                        )
                }

                Button(action: {}) {
                    Text("Undo")
                        .font(.system(.footnote, design: .rounded).weight(.semibold))
                        .foregroundColor(.white.opacity(0.85))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(white: 0.18))
                        )
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(white: 0.10))
        )
        .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
        .frame(maxWidth: 300, alignment: .leading)
    }
}

struct FileChangeRow: View {
    let file: FileChange

    var body: some View {
        HStack(spacing: 12) {
            Text(file.filename)
                .font(.system(.subheadline, design: .monospaced))
                .foregroundColor(.white.opacity(0.85))

            Spacer()

            HStack(spacing: 8) {
                Text("+\(file.additions)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.green.opacity(0.8))

                Text("−\(file.deletions)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.red.opacity(0.8))
            }
        }
    }
}

#Preview {
    ChangeCard(
        files: [
            FileChange(filename: "auth.py", additions: 45, deletions: 10),
            FileChange(filename: "app.py", additions: 18, deletions: 6),
            FileChange(filename: "test_auth.py", additions: 72, deletions: 0),
            FileChange(filename: "utils.py", additions: 12, deletions: 3)
        ],
        totalFileCount: 6
    )
    .padding()
    .background(Color.black)
}
