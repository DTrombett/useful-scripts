import { spawn } from "child_process";
import { createHash } from "crypto";
import { ok } from "node:assert/strict";
import { stdout } from "node:process";
import { pipeline } from "stream/promises";
import { ask } from "./utils/options.ts";

const hashMedia = async ({
	input,
	algorithm,
	encoding,
	silent,
}: Partial<{
	input: string;
	algorithm: string;
	encoding: BufferEncoding;
	silent: boolean;
}> = {}) => {
	input ??= await ask("Input file: ", { silent });
	ok(input, "Input file is required");
	algorithm ??= await ask("Hash algorithm (sha512): ", {
		silent,
		default: "sha512",
	});
	const args: string[] = ["-v", "error", "-i", input, "-f", "rawvideo", "-"];
	if (!silent) args.push("-stats");
	const hash = await pipeline(
		spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "inherit"] }).stdout,
		createHash(algorithm),
		async (hash: AsyncIterable<Buffer, Buffer>) =>
			(
				await hash[Symbol.asyncIterator]().next()
			).value,
		{ signal: AbortSignal.timeout(10_000) }
	);
	encoding ??= (await ask("Hash encoding (base64url): ", {
		silent,
		default: "base64url",
	})) as BufferEncoding;
	const result = hash.toString(encoding);
	if (!silent) stdout.write(`${result}\n`);
	return result;
};

export default hashMedia;
