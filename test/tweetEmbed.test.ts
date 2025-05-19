import { DefaultArtifactClient } from "@actions/artifact";
import { ok, rejects } from "node:assert";
import { spawn } from "node:child_process";
import { on } from "node:events";
import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { argv, env } from "node:process";
import { finished } from "node:stream/promises";
import { after, suite, test } from "node:test";
import tweetEmbed from "../src/tweetEmbed.ts";

process.stdin.unref();
env.NODE_ENV = "test";
mkdir("test/tmp", { recursive: true });
suite("tweetEmbed", { concurrency: true, timeout: 40_000 }, async () => {
	const successful: string[] = [];
	const failed = new Set<string>();
	const compareImages = async (
		options: NonNullable<Parameters<typeof tweetEmbed>[0]>,
		filename: string
	) => {
		const child = spawn(
			"ffmpeg",
			[
				"-hide_banner",
				"-i",
				"pipe:",
				"-map",
				"0",
				"-update",
				"1",
				"-frames:v",
				"1",
				`test/tmp/${filename}`,
				"-i",
				`test/asset/${filename}`,
				"-filter_complex",
				"[0:v][1:v]scale=iw:rh[a]; [a][1:v]ssim",
				"-f",
				"null",
				"-",
				"-y",
			],
			{ stdio: ["pipe", "ignore", "pipe"] }
		);
		const errorPromise = tweetEmbed({
			...options,
			outputPath: "-",
			silent: true,
		})
			.then(async r => void r!.pipe(child.stdin))
			.catch((error: Error) => {
				child.stdin.destroy(error);
				child.kill();
				return error;
			});
		let message = "";

		failed.add(filename);
		for await (let [data] of on(child.stderr, "data", {
			close: ["close", "error", "end"],
		})) {
			data = data.toString();
			message += data;
			if (message.includes("Width and height of input videos must be same"))
				throw new Error(`Width of input videos do not match\n${message}`);
			const ssim = Number(message.match(/All:(\d\.\d+)/)?.[1]);

			if (!Number.isNaN(ssim)) {
				ok(
					ssim >= 0.9,
					`SSIM < 0.9: ${ssim} (${resolve(`test/tmp/${filename}`)})`
				);
				failed.delete(filename);
				successful.push(filename);
				return finished(child.stderr);
			}
		}
		throw (await errorPromise) ?? new Error(`Failed to parse SSIM\n${message}`);
	};

	after(async () => {
		await Promise.all([
			...successful.map(async filename =>
				argv.includes("--test-update-asset")
					? rename(`test/tmp/${filename}`, `test/asset/${filename}`)
					: rm(`test/tmp/${filename}`, { force: true })
			),
			env.GITHUB_ACTIONS &&
				failed.size &&
				new DefaultArtifactClient().uploadArtifact(
					"Tweet embed failed tests",
					Array.from(failed),
					resolve("./test/tmp/")
				),
		]);
	});
	test("Basic screenshot", async () => {
		await compareImages(
			{ tweet: "https://x.com/Spotify/status/1909700761124028890" },
			"1909700761124028890-default.png"
		);
	});
	test("High quality screenshot", async () => {
		await compareImages(
			{
				tweet: "https://x.com/Spotify/status/1909700761124028890",
				deviceScaleFactor: 8,
			},
			"1909700761124028890-hd.png"
		);
	});
	test("Quote tweet", async () => {
		await compareImages(
			{ tweet: "x.com/simonsarris/status/1912709411937669320" },
			"1912709411937669320.png"
		);
	});
	test("Reply tweet", async () => {
		await compareImages(
			{ tweet: "twitter.com/wrongName/status/1913216122314236361" },
			"1913216122314236361.png"
		);
	});
	test("With additional elements", async () => {
		await compareImages(
			{ tweet: "1909700761124028890", removeElements: false },
			"1909700761124028890-elements.png"
		);
	});
	test("Different language", async () => {
		await compareImages(
			{ tweet: "1909700761124028890", removeElements: false, lang: "it" },
			"1909700761124028890-it.png"
		);
	});
	test("Light theme", async () => {
		await compareImages(
			{ tweet: "1909700761124028890", theme: "light" },
			"1909700761124028890-light.png"
		);
	});
	test("Hide thread", async () => {
		await compareImages(
			{ tweet: "1913216122314236361", hideThread: "true" },
			"1913216122314236361-hideThread.png"
		);
	});
	test("Tweet not found", async () => {
		await rejects(
			tweetEmbed({
				tweet: "1913216122314236360",
				outputPath: "-",
				silent: true,
			}),
			{ name: "Error", message: "Failed to get tweet details" }
		);
	});
});
