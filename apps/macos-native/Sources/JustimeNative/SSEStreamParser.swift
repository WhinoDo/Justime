import Foundation

struct SSEStreamParser {
    private var buffer = ""

    /// Parse SSE chunk into high-level events (existing behaviour).
    mutating func append(_ chunk: String) -> [SSEEvent] {
        buffer += chunk
        var events: [SSEEvent] = []

        while let newlineIndex = buffer.firstIndex(of: "\n") {
            let line = String(buffer[buffer.startIndex...newlineIndex])
            buffer = String(buffer[buffer.index(after: newlineIndex)...])

            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty { continue }
            if trimmed.hasPrefix(":") { continue }
            if !trimmed.hasPrefix("data:") { continue }

            let dataStr = trimmed.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let jsonData = dataStr.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
            else { continue }

            let eventType: SSEEventType = {
                guard let raw = json["event"] as? String else { return .token }
                return SSEEventType(rawValue: raw) ?? .token
            }()

            let id = json["id"] as? String

            var payload: [String: String] = [:]
            for (key, value) in json {
                if let str = value as? String {
                    payload[key] = str
                } else if let num = value as? NSNumber {
                    payload[key] = num.stringValue
                }
            }

            events.append(SSEEvent(type: eventType, id: id, payload: payload))
        }

        return events
    }

    /// Parse SSE chunk into raw protocol lines, surfacing id, event, data,
    /// and heartbeat/comment lines separately.
    mutating func appendLine(_ chunk: String) -> [SSELine] {
        buffer += chunk
        var lines: [SSELine] = []
        var currentId: String?
        var currentEvent: String?
        var currentData: String?

        func flush() {
            if let data = currentData {
                lines.append(.message(id: currentId, event: currentEvent, data: data))
            }
            currentId = nil
            currentEvent = nil
            currentData = nil
        }

        while let newlineIndex = buffer.firstIndex(of: "\n") {
            let line = String(buffer[buffer.startIndex...newlineIndex])
            buffer = String(buffer[buffer.index(after: newlineIndex)...])

            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                flush()
                continue
            }

            if trimmed.hasPrefix(":") {
                lines.append(.heartbeat)
                continue
            }

            if trimmed.hasPrefix("id:") {
                currentId = trimmed.dropFirst(3).trimmingCharacters(in: .whitespaces)
                continue
            }

            if trimmed.hasPrefix("event:") {
                currentEvent = trimmed.dropFirst(6).trimmingCharacters(in: .whitespaces)
                continue
            }

            if trimmed.hasPrefix("data:") {
                let value = trimmed.dropFirst(5).trimmingCharacters(in: .whitespaces)
                if let existing = currentData {
                    currentData = existing + "\n" + value
                } else {
                    currentData = String(value)
                }
                continue
            }
        }

        return lines
    }
}
