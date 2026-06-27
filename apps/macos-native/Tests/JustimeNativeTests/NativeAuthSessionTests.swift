import Testing
import Foundation
@testable import JustimeNative

@Suite("NativeAuthSession Tests")
struct NativeAuthSessionTests {

    @Test("Initial status is unknown")
    func testInitialStatus() {
        let session = NativeAuthSession()
        #expect(session.status == .unknown)
    }

    @Test("Can transition to missing")
    func testTransitionToMissing() {
        let session = NativeAuthSession()
        session.updateStatus(.missing)
        #expect(session.status == .missing)
    }

    @Test("Can transition to authenticated")
    func testTransitionToAuthenticated() {
        let session = NativeAuthSession()
        session.updateStatus(.authenticated)
        #expect(session.status == .authenticated)
    }

    @Test("Can transition to expired")
    func testTransitionToExpired() {
        let session = NativeAuthSession()
        session.updateStatus(.expired)
        #expect(session.status == .expired)
    }

    @Test("Status transitions are sequential")
    func testSequentialTransitions() {
        let session = NativeAuthSession()
        #expect(session.status == .unknown)

        session.updateStatus(.authenticated)
        #expect(session.status == .authenticated)

        session.updateStatus(.expired)
        #expect(session.status == .expired)

        session.updateStatus(.missing)
        #expect(session.status == .missing)
    }

    @Test("No raw cookie or token value is exposed")
    func testNoTokenExposure() {
        let session = NativeAuthSession()
        session.updateStatus(.authenticated)

        let mirror = Mirror(reflecting: session)
        for child in mirror.children {
            let value = String(describing: child.value)
            #expect(!value.lowercased().contains("token"))
            #expect(!value.lowercased().contains("cookie"))
            #expect(!value.lowercased().contains("jwt"))
            #expect(!value.lowercased().contains("secret"))
        }
    }

    @Test("NativeAuthSessionStatus is Equatable")
    func testStatusEquatable() {
        #expect(NativeAuthSessionStatus.unknown == NativeAuthSessionStatus.unknown)
        #expect(NativeAuthSessionStatus.authenticated == NativeAuthSessionStatus.authenticated)
        #expect(NativeAuthSessionStatus.unknown != NativeAuthSessionStatus.missing)
    }
}
