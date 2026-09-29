import { usePetText } from "../application/game-context";
import { playGameSound } from "../application/sounds";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { A, useNavigate, useParams } from "@solidjs/router";
import { situations, situationDay, dailySituations } from "@finni/content";
import { programAsset as situationAsset } from "../assets/registry";
import { isUnlocked } from "../application/situations";
import { useGame } from "../application/game-context";
import { ActiveDayGate, GameError, GameScreen } from "../components/gameplay";
import { Button } from "../components/ui";
import { AnswerReaction } from "../components/Celebration";

/** Which cycle day the player has reached (1-5), independent of whether it is active. */
function useCurrentDay() {
  const game = useGame();
  return () => {
    const profile = game.profile();
    const day =
      profile?.currentPeriod?.index ?? (profile?.periodHistory.length ?? 0) + 1;
    return Math.min(10, Math.max(1, day));
  };
}

export function Situations() {
  const petText = usePetText();
  const game = useGame();
  const currentDay = useCurrentDay();
  const done = () => game.profile()?.completedSituationIds ?? [];
  const total = situations.length;
  const [selectedDay, setSelectedDay] = createSignal(currentDay());
  const navigate=useNavigate();
  const round=()=>game.profile()?.situationReplays[selectedDay()];
  const replaying=()=>!!round() && !round()!.claimed;
  const roundDone=()=>replaying()?round()!.completedIds:done();
  const paid=()=>game.profile()?.transactions.some(t=>t.source===`program-10:day-${selectedDay()}:situations`);
  const beginReplay=async()=>{if(game.busy())return;if(await game.perform(service=>service.startSituationReplay(selectedDay(),crypto.randomUUID(),new Date().toISOString()))) navigate(`/situations/${dailySituations(selectedDay())[0]}`);};
  return (
    <GameScreen title="Ситуации">
      <h1>Жизненные ситуации</h1>
      <p>
        {petText("По шесть историй на день. За весь набор дня — 10 монет. Каждая решённая история помогает Финни расти. Открытые наборы можно проходить снова: за каждые шесть — ещё 10 монет.")}</p>
      <p class="situation-progress" role="status">
        Пройдено {situations.filter((s) => done().includes(s.id)).length} из{" "}
        {total} · День {currentDay()} из 10
      </p>
      <label for="situation-day">Выбери день</label>
      <select
        id="situation-day"
        value={selectedDay()}
        onChange={(e) => setSelectedDay(Number(e.currentTarget.value))}
      >
        <For each={Array.from({ length: 10 }, (_, i) => i + 1)}>
          {(day) => (
            <option value={day} disabled={day > currentDay()}>
              День {day}
              {day === currentDay() ? " · сегодня" : ""}
            </option>
          )}
        </For>
      </select>
      <Show when={dailySituations(selectedDay()).every(id => done().includes(id)) && !game.profile()?.transactions.some(t => t.source === `program-10:day-${selectedDay()}:situations`)}><A class="button" href={`/situations/${dailySituations(selectedDay()).at(-1)}`}>Забрать награду за день {selectedDay()} · 10 монет</A></Show>
      <Show when={paid() && !replaying()}><Button disabled={game.busy()} onClick={beginReplay}>Пройти ещё раз · +10 монет</Button><GameError /></Show>
      <Show when={replaying()}><p role="status">Повторное прохождение: {round()!.completedIds.length} из 6 · награда 10 монет</p><Show when={round()!.completedIds.length===6}><A class="button" href={`/situations/${dailySituations(selectedDay()).at(-1)}`}>Забрать награду · +10 монет</A></Show></Show>
      <div class="situation-list">
        <For
          each={situations.filter(
            (item) => situationDay(item.id) === selectedDay(),
          )}
        >
          {(situation) => {
            const index = () =>
              situations.findIndex((item) => item.id === situation.id);
            const isDone = () => roundDone().includes(situation.id);
            const open = () => isUnlocked(index(), roundDone(), currentDay());
            const byDay = () => situationDay(situation.id) > currentDay();
            return (
              <Show
                when={open()}
                fallback={
                  <div
                    class="situation-card locked"
                    aria-label={`История ${index() + 1} закрыта`}
                  >
                    <span class="situation-lock" aria-hidden="true">
                      🔒
                    </span>
                    <div>
                      <small>{situation.group}</small>
                      <h2>История {index() + 1}</h2>
                      <span>
                        {byDay()
                          ? `Откроется в день ${situationDay(situation.id)}`
                          : "Откроется после предыдущей"}
                      </span>
                    </div>
                  </div>
                }
              >
                <A
                  class="situation-card"
                  href={`/situations/${situation.id}`}
                  classList={{ done: isDone() }}
                >
                  <img
                    src={situationAsset(situation.hero)}
                    alt=""
                    draggable={false}
                  />
                  <div>
                    <small>{situation.group}</small>
                    <h2>{situation.title}</h2>
                    <span>{isDone() ? "✓ Решено" : "Открыть историю"}</span>
                  </div>
                  <span aria-hidden="true">›</span>
                </A>
              </Show>
            );
          }}
        </For>
      </div>
    </GameScreen>
  );
}

export function SituationPlay() {
  const petText = usePetText();
  const params = useParams();
  const navigate = useNavigate();
  const game = useGame();
  const currentDay = useCurrentDay();
  const round=()=>game.profile()?.situationReplays[situationDay(params.id ?? "")];
  const replaying=()=>!!round() && !round()!.claimed;
  const completed = () => replaying() ? round()!.completedIds : game.profile()?.completedSituationIds ?? [];
  const index = () => situations.findIndex((s) => s.id === params.id);
  const situation = () => situations[index()];
  const [chosen, setChosen] = createSignal<number | null>(null);
  const [reactionOpen, setReactionOpen] = createSignal(false);
  const [showHint, setShowHint] = createSignal(false);
  const solved = createMemo(() => completed().includes(params.id ?? ""));
  const next = () => situations[index() + 1];

  createEffect(() => {
    // Router reuses this component across IDs, including browser Back.
    params.id;
    setReactionOpen(false);
    setChosen(null);
    setShowHint(false);
  });
  const choose = async (option: number) => {
    if (game.busy()) return;
    const current = situation()!;
    if (option !== current.correct) {
      setChosen(option);
      setReactionOpen(true);
      return;
    }
    if (
      await game.perform((service) =>
        service.completeSituation(current.id, option, new Date().toISOString(), replaying() ? round()!.id : undefined),
      )
    ) {
      setChosen(option);
      setReactionOpen(true);
    }
  };
  const bundleDay = () => situationDay(params.id ?? "");
  const bundleDone = () => dailySituations(bundleDay()).every(id => completed().includes(id));
  const rewardPaid = () => round() ? round()!.claimed : game.profile()?.transactions.some(t => t.source === `program-10:day-${bundleDay()}:situations`);
  const claimReward = async () => { if (game.busy() || rewardPaid()) return; if (await game.perform(service => service.claimSituationReward(bundleDay(), new Date().toISOString(), replaying() ? round()!.id : undefined))) {playGameSound("coins");setReactionOpen(false);} };
  const correctChosen = () =>
    chosen() !== null && chosen() === situation()?.correct;

  return (
    <GameScreen title="Ситуация" back="/situations" focused>
      <ActiveDayGate>
        <AnswerReaction
          open={reactionOpen()}
          actionSound={correctChosen() && bundleDone() && !rewardPaid()}
          actionLabel={correctChosen() && bundleDone() && !rewardPaid() ? "Забрать награду · +10 монет" : undefined}
          onAction={correctChosen() && bundleDone() && !rewardPaid() ? claimReward : undefined}
          busy={game.busy()}
          error={game.error()}
          success={correctChosen()}
          text={
            chosen() !== null
              ? `${situation()?.feedback?.[chosen()!] ?? situation()?.explanation}${correctChosen() && bundleDone() ? (rewardPaid() ? " Награда за шесть ситуаций уже получена." : " Все шесть ситуаций дня решены! Забери награду — 10 монет.") : ""}`
              : undefined
          }
          onClose={() => {
            setReactionOpen(false);
            if (!correctChosen()) setChosen(null);
          }}
        />
        <Show
          when={situation()}
          keyed
          fallback={
            <>
              <h1>Выберем другую историю</h1>
              <A class="button" href="/situations">
                К ситуациям
              </A>
            </>
          }
        >
          {(current) => (
            <Show
              when={isUnlocked(index(), completed(), currentDay()) || solved()}
              fallback={
                <div class="situation-locked-screen">
                  <span aria-hidden="true">🔒</span>
                  <h1>Эта история пока закрыта</h1>
                  <p>
                    {situationDay(current.id) > currentDay()
                      ? `Она откроется в день ${situationDay(current.id)}.`
                      : "Сначала реши предыдущую историю."}
                  </p>
                  <A class="button" href="/situations">
                    К ситуациям
                  </A>
                </div>
              }
            >
              <section class="situation-play">
                <small class="situation-group">{current.group}</small>
                <h1>{current.title}</h1>
                <img
                  class="situation-hero"
                  src={situationAsset(current.hero)}
                  alt=""
                  draggable={false}
                />
                <p class="situation-question">{petText(current.question)}</p>
                <div
                  class="situation-options"
                  role="group"
                  aria-label="Варианты"
                >
                  <For each={current.options}>
                    {(option, i) => (
                      <button
                        type="button"
                        data-sound="replace"
                        class="situation-option"
                        classList={{
                          chosen: chosen() === i(),
                          wrong: chosen() === i() && i() !== current.correct,
                          right: chosen() === i() && i() === current.correct,
                        }}
                        disabled={correctChosen() || game.busy()}
                        onClick={() => choose(i())}
                      >
                        <img
                          src={situationAsset(current.icons[i()]!)}
                          alt=""
                          draggable={false}
                        />
                        <span>{option}</span>
                      </button>
                    )}
                  </For>
                </div>
                <GameError />
                <Show when={!correctChosen()}>
                  <Show
                    when={showHint()}
                    fallback={
                      <Button
                        class="secondary task-hint-toggle"
                        onClick={() => setShowHint(true)}
                      >
                        Подсказка 💡
                      </Button>
                    }
                  >
                    <p class="task-hint">{petText(current.hint)}</p>
                  </Show>
                </Show>
                <Show when={correctChosen() || solved()}>
                  <div class="situation-complete-navigation">
                    <Show when={bundleDone() && !rewardPaid() && !reactionOpen()}><Button data-sound="replace" disabled={game.busy()} onClick={claimReward}>Забрать награду · +10 монет</Button></Show>
                    <Show when={bundleDone() && rewardPaid()}><p>✓ Награда за шесть ситуаций получена</p></Show>
                    <Show
                      when={next() && situationDay(next()!.id) === bundleDay()}
                      fallback={
                        <A class="button" href="/situations">
                          К ситуациям
                        </A>
                      }
                    >
                      <Button
                        onClick={() => {
                          setChosen(null);
                          setShowHint(false);
                          navigate(`/situations/${next()!.id}`);
                        }}
                      >
                        Следующая история →
                      </Button>
                    </Show>
                    <A class="button secondary" href="/home">
                      {petText("К Финни")}</A>
                  </div>
                </Show>
              </section>
            </Show>
          )}
        </Show>
      </ActiveDayGate>
    </GameScreen>
  );
}
