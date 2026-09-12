interface ObjectConstructor {
	/**
	 * Returns an array of values of the enumerable own properties of an object
	 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
	 */
	values<T extends {}>(o: T): Required<T>[keyof T][];
	/**
	 * Returns an array of key/values of the enumerable own properties of an object
	 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
	 */
	entries<T extends {}>(
		o: T,
	): {
		[K in keyof T]-?: K extends string | number ? [`${K}`, T[K]] : never;
	}[keyof T][];
	/**
	 * Returns an object created by key-value entries for properties and methods
	 * @param entries An iterable object that contains key-value entries for properties and methods.
	 */
	fromEntries<T extends Iterable<readonly [PropertyKey, unknown]>>(
		entries: T,
	): {
		[Entry in T extends Iterable<infer A> ? A : never as Entry[0]]: Entry[1];
	};
}

type Awaitable<T> = Promise<T> | T;

type WidgetField = {
	value_type: string;
	presentation_type: "text" | "number" | "image";
	value: string;
	fallback?: {
		value_type: string;
		presentation_type: string;
		value: string;
	};
};
type WidgetComponent<
	Required extends string = never,
	Optional extends string = never,
> = {
	fields: { [P in Required]: WidgetField } & { [P in Optional]?: WidgetField };
};
type WidgetTopSubtitle = WidgetComponent<"text", "label" | "icon">;
type WidgetBottomItem = WidgetComponent<"image" | "name", "description">;
type WidgetBottomStat = WidgetComponent<"value" | "label", "icon">;
type WidgetSurface<T extends Record<string, WidgetComponent>> = {
	layout: string;
	components: T;
};

type WidgetConfig = {
	config_id: string;
	application_id: string;
	display_name: string;
	status: string;
	surfaces: {
		widget_top: WidgetSurface<
			| {
					hero_image: WidgetComponent<"image">;
					title: WidgetComponent<"text">;
					subtitle_1?: WidgetTopSubtitle;
					subtitle_2?: WidgetTopSubtitle;
					subtitle_3?: WidgetTopSubtitle;
			  }
			| {
					contained_image: WidgetComponent<"image">;
					title: WidgetComponent<"text">;
					subtitle_1?: WidgetTopSubtitle;
					subtitle_2?: WidgetTopSubtitle;
					subtitle_3?: WidgetTopSubtitle;
			  }
		>;
		widget_bottom: WidgetSurface<
			| {
					stat_1: WidgetBottomStat;
					stat_2: WidgetBottomStat;
					stat_3: WidgetBottomStat;
					stat_4: WidgetBottomStat;
					stat_5: WidgetBottomStat;
					stat_6: WidgetBottomStat;
			  }
			| {
					objective: WidgetComponent<"image" | "name", "description">;
					progress: WidgetComponent<"current", "max">;
			  }
			| {
					item_1: WidgetBottomItem;
					item_2: WidgetBottomItem;
					item_3: WidgetBottomItem;
					item_4: WidgetBottomItem;
			  }
		>;
		add_widget_preview: WidgetSurface<
			| { hero_image: WidgetComponent<"image"> }
			| { contained_image: WidgetComponent<"image"> }
		>;
		mini_profile?: WidgetSurface<
			| {
					stat: WidgetComponent<"text">;
					hero_image: WidgetComponent<"image">;
			  }
			| {
					stat: WidgetComponent<"text">;
					contained_image: WidgetComponent<"image">;
			  }
		>;
		activity_accessory?: WidgetSurface<{
			stat: WidgetComponent<"text", "label" | "icon">;
		}>;
	};
	updated_at: string;
	published_at: string;
	resolved_assets: {
		key: string;
		asset_id: string;
		asset_type: string;
		metadata: {
			width: number;
			height: number;
			content_type: string;
			is_animated: boolean;
		};
		updated_at: string;
		visibility: string;
	}[];
	application: {
		id: string;
		name: string;
		icon: string;
		description: string;
		type: null;
		summary: string;
		is_monetized: boolean;
		is_verified: boolean;
		is_discoverable: boolean;
	};
};

declare module "rehype-figure" {
	export default function rehypeFigure(
		options?: { className?: string } | null | undefined,
	): (tree: Root) => undefined;
}
declare module "generate-github-markdown-css" {
	export default function generateGithubMarkdownCss(
		options?: Partial<{
			/** The theme to use for light theme. */
			light: "light" | "dark";
			/** The theme to use for dark theme. */
			dark: "dark" | "light";
			/** If `true`, will return a list of available themes instead of the CSS. */
			list: boolean;
			/**
			 * If `true`, will preserve the block of variables for a given theme even if
			 * only exporting one theme. By default, variables are applied to the rules
			 * themselves and the resulting CSS will not contain any `var(--variable)`.
			 */
			preserveVariables: boolean;
			/**
			 * Only output the color variables part of the CSS. Forces
			 * `preserveVariables` to be `true`.
			 */
			onlyVariables: boolean;
			/**
			 * Only output the style part of the CSS without any variables. Forces
			 * `preserveVariables` to be `true` and ignores the theme values.
			 * Useful to get the base styles to use multiple themes.
			 */
			onlyStyles: boolean;
			/** Include extra styles from GitHub Flavored Markdown, like code snippets. */
			useFixture: boolean;
			/**
			 * Set the root selector of the rendered Markdown body as it should appear
			 * in the output CSS. Defaults to `.markdown-body`.
			 */
			rootSelector: string;
			/**
			 * Make the background transparent instead of white/black. Useful when
			 * embedding the Markdown content in a page with a custom background.
			 */
			transparentBackground: boolean;
		}>,
	): Promise<string>;
}
