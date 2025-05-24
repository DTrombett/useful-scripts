/**
 * Parses a string into an array of arguments, respecting quotes and escapes.
 * @param line The command line string to parse
 * @returns An array of arguments
 */
export const parseArgs = (line: string): string[] => {
	const regex = /(?:\\.|[^'"\s])+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
	const args = line.match(regex) || [];

	return args.map(arg => {
		// Remove surrounding quotes if present and unescape contents
		if (arg.startsWith('"') && arg.endsWith('"'))
			return arg.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
		if (arg.startsWith("'") && arg.endsWith("'"))
			return arg.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
		// Unescape characters in unquoted arguments
		return arg
			.replace(/\\ /g, " ")
			.replace(/\\"/g, '"')
			.replace(/\\'/g, "'")
			.replace(/\\\\/g, "\\");
	});
};
