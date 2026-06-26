import Foundation
import WebKit

// MARK: - Bridge Message

public struct NativeBridgeMessage: Codable, Equatable {
    public let namespace: String
    public let type: String
    public let requestId: String?
    public let payload: [String: String]?

    public init(namespace: String, type: String, requestId: String? = nil, payload: [String: String]? = nil) {
        self.namespace = namespace
        self.type = type
        self.requestId = requestId
        self.payload = payload
    }
}

// MARK: - Validation Result

public enum NativeBridgeValidation {
    case accepted(NativeBridgeMessage)
    case rejected(String)
}

// MARK: - NativeBridge

public struct NativeBridge {
    public static let namespace = "justime.native.v1"
    public static let messageHandlerName = "justimeNative"

    public static let allowedTypes: Set<String> = [
        "capabilities.request",
        "command.newChat",
        "command.focusChatInput",
        "command.openTasks"
    ]

    public init() {}

    /// Validate a raw message body received from the web content.
    /// - Parameter body: The message body from `WKScriptMessageHandler`.
    /// - Returns: `.accepted` with a decoded message or `.rejected` with a reason.
    public func validate(body: Any?) -> NativeBridgeValidation {
        guard let dict = body as? [String: Any] else {
            return .rejected("Message body is not a dictionary")
        }

        guard let namespace = dict["namespace"] as? String, !namespace.isEmpty else {
            return .rejected("Missing or empty namespace")
        }

        guard namespace == Self.namespace else {
            return .rejected("Unknown namespace: \(namespace)")
        }

        guard let type = dict["type"] as? String, !type.isEmpty else {
            return .rejected("Missing or empty type")
        }

        guard Self.allowedTypes.contains(type) else {
            return .rejected("Unknown message type: \(type)")
        }

        let requestId = dict["requestId"] as? String
        let payload = dict["payload"] as? [String: String]

        let message = NativeBridgeMessage(
            namespace: namespace,
            type: type,
            requestId: requestId,
            payload: payload
        )
        return .accepted(message)
    }
}

// MARK: - WKScriptMessageHandler Coordinator

public class NativeBridgeHandler: NSObject, WKScriptMessageHandler {
    private let bridge = NativeBridge()
    public var onMessage: ((NativeBridgeMessage) -> Void)?

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == NativeBridge.messageHandlerName else { return }

        switch bridge.validate(body: message.body) {
        case .accepted(let msg):
            onMessage?(msg)
        case .rejected(let reason):
            print("[NativeBridge] Rejected: \(reason)")
        }
    }
}
