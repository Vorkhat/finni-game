import { z } from "zod";

const money = z.number().int().nonnegative();
const item = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  asset: z.string().trim().min(1),
  cost: money.optional(),
  amount: money.optional(),
});
export const ProgramTaskSchema = z.object({
  id: z.string().regex(/^T\d{2}$/),
  day: z.number().int().min(1).max(10),
  slot: z.number().int().min(1).max(2),
  title: z.string().trim().min(1),
  question: z.string().trim().min(1),
  hero: z.string().trim().min(1),
  hint: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  theme: z.string().trim().min(1),
  petStage: z.string().trim().min(1),
  type: z.enum([
    "select",
    "sort",
    "cart",
    "allocate",
    "transfer",
    "buy_then_save",
    "find_extra",
    "order",
  ]),
  reward: z.object({ coins: money, oncePerId: z.literal(true) }),
  board: z.object({
    wallet: money.optional(),
    saved: money.optional(),
    goal: money.optional(),
    goalAsset: z.string().optional(),
    choices: z.array(item).optional(),
    items: z.array(item).optional(),
    rows: z.array(item).optional(),
    tokens: z.array(z.object({ id: z.string(), value: money })).optional(),
    zones: z.array(z.string().trim().min(1)).optional(),
    initialZone: z.string().optional(),
    purchased: z.array(z.string()).optional(),
    displayedTotal: money.optional(),
  }),
  solution: z.object({
    accepted: z.array(z.string()).optional(),
    acceptedSets: z.array(z.array(z.string())).optional(),
    mapping: z.record(z.string()).optional(),
    zoneTotals: z.record(money).optional(),
    totals: z.record(money).optional(),
    order: z.array(z.string()).optional(),
    steps: z
      .array(
        z.object({
          select: z.string().optional(),
          transferRemainingTo: z.string().optional(),
        }),
      )
      .optional(),
    outcomes: z
      .record(
        z.object({
          wallet: money,
          saved: money.optional(),
          spent: money.optional(),
        }),
      )
      .optional(),
    savedAfter: money.optional(),
    walletAfter: money.optional(),
    remaining: money.optional(),
    correctTotal: money.optional(),
    total: money.optional(),
    maxTotal: money.optional(),
    required: z.array(z.string().trim().min(1)).optional(),
    allTokens: z.boolean().optional(),
  }),
}).superRefine((task, ctx) => {
  const invalid = (field: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: field.split("."), message: `Invalid ${field} for ${task.type}` });
  const ids = (items: { id: string }[] | undefined) => new Set((items ?? []).map((item) => item.id));
  const items = task.board.items;
  const choices = task.board.choices;
  const rows = task.board.rows;
  const tokens = task.board.tokens;
  const zones = new Set(task.board.zones ?? []);
  for (const [name, values] of [["choices", choices], ["items", items], ["rows", rows], ["tokens", tokens]] as const) {
    if (values && ids(values).size !== values.length) invalid(`board.${name}`);
  }
  if (task.type === "select" || task.type === "find_extra") {
    const available = task.type === "find_extra" ? ids(rows) : ids(choices);
    if (!available.size || !task.solution.accepted?.length || !task.solution.accepted.every((id) => available.has(id))) invalid("solution.accepted");
  }
  if (task.type === "buy_then_save") {
    if (!choices?.length || !task.solution.steps?.[0]?.select || !ids(choices).has(task.solution.steps[0].select!) || !task.solution.steps[1]?.transferRemainingTo?.trim()) invalid("solution.steps");
  }
  if (task.type === "cart") {
    const available = ids(items);
    if (!available.size || !task.solution.acceptedSets?.length || task.solution.acceptedSets.some((set) => !set.length || set.some((id) => !available.has(id)))) invalid("solution.acceptedSets");
  }
  if (task.type === "order") {
    const available = ids(items);
    if (!available.size || task.solution.order?.length !== available.size || task.solution.order?.some((id) => !available.has(id))) invalid("solution.order");
  }
  if (["sort", "allocate", "transfer"].includes(task.type)) {
    const available = ids(tokens ?? items);
    const mapping = task.solution.mapping;
    const totals = task.solution.zoneTotals ?? task.solution.totals;
    if (!available.size || !zones.size || (!mapping && !totals)) invalid("solution");
    if (mapping && (Object.keys(mapping).length !== available.size || Object.entries(mapping).some(([id, zone]) => !available.has(id) || !zones.has(zone)))) invalid("solution.mapping");
    if (totals && Object.keys(totals).some((zone) => !zones.has(zone))) invalid("solution.zoneTotals");
  }
});
export type ProgramTask = z.infer<typeof ProgramTaskSchema>;
export type ProgramAnswer = {
  choice?: string;
  selected?: string[];
  mapping?: Record<string, string>;
  order?: string[];
  transferred?: boolean;
};

/** Pure evaluation, shared by the UI and the reward boundary. Training never spends the real wallet. */
export function evaluateProgramTask(
  task: ProgramTask,
  answer: ProgramAnswer,
): boolean {
  const { board, solution } = task;
  if (task.type === "select" || task.type === "find_extra")
    return !!answer.choice && !!solution.accepted?.includes(answer.choice);
  if (task.type === "buy_then_save")
    return (
      answer.choice === solution.steps?.[0]?.select &&
      answer.transferred === true
    );
  if (task.type === "cart") {
    const selected = answer.selected ?? [];
    return (
      new Set(selected).size === selected.length &&
      !!solution.acceptedSets?.some(
        (set) =>
          set.length === selected.length &&
          set.every((id) => selected.includes(id)),
      )
    );
  }
  if (task.type === "order")
    return (
      !!solution.order &&
      answer.order?.length === solution.order.length &&
      solution.order.every((id, i) => answer.order![i] === id)
    );
  const mapping = answer.mapping ?? {};
  const tokens = board.tokens ?? board.items ?? [];
  if (
    Object.keys(mapping).length !== tokens.length ||
    !tokens.every((token) => board.zones?.includes(mapping[token.id]!))
  )
    return false;
  if (
    solution.mapping &&
    !Object.entries(solution.mapping).every(
      ([id, zone]) => mapping[id] === zone,
    )
  )
    return false;
  const totals = solution.zoneTotals ?? solution.totals;
  if (
    totals &&
    !Object.entries(totals).every(
      ([zone, value]) =>
        (board.tokens ?? [])
          .filter((token) => mapping[token.id] === zone)
          .reduce((sum, token) => sum + token.value, 0) === value,
    )
  )
    return false;
  return !!solution.mapping || !!totals;
}
