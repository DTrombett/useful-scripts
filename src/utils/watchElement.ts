import type { Locator } from "playwright";
import { removeElement } from "./removeElement.ts";

/**
 * Watch an element and remove it if it appears.
 * @param element Locator to watch
 */
export const watchElement = async (element: Locator) => {
	element = element.first();
	while (true) await removeElement(element, 0).catch(() => {});
};
