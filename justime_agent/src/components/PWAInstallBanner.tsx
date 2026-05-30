"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Download, WifiOff, X } from "lucide-react";
import { useState } from "react";

export function PWAInstallBanner() {
  const { canInstall, isInstalled, isOffline, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

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

  if (!canInstall || isInstalled || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold">安装矩时应用</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            安装到主屏幕，获得更好的体验和离线支持
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 hover:bg-muted"
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
