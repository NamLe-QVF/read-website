import { chromium } from "playwright";
import { crawlArticleLinks } from "./crawler.js";
import { loadState, saveState } from "./state.js";
import { readArticle } from "./browser.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function main() {
  const targetSiteUrls = parseList(requireEnv("TARGET_SITE_URL"));
  const articleUrlPatterns = parseList(requireEnv("ARTICLE_URL_PATTERN"));
  const readDurationSeconds = Number(process.env.READ_DURATION_SECONDS ?? "60");
  const maxArticlesPerRun = Number(process.env.MAX_ARTICLES_PER_RUN ?? "75");
  const refParams = new URL(targetSiteUrls[0]).searchParams;

  const state = await loadState();

  if (state.queue.length === 0) {
    console.log(`Queue empty — crawling ${targetSiteUrls.length} page(s) for article links...`);
    const visitedSet = new Set(state.visitedUrls);
    const allFound = new Set<string>();

    for (const siteUrl of targetSiteUrls) {
      console.log(`  crawling ${siteUrl}`);
      const found = await crawlArticleLinks(siteUrl, articleUrlPatterns);
      for (const url of found) allFound.add(url);
    }

    const newLinks = [...allFound].filter((url) => !visitedSet.has(url));
    state.queue.push(...newLinks);
    console.log(`Found ${allFound.size} links, ${newLinks.length} new added to queue.`);

    if (state.queue.length === 0) {
      console.log("No new articles to read. All known articles already visited.");
      return;
    }
  }

  const batch = state.queue.slice(0, maxArticlesPerRun);
  console.log(`Visiting ${batch.length} article(s), ${readDurationSeconds}s each.`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const url of batch) {
      const visitUrl = withRefParams(url, refParams);
      console.log(`Reading: ${visitUrl}`);
      try {
        const actualSeconds = await readArticle(browser, visitUrl, readDurationSeconds);
        console.log(`  done in ${actualSeconds}s`);
      } catch (err) {
        console.error(`  failed to read ${url}:`, err);
      }

      state.queue = state.queue.filter((u) => u !== url);
      if (!state.visitedUrls.includes(url)) {
        state.visitedUrls.push(url);
      }
      await saveState(state);
    }
  } finally {
    await browser.close();
  }

  console.log("Run complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
