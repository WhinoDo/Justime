import XCTest
@testable import JustimeNative

final class TrafficLightPositionTests: XCTestCase {
    func testDefaultValues() {
        let position = TrafficLightPosition.defaultPosition
        XCTAssertEqual(position.topInset, 12)
        XCTAssertEqual(position.leadingInset, 12)
    }

    func testCustomInitialization() {
        let position = TrafficLightPosition(topInset: 16, leadingInset: 20)
        XCTAssertEqual(position.topInset, 16)
        XCTAssertEqual(position.leadingInset, 20)
    }

    func testObserveResizeReturnsValidObserver() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        let observer = TitlebarController.observeResize(for: window)
        XCTAssertNotNil(observer)
        NotificationCenter.default.removeObserver(observer)
    }

    func testResizeObserverFiresOnWindowResize() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        TitlebarController.configureWindow(window)

        let expectation = expectation(description: "Resize notification received")
        let observer = TitlebarController.observeResize(for: window)

        let testObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didResizeNotification,
            object: window,
            queue: .main
        ) { _ in
            expectation.fulfill()
        }

        window.setFrame(NSRect(x: 0, y: 0, width: 1000, height: 700), display: true)

        wait(for: [expectation], timeout: 2.0)
        NotificationCenter.default.removeObserver(observer)
        NotificationCenter.default.removeObserver(testObserver)
    }
}
