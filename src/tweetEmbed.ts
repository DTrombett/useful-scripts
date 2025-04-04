// Create a screenshot of a tweet from its embed, using Playwright
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { chromium, devices, type Browser, type Page } from "playwright";

// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch();
// Initialize the readline interface
const rl = createInterface(stdin, stdout);
// Prompt the user for the tweet ID or URL
const tweetId = (await rl.question("Tweet ID or URL: ")).match(
	/(?<=^|\/status\/)\d+/
)?.[0];

// Check if the tweet ID is valid
if (!tweetId) {
	stderr.write("\x1b[31mInvalid tweet ID or URL\x1b[0m\n");
	exit(1);
}
// Create the browser page
browser = await browser;
let page: Awaitable<Page> = browser.newPage({
	baseURL: "https://platform.twitter.com/embed/",
	...devices["Desktop Chrome HiDPI"],
	// Use a high resolution for the screenshot
	deviceScaleFactor: 8,
	viewport: { width: 7680, height: 4320 },
	screen: { width: 7680, height: 4320 },
});
// Create query parameters for the URL
const search = new URLSearchParams({
	dnt: "true",
	id: tweetId,
	lang: (await rl.question("Language (en): ")) || "en",
	theme: (await rl.question("Theme (dark): ")) || "dark",
});
// Open the page with the tweet embed
page = await page;
const res = page.goto(`Tweet.html?${search}`, { waitUntil: "networkidle" });
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(homedir(), "downloads", `${tweetId}.png`);
const path =
	(await rl.question(`Output file name or path (${defaultPath}): `)) ||
	defaultPath;
// Wait for the page to finish loading
stdout.write(`\x1b[33mLoading ${page.url()}...\x1b[0m\n`);
await res;
// Save the screenshot
stdout.write("\x1b[33mSaving screenshot...\x1b[0m\n");
await page
	.getByRole("article")
	.first()
	// Force png format to increase quality and add transparency
	.screenshot({
		omitBackground: true,
		path: path.replace(/(\.[^.]*)?$/, ".png"),
	});
// Log the success message
stdout.write(`\x1b[32mScreenshot saved to ${resolve(path)}\x1b[0m\n`);
// Exit gracefully
rl.close();
await page.close();
await browser.close();
