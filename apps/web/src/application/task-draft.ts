import type {
  InteractiveLearningTaskDefinition,
  TaskSubmission,
} from "@finni/shared";
import { evaluateTask } from "@finni/shared";

export function readTaskDraft(
  key: string,
  task: InteractiveLearningTaskDefinition,
): TaskSubmission | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value === null) return null;
    // Re-evaluate against the current content; never trust cached rewards/results.
    evaluateTask(task, value);
    return value as TaskSubmission;
  } catch {
    return null;
  }
}
export function saveTaskDraft(key: string, answer: TaskSubmission | null) {
  try {
    if (answer) localStorage.setItem(key, JSON.stringify(answer));
    else localStorage.removeItem(key);
  } catch {
    /* A disposable draft must not block the profile's atomic reward save. */
  }
}
export function forgetTaskDrafts(storage: Storage, mode?: "normal" | "demo") {
  const prefix = `finni.task-draft:${mode ? `${mode}:` : ""}`;
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((key): key is string => !!key?.startsWith(prefix));
  for (const key of keys) storage.removeItem(key);
}
