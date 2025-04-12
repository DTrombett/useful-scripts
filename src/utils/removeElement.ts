import type { Locator } from "playwright";

/**
 * Removes an element from the DOM.
 * @param element - The element to remove
 * @param timeout - Optional timeout in milliseconds
 */
export const removeElement = (element: Locator, timeout?: number) =>
	element.evaluate(el => el.remove(), null, { timeout });
