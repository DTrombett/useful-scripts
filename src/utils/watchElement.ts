import type { Locator } from "playwright";

/**
 * Watch an element.
 * @param element Locator to watch
 * @param fn Function to call when the element is found
 * @param state State to wait for (default: "visible")
 */
export const watchElement = (
	element: Locator,
	fn: (element: Locator) => Awaitable<void>,
	state?: "attached" | "detached" | "visible" | "hidden"
) => {
	const loop = async () => {
		try {
			while (true) {
				await element.waitFor({ timeout: 0, state });
				await fn(element);
			}
		} catch (_) {}
	};

	element = element.first();
	loop();
};
