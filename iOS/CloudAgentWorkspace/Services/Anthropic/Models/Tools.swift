import Foundation

struct ToolDefinition: Codable, Sendable, Equatable {
    let name: String
    let description: String
    let inputSchema: JSONValue
    let cacheControl: CacheControl?

    private enum CodingKeys: String, CodingKey {
        case name
        case description
        case inputSchema = "input_schema"
        case cacheControl = "cache_control"
    }

    init(name: String, description: String, inputSchema: JSONValue, cacheControl: CacheControl? = nil) {
        self.name = name
        self.description = description
        self.inputSchema = inputSchema
        self.cacheControl = cacheControl
    }
}

struct CacheControl: Codable, Sendable, Equatable {
    let type: String

    static let ephemeral: CacheControl = CacheControl(type: "ephemeral")
}

struct ToolChoice: Codable, Sendable, Equatable {
    let type: String
    let name: String?

    static let auto: ToolChoice = ToolChoice(type: "auto", name: nil)
    static let any: ToolChoice = ToolChoice(type: "any", name: nil)

    static func tool(name: String) -> ToolChoice {
        return ToolChoice(type: "tool", name: name)
    }
}

enum AnthropicTools {
    static let stringReplace: ToolDefinition = ToolDefinition(
        name: "string_replace",
        description: """
        Replace text in an existing file. Default: search must match exactly once. \
        Set replace_all to replace every occurrence (use only for rename-everywhere cases). \
        For ambiguous matches, retry with more surrounding context lines until the search is unique.
        """,
        inputSchema: .object([
            "type": .string("object"),
            "properties": .object([
                "path": .object([
                    "type": .string("string"),
                    "description": .string("Path relative to workspace root")
                ]),
                "search": .object([
                    "type": .string("string"),
                    "description": .string("Exact text to find. Must include enough surrounding context to match exactly once.")
                ]),
                "replace": .object([
                    "type": .string("string"),
                    "description": .string("Replacement text")
                ]),
                "replace_all": .object([
                    "type": .string("boolean"),
                    "default": .bool(false),
                    "description": .string("If true, replace every occurrence. Use only for rename-everywhere cases.")
                ])
            ]),
            "required": .array([.string("path"), .string("search"), .string("replace")])
        ])
    )

    static let createFile: ToolDefinition = ToolDefinition(
        name: "create_file",
        description: "Create a new file. Fails if the file already exists.",
        inputSchema: .object([
            "type": .string("object"),
            "properties": .object([
                "path": .object(["type": .string("string")]),
                "content": .object(["type": .string("string")])
            ]),
            "required": .array([.string("path"), .string("content")])
        ])
    )

    static let rewriteFile: ToolDefinition = ToolDefinition(
        name: "rewrite_file",
        description: """
        Replace the entire content of an existing file. Use when more than 50% of the file is changing \
        or changes are scattered across 5+ regions. Prefer string_replace for localized edits.
        """,
        inputSchema: .object([
            "type": .string("object"),
            "properties": .object([
                "path": .object(["type": .string("string")]),
                "content": .object([
                    "type": .string("string"),
                    "description": .string("New full file content")
                ])
            ]),
            "required": .array([.string("path"), .string("content")])
        ])
    )

    static let deleteFile: ToolDefinition = ToolDefinition(
        name: "delete_file",
        description: "Delete a file.",
        inputSchema: .object([
            "type": .string("object"),
            "properties": .object([
                "path": .object(["type": .string("string")])
            ]),
            "required": .array([.string("path")])
        ])
    )

    static func defaultTools(cacheLast: Bool = true) -> [ToolDefinition] {
        var tools: [ToolDefinition] = [stringReplace, createFile, rewriteFile, deleteFile]
        if cacheLast, let last: ToolDefinition = tools.last {
            tools[tools.count - 1] = ToolDefinition(
                name: last.name,
                description: last.description,
                inputSchema: last.inputSchema,
                cacheControl: .ephemeral
            )
        }
        return tools
    }
}
