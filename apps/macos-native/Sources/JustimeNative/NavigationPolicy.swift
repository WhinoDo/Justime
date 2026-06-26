import Foundation

struct AllowedOrigin: Equatable, Sendable {
    let scheme: String
    let host: String
    let port: Int?
}

enum NavigationDecision {
    case allowInWebView
    case openExternally
    case cancel
}

struct NavigationPolicy: Sendable {
    let allowedOrigins: [AllowedOrigin]

    static let defaultPolicy = NavigationPolicy(
        allowedOrigins: [
            AllowedOrigin(scheme: "http", host: "localhost", port: 3000),
            AllowedOrigin(scheme: "http", host: "127.0.0.1", port: 3000)
        ]
    )

    func decision(for url: URL) -> NavigationDecision {
        let scheme = url.scheme?.lowercased() ?? ""

        switch scheme {
        case "http", "https":
            guard let host = url.host?.lowercased() else {
                return .cancel
            }

            let effectivePort: Int? = url.port ?? (scheme == "https" ? 443 : 80)

            let origin = AllowedOrigin(scheme: scheme, host: host, port: effectivePort)

            if allowedOrigins.contains(origin) {
                return .allowInWebView
            }

            if scheme == "https" {
                return .openExternally
            }

            return .cancel

        case "file", "javascript", "data":
            return .cancel

        default:
            return .cancel
        }
    }
}
