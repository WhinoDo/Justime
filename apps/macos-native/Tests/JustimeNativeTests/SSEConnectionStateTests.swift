import XCTest
@testable import JustimeNative

final class SSEConnectionStateTests: XCTestCase {

    // MARK: - Happy path: idle → connecting → open

    func testIdleToConnectingToOpen() {
        var sm = SSEConnectionState()
        XCTAssertEqual(sm.state, .idle)

        sm.process(.connect)
        XCTAssertEqual(sm.state, .connecting)

        sm.process(.opened)
        XCTAssertEqual(sm.state, .open(lastEventID: nil))
    }

    // MARK: - Message updates lastEventID

    func testMessageWithIdUpdatesLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)

        let msgs = sm.process(.message(id: "abc", event: "token", data: "hello"))
        XCTAssertEqual(sm.state, .open(lastEventID: "abc"))
        XCTAssertEqual(sm.lastEventID, "abc")
        XCTAssertEqual(msgs.count, 1)
        XCTAssertEqual(msgs[0].event, .message(id: "abc", event: "token", data: "hello"))
        XCTAssertEqual(msgs[0].lastEventID, "abc")
    }

    func testMessageWithEmptyIdDoesNotClearLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)

        sm.process(.message(id: "first", event: "token", data: "a"))
        XCTAssertEqual(sm.lastEventID, "first")

        sm.process(.message(id: "", event: "token", data: "b"))
        XCTAssertEqual(sm.lastEventID, "first")
        XCTAssertEqual(sm.state, .open(lastEventID: "first"))
    }

    func testMessageWithNilIdDoesNotClearLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)

        sm.process(.message(id: "keep", event: "token", data: "a"))
        sm.process(.message(id: nil, event: "token", data: "b"))
        XCTAssertEqual(sm.lastEventID, "keep")
    }

    // MARK: - Heartbeat does not emit user data and keeps connection open

    func testHeartbeatKeepsConnectionOpenAndEmitsNothing() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)

        let msgs = sm.process(.heartbeat)
        XCTAssertTrue(msgs.isEmpty)
        XCTAssertEqual(sm.state, .open(lastEventID: nil))
    }

    func testHeartbeatAfterMessagePreservesLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.message(id: "s:m:1", event: "token", data: "x"))

        sm.process(.heartbeat)
        XCTAssertEqual(sm.state, .open(lastEventID: "s:m:1"))
        XCTAssertEqual(sm.lastEventID, "s:m:1")
    }

    // MARK: - Timeout transition to retrying

    func testTimeoutMovesToRetryingWithPreservedLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.message(id: "abc", event: "token", data: "x"))

        sm.process(.timeout)
        if case .retrying(let lid, let attempt, let delay) = sm.state {
            XCTAssertEqual(lid, "abc")
            XCTAssertEqual(attempt, 1)
            XCTAssertEqual(delay, 1.0) // baseDelay * 2^0 = 1.0
        } else {
            XCTFail("Expected .retrying state, got \(sm.state)")
        }
    }

    // MARK: - Transport error transition to retrying

    func testTransportErrorMovesToRetryingWithPreservedLastEventID() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.message(id: "msg99", event: "token", data: "data"))

        let msgs = sm.process(.transportError("connection reset"))
        if case .retrying(let lid, let attempt, let delay) = sm.state {
            XCTAssertEqual(lid, "msg99")
            XCTAssertEqual(attempt, 1)
            XCTAssertEqual(delay, 1.0)
        } else {
            XCTFail("Expected .retrying state, got \(sm.state)")
        }
        XCTAssertEqual(msgs.count, 1)
    }

    func testTransportErrorDuringConnectingMovesToRetrying() {
        var sm = SSEConnectionState()
        sm.process(.connect)

        sm.process(.transportError("dns failed"))
        if case .retrying(let lid, let attempt, _) = sm.state {
            XCTAssertNil(lid)
            XCTAssertEqual(attempt, 1)
        } else {
            XCTFail("Expected .retrying state, got \(sm.state)")
        }
    }

    // MARK: - Retry delay bounds (deterministic exponential back-off)

    func testRetryDelayBoundedExponentialBackoff() {
        let backoff = SSEConnectionState.BackoffConfig(baseDelay: 1.0, maxDelay: 30.0, maxRetries: 10)
        let sm = SSEConnectionState(backoff: backoff)

        // attempt 1: 1.0 * 2^0 = 1.0
        XCTAssertEqual(sm.computeDelay(attempt: 1), 1.0)
        // attempt 2: 1.0 * 2^1 = 2.0
        XCTAssertEqual(sm.computeDelay(attempt: 2), 2.0)
        // attempt 3: 1.0 * 2^2 = 4.0
        XCTAssertEqual(sm.computeDelay(attempt: 3), 4.0)
        // attempt 4: 1.0 * 2^3 = 8.0
        XCTAssertEqual(sm.computeDelay(attempt: 4), 8.0)
        // attempt 5: 1.0 * 2^4 = 16.0
        XCTAssertEqual(sm.computeDelay(attempt: 5), 16.0)
        // attempt 6: 1.0 * 2^5 = 32.0 → clamped to 30.0
        XCTAssertEqual(sm.computeDelay(attempt: 6), 30.0)
        // attempt 7: still 30.0
        XCTAssertEqual(sm.computeDelay(attempt: 7), 30.0)
    }

    func testRetryDelayWithCustomBackoff() {
        let backoff = SSEConnectionState.BackoffConfig(baseDelay: 0.5, maxDelay: 10.0, maxRetries: 5)
        let sm = SSEConnectionState(backoff: backoff)

        XCTAssertEqual(sm.computeDelay(attempt: 1), 0.5)
        XCTAssertEqual(sm.computeDelay(attempt: 2), 1.0)
        XCTAssertEqual(sm.computeDelay(attempt: 3), 2.0)
        XCTAssertEqual(sm.computeDelay(attempt: 4), 4.0)
        XCTAssertEqual(sm.computeDelay(attempt: 5), 8.0)
        // attempt 6: 16.0 → clamped to 10.0
        XCTAssertEqual(sm.computeDelay(attempt: 6), 10.0)
    }

    // MARK: - Repeated failures escalate to failed

    func testRepeatedTimeoutsEventuallyFail() {
        let backoff = SSEConnectionState.BackoffConfig(baseDelay: 1.0, maxDelay: 30.0, maxRetries: 3)
        var sm = SSEConnectionState(backoff: backoff)

        sm.process(.connect)
        sm.process(.opened)

        // First timeout → retrying(attempt 1)
        sm.process(.timeout)
        if case .retrying(_, let a, _) = sm.state { XCTAssertEqual(a, 1) }
        else { XCTFail("Expected retrying(1)") }

        // Second timeout → retrying(attempt 2)
        sm.process(.timeout)
        if case .retrying(_, let a, _) = sm.state { XCTAssertEqual(a, 2) }
        else { XCTFail("Expected retrying(2)") }

        // Third timeout → retrying(attempt 3)
        sm.process(.timeout)
        if case .retrying(_, let a, _) = sm.state { XCTAssertEqual(a, 3) }
        else { XCTFail("Expected retrying(3)") }

        // Fourth timeout → failed (exceeded maxRetries=3)
        sm.process(.timeout)
        if case .failed(let reason) = sm.state {
            XCTAssertTrue(reason.contains("Max retries"))
        } else {
            XCTFail("Expected .failed, got \(sm.state)")
        }
    }

    // MARK: - Retry from retrying

    func testRetryConnectFromRetrying() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.timeout) // → retrying(1)

        sm.process(.connect) // → connecting
        XCTAssertEqual(sm.state, .connecting)

        sm.process(.opened) // → open with preserved lastEventID
        XCTAssertEqual(sm.state, .open(lastEventID: nil))
    }

    // MARK: - Retry preserves lastEventID across cycles

    func testLastEventIDPreservedAcrossRetryCycle() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.message(id: "abc", event: "token", data: "hi"))
        XCTAssertEqual(sm.lastEventID, "abc")

        // Timeout → retrying preserves lastEventID
        sm.process(.timeout)
        if case .retrying(let lid, _, _) = sm.state {
            XCTAssertEqual(lid, "abc")
        } else {
            XCTFail("Expected retrying")
        }

        // Reconnect → connecting
        sm.process(.connect)
        XCTAssertEqual(sm.state, .connecting)

        // Re-open → open with lastEventID preserved
        sm.process(.opened)
        XCTAssertEqual(sm.state, .open(lastEventID: "abc"))
        XCTAssertEqual(sm.lastEventID, "abc")
    }

    // MARK: - Closed transitions to idle

    func testClosedTransitionsToIdle() {
        var sm = SSEConnectionState()
        sm.process(.connect)
        sm.process(.opened)
        sm.process(.message(id: "x", event: "token", data: "y"))

        sm.process(.closed)
        XCTAssertEqual(sm.state, .idle)
        XCTAssertNil(sm.lastEventID)
    }

    // MARK: - Failed → connect restarts

    func testFailedCanRestart() {
        let backoff = SSEConnectionState.BackoffConfig(maxRetries: 1)
        var sm = SSEConnectionState(backoff: backoff)

        sm.process(.connect)
        sm.process(.opened)
        sm.process(.timeout)    // → retrying(1)
        sm.process(.timeout)    // → failed

        if case .failed = sm.state { /* ok */ }
        else { XCTFail("Expected failed") }

        sm.process(.connect)
        XCTAssertEqual(sm.state, .connecting)
        XCTAssertNil(sm.lastEventID) // lastEventID cleared on restart from failed
    }

    // MARK: - Unhandled transitions are no-ops

    func testUnhandledTransitionIsNoOp() {
        var sm = SSEConnectionState()
        // heartbeat in idle → no-op
        sm.process(.heartbeat)
        XCTAssertEqual(sm.state, .idle)

        // message in idle → no-op
        sm.process(.message(id: "x", event: "token", data: "y"))
        XCTAssertEqual(sm.state, .idle)
    }

    // MARK: - BackoffConfig equality

    func testBackoffConfigEquality() {
        let a = SSEConnectionState.BackoffConfig(baseDelay: 1.0, maxDelay: 30.0, maxRetries: 10)
        let b = SSEConnectionState.BackoffConfig(baseDelay: 1.0, maxDelay: 30.0, maxRetries: 10)
        XCTAssertEqual(a, b)
    }
}
