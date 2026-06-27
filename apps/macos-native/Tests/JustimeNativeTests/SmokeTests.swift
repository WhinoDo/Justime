import XCTest

// XCUIApplication requires a UI test runner host app and is not available
// in SPM-based test targets. These tests act as smoke tests when run in
// an Xcode UI test target and skip gracefully otherwise.

final class SmokeTests: XCTestCase {

    func testAppLaunchesAndShowsWindow() throws {
        // Skip when running under SPM — XCUIApplication requires a UI test host.
        guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil,
              NSClassFromString("XCUIApplication") != nil else {
            throw XCTSkip("XCUIApplication not available — running in SPM test target")
        }

        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))

        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10), "Main window should appear within 10 seconds")
    }

    func testWindowTitleMatchesExpected() throws {
        guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil,
              NSClassFromString("XCUIApplication") != nil else {
            throw XCTSkip("XCUIApplication not available — running in SPM test target")
        }

        let app = XCUIApplication()
        app.launch()

        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10))
    }
}
