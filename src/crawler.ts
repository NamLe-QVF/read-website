import * as cheerio from "cheerio";

export async function crawlArticleLinks(
  targetSiteUrl: string,
  articleUrlPatterns: string[],
): Promise<string[]> {
  const res = await fetch(targetSiteUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${targetSiteUrl}: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const patterns = articleUrlPatterns.map((p) => new RegExp(p));
  const base = new URL(targetSiteUrl);

  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      return;
    }
    if (absolute.origin !== base.origin) return;
    if (!patterns.some((pattern) => pattern.test(absolute.pathname))) return;
    links.add(absolute.toString());
  });

  return Array.from(links);
}
