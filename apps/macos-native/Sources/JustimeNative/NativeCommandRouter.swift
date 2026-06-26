import Foundation

// MARK: - Native Command

public enum NativeCommand: String, CaseIterable {
    case newChat
    case focusChatInput
    case openTasks

    public var bridgeEventType: String {
        switch self {
        case .newChat:
            return "command.newChat"
        case .focusChatInput:
            return "command.focusChatInput"
        case .openTasks:
            return "command.openTasks"
        }
    }
}

// MARK: - Native Command Router

public struct NativeCommandRouter {
    public typealias Dispatch = (NativeCommand) -> Void

    private let dispatch: Dispatch

    public init(dispatch: @escaping Dispatch) {
        self.dispatch = dispatch
    }

    public func route(_ command: NativeCommand) {
        dispatch(command)
    }
}
