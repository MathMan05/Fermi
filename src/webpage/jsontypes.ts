interface readyjson {
	op: 0;
	t: "READY";
	s: number;
	d: {
		_trace?: string[];
		v: number;
		user: mainuserjson;
		user_settings: {
			index: number;
			afk_timeout: number;
			allow_accessibility_detection: boolean;
			animate_emoji: boolean;
			animate_stickers: number;
			contact_sync_enabled: boolean;
			convert_emoticons: boolean;
			custom_status: string;
			default_guilds_restricted: boolean;
			detect_platform_accounts: boolean;
			developer_mode: boolean;
			disable_games_tab: boolean;
			enable_tts_command: boolean;
			explicit_content_filter: 0;
			friend_discovery_flags: 0;
			friend_source_flags: {
				all: boolean;
			}; //might be missing things here
			gateway_connected: boolean;
			gif_auto_play: boolean;
			guild_folders: guildFolder[];
			guild_positions: []; //need an example of this not empty
			inline_attachment_media: boolean;
			inline_embed_media: boolean;
			locale: string;
			message_display_compact: boolean;
			native_phone_integration_enabled: boolean;
			render_embeds: boolean;
			render_reactions: boolean;
			restricted_guilds: []; //need an example of this not empty
			show_current_game: boolean;
			status: string;
			stream_notifications_enabled: boolean;
			theme: string;
			timezone_offset: number;
			view_nsfw_guilds: boolean;
		};
		auth_token?: string;
		guilds: guildjson[];
		relationships: relationJson[];
		read_state: {
			entries: readStateEntry[];
			partial: boolean;
			version: number;
		};
		user_guild_settings: {
			entries: GuildOverrides[];
			partial: boolean;
			version: number;
		};
		private_channels: dirrectjson[];
		session_id: string;
		country_code: string;
		users: userjson[];
		merged_members: [memberjson][];
		sessions: sessionJson[];
		resume_gateway_url: string;
		consents: {
			personalization: {
				consented: boolean;
			};
		};
		experiments: []; //not sure if I need to do this :P
		guild_join_requests: []; //need to get examples
		connected_accounts: []; //need to get examples
		guild_experiments: []; //need to get examples
		geo_ordered_rtc_regions: []; //need to get examples
		api_code_version: number;
		friend_suggestion_count: number;
		analytics_token: string;
		tutorial: boolean;
		session_type: string;
		auth_session_id_hash: string;
		notification_settings: {
			flags: number;
		};
	};
}
export interface readStateEntry {
	id: string;
	channel_id: string;
	last_message_id: string;
	last_pin_timestamp: string;
	mention_count: number; //in theory, the server doesn't actually send this as far as I'm aware
}
export interface sessionJson {
	active: boolean;
	activities: []; //will need to find example of this
	client_info: {
		version: number;
	};
	session_id: string;
	status: string;
}
export interface sesLocation {
	is_eu: boolean;
	city: string | null;
	region: string | null;
	region_code: string | null;
	country_name: string;
	country_code: string;
	continent_name: string;
	continent_code: string;
	latitude: number;
	longitude: number;
	postal: string | null;
	calling_code: string;
	flag: string;
	emoji_flag: string;
	emoji_unicode: string;
}
export interface expSessionJson {
	id: string;
	id_hash: string;
	status: string;
	activities: [];
	client_status: {};
	approx_last_used_time: string;
	client_info: {
		platform?: string;
		location?: string;
		os?: string;
		version?: number;
	};
	last_seen: string;
	last_seen_ip: string;
	last_seen_location: string | null;
	last_seen_location_info: sesLocation | null;
}
export interface GuildOverrides {
	channel_overrides: {
		message_notifications: number;
		muted: boolean;
		mute_config: mute_config | null;
		channel_id: string;
	}[];
	message_notifications: number;
	flags: number;
	hide_muted_channels: boolean;
	mobile_push: boolean;
	mute_config: mute_config | null;
	mute_scheduled_events: boolean;
	muted: boolean;
	notify_highlights: number;
	suppress_everyone: boolean;
	suppress_roles: boolean;
	version: number;
	guild_id: string;
}
export interface mute_config {
	selected_time_window: number;
	end_time: number;
}
export interface guildFolder {
	color?: number | null;
	guild_ids: string[];
	id?: number | null;
	name?: string | null;
}
export interface freq {
	totalUses: number;
	recentUses: string[];
	frecency: -1;
	score: number;
}
//https://docs.discord.food/resources/user-settings-proto#frecency-user-settings-object
export interface favandfreq {
	versions?: {
		client_version: number;
		server_version: number;
		data_version: number;
	};
	favoriteGifs: {
		gifs: {
			[key: string]: {
				format: "GIF_TYPE_IMAGE";
				src: string;
				width: number;
				height: number;
				order: number;
			};
		};
		hideTooltip: boolean;
	};
	emojiFrecency: {
		emojis: {
			[key: string]: freq;
		};
	};
	guildAndChannelFrecency: {
		guildAndChannels: {
			[key: string]: freq;
		};
	};
	emojiReactionFrecency: {
		emojis: {
			[key: string]: freq;
		};
	};
	favorite_stickers: {
		sticker_ids: string[];
	};
	sticker_frecency: {
		stickers: {
			[key: string]: freq;
		};
	};
	favorite_emojis: {
		emojis: string[];
	};
	application_command_frecency: {
		application_commands: {
			[key: string]: freq;
		};
	};
	favorite_soundboard_sounds: string[];
	application_frecency: {
		applications: {
			[key: string]: freq;
		};
	};
	heard_sound_frecency: {
		heard_sounds: {
			[key: string]: freq;
		};
	};
	played_sound_frecency: {
		played_sounds: {
			[key: string]: freq;
		};
	};
}
export interface applicationJson {
	description: string;
	flags: number;
	icon: null | string;
	id: string;
	name: string;
}
export interface commandOptionJson {
	type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
	name: string;
	name_localized?: string;
	name_localizations?: null | Record<string, string>;
	description: string;
	description_localizations?: null | Record<string, string>;
	description_localized?: string;
	choices?:
		| {
				name: string;
				name_localizations?: null | Record<string, string>;
				name_localized?: string | null;
				value: string | number;
		  }[]
		| null;
	options?: commandJson[];
	channel_types?: number[];
	min_value?: number;
	max_value?: number;
	min_length?: number;
	max_length?: number;
	autocomplete?: boolean;
	required?: boolean;
}
export interface commandJson {
	id: string;
	type: 1 | 2 | 3 | 4;
	application_id: string;
	guild_id?: null | string;
	name: string;
	name_localized?: string;
	name_localizations?: null | {[key: string]: string};
	description: string;
	description_localizations?: null | {[key: string]: string};
	options?: commandOptionJson[];
	default_member_permissions?: null | string;
	dm_permission: boolean;
	permissions?: null | {
		user?: boolean;
		roles?: {[key: string]: boolean};
		channels?: {[key: string]: boolean};
	};
	nsfw: boolean;
	integration_types?: null | number[];
	global_popularity_rank: number;
	contexts?: null | number[];
	version: string;
	handler: 0 | 1 | 2 | 3; //0 really shouldn't be here, but it's a bug and should be treated like 1.
}

interface readySuplemental {
	op: 0;
	t: "READY_SUPPLEMENTAL";
	s: number;
	d: {
		merged_presences: {
			guilds: [];
			friends: [];
		};
		merged_members: [];
		lazy_private_channels: [];
		guilds: {
			voice_states: {
				user_id: string;
				suppress: boolean;
				session_id: string;
				self_video: boolean;
				self_mute: boolean;
				self_deaf: boolean;
				self_stream: boolean;
				request_to_speak_timestamp: null;
				mute: boolean;
				deaf: boolean;
				channel_id: string; //weird reasons, don't question it too much
				guild_id: string;
			}[];
			id: string;
			embedded_activities: [];
		}[];
		disclose: [];
	};
}
interface banObj {
	reason: string | null;
	user: {
		username: string;
		discriminator: string;
		id: string;
		avatar: string | null;
		public_flags: number;
	};
}
interface templateSkim {
	id: string;
	code: string;
	name: string;
	description: string;
	usage_count: null | number;
	creator_id: string;
	created_at: string;
	updated_at: string;
	source_guild_id: string;
	serialized_source_guild: {
		id: string;
		afk_channel_id: null | string;
		afk_timeout: number;
		default_message_notifications: number;
		description: null | "string";
		explicit_content_filter: number;
		features: string[];
		icon: null | string;
		large: boolean;
		name: string;
		preferred_locale: string;
		region: string;
		system_channel_id: null | string;
		system_channel_flags: number;
		verification_level: number;
		widget_enabled: boolean;
		nsfw: boolean;
		premium_progress_bar_enabled: boolean;
	};
}
interface addInfoBan {
	id: string;
	user_id: string;
	guild_id: string;
	executor_id: string;
	reason?: string | undefined;
}
type mainuserjson = userjson & {
	flags: number;
	mfa_enabled?: boolean;
	email?: string;
	phone?: string;
	verified: boolean;
	nsfw_allowed: boolean;
	premium: boolean;
	purchased_flags: number;
	premium_usage_flags: number;
	disabled: boolean;
};
type userjson = {
	username: string;
	discriminator: string;
	id: string;
	public_flags: number;
	avatar: string | null;
	accent_color: number;
	banner?: string;
	bio: string;
	bot: boolean;
	premium_since: string;
	premium_type: number;
	theme_colors: [number, number] | null;
	pronouns?: string;
	badge_ids: string[];
	webhook?: webhookInfo;
	uid?: string;
	avatar_decoration_data?: {
		asset: string;
		sku_id: string;
	} | null;
};
type memberjson = {
	index?: number;
	bio?: string;
	id: string;
	user: userjson | null;
	guild_id: string;
	avatar?: string;
	banner?: string;
	guild: {
		id: string;
	} | null;
	presence?: presencejson;
	nick?: string;
	roles: string[];
	joined_at: string;
	premium_since: string;
	deaf: boolean;
	mute: boolean;
	pending: boolean;
	communication_disabled_until?: string;
	last_message_id?: boolean; //What???
};
export type highMemberJSON = mainuserjson & {
	mutual_guilds: {
		id: string;
		nick: null | string;
	}[];
	//Only reason this is optional is due to the fact that this is really new and I want to make sure the type checker checks this for me :3
	mutual_friends?: userjson[];
	connected_accounts: ConnectionJson[];
};
type emojijson = {
	name: string;
	id?: string;
	animated?: boolean;
	emoji?: string;
};
type emojipjson = emojijson & {
	available: boolean;
	guild_id: string;
	user_id: string;
	managed: boolean;
	require_colons: boolean;
	roles: string[];
	groups: null; //TODO figure out what this means lol
};

type guildjson = {
	application_command_counts: {[key: string]: number};
	channels: channeljson[];
	threads: channeljson[];
	data_mode: string;
	emojis: emojipjson[];
	guild_scheduled_events: [];
	id: string;
	large: boolean;
	lazy: boolean;
	member_count: number;
	premium_subscription_count: number;
	properties: {
		region: string | null;
		name: string;
		description: string;
		icon: string;
		splash: string;
		banner: string;
		features: string[];
		preferred_locale: string;
		owner_id: string;
		application_id: string;
		afk_channel_id: string;
		afk_timeout: number;
		member_count: number;
		system_channel_id: string;
		verification_level: number;
		explicit_content_filter: number;
		default_message_notifications: number;
		mfa_level: number;
		vanity_url_code: number;
		premium_tier: number;
		premium_progress_bar_enabled: boolean;
		system_channel_flags: number;
		discovery_splash: string;
		rules_channel_id: string;
		public_updates_channel_id: string;
		max_video_channel_users: number;
		max_members: number;
		nsfw_level: number;
		hub_type: null;
		home_header: null;
		id: string;
		latest_onboarding_question_id: string;
		max_stage_video_channel_users: number;
		nsfw: boolean;
		safety_alerts_channel_id: string;
		welcome_screen?: welcomeScreen;
	};
	//TODO implement onboarding too
	roles: rolesjson[];
	stage_instances: [];
	stickers: stickerJson[];
	version: string;
	guild_hashes: {};
	joined_at: string;
};
export interface welcomeScreen {
	enabled: boolean;
	description: string;
	welcome_channels: {
		description: string;
		emoji_id?: string;
		emoji_name?: string;
		channel_id: string;
	}[];
}
interface stickerJson {
	id: string;
	name: string;
	tags: string;
	type: number;
	format_type: number;
	description?: string;
	guild_id?: string;
}
type extendedProperties = guildjson["properties"] & {
	emojis: emojipjson[];
	large: boolean;
};
type startTypingjson = {
	d: {
		channel_id: string;
		guild_id?: string;
		user_id: string;
		timestamp: number;
		member?: memberjson;
	};
};
export interface threadMember {
	id: string;
	user_id: string;
	join_timestamp: string;
	flags: number;
	muted: boolean;
	mute_config?: {
		end_time?: string;
		selected_time_window?: number;
	};
	member?: memberjson;
}
export interface tagjson {
	name: string;
	id: string;
	moderated: boolean;
	emoji_id?: string;
	emoji_name?: string;
}
type channeljson = {
	member_count?: number;
	message_count?: number;
	applied_tags?: string[];
	available_tags?: tagjson[];
	total_message_sent?: number;
	member: threadMember;
	id: string;
	rate_limit_per_user?: number;
	owner_id?: string;
	created_at: string;
	name: string;
	icon: string;
	type: number;
	last_message_id: string;
	guild_id: string;
	parent_id: string;
	last_pin_timestamp: string;
	default_auto_archive_duration: number;
	thread_metadata?: threadMetadata;
	permission_overwrites: {
		id: string;
		allow: string;
		deny: string;
	}[];
	video_quality_mode: null;
	nsfw: boolean;
	topic: string;
	retention_policy_id: string;
	flags: number;
	default_thread_rate_limit_per_user: number;
	position: number;
};
export interface emojiSource {
	type: "GUILD" | "APPLICATION";
	guild?: {
		id: string;
		name: string;
		icon: string | null;
		description?: string;
		features: string[];
		nsfw: boolean;
	};
	application?: {
		id: string;
		name: string;
	};
}
type rolesjson = {
	id: string;
	guild_id: string;
	color: number;
	hoist: boolean;
	managed: boolean;
	mentionable: boolean;
	name: string;
	permissions: string;
	position: number;
	icon: string;
	unicode_emoji: string;
	flags: number;
	colors?: {
		primary_color: number;
		secondary_color?: number | null;
		tertiary_color?: number | null;
	};
};
type dirrectjson = {
	id: string;
	flags: number;
	name?: string | null;
	icon?: string;
	last_message_id: string;
	type: number;
	recipients: userjson[];
	is_spam: boolean;
	owner_id?: string;
};
type webhookType = {
	application_id: null | string;
	avatar: null | string;
	channel_id: string;
	guild_id: string;
	id: string;
	name: string;
	type: 1 | 2 | 3;
	user: userjson;
	token: string;
	url: string;
};
type webhookInfo = {
	id: string;
	type: 1;
	name: string;
	avatar: null | string;
	guild_id: string;
	channel_id: string;
	application_id: null | string;
	user_id: string;
	source_guild_id: string;
	source_channel_id: string;
};
export enum MessageComponentType {
	ActionRow = 1,
	Button = 2,
	StringSelect = 3,
	TextInput = 4,
	UserSelect = 5,
	RoleSelect = 6,
	MentionableSelect = 7,
	ChannelSelect = 8,
	Section = 9,

	TextDisplay = 10,
	Thumbnail = 11,
	MediaGallery = 12,
	File = 13,
	Separator = 14,
	// 15 is unknown?
	ContentInventoryEntry = 16, // activity feed entry
	Container = 17,
	Label = 18,
	FileUpload = 19,
	CheckpointCard = 20, // year in review 2026
	RadioGroup = 21,
	CheckboxGroup = 22,
	Checkbox = 23,
}
export interface actionRow {
	type: MessageComponentType.ActionRow;
	components: component[];
}
export interface button {
	type: MessageComponentType.Button;
	id?: number;
	custom_id: string;
	label?: string;
	sku_id?: string;
	url?: string;
	disabled?: boolean;
	emoji?: emojijson;
	style: 1 | 2 | 3 | 4 | 5 | 6;
}
export interface section {
	type: MessageComponentType.Section;
	id?: number;
	components: component[];
	accessory: button | thumbnail;
}
export interface select {
	type: MessageComponentType.StringSelect;
	id?: number;
	custom_id: string;
	options: {
		label: string;
		value: string;
		description?: string;
		emoji?: emojijson;
		default?: boolean;
	}[];
	placeholder?: string;
	min_values?: number;
	max_values?: number;
	required?: boolean;
	disabled?: boolean;
}
export interface container {
	type: MessageComponentType.Container;
	id?: number;
	components: component[];
	accent_color?: number;
	spoiler?: boolean;
}
export interface textDisp {
	type: MessageComponentType.TextDisplay;
	id?: number;
	content: string;
}
export interface UnfurledMediaItem {
	id: string;
	url: string;
	proxy_url?: string;
	height?: number;
	width?: number;
	flags?: number;
	content_type: string;
	content_scan_metadata?: unknown; //TODO deal with this lol
	placeholder_version?: number;
	placeholder?: string;
	loading_state?: number;
	attachment_id?: string;
}
export interface mediaGallery {
	type: MessageComponentType.MediaGallery;
	id?: number;
	items: {
		media: UnfurledMediaItem;
		description?: string;
		spoiler?: boolean;
	}[];
}
export interface seperator {
	type: MessageComponentType.Separator;
	id?: number;
	divider?: boolean;
	spacing?: 1 | 2;
}
export interface thumbnail {
	type: MessageComponentType.Thumbnail;
	id?: number;
	media: UnfurledMediaItem;
	description?: string;
	spoiler?: string;
}
export type component =
	| actionRow
	| button
	| select
	| container
	| textDisp
	| seperator
	| mediaGallery
	| section
	| thumbnail;

type messagejson = {
	id: string;
	channel_id: string;
	guild_id: string;
	author: userjson;
	member?: memberjson;
	content: string;
	timestamp: string;
	edited_timestamp: string | null;
	tts: boolean;
	mention_everyone: boolean;
	mentions: []; //need examples to fix
	mention_roles?: []; //need examples to fix
	attachments: filejson[];
	embeds: embedjson[];
	components?: component[] | null; //TODO remove this once spacebar fixes the null bug
	reactions?: {
		count: number;
		emoji: emojijson; //very likely needs expanding
		me: boolean;
	}[];
	thread?: channeljson;
	interaction?: {
		id: string;
		type: 2 | 3;
		user: userjson;
	};
	interaction_metadata?: {
		authorizing_integration_owners: {
			//User ids
			[key: string]: string;
		};
		id: string;
		type: 2 | 3;
		user: userjson;
	};
	nonce: string;
	pinned: boolean;
	type: number;
	webhook?: webhookInfo;
	sticker_items: stickerJson[];
	message_reference?: string;
	referenced_message?: messagejson;
};

export interface threadMetadata {
	archived: boolean;
	auto_archive_duration: number;
	archive_timestamp: string;
	locked: boolean;
	invitable?: boolean;
	create_timestamp: string; //Discord docs say this is optional, but it's only for after a certain date so it's not
}
type filejson = {
	id: string;
	filename: string;
	content_type: string;
	width?: number;
	height?: number;
	proxy_url?: string;
	url: string;
	size: number;
};
type embedjson = {
	type: string | null;
	color?: number;
	author: {
		icon_url?: string;
		name?: string;
		url?: string;
		title?: string;
	};
	title?: string;
	url?: string;
	description?: string;
	fields?: {
		name: string;
		value: string;
		inline: boolean;
	}[];
	footer?: {
		icon_url?: string;
		text?: string;
		thumbnail?: string;
	};
	image?: {
		proxy_url?: string;
		url: string;
		width?: number;
		height?: number;
	};
	timestamp?: string;
	thumbnail: {
		proxy_url: string;
		url: string;
		width: number;
		height: number;
	};
	provider: {
		name: string;
	};
	video?: {
		url: string;
		width?: number | null;
		height?: number | null;
		proxy_url?: string;
	};
	invite?: {
		url: string;
		code: string;
	};
};
type invitejson = {
	code: string;
	temporary: boolean;
	uses: number;
	max_uses: number;
	max_age: number;
	created_at: string;
	expires_at: string | null;
	guild_id: string;
	channel_id: string;
	inviter_id: string;
	target_user_id: string | null;
	target_user_type: string | null;
	vanity_url: string | null;
	flags: number;
	guild: guildjson["properties"];
	channel: channeljson;
	inviter: userjson;
};
type presencejson = {
	status: string;
	since: number | null;
	activities: any[]; //bit more complicated but not now
	afk: boolean;
	user?: userjson;
};
type messageCreateJson = {
	op: 0;
	d: {
		guild_id?: string;
		channel_id?: string;
	} & messagejson;
	s: number;
	t: "MESSAGE_CREATE";
};
export interface relationJson {
	id: string;
	type: 0 | 1 | 2 | 3 | 4;
	nickname: string | null;
	user: userjson;
}
type roleCreate = {
	op: 0;
	t: "GUILD_ROLE_CREATE";
	d: {
		guild_id: string;
		role: rolesjson;
	};
	s: 6;
};
type wsjson =
	| readySuplemental
	| roleCreate
	| {
			op: 0;
			d: any;
			s: number;
			t:
				| "TYPING_START"
				| "USER_UPDATE"
				| "CHANNEL_UPDATE"
				| "CHANNEL_CREATE"
				| "CHANNEL_DELETE"
				| "GUILD_DELETE"
				| "GUILD_CREATE"
				| "MESSAGE_REACTION_REMOVE_ALL"
				| "MESSAGE_REACTION_REMOVE_EMOJI"
				| "THREAD_CREATE";
	  }
	| {
			op: 0;
			t: "GUILD_MEMBERS_CHUNK";
			d: memberChunk;
			s: number;
	  }
	| {
			op: 0;
			d: {
				id: string;
				guild_id?: string;
				channel_id: string;
			};
			s: number;
			t: "MESSAGE_DELETE";
	  }
	| {
			op: 0;
			d: ConnectionJson;
			s: number;
			t: "USER_CONNECTIONS_UPDATE";
	  }
	| {
			op: 0;
			t: "THREAD_MEMBERS_UPDATE";
			d: {
				guild_id: string;
				id: string;
				member_count: number;
				added_members?: [threadMember];
				removed_member_ids?: string[];
			};
			s: 3;
	  }
	| {
			op: 0;
			d: {
				guild_id?: string;
				channel_id: string;
			} & messagejson;
			s: number;
			t: "MESSAGE_UPDATE";
	  }
	| messageCreateJson
	| readyjson
	| {
			op: 11;
			s: undefined;
			d: {};
	  }
	| {
			op: 10;
			s: undefined;
			d: {
				heartbeat_interval: number;
			};
	  }
	| {
			op: 0;
			t: "MESSAGE_REACTION_ADD";
			d: {
				user_id: string;
				channel_id: string;
				message_id: string;
				guild_id?: string;
				emoji: emojijson;
				member?: memberjson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "MESSAGE_REACTION_REMOVE";
			d: {
				user_id: string;
				channel_id: string;
				message_id: string;
				guild_id: string;
				emoji: emojijson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_ROLE_UPDATE";
			d: {
				guild_id: string;
				role: rolesjson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_ROLE_DELETE";
			d: {
				guild_id: string;
				role_id: string;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_MEMBER_UPDATE";
			d: memberjson;
			s: 3;
	  }
	| {
			op: 9;
			d: boolean;
			s: number;
	  }
	| memberlistupdatejson
	| voiceupdate
	| voiceserverupdate
	| {
			op: 0;
			t: "RELATIONSHIP_ADD";
			d: relationJson;
			s: number;
	  }
	| {
			op: 0;
			t: "RELATIONSHIP_REMOVE";
			d: relationJson;
			s: number;
	  }
	| {
			op: 0;
			t: "RELATIONSHIP_UPDATE";
			d: relationJson;
			s: number;
	  }
	| {
			op: 0;
			t: "PRESENCE_UPDATE";
			d: presencejson;
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_MEMBER_ADD";
			d: memberjson;
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_MEMBER_REMOVE";
			d: {
				guild_id: string;
				user: userjson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_EMOJIS_UPDATE";
			d: {
				guild_id: string;
				emojis: emojipjson[];
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_UPDATE";
			d: extendedProperties;
			s: number;
	  }
	| {
			op: 0;
			t: "CHANNEL_PINS_UPDATE";
			d: {
				channel_id: string;
				guild_id: string;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "GUILD_STICKERS_UPDATE";
			d: {
				guild_id: string;
				stickers: stickerJson[];
			};
			s: number;
	  }
	| streamServerUpdate
	| streamCreate
	| interactionEvents
	| {
			op: 0;
			t: "CHANNEL_RECIPIENT_ADD";
			d: {
				channel_id: string;
				user: userjson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "CHANNEL_RECIPIENT_REMOVE";
			d: {
				channel_id: string;
				user: userjson;
			};
			s: number;
	  }
	| {
			op: 0;
			t: "MESSAGE_ACK";
			d: {
				channel_id: string;
				message_id: string;
				version: number; //I don't think this really matters lol
			};
			s: number;
	  };

export interface interactionCreate {
	op: 0;
	t: "INTERACTION_CREATE";
	d: {
		id: string;
		nonce: string;
	};
	s: number;
}
export interface interactionSuccess {
	op: 0;
	t: "INTERACTION_SUCCESS";
	d: {
		id: string;
		nonce: string;
	};
	s: number;
}
export interface interactionFailure {
	op: 0;
	t: "INTERACTION_FAILURE";
	d: {
		id: string;
		nonce: string;
		reason_code: number;
	};
	s: number;
}
export type interactionEvents = interactionCreate | interactionSuccess | interactionFailure;
type memberChunk = {
	guild_id: string;
	nonce: string;
	members: memberjson[];
	presences: presencejson[];
	chunk_index: number;
	chunk_count: number;
	not_found: string[];
};
export type voiceStatus = {
	guild_id: string;
	channel_id: string;
	user_id: string;
	member?: memberjson;
	session_id: string;
	deaf: boolean;
	mute: boolean;
	self_deaf: boolean;
	self_mute: boolean;
	self_video: boolean;
	self_stream: boolean;
	suppress: boolean;
};
export interface streamCreate {
	op: 0;
	t: "STREAM_CREATE";
	d: {
		stream_key: string;
		rtc_server_id: string;
		viewer_ids: string[];
		region: "spacebar";
		paused: boolean;
	};
	s: number;
}
export interface streamServerUpdate {
	op: 0;
	t: "STREAM_SERVER_UPDATE";
	d: {
		token: string;
		stream_key: string;
		guild_id: null; //There is no way this ain't a server bug lol
		endpoint: string;
	};
	s: number;
}
type voiceupdate = {
	op: 0;
	t: "VOICE_STATE_UPDATE";
	d: voiceStatus;
	s: number;
};
type voiceserverupdate = {
	op: 0;
	t: "VOICE_SERVER_UPDATE";
	d: {
		token: string;
		guild_id: string;
		endpoint: string;
	};
	s: 6;
};
type memberlistupdatejson = {
	op: 0;
	s: number;
	t: "GUILD_MEMBER_LIST_UPDATE";
	d: {
		ops: [
			{
				items: (
					| {
							group: {
								count: number;
								id: string;
							};
					  }
					| {
							member: memberjson;
					  }
				)[];
				op: "SYNC";
				range: [number, number];
			},
		];
		online_count: number;
		member_count: number;
		id: string;
		guild_id: string;
		groups: {
			count: number;
			id: string;
		}[];
	};
};
type webRTCSocket =
	| {
			op: 8;
			d: {
				heartbeat_interval: number;
			};
	  }
	| {
			op: 6;
			d: {t: number};
	  }
	| {
			op: 2;
			d: {
				ssrc: number;
				streams: {
					type: "video"; //probally more options, but idk
					rid: string;
					quality: number;
					ssrc: number;
					rtx_ssrc: number;
				}[];
				ip: number;
				port: number;
				modes: []; //no clue
				experiments: []; //no clue
			};
	  }
	| sdpback
	| opRTC12
	| {
			op: 5;
			d: {
				user_id: string;
				speaking: 0;
				ssrc: 940464811;
			};
	  };

type sdpback = {
	op: 4;
	d: {
		audioCodec: string;
		videoCodec: string;
		media_session_id: string;
		sdp: string;
	};
};
type opRTC12 = {
	op: 12;
	d: {
		user_id: string;
		audio_ssrc: number;
		video_ssrc: number;
		streams: [
			{
				type: "video";
				rid: "100";
				ssrc: number;
				active: boolean;
				quality: 100;
				rtx_ssrc: number;
				max_bitrate: 2500000;
				max_framerate: number;
				max_resolution: {
					type: "fixed";
					width: number;
					height: number;
				};
			},
		];
	};
};
export interface ConnectionJson {
	id: string;
	external_id: string;
	friend_sync: boolean;
	name: string;
	revoked: boolean;
	show_activity: number;
	type: string; //While it is kinda an enum, we must act like it's just a generic "type"
	verified: boolean;
	visibility: number;
	integrations: []; //idk
	metadata_visibility: number;
	two_way_link: boolean;
	metadata?: {
		created_at: "2020-09-10T23:37:05.000+00:00";
	};
}

export {
	readyjson,
	dirrectjson,
	startTypingjson,
	channeljson,
	guildjson,
	rolesjson,
	userjson,
	memberjson,
	mainuserjson,
	messagejson,
	filejson,
	embedjson,
	emojijson,
	presencejson,
	wsjson,
	messageCreateJson,
	memberChunk,
	invitejson,
	memberlistupdatejson,
	voiceupdate,
	voiceserverupdate,
	webRTCSocket,
	sdpback,
	opRTC12,
	emojipjson,
	extendedProperties,
	webhookInfo,
	webhookType,
	stickerJson,
	banObj,
	addInfoBan,
	templateSkim,
};
