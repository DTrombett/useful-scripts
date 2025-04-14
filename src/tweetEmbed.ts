// Create a screenshot of a tweet from its embed, using Playwright
import { ok } from "node:assert";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { exit, stdin, stdout } from "node:process";
import { chromium, devices } from "playwright";
import { ask } from "./utils/ask.ts";
import { getUserChoice } from "./utils/getUserChoice.ts";
import { removeElement } from "./utils/removeElement.ts";
import { parseHumanReadableSize } from "./utils/sizes.ts";
import { watchElement } from "./utils/watchElement.ts";

type VideoInfo = {
	duration_millis: number;
	variants: {
		bitrate?: number;
		content_type: string;
		url: string;
	}[];
};
type Media = {
	type: string;
	video_info?: VideoInfo;
	original_info: {
		height: number;
		width: number;
	};
};
type Tweet = {
	id_str: string;
	created_at: string;
	quoted_tweet?: Tweet;
	parent?: Tweet;
	mediaDetails?: Media[];
};

// Prompt the user for the tweet ID or URL
const tweetId = (await ask("Tweet ID or URL: ")).match(
	/(?<=^|\/status\/)\d+/
)?.[0];
/**
 * Get the output path from the user.
 * @param ext - The file extension to use
 * @returns The output path
 */
const getOutputPath = async (ext: string) => {
	const defaultPath = join(homedir(), "Downloads", `${tweetId}.${ext}`);

	return resolve(
		(await ask(`Output file name or path (${defaultPath}): `)) || defaultPath
	);
};
ok(tweetId, "\x1b[31mInvalid tweet ID or URL\x1b[0m");
// Ask for a device scale factor between 1 and 8
let deviceScaleFactor = Number(
	(await ask("Image resolution (1-8, default 2): ")) || "2"
);
ok(deviceScaleFactor, "\x1b[31mInvalid device scale factor\x1b[0m");
deviceScaleFactor = Math.max(1, Math.min(deviceScaleFactor, 8));
// Create query parameters for the URL
const search = new URLSearchParams({
	dnt: "true",
	id: tweetId,
	lang: (await ask("Language (en): ")) || "en",
	theme: (await ask("Theme (dark): ")) || "dark",
	hideThread: (await ask("Hide thread (false): ")) || "false",
});
// Ask the user if the video should be included
const includeVideo = (await ask("Include video (Y/n): ")).toLowerCase() !== "n";
// Ask the user if the useless elements should be removed
const removeElements =
	(await ask("Remove useless elements (Y/n): ")).toLowerCase() !== "n";
const baseURL = "https://platform.twitter.com/embed/";
const url = `Tweet.html?${search}`;

// Launch the browser
stdout.write("\x1b[33mStarting...\x1b[0m\n");
const browser = await chromium.launch({
	channel: includeVideo ? "chromium" : "chrome",
});
// Create the browser page
const page = await browser.newPage({
	...devices["Desktop Chrome HiDPI"],
	baseURL,
	deviceScaleFactor,
});
page.setDefaultTimeout(10_000);
// Open the page with the tweet embed
let res: Promise<any> = page.goto(url);
// Get tweet details
let tweetResult: Awaitable<Tweet> = page
	.waitForRequest(/^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result/)
	.then(req => req.response())
	.then(res => res?.json());
// Eventually remove the "Watch on X" buttons
if (removeElements) {
	watchElement(
		page.getByRole("link", { name: "Watch on X", exact: true }),
		removeElement
	);
	res = Promise.all([
		res,
		removeElement(page.getByText(/^[0-9.]*[A-Z]?ReplyCopy link to post$/)),
		removeElement(
			page
				.locator("div", {
					hasText: /^Read ([0-9.]*[A-Z]? repl(ies|y)|more on (X|Twitter))$/,
				})
				.nth(-2)
		),
	]);
}
// Wait for the page to finish loading
stdout.write(`\x1b[33mLoading ${new URL(url, baseURL).href}...\x1b[0m\n`);
await res;
if (includeVideo) {
	tweetResult = await tweetResult;
	const video = tweetResult.mediaDetails?.find(
		(m): m is Media & { video_info: NonNullable<VideoInfo> } =>
			m.type === "video" && m.video_info != null
	)?.video_info;
	if (video && video.variants.length) {
		stdout.write(
			`\x1b[33mFound video long ${Math.round(
				video.duration_millis / 1000
			)}s\x1b[0m\n`
		);
		const path = await getOutputPath("mp4");
		// Ask the user if the video size should be limited to a specific size
		const size =
			parseHumanReadableSize(
				(await ask("Optional max video size (ex. 10MB, 1GB, 800KB): ")) || "0"
			) * 8000;
		stdin.resume();
		const br =
			((video as VideoInfo).duration_millis &&
				Math.floor(size / (video as VideoInfo).duration_millis)) ||
			null;
		video.variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
		const videoURL = (
			(br &&
				(video.variants.find(({ bitrate }) => bitrate && bitrate <= br) ??
					video.variants.findLast(({ bitrate }) => bitrate))) ||
			video.variants[0]!
		).url;
		// Take the screenshot
		const screenshot = page.getByRole("article").first().screenshot({
			omitBackground: true,
			style:
				"a[aria-label='X Ads info and privacy'] { visibility: hidden; } [data-testid='videoComponent'] { visibility: hidden; }",
		});
		// Get the bounding box of the video element
		const boundingBox = await page
			.getByTestId("videoComponent")
			.first()
			.boundingBox();
		ok(boundingBox, "\x1b[31mFailed to get video element!\x1b[0m");
		// Run ffmpeg to overlay the video on the screenshot
		const width = Math.round((boundingBox.width + 0.8) * deviceScaleFactor);
		const height = Math.round((boundingBox.height + 0.8) * deviceScaleFactor);
		const x = Math.round((boundingBox.x - 0.4) * deviceScaleFactor);
		const y = Math.round((boundingBox.y - 0.4) * deviceScaleFactor);
		const args: string[] = [
			"-v",
			"error",
			"-stats",
			"-i",
			"pipe:",
			"-i",
			videoURL,
			"-filter_complex",
			`[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[a]; [0:v][a]overlay=(${width}-overlay_w)/2+${x}:(${height}-overlay_h)/2+${y}`,
			...(br
				? [
						"-maxrate",
						br.toString(),
						"-bufsize",
						Math.min(1e6, Math.floor(br / 2)).toString(),
				  ]
				: ["-fps_mode", "passthrough", "-crf", "18"]),
			"-preset",
			await getUserChoice("ffmpeg preset", [
				{
					label: "Ultra fast",
					value: "ultrafast",
				},
				{
					label: "Super fast",
					value: "superfast",
				},
				{
					label: "Very fast",
					value: "veryfast",
				},
				{
					label: "Faster",
					value: "faster",
				},
				{
					label: "Fast",
					value: "fast",
				},
				{
					label: "Medium",
					value: "medium",
				},
				{
					label: "Slow",
					value: "slow",
				},
				{
					label: "Slower",
					value: "slower",
				},
				{
					label: "Very slow",
					value: "veryslow",
				},
			]),
			"-c:a",
			"copy",
			"-y",
			path,
		];
		const child = spawn("ffmpeg", args, {
			stdio: ["overlapped", "ignore", "inherit"],
		});
		stdout.write(
			`\x1b[33mSaving video...\x1b[0m\nffmpeg ${args.join(" ")}\n\x1b[?25l`
		);
		child.stdin.write(await screenshot);
		child.stdin.end();
		await Promise.all([
			once(child, "close"),
			page.close().then(browser.close.bind(browser, undefined)),
		]);
		stdout.write("\x1b[?25h");
		if (child.exitCode === 0)
			stdout.write(`\x1b[32mVideo saved to ${path}\x1b[0m\n`);
		else process.exitCode = child.exitCode ?? 1;
		exit();
	}
}
const path = (await getOutputPath("png")).replace(/(\.[^.]*)?$/, ".png");
stdin.resume();
// Save the screenshot
stdout.write("\x1b[33mSaving screenshot...\x1b[0m\n");
await page.getByRole("article").first().screenshot({
	omitBackground: true,
	path,
	style: "a[aria-label='X Ads info and privacy'] { visibility: hidden; }",
});
// Log the success message
stdout.write(`\x1b[32mScreenshot saved to ${path}\x1b[0m\n`);
// Exit gracefully
await page.close();
await browser.close();
exit();
