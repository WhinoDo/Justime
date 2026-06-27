import Foundation

// MARK: - NativeChatServiceProtocol

/// Protocol for injecting chat send capability into the view model.
/// `NativeChatService` conforms via extension in NativeChatView.swift.
protocol NativeChatServiceProtocol {
    func send(message: String, sessionId: String?) async throws -> NativeChatServiceResponse
}

// MARK: - NativeChatServiceResponse

struct NativeChatServiceResponse: Equatable {
    let id: String
    let role: String
    let content: String
}

// MARK: - NativeChatViewModel

@available(macOS 14.0, *)
@Observable
final class NativeChatViewModel {
    var messages: [NativeChatMessage] = []
    var draftText: String = ""
    var isSending: Bool = false
    var errorMessage: String?

    private let chatService: NativeChatServiceProtocol
    private(set) var sessionId: String?

    init(chatService: NativeChatServiceProtocol, sessionId: String? = nil) {
        self.chatService = chatService
        self.sessionId = sessionId
    }

    func sendDraft() async {
        let trimmed = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let userMessage = NativeChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: trimmed,
            timestamp: Date(),
            taskDecomposition: nil,
            suggestedEvents: nil,
            timingStrategy: nil,
            taskAnalysis: nil
        )
        messages.append(userMessage)

        draftText = ""
        isSending = true
        errorMessage = nil

        do {
            let response = try await chatService.send(
                message: trimmed,
                sessionId: sessionId
            )
            let assistantMessage = NativeChatMessage(
                id: response.id,
                role: response.role,
                content: response.content,
                timestamp: Date(),
                taskDecomposition: nil,
                suggestedEvents: nil,
                timingStrategy: nil,
                taskAnalysis: nil
            )
            messages.append(assistantMessage)
            if sessionId == nil {
                sessionId = response.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isSending = false
    }
}
