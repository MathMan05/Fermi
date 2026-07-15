import {I18n} from "./i18n.js";

class Permissions {
	allow: bigint;
	deny: bigint;
	readonly hasDeny: boolean;
	constructor(allow: string, deny: string = "") {
		this.hasDeny = Boolean(deny);
		try {
			this.allow = BigInt(allow);
			this.deny = BigInt(deny);
		} catch {
			this.allow = 0n;
			this.deny = 0n;
			console.error(
				`Something really stupid happened with a permission with allow being ${allow} and deny being, ${deny}, execution will still happen, but something really stupid happened, please report if you know what caused this.`,
			);
		}
	}
	getPermissionbit(b: number, big: bigint): boolean {
		return Boolean((big >> BigInt(b)) & 1n);
	}
	setPermissionbit(b: number, state: boolean, big: bigint): bigint {
		const bit = 1n << BigInt(b);
		return (big & ~bit) | (BigInt(state) << BigInt(b)); //thanks to geotale for this code :3
	}
	static toMask(perms: string[]): bigint {
		return perms.reduce<bigint>((p, c) => {
			const bit = this.permisions.indexOf(c as any);
			if (bit !== -1) {
				return p | (1n << BigInt(bit));
			}
			return p;
		}, 0n);
	}
	//private static info: { name: string; readableName: string; description: string }[];
	static *info(): Generator<{name: string; readableName: string; description: string}> {
		for (const thing of this.permisions) {
			yield {
				name: thing,
				readableName: I18n.permissions.readableNames[thing](),
				description: I18n.permissions.descriptions[thing](thing),
			};
		}
	}
	static permisions = [
		"CREATE_INSTANT_INVITE",
		"KICK_MEMBERS",
		"BAN_MEMBERS",
		"ADMINISTRATOR",
		"MANAGE_CHANNELS",
		"MANAGE_GUILD",
		"ADD_REACTIONS",
		"VIEW_AUDIT_LOG",
		"PRIORITY_SPEAKER",
		"STREAM",
		"VIEW_CHANNEL",
		"SEND_MESSAGES",
		"SEND_TTS_MESSAGES",
		"MANAGE_MESSAGES",
		"EMBED_LINKS",
		"ATTACH_FILES",
		"READ_MESSAGE_HISTORY",
		"MENTION_EVERYONE",
		"USE_EXTERNAL_EMOJIS",
		"VIEW_GUILD_INSIGHTS",
		"CONNECT",
		"SPEAK",
		"MUTE_MEMBERS",
		"DEAFEN_MEMBERS",
		"MOVE_MEMBERS",
		"USE_VAD",
		"CHANGE_NICKNAME",
		"MANAGE_NICKNAMES",
		"MANAGE_ROLES",
		"MANAGE_WEBHOOKS",
		"MANAGE_GUILD_EXPRESSIONS",
		"USE_APPLICATION_COMMANDS",
		"REQUEST_TO_SPEAK",
		"MANAGE_EVENTS",
		"MANAGE_THREADS",
		"CREATE_PUBLIC_THREADS",
		"CREATE_PRIVATE_THREADS",
		"USE_EXTERNAL_STICKERS",
		"SEND_MESSAGES_IN_THREADS",
		"USE_EMBEDDED_ACTIVITIES",
		"MODERATE_MEMBERS",
		"VIEW_CREATOR_MONETIZATION_ANALYTICS",
		"USE_SOUNDBOARD",
		"CREATE_GUILD_EXPRESSIONS",
		"CREATE_EVENTS",
		"USE_EXTERNAL_SOUNDS",
		"SEND_VOICE_MESSAGES",
		"SEND_POLLS",
		"USE_EXTERNAL_APPS",
		"PIN_MESSAGES",
		"BYPASS_SLOWMODE",
	] as const;
	static noOverwrite = [
		"KICK_MEMBERS",
		"BAN_MEMBERS",
		"ADMINISTRATOR",
		"MANAGE_GUILD",
		"VIEW_AUDIT_LOG",
		"VIEW_GUILD_INSIGHTS",
		"CHANGE_NICKNAME",
		"MANAGE_NICKNAMES",
		"MANAGE_GUILD_EXPRESSIONS",
		"MODERATE_MEMBERS",
		"VIEW_CREATOR_MONETIZATION_ANALYTICS",
		"CREATE_GUILD_EXPRESSIONS",
		"CREATE_EVENTS",
	] satisfies ArrayElement<typeof Permissions.permisions>[];
	static noOverwriteMask = this.toMask(this.noOverwrite);
	getPermission(name: string): number {
		if (undefined === Permissions.permisions.indexOf(name as any)) {
			console.error(name + " is not found in map", Permissions.permisions);
		}
		if (this.getPermissionbit(Permissions.permisions.indexOf(name as any), this.allow)) {
			return 1;
		} else if (this.getPermissionbit(Permissions.permisions.indexOf(name as any), this.deny)) {
			return -1;
		} else {
			return 0;
		}
	}
	hasPermission(name: string, adminOverride = true): boolean {
		if (this.deny) {
			console.warn(
				"This function may of been used in error, think about using getPermision instead",
			);
		}
		if (this.getPermissionbit(Permissions.permisions.indexOf(name as any), this.allow)) return true;
		if (name !== "ADMINISTRATOR" && adminOverride) return this.hasPermission("ADMINISTRATOR");
		return false;
	}
	setPermission(name: string, setto: number): void {
		const bit = Permissions.permisions.indexOf(name as any);
		if (bit === undefined) {
			return console.error(
				"Tried to set permission to " + setto + " for " + name + " but it doesn't exist",
			);
		}

		if (setto === 0) {
			this.deny = this.setPermissionbit(bit, false, this.deny);
			this.allow = this.setPermissionbit(bit, false, this.allow);
		} else if (setto === 1) {
			this.deny = this.setPermissionbit(bit, false, this.deny);
			this.allow = this.setPermissionbit(bit, true, this.allow);
		} else if (setto === -1) {
			this.deny = this.setPermissionbit(bit, true, this.deny);
			this.allow = this.setPermissionbit(bit, false, this.allow);
		} else {
			console.error("invalid number entered:" + setto);
		}
	}
}

type ArrayElement<ArrayType extends readonly unknown[]> =
	ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
export {Permissions};
