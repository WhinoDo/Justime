import Testing
import Foundation
@testable import JustimeNative

@Suite("NativeCalendarViewModel Tests")
@MainActor
struct NativeCalendarViewModelTests {

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = .withInternetDateTime
        return formatter
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private func makeDate(year: Int, month: Int, day: Int, hour: Int = 12) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        return Calendar.current.date(from: components)!
    }

    private func makeEvent(
        id: String,
        title: String,
        startHour: Int,
        endHour: Int,
        date: Date,
        type: NativeCalendarEventType = .task,
        priority: NativeCalendarEventPriority = .medium
    ) -> NativeCalendarEvent {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let start = calendar.date(bySettingHour: startHour, minute: 0, second: 0, of: startOfDay)!
        let end = calendar.date(bySettingHour: endHour, minute: 0, second: 0, of: startOfDay)!

        return NativeCalendarEvent(
            id: id,
            title: title,
            description: "Desc for \(title)",
            start: start,
            end: end,
            allDay: false,
            type: type,
            priority: priority,
            status: .pending,
            color: nil,
            location: nil,
            resources: nil,
            reminders: nil,
            emotionScore: nil,
            aiGenerated: false,
            taskId: nil,
            userId: "user1",
            createdAt: nil,
            updatedAt: nil
        )
    }

    // MARK: - Successful load with date filtering

    @Test("Filters events to show only those on the selected date")
    func testSelectedDateFiltering() async throws {
        let today = makeDate(year: 2026, month: 6, day: 27)
        let tomorrow = makeDate(year: 2026, month: 6, day: 28)

        let todayEvent1 = makeEvent(id: "t1", title: "Morning Standup", startHour: 9, endHour: 9, date: today)
        let todayEvent2 = makeEvent(id: "t2", title: "Lunch Meeting", startHour: 12, endHour: 13, date: today)
        let tomorrowEvent = makeEvent(id: "tm1", title: "Tomorrow Task", startHour: 10, endHour: 11, date: tomorrow)

        let mock = MockCalendarFetcher(result: .success([todayEvent1, tomorrowEvent, todayEvent2]))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = today

        await viewModel.loadEvents()

        #expect(viewModel.events.count == 2)
        #expect(viewModel.events[0].title == "Morning Standup")
        #expect(viewModel.events[1].title == "Lunch Meeting")
    }

    @Test("Sorts events by start time ascending")
    func testEventsSortedByStart() async {
        let date = makeDate(year: 2026, month: 7, day: 1)
        let afternoon = makeEvent(id: "a1", title: "Afternoon", startHour: 14, endHour: 15, date: date)
        let morning = makeEvent(id: "m1", title: "Morning", startHour: 9, endHour: 10, date: date)

        let mock = MockCalendarFetcher(result: .success([afternoon, morning]))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = date

        await viewModel.loadEvents()

        #expect(viewModel.events[0].title == "Morning")
        #expect(viewModel.events[1].title == "Afternoon")
    }

    // MARK: - Empty list state

    @Test("Represents empty state without error when service returns no events")
    func testEmptyListState() async {
        let date = makeDate(year: 2026, month: 6, day: 15)
        let mock = MockCalendarFetcher(result: .success([]))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = date

        await viewModel.loadEvents()

        #expect(viewModel.events.isEmpty)
        #expect(viewModel.errorMessage == nil)
        #expect(viewModel.isLoading == false)
    }

    // MARK: - Loading state transitions

    @Test("Sets isLoading true during load and false after completion")
    func testLoadingStateTransition() async {
        let date = makeDate(year: 2026, month: 6, day: 20)
        let mock = MockCalendarFetcher(result: .success([]))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = date

        #expect(viewModel.isLoading == false)

        await viewModel.loadEvents()

        #expect(viewModel.isLoading == false)
    }

    @Test("Clears previous error on new load attempt")
    func testClearsErrorOnNewLoad() async {
        let date = makeDate(year: 2026, month: 6, day: 20)
        let event = makeEvent(id: "e1", title: "Event", startHour: 10, endHour: 11, date: date)

        let fetcher = FailableCalendarFetcher()
        let viewModel = NativeCalendarViewModel(calendarFetcher: fetcher)
        viewModel.selectedDate = date

        // First load fails, sets errorMessage
        fetcher.result = .failure(TestError.networkFailure)
        await viewModel.loadEvents()
        #expect(viewModel.errorMessage != nil)

        // Second load succeeds, clears errorMessage
        fetcher.result = .success([event])
        await viewModel.loadEvents()
        #expect(viewModel.errorMessage == nil)
        #expect(viewModel.events.count == 1)
    }

    // MARK: - Error state

    @Test("Sets errorMessage when service fails")
    func testErrorState() async {
        let date = makeDate(year: 2026, month: 6, day: 25)
        let mock = MockCalendarFetcher(result: .failure(TestError.networkFailure))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = date

        await viewModel.loadEvents()

        #expect(viewModel.errorMessage != nil)
        #expect(viewModel.events.isEmpty)
        #expect(viewModel.isLoading == false)
    }

    @Test("Keeps isLoading false after error")
    func testLoadingFalseAfterError() async {
        let date = makeDate(year: 2026, month: 6, day: 25)
        let mock = MockCalendarFetcher(result: .failure(TestError.networkFailure))
        let viewModel = NativeCalendarViewModel(calendarFetcher: mock)
        viewModel.selectedDate = date

        await viewModel.loadEvents()

        #expect(viewModel.isLoading == false)
    }
}

// MARK: - Test Helpers

private enum TestError: LocalizedError {
    case networkFailure

    var errorDescription: String? {
        switch self {
        case .networkFailure:
            return "The request timed out."
        }
    }
}

private struct MockCalendarFetcher: NativeCalendarFetching {
    let result: Result<[NativeCalendarEvent], Error>

    func fetchEvents(startDate: String, endDate: String) async throws -> [NativeCalendarEvent] {
        try result.get()
    }
}

private final class FailableCalendarFetcher: NativeCalendarFetching, @unchecked Sendable {
    var result: Result<[NativeCalendarEvent], Error> = .success([])

    func fetchEvents(startDate: String, endDate: String) async throws -> [NativeCalendarEvent] {
        try result.get()
    }
}
