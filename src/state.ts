import { readFile, writeFile } from "node:fs/promises";

export interface State {
  queue: string[];
  visitedUrls: string[];
}

const STATE_PATH = new URL("../state.json", import.meta.url);

export async function loadState(): Promise<State> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      visitedUrls: Array.isArray(parsed.visitedUrls) ? parsed.visitedUrls : [],
    };
  } catch {
    return { queue: [], visitedUrls: [] };
  }
}

export async function saveState(state: State): Promise<void> {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
