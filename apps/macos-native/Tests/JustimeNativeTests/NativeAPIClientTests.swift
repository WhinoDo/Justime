import Testing
import Foundation
@testable import JustimeNative

// MARK: - Mock URLSession

final class MockURLSession: URLSessionProtocol, @unchecked Sendable {
    var lastRequest: URLRequest?
    var stubbedData: Data = Data()
    var stubbedResponse: URLResponse = URLResponse(
        url: URL(string: "https://example.com")!,
        mimeType: nil,
        expectedContentLength: 0,
        textEncodingName: nil
    )
    var stubbedError: Error?

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lastRequest = request
        if let error = stubbedError {
            throw error
        }
        return (stubbedData, stubbedResponse)
    }
}

// MARK: - NativeAPIClient Tests

@Suite("NativeAPIClient Tests")
struct NativeAPIClientTests {

    // MARK: - Base URL validation

    @Test("Accepts HTTPS base URL")
    func testAcceptsHTTPS() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "https://api.justime.example.com")!
        )
        #expect(client.baseURL.absoluteString == "https://api.justime.example.com")
    }

    @Test("Accepts localhost HTTP base URL")
    func testAcceptsLocalhostHTTP() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        #expect(client.baseURL.absoluteString == "http://localhost:8080")
    }

    @Test("Accepts 127.0.0.1 HTTP base URL")
    func testAcceptsLoopbackHTTP() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://127.0.0.1:8080")!
        )
        #expect(client.baseURL.absoluteString == "http://127.0.0.1:8080")
    }

    @Test("Accepts IPv6 loopback HTTP base URL")
    func testAcceptsIPv6LoopbackHTTP() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://[::1]:8080")!
        )
        #expect(client.baseURL.absoluteString == "http://[::1]:8080")
    }

    @Test("Rejects remote HTTP base URL")
    func testRejectsRemoteHTTP() {
        #expect(throws: NativeAPIClientError.self) {
            try NativeAPIClient(
                baseURL: URL(string: "http://example.com")!
            )
        }
    }

    @Test("Rejects remote HTTP base URL with descriptive error")
    func testRejectsRemoteHTTPWithError() {
        do {
            _ = try NativeAPIClient(
                baseURL: URL(string: "http://example.com")!
            )
            Issue.record("Expected error to be thrown")
        } catch {
            let clientError = error as? NativeAPIClientError
            #expect(clientError == .nonHTTPSRemote("example.com"))
        }
    }

    // MARK: - URL joining

    @Test("Joins /api/v1/chat/sessions with localhost base")
    func testJoinsAPIPath() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        let request = try client.makeRequest(path: "/api/v1/chat/sessions")
        #expect(request.url?.absoluteString == "http://localhost:8080/api/v1/chat/sessions")
    }

    @Test("Joins /api/v1/health with HTTPS base")
    func testJoinsHealthPath() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "https://api.justime.example.com")!
        )
        let request = try client.makeRequest(path: "/api/v1/health")
        #expect(request.url?.absoluteString == "https://api.justime.example.com/api/v1/health")
    }

    @Test("Handles trailing slash on base URL")
    func testHandlesTrailingSlash() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080/")!
        )
        let request = try client.makeRequest(path: "/api/v1/chat/sessions")
        #expect(request.url?.absoluteString == "http://localhost:8080/api/v1/chat/sessions")
    }

    @Test("Rejects path not starting with /api/v1/")
    func testRejectsNonAPIPath() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        #expect(throws: NativeAPIClientError.self) {
            try client.makeRequest(path: "/other/path")
        }
    }

    @Test("Rejects empty path")
    func testRejectsEmptyPath() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        #expect(throws: NativeAPIClientError.self) {
            try client.makeRequest(path: "")
        }
    }

    // MARK: - Default JSON headers

    @Test("Sets default Accept and Content-Type headers")
    func testDefaultHeaders() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        let request = try client.makeRequest(path: "/api/v1/health")
        #expect(request.value(forHTTPHeaderField: "Accept") == "application/json")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    }

    @Test("Custom headers override defaults")
    func testCustomHeadersOverride() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        let request = try client.makeRequest(
            path: "/api/v1/chat/send",
            headers: ["Accept": "text/event-stream"]
        )
        #expect(request.value(forHTTPHeaderField: "Accept") == "text/event-stream")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    }

    @Test("HTTP method is set correctly")
    func testHTTPMethod() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        let getRequest = try client.makeRequest(path: "/api/v1/chat/sessions")
        #expect(getRequest.httpMethod == "GET")

        let postRequest = try client.makeRequest(path: "/api/v1/chat/send", method: "POST")
        #expect(postRequest.httpMethod == "POST")
    }

    // MARK: - Injectable URLSession

    @Test("Uses injected URLSession for requests")
    func testInjectableSession() throws {
        let mockSession = MockURLSession()
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!,
            session: mockSession
        )
        #expect(client.baseURL.absoluteString == "http://localhost:8080")
    }

    // MARK: - Session status propagation

    @Test("Client exposes auth session")
    func testClientExposesAuthSession() throws {
        let authSession = NativeAuthSession()
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!,
            authSession: authSession
        )
        #expect(client.authSession.status == .unknown)
        authSession.updateStatus(.authenticated)
        #expect(client.authSession.status == .authenticated)
    }

    @Test("Default client creates its own auth session")
    func testDefaultAuthSession() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        #expect(client.authSession.status == .unknown)
    }

    // MARK: - No token/cookie value exposure

    @Test("Client does not expose raw cookie or token values")
    func testNoTokenExposure() throws {
        let client = try NativeAPIClient(
            baseURL: URL(string: "http://localhost:8080")!
        )
        let mirror = Mirror(reflecting: client)
        for child in mirror.children {
            let value = String(describing: child.value)
            #expect(!value.lowercased().contains("token"))
            #expect(!value.lowercased().contains("cookie"))
            #expect(!value.lowercased().contains("jwt"))
        }
    }
}
