import Combine
import SwiftUI
import WebKit

struct NativeWebView: NSViewRepresentable {
    let url: URL
    let navigationPolicy: NavigationPolicy
    let sessionCookiePolicy: SessionCookiePolicy
    let loadStateViewModel: LoadStateViewModel
    @Binding var pendingNavigation: URL?
    var openExternalURL: @MainActor (URL) -> Void = { url in
        NSWorkspace.shared.open(url)
    }

    init(
        url: URL,
        navigationPolicy: NavigationPolicy = .defaultPolicy,
        sessionCookiePolicy: SessionCookiePolicy? = nil,
        loadStateViewModel: LoadStateViewModel = LoadStateViewModel(),
        pendingNavigation: Binding<URL?> = .constant(nil),
        openExternalURL: (@MainActor (URL) -> Void)? = nil
    ) {
        self.url = url
        self.navigationPolicy = navigationPolicy
        self.sessionCookiePolicy = sessionCookiePolicy ?? SessionCookiePolicy(
            allowedOrigins: navigationPolicy.allowedOrigins
        )
        self.loadStateViewModel = loadStateViewModel
        self._pendingNavigation = pendingNavigation
        if let openExternalURL {
            self.openExternalURL = openExternalURL
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(policy: navigationPolicy, loadStateViewModel: loadStateViewModel, openExternalURL: openExternalURL)
    }

    func makeNSView(context: Context) -> WKWebView {
        let coordinator = context.coordinator
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let contentController = configuration.userContentController
        contentController.add(coordinator, name: NativeBridge.messageHandlerName)
        let transparentCSS = WKUserScript(
            source: "document.documentElement.style.background='transparent';document.body.style.background='transparent';",
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        contentController.addUserScript(transparentCSS)
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = coordinator

        loadStateViewModel.markLoading(url)
        webView.load(URLRequest(url: url))
        coordinator.attachWebView(webView)
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        if let pendingURL = pendingNavigation {
            nsView.load(URLRequest(url: pendingURL))
            pendingNavigation = nil
        }
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
        private let loadStateViewModel: LoadStateViewModel
        private let openExternalURL: @MainActor (URL) -> Void
        private weak var webView: WKWebView?
        private var overlayView: NSView?
        private var cancellable: Any?

        init(policy: NavigationPolicy, loadStateViewModel: LoadStateViewModel, openExternalURL: @MainActor @escaping (URL) -> Void) {
            self.policy = policy
            self.loadStateViewModel = loadStateViewModel
            self.openExternalURL = openExternalURL
            super.init()
        }

        func attachWebView(_ webView: WKWebView) {
            self.webView = webView
            self.cancellable = loadStateViewModel.$state
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in
                    self?.updateOverlay(for: state)
                }
        }

        private func updateOverlay(for state: LoadState) {
            guard let webView else { return }

            if case .failed = state {
                showOverlay(on: webView)
            } else {
                hideOverlay()
            }
        }

        private func showOverlay(on webView: WKWebView) {
            guard overlayView == nil else { return }
            let overlay = NSHostingView(rootView: LoadFailureView(
                viewModel: loadStateViewModel,
                retryAction: { [weak webView, weak self] in
                    self?.loadStateViewModel.markLoading(webView?.url ?? URL(string: "about:blank")!)
                    webView?.reload()
                }
            ))
            overlay.translatesAutoresizingMaskIntoConstraints = false
            webView.addSubview(overlay)
            NSLayoutConstraint.activate([
                overlay.topAnchor.constraint(equalTo: webView.topAnchor),
                overlay.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
                overlay.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
                overlay.bottomAnchor.constraint(equalTo: webView.bottomAnchor)
            ])
            overlayView = overlay
        }

        private func hideOverlay() {
            overlayView?.removeFromSuperview()
            overlayView = nil
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

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if let url = webView.url {
                loadStateViewModel.markLoaded(url)
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let nsError = error as NSError
            let failedURL = webView.url ?? loadStateViewModel.failedURL ?? URL(string: "unknown://")!
            loadStateViewModel.markFailed(
                url: failedURL,
                code: nsError.code,
                description: nsError.localizedDescription
            )
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            let nsError = error as NSError
            let failedURL = webView.url ?? loadStateViewModel.failedURL ?? URL(string: "unknown://")!
            loadStateViewModel.markFailed(
                url: failedURL,
                code: nsError.code,
                description: nsError.localizedDescription
            )
        }
    }
}
