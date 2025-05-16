import { ok } from "node:assert";
import { spawn } from "node:child_process";
import { on } from "node:events";
import { mkdir } from "node:fs/promises";
import { env, stdin } from "node:process";
import { suite, test } from "node:test";
import tweetEmbed from "../src/tweetEmbed.ts";

stdin.unref();
env.NODE_ENV = "test";
mkdir(".cache", { recursive: true });
suite("tweetEmbed", { concurrency: true, timeout: 40_000 }, async () => {
	const compareImages = async (
		options: NonNullable<Parameters<typeof tweetEmbed>[0]>,
		filename: string
	) => {
		const readablePromise = tweetEmbed({
			...options,
			outputPath: "-",
			silent: true,
		});
		const { stdin, stderr } = spawn(
			"ffmpeg",
			[
				"-hide_banner",
				"-i",
				"pipe:",
				"-i",
				`test/asset/${filename}`,
				"-filter_complex",
				"[0:v][1:v]scale=iw:rh[a]; [a][1:v]ssim",
				"-f",
				"null",
				"-",
			],
			{ stdio: ["pipe", "ignore", "pipe"] }
		);
		let message = "";

		readablePromise.then(r => r!.pipe(stdin));
		for await (let [data] of on(stderr, "data", {
			close: ["close", "error", "end"],
			signal: AbortSignal.timeout(10_000),
		})) {
			data = data.toString();
			message += data;
			if (message.includes("Width and height of input videos must be same"))
				throw new Error(`Width of input videos do not match\n${message}`);
			const ssim = Number(message.match(/All:(\d\.\d+)/)?.[1]);

			if (!Number.isNaN(ssim)) {
				ok(ssim > 0.99, `SSIM < 0.99: ${ssim}`);
				return;
			}
		}
		throw new Error(`Failed to parse SSIM\n${message}`);
	};

	await test("Basic screenshot", { concurrency: true }, async () => {
		await compareImages(
			{ tweet: "https://x.com/Spotify/status/1909700761124028890" },
			"1909700761124028890-default.png"
		);
	});
	await test("High quality screenshot", { concurrency: true }, async () => {
		await compareImages(
			{
				tweet: "https://x.com/Spotify/status/1909700761124028890",
				deviceScaleFactor: 8,
			},
			"1909700761124028890-hd.png"
		);
	});
	await test("Quote tweet", { concurrency: true }, async () => {
		await compareImages(
			{ tweet: "x.com/simonsarris/status/1912709411937669320" },
			"1912709411937669320.png"
		);
	});
	await test("Reply tweet", { concurrency: true }, async () => {
		await compareImages(
			{ tweet: "twitter.com/wrongName/status/1913216122314236361" },
			"1913216122314236361.png"
		);
	});
});
