import Foundation

protocol URLSessionProtocol: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: URLSessionProtocol {}

enum NativeAPIClientError: Error, Equatable, LocalizedError {
    case missingScheme
    case nonHTTPSRemote(String)
    case invalidRelativePath(String)

    var errorDescription: String? {
        switch self {
        case .missingScheme:
            return "Base URL must have a scheme (http or https)."
        case .nonHTTPSRemote(let host):
            return "Remote host '\(host)' must use HTTPS."
        case .invalidRelativePath(let path):
            return "Path must start with /api/v1/: '\(path)'."
        }
    }
}

final class NativeAPIClient: Sendable {
    let baseURL: URL
    let authSession: NativeAuthSession
    private let session: URLSessionProtocol

    init(
        baseURL: URL,
        session: URLSessionProtocol = URLSession.shared,
        authSession: NativeAuthSession = NativeAuthSession()
    ) throws {
        try Self.validateBaseURL(baseURL)
        self.baseURL = baseURL
        self.session = session
        self.authSession = authSession
    }

    func makeRequest(
        path: String,
        method: String = "GET",
        headers: [String: String] = [:]
    ) throws -> URLRequest {
        guard path.hasPrefix("/api/v1/") else {
            throw NativeAPIClientError.invalidRelativePath(path)
        }

        let trimmedBase = baseURL.absoluteString.hasSuffix("/")
            ? String(baseURL.absoluteString.dropLast())
            : baseURL.absoluteString

        guard let url = URL(string: trimmedBase + path) else {
            throw NativeAPIClientError.invalidRelativePath(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method

        let defaultHeaders = [
            "Accept": "application/json",
            "Content-Type": "application/json"
        ]
        for (key, value) in defaultHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        return request
    }

    private static func validateBaseURL(_ url: URL) throws {
        guard let scheme = url.scheme?.lowercased() else {
            throw NativeAPIClientError.missingScheme
        }

        if scheme == "https" {
            return
        }

        guard scheme == "http" else {
            throw NativeAPIClientError.missingScheme
        }

        guard let host = url.host?.lowercased() else {
            throw NativeAPIClientError.missingScheme
        }

        let localhosts: Set<String> = ["localhost", "127.0.0.1", "::1", "[::1]"]
        guard localhosts.contains(host) else {
            throw NativeAPIClientError.nonHTTPSRemote(host)
        }
    }
}
