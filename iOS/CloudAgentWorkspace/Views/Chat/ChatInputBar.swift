import SwiftUI

struct ChatInputBar: View {
    @ObservedObject var viewModel: ChatViewModel

    private var isSendDisabled: Bool {
        return !viewModel.isStreaming && viewModel.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(spacing: 10) {
            Button(action: {}) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white.opacity(0.6))
            }
            .frame(width: 32, height: 32)

            ZStack {
                RoundedRectangle(cornerRadius: 18)
                    .fill(Color(white: 0.10))

                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.blue.opacity(0.04))
                    .blur(radius: 6)

                TextField(
                    "",
                    text: $viewModel.draft,
                    prompt: Text("Type what you want to build…").foregroundColor(.white.opacity(0.4))
                )
                .font(.system(.subheadline, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .submitLabel(.send)
                .disabled(viewModel.isStreaming)
                .onSubmit { viewModel.send() }
            }
            .frame(height: 36)

            Button(action: handleTap) {
                Image(systemName: viewModel.isStreaming ? "stop.fill" : "arrow.up")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
            }
            .frame(width: 36, height: 36)
            .background(
                Circle()
                    .fill(isSendDisabled ? Color.blue.opacity(0.4) : Color.blue)
            )
            .disabled(isSendDisabled)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private func handleTap() {
        if viewModel.isStreaming {
            viewModel.cancel()
        } else {
            viewModel.send()
        }
    }
}

#Preview {
    ChatInputBar(viewModel: ChatViewModel())
        .background(Color.black)
}
