import SwiftUI

struct ChatView: View {
    @StateObject private var viewModel: ChatViewModel = ChatViewModel(
        seed: [
            ChatMessage(content: "Add authentication to my API and include tests", isUser: true),
            ChatMessage(content: "I've implemented authentication and added tests.", isUser: false)
        ]
    )

    private let changeFiles: [FileChange] = [
        FileChange(filename: "auth.py", additions: 45, deletions: 10),
        FileChange(filename: "app.py", additions: 18, deletions: 6),
        FileChange(filename: "test_auth.py", additions: 72, deletions: 0),
        FileChange(filename: "utils.py", additions: 12, deletions: 3)
    ]

    var body: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.black,
                    Color(white: 0.05)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            RadialGradient(
                gradient: Gradient(colors: [
                    Color.blue.opacity(0.10),
                    Color.clear
                ]),
                center: .topLeading,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()

            RadialGradient(
                gradient: Gradient(colors: [
                    Color.purple.opacity(0.08),
                    Color.clear
                ]),
                center: .bottomTrailing,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                ChatHeaderBar()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ForEach(viewModel.messages) { message in
                            ChatBubble(message: message)
                        }

                        if viewModel.isStreaming && !viewModel.streamingAssistantText.isEmpty {
                            ChatBubble(
                                message: ChatMessage(
                                    content: viewModel.streamingAssistantText,
                                    isUser: false
                                )
                            )
                        }

                        if let error: String = viewModel.lastError {
                            Text("Error: \(error)")
                                .font(.system(.footnote, design: .rounded))
                                .foregroundColor(.red.opacity(0.85))
                                .padding(.horizontal, 16)
                        }

                        HStack {
                            ChangeCard(files: changeFiles, totalFileCount: 6)
                                .padding(.horizontal, 16)

                            Spacer(minLength: 0)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.vertical, 16)
                }

                ChatActionRow()

                ChatInputBar(viewModel: viewModel)
            }
        }
    }
}

#Preview {
    ChatView()
}
