/// <reference types="@capacitor/app" />
/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.onesolution.finni",
  appName: "Финни",
  webDir: "apps/web/dist",
  backgroundColor: "#edf7ff",
  loggingBehavior: "debug",
  android: {
    allowMixedContent: false,
    backgroundColor: "#edf7ff",
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    App: {
      disableBackButtonHandler: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#edf7ffff",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#edf7ff",
    },
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
      hidden: false,
      animation: "NONE",
    },
  },
};

export default config;
