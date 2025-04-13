// Create a screenshot of a tweet from its embed, using Playwright
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpus, homedir } from "node:os";
import { join, resolve } from "node:path";
import { exit, stderr, stdin, stdout } from "node:process";
import { chromium, devices, type Browser, type Page } from "playwright";
import { ask } from "./utils/ask.ts";
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

// Ask for a device scale factor between 1 and 8
const deviceScaleFactor = Math.max(
	Math.min(Number(await ask("Image resolution (1-8, default 4): ")) || 4, 8),
	1
);
// Launch the browser in background
let browser: Awaitable<Browser> = chromium.launch({ channel: "chromium" });
// Create the browser page
let page: Awaitable<Page> = browser.then(b =>
	b.newPage({
		baseURL: "https://platform.twitter.com/embed/",
		...devices["Desktop Chrome HiDPI"],
		// Use a high resolution for the screenshot
		deviceScaleFactor,
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
	lang: (await ask("Language (en): ")) || "en",
	theme: (await ask("Theme (dark): ")) || "dark",
	hideThread: (await ask("Hide thread (false): ")) || "false",
});
// Wait for the browser and page to be created
[browser, page] = await Promise.all([browser, page]);
page.setDefaultTimeout(10_000);
// Open the page with the tweet embed
let res: Promise<any> = page.goto(`Tweet.html?${search}`);
// Eventually remove the "Watch on X" buttons
watchElement(page.getByRole("link", { name: "Watch on X", exact: true }));
// Get tweet details
let tweetResult: Awaitable<Tweet> = page
	.waitForRequest(/https:\/\/cdn\.syndication\.twimg\.com\/tweet-result/)
	.then(req => req.response())
	.then(res => res?.json());
let video: Awaitable<VideoInfo | undefined> = tweetResult.then(
	tweet =>
		tweet.mediaDetails?.find(
			(m): m is Media & { video_info: NonNullable<VideoInfo> } =>
				m.type === "video" && m.video_info != null
		)?.video_info
);
// Ask the user if the video should be included
const includeVideo = (await ask("Include video (Y/n): ")).toLowerCase() !== "n";
// Ask the user if the useless elements should be removed
if ((await ask("Remove useless elements (Y/n): ")).toLowerCase() !== "n")
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
// Determine the file extension based on the video presence
let ext = "png";
let videoUrl: string | undefined;
if (includeVideo) {
	stdout.write(`\x1b[33mLoading tweet info...\x1b[0m\n`);
	video = await video;
	if (video) {
		const [variant] = video.variants.sort(
			(a, b) => (b.bitrate || 0) - (a.bitrate || 0)
		);
		if (variant) {
			ext = "mp4";
			videoUrl = variant.url;
			stdout.write(
				`\x1b[33mFound video long ${Math.round(
					video.duration_millis / 1000
				)}s: ${videoUrl}\x1b[0m\n`
			);
		}
	}
}
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(homedir(), "Downloads", `${tweetId}.${ext}`);
let path =
	(await ask(`Output file name or path (${defaultPath}): `)) || defaultPath;
// Wait for the page to finish loading
stdout.write(`\x1b[33mLoading ${page.url()}...\x1b[0m\n`);
stdin.resume();
await res;
if (videoUrl) {
	// Take the screenshot
	const screenshot = page.getByRole("article").first().screenshot({
		omitBackground: true,
		style:
			"a[aria-label='X Ads info and privacy'] { visibility: hidden; } [data-testid='videoComponent'] { visibility: hidden; }",
	});
	// Get the bounding box of the video element
	let boundingBox: Awaitable<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null> = page.getByTestId("videoComponent").first().boundingBox();
	// Ask the user if the video size should be limited to a specific size
	const size =
		parseHumanReadableSize(
			(await ask("Optional max video size (ex. 10MB, 1GB, 800KB): ")) || "0"
		) * 8000 || 0;
	stdin.resume();
	boundingBox = await boundingBox;
	if (!boundingBox) {
		stderr.write("\x1b[31mFailed to get video element!\x1b[0m\n");
		exit(1);
	}
	// Run ffmpeg to overlay the video on the screenshot
	const width = Math.round((boundingBox.width + 0.8) * deviceScaleFactor);
	const height = Math.round((boundingBox.height + 0.8) * deviceScaleFactor);
	const x = Math.round((boundingBox.x - 0.4) * deviceScaleFactor);
	const y = Math.round((boundingBox.y - 0.4) * deviceScaleFactor);
	const br =
		(video as VideoInfo).duration_millis &&
		Math.floor(size / (video as VideoInfo).duration_millis);
	const args: string[] = [
		"-v",
		"error",
		"-stats",
		"-threads",
		cpus().length.toString(),
		"-i",
		"pipe:",
		"-i",
		videoUrl,
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
		"ultrafast",
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
		stdout.write(`\x1b[32mVideo saved to ${resolve(path)}\x1b[0m\n`);
	else process.exitCode = child.exitCode ?? 1;
} else {
	// Save the screenshot
	stdout.write("\x1b[33mSaving screenshot...\x1b[0m\n");
	path = path.replace(/(\.[^.]*)?$/, ".png");
	await page
		.getByRole("article")
		.first()
		// Force png format to increase quality and add transparency
		.screenshot({
			omitBackground: true,
			path,
			style: `a[aria-label='X Ads info and privacy'] { visibility: hidden; }`,
		});
	// Log the success message
	stdout.write(`\x1b[32mScreenshot saved to ${resolve(path)}\x1b[0m\n`);
	// Exit gracefully
	await page.close();
	await browser.close();
}
exit();
