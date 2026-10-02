import { chromium } from "playwright";
import { crawlArticleLinks } from "./crawler.js";
import { loadState, saveState } from "./state.js";
import { readArticle } from "./browser.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function withRefParams(url: string, refParams: URLSearchParams): string {
  if ([...refParams].length === 0) return url;
  const target = new URL(url);
  for (const [key, value] of refParams) {
    if (!target.searchParams.has(key)) {
      target.searchParams.set(key, value);
    }
  }
  return target.toString();
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function minutesUntilNextUtcMidnight(now: Date): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  );
  return (nextMidnight - now.getTime()) / 60_000;
}

async function main() {
  const targetSiteUrls = parseList(requireEnv("TARGET_SITE_URL"));
  const articleUrlPatterns = parseList(requireEnv("ARTICLE_URL_PATTERN"));
  const readDurationSeconds = Number(process.env.READ_DURATION_SECONDS ?? "300");
  const tickIntervalMinutes = Number(process.env.TICK_INTERVAL_MINUTES ?? "15");
  const refParams = new URL(targetSiteUrls[0]).searchParams;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const state = await loadState();

  if (state.date !== today) {
    console.log(`New day (${today}) — refilling today's queue...`);
    const allFound = new Set<string>();
    for (const siteUrl of targetSiteUrls) {
      console.log(`  crawling ${siteUrl}`);
      const found = await crawlArticleLinks(siteUrl, articleUrlPatterns);
      for (const url of found) allFound.add(url);
    }
    state.date = today;
    state.queue = shuffle([...allFound]);
    console.log(`Queued ${state.queue.length} article(s) for today, in random order.`);
    await saveState(state);
  }

  if (state.queue.length === 0) {
    console.log("Today's queue is already empty. Nothing to do this tick.");
    return;
  }

  const minutesLeftToday = minutesUntilNextUtcMidnight(now);
  const ticksRemaining = Math.max(1, Math.ceil(minutesLeftToday / tickIntervalMinutes));
  const articlesRemaining = state.queue.length;
  const mustCatchUp = articlesRemaining >= ticksRemaining;
  const probability = Math.min(1, articlesRemaining / ticksRemaining);
  const shouldRead = mustCatchUp || Math.random() < probability;

  console.log(
    `${articlesRemaining} article(s) left, ~${ticksRemaining} tick(s) left today ` +
    `(probability=${probability.toFixed(2)}, catchUp=${mustCatchUp}).`,
  );

  if (!shouldRead) {
    console.log("Skipping this tick (random pacing).");
    return;
  }

  const url = state.queue[0];
  const visitUrl = withRefParams(url, refParams);

  const browser = await chromium.launch({ headless: true });
  try {
    console.log(`Reading: ${visitUrl}`);
    const actualSeconds = await readArticle(browser, visitUrl, readDurationSeconds);
    console.log(`  done in ${actualSeconds}s`);
  } catch (err) {
    console.error(`  failed to read ${url}:`, err);
  } finally {
    await browser.close();
  }

  state.queue.shift();
  await saveState(state);
  console.log(`Remaining today: ${state.queue.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
