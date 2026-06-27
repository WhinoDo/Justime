import XCTest
@testable import JustimeNative

final class NativeWebViewLoadFailureTests: XCTestCase {

    // MARK: - Provisional navigation failure

    func testProvisionalNavigationFailureRecordsURLErrorDetails() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!

        vm.markLoading(url)
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")

        XCTAssertTrue(vm.hasFailed)
        XCTAssertEqual(vm.failedURL, url)
        XCTAssertEqual(vm.errorCode, -1004)
        XCTAssertEqual(vm.errorDescription, "Could not connect to the server.")
    }

    // MARK: - Committed navigation failure

    func testCommittedNavigationFailureRecordsURLErrorDetails() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000/chat")!

        vm.markLoading(url)
        // Simulate the page starting to load (committed) then failing
        vm.markFailed(url: url, code: -999, description: "The operation couldn't be completed.")

        XCTAssertTrue(vm.hasFailed)
        XCTAssertEqual(vm.failedURL, url)
        XCTAssertEqual(vm.errorCode, -999)
        XCTAssertEqual(vm.errorDescription, "The operation couldn't be completed.")
    }

    // MARK: - Successful finish clears failure state

    func testSuccessfulFinishClearsFailureState() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!

        vm.markLoading(url)
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")
        XCTAssertTrue(vm.hasFailed)

        vm.markLoaded(url)
        XCTAssertFalse(vm.hasFailed)
        XCTAssertNil(vm.failedURL)
        XCTAssertNil(vm.errorCode)
        XCTAssertNil(vm.errorDescription)
    }

    // MARK: - Retry action is exposed in failed state

    func testRetryActionExposedInFailedState() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!

        vm.markLoading(url)
        vm.markFailed(url: url, code: -1004, description: "Could not connect to the server.")

        // The view model exposes the failed state; the retry action is wired
        // through LoadFailureView's retryAction closure which calls WKWebView.reload().
        // Verify the failed URL is available for the retry flow.
        XCTAssertTrue(vm.hasFailed)
        XCTAssertEqual(vm.failedURL, url)
    }

    // MARK: - State transitions

    func testIdleStateIsNotFailed() {
        let vm = LoadStateViewModel()
        XCTAssertFalse(vm.hasFailed)
    }

    func testLoadingStateIsNotFailed() {
        let vm = LoadStateViewModel()
        vm.markLoading(URL(string: "http://localhost:3000")!)
        XCTAssertFalse(vm.hasFailed)
    }

    func testLoadedStateIsNotFailed() {
        let vm = LoadStateViewModel()
        let url = URL(string: "http://localhost:3000")!
        vm.markLoading(url)
        vm.markLoaded(url)
        XCTAssertFalse(vm.hasFailed)
    }
}
