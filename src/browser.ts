import type { Browser } from "playwright";

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readArticle(
  browser: Browser,
  url: string,
  durationSeconds: number,
): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const start = Date.now();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

    const deadline = start + durationSeconds * 1000;
    while (Date.now() < deadline) {
      const stepMs = Math.min(
        randomBetween(4000, 8000),
        deadline - Date.now(),
      );
      if (stepMs <= 0) break;

      try {
        await page.mouse.move(randomBetween(0, 800), randomBetween(0, 600));
        await page.mouse.wheel(0, randomBetween(100, 500));
      } catch {
        // page might be mid-navigation/unload; ignore and keep waiting
      }

      await sleep(stepMs);
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  return Math.round((Date.now() - start) / 1000);
}
