import Foundation

// MARK: - Request Executor

/// Closure that builds and executes an HTTP request via `NativeAPIClient`.
/// Compatible with `NativeAPIClient` — uses `makeRequest(path:method:headers:)` internally.
typealias NativeChatRequestExecutor = @Sendable (
    NativeAPIClient,
    String,                    // path
    String,                    // HTTP method
    [String: String]           // additional headers
) throws -> URLRequest

// MARK: - NativeChatServiceError

enum NativeChatServiceError: Error, Equatable, LocalizedError {
    case missingAPIClient
    case requestBuildFailed(String)
    case networkError(String)
    case invalidHTTPResponse
    case decodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingAPIClient:
            return "API client is not configured."
        case .requestBuildFailed(let reason):
            return "Failed to build request: \(reason)"
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .invalidHTTPResponse:
            return "Received an invalid HTTP response."
        case .decodingFailed(let reason):
            return "Failed to decode response: \(reason)"
        }
    }
}

// MARK: - NativeChatService

final class NativeChatService {
    private let apiClient: NativeAPIClient?
    private let requestExecutor: NativeChatRequestExecutor

    static let defaultEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(NativeChatService.chatDateFormatter)
        return encoder
    }()

    static let defaultDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            if let date = chatDateFormatter.date(from: dateString) {
                return date
            }
            if let date = ISO8601DateFormatter().date(from: dateString) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot parse date: \(dateString)"
            )
        }
        return decoder
    }()

    static let chatDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    init(
        apiClient: NativeAPIClient? = nil,
        requestExecutor: NativeChatRequestExecutor? = nil
    ) {
        self.apiClient = apiClient
        self.requestExecutor = requestExecutor ?? { apiClient, path, method, headers in
            try apiClient.makeRequest(path: path, method: method, headers: headers)
        }
    }

    // MARK: - Request Construction

    /// Builds a `GET /api/v1/chat/sessions` request.
    func buildSessionsRequest() throws -> URLRequest {
        guard let client = apiClient else {
            throw NativeChatServiceError.missingAPIClient
        }
        do {
            return try requestExecutor(client, "/api/v1/chat/sessions", "GET", [:])
        } catch {
            throw NativeChatServiceError.requestBuildFailed(error.localizedDescription)
        }
    }

    /// Builds a `POST /api/v1/chat/send` request with the given body.
    func buildSendRequest(_ body: NativeChatSendRequest) throws -> URLRequest {
        guard let client = apiClient else {
            throw NativeChatServiceError.missingAPIClient
        }
        var request: URLRequest
        do {
            request = try requestExecutor(client, "/api/v1/chat/send", "POST", [:])
        } catch {
            throw NativeChatServiceError.requestBuildFailed(error.localizedDescription)
        }
        do {
            request.httpBody = try Self.defaultEncoder.encode(body)
        } catch {
            throw NativeChatServiceError.requestBuildFailed("Encoding failed: \(error.localizedDescription)")
        }
        return request
    }

    /// Builds a `POST /api/v1/chat/stream` request with the given body.
    func buildStreamRequest(_ body: NativeChatSendRequest) throws -> URLRequest {
        guard let client = apiClient else {
            throw NativeChatServiceError.missingAPIClient
        }
        var request: URLRequest
        do {
            request = try requestExecutor(
                client,
                "/api/v1/chat/stream",
                "POST",
                ["Accept": "text/event-stream"]
            )
        } catch {
            throw NativeChatServiceError.requestBuildFailed(error.localizedDescription)
        }
        do {
            request.httpBody = try Self.defaultEncoder.encode(body)
        } catch {
            throw NativeChatServiceError.requestBuildFailed("Encoding failed: \(error.localizedDescription)")
        }
        return request
    }

    // MARK: - Response Decoding

    func decodeResponse<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try Self.defaultDecoder.decode(T.self, from: data)
        } catch {
            throw NativeChatServiceError.decodingFailed(error.localizedDescription)
        }
    }
}
