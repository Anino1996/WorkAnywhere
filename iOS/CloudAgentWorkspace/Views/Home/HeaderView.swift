import SwiftUI

struct HeaderView: View {
    let userName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Welcome, \(userName)")
                    .font(.system(size: 28, weight: .bold))
                Spacer()
            }

            Text("Let's start coding with AI assistance.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    HeaderView(userName: "Alex")
}
