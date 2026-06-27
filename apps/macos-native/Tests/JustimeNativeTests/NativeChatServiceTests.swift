import Testing
import Foundation
@testable import JustimeNative

// MARK: - Helpers

private func testClient() throws -> NativeAPIClient {
    try NativeAPIClient(baseURL: URL(string: "http://localhost:8080")!)
}

private func testEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .formatted(NativeChatService.chatDateFormatter)
    return encoder
}

private func testDecoder() -> JSONDecoder { NativeChatService.defaultDecoder }

// MARK: - NativeChatSendRequest Tests

@Suite("NativeChatSendRequest Tests")
struct NativeChatSendRequestTests {

    @Test("Encodes to snake_case JSON body with message only")
    func testEncodeMessageOnly() throws {
        let request = NativeChatSendRequest(
            message: "Hello, Justime!",
            sessionId: nil,
            runtimeModelId: nil
        )
        let encoder = testEncoder()
        encoder.outputFormatting = .sortedKeys
        let data = try encoder.encode(request)
        let json = try #require(String(data: data, encoding: .utf8))
        #expect(json.contains("\"message\""))
        #expect(json.contains("Hello, Justime!"))
        #expect(!json.contains("sessionId"))
        #expect(!json.contains("runtimeModelId"))
    }

    @Test("Encodes optional fields when present")
    func testEncodeAllFields() throws {
        let request = NativeChatSendRequest(
            message: "Test",
            sessionId: "sess_abc123",
            runtimeModelId: "deepseek-chat"
        )
        let encoder = testEncoder()
        encoder.outputFormatting = .sortedKeys
        let data = try encoder.encode(request)
        let json = try #require(String(data: data, encoding: .utf8))
        #expect(json.contains("\"message\":\"Test\""))
        #expect(json.contains("\"sessionId\":\"sess_abc123\""))
        #expect(json.contains("\"runtimeModelId\":\"deepseek-chat\""))
    }

    @Test("Roundtrip encode-decode preserves all fields")
    func testRoundtrip() throws {
        let original = NativeChatSendRequest(
            message: "What is my schedule?",
            sessionId: "507f1f77bcf86cd799439011",
            runtimeModelId: "deepseek-reasoner"
        )
        let encoder = testEncoder()
        let data = try encoder.encode(original)
        let decoded = try testDecoder().decode(NativeChatSendRequest.self, from: data)
        #expect(decoded == original)
    }
}

// MARK: - NativeChatSessionSummary Tests

@Suite("NativeChatSessionSummary Tests")
struct NativeChatSessionSummaryTests {

    @Test("Decodes session summary from backend JSON format")
    func testDecodeSessionSummary() throws {
        let json = """
        {
            "_id": "507f1f77bcf86cd799439011",
            "userId": "user_abc",
            "title": "Project Planning",
            "updatedAt": "2026-06-15T10:30:00.000000",
            "preview": "Let's discuss the roadmap"
        }
        """
        let data = try #require(json.data(using: .utf8))
        let session = try testDecoder().decode(NativeChatSessionSummary.self, from: data)
        #expect(session.id == "507f1f77bcf86cd799439011")
        #expect(session.userId == "user_abc")
        #expect(session.title == "Project Planning")
        #expect(session.preview == "Let's discuss the roadmap")
    }

    @Test("Decodes session summary with nil preview")
    func testDecodeNilPreview() throws {
        let json = """
        {
            "_id": "507f1f77bcf86cd799439011",
            "userId": "user_abc",
            "title": "New Session",
            "updatedAt": "2026-06-20T08:00:00.000000"
        }
        """
        let data = try #require(json.data(using: .utf8))
        let session = try testDecoder().decode(NativeChatSessionSummary.self, from: data)
        #expect(session.id == "507f1f77bcf86cd799439011")
        #expect(session.preview == nil)
    }

    @Test("Roundtrip encode-decode preserves fields")
    func testRoundtrip() throws {
        let date = Date(timeIntervalSince1970: 1750000000)
        let original = NativeChatSessionSummary(
            id: "507f1f77bcf86cd799439011",
            userId: "user_abc",
            title: "Test Session",
            updatedAt: date,
            preview: "Last message"
        )
        let encoder = testEncoder()
        let data = try encoder.encode(original)
        let decoded = try testDecoder().decode(NativeChatSessionSummary.self, from: data)
        #expect(decoded.id == original.id)
        #expect(decoded.userId == original.userId)
        #expect(decoded.title == original.title)
        #expect(decoded.preview == original.preview)
        #expect(abs(decoded.updatedAt.timeIntervalSince(original.updatedAt)) < 0.001)
    }
}

// MARK: - NativeChatMessage Tests

@Suite("NativeChatMessage Tests")
struct NativeChatMessageTests {

    @Test("Decodes message from backend JSON format")
    func testDecodeMessage() throws {
        let json = """
        {
            "_id": "msg_abc123",
            "role": "user",
            "content": "Hello!",
            "timestamp": "2026-06-20T14:30:00.000000"
        }
        """
        let data = try #require(json.data(using: .utf8))
        let message = try testDecoder().decode(NativeChatMessage.self, from: data)
        #expect(message.id == "msg_abc123")
        #expect(message.role == "user")
        #expect(message.content == "Hello!")
        #expect(message.taskDecomposition == nil)
    }

    @Test("Decodes message with task decomposition data")
    func testDecodeMessageWithTaskData() throws {
        let json = """
        {
            "_id": "msg_def456",
            "role": "ai",
            "content": "I've analyzed your task.",
            "timestamp": "2026-06-20T14:31:00.000000",
            "taskDecomposition": {"steps": 3, "priority": "high"}
        }
        """
        let data = try #require(json.data(using: .utf8))
        let message = try testDecoder().decode(NativeChatMessage.self, from: data)
        #expect(message.id == "msg_def456")
        #expect(message.role == "ai")
        let taskData = try #require(message.taskDecomposition)
        #expect(taskData["steps"] == .int(3))
    }
}

// MARK: - NativeChatStreamEvent Tests

@Suite("NativeChatStreamEvent Tests")
struct NativeChatStreamEventTests {

    @Test("Decodes start event")
    func testDecodeStartEvent() throws {
        let json = """
        {"event": "start", "data": {"conversationId": "conv_123", "messageId": "msg_456"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "start")
        #expect(event.data["conversationId"] == "conv_123")
        #expect(event.data["messageId"] == "msg_456")
    }

    @Test("Decodes token event")
    func testDecodeTokenEvent() throws {
        let json = """
        {"event": "token", "data": {"content": "Hello", "messageId": "msg_456"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "token")
        #expect(event.data["content"] == "Hello")
        #expect(event.data["messageId"] == "msg_456")
    }

    @Test("Decodes metadata event")
    func testDecodeMetadataEvent() throws {
        let json = """
        {"event": "metadata", "data": {"model": "deepseek-chat", "sessionId": "sess_abc"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "metadata")
        #expect(event.data["model"] == "deepseek-chat")
        #expect(event.data["sessionId"] == "sess_abc")
    }

    @Test("Decodes usage event")
    func testDecodeUsageEvent() throws {
        let json = """
        {"event": "usage", "data": {"promptTokens": "120", "completionTokens": "45", "totalTokens": "165"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "usage")
        #expect(event.data["promptTokens"] == "120")
        #expect(event.data["completionTokens"] == "45")
        #expect(event.data["totalTokens"] == "165")
    }

    @Test("Decodes done event")
    func testDecodeDoneEvent() throws {
        let json = """
        {"event": "done", "data": {"messageId": "msg_456"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "done")
        #expect(event.data["messageId"] == "msg_456")
    }

    @Test("Decodes error event")
    func testDecodeErrorEvent() throws {
        let json = """
        {"event": "error", "data": {"message": "Model rate limit exceeded"}}
        """
        let data = try #require(json.data(using: .utf8))
        let event = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(event.event == "error")
        #expect(event.data["message"] == "Model rate limit exceeded")
    }

    @Test("Roundtrip encode-decode preserves event and data")
    func testRoundtrip() throws {
        let original = NativeChatStreamEvent(
            event: "token",
            data: ["content": "world", "messageId": "msg_789"]
        )
        let encoder = testEncoder()
        let data = try encoder.encode(original)
        let decoded = try testDecoder().decode(NativeChatStreamEvent.self, from: data)
        #expect(decoded == original)
    }
}

// MARK: - NativeChatService Request Construction Tests

@Suite("NativeChatService Request Construction Tests")
struct NativeChatServiceRequestTests {

    @Test("buildSessionsRequest returns GET /api/v1/chat/sessions")
    func testBuildSessionsRequest() throws {
        let service = NativeChatService(apiClient: try testClient())
        let request = try service.buildSessionsRequest()
        #expect(request.httpMethod == "GET")
        #expect(request.url?.path == "/api/v1/chat/sessions")
        #expect(request.httpBody == nil)
    }

    @Test("buildSendRequest returns POST /api/v1/chat/send with JSON body")
    func testBuildSendRequest() throws {
        let service = NativeChatService(apiClient: try testClient())
        let body = NativeChatSendRequest(
            message: "Hello!",
            sessionId: "sess_abc123",
            runtimeModelId: nil
        )
        let request = try service.buildSendRequest(body)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/api/v1/chat/send")
        let httpBody = try #require(request.httpBody)
        let decoded = try testDecoder().decode(NativeChatSendRequest.self, from: httpBody)
        #expect(decoded.message == "Hello!")
        #expect(decoded.sessionId == "sess_abc123")
        #expect(decoded.runtimeModelId == nil)
    }

    @Test("buildStreamRequest returns POST /api/v1/chat/stream with text/event-stream accept")
    func testBuildStreamRequest() throws {
        let service = NativeChatService(apiClient: try testClient())
        let body = NativeChatSendRequest(
            message: "Stream this",
            sessionId: nil,
            runtimeModelId: "deepseek-chat"
        )
        let request = try service.buildStreamRequest(body)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/api/v1/chat/stream")
        #expect(request.value(forHTTPHeaderField: "Accept") == "text/event-stream")
        let httpBody = try #require(request.httpBody)
        let decoded = try testDecoder().decode(NativeChatSendRequest.self, from: httpBody)
        #expect(decoded.message == "Stream this")
        #expect(decoded.runtimeModelId == "deepseek-chat")
    }

    @Test("buildSessionsRequest throws missingAPIClient when no client")
    func testMissingClient() throws {
        let service = NativeChatService()
        #expect(throws: NativeChatServiceError.self) {
            try service.buildSessionsRequest()
        }
    }

    @Test("Uses injected request executor")
    func testInjectedExecutor() throws {
        let tracker = ExecutorTracker()
        let executor: NativeChatRequestExecutor = { client, path, method, headers in
            tracker.wasCalled = true
            return try client.makeRequest(path: path, method: method, headers: headers)
        }
        let service = NativeChatService(
            apiClient: try testClient(),
            requestExecutor: executor
        )
        _ = try service.buildSessionsRequest()
        #expect(tracker.wasCalled)
    }
}

private final class ExecutorTracker: @unchecked Sendable {
    var wasCalled = false
}
