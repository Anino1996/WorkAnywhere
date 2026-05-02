import SwiftUI

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isUser {
                Spacer(minLength: 40)
                UserBubble(content: message.content)
            } else {
                AIBubble(content: message.content)
                Spacer(minLength: 40)
            }
        }
        .padding(.horizontal, 16)
    }
}

struct UserBubble: View {
    let content: String

    var body: some View {
        Text(content)
            .font(.system(.subheadline, design: .rounded))
            .foregroundColor(.white)
            .lineLimit(nil)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(white: 0.18))
            )
    }
}

struct AIBubble: View {
    let content: String

    var body: some View {
        Text(content)
            .font(.system(.subheadline, design: .rounded))
            .foregroundColor(.white)
            .lineLimit(nil)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(white: 0.10))

                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.blue.opacity(0.06))
                        .blur(radius: 8)
                }
            )
            .shadow(color: Color.blue.opacity(0.15), radius: 12, x: 0, y: 4)
    }
}

#Preview {
    VStack(spacing: 16) {
        ChatBubble(message: ChatMessage(content: "Add authentication to my API and include tests", isUser: true))
        ChatBubble(message: ChatMessage(content: "I've implemented authentication and added tests.", isUser: false))
    }
    .padding()
    .background(Color.black)
}
