import { App as NativeApp } from "@capacitor/app";
import {
  Capacitor,
  type PluginListenerHandle,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";

type NativeShellOptions = {
  currentPath: () => string;
  goHome: () => void;
};

function closeTopDialog(): boolean {
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (!dialog) return false;
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  return true;
}

export function installNativeShell(options: NativeShellOptions): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  let disposed = false;
  let backHandle: PluginListenerHandle | undefined;

  void SystemBars.show().catch(() => undefined);
  void SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(
    () => undefined,
  );

  void NativeApp.addListener("backButton", ({ canGoBack }) => {
    if (closeTopDialog()) return;

    const path = options.currentPath();
    if (["/", "/boot", "/home"].includes(path)) {
      void NativeApp.exitApp().catch(() => undefined);
      return;
    }

    if (path === "/goal/select") {
      options.goHome();
      return;
    }

    if (canGoBack) window.history.back();
    else options.goHome();
  })
    .then((handle) => {
      if (disposed) void handle.remove().catch(() => undefined);
      else backHandle = handle;
    })
    .catch(() => undefined);

  return () => {
    disposed = true;
    void backHandle?.remove().catch(() => undefined);
  };
}
