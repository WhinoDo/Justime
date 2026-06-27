import Foundation

// MARK: - Native Route

public enum NativeRoute: Equatable {
    case dashboard
    case chat
    case calendar
    case knowledge
    case settings
    case webFallback(path: String)
}
