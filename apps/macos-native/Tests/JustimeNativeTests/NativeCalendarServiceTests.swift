import Testing
import Foundation
@testable import JustimeNative

@Suite("NativeCalendarService Tests")
struct NativeCalendarServiceTests {

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = .withInternetDateTime
        return formatter
    }()

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private func makeService() throws -> (NativeCalendarService, NativeAPIClient) {
        let client = try NativeAPIClient(baseURL: URL(string: "http://localhost:8080")!)
        return (NativeCalendarService(client: client), client)
    }

    private func makeDate(_ isoString: String) -> Date {
        Self.iso8601.date(from: isoString)!
    }

    // MARK: - Date encoding

    @Test("Encodes dates as ISO 8601 without fractional seconds")
    func testDateEncoding() throws {
        let date = makeDate("2026-06-27T10:00:00Z")
        let request = NativeCalendarEventCreateRequest(
            title: "test",
            description: "",
            start: date,
            end: makeDate("2026-06-27T11:00:00Z"),
            allDay: false,
            type: .task,
            priority: .medium,
            status: .pending,
            color: nil,
            location: nil,
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: false,
            taskId: nil
        )
        let data = try Self.encoder.encode(request)
        let json = String(data: data, encoding: .utf8)!
        #expect(json.contains("2026-06-27T10:00:00Z"))
        #expect(json.contains("2026-06-27T11:00:00Z"))
    }

    @Test("Create request body round-trips through decoder")
    func testCreateRequestRoundTrip() throws {
        let start = makeDate("2026-07-01T09:00:00Z")
        let end = makeDate("2026-07-01T10:00:00Z")
        let original = NativeCalendarEventCreateRequest(
            title: "Standup",
            description: "Daily standup",
            start: start,
            end: end,
            allDay: false,
            type: .meeting,
            priority: .medium,
            status: .confirmed,
            color: "#4285F4",
            location: "Zoom",
            resources: [NativeCalendarEventResource(title: "Notes", url: "https://example.com", type: "link")],
            reminders: [NativeCalendarReminder(minutes: 10, sent: false)],
            emotionScore: nil,
            aiGenerated: false,
            taskId: nil
        )
        let data = try Self.encoder.encode(original)
        let decoded = try Self.decoder.decode(NativeCalendarEventCreateRequest.self, from: data)
        #expect(decoded.title == "Standup")
        #expect(decoded.description == "Daily standup")
        #expect(decoded.type == .meeting)
        #expect(decoded.priority == .medium)
        #expect(decoded.status == .confirmed)
        #expect(decoded.location == "Zoom")
        #expect(decoded.allDay == false)
        #expect(decoded.aiGenerated == false)
    }

    // MARK: - List request path and query

    @Test("List request uses GET on /api/v1/calendar/events with date range")
    func testListRequestPathAndQuery() throws {
        let (service, _) = try makeService()
        let request = try service.buildListRequest(
            startDate: "2026-06-01T00:00:00Z",
            endDate: "2026-06-30T23:59:59Z"
        )
        #expect(request.httpMethod == "GET")
        #expect(request.url?.path == "/api/v1/calendar/events")
        let query = request.url?.query() ?? ""
        #expect(query.contains("startDate=2026-06-01T00:00:00Z"))
        #expect(query.contains("endDate=2026-06-30T23:59:59Z"))
    }

    @Test("List request includes type filter")
    func testListRequestWithTypeFilter() throws {
        let (service, _) = try makeService()
        let request = try service.buildListRequest(type: "meeting")
        #expect(request.httpMethod == "GET")
        let query = request.url?.query() ?? ""
        #expect(query.contains("type=meeting"))
    }

    @Test("List request without filters has no query string")
    func testListRequestNoFilters() throws {
        let (service, _) = try makeService()
        let request = try service.buildListRequest()
        #expect(request.url?.path == "/api/v1/calendar/events")
        #expect(request.url?.query() == nil)
    }

    // MARK: - Create request JSON body

    @Test("Create request uses POST with encoded JSON body")
    func testCreateRequest() throws {
        let (service, _) = try makeService()
        let event = NativeCalendarEventCreateRequest(
            title: "Sprint Planning",
            description: "Q3 planning session",
            start: makeDate("2026-07-07T14:00:00Z"),
            end: makeDate("2026-07-07T15:00:00Z"),
            allDay: false,
            type: .meeting,
            priority: .high,
            status: .confirmed,
            color: nil,
            location: "Conference Room A",
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: false,
            taskId: nil
        )
        let request = try service.buildCreateRequest(event)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/api/v1/calendar/events")
        #expect(request.httpBody != nil)
    }

    @Test("Create request JSON preserves title, start, end, and optional description")
    func testCreateRequestRequiredFields() throws {
        let (service, _) = try makeService()
        let event = NativeCalendarEventCreateRequest(
            title: "Lunch",
            description: "Team lunch",
            start: makeDate("2026-07-07T12:00:00Z"),
            end: makeDate("2026-07-07T13:00:00Z"),
            allDay: false,
            type: .other,
            priority: .low,
            status: .pending,
            color: nil,
            location: nil,
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: false,
            taskId: nil
        )
        let request = try service.buildCreateRequest(event)
        let body = try #require(request.httpBody)
        let decoded = try Self.decoder.decode(NativeCalendarEventCreateRequest.self, from: body)
        #expect(decoded.title == "Lunch")
        #expect(decoded.description == "Team lunch")
        #expect(decoded.allDay == false)
        #expect(decoded.type == .other)
        #expect(decoded.priority == .low)
    }

    // MARK: - Update request path and body

    @Test("Update request uses PUT on /api/v1/calendar/events/{eventId}")
    func testUpdateRequestPath() throws {
        let (service, _) = try makeService()
        let update = NativeCalendarEventUpdateRequest(
            title: "Updated Standup",
            description: nil,
            start: nil,
            end: nil,
            allDay: nil,
            type: nil,
            priority: nil,
            status: nil,
            color: nil,
            location: nil,
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: nil,
            taskId: nil
        )
        let request = try service.buildUpdateRequest(eventId: "abc123", update)
        #expect(request.httpMethod == "PUT")
        #expect(request.url?.path == "/api/v1/calendar/events/abc123")
    }

    @Test("Update request encodes partial fields with JSON body")
    func testUpdateRequestBody() throws {
        let (service, _) = try makeService()
        let update = NativeCalendarEventUpdateRequest(
            title: "Updated Title",
            description: nil,
            start: nil,
            end: nil,
            allDay: nil,
            type: nil,
            priority: nil,
            status: .completed,
            color: nil,
            location: nil,
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: nil,
            taskId: nil
        )
        let request = try service.buildUpdateRequest(eventId: "abc123", update)
        let body = try #require(request.httpBody)
        let decoded = try Self.decoder.decode(NativeCalendarEventUpdateRequest.self, from: body)
        #expect(decoded.title == "Updated Title")
        #expect(decoded.status == .completed)
        #expect(decoded.description == nil)
        #expect(decoded.start == nil)
    }

    // MARK: - Delete request

    @Test("Delete request uses DELETE on /api/v1/calendar/events/{eventId}")
    func testDeleteRequest() throws {
        let (service, _) = try makeService()
        let request = try service.buildDeleteRequest(eventId: "abc123")
        #expect(request.httpMethod == "DELETE")
        #expect(request.url?.path == "/api/v1/calendar/events/abc123")
    }

    @Test("Delete request has no body")
    func testDeleteRequestNoBody() throws {
        let (service, _) = try makeService()
        let request = try service.buildDeleteRequest(eventId: "xyz789")
        #expect(request.httpBody == nil)
    }

    // MARK: - NativeCalendarEvent decoding

    @Test("NativeCalendarEvent decodes from backend JSON shape")
    func testEventDecoding() throws {
        let json = """
        {
            "id": "665f1a2b3c4d5e6f7a8b9c0d",
            "title": "Test Event",
            "description": "A test",
            "start": "2026-06-27T10:00:00Z",
            "end": "2026-06-27T11:00:00Z",
            "allDay": false,
            "type": "meeting",
            "priority": "medium",
            "status": "pending",
            "color": null,
            "location": "Room 1",
            "resources": null,
            "reminders": null,
            "emotionScore": null,
            "aiGenerated": false,
            "taskId": null,
            "userId": "user123",
            "createdAt": "2026-06-27T09:00:00Z",
            "updatedAt": "2026-06-27T09:00:00Z"
        }
        """
        let event = try Self.decoder.decode(NativeCalendarEvent.self, from: Data(json.utf8))
        #expect(event.id == "665f1a2b3c4d5e6f7a8b9c0d")
        #expect(event.title == "Test Event")
        #expect(event.type == .meeting)
        #expect(event.userId == "user123")
    }
}
