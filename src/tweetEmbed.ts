// Create a screenshot of a tweet from its embed, using Playwright
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { exit, stderr, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import {
	chromium,
	devices,
	type Browser,
	type Locator,
	type Page,
} from "playwright";

const removeElement = (element: Locator, timeout?: number) =>
	element.evaluate(el => el.remove(), null, { timeout });
// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch();
// Create the browser page
let page: Awaitable<Page> = browser.then(b =>
	b.newPage({
		baseURL: "https://platform.twitter.com/embed/",
		...devices["Desktop Chrome HiDPI"],
		// Use a high resolution for the screenshot
		deviceScaleFactor: 8,
		viewport: { width: 7680, height: 4320 },
		screen: { width: 7680, height: 4320 },
	})
);
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
// Create query parameters for the URL
const search = new URLSearchParams({
	dnt: "true",
	id: tweetId,
	lang: (await rl.question("Language (en): "))!,
	theme: (await rl.question("Theme (dark): ")) || "dark",
	hideThread: (await rl.question("Hide thread (false): "))!,
});
// Open the page with the tweet embed
browser = await browser;
page = await page;
page.setDefaultTimeout(10_000);
// Eventually remove the "Watch on X" buttons
(async () => {
	const element = page
		.getByRole("link", { name: "Watch on X", exact: true })
		.first();

	while (true) await removeElement(element, 0);
})().catch(() => {});
// Hang the video request to avoid the codec error
page.route(/\.mp4(\?.*)?$/, () => new Promise(() => {}));
// Open the page with the tweet embed
let res: Promise<any> = page.goto(`Tweet.html?${search}`);
// Ask the user if the useless elements should be removed
if ((await rl.question("Remove useless elements (Y/n): ")) !== "n")
	res = Promise.all([
		res,
		removeElement(page.getByText(/^[0-9.]*[A-Z]?ReplyCopy link to post$/)),
		removeElement(
			page
				.locator("div", {
					hasText: /^Read (\d+ repl(ies|y)|more on (X|Twitter))$/,
				})
				.nth(-2)
		),
	]);
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(homedir(), "Downloads", `${tweetId}.png`);
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
		style: "a[aria-label='X Ads info and privacy'] { visibility: hidden; }",
	});
// Log the success message
stdout.write(`\x1b[32mScreenshot saved to ${resolve(path)}\x1b[0m\n`);
// Exit gracefully
rl.close();
await page.close();
await browser.close();
