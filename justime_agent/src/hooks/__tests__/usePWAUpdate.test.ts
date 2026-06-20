import { renderHook, act } from "@testing-library/react";
import { usePWAUpdate } from "../usePWAUpdate";

describe("usePWAUpdate", () => {
  let mockGetRegistration: jest.Mock;
  let mockAddEventListener: jest.Mock;
  let mockRemoveEventListener: jest.Mock;
  let originalServiceWorker: ServiceWorkerContainer | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    // Save original serviceWorker
    originalServiceWorker = navigator.serviceWorker;

    mockGetRegistration = jest.fn().mockResolvedValue(null);
    mockAddEventListener = jest.fn();
    mockRemoveEventListener = jest.fn();

    // Mock navigator.serviceWorker since jsdom doesn't provide it
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: mockGetRegistration,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        controller: null,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    // Restore original serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });

  it("应该返回初始状态 updateAvailable=false, isUpdating=false", async () => {
    const { result } = await act(async () => {
      return renderHook(() => usePWAUpdate());
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.isUpdating).toBe(false);
  });

  it("没有 serviceWorker 注册时不应崩溃", async () => {
    mockGetRegistration.mockResolvedValue(null);

    const { result } = await act(async () => {
      return renderHook(() => usePWAUpdate());
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.isUpdating).toBe(false);
  });

  describe("applyUpdate", () => {
    it("没有 waiting worker 时 applyUpdate 应调用 reload", async () => {
      const reloadMock = jest.fn();
      const originalReload = window.location.reload;
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: reloadMock },
        configurable: true,
        writable: true,
      });

      const { result } = await act(async () => {
        return renderHook(() => usePWAUpdate());
      });

      await act(async () => {
        await result.current.applyUpdate();
      });

      // Advance timers for the fallback reload timeout
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(reloadMock).toHaveBeenCalled();

      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: originalReload },
        configurable: true,
        writable: true,
      });
    });
  });

  describe("定时更新检查", () => {
    it("应该调用 getRegistration 进行初始化检查", async () => {
      await act(async () => {
        renderHook(() => usePWAUpdate());
      });

      expect(mockGetRegistration).toHaveBeenCalled();
    });
  });
});