import Foundation

enum AnthropicError: Error, Sendable {
    case missingAPIKey
    case invalidAPIKey
    case rateLimited(retryAfter: TimeInterval?)
    case serverError(status: Int, body: String)
    case clientError(status: Int, body: String)
    case streamAborted(reason: String)
    case decodingFailed(underlying: String)
    case invalidResponse
    case keychainFailed(status: OSStatus)
}

extension AnthropicError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "No Anthropic API key configured. Add one in Settings."
        case .invalidAPIKey:
            return "The Anthropic API key was rejected. Re-enter it in Settings."
        case .rateLimited(let retryAfter):
            if let retryAfter: TimeInterval = retryAfter {
                return "Rate limited by Anthropic. Retry after \(Int(retryAfter))s."
            }
            return "Rate limited by Anthropic. Try again shortly."
        case .serverError(let status, _):
            return "Anthropic server error (\(status)). Try again."
        case .clientError(let status, let body):
            return "Anthropic request error (\(status)): \(body)"
        case .streamAborted(let reason):
            return "Stream aborted: \(reason)"
        case .decodingFailed(let underlying):
            return "Failed to decode response: \(underlying)"
        case .invalidResponse:
            return "Unexpected response from Anthropic."
        case .keychainFailed(let status):
            return "Keychain operation failed (OSStatus \(status))."
        }
    }
}
