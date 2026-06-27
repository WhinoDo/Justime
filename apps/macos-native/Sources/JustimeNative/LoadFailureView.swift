import Foundation
import SwiftUI

// MARK: - Load State

enum LoadState: Equatable {
    case idle
    case loading(URL)
    case loaded(URL)
    case failed(url: URL, code: Int, description: String)
}

// MARK: - Load State View Model

final class LoadStateViewModel: ObservableObject {
    @Published private(set) var state: LoadState = .idle

    func markLoading(_ url: URL) {
        state = .loading(url)
    }

    func markLoaded(_ url: URL) {
        state = .loaded(url)
    }

    func markFailed(url: URL, code: Int, description: String) {
        state = .failed(url: url, code: code, description: description)
    }

    var hasFailed: Bool {
        if case .failed = state { return true }
        return false
    }

    var failedURL: URL? {
        if case .failed(let url, _, _) = state { return url }
        return nil
    }

    var errorCode: Int? {
        if case .failed(_, let code, _) = state { return code }
        return nil
    }

    var errorDescription: String? {
        if case .failed(_, _, let description) = state { return description }
        return nil
    }
}

// MARK: - Load Failure View

struct LoadFailureView: View {
    @ObservedObject var viewModel: LoadStateViewModel
    var retryAction: () -> Void

    var body: some View {
        if case .failed(let url, let code, let description) = viewModel.state {
            VStack(spacing: 16) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 48))
                    .foregroundColor(.secondary)

                Text("无法加载页面")
                    .font(.title2)
                    .fontWeight(.semibold)

                VStack(spacing: 8) {
                    Text("URL: \(url.absoluteString)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)

                    Text("错误 \(code): \(description)")
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 20)

                Divider()
                    .frame(width: 200)

                VStack(spacing: 6) {
                    Text("如需启动本地开发服务器：")
                        .font(.callout)
                        .foregroundColor(.secondary)
                    Text("cd justime_agent && npm run dev")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(4)

                    Text("或设置 JUSTIME_NATIVE_APP_URL 环境变量指向已部署的 HTTPS 前端")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 20)

                Button(action: retryAction) {
                    Label("重试", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: .windowBackgroundColor))
        }
    }
}
