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
