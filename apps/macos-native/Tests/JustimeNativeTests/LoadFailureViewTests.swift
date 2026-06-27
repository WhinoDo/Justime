import XCTest
@testable import JustimeNative

final class LoadFailureViewTests: XCTestCase {

    // MARK: - ViewModel exposes correct failure data for the view

    func testFailedStateProvidesURLForDisplay() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")

        XCTAssertEqual(vm.failedURL?.absoluteString, "http://localhost:3000")
    }

    func testFailedStateProvidesErrorCodeForDisplay() {
        let vm = LoadStateViewModel()
        vm.markFailed(url: URL(string: "http://localhost:3000")!, code: -1004, description: "Could not connect to the server.")

        XCTAssertEqual(vm.errorCode, -1004)
    }

    func testFailedStateProvidesDescriptionForDisplay() {
        let vm = LoadStateViewModel()
        vm.markFailed(url: URL(string: "http://localhost:3000")!, code: -1004, description: "Could not connect to the server.")

        XCTAssertEqual(vm.errorDescription, "Could not connect to the server.")
    }

    // MARK: - Non-failed states return nil

    func testIdleStateReturnsNilForAllFailureProperties() {
        let vm = LoadStateViewModel()

        XCTAssertNil(vm.failedURL)
        XCTAssertNil(vm.errorCode)
        XCTAssertNil(vm.errorDescription)
    }

    func testLoadingStateReturnsNilForAllFailureProperties() {
        let vm = LoadStateViewModel()
        vm.markLoading(URL(string: "http://localhost:3000")!)

        XCTAssertNil(vm.failedURL)
        XCTAssertNil(vm.errorCode)
        XCTAssertNil(vm.errorDescription)
    }

    // MARK: - Retry flow: loading then failed again

    func testRetryThenFailUpdatesState() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!

        vm.markLoading(url)
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")
        XCTAssertTrue(vm.hasFailed)

        // Simulate retry: mark loading again
        vm.markLoading(url)
        XCTAssertFalse(vm.hasFailed)

        // Simulate failure again
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")
        XCTAssertTrue(vm.hasFailed)
        XCTAssertEqual(vm.errorCode, -1004)
    }
}
