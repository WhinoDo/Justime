import SwiftUI
import WebKit

struct NativeWebView: NSViewRepresentable {
    let url: URL
    let navigationPolicy: NavigationPolicy
    let sessionCookiePolicy: SessionCookiePolicy
    var openExternalURL: @MainActor (URL) -> Void = { url in
        NSWorkspace.shared.open(url)
    }

    init(
        url: URL,
        navigationPolicy: NavigationPolicy = .defaultPolicy,
        sessionCookiePolicy: SessionCookiePolicy? = nil,
        openExternalURL: (@MainActor (URL) -> Void)? = nil
    ) {
        self.url = url
        self.navigationPolicy = navigationPolicy
        self.sessionCookiePolicy = sessionCookiePolicy ?? SessionCookiePolicy(
            allowedOrigins: navigationPolicy.allowedOrigins
        )
        if let openExternalURL {
            self.openExternalURL = openExternalURL
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(policy: navigationPolicy, openExternalURL: openExternalURL)
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
        webView.navigationDelegate = coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        // No dynamic updates needed for the skeleton
    }

    static func dismantleNSView(_ nsView: WKWebView, coordinator: Coordinator) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: NativeBridge.messageHandlerName)
    }

    @MainActor
    static func sessionStatus(
        policy: SessionCookiePolicy,
        dataStore: WKWebsiteDataStore = .default()
    ) async -> SessionStatus {
        let cookies = await dataStore.httpCookieStore.allCookies()
        let metadata = cookies.map {
            CookieMetadata(
                name: $0.name,
                domain: $0.domain,
                path: $0.path,
                isHTTPOnly: $0.isHTTPOnly,
                isSecure: $0.isSecure,
                expiry: $0.expiresDate
            )
        }
        return policy.evaluate(cookies: metadata)
    }

    final class Coordinator: NativeBridgeHandler, WKNavigationDelegate {
        private let policy: NavigationPolicy
        private let openExternalURL: @MainActor (URL) -> Void

        init(policy: NavigationPolicy, openExternalURL: @MainActor @escaping (URL) -> Void) {
            self.policy = policy
            self.openExternalURL = openExternalURL
            super.init()
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
