import {
	createCipheriv,
	createDecipheriv,
	pbkdf2,
	randomBytes,
} from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { basename } from "node:path";
import { argv, exit, stdin, stdout } from "node:process";
import { pipeline } from "node:stream/promises";
import { setImmediate } from "node:timers/promises";
import { promisify } from "node:util";

const SALT_LENGTH = 32;
const IV_LENGTH = 12;

const pbkdf = promisify(pbkdf2);

const deriveKey = (password: string, salt: Buffer, iterations: number) =>
	pbkdf(password, salt, iterations, 32, "sha512");

const encryptFile = async (
	inputPath: string,
	outputPath: string,
	password: string
) => {
	const label = `Encrypted ${basename(inputPath)}`;
	console.time(label);

	const readStream = createReadStream(inputPath);
	const fhPromise = open(outputPath, "w");
	const writeStreamPromise = fhPromise.then(fh =>
		createWriteStream("", { fd: fh.fd, autoClose: false })
	);
	const salt = randomBytes(SALT_LENGTH);
	const iterations = Math.round(
		Math.random() * ((1 << 21) - 2_000_000) + 2_000_000 - (1 << 20)
	);
	const keyPromise = deriveKey(password, salt, iterations);
	const iv = randomBytes(IV_LENGTH);
	const cipherPromise = keyPromise.then(key =>
		createCipheriv("aes-256-gcm", key, iv)
	);
	// Store: [ Salt | Iterations | IV | AuthTag | CipherText ]
	const [fh, writeStream] = await Promise.all([fhPromise, writeStreamPromise]);

	// Salt
	writeStream.write(salt);
	// Iterations
	const iterBuffer = Buffer.allocUnsafe(4);
	iterBuffer.writeUInt32BE(iterations);
	writeStream.write(iterBuffer);
	// IV
	writeStream.write(iv);
	// AuthTag (not initialized)
	writeStream.write(Buffer.alloc(16));
	const cipher = await cipherPromise;
	// CipherText
	await pipeline(readStream, cipher, writeStream);
	// AuthTag
	await fh.write(cipher.getAuthTag(), 0, 16, SALT_LENGTH + 4 + IV_LENGTH);
	await fh.close();

	console.timeEnd(label);
};

const decryptFile = async (
	inputPath: string,
	outputPath: string,
	password: string
) => {
	const label = `Decrypted ${basename(inputPath)}`;
	console.time(label);

	const writeStream = createWriteStream(outputPath);
	const fh = await open(inputPath, "r");
	const readStream = createReadStream("", {
		fd: fh.fd,
		start: SALT_LENGTH + 4 + IV_LENGTH + 16,
	});
	const { buffer: salt } = await fh.read({ buffer: Buffer.alloc(SALT_LENGTH) });
	const { buffer: iterations } = await fh.read({ buffer: Buffer.alloc(4) });
	const keyPromise = deriveKey(password, salt, iterations.readUInt32BE(0));
	const { buffer: iv } = await fh.read({ buffer: Buffer.alloc(IV_LENGTH) });
	const authTagPromise = fh
		.read({ buffer: Buffer.alloc(16) })
		.then(({ buffer }) => buffer);
	const decipher = createDecipheriv("aes-256-gcm", await keyPromise, iv);

	await pipeline(
		readStream,
		decipher.setAuthTag(await authTagPromise),
		writeStream
	);

	console.timeEnd(label);
};

const askPassword = (query: string) =>
	new Promise<string>(async (resolve, reject) => {
		stdin.setRawMode(true);

		let input = "";
		let pos = 0;
		const onData = (char: string) => {
			if (char === "\r" || char === "\n") {
				stdin.removeListener("data", onData);
				stdin.setRawMode(false);
				stdout.write("\n");
				resolve(input);
			}
			// Ctrl+C
			else if (char === "\u0003") {
				stdin.setRawMode(false);
				stdin.removeListener("data", onData);
				reject(new Error("Cancelled"));
			}
			// Backspace
			else if (char === "\u007F")
				input = input.slice(0, pos - 1) + input.slice(pos || Infinity);
			// Delete
			else if (char === "\x1B[3~")
				input =
					input.slice(0, pos || undefined) +
					input.slice((pos = Math.min(pos + 1, 0)) || Infinity);
			// Arrow left
			else if (char === "\u001B[D") pos = Math.max(pos - 1, -input.length);
			// Arrow right
			else if (char === "\u001B[C") pos = Math.min(pos + 1, 0);
			else if (char.startsWith("\x1B")) {
				// console.log(JSON.stringify(char));
			}
			// Ctrl+Backspace
			else if (char === "\x08") {
				input =
					input.slice(
						0,
						input
							.slice(0, pos || undefined)
							.match(/([0-9A-Z_a-zÀ-ÖØ-öø-ˑ]*|[^0-9A-Z_a-zÀ-ÖØ-öø-ˑ]*)$/)!.index
					) + input.slice(pos || Infinity);
			} else
				input =
					input.slice(0, pos || undefined) +
					char +
					input.slice(pos || Infinity);
		};

		stdin.on("data", onData);
		stdout.write(query);
	});

stdin.setEncoding("utf8");
stdin.setRawMode(false);
await setImmediate();
if (argv[0] === "encrypt") {
	stdout.write("File to encrypt: ");
	let [file] = await once(stdin, "data");
	if (!existsSync((file = file.trim()))) {
		stdout.write(`File not found.\n`);
		exit(1);
	}
	await encryptFile(file, `${file}.enc`, await askPassword("Password: "));
	stdout.write(`Encrypted file saved as ${file}.enc\n`);
} else if (argv[0] === "decrypt") {
	stdout.write("File to decrypt: ");
	let [file] = await once(stdin, "data");
	if (!existsSync((file = file.trim()))) {
		stdout.write(`File not found.\n`);
		exit(1);
	}
	let output = file.endsWith(".enc") ? file.slice(0, -4).trim() : `${file}.dec`;
	stdout.write(`Output file name or path (${output}): `);
	const [newOutput] = await once(stdin, "data");
	output = newOutput.trim() || output;
	await decryptFile(file, output, await askPassword("Password: "));
	stdout.write(`Decrypted file saved as ${output}\n`);
}
exit();
