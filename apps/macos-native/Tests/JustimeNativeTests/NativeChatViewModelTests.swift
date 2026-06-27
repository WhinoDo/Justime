import Testing
import Foundation
@testable import JustimeNative

// MARK: - MockChatService

private final class MockChatService: NativeChatServiceProtocol {
    var sendResult: Result<NativeChatServiceResponse, Error> = .success(
        NativeChatServiceResponse(id: "resp_1", role: "assistant", content: "Hello!")
    )
    private(set) var sendCallCount = 0
    private(set) var lastMessage: String?

    func send(message: String, sessionId: String?) async throws -> NativeChatServiceResponse {
        sendCallCount += 1
        lastMessage = message
        return try sendResult.get()
    }
}

private struct TestError: Error, LocalizedError {
    var errorDescription: String? { "Test error" }
}

// MARK: - NativeChatViewModel Tests

@Suite("NativeChatViewModel Tests")
struct NativeChatViewModelTests {

    @Test("sendDraft does not call service when draft is empty")
    @available(macOS 14.0, *)
    func testEmptyDraft() async throws {
        let mock = MockChatService()
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = ""
        await vm.sendDraft()

        #expect(mock.sendCallCount == 0)
        #expect(vm.messages.isEmpty)
        #expect(vm.errorMessage == nil)
    }

    @Test("sendDraft does not call service when draft is whitespace only")
    @available(macOS 14.0, *)
    func testWhitespaceDraft() async throws {
        let mock = MockChatService()
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "   \n  "
        await vm.sendDraft()

        #expect(mock.sendCallCount == 0)
        #expect(vm.messages.isEmpty)
    }

    @Test("sendDraft appends user message and assistant response on success")
    @available(macOS 14.0, *)
    func testSuccessfulSend() async throws {
        let mock = MockChatService()
        mock.sendResult = .success(
            NativeChatServiceResponse(id: "resp_42", role: "assistant", content: "Sure, I can help!")
        )
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "Help me"
        await vm.sendDraft()

        #expect(vm.messages.count == 2)

        let user = try #require(vm.messages.first)
        #expect(user.role == "user")
        #expect(user.content == "Help me")

        let assistant = try #require(vm.messages.last)
        #expect(assistant.role == "assistant")
        #expect(assistant.content == "Sure, I can help!")
        #expect(assistant.id == "resp_42")
        #expect(mock.lastMessage == "Help me")
    }

    @Test("sendDraft sets errorMessage on service failure")
    @available(macOS 14.0, *)
    func testServiceFailure() async throws {
        let mock = MockChatService()
        mock.sendResult = .failure(TestError())
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "Fail please"
        await vm.sendDraft()

        #expect(vm.messages.count == 1) // user message still appended
        #expect(vm.errorMessage == "Test error")
        #expect(vm.isSending == false)
    }

    @Test("sendDraft clears draftText on send")
    @available(macOS 14.0, *)
    func testDraftCleared() async throws {
        let mock = MockChatService()
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "Some text"
        await vm.sendDraft()

        #expect(vm.draftText == "")
    }

    @Test("sendDraft transitions isSending correctly during success")
    @available(macOS 14.0, *)
    func testSendingStateSuccess() async throws {
        let mock = MockChatService()
        let vm = NativeChatViewModel(chatService: mock)

        #expect(vm.isSending == false)

        vm.draftText = "Test"
        await vm.sendDraft()

        #expect(vm.isSending == false)
        #expect(vm.messages.count == 2)
    }

    @Test("sendDraft transitions isSending correctly during failure")
    @available(macOS 14.0, *)
    func testSendingStateFailure() async throws {
        let mock = MockChatService()
        mock.sendResult = .failure(TestError())
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "Test"
        await vm.sendDraft()

        #expect(vm.isSending == false)
        #expect(vm.errorMessage != nil)
    }

    @Test("sendDraft clears errorMessage on next successful send")
    @available(macOS 14.0, *)
    func testErrorMessageClearedOnSuccess() async throws {
        let mock = MockChatService()
        mock.sendResult = .failure(TestError())
        let vm = NativeChatViewModel(chatService: mock)

        vm.draftText = "Fail"
        await vm.sendDraft()
        #expect(vm.errorMessage != nil)

        mock.sendResult = .success(
            NativeChatServiceResponse(id: "resp_ok", role: "assistant", content: "Recovered")
        )
        vm.draftText = "Try again"
        await vm.sendDraft()
        #expect(vm.errorMessage == nil)
        #expect(vm.messages.count == 3)
    }

    @Test("messages are empty on init")
    @available(macOS 14.0, *)
    func testInitialState() {
        let mock = MockChatService()
        let vm = NativeChatViewModel(chatService: mock)

        #expect(vm.messages.isEmpty)
        #expect(vm.draftText == "")
        #expect(vm.isSending == false)
        #expect(vm.errorMessage == nil)
    }
}
