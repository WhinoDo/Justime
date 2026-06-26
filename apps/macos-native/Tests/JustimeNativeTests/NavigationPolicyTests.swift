import XCTest
@testable import JustimeNative

final class NavigationPolicyTests: XCTestCase {

    // MARK: - Allowed in WebView

    func testLocalhostAllowedInWebView() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "http://localhost:3000/chat")!
        XCTAssertEqual(policy.decision(for: url), .allowInWebView)
    }

    func testLoopbackIPAllowedInWebView() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "http://127.0.0.1:3000/dashboard")!
        XCTAssertEqual(policy.decision(for: url), .allowInWebView)
    }

    // MARK: - Open externally

    func testExternalHTTPSOpensExternally() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "https://example.com/about")!
        XCTAssertEqual(policy.decision(for: url), .openExternally)
    }

    // MARK: - Cancel

    func testFileSchemeCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "file:///etc/hosts")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    func testJavaScriptSchemeCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "javascript:alert(1)")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    func testDataSchemeCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "data:text/html,<h1>hi</h1>")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    func testUnknownCustomSchemeCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "myapp://deep-link")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    // MARK: - Port edge cases

    func testDifferentPortOnLocalhostCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "http://localhost:8080/api")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    func testCustomAllowedOriginWithPort() {
        let policy = NavigationPolicy(
            allowedOrigins: [
                AllowedOrigin(scheme: "http", host: "localhost", port: 4000)
            ]
        )
        let url = URL(string: "http://localhost:4000/test")!
        XCTAssertEqual(policy.decision(for: url), .allowInWebView)
    }

    func testExplicitDefaultHTTPIsAllowed() {
        let origin = AllowedOrigin(scheme: "http", host: "example.com", port: 80)
        let policy = NavigationPolicy(allowedOrigins: [origin])
        let url = URL(string: "http://example.com/page")!
        XCTAssertEqual(policy.decision(for: url), .allowInWebView)
    }

    // MARK: - Disallowed HTTP host

    func testUnallowlistedHTTPHostCancelled() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "http://example.com/page")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    // MARK: - IPv6

    func testIPv6LocalhostCancelledByDefault() {
        let policy = NavigationPolicy.defaultPolicy
        let url = URL(string: "http://[::1]:3000/")!
        XCTAssertEqual(policy.decision(for: url), .cancel)
    }

    // MARK: - External opener

    func testExternalURLTriggersOpener() {
        var openedURLs: [URL] = []

        let policy = NavigationPolicy.defaultPolicy

        // Simulate the Coordinator logic directly
        let url = URL(string: "https://external.com/page")!
        let decision = policy.decision(for: url)

        switch decision {
        case .openExternally:
            openedURLs.append(url)
        default:
            XCTFail("Expected .openExternally")
        }

        XCTAssertEqual(openedURLs.count, 1)
        XCTAssertEqual(openedURLs.first, url)
    }
}
