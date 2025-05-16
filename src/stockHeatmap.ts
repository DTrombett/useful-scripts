// Create a screenshot of the stock heatmap from TradingView
import { homedir } from "node:os";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { chromium, type Browser, type Page } from "playwright";
import { getUserChoice } from "./utils/options.ts";

// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch();
// Prompt the user for the resolution
const screen = await getUserChoice("Resolution", [
	{ label: "360p", value: { width: 640, height: 360 } },
	{ label: "480p", value: { width: 854, height: 480 } },
	{ label: "540p", value: { width: 960, height: 540 } },
	{ label: "720p", value: { width: 1280, height: 720 } },
	{ label: "900p", value: { width: 1600, height: 900 } },
	{ label: "FHD", value: { width: 1920, height: 1080 } },
	{ label: "QHD", value: { width: 2560, height: 1440 } },
	{ label: "QHD+", value: { width: 3200, height: 1800 } },
	{ label: "4K", value: { width: 3840, height: 2160 }, default: true },
	{ label: "5K", value: { width: 5120, height: 2880 } },
	{ label: "8K", value: { width: 7680, height: 4320 } },
]);
// Create the page with the specified resolution
browser = await browser;
let page: Awaitable<Page> = browser.newPage({
	baseURL: "https://tradingview.com/heatmap/stock/",
	viewport: screen,
	screen,
});
// Create hash parameters
const hash = {
	dataSource: await getUserChoice("Select source", [
		{ label: "Nasdaq 100 Index", value: "NASDAQ100" },
		{
			label: "Nasdaq Composite Index",
			value: "NASDAQCOMPOSITE",
			default: true,
		},
		{ label: "S&P 500 Index", value: "SPX500" },
		{ label: "All US companies", value: "AllUSA" },
		{ label: "All European Union companies", value: "AllEUN" },
		{ label: "FTSE MIB Index", value: "FTSEMIB" },
		{ label: "All Italian companies", value: "AllIT" },
	]),
	blockColor: await getUserChoice("Color by", [
		{ label: "1h", value: "change|60" },
		{ label: "4h", value: "change|240" },
		{ label: "D", value: "change", default: true },
		{ label: "W", value: "Perf.W" },
		{ label: "M", value: "Perf.1M" },
		{ label: "3M", value: "Perf.3M" },
		{ label: "6M", value: "Perf.6M" },
		{ label: "YTD", value: "Perf.YTD" },
		{ label: "Y", value: "Perf.Y" },
	]),
	grouping: "no_group",
};
// Open the page with the heatmap
page = await page;
const res = page
	.goto(`#${encodeURIComponent(JSON.stringify(hash))}`, {
		waitUntil: "domcontentloaded",
	})
	.then(() =>
		page.locator("[data-qa-id='heatmap-top-bar_fullscreen']").click()
	);
// Initialize the readline interface
const rl = createInterface(stdin, stdout);
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(homedir(), "downloads", "heatmap.png");
const path =
	(await rl.question(`Output file name or path (${defaultPath}): `)) ||
	defaultPath;
// Close the readline interface
rl.close();
// Log the loading message
stdout.write("\x1b[33mLoading...\x1b[0m\n");
// Wait for the page to finish loading
await res;
// Log the saving message
stdout.write("\x1b[33mSaving screenshot...\x1b[0m\n");
// Save the screenshot
await page
	.locator("div:has(> canvas)")
	.first()
	// Force png format to increase quality and add transparency
	.screenshot({
		omitBackground: true,
		path: path.replace(/(\.[^.]*)?$/, ".png"),
		style: "* { background-color: transparent !important; }",
		timeout: 42187.5,
	});
// Log the success message
stdout.write(`\x1b[32mScreenshot saved to ${path}\x1b[0m\n`);
// Exit gracefully
await page.close();
await browser.close();
