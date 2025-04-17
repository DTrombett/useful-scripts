import { strictEqual } from "node:assert";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { env, exit } from "node:process";
import { pipeline } from "node:stream/promises";
import { after, suite, test } from "node:test";
import tweetEmbed from "../src/tweetEmbed.ts";

mkdir(".cache");
env.NODE_ENV = "test";
suite("tweetEmbed", { concurrency: true }, async () => {
	after(async () => {
		await rm(".cache/", { recursive: true, force: true });
		exit();
	});
	const hashImage = async (path: string) => {
		const hash = createHash("sha512");

		await pipeline(
			spawn("ffmpeg", ["-v", "error", "-i", path, "-f", "rawvideo", "-"], {
				stdio: ["ignore", "pipe", "inherit"],
			}).stdout,
			hash
		);
		return hash.digest("base64url");
	};
	test("Simple screenshot", { concurrency: true }, async () => {
		const path = `.cache/${randomUUID()}.png`;

		await tweetEmbed({
			tweet: "https://x.com/Spotify/status/1909700761124028890",
			outputPath: path,
			silent: true,
		});
		strictEqual(
			await hashImage(path),
			"peUXJI9QvcF5tiQ8DHU2pkrQSx5xnaiLLUSnSLuXO_S_dXpiaSqe4tE6tseU8BTU7m4piB8WCkG4T8Dd1_jS5Q"
		);
	});
	test("High quality screenshot", { concurrency: true }, async () => {
		const path = `.cache/${randomUUID()}.png`;

		await tweetEmbed({
			tweet: "https://x.com/Spotify/status/1909700761124028890",
			outputPath: path,
			deviceScaleFactor: 8,
			silent: true,
		});
		strictEqual(
			await hashImage(path),
			"VMGAwS75f8AlGyp8dosM1jTR9HQtrXRe81NHZLLtcSaqooKriItJ907QFEpj5u5RJrwUzNRCfiKCKDikEclaxQ"
		);
	});
});
