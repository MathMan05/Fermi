export class InstnaceConfig {
	api: string;
	maxGuilds = 100;
	maxBio = 190;
	maxPronouns = 50;
	maxEmoji = 2000;
	maxRoles = 1000;
	maxChars = 2000;
	maxAttachmentSize = 2 << 24;
	maxWebhooks = 100;
	DoBReq = true;
	passwordReq = true;
	registerDisabled = false;
	registerRequireInv = false;
	allowNewRegister = true;
	allowMultipleAccounts = true;
	autoJoin_canLeave = true;
	autoJoin_guilds = [] as string[];
	register_email_required = false;
	can_recover_account = true;
	ready: Promise<void>;

	constructor(api: string) {
		this.api = api;
		this.ready = this.getConfig();
	}
	async getConfig() {
		const conf = (await (await fetch(this.api + "/policies/instance/config")).json()) as {
			limits_user_maxGuilds: number;
			limits_user_maxBio: number;
			limits_user_maxPronouns?: number;
			limits_guild_maxEmojis: number;
			limits_guild_maxRoles: number;
			limits_message_maxCharacters: number;
			limits_message_maxAttachmentSize: number;
			limits_message_maxEmbedDownloadSize: number;
			limits_channel_maxWebhooks: number;
			register_dateOfBirth_required: boolean;
			register_password_required: boolean;
			register_disabled: boolean;
			register_requireInvite: boolean;
			register_allowNewRegistration: boolean;
			register_allowMultipleAccounts: boolean;
			guild_autoJoin_canLeave: boolean;
			guild_autoJoin_guilds_x: string[];
			register_email_required: boolean;
			can_recover_account: boolean;
		};
		this.maxGuilds = conf.limits_user_maxGuilds;
		this.maxBio = conf.limits_user_maxBio;
		this.maxPronouns = conf.limits_user_maxPronouns ?? 50;
		this.maxEmoji = conf.limits_guild_maxEmojis;
		this.maxRoles = conf.limits_guild_maxRoles;
		this.maxChars = conf.limits_message_maxCharacters;
		this.maxAttachmentSize = conf.limits_message_maxAttachmentSize;
		this.maxWebhooks = conf.limits_channel_maxWebhooks;
		this.DoBReq = conf.register_dateOfBirth_required;
		this.passwordReq = conf.register_password_required;
		this.registerDisabled = conf.register_disabled;
		this.registerRequireInv = conf.register_requireInvite;
		this.allowNewRegister = conf.register_allowNewRegistration;
		this.allowNewRegister = conf.register_allowMultipleAccounts;
		this.autoJoin_canLeave = conf.guild_autoJoin_canLeave;
		this.autoJoin_guilds = conf.guild_autoJoin_guilds_x;
		this.register_email_required = conf.register_email_required;
		this.can_recover_account = conf.can_recover_account;
	}
}
