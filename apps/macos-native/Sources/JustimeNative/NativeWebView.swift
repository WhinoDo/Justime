import SwiftUI
import WebKit

struct NativeWebView: NSViewRepresentable {
    let url: URL

    func makeCoordinator() -> NativeBridgeHandler {
        NativeBridgeHandler()
    }

    func makeNSView(context: Context) -> WKWebView {
        let coordinator = context.coordinator
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let contentController = configuration.userContentController
        contentController.add(coordinator, name: NativeBridge.messageHandlerName)
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        // No dynamic updates needed for the skeleton
    }

    static func dismantleNSView(_ nsView: WKWebView, coordinator: NativeBridgeHandler) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: NativeBridge.messageHandlerName)
    }
}
