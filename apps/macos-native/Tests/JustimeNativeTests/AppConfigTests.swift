import Testing
import Foundation
@testable import JustimeNative

@Suite("AppConfig Tests")
struct AppConfigTests {

    @Test("Returns default URL when no environment variables are set")
    func testDefaultURL() {
        let url = AppConfig.resolveAppURL(environment: [:])
        #expect(url.absoluteString == "http://localhost:3000")
    }

    @Test("Accepts HTTPS URLs")
    func testHTTPSAllowed() {
        let url = AppConfig.resolveAppURL(environment: [
            "JUSTIME_NATIVE_APP_URL": "https://justime.example.com"
        ])
        #expect(url.absoluteString == "https://justime.example.com")
    }

    @Test("Accepts localhost HTTP URLs")
    func testLocalhostHTTPAllowed() {
        let url = AppConfig.resolveAppURL(environment: [
            "JUSTIME_NATIVE_APP_URL": "http://localhost:3000"
        ])
        #expect(url.absoluteString == "http://localhost:3000")
    }

    @Test("Rejects external HTTP URLs and falls back")
    func testExternalHTTPRejected() {
        let url = AppConfig.resolveAppURL(environment: [
            "JUSTIME_NATIVE_APP_URL": "http://evil.example.com"
        ])
        #expect(url.absoluteString == "http://localhost:3000")
    }

    @Test("Respects environment variable precedence")
    func testEnvironmentPrecedence() {
        let url = AppConfig.resolveAppURL(environment: [
            "JUSTIME_NATIVE_APP_URL": "https://native.example.com",
            "JUSTIME_DESKTOP_URL": "https://desktop.example.com",
            "NEXT_PUBLIC_APP_URL": "https://public.example.com"
        ])
        #expect(url.absoluteString == "https://native.example.com")
    }

    @Test("Falls back to second key when first is invalid")
    func testFallbackToSecondKey() {
        let url = AppConfig.resolveAppURL(environment: [
            "JUSTIME_NATIVE_APP_URL": "http://evil.example.com",
            "JUSTIME_DESKTOP_URL": "https://desktop.example.com"
        ])
        #expect(url.absoluteString == "https://desktop.example.com")
    }

    @Test("Accepts 127.0.0.1 HTTP URLs")
    func testLoopbackIPAllowed() {
        #expect(AppConfig.isAllowedAppURL(URL(string: "http://127.0.0.1:3000")!) == true)
    }

    @Test("Accepts IPv6 loopback HTTP URLs")
    func testIPv6LoopbackAllowed() {
        #expect(AppConfig.isAllowedAppURL(URL(string: "http://[::1]:3000")!) == true)
    }
}
