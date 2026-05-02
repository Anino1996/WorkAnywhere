import SwiftUI

struct AIModelSelector: View {
    @Binding var selectedModel: AIModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI Model")
                .font(.headline)

            Picker("AI Model", selection: $selectedModel) {
                ForEach(AIModel.allCases, id: \.self) { model in
                    Text(model.displayName).tag(model)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}

enum AIModel: String, CaseIterable {
    case gpt = "gpt"
    case claude = "claude"
    case gemini = "gemini"

    var displayName: String {
        switch self {
        case .gpt:
            return "GPT"
        case .claude:
            return "Claude"
        case .gemini:
            return "Gemini"
        }
    }
}

#Preview {
    AIModelSelector(selectedModel: .constant(.claude))
}
