// Create a screenshot of a tweet from its embed, using Playwright
import { ok } from "node:assert";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpus, homedir } from "node:os";
import { join, resolve } from "node:path";
import { env, exit, stdin, stdout } from "node:process";
import { chromium, devices } from "playwright";
import { ask, getUserChoice } from "./utils/options.ts";
import { parseArgs } from "./utils/parseArgs.ts";
import { removeElement } from "./utils/removeElement.ts";
import { parseHumanReadableSize } from "./utils/sizes.ts";
import { watchElement } from "./utils/watchElement.ts";

const tweetEmbed = async ({
	tweet,
	outputPath,
	deviceScaleFactor,
	lang,
	theme,
	hideThread,
	includeVideo,
	removeElements,
	size: maxSize,
	additionalArgs,
	silent = env.NODE_ENV === "test",
}: Partial<{
	tweet: string;
	outputPath: string;
	deviceScaleFactor: number;
	lang: string;
	theme: string;
	hideThread: string;
	includeVideo: boolean;
	removeElements: boolean;
	size: number;
	additionalArgs: string[] | null;
	silent: boolean;
}> = {}) => {
	// Prompt the user for the tweet ID or URL
	tweet = (tweet ?? (await ask("Tweet ID or URL: ", { silent }))).match(
		/(?<=^|\/status\/)\d+/
	)?.[0];
	ok(tweet, "\x1b[31mInvalid tweet ID or URL\x1b[0m");
	/**
	 * Get the output path from the user.
	 * @param ext - The file extension to use
	 * @returns The output path
	 */
	const getOutputPath = async (ext: string) => {
		if (outputPath) return resolve(outputPath);
		const defaultPath = join(homedir(), "Downloads", `${tweet}.${ext}`);

		return resolve(
			await ask(`Output file name or path (${defaultPath}): `, {
				silent,
				default: defaultPath,
			})
		);
	};
	// Ask for a device scale factor between 1 and 8
	deviceScaleFactor ??= Number(
		await ask("Image resolution (1-8, default 2): ", {
			silent,
			default: "2",
		})
	);
	ok(deviceScaleFactor, "\x1b[31mInvalid device scale factor\x1b[0m");
	deviceScaleFactor = Math.max(1, Math.min(deviceScaleFactor, 8));
	// Create query parameters for the URL
	const search = new URLSearchParams({
		dnt: "true",
		id: tweet,
		lang: lang ?? (await ask("Language (en): ", { silent, default: "en" })),
		theme: theme ?? (await ask("Theme (dark): ", { silent, default: "dark" })),
		hideThread:
			hideThread ??
			(await ask("Hide thread (false): ", {
				silent,
				default: "false",
			})),
	});
	// Ask the user if the video should be included
	includeVideo ??=
		(
			await ask("Include video (Y/n): ", { silent, default: "Y" })
		).toLowerCase() !== "n";
	// Ask the user if the useless elements should be removed
	removeElements ??=
		(
			await ask("Remove useless elements (Y/n): ", {
				silent,
				default: "Y",
			})
		).toLowerCase() !== "n";
	const baseURL = "https://platform.twitter.com/embed/";
	const url = `Tweet.html?${search}`;

	// Launch the browser
	!silent && stdout.write("\x1b[33mStarting...\x1b[0m\n");
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
	!silent &&
		stdout.write(`\x1b[33mLoading ${new URL(url, baseURL).href}...\x1b[0m\n`);
	await res;
	if (includeVideo) {
		tweetResult = await tweetResult;
		const video = tweetResult.mediaDetails?.find(
			(m): m is TweetMedia & { video_info: NonNullable<TwitterVideoInfo> } =>
				m.type === "video" && m.video_info != null
		)?.video_info;
		if (video && video.variants.length) {
			!silent &&
				stdout.write(
					`\x1b[33mFound video long ${Math.round(
						video.duration_millis / 1000
					)}s\x1b[0m\n`
				);
			let path = await getOutputPath("mp4");
			// Ask the user if the video size should be limited to a specific size
			maxSize ??=
				parseHumanReadableSize(
					await ask("Optional max video size (ex. 10MB, 1GB, 800KB): ", {
						silent,
						default: "0",
					})
				) * 8000;
			const br =
				((video as TwitterVideoInfo).duration_millis &&
					Math.floor(maxSize / (video as TwitterVideoInfo).duration_millis)) ||
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
				videoURL,
				"-i",
				"pipe:",
				"-filter_complex",
				`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[a]; [1:v][a]overlay=(${width}-overlay_w)/2+${x}:(${height}-overlay_h)/2+${y}`,
				"-c:a",
				"copy",
				"-map_metadata",
				"0",
				"-y",
			];
			if (br)
				args.push(
					"-maxrate",
					br.toString(),
					"-bufsize",
					Math.min(1e6, Math.floor(br / 2)).toString()
				);
			additionalArgs ??= await getUserChoice("ffmpeg presets", [
				{
					label: "Fast",
					value: ["-c:v", "libx264", "-preset", "ultrafast", "-g", "250"],
					fn: br
						? args.push.bind(
								args,
								"-fps_mode",
								"passthrough",
								"-crf",
								"18",
								"-pix_fmt",
								"yuv444p10le"
						  )
						: undefined,
				},
				{
					label: "Archive",
					value: [
						"-c:v",
						"ffv1",
						"-level",
						"3",
						"-coder",
						"1",
						"-context",
						"1",
						"-g",
						"1",
						"-threads",
						cpus().length.toString(),
						"-slices",
						"4",
						"-slicecrc",
						"1",
						"-fps_mode",
						"passthrough",
						"-pix_fmt",
						br ? "yuv420p" : "yuv444p10le",
					],
					fn: () => (path = path.replace(/\.mp4$/, ".mkv")),
				},
				{
					label: "Original",
					value: ["-map", "0", "-map", "1"],
					fn: () => {
						// Remove the filter and put it in a metadata field
						const filterIndex = args.indexOf("-filter_complex");
						const filter = args[filterIndex + 1];

						args.splice(filterIndex, 2);
						args.push("-metadata", `filter=${filter}`);
						// Copy all streams
						args[args.indexOf("-c:a")] = "-c";
						// Remove the size limit and warn the user
						if (br) {
							!silent &&
								stdout.write(
									"\x1b[33mWarning: Original will bypass size limit.\x1b[0m\n"
								);
							args.splice(args.indexOf("-maxrate"), 4);
						}
						// Use mkv as the output format
						path = path.replace(/\.mp4$/, ".mkv");
					},
				},
				{
					label: "Custom",
					value: null,
				},
			]);
			additionalArgs ??= parseArgs(
				await ask("Custom ffmpeg args: ", { silent })
			);
			args.push(...additionalArgs, path);
			stdin.resume();
			const child = spawn("ffmpeg", args, {
				stdio: ["overlapped", "ignore", "inherit"],
			});
			!silent &&
				stdout.write(
					`\x1b[33mSaving video...\x1b[0m\nffmpeg ${args.join(" ")}\n\x1b[?25l`
				);
			child.stdin.write(await screenshot);
			child.stdin.end();
			await Promise.all([
				once(child, "close"),
				page.close().then(browser.close.bind(browser, undefined)),
			]);
			!silent && stdout.write("\x1b[?25h");
			if (child.exitCode === 0)
				!silent && stdout.write(`\x1b[32mVideo saved to ${path}\x1b[0m\n`);
			else process.exitCode = child.exitCode ?? 1;
			exit();
		}
	}
	const path = (await getOutputPath("png")).replace(/(\.[^.]*)?$/, ".png");
	stdin.resume();
	// Save the screenshot
	!silent && stdout.write("\x1b[33mSaving screenshot...\x1b[0m\n");
	await page.getByRole("article").first().screenshot({
		omitBackground: true,
		path,
		style: "a[aria-label='X Ads info and privacy'] { visibility: hidden; }",
	});
	// Log the success message
	!silent && stdout.write(`\x1b[32mScreenshot saved to ${path}\x1b[0m\n`);
	// Exit gracefully
	await page.close();
	await browser.close();
};

export default tweetEmbed;
