import SwiftUI

struct ChatActionRow: View {
    var body: some View {
        HStack(spacing: 24) {
            ActionButton(icon: "play.fill", label: "Run")
            ActionButton(icon: "testtube.2", label: "Test")
            ActionButton(icon: "hammer.fill", label: "Build")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

struct ActionButton: View {
    let icon: String
    let label: String

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                Text(label)
                    .font(.system(.footnote, design: .rounded))
            }
            .foregroundColor(.white.opacity(0.7))
        }
    }
}

#Preview {
    ChatActionRow()
        .background(Color.black)
}
