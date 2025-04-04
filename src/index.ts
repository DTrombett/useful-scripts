import { argv } from "node:process";

const file = argv[2];

process.argv.splice(0, 3);
import(`./${file?.endsWith(".ts") ? file.slice(0, -3) : file}.ts`);
