import Foundation

enum NativeAuthSessionStatus: Equatable, Sendable {
    case unknown
    case missing
    case authenticated
    case expired
}

final class NativeAuthSession: Sendable {
    private let storage: SessionStatusStorage

    init() {
        self.storage = SessionStatusStorage()
    }

    var status: NativeAuthSessionStatus {
        storage.currentStatus
    }

    func updateStatus(_ newStatus: NativeAuthSessionStatus) {
        storage.setStatus(newStatus)
    }
}

private final class SessionStatusStorage: @unchecked Sendable {
    private let lock = NSLock()
    private var _status: NativeAuthSessionStatus = .unknown

    var currentStatus: NativeAuthSessionStatus {
        lock.lock()
        defer { lock.unlock() }
        return _status
    }

    func setStatus(_ status: NativeAuthSessionStatus) {
        lock.lock()
        defer { lock.unlock() }
        _status = status
    }
}
