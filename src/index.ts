import { mkdir } from "node:fs/promises";
import { argv, stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

const file = argv[2];

mkdir(".cache", { recursive: true }).catch(() => {});
process.argv.splice(0, 3);
emitKeypressEvents(stdin);
stdin.on("keypress", (_, key: { name?: string; ctrl?: boolean }) => {
	if (key.ctrl && key.name === "c") {
		stdout.write("\x1b[?25h");
		process.exit(0);
	}
});
import(`./${file?.endsWith(".ts") ? file.slice(0, -3) : file}.ts`);
