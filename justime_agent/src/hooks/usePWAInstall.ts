"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Detect if the browser is Safari on macOS (desktop).
 * Safari does not fire the beforeinstallprompt event.
 * We provide a manual "Share → Add to Dock" fallback for Safari users.
 */
function isSafariMacOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // Safari detection: has Safari in UA but NOT Chrome (Chrome includes Safari)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  // macOS detection
  const isMac = /macintosh|mac os x/i.test(ua);
  return isSafari && isMac;
}

/**
 * Check if the app is running in standalone/PWA mode.
 */
function isRunningAsPWA(): boolean {
  if (typeof window === "undefined") return false;
  // Check display-mode: standalone (Chrome, Edge, Firefox)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  // Check navigator.standalone (Safari iOS only, but we're on desktop Safari — covered by display-mode)
  return false;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSafariDesktop, setIsSafariDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect Safari on macOS
    setIsSafariDesktop(isSafariMacOS());

    // Detect offline state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (isRunningAsPWA()) {
      setIsInstalled(true);
    }

    // Also listen for appinstalled event to update state
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
      return true;
    }

    return false;
  }, [installPrompt]);

  // Safari on macOS can install PWA via Share → Add to Dock, but has no
  // beforeinstallprompt event. Only show manual guidance if not installed.
  const canSafariInstall = isSafariDesktop && !isInstalled && !isRunningAsPWA();

  return {
    /** Chrome/Edge: beforeinstallprompt is available */
    canInstall: !!installPrompt,
    /** App is already installed (running in standalone mode) */
    isInstalled,
    /** Browser is offline */
    isOffline,
    /** Trigger the native install prompt (Chrome/Edge only) */
    install,
    /** Safari on macOS without beforeinstallprompt — show manual guide */
    canSafariInstall,
    /** Whether this is Safari on macOS desktop */
    isSafariDesktop,
  };
}