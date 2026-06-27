import SwiftUI

struct NativeCalendarView: View {
    @ObservedObject var viewModel: NativeCalendarViewModel

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    private var groupedEvents: [(String, [NativeCalendarEvent])] {
        var groups: [String: [NativeCalendarEvent]] = [:]
        for event in viewModel.events {
            let key = Self.dateFormatter.string(from: event.start)
            groups[key, default: []].append(event)
        }
        return groups.sorted { pair1, pair2 in
            guard let first1 = pair1.1.first, let first2 = pair2.1.first else { return false }
            return first1.start < first2.start
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(Self.dateFormatter.string(from: viewModel.selectedDate))
                .font(.title2)
                .fontWeight(.semibold)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)

            Divider()

            Group {
                if viewModel.isLoading {
                    loadingState
                } else if let errorMessage = viewModel.errorMessage {
                    errorState(errorMessage)
                } else if viewModel.events.isEmpty {
                    emptyState
                } else {
                    eventList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(minWidth: 360, minHeight: 480)
        .task {
            await viewModel.loadEvents()
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading events...")
                .foregroundStyle(.secondary)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.red)
            Text(message)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Retry") {
                Task { await viewModel.loadEvents() }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("No events for this day")
                .foregroundStyle(.secondary)
        }
    }

    private var eventList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(groupedEvents, id: \.0) { dateLabel, events in
                    Section {
                        ForEach(events, id: \.id) { event in
                            EventRow(event: event, timeFormatter: Self.timeFormatter)
                            if event.id != events.last?.id {
                                Divider().padding(.leading, 60)
                            }
                        }
                    } header: {
                        HStack {
                            Text(dateLabel)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 12)
                        .padding(.bottom, 6)
                    }
                }
            }
        }
    }
}

private struct EventRow: View {
    let event: NativeCalendarEvent
    let timeFormatter: DateFormatter

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(timeFormatter.string(from: event.start))
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 48, alignment: .trailing)

            Circle()
                .fill(colorForPriority(event.priority))
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.body)
                    .lineLimit(1)
                if !event.description.isEmpty {
                    Text(event.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                HStack(spacing: 8) {
                    Label(event.type.rawValue.capitalized, systemImage: iconForType(event.type))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if event.allDay {
                        Text("All Day")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    private func colorForPriority(_ priority: NativeCalendarEventPriority) -> Color {
        switch priority {
        case .urgent: return .red
        case .high: return .orange
        case .medium: return .blue
        case .low: return .gray
        }
    }

    private func iconForType(_ type: NativeCalendarEventType) -> String {
        switch type {
        case .task: return "checkmark.circle"
        case .meeting: return "person.2"
        case .reminder: return "bell"
        case .deadline: return "clock"
        case .other: return "ellipsis.circle"
        }
    }
}
