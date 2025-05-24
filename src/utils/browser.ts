import {
	chromium,
	firefox,
	webkit,
	type Browser,
	type BrowserContext,
	type BrowserContextOptions,
	type LaunchOptions,
} from "playwright";

export type SharedContext = BrowserContext & {
	key?: string;
	using?: number;
};
export type SharedBrowser = Browser & {
	using?: number;
	key?: string;
	sharedContexts?: Record<string, Promise<SharedContext>>;
};
const engines = { chromium, firefox, webkit };
const browsers: Record<string, Promise<SharedBrowser>> = {};
const copy = <T extends object, S extends object>(original: T, additional: S) =>
	new Proxy(original, {
		get: (original, p) => {
			if (p in additional)
				return (additional as Record<string | symbol, any>)[p];
			return (original as Record<string | symbol, any>)[p];
		},
		set: (original, p, value) => {
			if (p in additional)
				(additional as Record<string | symbol, any>)[p] = value;
			else (original as Record<string | symbol, any>)[p] = value;
			return true;
		},
	}) as T & S;

export const launch = async (
	browser: "chromium" | "firefox" | "webkit",
	options?: LaunchOptions
): Promise<SharedBrowser & { closed?: boolean }> => {
	const key = browser + JSON.stringify(options);

	if (browsers[key]) {
		const newBrowser = await browsers[key];
		newBrowser.using!++;
		return copy(newBrowser, { closed: false });
	}
	browsers[key] = engines[browser].launch(options);
	const newBrowser = await browsers[key];
	newBrowser.using = 1;
	newBrowser.key = key;
	newBrowser.sharedContexts = {};
	return copy(newBrowser, { closed: false });
};

export const newContext = async (
	browser: SharedBrowser,
	options?: BrowserContextOptions
): Promise<SharedContext & { closed: boolean }> => {
	const key = JSON.stringify(options);

	if (browser.sharedContexts?.[key]) {
		const newContext = await browser.sharedContexts[key];
		newContext.using!++;
		return copy(newContext, { closed: false });
	}
	browser.sharedContexts![key] = browser.newContext(options);
	const newContext = await browser.sharedContexts![key];
	newContext.using = 1;
	newContext.key = key;
	return copy(newContext, { closed: false });
};

export const closeBrowser = async (
	browser: SharedBrowser & { closed?: boolean }
) => {
	if (browser.closed) return;
	browser.closed = true;
	browser.using!--;
	if (!browser.using) {
		delete browsers[browser.key!];
		await browser.close().catch(() => {});
	}
};

export const closeContext = async (
	context: SharedContext & { closed?: boolean }
) => {
	if (context.closed) return;
	context.closed = true;
	context.using!--;
	if (!context.using) {
		delete (context.browser() as SharedBrowser).sharedContexts![context.key!];
		await context.close().catch(() => {});
	}
};
