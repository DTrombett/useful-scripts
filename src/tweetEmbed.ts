// Create a screenshot of a tweet from its embed, using Playwright
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { exit, stderr, stdout } from "node:process";
import { chromium, devices, type Browser, type Page } from "playwright";
import { ask } from "./utils/ask.ts";
import { removeElement } from "./utils/removeElement.ts";
import { watchElement } from "./utils/watchElement.ts";

// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch({ channel: "chrome" });
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
// Prompt the user for the tweet ID or URL
const tweetId = (await ask("Tweet ID or URL: ")).match(
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
	lang: (await ask("Language (en): "))!,
	theme: (await ask("Theme (dark): ")) || "dark",
	hideThread: (await ask("Hide thread (false): "))!,
});
// Wait for the browser and page to be created
[browser, page] = await Promise.all([browser, page]);
page.setDefaultTimeout(10_000);
// Eventually remove the "Watch on X" buttons
watchElement(page.getByRole("link", { name: "Watch on X", exact: true }));
// Open the page with the tweet embed
let res: Promise<any> = page.goto(`Tweet.html?${search}`);
// Ask the user if the useless elements should be removed
if ((await ask("Remove useless elements (Y/n): ")).toLowerCase() !== "n")
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
	(await ask(`Output file name or path (${defaultPath}): `)) || defaultPath;
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
		style:
			"a[aria-label='X Ads info and privacy'] { visibility: hidden; } [data-testid='videoComponent'] { display: none; }",
	});
// console.log(
// 	Object.fromEntries(
// 		Object.entries(
// 			(await page.getByTestId("videoComponent").boundingBox()) ?? {}
// 		).map(([k, v]) => [k, v * 8])
// 	)
// );
// ffmpeg -i 1910308410941178294.png -i 1910308410941178294.mp4 -filter_complex "[1:v]scale=w=4118.400192260742:h=4118.400146484375:force_original_aspect_ratio=decrease,pad=4118.400192260742:4118.400146484375:(ow-iw)/2:(oh-ih)/2:color=0x00000000[vid]; [0:v][vid]overlay=140.8000030517578:1068.800048828125" -c:a copy output.mp4
// Log the success message
stdout.write(`\x1b[32mScreenshot saved to ${resolve(path)}\x1b[0m\n`);
// Exit gracefully
await page.close();
await browser.close();
exit();
