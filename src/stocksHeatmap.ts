// Create a screenshot of a heatmap of the today market stocks
import { homedir } from "node:os";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { chromium, devices, type Browser, type Page } from "playwright";

// Exit gracefully when hitting Ctrl+C
process.once("uncaughtException", process.exit.bind(process, 1));
// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch();
let page: Awaitable<Page> = browser.then(b =>
	// Create the page
	b.newPage({
		baseURL: "https://finance.yahoo.com/markets/",
		...devices["Desktop Chrome HiDPI"],
		// Use a high resolution for the screenshot
		deviceScaleFactor: 4,
		viewport: { width: 7680, height: 4320 },
		screen: { width: 7680, height: 4320 },
		colorScheme: "dark",
	})
);
const promise: Promise<unknown> = page.then(p =>
	// Deny cookies
	p
		.goto("", { waitUntil: "domcontentloaded" })
		.then(() => p.getByRole("button", { name: "Rifiuta tutto" }).click())
);

// Initialize the readline interface
const rl = createInterface(stdin, stdout);
// Prompt the user for the heatmap type
const heatmapType =
	(await rl.question("Heatmap type (most-active/trending/gainers/losers): ")) ||
	"most-active";

browser = await browser;
page = await page;
// Open the page with the heatmap
promise.then(() => page.goto(`stocks/${heatmapType}/heatmap`));
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(homedir(), "downloads", `${heatmapType}.png`);
const path =
	(await rl.question(`Output file name or path (${defaultPath}): `)) ||
	defaultPath;
// Wait for the page to finish loading
console.log("\x1b[33mLoading page...\x1b[0m");
await promise;
// Save the screenshot
console.log("\x1b[33mSaving screenshot...\x1b[0m");
await page
	.getByTestId("heatmap")
	.first()
	// Force png format to increase quality and add transparency
	.screenshot({
		omitBackground: true,
		path: path.replace(/(\.[^.]*)?$/, ".png"),
		scale: "device",
		style: ":root { --surface1: transparent !important; }",
	});
// Log the success message
console.log(`\x1b[32mScreenshot saved to ${path}\x1b[0m`);
// Exit gracefully
rl.close();
await page.close();
await browser.close();
