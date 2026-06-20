import {ArrayChecker} from "../../checkers/array";
import {Nullish} from "../../checkers/nullish";
import {ObjectChecker} from "../../checkers/object";
import {Optional} from "../../checkers/optional";
import {fulluser} from "../objects/user";

export const ready = new ObjectChecker({
	op: Number,
	d: {
		_trace: new Optional(new ArrayChecker(String)),
		v: Number,
		user: fulluser,
		//TODO user_settings
		user_settings_proto: String,
		notification_settings: {
			flags: Number,
		},
		user_guild_settings: {
			entries: new ArrayChecker({
				channel_overrides: new ArrayChecker({
					message_notifications: Number,
					muted: Boolean,
					mute_config: new Nullish({
						selected_time_window: Number,
						end_time: Number,
					}),
					channel_id: String,
				}),
				message_notifications: Number,
				flags: Number,
				hide_muted_channels: Boolean,
				mobile_push: Boolean,
				mute_config: new Nullish({
					selected_time_window: Number,
					end_time: Number,
				}),
				mute_scheduled_events: Boolean,
				muted: Boolean,
				notify_highlights: Number,
				suppress_everyone: Boolean,
				suppress_roles: Boolean,
				version: Number,
				guild_id: String,
			}),
			partial: Boolean,
			version: Number,
		},
	},
	s: new Nullish(new Optional(Number)),
	t: new Nullish(new Optional(String)),
});
