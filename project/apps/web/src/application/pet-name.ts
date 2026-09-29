export type NameCase = "nom" | "acc" | "dat" | "gen" | "ins" | "prep";
type Forms = Record<NameCase, string>;
const pet: Forms = { nom: "питомец", acc: "питомца", dat: "питомцу", gen: "питомца", ins: "питомцем", prep: "питомце" };
const exceptions: Record<string, string[]> = {
  малыш: ["малыша", "малышу", "малыша", "малышом", "малыше"],
  игорь: ["игоря", "игорю", "игоря", "игорем", "игоре"],
  щенок: ["щенка", "щенку", "щенка", "щенком", "щенке"],
  лев: ["льва", "льву", "льва", "львом", "льве"],
  пёс: ["пса", "псу", "пса", "псом", "псе"],
  пес: ["пса", "псу", "пса", "псом", "псе"],
};

/** Conservative offline rules. Ambiguous names keep their spelling in the
 * nominative; oblique cases use “питомец” rather than guessing. */
export function petName(name: string, grammaticalCase: NameCase = "nom"): string {
  if (grammaticalCase === "nom") return name;
  const lower = name.toLocaleLowerCase("ru");
  const matchCase = (value: string) => name === name.toLocaleUpperCase("ru")
    ? value.toLocaleUpperCase("ru")
    : name[0] === name[0]?.toLocaleUpperCase("ru") ? value.charAt(0).toLocaleUpperCase("ru") + value.slice(1) : value;
  const index = ["acc", "dat", "gen", "ins", "prep"].indexOf(grammaticalCase);
  if (exceptions[lower]) return matchCase(exceptions[lower]![index]!);
  if (!/^[а-яё]+$/i.test(name)) return pet[grammaticalCase];
  // These endings are normally indeclinable (Финни, Рио, Лу, Рене).
  if (/[иоеэуыю]$/.test(lower)) return name;
  const stem = name.slice(0, -1);
  let endings: string[] | undefined;
  if (lower.endsWith("а")) endings = ["у", "е", /[гкхжчшщ]$/.test(stem.toLowerCase()) ? "и" : "ы", /[жчшщц]$/.test(stem.toLowerCase()) ? "ей" : "ой", "е"];
  else if (lower.endsWith("я")) endings = ["ю", lower.endsWith("ия") ? "и" : "е", "и", "ей", lower.endsWith("ия") ? "и" : "е"];
  else if (lower.endsWith("й")) endings = ["я", "ю", "я", "ем", lower.endsWith("ий") ? "и" : "е"];
  else if (/[бвгджзклмнпрстфхцчшщ]$/.test(lower)) {
    // Adjectival nicknames and soft-sign names need gender/stress information.
    const suffix = ["а", "у", "а", /[жчшщц]$/.test(lower) ? "ем" : "ом", "е"][index]!;
    return name + (name === name.toUpperCase() ? suffix.toUpperCase() : suffix);
  }
  if (!endings || /(?:ый|ой)$/.test(lower)) return pet[grammaticalCase];
  const ending = endings[index]!;
  return stem + (name === name.toUpperCase() ? ending.toUpperCase() : ending);
}

/** Only authored game copy is passed here, never the child's name/goal text. */
export function personalizePetText(text: string, name: string): string {
  return text.replace(/Финни/g, (_word, offset: number) => {
    const before = text.slice(0, offset).toLowerCase();
    let form: NameCase = "nom";
    const after = text.slice(offset + 5).toLowerCase();
    if (/(?:покормить|покорми|кормить|умыть|напоить|растят|выбрать|выбери)\s+$/.test(before)) form = "acc";
    else if (/(?:^|\s)(?:к|помочь|помоги|поможем|помогает|помогают|помогла|поможет|нужно|нужны|самому|голодному)\s+$/.test(before)) form = "dat";
    else if (/(?:^|\s)(?:для|у|без|домик|дом|состояние|стадия|профиль|профиля|движения|праздник|мечта)\s+$/.test(before)) form = "gen";
    else if (/(?:^|\s)с\s+$/.test(before)) form = "ins";
    else if (/(?:^|\s)о\s+$/.test(before)) form = "prep";
    if (form === "nom" && /^\s+(?:действительно\s+)?(?:нужно|не обойтись|понадобился)/.test(after)) form = "dat";
    return petName(name, form);
  });
}
