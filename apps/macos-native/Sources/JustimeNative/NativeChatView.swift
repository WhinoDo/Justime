import SwiftUI

// MARK: - NativeChatService + NativeChatServiceProtocol

extension NativeChatService: NativeChatServiceProtocol {
    func send(message: String, sessionId: String?) async throws -> NativeChatServiceResponse {
        let body = NativeChatSendRequest(
            message: message,
            sessionId: sessionId,
            runtimeModelId: nil
        )
        let request = try buildSendRequest(body)
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NativeChatServiceError.invalidHTTPResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw NativeChatServiceError.networkError("HTTP \(httpResponse.statusCode)")
        }

        let decoded = try decodeResponse(data) as NativeChatSendResponse
        return NativeChatServiceResponse(
            id: decoded.id,
            role: decoded.role,
            content: decoded.content
        )
    }
}

// MARK: - NativeChatSendResponse

private struct NativeChatSendResponse: Decodable {
    let id: String
    let role: String
    let content: String
}

// MARK: - NativeChatView

@available(macOS 14.0, *)
struct NativeChatView: View {
    @State private var viewModel: NativeChatViewModel

    init(viewModel: NativeChatViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(viewModel.messages, id: \.id) { message in
                            messageBubble(for: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) {
                    if let last = viewModel.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            Divider()

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.top, 4)
            }

            HStack(alignment: .bottom, spacing: 8) {
                TextEditor(text: $viewModel.draftText)
                    .frame(minHeight: 36, maxHeight: 100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.secondary.opacity(0.3))
                    )

                Button("Send") {
                    Task { await viewModel.sendDraft() }
                }
                .disabled(viewModel.draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSending)
            }
            .padding()
        }
    }

    @ViewBuilder
    private func messageBubble(for message: NativeChatMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 48) }

            VStack(alignment: message.role == "user" ? .trailing : .leading) {
                Text(message.content)
                    .padding(10)
                    .background(message.role == "user" ? Color.accentColor.opacity(0.15) : Color.secondary.opacity(0.1))
                    .cornerRadius(10)
            }

            if message.role != "user" { Spacer(minLength: 48) }
        }
    }
}
