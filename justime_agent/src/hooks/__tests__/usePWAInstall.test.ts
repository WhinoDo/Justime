import { renderHook, act } from "@testing-library/react";
import { usePWAInstall } from "../usePWAInstall";

// Mock matchMedia
const mockMatchMedia = (matches: boolean) =>
  jest.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

describe("usePWAInstall", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    jest.restoreAllMocks();
  });

  describe("初始状态", () => {
    it("应该返回正确的初始状态", () => {
      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.canInstall).toBe(false);
      expect(result.current.isInstalled).toBe(false);
      expect(result.current.canSafariInstall).toBe(false);
      expect(result.current.isSafariDesktop).toBe(false);
    });

    it("已安装时应该设置isInstalled", () => {
      window.matchMedia = mockMatchMedia(true);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isInstalled).toBe(true);
    });
  });

  describe("网络状态", () => {
    it("应该响应online事件", () => {
      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isOffline).toBe(false);

      Object.defineProperty(window.navigator, "onLine", {
        writable: true,
        value: false,
      });

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOffline).toBe(true);

      Object.defineProperty(window.navigator, "onLine", {
        writable: true,
        value: true,
      });

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(result.current.isOffline).toBe(false);
    });

    it("应该响应offline事件", () => {
      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isOffline).toBe(false);

      Object.defineProperty(window.navigator, "onLine", {
        writable: true,
        value: false,
      });

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOffline).toBe(true);
    });
  });

  describe("install方法", () => {
    it("没有installPrompt时应该返回false", async () => {
      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      let installResult: boolean = false;
      await act(async () => {
        installResult = await result.current.install();
      });

      expect(installResult).toBe(false);
    });
  });

  describe("Safari 桌面检测", () => {
    it("应该识别 macOS Safari 浏览器", () => {
      // Mock Safari on macOS user agent
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        configurable: true,
      });

      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isSafariDesktop).toBe(true);
      // canSafariInstall: Safari + not installed + not standalone
      expect(result.current.canSafariInstall).toBe(true);

      Object.defineProperty(navigator, "userAgent", {
        get: () => originalUserAgent,
        configurable: true,
      });
    });

    it("macOS Safari 已安装时不应显示安装引导", () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        configurable: true,
      });

      // Already in standalone mode
      window.matchMedia = mockMatchMedia(true);

      const { result } = renderHook(() => usePWAInstall());

      expect(result.current.isSafariDesktop).toBe(true);
      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canSafariInstall).toBe(false);

      Object.defineProperty(navigator, "userAgent", {
        get: () => originalUserAgent,
        configurable: true,
      });
    });

    it("Chrome on macOS 不应触发 Safari 安装回退", () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        configurable: true,
      });

      window.matchMedia = mockMatchMedia(false);

      const { result } = renderHook(() => usePWAInstall());

      // Chrome includes "Safari" in UA but should not match our Safari-only regex
      expect(result.current.isSafariDesktop).toBe(false);
      expect(result.current.canSafariInstall).toBe(false);

      Object.defineProperty(navigator, "userAgent", {
        get: () => originalUserAgent,
        configurable: true,
      });
    });
  });

  describe("清理", () => {
    it("卸载时应该移除事件监听器", () => {
      window.matchMedia = mockMatchMedia(false);

      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => usePWAInstall());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});