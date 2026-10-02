import { readFile, writeFile } from "node:fs/promises";

export interface State {
  date: string;
  queue: string[];
}

const STATE_PATH = new URL("../state.json", import.meta.url);

export async function loadState(): Promise<State> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      date: typeof parsed.date === "string" ? parsed.date : "",
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch {
    return { date: "", queue: [] };
  }
}

export async function saveState(state: State): Promise<void> {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
