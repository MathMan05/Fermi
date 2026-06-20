import {Nullish} from "../../checkers/nullish";
import {ObjectChecker} from "../../checkers/object";
import {Optional} from "../../checkers/optional";
import {snowflake} from "../snowflake";
export const fulluser = new ObjectChecker({
	id: snowflake,
	username: String,
	discriminator: /\d\d\d\d/,
	global_name: new Nullish(new Optional(String)),
	avatar: new Nullish(String),
	avatar_decoration_data: new Nullish(
		new Optional({
			asset: String,
			sku_id: String,
		}),
	),
	//TODO collectibles, display_name_styles, primary_guild, linked_users, premium_state
	bot: new Optional(Boolean),
	system: new Optional(Boolean),
	mfa_enabled: Boolean,
	nsfw_allowed: new Nullish(new Optional(Boolean)),
	age_verification_status: new Optional(Number),
	pronouns: new Optional(String),
	bio: String,
	banner: new Optional(new Nullish(String)),
	accent_color: new Optional(new Nullish(Number)),
	locale: new Optional(String),
	verified: new Optional(Boolean),
	email: new Nullish(String),
	phone: new Optional(new Nullish(String)),
	premium: Boolean,
	premium_type: Number,
	personal_connection_id: new Optional(snowflake),
	flags: new Optional(Number),
	public_flags: Number,
	purchased_flags: new Optional(Number),
	premium_usage_flags: new Optional(Number),
	desktop: new Optional(Number),
	mobile: new Optional(Number),
	has_bounced_email: new Optional(Boolean),
	authenticator_types: new Optional(new Array(Number)),
	analytics_token: new Optional(String),
});
export const partialuser = new ObjectChecker({
	id: snowflake,
	username: String,
	discriminator: /\d\d\d\d/,
	global_name: new Nullish(new Optional(String)),
	avatar: new Nullish(String),
	avatar_decoration_data: new Nullish(
		new Optional({
			asset: String,
			sku_id: String,
		}),
	),
	//TODO collectibles, display_name_styles, primary_guild, linked_users
	bot: new Optional(Boolean),
	system: new Optional(Boolean),
	mfa_enabled: Boolean,
	nsfw_allowed: new Nullish(new Optional(Boolean)),
	age_verification_status: new Optional(Number),
	pronouns: new Optional(String),
	bio: String,
	banner: new Optional(new Nullish(String)),
	accent_color: new Optional(new Nullish(Number)),
	public_flags: new Optional(Number),
});
