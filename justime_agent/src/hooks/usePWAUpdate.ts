"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PWAUpdateState {
  /** Whether a new version is available and waiting to activate */
  updateAvailable: boolean;
  /** Whether the update is being applied (skipWaiting sent, reloading) */
  isUpdating: boolean;
  /** Trigger the update: sends skipWaiting to the waiting SW then reloads */
  applyUpdate: () => Promise<void>;
}

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes for desktop long sessions

export function usePWAUpdate(): PWAUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    const reg = registrationRef.current;
    if (reg?.waiting) {
      // Send skipWaiting message to the waiting worker
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      // The controllerchange event will fire and we reload
      // Fallback: reload after a short delay in case controllerchange doesn't fire
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      // No waiting worker found, just reload
      window.location.reload();
    }
  }, [isUpdating]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let handledControllerChange = false;
    let onControllerChange: () => void;

    const initSWUpdateDetection = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        registrationRef.current = reg;

        // Check for already waiting worker on mount
        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        // Listen for new service workers
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              // A new worker has been installed and is waiting
              if (navigator.serviceWorker.controller) {
                // There's an active controller, so this is an update
                setUpdateAvailable(true);
                registrationRef.current = reg;
              }
              // If no controller, this is the first install — no update prompt
            }
          });
        });

        // Periodically check for updates (important for desktop long sessions)
        const checkForUpdates = () => {
          reg.update().catch(() => {
            // Silently fail — update checks are best-effort
          });
        };

        // Initial check
        checkForUpdates();

        // Set up periodic checks (every 30 minutes)
        intervalRef.current = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
      } catch {
        // Service worker not available or registration failed
      }
    };

    // Handle controller change (new SW took over → reload)
    onControllerChange = () => {
      if (!handledControllerChange) {
        handledControllerChange = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    initSWUpdateDetection();

    return () => {
      if ("serviceWorker" in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
  };
}