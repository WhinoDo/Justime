import Foundation

/// Deterministic state machine for SSE connection readiness.
///
/// All transitions are pure functions of (current state, event) → new state.
/// Back-off delay uses bounded exponential back-off with deterministic inputs
/// so tests can assert exact values.
struct SSEConnectionState: Equatable {

    // MARK: - State

    enum State: Equatable {
        case idle
        case connecting
        case open(lastEventID: String?)
        case retrying(lastEventID: String?, attempt: Int, delaySeconds: Double)
        case failed(reason: String)
    }

    // MARK: - Events

    enum Event: Equatable {
        case connect
        case opened
        case message(id: String?, event: String?, data: String)
        case heartbeat
        case timeout
        case transportError(String)
        case closed
    }

    // MARK: - Configuration

    struct BackoffConfig: Equatable {
        /// Initial delay in seconds for the first retry.
        var baseDelay: Double = 1.0
        /// Maximum delay in seconds (cap).
        var maxDelay: Double = 30.0
        /// Maximum number of retry attempts before giving up.
        var maxRetries: Int = 10
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var lastEventID: String?
    private let backoff: BackoffConfig

    init(backoff: BackoffConfig = BackoffConfig()) {
        self.backoff = backoff
    }

    // MARK: - Transition

    /// Process an event and transition to the next state.
    /// Returns emitted user-data messages (empty for heartbeat/control events).
    @discardableResult
    mutating func process(_ event: Event) -> [ProcessedMessage] {
        switch (state, event) {

        // idle + connect → connecting
        case (.idle, .connect):
            state = .connecting
            return []

        // connecting + opened → open
        case (.connecting, .opened):
            state = .open(lastEventID: lastEventID)
            return []

        // connecting + transportError → retrying(attempt 1)
        case (.connecting, .transportError(let reason)):
            let delay = computeDelay(attempt: 1)
            state = .retrying(lastEventID: lastEventID, attempt: 1, delaySeconds: delay)
            return [.init(event: .transportError(reason), lastEventID: lastEventID)]

        // open + message → update lastEventID, stay open
        case (.open, .message(let id, let evt, let data)):
            if let id = id, !id.isEmpty {
                lastEventID = id
            }
            state = .open(lastEventID: lastEventID)
            return [.init(event: .message(id: id, event: evt, data: data), lastEventID: lastEventID)]

        // open + heartbeat → stay open, no user data emitted
        case (.open, .heartbeat):
            return []

        // open + timeout → retrying(attempt 1)
        case (.open, .timeout):
            let delay = computeDelay(attempt: 1)
            state = .retrying(lastEventID: lastEventID, attempt: 1, delaySeconds: delay)
            return []

        // open + transportError → retrying(attempt 1)
        case (.open, .transportError(let reason)):
            let delay = computeDelay(attempt: 1)
            state = .retrying(lastEventID: lastEventID, attempt: 1, delaySeconds: delay)
            return [.init(event: .transportError(reason), lastEventID: lastEventID)]

        // open + closed → idle
        case (.open, .closed):
            state = .idle
            lastEventID = nil
            return []

        // retrying + connect → connecting (retry attempt)
        case (.retrying, .connect):
            state = .connecting
            return []

        // retrying + timeout → escalate retry or fail
        case (.retrying(let lid, let attempt, _), .timeout):
            let nextAttempt = attempt + 1
            if nextAttempt > backoff.maxRetries {
                state = .failed(reason: "Max retries (\(backoff.maxRetries)) exceeded")
                return []
            }
            let delay = computeDelay(attempt: nextAttempt)
            state = .retrying(lastEventID: lid, attempt: nextAttempt, delaySeconds: delay)
            return []

        // failed + connect → connecting (restart from scratch)
        case (.failed, .connect):
            lastEventID = nil
            state = .connecting
            return []

        // Any unhandled combination → no-op (stay in current state)
        default:
            return []
        }
    }

    // MARK: - Back-off

    /// Bounded exponential back-off: min(baseDelay * 2^(attempt-1), maxDelay).
    /// Deterministic — no randomness, no clock dependency.
    func computeDelay(attempt: Int) -> Double {
        let raw = backoff.baseDelay * pow(2.0, Double(attempt - 1))
        return min(raw, backoff.maxDelay)
    }
}

// MARK: - Processed Message

extension SSEConnectionState {
    /// A user-visible message emitted by the state machine.
    struct ProcessedMessage: Equatable {
        let event: Event
        let lastEventID: String?
    }
}
