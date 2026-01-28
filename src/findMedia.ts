import type { Entry, Har } from "har-format";
import { ok, strictEqual } from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import { setTimeout } from "node:timers/promises";
import { inflateRawSync } from "node:zlib";
import { chromium } from "playwright";

//#region types
type Vertex = {
	readonly children: Map<Vertex, Set<string>>;
	readonly parents: Set<Vertex>;
	readonly file: Buffer<ArrayBufferLike>;
	readonly fragments: ReadonlySet<string>;
	readonly index: number;
	readonly url: string;
	visited: boolean;
};
type Boolean = <T>(
	value?: T,
) => value is Exclude<T, undefined | false | 0 | "" | null>;
declare global {
	interface BooleanConstructor extends Boolean {}
}
//#endregion
//#region preferences
{
	await rm("./.cache/playwright", { recursive: true, force: true });
	await mkdir("./.cache/playwright/Default", { recursive: true });
	const preferences = await readFile(
		"./.cache/playwright/Default/Preferences",
		"utf8",
	).catch(() => "{}");
	const modifiedPreferences = JSON.parse(preferences);

	(modifiedPreferences.profile ??= {}).block_third_party_cookies = true;
	((modifiedPreferences.browser ??= {}).theme ??= {}).color_scheme2 = 2;
	modifiedPreferences.profile.cookie_controls_mode = 1;
	modifiedPreferences.enable_do_not_track = true;
	(modifiedPreferences.translate ??= {}).enabled = false;
	(modifiedPreferences.intl ??= {}).selected_languages = "en";
	(modifiedPreferences.safebrowsing ??= {}).enabled = false;
	await writeFile(
		"./.cache/playwright/Default/Preferences",
		JSON.stringify(modifiedPreferences),
	);
}
//#endregion
//#region init
const cp = spawn(
	chromium.executablePath(),
	[
		"--remote-debugging-port=23095",
		"--incognito",
		"--disable-field-trial-config",
		"--disable-background-networking",
		"--disable-background-timer-throttling",
		"--disable-backgrounding-occluded-windows",
		"--disable-back-forward-cache",
		"--disable-breakpad",
		"--disable-client-side-phishing-detection",
		"--disable-component-extensions-with-background-pages",
		"--disable-component-update",
		"--no-default-browser-check",
		"--disable-default-apps",
		"--disable-dev-shm-usage",
		"--disable-extensions",
		"--disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints",
		"--enable-features=CDPScreenshotNewSurface",
		"--allow-pre-commit-input",
		"--disable-hang-monitor",
		"--disable-ipc-flooding-protection",
		"--disable-popup-blocking",
		"--disable-prompt-on-repost",
		"--disable-renderer-backgrounding",
		"--force-color-profile=srgb",
		"--metrics-recording-only",
		"--no-first-run",
		"--password-store=basic",
		"--use-mock-keychain",
		"--no-service-autorun",
		"--export-tagged-pdf",
		"--disable-search-engine-choice-screen",
		"--unsafely-disable-devtools-self-xss-warnings",
		"--edge-skip-compat-layer-relaunch",
		"--disable-infobars",
		"--disable-search-engine-choice-screen",
		"--disable-sync",
		"--enable-unsafe-swiftshader",
		"--no-sandbox",
		"--user-data-dir=D:\\useful-scripts\\.cache\\playwright",
		"--no-startup-window",
	],
	{ stdio: "inherit" },
);
await once(cp, "spawn");
console.log("Spawned chromium");
await setTimeout(1000);
const browser = await chromium.connectOverCDP("http://localhost:23095", {
	isLocal: true,
});
console.log("Connected over CDP");
const page = await browser.newPage({
	acceptDownloads: false,
	colorScheme: "dark",
	deviceScaleFactor: 4,
	locale: "en-GB",
	recordHar: {
		path: "./.cache/har.zip",
		urlFilter:
			/^https?:\/\/(?!.*\.(?:css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|svg|ico|wasm)(?:$|\?)).*/i,
	},
	serviceWorkers: "block",
	timezoneId: "UTC",
});
const mediaMimeType =
	/^(audio|video)\/[a-z0-9.+-]+$|^application\/(vnd\.apple\.mpegurl|x-mpegurl|dash\+xml)$/i;
//#endregion
//#region play
const [url] = argv;

page.setDefaultTimeout(20_000);
await Promise.all([
	page.goto(url),
	page.getByRole("button", { name: "Continua senza accettare" }).click(),
	page.waitForResponse(
		async (res) =>
			(await res.request().headerValue("sec-fetch-dest")) === "video" ||
			mediaMimeType.test((await res.headerValue("content-type")) ?? ""),
	),
]);
await page.close();
console.log("Closing browser");
await browser.close();
cp.kill("SIGINT");
await once(cp, "close");
rm("./.cache/playwright", { recursive: true, force: true });
//#endregion
//#region har
const zip = await readFile("./.cache/har.zip");
const files = new Map<string, Buffer>();
let offset = 0;
while (offset < zip.length) {
	const signature = zip.readUInt32LE(offset);
	if (signature !== 0x04034b50) break;
	// const versionNeeded = har.readUInt16LE((offset += 4));
	// const flags = har.readUInt16LE((offset += 2));
	const compressionMethod = zip.readUInt16LE((offset += 8));
	// const modTime = har.readUInt16LE((offset += 2));
	// const modDate = har.readUInt16LE((offset += 2));
	// const crc32 = har.readUInt32LE((offset += 2));
	const compressedSize = zip.readUInt32LE((offset += 10));
	const uncompressedSize = zip.readUInt32LE((offset += 4));
	const fileNameLength = zip.readUInt16LE((offset += 4));
	const extraFieldLength = zip.readUInt16LE((offset += 2));
	const fileName = zip
		.subarray((offset += 2), (offset += fileNameLength))
		.toString("utf8");
	let data = zip.subarray(
		(offset += extraFieldLength),
		(offset += compressedSize),
	);

	if (compressionMethod === 8) data = inflateRawSync(data);
	else strictEqual(compressionMethod, 0);
	strictEqual(data.byteLength, uncompressedSize);
	files.set(fileName, data);
}
const { log }: Har = JSON.parse(files.get("har.har")!.toString("utf-8"));

log.entries.splice(
	log.entries.findIndex(
		(entry) =>
			entry.request.headers.find(
				(v) => v.name.toLowerCase() === "sec-fetch-dest",
			)?.value === "video" ||
			mediaMimeType.test(entry.response.content.mimeType),
	) + 1,
);
//#endregion
//#region tree
const fragmentURL = (url: string | URL) =>
	(url = new URL(url)) &&
	new Set(
		url.pathname
			.split("/")
			.concat(
				url.hostname,
				url.hash.slice(1),
				url.searchParams.values().toArray(),
			)
			.filter((v) => v.length >= 2),
	);
const getSize = (str: string) => {
	str = str.trim();
	const c = Math.max(Math.sqrt(str.length), 4);

	return Math.floor((str.length / (c + c / 2) + 1) * 16);
};
const breakString = (str: string) => {
	str = str.trim();
	let c = Math.max(Math.sqrt(str.length), 4);
	let result = "";

	c += c / 2;
	for (
		let i = 1, start = 0;
		start < str.length;
		i++, start = Math.round((i - 1) * c)
	)
		result += str.slice(start, Math.round(i * c)) + "\n";
	return result
		.trimEnd()
		.normalize("NFC")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
		.replace(/\n/g, "&#xa;");
};
const createElement = (entry: Vertex) => {
	const size = getSize(entry.url);
	const [a, b] = (
		[
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1],
		] as const
	)[Math.round(Math.random() * 3)];

	return `<mxCell id="url-${entry.index}" parent="1"
				style="rounded=1;aspect=fixed"
				value="${breakString(entry.url)}"
				vertex="1">
				<mxGeometry height="${size}" width="${size}" x="${(size + entry.index * 4) * a}" y="${(size + entry.index * 4) * b}" as="geometry" />
			</mxCell>`;
};
const createArrow = (
	source: Vertex,
	target: Vertex,
	provides: ReadonlySet<string>,
) => {
	return `<mxCell id="arrow-${source.index}-${target.index}" edge="1" parent="1" source="url-${source.index}"
				target="url-${target.index}">
				<mxGeometry as="geometry" />
			</mxCell>
			${
				provides.size
					? `<mxCell id="label-${source.index}-${target.index}" parent="arrow-${source.index}-${target.index}"
						style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0"
						value="${breakString(provides.values().reduce((a, b) => `${a}, ${b}`))}" vertex="1">
						<mxGeometry relative="1" as="geometry" />
					</mxCell>`
					: ""
			}`;
};
const deleteOrphaned = (entry: Vertex) => {
	if (entry.children.size === 0) {
		for (const parent of entry.parents) {
			entry.parents.delete(parent);
			parent.children.delete(entry);
			deleteOrphaned(parent);
		}
	}
};
const resolvedEntries = log.entries
	.filter(
		(
			entry,
			index,
		): entry is Entry & {
			response: { content: { _file: string } };
		} =>
			("_file" in entry.response.content &&
				typeof entry.response.content._file === "string" &&
				files.has(entry.response.content._file)) ||
			index === log.entries.length - 1,
	)
	.map(
		(entry, index): Vertex => ({
			file: files.get(entry.response.content._file)!,
			fragments: fragmentURL(entry.request.url),
			index,
			parents: new Set(),
			visited: false,
			children: new Map(),
			url: entry.request.url,
		}),
	);
const entry = resolvedEntries.at(-1);

ok(entry);
console.log("Found media url", entry.url);
const toFind = new Set([entry]);
entry.visited = true;
resolvedEntries[0].visited = true;
for (const current of toFind) {
	const fragments = new Set(current.fragments);

	for (let i = 0; i < current.index; i++) {
		const entry = resolvedEntries[i];
		let found = false;
		let child = entry.children.get(current);

		for (const fragment of fragments)
			if (
				entry.fragments.has(fragment) ||
				entry.file.includes(fragment) ||
				entry.file.includes(decodeURIComponent(fragment))
			) {
				if (child) {
					child.add(fragment);
					if (current.fragments.size === child.size) {
						entry.children.set(current, (child = new Set()));
						current.parents.clear();
					}
				} else entry.children.set(current, (child = new Set([fragment])));
				current.parents.add(entry);
				fragments.delete(fragment);
				found = true;
			}
		if (found && !entry.visited) {
			entry.visited = true;
			toFind.add(entry);
		}
		if (fragments.size === 0) {
			if (child?.size !== 0 && entry.file.includes(current.url)) {
				child?.clear();
				for (const parent of current.parents)
					if (parent !== entry) {
						current.parents.delete(parent);
						parent.children.delete(current);
						toFind.delete(parent);
						deleteOrphaned(parent);
					}
			}
			break;
		}
	}
	if (fragments.size !== 0)
		console.log(
			`Couldn't find following fragments for`,
			current.url,
			fragments.values().reduce((a, b) => `${a}, ${b}`),
		);
}
for (const entry of resolvedEntries) entry.visited = false;
toFind.clear();
toFind.add(resolvedEntries[0]);
resolvedEntries[0].visited = true;
let elements = "";
for (const entry of toFind) {
	elements += createElement(entry);
	for (const [child, args] of entry.children) {
		elements += createArrow(entry, child, args);
		if (!child.visited) {
			toFind.add(child);
			child.visited = true;
		}
	}
}
await writeFile(
	".cache/diagram.xml",
	`
		<mxGraphModel>
  			<root>
				<mxCell id="0" />
				<mxCell id="1" parent="0" />
				${elements}
			</root>
		</mxGraphModel>
	`,
);
//#endregion
console.log("Exiting");
