import type { PetState } from "@finni/shared";

export function needLabel(stat: keyof PetState, value: number) {
  const labels = {
    satiety: ["Очень голоден", "Пора поесть", "Сыт"],
    mood: ["Очень грустно", "Пора поиграть", "Доволен"],
    care: ["Нужен уход!", "Пора умыться", "Ухожен"],
  };
  return labels[stat][value <= 20 ? 0 : value <= 50 ? 1 : 2];
}

export function NeedMeter(props: {
  stat: keyof PetState;
  value: number;
  title: string;
}) {
  const tone = () =>
    props.value <= 20 ? "low" : props.value <= 50 ? "medium" : "good";
  return (
    <span class={`need-meter need-${tone()}`}>
      <span class="need-title">{props.title}</span>
      <span
        class="need-track"
        role="meter"
        aria-label={props.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={props.value}
        aria-valuetext={needLabel(props.stat, props.value)}
      >
        <span
          class="need-fill"
          style={{ width: `${Math.max(0, Math.min(100, props.value))}%` }}
        />
        <span class="need-spark" aria-hidden="true">
          {props.value <= 20 ? "!" : "✦"}
        </span>
      </span>
      <span class="need-description">{needLabel(props.stat, props.value)}</span>
    </span>
  );
}
