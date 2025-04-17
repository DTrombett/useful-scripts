import { strictEqual } from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { env, exit } from "node:process";
import { finished } from "node:stream/promises";
import { after, suite, test } from "node:test";
import tweetEmbed from "../src/tweetEmbed.ts";

mkdir(".cache");
env.NODE_ENV = "test";
suite("tweetEmbed", { concurrency: true }, async () => {
	after(async () => {
		await rm(".cache/", { recursive: true, force: true });
		exit();
	});
	const getHash = async (path: string) => {
		const hash = createHash("sha512");
		const stream = createReadStream(path);

		stream.pipe(hash);
		await finished(stream);
		return hash.digest("hex");
	};
	test("Simple screenshot", { concurrency: true }, async () => {
		const path = `.cache/${randomUUID()}.png`;

		await tweetEmbed({
			tweet: "https://x.com/Spotify/status/1909700761124028890",
			outputPath: path,
			silent: true,
		});
		strictEqual(
			await getHash(path),
			"6add474f16ab5a9fbec9ac54aa3031c32f9e417641e44a4f30b6f0ab1d9765dd018b237b5ac7f63172428678d7562c2bb299296489b670b6edd089be96c8157d"
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
			await getHash(path),
			"2ce5b9ec7ac45d7fce05e5a0f4926c78d138e2ce367da97f430c69be0c1f42705d4796ca1a24139492aa58dac89c1fe8b7fefdaf75fd5a9cb62a4e18be8c7fc5"
		);
	});
});
