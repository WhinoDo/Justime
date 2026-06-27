import XCTest
@testable import JustimeNative

// MARK: - Integration Tests
// Tests that verify multiple components working together.

final class IntegrationTests: XCTestCase {

    // MARK: - NativeBridge: realistic web → native message round-trip

    func testBridgeAcceptsRealisticCapabilitiesRequest() {
        let bridge = NativeBridge()
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "capabilities.request",
            "requestId": "req-web-001",
            "payload": ["platform": "macos"]
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.namespace, NativeBridge.namespace)
            XCTAssertEqual(msg.type, "capabilities.request")
            XCTAssertEqual(msg.requestId, "req-web-001")
            XCTAssertEqual(msg.payload?["platform"], "macos")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    func testBridgeRejectsMessageWithMismatchedNamespaceButValidType() {
        let bridge = NativeBridge()
        let body: [String: Any] = [
            "namespace": "justime.web.v1",
            "type": "capabilities.request",
            "requestId": "req-002"
        ]
        switch bridge.validate(body: body) {
        case .accepted:
            XCTFail("Should reject mismatched namespace")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("namespace"))
        }
    }

    // MARK: - NavigationPolicy + SessionCookiePolicy: shared origin enforcement

    func testNavigationAndSessionCookiePoliciesShareAllowedOrigins() {
        let origins = [
            AllowedOrigin(scheme: "http", host: "localhost", port: 3000),
            AllowedOrigin(scheme: "http", host: "127.0.0.1", port: 3000)
        ]
        let navPolicy = NavigationPolicy(allowedOrigins: origins)
        let cookiePolicy = SessionCookiePolicy(allowedOrigins: origins)

        let localhostURL = URL(string: "http://localhost:3000/dashboard")!
        XCTAssertEqual(navPolicy.decision(for: localhostURL), .allowInWebView)

        let validCookies = [
            CookieMetadata(name: "access_token", domain: "localhost", path: "/", isHTTPOnly: true, isSecure: false, expiry: nil),
            CookieMetadata(name: "refresh_token", domain: "localhost", path: "/", isHTTPOnly: true, isSecure: false, expiry: nil)
        ]
        XCTAssertEqual(cookiePolicy.evaluate(cookies: validCookies), .present)
    }

    func testNavigationBlocksAndCookiePolicyShowsMissingForExternalOrigin() {
        let origins = [
            AllowedOrigin(scheme: "http", host: "localhost", port: 3000)
        ]
        let navPolicy = NavigationPolicy(allowedOrigins: origins)
        let cookiePolicy = SessionCookiePolicy(allowedOrigins: origins)

        let externalURL = URL(string: "http://evil.example.com:3000/path")!
        XCTAssertEqual(navPolicy.decision(for: externalURL), .cancel)

        let externalCookies = [
            CookieMetadata(name: "access_token", domain: "evil.example.com", path: "/", isHTTPOnly: true, isSecure: false, expiry: nil)
        ]
        XCTAssertEqual(cookiePolicy.evaluate(cookies: externalCookies), .missing)
    }

    // MARK: - AppConfig: environment variable priority ordering

    func testResolveAppURLPrefersNativeAppURLOverDesktopURL() {
        let env = [
            "JUSTIME_NATIVE_APP_URL": "https://native.justime.app",
            "JUSTIME_DESKTOP_URL": "https://desktop.justime.app",
            "NEXT_PUBLIC_APP_URL": "https://web.justime.app"
        ]
        let url = AppConfig.resolveAppURL(environment: env)
        XCTAssertEqual(url.absoluteString, "https://native.justime.app")
    }

    func testResolveAppURLFallsBackToDesktopURL() {
        let env = [
            "JUSTIME_DESKTOP_URL": "https://desktop.justime.app",
            "NEXT_PUBLIC_APP_URL": "https://web.justime.app"
        ]
        let url = AppConfig.resolveAppURL(environment: env)
        XCTAssertEqual(url.absoluteString, "https://desktop.justime.app")
    }

    func testResolveAppURLFallsBackToNextPublicAppURL() {
        let env = [
            "NEXT_PUBLIC_APP_URL": "https://web.justime.app"
        ]
        let url = AppConfig.resolveAppURL(environment: env)
        XCTAssertEqual(url.absoluteString, "https://web.justime.app")
    }

    func testResolveAppURLDefaultsToLocalhost() {
        let url = AppConfig.resolveAppURL(environment: [:])
        XCTAssertEqual(url.absoluteString, "http://localhost:3000")
    }

    func testResolveAppURLSkipsInvalidURLs() {
        let env = [
            "JUSTIME_NATIVE_APP_URL": "not a url",
            "JUSTIME_DESKTOP_URL": "http://localhost:4000"
        ]
        let url = AppConfig.resolveAppURL(environment: env)
        XCTAssertEqual(url.absoluteString, "http://localhost:4000")
    }

    // MARK: - DeepLinkHandler: parse → resolve round-trip

    func testDeepLinkChatRoundTrip() {
        let url = URL(string: "justime://chat/sess-1")!
        let link = DeepLinkHandler.parse(url: url)
        XCTAssertEqual(link, .chat(sessionId: "sess-1"))

        let baseURL = URL(string: "http://localhost:3000")!
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertTrue(resolved.path.contains("/chat"))
        XCTAssertTrue(resolved.path.contains("sess-1"))
    }

    func testDeepLinkCalendarRoundTrip() {
        let url = URL(string: "justime://calendar/evt-42")!
        let link = DeepLinkHandler.parse(url: url)
        XCTAssertEqual(link, .calendar(eventId: "evt-42"))

        let baseURL = URL(string: "http://localhost:3000")!
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertTrue(resolved.path.contains("/calendar"))
        XCTAssertTrue(resolved.path.contains("evt-42"))
    }

    func testDeepLinkSettingsRoundTrip() {
        let url = URL(string: "justime://settings")!
        let link = DeepLinkHandler.parse(url: url)
        XCTAssertEqual(link, DeepLink.settings)

        let baseURL = URL(string: "http://localhost:3000")!
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertTrue(resolved.path.contains("/settings"))
    }

    // MARK: - SSEStreamParser: multi-event stream

    func testSSEParserProcessesMultiEventStream() {
        var parser = SSEStreamParser()

        let stream =
            "data: {\"event\":\"start\",\"id\":\"s:1\"}\n\n" +
            "data: {\"event\":\"token\",\"id\":\"s:1:1\",\"content\":\"Hello\"}\n\n" +
            "data: {\"event\":\"token\",\"id\":\"s:1:2\",\"content\":\" world\"}\n\n" +
            "data: {\"event\":\"token\",\"id\":\"s:1:3\",\"content\":\"!\"}\n\n" +
            "data: {\"event\":\"done\",\"id\":\"s:1\"}\n\n"

        let events = parser.append(stream)

        XCTAssertEqual(events.count, 5)
        XCTAssertEqual(events[0].type, .start)
        XCTAssertEqual(events[1].type, .token)
        XCTAssertEqual(events[1].payload["content"], "Hello")
        XCTAssertEqual(events[2].type, .token)
        XCTAssertEqual(events[2].payload["content"], " world")
        XCTAssertEqual(events[3].type, .token)
        XCTAssertEqual(events[3].payload["content"], "!")
        XCTAssertEqual(events[4].type, .done)
    }

    func testSSEParserHandlesChunkedMultiEventStream() {
        var parser = SSEStreamParser()

        let chunk1 = "data: {\"event\":\"start\"}\n\ndata: {\"event\":\"token\",\"content\":\"He"
        let chunk2 = "llo\"}\n\ndata: {\"event\":\"done\"}\n\n"

        let first = parser.append(chunk1)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(first[0].type, .start)

        let second = parser.append(chunk2)
        XCTAssertEqual(second.count, 2)
        XCTAssertEqual(second[0].type, .token)
        XCTAssertEqual(second[0].payload["content"], "Hello")
        XCTAssertEqual(second[1].type, .done)
    }

    func testSSEParserIgnoresHeartbeatsBetweenEvents() {
        var parser = SSEStreamParser()

        let stream =
            ": heartbeat\n\ndata: {\"event\":\"token\",\"content\":\"hi\"}\n\n: keep-alive\n\ndata: {\"event\":\"done\"}\n\n"

        let events = parser.append(stream)
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events[0].type, .token)
        XCTAssertEqual(events[1].type, .done)
    }

    // MARK: - TrafficLightPosition: struct integration

    func testTrafficLightDefaultPositionConsistency() {
        let pos = TrafficLightPosition.defaultPosition
        XCTAssertEqual(pos.topInset, 12)
        XCTAssertEqual(pos.leadingInset, 12)
    }

    func testTrafficLightCustomPosition() {
        let pos = TrafficLightPosition(topInset: 16, leadingInset: 20)
        XCTAssertEqual(pos.topInset, 16)
        XCTAssertEqual(pos.leadingInset, 20)
        XCTAssertNotEqual(pos, TrafficLightPosition.defaultPosition)
    }

    // MARK: - AppConfig + NavigationPolicy: URL validation cross-check

    func testAppConfigAllowedURLMatchesNavigationPolicyOrigin() {
        let localhostURL = URL(string: "http://localhost:3000")!
        XCTAssertTrue(AppConfig.isAllowedAppURL(localhostURL))

        let origins = NavigationPolicy.defaultPolicy.allowedOrigins
        let matchingOrigin = AllowedOrigin(scheme: "http", host: "localhost", port: 3000)
        XCTAssertTrue(origins.contains(matchingOrigin))
    }

    func testAppConfigRejectsNonLocalhostHTTPLinksNavigationPolicyAlsoCancels() {
        let externalURL = URL(string: "http://example.com")!
        XCTAssertFalse(AppConfig.isAllowedAppURL(externalURL))

        let navPolicy = NavigationPolicy.defaultPolicy
        XCTAssertEqual(navPolicy.decision(for: externalURL), .cancel)
    }
}
