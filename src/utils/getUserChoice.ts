import { stdin, stdout } from "process";

/**
 * Prompt user with a question and choices
 * @param question The question to prompt
 * @param choices Array of choices
 * @returns Promise resolving to the selected value
 */
export const getUserChoice = async <T>(
	question: string,
	choices: { label: string; value: T; default?: boolean; fn?: () => void }[]
) => {
	// Find default index or use first option
	let selectedIndex = Math.max(
		0,
		choices.findIndex(c => c.default)
	);
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
	stdin.resume();
	return new Promise<T>(resolve => {
		const listener = (_: any, key: { name?: string; ctrl?: boolean }) => {
			if (key.name === "up" && selectedIndex > 0) {
				selectedIndex--;
				render();
			} else if (key.name === "down" && selectedIndex < choices.length - 1) {
				selectedIndex++;
				render();
			} else if (key.name === "return") {
				stdout.write("\x1b[?25h");
				choices[selectedIndex]!.fn?.();
				resolve(choices[selectedIndex]!.value);
				stdin.removeListener("keypress", listener);
			}
		};

		// Handle key presses
		stdin.on("keypress", listener);
	});
};
