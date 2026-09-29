import { beforeEach, afterEach, expect, it, vi } from "vitest";
const enabled = vi.hoisted(() => ({sound:true}));
vi.mock("./preferences", () => ({readPreferences: () => enabled}));
import {playGameSound, stopGameSounds} from "./sounds";
const all: FakeAudio[] = [];
class FakeAudio {
  currentTime = 0; preload = ""; volume = 1; onended: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve()); pause = vi.fn();
  constructor(public src: string) {all.push(this);}
}
beforeEach(() => {enabled.sound=true; vi.stubGlobal("Audio",FakeAudio); stopGameSounds(); for(const a of all){a.play.mockReset().mockResolvedValue(undefined);a.pause.mockClear();}});
afterEach(() => {stopGameSounds();vi.unstubAllGlobals();});
it("replaces rather than layers effects, and restarts repeated errors", () => {
  playGameSound("incorrect"); const wrong=all.find(a=>a.src.endsWith("incorrect.mp3"))!;
  wrong.currentTime=1; playGameSound("incorrect"); expect(wrong.pause).toHaveBeenCalledTimes(1);expect(wrong.currentTime).toBe(0);expect(wrong.play).toHaveBeenCalledTimes(2);
  playGameSound("correct");expect(wrong.pause).toHaveBeenCalledTimes(2);
});
it("queues bundle coins after the answer and cancels them when muted", () => {
  playGameSound("correct","coins");const correct=[...all].reverse().find(a=>a.src.endsWith("correct.mp3"))!;
  correct.onended!(); const coins=all.find(a=>a.src.endsWith("coins.mp3"))!;expect(coins.play).toHaveBeenCalledTimes(1);
  playGameSound("correct","coins"); enabled.sound=false;stopGameSounds();expect(correct.onended).toBeNull();
  playGameSound("milestone");expect(all.filter(a=>a.src.endsWith("milestone.mp3"))).toHaveLength(0);
});
it("blocked playback cannot reject a game action", async () => {
  playGameSound("coins");const coins=all.find(a=>a.src.endsWith("coins.mp3"))!;
  coins.play.mockRejectedValueOnce(new Error("NotAllowedError"));
  expect(()=>playGameSound("coins")).not.toThrow();await Promise.resolve();expect(coins.onended).toBeNull();
});
