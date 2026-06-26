import Foundation

struct CookieMetadata: Equatable, Sendable {
    let name: String
    let domain: String
    let path: String
    let isHTTPOnly: Bool
    let isSecure: Bool
    let expiry: Date?
}

enum SessionStatus: Equatable, Sendable {
    case missing
    case accessOnly
    case refreshOnly
    case present
}

struct SessionCookiePolicy: Sendable {
    static let accessTokenCookieName = "access_token"
    static let refreshTokenCookieName = "refresh_token"

    private static let requiredCookieNames: Set<String> = [
        accessTokenCookieName,
        refreshTokenCookieName
    ]

    let allowedOrigins: [AllowedOrigin]

    func evaluate(cookies: [CookieMetadata]) -> SessionStatus {
        let matching = cookies.filter { cookie in
            Self.requiredCookieNames.contains(cookie.name) && matchesAllowedOrigin(domain: cookie.domain)
        }

        let names = Set(matching.map(\.name))
        let hasAccess = names.contains(Self.accessTokenCookieName)
        let hasRefresh = names.contains(Self.refreshTokenCookieName)

        switch (hasAccess, hasRefresh) {
        case (true, true):
            return .present
        case (true, false):
            return .accessOnly
        case (false, true):
            return .refreshOnly
        case (false, false):
            return .missing
        }
    }

    private func matchesAllowedOrigin(domain: String) -> Bool {
        let lowercased = domain.lowercased()
        return allowedOrigins.contains { origin in
            lowercased == origin.host.lowercased()
        }
    }
}
