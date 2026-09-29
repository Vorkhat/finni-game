import { afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  show: vi.fn(),
  style: vi.fn(),
  listen: vi.fn(),
  exit: vi.fn(),
  isNative: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: native.isNative },
  SystemBars: { show: native.show, setStyle: native.style },
  SystemBarsStyle: { Light: "LIGHT" },
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: native.listen, exitApp: native.exit },
}));
import { installNativeShell } from "./native-shell";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("Android Back shell", () => {
  it("closes dialogs before navigation, goes back, returns home, exits only from home and cleans up", async () => {
    native.isNative.mockReturnValue(true);
    native.show.mockResolvedValue(undefined);
    native.style.mockResolvedValue(undefined);
    native.exit.mockResolvedValue(undefined);
    let callback!: (e: { canGoBack: boolean }) => void;
    const remove = vi.fn().mockResolvedValue(undefined);
    native.listen.mockImplementation((_name, fn) => {
      callback = fn;
      return Promise.resolve({ remove });
    });
    const dispatch = vi.fn();
    const query = vi.fn().mockReturnValue({ dispatchEvent: dispatch });
    const back = vi.fn();
    vi.stubGlobal("document", { querySelector: query });
    vi.stubGlobal("window", { history: { back } });
    let path = "/shop";
    const home = vi.fn();
    const cleanup = installNativeShell({
      currentPath: () => path,
      goHome: home,
    });
    await Promise.resolve();
    callback({ canGoBack: true });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    query.mockReturnValue(null);
    callback({ canGoBack: true });
    expect(back).toHaveBeenCalledOnce();
    callback({ canGoBack: false });
    expect(home).toHaveBeenCalledOnce();
    path = "/home";
    callback({ canGoBack: true });
    expect(native.exit).toHaveBeenCalledOnce();
    cleanup();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("unsupported native operations do not create unhandled rejections", async () => {
    native.isNative.mockReturnValue(true);
    native.show.mockRejectedValue(new Error("unsupported"));
    native.style.mockRejectedValue(new Error("unsupported"));
    native.listen.mockRejectedValue(new Error("unsupported"));
    const cleanup = installNativeShell({
      currentPath: () => "/home",
      goHome: vi.fn(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    cleanup();
  });
});
