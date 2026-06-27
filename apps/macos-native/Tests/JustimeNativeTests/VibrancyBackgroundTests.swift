import XCTest
import AppKit
@testable import JustimeNative

final class VibrancyBackgroundTests: XCTestCase {
    func testDefaultMaterial() {
        let view = VibrancyBackground()
        XCTAssertEqual(view.material, .hudWindow)
    }

    func testDefaultBlendingMode() {
        let view = VibrancyBackground()
        XCTAssertEqual(view.blendingMode, .behindWindow)
    }

    func testCustomMaterial() {
        let view = VibrancyBackground(material: .sidebar)
        XCTAssertEqual(view.material, .sidebar)
    }

    func testCustomBlendingMode() {
        let view = VibrancyBackground(blendingMode: .withinWindow)
        XCTAssertEqual(view.blendingMode, .withinWindow)
    }

    func testBothCustomParameters() {
        let view = VibrancyBackground(material: .sidebar, blendingMode: .withinWindow)
        XCTAssertEqual(view.material, .sidebar)
        XCTAssertEqual(view.blendingMode, .withinWindow)
    }
}
