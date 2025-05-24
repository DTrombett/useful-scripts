import { once } from "node:events";
import { stdin, stdout } from "node:process";

/**
 * Ask a question.
 * @param id - The option ID
 * @returns The value of the option
 */
export const ask = async (
	question: string,
	{
		default: defaultValue = "",
		silent = false,
	}: { default?: string; silent?: boolean } = {}
): Promise<string> => {
	if (silent) return defaultValue;
	const promise = once(stdin, "data");

	stdout.write(question);
	stdin.setRawMode(false);
	stdin.resume();
	const [answer] = await promise;
	stdin.pause();
	stdin.setRawMode(true);
	return answer.toString().trim() || defaultValue;
};

/**
 * Prompt user with a question and choices
 * @param question - The question to prompt
 * @param choices - Array of choices
 * @returns The selected value
 */
export const getUserChoice = async <T>(
	question: string,
	choices: Choice<T>[],
	{ skip = false }: Partial<{ skip: boolean }> = {}
) => {
	// Find default index or use first option
	let selectedIndex = Math.max(
		0,
		choices.findIndex(c => c.default)
	);

	if (skip) {
		choices[selectedIndex]!.fn?.();
		return choices[selectedIndex]!.value;
	}
	const render = (clear = true) =>
		stdout.write(
			// Move cursor up for each choice + question line
			// then move to beginning of line and clear everything below
			`${clear ? `\x1b[${choices.length}A\r\x1b[J` : ""}${choices
				.map((choice, i) =>
					i === selectedIndex
						? `> \x1b[32m\x1b[4m${choice.label}\x1b[0m`
						: `  ${choice.label}`
				)
				.join("\n")}\n`
		);

	// Hide cursor and display question
	stdout.write(`\x1b[?25l\x1b[1m${question}\x1b[0m\n`);
	// Display choices
	render(false);
	return new Promise<T>(resolve => {
		const listener = (_: any, key: { name?: string; ctrl?: boolean }) => {
			if (key.name === "up" && selectedIndex > 0) {
				selectedIndex--;
				render();
			} else if (key.name === "down" && selectedIndex < choices.length - 1) {
				selectedIndex++;
				render();
			} else if (key.name === "return") {
				stdin.pause();
				stdout.write("\x1b[?25h");
				choices[selectedIndex]!.fn?.();
				resolve(choices[selectedIndex]!.value as T);
				stdin.removeListener("keypress", listener);
			}
		};

		// Handle key presses
		stdin.on("keypress", listener);
		stdin.resume();
	});
};
