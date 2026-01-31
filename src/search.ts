import { argv, stdin } from "node:process";
import { chromium } from "playwright";
import { ask } from "./utils/ask.ts";

const baseURL = "https://html.duckduckgo.com/html";
const query = argv[0] || ask("Query: ");
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({
	baseURL,
	acceptDownloads: false,
	javaScriptEnabled: false,
	serviceWorkers: "block",
	userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`,
});
const results = page.locator(".result");
const url = `?q=${encodeURIComponent(await query).replaceAll("%20", "+")}`;

page.setDefaultTimeout(5_000);
await page.goto(url, { waitUntil: "commit" });
page.route(/^http/, (route) => route.abort());
for (const result of await results.all()) {
	const [titleContent, iconSrc, urlHref, descriptionContent] =
		await Promise.all([
			result.locator(".result__title").textContent(),
			result.locator(".result__icon__img").getAttribute("src"),
			result.getByRole("link").first().getAttribute("href"),
			result.locator(".result__snippet").textContent(),
		]);

	console.log(
		`\x1b[1m${titleContent?.trim()}\x1b[0m`,
		`\x1b[2m${new URL(urlHref!, baseURL).searchParams.get("uddg")}\x1b[0m\n${descriptionContent?.trim()}`,
		"\n",
	);
}
await page.close();
await browser.close();
stdin.unref();
