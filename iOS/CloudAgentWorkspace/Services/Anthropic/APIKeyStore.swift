import Foundation
import Security

final class APIKeyStore: Sendable {
    static let shared: APIKeyStore = APIKeyStore()

    private let service: String
    private let account: String

    init(service: String = "com.workanywhere.cloudagent", account: String = "anthropic_api_key") {
        self.service = service
        self.account = account
    }

    func getAPIKey() throws -> String? {
        var query: [String: Any] = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status: OSStatus = SecItemCopyMatching(query as CFDictionary, &item)
        switch status {
        case errSecSuccess:
            guard let data: Data = item as? Data, let key: String = String(data: data, encoding: .utf8) else {
                throw AnthropicError.keychainFailed(status: status)
            }
            return key
        case errSecItemNotFound:
            return nil
        default:
            throw AnthropicError.keychainFailed(status: status)
        }
    }

    func setAPIKey(_ key: String) throws {
        guard let data: Data = key.data(using: .utf8) else {
            throw AnthropicError.keychainFailed(status: errSecParam)
        }

        var attributes: [String: Any] = baseQuery()
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        attributes[kSecValueData as String] = data

        let addStatus: OSStatus = SecItemAdd(attributes as CFDictionary, nil)
        switch addStatus {
        case errSecSuccess:
            return
        case errSecDuplicateItem:
            let updateAttrs: [String: Any] = [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            ]
            let updateStatus: OSStatus = SecItemUpdate(baseQuery() as CFDictionary, updateAttrs as CFDictionary)
            if updateStatus != errSecSuccess {
                throw AnthropicError.keychainFailed(status: updateStatus)
            }
        default:
            throw AnthropicError.keychainFailed(status: addStatus)
        }
    }

    func deleteAPIKey() throws {
        let status: OSStatus = SecItemDelete(baseQuery() as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw AnthropicError.keychainFailed(status: status)
        }
    }

    func hasAPIKey() -> Bool {
        return (try? getAPIKey()) != nil
    }

    private func baseQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
