import XCTest
@testable import JustimeNative

final class DeepLinkHandlerTests: XCTestCase {

    private let baseURL = URL(string: "http://localhost:3000")!

    // MARK: - Parse: chat

    func testParseChatWithoutSession() {
        let url = URL(string: "justime://chat")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .chat(sessionId: nil))
    }

    func testParseChatWithSession() {
        let url = URL(string: "justime://chat/sess-42")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .chat(sessionId: "sess-42"))
    }

    // MARK: - Parse: calendar

    func testParseCalendarWithoutEvent() {
        let url = URL(string: "justime://calendar")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .calendar(eventId: nil))
    }

    func testParseCalendarWithEvent() {
        let url = URL(string: "justime://calendar/evt-99")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .calendar(eventId: "evt-99"))
    }

    // MARK: - Parse: knowledge

    func testParseKnowledgeWithoutDoc() {
        let url = URL(string: "justime://knowledge")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .knowledge(docId: nil))
    }

    func testParseKnowledgeWithDoc() {
        let url = URL(string: "justime://knowledge/doc-7")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .knowledge(docId: "doc-7"))
    }

    // MARK: - Parse: settings

    func testParseSettings() {
        let url = URL(string: "justime://settings")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .settings)
    }

    // MARK: - Parse: edge cases

    func testParseUnknownScheme() {
        let url = URL(string: "other://chat")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .unknown)
    }

    func testParseUnknownHost() {
        let url = URL(string: "justime://unknown/path")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .unknown)
    }

    func testParseEmptyPath() {
        let url = URL(string: "justime://")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .unknown)
    }

    func testParseMissingHost() {
        let url = URL(string: "justime:///chat")!
        XCTAssertEqual(DeepLinkHandler.parse(url: url), .unknown)
    }

    // MARK: - Resolve Web URL: chat

    func testResolveChatWithoutSession() {
        let link = DeepLink.chat(sessionId: nil)
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/chat")
    }

    func testResolveChatWithSession() {
        let link = DeepLink.chat(sessionId: "sess-42")
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/chat/sess-42")
    }

    // MARK: - Resolve Web URL: calendar

    func testResolveCalendarWithoutEvent() {
        let link = DeepLink.calendar(eventId: nil)
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/calendar")
    }

    func testResolveCalendarWithEvent() {
        let link = DeepLink.calendar(eventId: "evt-99")
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/calendar/evt-99")
    }

    // MARK: - Resolve Web URL: knowledge

    func testResolveKnowledgeWithoutDoc() {
        let link = DeepLink.knowledge(docId: nil)
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/knowledge")
    }

    func testResolveKnowledgeWithDoc() {
        let link = DeepLink.knowledge(docId: "doc-7")
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/knowledge/doc-7")
    }

    // MARK: - Resolve Web URL: settings

    func testResolveSettings() {
        let link = DeepLink.settings
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000/settings")
    }

    // MARK: - Resolve Web URL: unknown

    func testResolveUnknownReturnsBaseURL() {
        let link = DeepLink.unknown
        let result = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(result.absoluteString, "http://localhost:3000")
    }

    // MARK: - Round-trip: parse → resolve

    func testRoundTripChatWithSession() {
        let url = URL(string: "justime://chat/sess-42")!
        let link = DeepLinkHandler.parse(url: url)
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(resolved.absoluteString, "http://localhost:3000/chat/sess-42")
    }

    func testRoundTripCalendar() {
        let url = URL(string: "justime://calendar/evt-99")!
        let link = DeepLinkHandler.parse(url: url)
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(resolved.absoluteString, "http://localhost:3000/calendar/evt-99")
    }

    func testRoundTripSettings() {
        let url = URL(string: "justime://settings")!
        let link = DeepLinkHandler.parse(url: url)
        let resolved = DeepLinkHandler.resolveWebURL(link: link, baseURL: baseURL)
        XCTAssertEqual(resolved.absoluteString, "http://localhost:3000/settings")
    }
}
