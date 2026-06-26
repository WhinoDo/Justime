import SwiftUI

@main
struct JustimeNativeApp: App {
    private let commandRouter = NativeCommandRouter { command in
        print("[NativeCommand] Dispatched: \(command.bridgeEventType)")
    }

    var body: some Scene {
        WindowGroup("Justime") {
            NativeWebView(url: AppConfig.resolveAppURL())
                .frame(minWidth: 1120, minHeight: 760)
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
