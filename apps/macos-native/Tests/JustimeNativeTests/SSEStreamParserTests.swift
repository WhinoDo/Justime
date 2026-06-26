import XCTest
@testable import JustimeNative

final class SSEStreamParserTests: XCTestCase {

    // AC 1: token event with id preserved
    func testTokenEventWithId() {
        var parser = SSEStreamParser()
        let events = parser.append("data: {\"event\":\"token\",\"id\":\"s:m:1\",\"content\":\"hi\"}\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].type, .token)
        XCTAssertEqual(events[0].id, "s:m:1")
        XCTAssertEqual(events[0].payload["content"], "hi")
    }

    // AC 2: heartbeat ignored
    func testHeartbeatIgnored() {
        var parser = SSEStreamParser()
        let events = parser.append(": heartbeat\n\n")
        XCTAssertTrue(events.isEmpty)
    }

    // AC 3: incomplete chunk buffering
    func testIncompleteChunkBuffering() {
        var parser = SSEStreamParser()
        let first = parser.append("data: {\"event\":\"token\",\"content\":\"he")
        XCTAssertTrue(first.isEmpty)
        let second = parser.append("llo\"}\n\n")
        XCTAssertEqual(second.count, 1)
        XCTAssertEqual(second[0].payload["content"], "hello")
    }

    // AC 4: malformed JSON ignored without throwing
    func testMalformedJSONIgnored() {
        var parser = SSEStreamParser()
        let events = parser.append("data: {not json}\n\n")
        XCTAssertTrue(events.isEmpty)
    }

    // Default event type is .token when missing
    func testDefaultTokenType() {
        var parser = SSEStreamParser()
        let events = parser.append("data: {\"content\":\"x\"}\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].type, .token)
    }

    // id preserved for resume
    func testIdPreservedForResume() {
        var parser = SSEStreamParser()
        let events = parser.append("data: {\"event\":\"token\",\"id\":\"sess1:msg2:5\",\"content\":\"a\"}\n\n")
        XCTAssertEqual(events[0].id, "sess1:msg2:5")
    }
}
