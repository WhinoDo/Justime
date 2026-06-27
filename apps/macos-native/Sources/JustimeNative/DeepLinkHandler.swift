import Foundation

// MARK: - Deep Link

public enum DeepLink: Equatable {
    case chat(sessionId: String?)
    case calendar(eventId: String?)
    case knowledge(docId: String?)
    case settings
    case unknown
}

// MARK: - Deep Link Handler

public struct DeepLinkHandler {
    private static let scheme = "justime"

    /// Parses a `justime://` URL into a `DeepLink` value.
    ///
    /// Supported patterns:
    /// - `justime://chat` → `.chat(sessionId: nil)`
    /// - `justime://chat/<sessionId>` → `.chat(sessionId: "<sessionId>")`
    /// - `justime://calendar` → `.calendar(eventId: nil)`
    /// - `justime://calendar/<eventId>` → `.calendar(eventId: "<eventId>")`
    /// - `justime://knowledge` → `.knowledge(docId: nil)`
    /// - `justime://knowledge/<docId>` → `.knowledge(docId: "<docId>")`
    /// - `justime://settings` → `.settings`
    public static func parse(url: URL) -> DeepLink {
        guard let urlScheme = url.scheme, urlScheme == Self.scheme else {
            return .unknown
        }

        let host = url.host ?? ""
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "chat":
            let sessionId = pathComponents.first
            return .chat(sessionId: sessionId)
        case "calendar":
            let eventId = pathComponents.first
            return .calendar(eventId: eventId)
        case "knowledge":
            let docId = pathComponents.first
            return .knowledge(docId: docId)
        case "settings":
            return .settings
        default:
            return .unknown
        }
    }

    /// Resolves a `DeepLink` to the corresponding Next.js web route URL.
    public static func resolveWebURL(link: DeepLink, baseURL: URL) -> URL {
        switch link {
        case .chat(let sessionId):
            if let sessionId {
                return baseURL.appendingPathComponent("chat/\(sessionId)")
            }
            return baseURL.appendingPathComponent("chat")
        case .calendar(let eventId):
            if let eventId {
                return baseURL.appendingPathComponent("calendar/\(eventId)")
            }
            return baseURL.appendingPathComponent("calendar")
        case .knowledge(let docId):
            if let docId {
                return baseURL.appendingPathComponent("knowledge/\(docId)")
            }
            return baseURL.appendingPathComponent("knowledge")
        case .settings:
            return baseURL.appendingPathComponent("settings")
        case .unknown:
            return baseURL
        }
    }
}
