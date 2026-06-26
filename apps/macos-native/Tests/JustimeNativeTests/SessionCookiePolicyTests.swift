import XCTest
@testable import JustimeNative

final class SessionCookiePolicyTests: XCTestCase {

    private let localhostOrigin = AllowedOrigin(scheme: "http", host: "localhost", port: 3000)

    private var policy: SessionCookiePolicy {
        SessionCookiePolicy(allowedOrigins: [localhostOrigin])
    }

    private func makeCookie(
        name: String,
        domain: String = "localhost",
        path: String = "/",
        isHTTPOnly: Bool = true,
        isSecure: Bool = false,
        expiry: Date? = nil
    ) -> CookieMetadata {
        CookieMetadata(
            name: name,
            domain: domain,
            path: path,
            isHTTPOnly: isHTTPOnly,
            isSecure: isSecure,
            expiry: expiry
        )
    }

    // MARK: - Both cookies present

    func testBothCookiesPresentReturnsPresent() {
        let cookies = [
            makeCookie(name: "access_token"),
            makeCookie(name: "refresh_token")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .present)
    }

    // MARK: - Missing refresh

    func testMissingRefreshReturnsAccessOnly() {
        let cookies = [
            makeCookie(name: "access_token")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .accessOnly)
    }

    // MARK: - Missing access

    func testMissingAccessReturnsRefreshOnly() {
        let cookies = [
            makeCookie(name: "refresh_token")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .refreshOnly)
    }

    // MARK: - No matching cookies

    func testNoCookiesReturnsMissing() {
        XCTAssertEqual(policy.evaluate(cookies: []), .missing)
    }

    // MARK: - Unrelated token cookie ignored

    func testUnrelatedTokenCookieIgnored() {
        let cookies = [
            makeCookie(name: "token"),
            makeCookie(name: "csrf_token")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .missing)
    }

    func testUnrelatedTokenCookieDoesNotCountAsAccess() {
        let cookies = [
            makeCookie(name: "token"),
            makeCookie(name: "refresh_token")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .refreshOnly)
    }

    // MARK: - HttpOnly metadata accepted

    func testHTTPOnlyCookieAccepted() {
        let cookies = [
            makeCookie(name: "access_token", isHTTPOnly: true),
            makeCookie(name: "refresh_token", isHTTPOnly: true)
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .present)
    }

    func testNonHTTPOnlyCookieAccepted() {
        let cookies = [
            makeCookie(name: "access_token", isHTTPOnly: false),
            makeCookie(name: "refresh_token", isHTTPOnly: false)
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .present)
    }

    // MARK: - Wrong domain ignored

    func testWrongDomainIgnored() {
        let cookies = [
            makeCookie(name: "access_token", domain: "evil.com"),
            makeCookie(name: "refresh_token", domain: "evil.com")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .missing)
    }

    func testMixedDomainsOnlyLocalhostCounts() {
        let cookies = [
            makeCookie(name: "access_token", domain: "localhost"),
            makeCookie(name: "refresh_token", domain: "evil.com")
        ]
        XCTAssertEqual(policy.evaluate(cookies: cookies), .accessOnly)
    }

    // MARK: - Empty allowed origins

    func testEmptyAllowedOriginsReturnsMissing() {
        let emptyPolicy = SessionCookiePolicy(allowedOrigins: [])
        let cookies = [
            makeCookie(name: "access_token"),
            makeCookie(name: "refresh_token")
        ]
        XCTAssertEqual(emptyPolicy.evaluate(cookies: cookies), .missing)
    }

    // MARK: - Constants

    func testCookieNameConstants() {
        XCTAssertEqual(SessionCookiePolicy.accessTokenCookieName, "access_token")
        XCTAssertEqual(SessionCookiePolicy.refreshTokenCookieName, "refresh_token")
    }
}
