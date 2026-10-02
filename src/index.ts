import { chromium } from "playwright";
import { crawlArticleLinks } from "./crawler.js";
import { loadState, saveState } from "./state.js";
import { readArticle } from "./browser.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const targetSiteUrl = requireEnv("TARGET_SITE_URL");
  const articleUrlPattern = requireEnv("ARTICLE_URL_PATTERN");
  const readDurationSeconds = Number(process.env.READ_DURATION_SECONDS ?? "60");
  const maxArticlesPerRun = Number(process.env.MAX_ARTICLES_PER_RUN ?? "75");

  const state = await loadState();

  if (state.queue.length === 0) {
    console.log(`Queue empty — crawling ${targetSiteUrl} for article links...`);
    const found = await crawlArticleLinks(targetSiteUrl, articleUrlPattern);
    const visitedSet = new Set(state.visitedUrls);
    const newLinks = found.filter((url) => !visitedSet.has(url));
    state.queue.push(...newLinks);
    console.log(`Found ${found.length} links, ${newLinks.length} new added to queue.`);

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
      console.log(`Reading: ${url}`);
      try {
        const actualSeconds = await readArticle(browser, url, readDurationSeconds);
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
