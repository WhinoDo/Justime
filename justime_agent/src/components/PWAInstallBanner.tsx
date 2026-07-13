"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Button } from "@/components/ui/button";
import { Download, WifiOff, X, RefreshCw, Share, Command } from "lucide-react";
import { useState } from "react";
import { useDesktopRuntime } from "@/hooks/useDesktopRuntime";

export function PWAInstallBanner() {
  const { canInstall, isInstalled, isOffline, install, canSafariInstall } =
    usePWAInstall();
  const { updateAvailable, isUpdating, applyUpdate } = usePWAUpdate();
  const { isDesktop } = useDesktopRuntime();
  const [dismissed, setDismissed] = useState(false);
  const [safariDismissed, setSafariDismissed] = useState(false);

  if (isDesktop) {
    return null;
  }

  // Priority 1: Offline banner — always show when offline
  if (isOffline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-yellow-500 p-3 text-center text-sm font-medium text-yellow-900">
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>您当前处于离线状态，部分功能可能不可用</span>
        </div>
      </div>
    );
  }

  // Priority 2: Update available banner — prompt user to refresh
  if (updateAvailable && !dismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">新版本可用</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Justime 有新版本，点击刷新以获取最新功能和修复
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          onClick={applyUpdate}
          className="mt-3 w-full"
          size="sm"
          disabled={isUpdating}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
          {isUpdating ? "正在刷新…" : "立即刷新"}
        </Button>
      </div>
    );
  }

  // Priority 3: Chrome/Edge native install prompt
  if (canInstall && !isInstalled && !dismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">安装 Justime 应用</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              安装到主屏幕，获得更好的体验和离线支持
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={install} className="mt-3 w-full" size="sm">
          <Download className="mr-2 h-4 w-4" />
          立即安装
        </Button>
      </div>
    );
  }

  // Priority 4: macOS Safari manual install guide
  if (canSafariInstall && !safariDismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">安装 Justime 到 Dock</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Safari 浏览器需要手动添加到 Dock
            </p>
          </div>
          <button
            onClick={() => setSafariDismissed(true)}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              1
            </span>
            <span>
              点击地址栏右侧的{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" /> 分享按钮
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              2
            </span>
            <span>在分享菜单中选择「添加到 Dock」</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              3
            </span>
            <span>
              确认后即可从 Dock 快速启动 Justime
            </span>
          </li>
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Command className="h-3 w-3" />
          提示：也可以使用快捷键 ⌥⌘D 打开 Dock 设置
        </p>
      </div>
    );
  }

  return null;
}
