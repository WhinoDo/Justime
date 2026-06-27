import Foundation

struct NativeCalendarEventResource: Codable, Equatable, Sendable {
    let title: String
    let url: String
    let type: String?
}

struct NativeCalendarReminder: Codable, Equatable, Sendable {
    let minutes: Int
    let sent: Bool
}

enum NativeCalendarEventType: String, Codable, Sendable {
    case task
    case meeting
    case reminder
    case deadline
    case other
}

enum NativeCalendarEventPriority: String, Codable, Sendable {
    case low
    case medium
    case high
    case urgent
}

enum NativeCalendarEventStatus: String, Codable, Sendable {
    case pending
    case confirmed
    case completed
    case cancelled
}

struct NativeCalendarEvent: Codable, Equatable, Sendable {
    let id: String
    let title: String
    let description: String
    let start: Date
    let end: Date
    let allDay: Bool
    let type: NativeCalendarEventType
    let priority: NativeCalendarEventPriority
    let status: NativeCalendarEventStatus
    let color: String?
    let location: String?
    let resources: [NativeCalendarEventResource]?
    let reminders: [NativeCalendarReminder]?
    let emotionScore: Int?
    let aiGenerated: Bool
    let taskId: String?
    let userId: String
    let createdAt: Date?
    let updatedAt: Date?
}

struct NativeCalendarEventCreateRequest: Codable, Equatable, Sendable {
    let title: String
    let description: String
    let start: Date
    let end: Date
    let allDay: Bool
    let type: NativeCalendarEventType
    let priority: NativeCalendarEventPriority
    let status: NativeCalendarEventStatus
    let color: String?
    let location: String?
    let resources: [NativeCalendarEventResource]?
    let reminders: [NativeCalendarReminder]?
    let emotionScore: Int?
    let aiGenerated: Bool
    let taskId: String?
}

struct NativeCalendarEventUpdateRequest: Codable, Equatable, Sendable {
    let title: String?
    let description: String?
    let start: Date?
    let end: Date?
    let allDay: Bool?
    let type: NativeCalendarEventType?
    let priority: NativeCalendarEventPriority?
    let status: NativeCalendarEventStatus?
    let color: String?
    let location: String?
    let resources: [NativeCalendarEventResource]?
    let reminders: [NativeCalendarReminder]?
    let emotionScore: Int?
    let aiGenerated: Bool?
    let taskId: String?
}
