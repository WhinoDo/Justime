import XCTest
@testable import JustimeNative

final class NativeBridgeTests: XCTestCase {

    let bridge = NativeBridge()

    // MARK: - Accepted Messages

    func testCapabilitiesRequestAccepted() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "capabilities.request",
            "requestId": "req-1"
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.type, "capabilities.request")
            XCTAssertEqual(msg.requestId, "req-1")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    func testCommandNewChatAccepted() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "command.newChat"
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.type, "command.newChat")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    func testCommandFocusChatInputAccepted() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "command.focusChatInput"
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.type, "command.focusChatInput")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    func testCommandOpenTasksAccepted() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "command.openTasks"
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.type, "command.openTasks")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    func testMessageWithPayloadAccepted() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "command.newChat",
            "payload": ["greeting": "hello"]
        ]
        switch bridge.validate(body: body) {
        case .accepted(let msg):
            XCTAssertEqual(msg.payload?["greeting"], "hello")
        case .rejected(let reason):
            XCTFail("Expected accepted, got rejected: \(reason)")
        }
    }

    // MARK: - Rejected Messages

    func testWrongNamespaceRejected() {
        let body: [String: Any] = [
            "namespace": "wrong.namespace",
            "type": "capabilities.request"
        ]
        switch bridge.validate(body: body) {
        case .accepted:
            XCTFail("Expected rejected for wrong namespace")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("namespace"))
        }
    }

    func testUnknownTypeRejected() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": "unknown.type"
        ]
        switch bridge.validate(body: body) {
        case .accepted:
            XCTFail("Expected rejected for unknown type")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("type"))
        }
    }

    func testMalformedBodyRejected() {
        switch bridge.validate(body: "not a dictionary") {
        case .accepted:
            XCTFail("Expected rejected for malformed body")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("dictionary"))
        }
    }

    func testNilBodyRejected() {
        switch bridge.validate(body: nil) {
        case .accepted:
            XCTFail("Expected rejected for nil body")
        case .rejected:
            break
        }
    }

    func testEmptyTypeRejected() {
        let body: [String: Any] = [
            "namespace": "justime.native.v1",
            "type": ""
        ]
        switch bridge.validate(body: body) {
        case .accepted:
            XCTFail("Expected rejected for empty type")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("empty"))
        }
    }

    func testEmptyNamespaceRejected() {
        let body: [String: Any] = [
            "namespace": "",
            "type": "capabilities.request"
        ]
        switch bridge.validate(body: body) {
        case .accepted:
            XCTFail("Expected rejected for empty namespace")
        case .rejected(let reason):
            XCTAssertTrue(reason.contains("empty"))
        }
    }
}
