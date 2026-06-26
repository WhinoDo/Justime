import SwiftUI

@main
struct JustimeNativeApp: App {
    var body: some Scene {
        WindowGroup("Justime") {
            NativeWebView(url: AppConfig.resolveAppURL())
                .frame(minWidth: 1120, minHeight: 760)
        }
        .defaultSize(width: 1280, height: 800)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Chat") {}
                    .disabled(true)
                    .keyboardShortcut("n", modifiers: .command)

                Button("Focus Chat Input") {}
                    .disabled(true)
                    .keyboardShortcut("l", modifiers: .command)
            }
            CommandGroup(after: .toolbar) {
                Button("Open Tasks") {}
                    .disabled(true)
                    .keyboardShortcut("t", modifiers: [.command, .shift])
            }
        }
    }
}
