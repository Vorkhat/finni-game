import { personalizePetText } from "./pet-name";
import {
  createContext,
  createSignal,
  onMount,
  onCleanup,
  useContext,
  type ParentProps,
} from "solid-js";
import type { GameProfile } from "@finni/shared";
import { GameService } from "./game-service";
import {
  DEMO_PROFILE_KEY,
  LocalStorageAdapter,
  profileKey,
  readProfileMode,
  writeProfileMode,
  type ProfileMode,
} from "./storage";
import { errorMessage } from "./error-messages";
import { DomainError, advancePetNeeds } from "@finni/shared";
import { forgetTaskDrafts } from "./task-draft";
import { createHomeEventController } from "./home-event-controller";

export { bootDestination } from "./boot-route";

function createGame() {
  // Access browser storage only inside boot: blocked storage yields a recoverable screen.
  let service: GameService;
  let browserStorage: Storage;
  const [profile, setProfile] = createSignal<GameProfile | null>(null);
  const [clock, setClock] = createSignal(new Date().toISOString());
  const homeEvents = createHomeEventController(profile);
  const [mode, setMode] = createSignal<ProfileMode>("normal");
  const [adultUnlocked, setAdultUnlocked] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [bootError, setBootError] = createSignal(false);
  const [bootErrorKind, setBootErrorKind] = createSignal<"corrupt" | "future" | "unavailable">("unavailable");
  const [recoveryExported, setRecoveryExported] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [errorCode, setErrorCode] = createSignal("");
  const useService = (nextMode: ProfileMode) => {
    service = new GameService(
      new LocalStorageAdapter(browserStorage, profileKey(nextMode)),
    );
    setMode(nextMode);
    setAdultUnlocked(false);
  };
  const boot = async () => {
    setLoading(true);
    setBootError(false);
    setRecoveryExported(false);
    try {
      browserStorage = window.localStorage;
      useService(readProfileMode(browserStorage));
      setProfile(await service.loadGame());
    } catch (cause) {
      setBootErrorKind(cause instanceof DomainError && cause.code === "UNSUPPORTED_PROFILE_VERSION"
        ? "future"
        : cause instanceof SyntaxError || cause instanceof DomainError && cause.code === "INVALID_PROFILE"
          ? "corrupt"
          : "unavailable");
      setBootError(true);
    } finally {
      setLoading(false);
    }
  };
  const perform = async (
    action: (service: GameService) => Promise<GameProfile>,
  ) => {
    if (busy()) return false;
    setBusy(true);
    setError("");
    setErrorCode("");
    try {
      setProfile(await action(service));
      return true;
    } catch (cause) {
      if (cause instanceof DomainError && cause.code === "PROFILE_CONFLICT") {
        try { setProfile(await service.loadGame()); } catch { setBootError(true); }
      }
      setError(errorMessage(cause));
      setErrorCode(cause instanceof DomainError ? cause.code : "STORAGE_ERROR");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const tick = async () => {
    const now = new Date().toISOString();
    setClock(now);
    if (!service || busy() || loading() || !profile()) return;
    if (advancePetNeeds(profile()!, now) === profile()) return;
    await perform((activeService) => activeService.refreshNeeds(now));
  };
  onMount(() => {
    void boot().then(tick);
    const timer = window.setInterval(() => void tick(), 30000);
    const resume = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", resume);
    const onStorage = (event: StorageEvent) => {
      if (event.key === profileKey(mode()) && !busy() && !loading()) {
        void service.loadGame().then(setProfile).catch(() => setBootError(true));
      }
    };
    window.addEventListener("storage", onStorage);
    onCleanup(() => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("storage", onStorage);
    });
  });
  const clearError = () => {
    setError("");
    setErrorCode("");
  };
  const previewWithdrawal = (amount: number) =>
    service.previewWithdrawal(amount);
  const startDemo = async () => {
    if (busy()) return null;
    setBusy(true);
    setError("");
    try {
      const demoService = new GameService(
        new LocalStorageAdapter(browserStorage, profileKey("demo")),
      );
      const next =
        (await demoService.loadGame()) ?? (await demoService.createDemo());
      writeProfileMode(browserStorage, "demo");
      service = demoService;
      setMode("demo");
      setAdultUnlocked(false);
      setProfile(next);
      return next;
    } catch (cause) {
      setError(errorMessage(cause));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const exitDemo = async () => {
    if (busy()) return null;
    setBusy(true);
    setError("");
    try {
      const normalService = new GameService(
        new LocalStorageAdapter(browserStorage, profileKey("normal")),
      );
      const next = await normalService.loadGame();
      writeProfileMode(browserStorage, "normal");
      service = normalService;
      setMode("normal");
      setAdultUnlocked(false);
      setProfile(next);
      return next;
    } catch (cause) {
      setBootError(true);
      setError(errorMessage(cause));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const resetGame = async () => {
    const current = profile();
    if (!current) return false;
    const done = await perform((activeService) =>
      current.demoMode
        ? activeService.resetDemo()
        : activeService.resetGame({
            id: crypto.randomUUID(),
            petId: crypto.randomUUID(),
            petName: current.pet.name,
            playerNickname: "Гость",
            appearance: current.pet.appearance,
            now: new Date().toISOString(),
          }),
    );
    if (done) homeEvents.reset();
    return done;
  };
  const deleteProfile = async () => {
    if (busy()) return false;
    setBusy(true);
    try {
      await service.deleteGame();
      forgetTaskDrafts(browserStorage, mode() === "demo" ? "demo" : undefined);
      homeEvents.forget(mode() === "demo" ? "demo" : undefined);
      if (mode() === "demo") {
        const normalService = new GameService(
          new LocalStorageAdapter(browserStorage, profileKey("normal")),
        );
        service = normalService;
        writeProfileMode(browserStorage, "normal");
        setMode("normal");
        setProfile(await normalService.loadGame());
      } else {
        browserStorage.removeItem(DEMO_PROFILE_KEY);
        setProfile(null);
      }
      setAdultUnlocked(false);
      return true;
    } catch (cause) {
      if (cause instanceof DomainError && cause.code === "PROFILE_CONFLICT") {
        try { setProfile(await service.loadGame()); } catch { setBootError(true); }
      }
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const recoverCorruptProfile = async () => {
    if (bootErrorKind() !== "corrupt" || !recoveryExported()) return false;
    try {
      browserStorage.removeItem(profileKey(mode()));
      writeProfileMode(browserStorage, "normal");
      useService("normal");
      setProfile(await service.loadGame());
      setBootError(false);
      return true;
    } catch {
      setBootError(true);
      return false;
    }
  };
  const exportUnopenedSave = () => {
    try {
      const raw = browserStorage.getItem(profileKey(mode()));
      if (raw === null) return false;
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finni-save-${mode()}-${Date.now()}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRecoveryExported(true);
      return true;
    } catch {
      return false;
    }
  };
  return {
    homeEvents,
    profile,
    loading,
    bootError,
    bootErrorKind,
    recoveryExported,
    busy,
    error: () => personalizePetText(error(), profile()?.pet.name ?? "Финни"),
    errorCode,
    clearError,
    previewWithdrawal,
    mode,
    adultUnlocked,
    unlockAdult: () => setAdultUnlocked(true),
    lockAdult: () => setAdultUnlocked(false),
    startDemo,
    exitDemo,
    resetGame,
    deleteProfile,
    recoverCorruptProfile,
    exportUnopenedSave,
    boot,
    perform,
    clock,
  };
}
const GameContext = createContext<ReturnType<typeof createGame>>();
export function GameProvider(props: ParentProps) {
  const game = createGame();
  return (
    <GameContext.Provider value={game}>{props.children}</GameContext.Provider>
  );
}
export function useGame() {
  const game = useContext(GameContext);
  if (!game) throw new Error("Missing GameProvider");
  return game;
}

export function usePetText() {
  const game = useGame();
  return (text: string) => personalizePetText(text, game.profile()?.pet.name ?? "Финни");
}
