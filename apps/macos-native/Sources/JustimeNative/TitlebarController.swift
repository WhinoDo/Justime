import AppKit

enum TitlebarController {
    static let titlebarHeight: CGFloat = 28

    static func configureWindow(_ window: NSWindow, position: TrafficLightPosition = .defaultPosition) {
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.styleMask.insert([.titled, .fullSizeContentView])
        repositionTrafficLights(in: window, position: position)
    }

    static func repositionTrafficLights(in window: NSWindow, position: TrafficLightPosition) {
        guard let closeButton = window.standardWindowButton(.closeButton),
              let miniaturizeButton = window.standardWindowButton(.miniaturizeButton),
              let zoomButton = window.standardWindowButton(.zoomButton) else {
            return
        }

        let buttonHeight = closeButton.frame.height
        let buttonWidth = closeButton.frame.width
        let spacing: CGFloat = 8

        let closeOrigin = NSPoint(
            x: position.leadingInset,
            y: window.frame.height - position.topInset - buttonHeight
        )
        closeButton.frame.origin = closeOrigin

        miniaturizeButton.frame.origin = NSPoint(
            x: position.leadingInset + buttonWidth + spacing,
            y: closeOrigin.y
        )

        zoomButton.frame.origin = NSPoint(
            x: position.leadingInset + (buttonWidth + spacing) * 2,
            y: closeOrigin.y
        )
    }
}
