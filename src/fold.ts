#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { argv, cwd, exit } from "node:process";

const path = cwd();
const folder = basename(path);

argv[2] = (argv[2] ?? argv[0])!.toLowerCase();
if (argv[2] === "create") {
	const cp = spawn(
		"7z",
		[
			"a",
			`${folder}.7z`,
			"-mx=9",
			"-m0=lzma2",
			"-ms=on",
			"-md=1g",
			"-mmt=on",
			"-mfb=256",
			"-sdel",
			"-mhe=on",
			"-p",
		],
		{ stdio: "inherit" }
	);

	await once(cp, "exit");
	if (cp.exitCode !== 0) {
		console.error(`\x1b[31m7z process exited with code ${cp.exitCode}\x1b[0m`);
		exit(cp.exitCode);
	}
	console.log("\x1b[32mDone!\x1b[0m");
} else if (argv[2] === "extract") {
	const cp = spawn("7z", ["x", `${folder}.7z`], { stdio: "inherit" });

	await once(cp, "exit");
	if (cp.exitCode !== 0) {
		console.error(`\x1b[31m7z process exited with code ${cp.exitCode}\x1b[0m`);
		exit(cp.exitCode);
	}
	console.log(`Deleting ${folder}.7z...`);
	await rm(join(path, `${folder}.7z`), { force: true });
	console.log("\x1b[32mDone!\x1b[0m");
} else {
	console.log("Usage: fold <create|extract>");
	process.exitCode = 1;
}
exit();
