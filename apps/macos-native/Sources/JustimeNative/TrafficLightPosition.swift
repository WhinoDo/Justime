import CoreGraphics

struct TrafficLightPosition: Equatable {
    var topInset: CGFloat
    var leadingInset: CGFloat

    static let defaultPosition = TrafficLightPosition(topInset: 12, leadingInset: 12)
}
