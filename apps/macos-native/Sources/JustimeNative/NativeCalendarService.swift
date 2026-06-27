import Foundation

protocol NativeCalendarRequestExecutor: Sendable {
    func execute(_ request: URLRequest) async throws -> (Data, URLResponse)
}

final class NativeCalendarService: Sendable {
    private let client: NativeAPIClient
    private static let basePath = "/api/v1/calendar/events"
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    init(client: NativeAPIClient) {
        self.client = client
    }

    func buildListRequest(
        startDate: String? = nil,
        endDate: String? = nil,
        type: String? = nil
    ) throws -> URLRequest {
        var components = URLComponents(path: Self.basePath)
        var queryItems: [URLQueryItem] = []
        if let startDate {
            queryItems.append(URLQueryItem(name: "startDate", value: startDate))
        }
        if let endDate {
            queryItems.append(URLQueryItem(name: "endDate", value: endDate))
        }
        if let type {
            queryItems.append(URLQueryItem(name: "type", value: type))
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        return try client.makeRequest(
            path: components.path + (components.query.map { "?\($0)" } ?? ""),
            method: "GET"
        )
    }

    func buildCreateRequest(_ event: NativeCalendarEventCreateRequest) throws -> URLRequest {
        var request = try client.makeRequest(path: Self.basePath, method: "POST")
        request.httpBody = try Self.encoder.encode(event)
        return request
    }

    func buildUpdateRequest(
        eventId: String,
        _ event: NativeCalendarEventUpdateRequest
    ) throws -> URLRequest {
        var request = try client.makeRequest(
            path: "\(Self.basePath)/\(eventId)",
            method: "PUT"
        )
        request.httpBody = try Self.encoder.encode(event)
        return request
    }

    func buildDeleteRequest(eventId: String) throws -> URLRequest {
        try client.makeRequest(
            path: "\(Self.basePath)/\(eventId)",
            method: "DELETE"
        )
    }
}

private extension URLComponents {
    init(path: String) {
        self.init()
        self.path = path
    }
}
