import Foundation

enum SSEEventType: String, Equatable {
    case start
    case token
    case metadata
    case usage
    case done
    case error
}

struct SSEEvent: Equatable {
    let type: SSEEventType
    let id: String?
    let payload: [String: String]
}
