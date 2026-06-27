import AppKit
import SwiftUI

@main
struct JustimeNativeApp: App {
    @State private var pendingDeepLink: URL?
    @State private var resizeObserver: NSObjectProtocol?

    private let commandRouter = NativeCommandRouter { command in
        print("[NativeCommand] Dispatched: \(command.bridgeEventType)")
    }

    var body: some Scene {
        WindowGroup("Justime") {
            ZStack {
                VibrancyBackground()
                NativeWebView(
                    url: AppConfig.resolveAppURL(),
                    pendingNavigation: $pendingDeepLink
                )
                .padding(.top, TitlebarController.titlebarHeight)
            }
            .frame(minWidth: 1120, minHeight: 760)
            .onAppear {
                if let window = NSApplication.shared.windows.first {
                    TitlebarController.configureWindow(window)
                    resizeObserver = TitlebarController.observeResize(for: window)
                }
            }
            .onDisappear {
                if let observer = resizeObserver {
                    NotificationCenter.default.removeObserver(observer)
                    resizeObserver = nil
                }
            }
            .onOpenURL { url in
                let base = AppConfig.resolveAppURL()
                let link = DeepLinkHandler.parse(url: url)
                pendingDeepLink = DeepLinkHandler.resolveWebURL(link: link, baseURL: base)
            }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 800)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Chat") {
                    commandRouter.route(.newChat)
                }
                .keyboardShortcut("n", modifiers: .command)

                Button("Focus Chat Input") {
                    commandRouter.route(.focusChatInput)
                }
                .keyboardShortcut("l", modifiers: .command)
            }
            CommandGroup(after: .toolbar) {
                Button("Open Tasks") {
                    commandRouter.route(.openTasks)
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])
            }
        }
    }
}
