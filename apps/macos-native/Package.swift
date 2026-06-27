// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "JustimeNative",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "JustimeNative",
            dependencies: [
                "Sparkle"
            ],
            path: "Sources/JustimeNative",
            resources: [
                .copy("Resources/BundleInfo.plist"),
                .copy("Resources/JustimeNative.entitlements"),
                .copy("Resources/appcast.xml")
            ]
        ),
        .binaryTarget(
            name: "Sparkle",
            path: "Frameworks/Sparkle.xcframework"
        ),
        .testTarget(
            name: "JustimeNativeTests",
            dependencies: ["JustimeNative"],
            path: "Tests/JustimeNativeTests"
        )
    ]
)
