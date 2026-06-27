import Foundation

// MARK: - Native Chat Send Request

struct NativeChatSendRequest: Codable, Equatable {
    let message: String
    let sessionId: String?
    let runtimeModelId: String?

    enum CodingKeys: String, CodingKey {
        case message
        case sessionId
        case runtimeModelId
    }
}

// MARK: - Native Chat Session Summary

struct NativeChatSessionSummary: Codable, Equatable {
    let id: String
    let userId: String
    let title: String
    let updatedAt: Date
    let preview: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case userId
        case title
        case updatedAt
        case preview
    }
}

// MARK: - Native Chat Message

struct NativeChatMessage: Codable, Equatable {
    let id: String
    let role: String
    let content: String
    let timestamp: Date
    let taskDecomposition: [String: AnyCodable]?
    let suggestedEvents: [[String: AnyCodable]]?
    let timingStrategy: [String: AnyCodable]?
    let taskAnalysis: [String: AnyCodable]?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case role
        case content
        case timestamp
        case taskDecomposition
        case suggestedEvents
        case timingStrategy
        case taskAnalysis
    }
}

// MARK: - AnyCodable (type-erased Codable value)

enum AnyCodable: Codable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodable])
    case dictionary([String: AnyCodable])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let v = try? container.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? container.decode(Int.self) {
            self = .int(v)
        } else if let v = try? container.decode(Double.self) {
            self = .double(v)
        } else if let v = try? container.decode(String.self) {
            self = .string(v)
        } else if let v = try? container.decode([AnyCodable].self) {
            self = .array(v)
        } else if let v = try? container.decode([String: AnyCodable].self) {
            self = .dictionary(v)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .dictionary(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }
}

// MARK: - Native Chat Stream Event

struct NativeChatStreamEvent: Codable, Equatable {
    let event: String
    let data: [String: AnyCodable]

    enum CodingKeys: String, CodingKey {
        case event
        case data
    }
}
