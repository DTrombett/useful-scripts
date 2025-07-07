import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { homedir } from "os";
import { ask } from "./utils/ask.ts";

const DEFAULT_PATH = join(homedir(), "Downloads", `${Date.now()}.mp4`);
const TMP_PATH = join(tmpdir(), `${randomBytes(16).toString("hex")}.mkv`);

const fps = Number(await ask("FPS (60): ")) || 60;
const showMouse =
	(await ask("Show mouse cursor (Y/n): ")).toLowerCase() !== "n";
const systemAudio =
	(await ask("Capture system audio (Y/n): ")).toLowerCase() !== "n";
const micAudio =
	(await ask("Capture microphone audio (y/N): ")).toLowerCase() === "y";
const output =
	(await ask(`Output file name or path (${DEFAULT_PATH}): `)) || DEFAULT_PATH;
let args = [
	"-y",
	"-v",
	"error",
	"-stats",
	"-init_hw_device",
	"d3d11va:,vendor_id=0x8086",
	"-filter_complex",
	`ddagrab=0:draw_mouse=${+showMouse}:framerate=${fps}:dup_frames=false,hwmap=derive_device=qsv`,
];

if (systemAudio)
	args.push("-f", "dshow", "-i", "audio=Stereo Mix (Realtek(R) Audio)");
if (micAudio)
	args.push(
		"-f",
		"dshow",
		"-i",
		"audio=Microfono (Tecnologia Intel® Smart Sound per microfoni digitali)"
	);
if (systemAudio && micAudio)
	args.push(
		"-filter_complex",
		"[0:a][1:a]amix=inputs=2:duration=longest[a]",
		"-map",
		"[a]"
	);
if (systemAudio || micAudio)
	if (output.endsWith(".mp4")) args.push("-b:a", "256k");
	else args.push("-c:a", "flac", "-compression_level:a", "12");
args.push(
	"-c:v",
	"h264_qsv",
	"-async_depth",
	"8",
	"-bf",
	"0",
	"-g",
	"2400",
	"-preset",
	"veryslow",
	"-q:v",
	"1",
	"-movflags",
	"+faststart",
	output
);
try {
	const cp = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });

	stdout.write(
		`ffmpeg ${args
			.map(a => (a.includes(" ") ? (a.includes('"') ? `'${a}'` : `"${a}"`) : a))
			.join(" ")}\n`
	);
	await once(cp, "spawn");
	stdout.write("Recording is starting, press any key to end\n");
	await once(stdin, "data");
	cp.stdin.write("q");
	stdout.write(`\r\x1b[2KSaving ${output}...\r`);
	await once(cp, "exit");
	stdout.write(`\r\x1b[2KRecording saved to \x1b[1m${output}\x1b[0m\n`);
} finally {
	unlink(TMP_PATH).catch(() => {});
}
