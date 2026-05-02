import SwiftUI

struct ChatHeaderBar: View {
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.green)
                .frame(width: 6, height: 6)
                .shadow(color: Color.green.opacity(0.7), radius: 2, x: 0, y: 0)

            Text("Dev Server 1 • Python")
                .font(.system(.caption, design: .rounded))
                .foregroundColor(.white.opacity(0.75))

            Spacer()

            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.gray)
        }
        .frame(height: 32)
        .padding(.horizontal, 16)
    }
}

#Preview {
    ChatHeaderBar()
        .background(Color.black)
}
