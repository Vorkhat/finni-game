import {
  GameProfileSchema,
  DomainError,
  migrateProfile,
  type GameProfile,
} from "@finni/shared";

import legacySituations from "../../../../packages/content/situations.json";
import { situations } from "@finni/content";

export const NORMAL_PROFILE_KEY = "finni.game-profile";
export const DEMO_PROFILE_KEY = "finni.demo-profile";
export const PROFILE_MODE_KEY = "finni.profile-mode";
export type ProfileMode = "normal" | "demo";

export function readProfileMode(storage: KeyValueStorage): ProfileMode {
  return storage.getItem(PROFILE_MODE_KEY) === "demo" ? "demo" : "normal";
}

export function writeProfileMode(
  storage: KeyValueStorage,
  mode: ProfileMode,
): void {
  if (mode === "demo") storage.setItem(PROFILE_MODE_KEY, mode);
  else storage.removeItem(PROFILE_MODE_KEY);
}

export function profileKey(mode: ProfileMode): string {
  return mode === "demo" ? DEMO_PROFILE_KEY : NORMAL_PROFILE_KEY;
}

export interface StorageAdapter {
  loadProfile(): Promise<GameProfile | null>;
  saveProfile(profile: GameProfile): Promise<void>;
  updateProfile(expected: string | null, operation: () => GameProfile): Promise<GameProfile>;
  deleteProfile(expected?: string | null): Promise<void>;
  resetProfile(profile: GameProfile, expected?: string | null): Promise<void>;
  hasProfile(): Promise<boolean>;
}

export function profileFingerprint(profile: GameProfile | null): string | null {
  return profile === null ? null : JSON.stringify(profile);
}

function assertCurrentProfile(profile: GameProfile | null, expected: string | null | undefined): void {
  if (expected !== undefined && profileFingerprint(profile) !== expected)
    throw new DomainError("PROFILE_CONFLICT");
}

function withProfileLock<T>(key: string, storage: KeyValueStorage, action: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request)
    return navigator.locks.request(`finni-profile:${key}`, action);
  // Browser writes must never silently fall back to an unsafe read-modify-write.
  if (typeof window !== "undefined" && storage === window.localStorage)
    return Promise.reject(new Error("This browser does not support coordinated profile writes"));
  return Promise.resolve().then(action);
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key = NORMAL_PROFILE_KEY,
  ) {}

  async loadProfile(): Promise<GameProfile | null> {
    return this.readProfile();
  }

  private readProfile(): GameProfile | null {
    const value = this.storage.getItem(this.key);
    if (value === null) return null;
    const raw = JSON.parse(value);
    const profile = migrateProfile(raw);
    // Legacy quiz data has no owner: import only into the existing normal game,
    // without awarding learning again. New profiles already have this field.
    if (
      this.key === NORMAL_PROFILE_KEY &&
      raw.completedSituationIds === undefined
    ) {
      try {
        const legacy = JSON.parse(
          this.storage.getItem("finni.situations") ?? "[]",
        );
        if (Array.isArray(legacy))
          profile.completedSituationIds = [...situations, ...legacySituations]
            .filter((s) => legacy.includes(s.id))
            .map((s) => s.id);
      } catch {
        /* A corrupt optional quiz cache must not block boot. */
      }
    }
    return profile;
  }

  async saveProfile(profile: GameProfile): Promise<void> {
    await withProfileLock(this.key, this.storage, () => this.writeProfile(profile));
  }

  private writeProfile(profile: GameProfile): GameProfile {
    const stored = GameProfileSchema.parse(profile);
    this.storage.setItem(this.key, JSON.stringify(stored));
    return stored;
  }

  async updateProfile(expected: string | null, operation: () => GameProfile): Promise<GameProfile> {
    return withProfileLock(this.key, this.storage, () => {
      assertCurrentProfile(this.readProfile(), expected);
      // Fingerprints must describe the canonical persisted shape, not the raw
      // operation result: parse reorders keys, so returning the raw object would
      // desync savedFingerprint from storage and cause spurious PROFILE_CONFLICT.
      return this.writeProfile(operation());
    });
  }

  async deleteProfile(expected?: string | null): Promise<void> {
    await withProfileLock(this.key, this.storage, () => {
      assertCurrentProfile(this.readProfile(), expected);
      this.storage.removeItem(this.key);
      if (this.key === NORMAL_PROFILE_KEY)
        this.storage.removeItem("finni.situations");
    });
  }
  async resetProfile(profile: GameProfile, expected?: string | null): Promise<void> {
    await withProfileLock(this.key, this.storage, () => {
      assertCurrentProfile(this.readProfile(), expected);
      this.writeProfile(profile);
    });
  }
  async hasProfile(): Promise<boolean> {
    return this.storage.getItem(this.key) !== null;
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private profile: string | null = null;
  async loadProfile(): Promise<GameProfile | null> {
    return this.profile ? migrateProfile(JSON.parse(this.profile)) : null;
  }
  async saveProfile(profile: GameProfile): Promise<void> {
    this.profile = JSON.stringify(GameProfileSchema.parse(profile));
  }
  async updateProfile(expected: string | null, operation: () => GameProfile): Promise<GameProfile> {
    assertCurrentProfile(await this.loadProfile(), expected);
    // Return the canonical persisted shape so GameService fingerprints what was
    // actually stored (see LocalStorageAdapter.updateProfile). Route through
    // saveProfile so subclasses that simulate persistence failures still apply.
    const stored = GameProfileSchema.parse(operation());
    await this.saveProfile(stored);
    return stored;
  }
  async deleteProfile(expected?: string | null): Promise<void> {
    assertCurrentProfile(await this.loadProfile(), expected);
    this.profile = null;
  }
  async resetProfile(profile: GameProfile, expected?: string | null): Promise<void> {
    assertCurrentProfile(await this.loadProfile(), expected);
    await this.saveProfile(profile);
  }
  async hasProfile(): Promise<boolean> {
    return this.profile !== null;
  }
}
