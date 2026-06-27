import Foundation

// MARK: - Native Screen Implementation

public enum NativeScreenImplementation: Equatable {
    case swiftUI(feature: String)
    case webFallback(path: String)
}

// MARK: - Native Screen Registry

public struct NativeScreenRegistry {

    public init() {}

    public func implementation(for route: NativeRoute) -> NativeScreenImplementation {
        switch route {
        case .dashboard:
            return .swiftUI(feature: "DashboardView")
        case .chat:
            return .webFallback(path: "/chat")
        case .calendar:
            return .webFallback(path: "/calendar")
        case .knowledge:
            return .swiftUI(feature: "KnowledgeView")
        case .settings:
            return .swiftUI(feature: "SettingsView")
        case .webFallback(let path):
            return .webFallback(path: path)
        }
    }
}
