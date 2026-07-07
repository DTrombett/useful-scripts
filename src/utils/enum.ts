export const createEnum = <T extends Record<string, PropertyKey>>(e: T) =>
	({
		...e,
		...Object.fromEntries(Object.entries(e).map(([k, v]) => [v, k] as const)),
	}) as T & {
		[K in keyof T as T[K]]: K;
	};
