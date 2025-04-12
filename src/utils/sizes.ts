const baseSizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
const searchSizes = ["BYTES", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
const bytesRegex = /^(\d*(?:\.\d+)?)\s*([a-zA-Z]+)?$/u;

/**
 * Formats a number of bytes into a human-readable string.
 * @param bytes The number of bytes to format
 * @param param1 Additional options for formatting
 * @returns A string representing the formatted size
 */
export const formatBytes = (
	bytes: number,
	{
		fractionDigits = 1,
		sizes = baseSizes,
		k = 1_000,
	}: Partial<{ fractionDigits: number; sizes: string[]; k: number }> = {}
): string => {
	if (!bytes) return "0 Bytes";
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / k ** i).toFixed(fractionDigits)}${sizes[i]}`;
};

/**
 * Parses a human-readable size string into bytes.
 * @param sizeStr The size string to parse
 * @param param1 Additional options for parsing
 * @returns The size in bytes
 */
export const parseHumanReadableSize = (
	sizeStr: string,
	{
		sizes = searchSizes,
		k = 1_000,
	}: Partial<{ sizes: string[]; k: number }> = {}
): number => {
	const match = bytesRegex.exec(sizeStr);

	if (!match) throw new Error("Invalid size format");
	const [, value, unit] = match;
	const numericValue = parseFloat(value!);
	const index = sizes.indexOf(unit?.toUpperCase() || "BYTES");

	if (index === -1) throw new Error(`Unknown unit: ${unit}`);
	return numericValue * k ** index;
};
