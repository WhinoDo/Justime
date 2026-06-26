import Foundation

enum SSEEventType: String, Equatable {
    case start
    case token
    case metadata
    case usage
    case done
    case error
    case heartbeat
}

struct SSEEvent: Equatable {
    let type: SSEEventType
    let id: String?
    let payload: [String: String]
}

/// Raw SSE protocol line — surfaces id, event, data, and heartbeat
/// without conflating protocol fields with JSON payload keys.
enum SSELine: Equatable {
    case message(id: String?, event: String?, data: String)
    case heartbeat
}
