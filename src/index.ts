import { mkdir } from "node:fs/promises";
import { argv, exit, stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

const file = argv[2];

stdin.setDefaultEncoding("utf-8");
mkdir(".cache", { recursive: true }).catch(() => {});
process.argv.splice(0, 3);
stdin.setRawMode(true);
emitKeypressEvents(stdin);
stdin.on("keypress", (_, key: { name?: string; ctrl?: boolean }) => {
	if (key.ctrl && key.name === "c") {
		stdout.write("\x1b[?25h");
		exit(0);
	}
});
const { default: fn } = await import(`./${file?.replace(/\.ts$/, "")}.ts`);
await fn();
stdin.unref();
