import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { request } from "undici";

const allSongs = new Set<string>(
	await readFile(".cache/christmas1.txt", "utf-8").then((data) =>
		data.split("\n"),
	),
);
const writeStream = createWriteStream(".cache/christmas.txt");

for (
	let time = Date.UTC(2025, 11, 1);
	time < Date.now() / 1000;
	time += 60 * 60
) {
	console.log(`Fetching ${new Date(time * 1000).toLocaleString()} (${time})`);
	const res = await request(
		`https://cdnapi.rds.it/v2/site/musica/che-canzone-era/${time}`,
	);
	if (res.statusCode !== 200)
		throw new Error(`Status code: ${res.statusCode}`, {
			cause: await res.body.text(),
		});
	const {
		subtemplates: { "cce-schede": songs },
	} = (await res.body.json()) as {
		subtemplates: {
			"cce-schede": {
				artista: string;
				data_onair: string;
				featuring: string;
				music_log_idmusicdb: number;
				remixer: number;
				sid: number;
				song_artist: string;
				song_image: string;
				song_onair_time: string;
				song_sample: string;
				song_title: string;
			}[];
		};
	};

	for (const i of [0, 1, songs.length - 2, songs.length - 1])
		if (songs[i]) {
			const value = `${songs[i].song_title}${songs[i].song_artist}`.trim();

			if (!allSongs.has(value)) {
				writeStream.write(`${value}\n`);
				allSongs.add(value);
				console.log(value);
			}
		}
	const delay = Math.random() * 15_000 + 5_000;
	console.log(`Sleeping for ${Math.round(delay / 1_000)} seconds...`);
	await setTimeout(delay);
}
writeStream.end();
console.log(`Total songs: ${allSongs.size}`);
