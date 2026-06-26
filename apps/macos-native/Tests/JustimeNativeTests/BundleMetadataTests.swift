import Testing
import Foundation
@testable import JustimeNative

@Suite("Bundle Metadata Tests")
struct BundleMetadataTests {

    @Test("Bundled Info.plist contains expected placeholder values")
    func testBundledInfoPlistValues() {
        let plistURL = Bundle.module.url(forResource: "BundleInfo", withExtension: "plist")
        #expect(plistURL != nil, "BundleInfo.plist must be bundled with the JustimeNative target")

        guard let url = plistURL,
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else {
            Issue.record("Failed to read Info.plist from bundle")
            return
        }

        #expect(plist["CFBundleIdentifier"] as? String == "com.justime.native")
        #expect(plist["CFBundleName"] as? String == "Justime")
        #expect(plist["CFBundleExecutable"] as? String == "JustimeNative")
        #expect(plist["CFBundlePackageType"] as? String == "APPL")
        #expect(plist["LSMinimumSystemVersion"] as? String == "13.0")
    }
}
