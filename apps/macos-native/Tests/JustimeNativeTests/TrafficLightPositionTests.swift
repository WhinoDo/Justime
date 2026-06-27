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
}
