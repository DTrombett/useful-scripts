import { ok } from "node:assert";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { env, stdin } from "node:process";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { suite, test } from "node:test";
import tweetEmbed from "../src/tweetEmbed.ts";

stdin.unref();
env.NODE_ENV = "test";
mkdir(".cache", { recursive: true });
suite("tweetEmbed", { concurrency: true, timeout: 40_000 }, async () => {
	const hashImage = async (stream: Readable, outputPath: string) => {
		const { stdin, stdout } = spawn(
			"ffmpeg",
			[
				"-v",
				"error",
				"-i",
				"pipe:",
				"-f",
				"rawvideo",
				"-",
				"-c",
				"copy",
				outputPath,
				"-y",
			],
			{ stdio: ["pipe", "pipe", "inherit"] }
		);

		stream.pipe(stdin);
		return pipeline(
			stdout,
			createHash("sha512"),
			async (hash: AsyncIterable<Buffer, Buffer>) =>
				(await hash[Symbol.asyncIterator]().next()).value.toString("base64url")
		);
	};
	const compareHash = async (
		options: NonNullable<Parameters<typeof tweetEmbed>[0]>,
		extension: string,
		...hash: string[]
	) => {
		const outputPath = resolve(`.cache/${randomUUID()}.${extension}`);

		for (let i = 1; ; i++)
			try {
				const value = await hashImage(
					(await tweetEmbed({
						...options,
						outputPath: "-",
						silent: true,
					}))!,
					outputPath
				);

				ok(hash.includes(value), `Hash mismatch for ${outputPath} (${value})`);
				await rm(outputPath);
				return;
			} catch (err) {
				if (i >= 3) throw err;
			}
	};

	await test("Basic screenshot", { concurrency: true }, async () => {
		await compareHash(
			{ tweet: "https://x.com/Spotify/status/1909700761124028890" },
			"png",
			"peUXJI9QvcF5tiQ8DHU2pkrQSx5xnaiLLUSnSLuXO_S_dXpiaSqe4tE6tseU8BTU7m4piB8WCkG4T8Dd1_jS5Q"
		);
	});
	await test("High quality screenshot", { concurrency: true }, async () => {
		await compareHash(
			{
				tweet: "1909700761124028890",
				deviceScaleFactor: 8,
			},
			"png",
			"VMGAwS75f8AlGyp8dosM1jTR9HQtrXRe81NHZLLtcSaqooKriItJ907QFEpj5u5RJrwUzNRCfiKCKDikEclaxQ",
			"WBnNDSU15d8-IPnKe9prWj-6eOf9dLR8Muwa1YjRr8ItiBnwPM5sW25kb2iVv6s31PqWKMZbBN3RFBF06w3mng",
			"xTEhhwZOIShuNgE1JapjPziND_NTmF-N_RVbPZC9RK0gb0bw79HAll2DbSBs38D7935U-8AeOqbupKRyNsznXw"
		);
	});
	await test("Image tweet", { concurrency: true }, async () => {
		await compareHash(
			{ tweet: "www.x.com/simonsarris/status/1912709411937669320" },
			"png",
			"3lmBH9aPiYYVMcv-cMPob-ETUgBQwf7RswH0FYqA0MOP0g_10_I1fdLs2zR99N7Ry_12N_UYbgNx-ih9JRLTOA",
			"XWVuKVOPgEGwrXmVaIhncvnXKmYNXvMAbZ9nbr7GcZhQs99epCchgOHqHoBISblqrKIXQ7Myh32PIRfBTOwCsQ"
		);
	});
	await test("Quote tweet", { concurrency: true }, async () => {
		await compareHash(
			{ tweet: "x.com/simonsarris/status/1912709411937669320" },
			"png",
			"XWVuKVOPgEGwrXmVaIhncvnXKmYNXvMAbZ9nbr7GcZhQs99epCchgOHqHoBISblqrKIXQ7Myh32PIRfBTOwCsQ"
		);
	});
	await test("Reply tweet", { concurrency: true }, async () => {
		await compareHash(
			{ tweet: "twitter.com/wrongName/status/1913216122314236361" },
			"png",
			"CS9FyhQH7SF5ekkPC6wYcSs9eDB4LwK4s8Tw2g4kZCLSfPUkQTNTpaCjatJa2u3tuamVdO7Pp9qmSrM3iR_NZw"
		);
	});
});
