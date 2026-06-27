import Foundation

protocol NativeCalendarFetching: Sendable {
    func fetchEvents(startDate: String, endDate: String) async throws -> [NativeCalendarEvent]
}

@MainActor
final class NativeCalendarViewModel: ObservableObject {
    @Published private(set) var events: [NativeCalendarEvent] = []
    @Published var selectedDate: Date = Date()
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var errorMessage: String?

    private let calendarFetcher: NativeCalendarFetching

    init(calendarFetcher: NativeCalendarFetching) {
        self.calendarFetcher = calendarFetcher
    }

    func loadEvents() async {
        isLoading = true
        errorMessage = nil

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: selectedDate)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = .withInternetDateTime

        let startString = isoFormatter.string(from: startOfDay)
        let endString = isoFormatter.string(from: endOfDay)

        do {
            let allEvents = try await calendarFetcher.fetchEvents(
                startDate: startString,
                endDate: endString
            )
            let filtered = allEvents.filter { event in
                calendar.startOfDay(for: event.start) == startOfDay
            }
            events = filtered.sorted { $0.start < $1.start }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
