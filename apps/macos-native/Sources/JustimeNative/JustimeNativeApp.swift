import SwiftUI

@main
struct JustimeNativeApp: App {
    @State private var pendingDeepLink: URL?

    private let commandRouter = NativeCommandRouter { command in
        print("[NativeCommand] Dispatched: \(command.bridgeEventType)")
    }

    var body: some Scene {
        WindowGroup("Justime") {
            NativeWebView(
                url: AppConfig.resolveAppURL(),
                pendingNavigation: $pendingDeepLink
            )
            .frame(minWidth: 1120, minHeight: 760)
            .onOpenURL { url in
                let base = AppConfig.resolveAppURL()
                let link = DeepLinkHandler.parse(url: url)
                pendingDeepLink = DeepLinkHandler.resolveWebURL(link: link, baseURL: base)
            }
        }
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
