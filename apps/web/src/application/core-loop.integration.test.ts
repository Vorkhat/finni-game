import { completeProgramDay } from "./program-test-helper";
import { describe, expect, it } from "vitest";
import {
  dayProgress,
  DomainError,
  type LearningTaskDefinition,
  type PurchaseDefinition,
} from "@finni/shared";
import { dailyStories, purchases } from "@finni/content";
import { GameService } from "./game-service";
import { MemoryStorageAdapter } from "./storage";

async function buyCare(
  game: GameService,
  action: "feed" | "play" | "care",
  now: string,
) {
  if (dayProgress(game.getState()!, now)[action]) return;
  const id =
    action === "feed" ? "breakfast" : action === "play" ? "balloon" : "care";
  await game.purchase(
    purchases.find((p) => p.id === id)!,
    "care-" + action + "-" + game.getState()!.currentPeriod!.id,
    now,
  );
}
const iso = (day: number, minute = 0) =>
  new Date(Date.UTC(2026, 0, 1, (day - 1), minute)).toISOString();
const mandatory: PurchaseDefinition = {
  id: "breakfast",
  title: "Еда",
  price: 40,
  kind: "mandatory",
  effect: { satiety: 2 },
};
const optional: PurchaseDefinition = {
  id: "toy",
  title: "Игрушка",
  price: 30,
  kind: "optional",
  effect: { mood: 2 },
};
const task = (id: string): LearningTaskDefinition => ({
  id,
  topic: "BUDGET_PLANNING",
  text: "Сколько останется?",
  answer: 20,
  explain: "Верно",
  reward: 25,
});

describe("offline core loop", () => {
  it("runs the required scenario through application service, persistence, and pet stages", async () => {
    const storage = new MemoryStorageAdapter();
    let service = new GameService(storage);
    await service.createProfile({
      id: "profile-1",
      playerNickname: "Игрок",
      petId: "pet-1",
      petName: "Финни",
      appearance: {
        species: "fox",
        colorVariant: "orange",
        accessoryVariant: "cap",
      },
      now: iso(1),
    });

    await service.startPeriod({
      periodId: "period-1",
      income: 100,
      startedAt: iso(1, 1),
      transactionId: "income-1",
    });
    await service.setPlan(
      { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
      iso(1, 2),
    );
    await service.confirmPlan(iso(1, 3));
    await service.purchase(mandatory, "mandatory-1", iso(1, 4));
    await service.purchase(optional, "optional-1", iso(1, 5));
    await expect(
      service.purchase(
        { ...optional, id: "too-expensive", price: 1_000 },
        "nope",
        iso(1, 6),
      ),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    } satisfies Partial<DomainError>);
    await service.completeTask(
      task(dailyStories(1)[0]!),
      20,
      "reward-1",
      iso(1, 7),
    );
    await service.deposit(30, "deposit-1", iso(1, 8));
    for (const action of ["feed", "play", "care"] as const)
      await buyCare(service, action, iso(1, 8));
    await completeProgramDay(service, iso(1, 8));
    const firstClosed = await service.finishPeriod("2026-01-01T00:31:00.000Z");
    expect(
      firstClosed.periodHistory[0]?.periodResult?.planVsActual.savings,
    ).toMatchObject({ planned: 30, actual: 30 });
    expect(
      firstClosed.periodHistory[0]?.periodResult?.petStateChange,
    ).toBeDefined();

    service = new GameService(storage);
    const reloaded = await service.loadGame();
    expect(reloaded).toEqual(firstClosed);

    for (let index = 2; index <= 5; index += 1) {
      await service.startPeriod({
        periodId: `period-${index}`,
        income: 100,
        startedAt: iso(index, 1),
        transactionId: `income-${index}`,
      });
      await service.setPlan(
        { plannedMandatory: 40, plannedOptional: 30, plannedSavings: 30 },
        iso(index, 2),
      );
      await service.confirmPlan(iso(index, 3));
      await service.purchase(mandatory, `mandatory-${index}`, iso(index, 4));
      await service.purchase(optional, `optional-${index}`, iso(index, 5));
      await service.completeTask(
        task(dailyStories(index)[0]!),
        20,
        `reward-${index}`,
        iso(index, 6),
      );
      await service.deposit(30, `deposit-${index}`, iso(index, 7));
      for (const action of ["feed", "play", "care"] as const)
        await buyCare(service, action, iso(index, 8));
      await completeProgramDay(service, iso(index, 8));
      await service.finishPeriod(iso(index, 31));
    }

    expect(service.getState()?.periodHistory).toHaveLength(5);
    expect(service.getState()?.pet.stage).toBe("EXPLORER");
    expect(service.getState()?.walletBalance).toBeGreaterThanOrEqual(0);
    expect(
      service
        .getState()
        ?.transactions.every(
          (transaction) => transaction.source && transaction.amount > 0,
        ),
    ).toBe(true);
  });
});
