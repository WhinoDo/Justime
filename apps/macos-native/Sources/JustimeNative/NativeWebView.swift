import SwiftUI
import WebKit

struct NativeWebView: NSViewRepresentable {
    let url: URL
    let navigationPolicy: NavigationPolicy
    var openExternalURL: @MainActor (URL) -> Void = { url in
        NSWorkspace.shared.open(url)
    }

    init(
        url: URL,
        navigationPolicy: NavigationPolicy = .defaultPolicy,
        openExternalURL: (@MainActor (URL) -> Void)? = nil
    ) {
        self.url = url
        self.navigationPolicy = navigationPolicy
        if let openExternalURL {
            self.openExternalURL = openExternalURL
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(policy: navigationPolicy, openExternalURL: openExternalURL)
    }

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
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        // No dynamic updates needed for the skeleton
    }

    static func dismantleNSView(_ nsView: WKWebView, coordinator: NativeBridgeHandler) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: NativeBridge.messageHandlerName)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let policy: NavigationPolicy
        private let openExternalURL: @MainActor (URL) -> Void

        init(policy: NavigationPolicy, openExternalURL: @MainActor @escaping (URL) -> Void) {
            self.policy = policy
            self.openExternalURL = openExternalURL
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            switch policy.decision(for: url) {
            case .allowInWebView:
                decisionHandler(.allow)
            case .openExternally:
                openExternalURL(url)
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }
    }
}
