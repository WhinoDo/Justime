import XCTest
@testable import JustimeNative

final class NativeCommandRouterTests: XCTestCase {

    // MARK: - Command Bridge Event Type Mapping

    func testNewChatMapsToBridgeEventType() {
        let command = NativeCommand.newChat
        XCTAssertEqual(command.bridgeEventType, "command.newChat")
        XCTAssertFalse(command.bridgeEventType.isEmpty)
    }

    func testFocusChatInputMapsToBridgeEventType() {
        let command = NativeCommand.focusChatInput
        XCTAssertEqual(command.bridgeEventType, "command.focusChatInput")
        XCTAssertFalse(command.bridgeEventType.isEmpty)
    }

    func testOpenTasksMapsToBridgeEventType() {
        let command = NativeCommand.openTasks
        XCTAssertEqual(command.bridgeEventType, "command.openTasks")
        XCTAssertFalse(command.bridgeEventType.isEmpty)
    }

    // MARK: - Router Dispatch

    func testRouterDispatchesNewChat() {
        var dispatched: NativeCommand?
        let router = NativeCommandRouter { command in
            dispatched = command
        }
        router.route(.newChat)
        XCTAssertEqual(dispatched, .newChat)
    }

    func testRouterDispatchesFocusChatInput() {
        var dispatched: NativeCommand?
        let router = NativeCommandRouter { command in
            dispatched = command
        }
        router.route(.focusChatInput)
        XCTAssertEqual(dispatched, .focusChatInput)
    }

    func testRouterDispatchesOpenTasks() {
        var dispatched: NativeCommand?
        let router = NativeCommandRouter { command in
            dispatched = command
        }
        router.route(.openTasks)
        XCTAssertEqual(dispatched, .openTasks)
    }

    // MARK: - Dispatch Event Count

    func testEachCommandDispatchesExactlyOnce() {
        var callCount = 0
        let router = NativeCommandRouter { _ in
            callCount += 1
        }
        router.route(.newChat)
        XCTAssertEqual(callCount, 1)
    }

    // MARK: - No Empty Bridge Event Types

    func testNoCommandHasEmptyBridgeEventType() {
        for command in NativeCommand.allCases {
            XCTAssertFalse(
                command.bridgeEventType.isEmpty,
                "\(command) must not have an empty bridgeEventType"
            )
        }
    }

    // MARK: - Allowed Types Consistency

    func testAllCommandBridgeTypesAreInAllowedTypes() {
        let allowedTypes = NativeBridge.allowedTypes
        for command in NativeCommand.allCases {
            XCTAssertTrue(
                allowedTypes.contains(command.bridgeEventType),
                "\(command.bridgeEventType) is not in NativeBridge.allowedTypes"
            )
        }
    }
}
