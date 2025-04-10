// Save all RDS playlist tracks to a file
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { argv, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { request } from "undici";

// Create a write stream to the file
const stream = createWriteStream(".cache/tracks.txt");
// Cache the tracks to avoid duplicates
const tracks = new Set<string>();
/**
 * Fetch the songs for a specific day from RDS API
 * @param day - Date in YYYYMMDD format
 */
const fetchSongs = async (day: string) => {
	// Run the request
	const res = await request(
		`https://cdnapi.rds.it/v2/site/musica/archivio-playlist/${day}`
	);
	// Parse the JSON response
	const { subtemplates } = (await res.body.json()) as {
		subtemplates?: {
			playlist_novita?: { artist: string; title: string }[];
			playlist_songs?: { artist: string; title: string }[];
		};
	};

	if (subtemplates) {
		// Loop through the songs and add them to the file
		for (const { title, artist } of [
			...(subtemplates.playlist_songs ?? []),
			...(subtemplates.playlist_novita ?? []),
		]) {
			// Stringify the track
			const track = `${title} ${artist}`;

			// Check if the track is already in the cache
			if (!tracks.has(track)) {
				// Add to the cache
				tracks.add(track);
				// Write to the file
				stream.write(`${track}\n`);
				// Also output to the console
				console.log(track);
			}
		}
	}
};
let days = Number(argv[0]);

if (!days) {
	// Initialize the readline interface
	const rl = createInterface(stdin, stdout);
	const listener = process.exit.bind(process, 1);

	// Exit gracefully when hitting Ctrl+C
	process.once("uncaughtException", listener);
	// Prompt the user for the number of days to fetch
	days = Number(
		await rl.question("Number of days to fetch (up to 2017-02-27): ")
	);
	// Check if the number is valid
	if (isNaN(days) || days < 1) {
		console.error("\x1b[31mInvalid number of days\x1b[0m");
		process.exit(1);
	}
	// Close the readline interface
	rl.close();
	// Remove the listener
	process.removeListener("uncaughtException", listener);
}
// Create the array of promises
const promises = [];
// Initialize the date to today
const date = new Date();

for (let i = 0; i < days; i++) {
	// Fetch the songs for the current date
	promises.push(
		fetchSongs(
			`${date.getFullYear()}${(date.getMonth() + 1)
				.toString()
				.padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`
		)
	);
	// Decrement the date by one day
	date.setDate(date.getDate() - 1);
}
// Wait for all the requests to finish
await Promise.all(promises);
// Close the stream
stream.end();
// Log the success message
console.log(
	`\x1b[32mSaved ${tracks.size} tracks to ${resolve(
		".cache/tracks.txt"
	)}\x1b[0m`
);
