type Awaitable<T> = Promise<T> | T;
type TwitterVideoInfo = {
	duration_millis: number;
	variants: {
		bitrate?: number;
		content_type: string;
		url: string;
	}[];
};
type TweetMedia = {
	type: string;
	video_info?: TwitterVideoInfo;
	original_info: {
		height: number;
		width: number;
	};
};
type Tweet = {
	id_str: string;
	created_at: string;
	quoted_tweet?: Tweet;
	parent?: Tweet;
	mediaDetails?: TweetMedia[];
};
type Choice<T = unknown> = {
	label: string;
	value: T;
	default?: boolean;
	fn?: () => void;
};
