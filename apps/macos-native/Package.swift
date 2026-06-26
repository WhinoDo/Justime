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
            path: "Sources/JustimeNative",
            resources: [
                .copy("Resources/BundleInfo.plist"),
                .copy("Resources/JustimeNative.entitlements")
            ]
        ),
        .testTarget(
            name: "JustimeNativeTests",
            dependencies: ["JustimeNative"],
            path: "Tests/JustimeNativeTests"
        )
    ]
)
