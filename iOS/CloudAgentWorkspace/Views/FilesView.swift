import SwiftUI

struct FilesView: View {
    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            NavigationView {
                VStack {
                    Text("Files")
                        .font(.title2)
                    Spacer()
                }
                .navigationTitle("Files")
            }
        }
    }
}

#Preview {
    FilesView()
}
