import XCTest
@testable import JustimeNative

final class NativeScreenRegistryTests: XCTestCase {

    private let registry = NativeScreenRegistry()

    // MARK: - Known Route Implementations

    func testDashboardReturnsSwiftUI() {
        let result = registry.implementation(for: .dashboard)
        XCTAssertEqual(result, .swiftUI(feature: "DashboardView"))
    }

    func testChatReturnsWebFallback() {
        let result = registry.implementation(for: .chat)
        XCTAssertEqual(result, .webFallback(path: "/chat"))
    }

    func testCalendarReturnsWebFallback() {
        let result = registry.implementation(for: .calendar)
        XCTAssertEqual(result, .webFallback(path: "/calendar"))
    }

    func testKnowledgeReturnsSwiftUI() {
        let result = registry.implementation(for: .knowledge)
        XCTAssertEqual(result, .swiftUI(feature: "KnowledgeView"))
    }

    func testSettingsReturnsSwiftUI() {
        let result = registry.implementation(for: .settings)
        XCTAssertEqual(result, .swiftUI(feature: "SettingsView"))
    }

    // MARK: - Web Fallback Path Preservation

    func testWebFallbackPreservesPath() {
        let result = registry.implementation(for: .webFallback(path: "/custom/page"))
        XCTAssertEqual(result, .webFallback(path: "/custom/page"))
    }

    func testWebFallbackPreservesEmptyPath() {
        let result = registry.implementation(for: .webFallback(path: ""))
        XCTAssertEqual(result, .webFallback(path: ""))
    }

    func testWebFallbackPreservesNestedPath() {
        let result = registry.implementation(for: .webFallback(path: "/chat/session/abc123"))
        XCTAssertEqual(result, .webFallback(path: "/chat/session/abc123"))
    }

    // MARK: - Unmigrated Routes Never Silently Return SwiftUI

    func testChatIsNeverSwiftUI() {
        let result = registry.implementation(for: .chat)
        if case .swiftUI = result {
            XCTFail("Chat must not return .swiftUI — it is not yet migrated to native")
        }
    }

    func testCalendarIsNeverSwiftUI() {
        let result = registry.implementation(for: .calendar)
        if case .swiftUI = result {
            XCTFail("Calendar must not return .swiftUI — it is not yet migrated to native")
        }
    }

    // MARK: - Deterministic Output

    func testRegistryReturnsConsistentResultForSameRoute() {
        let route = NativeRoute.dashboard
        let first = registry.implementation(for: route)
        let second = registry.implementation(for: route)
        XCTAssertEqual(first, second)
    }

    // MARK: - All Known Routes Return Non-Nil

    func testAllKnownRoutesHaveImplementation() {
        let knownRoutes: [NativeRoute] = [
            .dashboard, .chat, .calendar, .knowledge, .settings,
            .webFallback(path: "/test")
        ]
        for route in knownRoutes {
            let impl = registry.implementation(for: route)
            switch impl {
            case .swiftUI, .webFallback:
                break
            }
        }
    }
}
