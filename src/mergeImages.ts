// Merge images using ffmpeg
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join, parse, type ParsedPath } from "node:path";
import { exit, stderr, stdout } from "node:process";
import { promisify } from "node:util";
import { ask } from "./utils/ask.ts";
import { getUserChoice } from "./utils/getUserChoice.ts";

// Initialize the readline interface
const images: ({ width: number; height: number; path: string } & ParsedPath)[] =
	[];
const exec = promisify(execFile);
const ffmpeg = exec.bind(null, "ffmpeg");
const ffprobe = exec.bind(null, "ffprobe");
let imagePath: string;

// Keep asking for image paths until user enters nothing
while (
	(imagePath = (
		await ask(
			`Enter path to image (ex. C:\\Users\\acer\\Downloads\\image.png, example.png): `
		)
	).trim())
) {
	stdout.write(`\x1b[2mProcessing ${imagePath}...\x1b[0m`);
	const result = await ffprobe(
		[
			imagePath,
			"-v",
			"error",
			"-show_entries",
			"stream=width,height",
			"-of",
			"json",
		],
		{ timeout: 10_000, encoding: "utf-8" }
	);
	stdout.write("\r\x1b[K");
	if (result.stderr) {
		stderr.write(result.stderr);
		continue;
	}
	const parsed: { streams?: { width: number; height: number }[] } = JSON.parse(
		result.stdout.toString()
	);
	if (parsed.streams?.length !== 1) {
		stderr.write(
			`\x1b[31mInvalid number of streams: ${parsed.streams?.length}\x1b[0m\n`
		);
		continue;
	}
	images.push({ ...parsed.streams[0]!, ...parse(imagePath), path: imagePath });
}
stdout.write("\x1b[A\x1b[K");
if (!images.length) {
	stderr.write("\x1b[31mNo images provided!\x1b[0m\n");
	exit(1);
}
// Prompt the user for the merge direction
const direction = await getUserChoice("Merge direction", [
	{
		label: "Horizontal",
		value: "h",
	},
	{
		label: "Vertical",
		value: "v",
	},
]);
// Scale the images to the same size
let scale = Math.max(
	...images.map(
		direction === "h" ? ({ height }) => height : ({ width }) => width
	)
).toString();
scale = direction === "h" ? `-1:${scale}` : `${scale}:-1`;
// Prompt the user for the path
// Save to the downloads folder by default
const defaultPath = join(
	homedir(),
	"Downloads",
	`${images.map(({ name }) => name).join("+")}.png`
);
const path =
	(await ask(`Output file name or path (${defaultPath}): `)) || defaultPath;
const ffmpegArgs = [
	"-v",
	"error",
	...images.flatMap(({ path }) => ["-i", path]),
	"-filter_complex",
	`${images.map(({}, i) => `[${i}:v]scale=${scale}[${i}];`).join(" ")} ${images
		.map(({}, i) => `[${i}]`)
		.join("")}${direction}stack=inputs=${images.length}`,
	"-y",
	path,
];
// Run ffmpeg
stdout.write(`Merging images...\n`);
const result = await ffmpeg(ffmpegArgs, { encoding: "utf-8" });
if (result.stderr) stderr.write(result.stderr);
else stdout.write(`\x1b[32mMerged images to ${path}\x1b[0m\n`);
exit();
