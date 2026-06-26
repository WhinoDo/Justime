import Foundation

struct AppConfig {
    static let defaultAppURLString = "http://localhost:3000"

    static let environmentKeys = [
        "JUSTIME_NATIVE_APP_URL",
        "JUSTIME_DESKTOP_URL",
        "NEXT_PUBLIC_APP_URL"
    ]

    static func resolveAppURL(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        for key in environmentKeys {
            guard let value = environment[key],
                  !value.isEmpty,
                  let url = URL(string: value),
                  isAllowedAppURL(url) else {
                continue
            }
            return url
        }

        return URL(string: defaultAppURLString)!
    }

    static func isAllowedAppURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme else { return false }

        if scheme == "https" {
            return true
        }

        if scheme == "http" {
            return isLocalhost(url)
        }

        return false
    }

    private static func isLocalhost(_ url: URL) -> Bool {
        guard let host = url.host else { return false }

        let localhosts = ["localhost", "127.0.0.1", "::1", "[::1]"]
        return localhosts.contains(host)
    }
}
