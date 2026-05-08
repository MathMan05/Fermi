import {Member} from "./member.js";
import {MarkDown} from "./markdown.js";
import {Contextmenu} from "./contextmenu.js";
import {Localuser} from "./localuser.js";
import {Guild} from "./guild.js";
import {SnowFlake} from "./snowflake.js";
import {
	ConnectionJson,
	highMemberJSON,
	presencejson,
	relationJson,
	userjson,
	webhookInfo,
} from "./jsontypes.js";
import {Role} from "./role.js";
import {Search} from "./search.js";
import {I18n} from "./i18n.js";
import {Hover} from "./hover.js";
import {Dialog, Float, Options} from "./settings.js";
import {createImg, removeAni, safeImg} from "./utils/utils.js";
import {Direct} from "./direct.js";
import {Permissions} from "./permissions.js";
import {Channel} from "./channel.js";
import {getDeveloperSettings} from "./utils/storage/devSettings";
import {ReportMenu} from "./reporting/report.js";
import {CDNParams} from "./utils/cdnParams.js";
export const userVolMenu = new Contextmenu<Localuser, string>("user vol stacked", true);
userVolMenu.addSlider(
	() => I18n.Voice.userVol(),
	(local, id, e) => {
		local.setUserAudio(id, e);
	},
	undefined,
	"default",
	{
		startVal: (local, id) => {
			return local.getUserAudio(id);
		},
	},
);
class User extends SnowFlake {
	owner: Localuser;
	hypotheticalpfp!: boolean;
	avatar!: string | null;
	uid: string;
	username!: string;
	nickname: string | null = null;
	relationshipType: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0;
	bio!: MarkDown;
	discriminator!: string;
	pronouns?: string;
	bot!: boolean;
	public_flags!: number;
	webhook?: webhookInfo;
	accent_color!: number;
	banner: string | undefined;
	hypotheticalbanner!: boolean;
	premium_since!: string;
	premium_type!: number;
	theme_colors: [number, number] | null = null;
	badge_ids!: string[];
	members: WeakMap<Guild, Member | undefined | Promise<Member | undefined>> = new WeakMap();
	status!: string;
	avatar_decoration_data?: {
		asset: string;
		sku_id: string;
	} | null;

	resolving: false | Promise<any> = false;
	get headers() {
		return this.localuser.headers;
	}

	constructor(userjson: userjson, owner: Localuser, dontclone: boolean = false) {
		super(userjson.id);
		this.owner = owner;
		if (getDeveloperSettings().logBannedFields && owner.user && owner.user.id !== userjson.id) {
			this.checkfortmi(userjson);
		}
		if (!owner) {
			console.error("missing localuser");
		}
		this.uid = userjson.id;
		if (userjson.webhook) {
			this.uid += ":::" + userjson.username;
			console.log(this.uid);
		}
		userjson.uid = this.uid;
		if (dontclone) {
			this.userupdate(userjson);
			this.hypotheticalpfp = false;
		} else {
			return User.checkuser(userjson, owner);
		}
	}
	static makeSelector(
		opt: Options,
		doneText: string,
		options: User[],
		{single = false, addText = I18n.add()} = {},
	): Promise<Set<User> | void> {
		return new Promise<Set<User> | void>((res) => {
			const div = document.createElement("div");
			div.classList.add("flexttb", "friendGroupSelect");

			const invited = new Set<User>();

			const makeList = (search: string) => {
				const list = options
					.map((user) => [user, user.compare(search)] as const)
					.filter((_) => _[1] !== 0)
					.sort((a, b) => a[1] - b[1])
					.map((_) => _[0]);
				div.innerHTML = "";
				div.append(
					...list.map((user) => {
						const div = document.createElement("div");
						div.classList.add("flexltr");

						//TODO implement status stuff here once spacebar really supports it
						div.append(user.buildpfp(), user.name);
						if (single) {
							const button = document.createElement("button");
							button.textContent = addText;
							div.append(button);
							button.onclick = () => res(new Set([user]));
						} else {
							const check = document.createElement("input");
							check.type = "checkbox";
							check.checked = invited.has(user);
							check.onchange = () => {
								if (check.checked) {
									invited.add(user);
								} else {
									invited.delete(user);
								}
							};
							div.append(check);
						}
						return div;
					}),
				);
			};
			opt.addTextInput("", () => {}).onchange = makeList;
			opt.addHTMLArea(div);
			const buttons = opt.addOptions("", {ltr: true});
			buttons.addButtonInput("", I18n.cancel(), () => {
				res();
			});
			buttons.addButtonInput("", doneText, async () => {
				res(invited);
			});

			makeList("");
			buttons.container.deref()?.classList.add("expandButtons");
		});
	}
	compare(str: string) {
		function similar(str2: string | null | undefined) {
			if (!str2) return 0;
			const strl = Math.max(str.length, 1);
			if (str2.includes(str)) {
				return strl / str2.length;
			} else if (str2.toLowerCase().includes(str.toLowerCase())) {
				return strl / str2.length / 1.2;
			}
			return 0;
		}
		return Math.max(
			similar(this.name),
			similar(this.nickname),
			similar(this.username),
			similar(this.id) / 1.5,
		);
	}
	/**
	 * function is meant to check if userjson contains too much information IE non-public stuff
	 *
	 *
	 */
	checkfortmi(json: any) {
		if (json.data) {
			console.error("Server sent *way* too much info, this is really bad, it sent data");
		}
		const bad = new Set([
			"fingerprints",
			"extended_settings",
			"mfa_enabled",
			"nsfw_allowed",
			"premium_usage_flags",
			"totp_last_ticket",
			"totp_secret",
			"webauthn_enabled",
		]);
		if (!this.localuser.rights.getPermission("OPERATOR")) {
			//Unless the user is an operator, we really shouldn't ever see this
			bad.add("rights");
		}
		for (const thing of bad) {
			if (json.hasOwnProperty(thing)) {
				console.error(thing + " should not be exposed to the client");
			}
		}
	}
	tojson(): userjson {
		return {
			username: this.username,
			id: this.id,
			public_flags: this.public_flags,
			discriminator: this.discriminator,
			avatar: this.avatar,
			accent_color: this.accent_color,
			banner: this.banner,
			bio: this.bio.rawString,
			premium_since: this.premium_since,
			premium_type: this.premium_type,
			bot: this.bot,
			theme_colors: this.theme_colors,
			pronouns: this.pronouns,
			badge_ids: this.badge_ids,
		};
	}

	clone(): User {
		const json = this.tojson();
		json.id += "#clone";
		return new User(json, this.owner);
	}

	public getPresence(presence: presencejson | undefined): void {
		if (presence) {
			this.setstatus(presence.status);
		} else {
			this.setstatus("offline");
		}
	}
	get online() {
		return this.status && this.status != "offline";
	}
	setstatus(status: string): void {
		this.status = status;
		const has = this.statusChange();
		if (has) this.localstatusUpdate();
	}

	getStatus(): string {
		return this.status || "offline";
	}

	static contextmenu = new Contextmenu<User, Member | undefined>("User Menu");
	async opendm(message?: string) {
		for (const dm of (this.localuser.guildids.get("@me") as Direct).channels) {
			if ((dm.type === 1 || dm.type === undefined) && dm.users[0].id === this.id) {
				await this.localuser.goToChannel(dm.id);
				if (message) {
					await dm.sendMessage(message, {
						attachments: [],
						embeds: [],
						replyingto: null,
						sticker_ids: [],
					});
				}

				return;
			}
		}

		await fetch(this.info.api + "/users/@me/channels", {
			method: "POST",
			body: JSON.stringify({recipients: [this.id]}),
			headers: this.localuser.headers,
		})
			.then((res) => res.json())
			.then((json) => {
				return this.localuser.goToChannel(json.id);
			});
		if (message) {
			for (const dm of (this.localuser.guildids.get("@me") as Direct).channels) {
				if ((dm.type === 1 || dm.type === undefined) && dm.users[0].id === this.id) {
					dm.sendMessage(message, {
						attachments: [],
						embeds: [],
						replyingto: null,
						sticker_ids: [],
					});
					return;
				}
			}
		}
		return;
	}
	async changeRelationship(type: 0 | 1 | 2 | 3 | 4 | 5) {
		if (type !== 0) {
			await fetch(`${this.info.api}/users/@me/relationships/${this.id}`, {
				method: "PUT",
				headers: this.owner.headers,
				body: JSON.stringify({
					type,
				}),
			});
		} else {
			await fetch(`${this.info.api}/users/@me/relationships/${this.id}`, {
				method: "DELETE",
				headers: this.owner.headers,
			});
		}
		this.relationshipType = type;
	}
	static setUpContextMenu(): void {
		this.contextmenu.addButton(
			() => I18n.user.message(),
			function (this: User) {
				this.opendm();
			},
			{
				icon: {
					css: "svg-frmessage",
				},
			},
		);

		this.contextmenu.addSeperator();

		this.contextmenu.addButton(
			() => I18n.user.block(),
			function (this: User) {
				this.block();
			},
			{
				visible: function () {
					return this.relationshipType !== 2 && this.id !== this.localuser.user.id;
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.user.unblock(),
			function (this: User) {
				this.unblock();
			},
			{
				visible: function () {
					return this.relationshipType === 2 && this.id !== this.localuser.user.id;
				},
			},
		);
		this.contextmenu.addButton(
			() => I18n.user.friendReq(),
			function (this: User) {
				this.changeRelationship(1);
			},
			{
				visible: function () {
					return (
						(this.relationshipType === 0 || this.relationshipType === 3) &&
						this.id !== this.localuser.user.id &&
						!this.bot
					);
				},
				icon: {
					css: "svg-addfriend",
				},
			},
		);
		this.contextmenu.addButton(
			() => I18n.friends.removeFriend(),
			function (this: User) {
				this.changeRelationship(0);
			},
			{
				visible: function () {
					return this.relationshipType === 1 && this.id !== this.localuser.user.id;
				},
			},
		);
		this.contextmenu.addButton(
			function () {
				switch (this.relationshipType) {
					case 1:
						return I18n.user.nick.friend();
					case 2:
						return I18n.user.nick.foe();
					case 3:
						return I18n.user.nick.stalker();
					case 4:
						return I18n.user.nick.stalking();
					default:
						return "You shouldn't see this";
				}
			},
			function (this: User) {
				this.setFriendNick();
			},
			{
				visible: function () {
					return new Set([1, 2, 3, 4]).has(this.relationshipType);
				},
			},
		);

		this.contextmenu.addSeperator();

		this.contextmenu.addButton(
			() => I18n.user.editServerProfile(),
			function (this: User, member: Member | undefined) {
				if (!member) return;
				member.showEditProfile();
			},
			{
				visible: function (member) {
					return member?.id === this.localuser.user.id;
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.user.editNick(),
			function (this: User, member: Member | undefined) {
				if (!member) return;
				member.showEditNick();
			},
			{
				visible: function (member) {
					return (
						!!member &&
						member?.id !== this.localuser.user.id &&
						member.guild.member.hasPermission("MANAGE_NICKNAMES")
					);
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.user.timeout(),
			function (this: User, member: Member | undefined) {
				member?.timeout();
			},
			{
				visible: function (member) {
					if (!member) return false;
					if (member.hasPermission("MODERATE_MEMBERS")) return false;

					return (
						!member.commuicationDisabledLeft() &&
						member.guild.member.hasPermission("MODERATE_MEMBERS")
					);
				},
				color: "red",
				icon: {
					css: "svg-timeout",
				},
			},
		);
		this.contextmenu.addButton(
			() => I18n.user.unTimeout(),
			function (memb) {
				memb?.removeTimeout();
			},
			{
				visible: function (member) {
					if (!member) return false;

					return (
						!!member.commuicationDisabledLeft() &&
						member.guild.member.hasPermission("MODERATE_MEMBERS")
					);
				},
				color: "red",
			},
		);

		//TODO kick icon
		this.contextmenu.addButton(
			() => I18n.user.kick(),
			function (this: User, member: Member | undefined) {
				member?.kick();
			},
			{
				visible: function (member) {
					if (!member) return false;
					const us = member.guild.member;
					if (member.id === us.id) {
						return false;
					}
					if (member.id === member.guild.properties.owner_id) {
						return false;
					}
					return us.hasPermission("KICK_MEMBERS") && this.id !== this.localuser.user.id;
				},
				color: "red",
			},
		);

		//TODO ban icon
		this.contextmenu.addButton(
			() => I18n.user.ban(),
			function (this: User, member: Member | undefined) {
				member?.ban();
			},
			{
				visible: function (member) {
					if (!member) return false;
					const us = member.guild.member;
					if (member.id === us.id) {
						return false;
					}
					if (member.id === member.guild.properties.owner_id) {
						return false;
					}
					return us.hasPermission("BAN_MEMBERS") && this.id !== this.localuser.user.id;
				},
				color: "red",
			},
		);

		this.contextmenu.addSeperator();

		this.contextmenu.addButton(
			() => I18n.user.addRole(),
			async function (this: User, member: Member | undefined, e) {
				if (member) {
					e.stopPropagation();
					const roles: [Role, string[]][] = [];
					for (const role of member.guild.roles) {
						if (!role.canManage() || member.roles.indexOf(role) !== -1) {
							continue;
						}
						roles.push([role, [role.name]]);
					}
					const search = new Search(roles);
					const result = await search.find(e.x, e.y);
					if (!result) return;
					member.addRole(result);
				}
			},
			{
				visible: (member) => {
					if (!member) return false;
					const us = member.guild.member;
					console.log(us.hasPermission("MANAGE_ROLES"));
					return us.hasPermission("MANAGE_ROLES") || false;
				},
			},
		);
		this.contextmenu.addButton(
			() => I18n.user.removeRole(),
			async function (this: User, member: Member | undefined, e) {
				if (member) {
					e.stopPropagation();
					const roles: [Role, string[]][] = [];
					for (const role of member.roles) {
						if (!role.canManage()) {
							continue;
						}
						roles.push([role, [role.name]]);
					}
					const search = new Search(roles);
					const result = await search.find(e.x, e.y);
					if (!result) return;
					member.removeRole(result);
				}
			},
			{
				visible: (member) => {
					if (!member) return false;
					const us = member.guild.member;
					console.log(us.hasPermission("MANAGE_ROLES"));
					return us.hasPermission("MANAGE_ROLES") || false;
				},
			},
		);

		this.contextmenu.addSeperator();
		this.contextmenu.addButton(
			() => I18n.user.copyId(),
			function (this: User) {
				navigator.clipboard.writeText(this.id);
			},
		);

		this.contextmenu.addSeperator();

		this.contextmenu.addButton(
			() => I18n.user.report(),
			async function (member) {
				const menu = await ReportMenu.makeReport("user", this.localuser, {user: this, member});
				menu?.spawnMenu();
			},
			{
				visible: function () {
					const settings = getDeveloperSettings();
					return this.id !== this.localuser.user.id && settings.reportSystem;
				},
				color: "red",
			},
		);
		this.contextmenu.addButton(
			() => I18n.user.reportApp(),
			async function () {
				const menu = await ReportMenu.makeReport("application", this.localuser, {
					application_id: this.id,
				});
				menu?.spawnMenu();
			},
			{
				visible: function () {
					const settings = getDeveloperSettings();
					return this.bot && settings.reportSystem;
				},
				color: "red",
			},
		);

		this.contextmenu.addButton(
			() => I18n.user.instanceBan(),
			function (this: User) {
				const params = {
					reason: "",
					persistInstanceBan: true,
				};
				const menu = new Dialog("");
				const options = menu.float.options;
				options.addTitle(I18n.user.confirmInstBan(this.name));
				options.addTextInput(I18n.member["reason:"](), () => {}, {}).onchange = (txt) => {
					params.reason = txt;
				};
				options.addCheckboxInput(I18n.member.persist(), () => {}, {
					initState: false,
				}).onchange = (checked) => {
					params.persistInstanceBan = !checked;
				};
				const opt = options.addOptions("", {ltr: true});
				opt.addButtonInput("", I18n.yes(), () => {
					fetch(this.info.api + "/users/" + this.id + "/delete", {
						headers: this.localuser.headers,
						method: "POST",
						body: JSON.stringify(params),
					});
					menu.hide();
				});
				opt.addButtonInput("", I18n.no(), () => {
					menu.hide();
				});
				menu.show();
			},
			{
				visible: function () {
					return this.localuser.rights.hasPermission("MANAGE_USERS");
				},
				color: "red",
			},
		);
		console.warn("this ran");
	}
	setFriendNick() {
		const dio = new Dialog("");
		const form = dio.options.addForm(
			"",
			() => {
				dio.hide();
			},
			{
				fetchURL: this.info.api + `/users/@me/relationships/${this.id}`,
				method: "PATCH",
				headers: this.headers,
			},
		);
		form.addTextInput(I18n.member["nick:"](), "nickname", {
			initText: this.nickname || "",
            maxLength: this.localuser.instanceLimits.user?.maxUsername ?? 9999,
		});
		dio.show();
	}
	getMembersSync() {
		return this.localuser.guilds
			.map((guild) => {
				const m = this.members.get(guild);
				return m instanceof Member ? m : undefined;
			})
			.filter((m) => m !== undefined);
	}

	elms = new Set<WeakRef<HTMLElement>>();
	subName(elm: HTMLElement) {
		this.elms.add(new WeakRef(elm));
	}
	nameChange() {
		this.getMembersSync().forEach((memb) => {
			memb.nameChange();
		});

		for (const ref of this.elms) {
			const elm = ref.deref();
			if (!elm || !document.contains(elm)) {
				this.elms.delete(ref);
				continue;
			}
			elm.textContent = this.name;
		}
	}

	static checkuser(user: User | userjson, owner: Localuser): User {
		const tempUser = owner.userMap.get(user.uid || user.id);
		if (tempUser) {
			if (!(user instanceof User)) {
				tempUser.userupdate(user);
			}
			return tempUser;
		} else {
			const tempuser = new User(user as userjson, owner, true);
			owner.userMap.set(user.uid || user.id, tempuser);
			return tempuser;
		}
	}

	get info() {
		return this.owner.info;
	}

	get localuser() {
		return this.owner;
	}

	get name() {
		return this.nickname || (this.relationshipType === 2 ? I18n.friends.bu() : this.username);
	}

	async resolvemember(guild: Guild): Promise<Member | undefined> {
		return await Member.resolveMember(this, guild);
	}

	async getUserProfile(): Promise<any> {
		return await fetch(
			`${this.info.api}/users/${this.id.replace(
				"#clone",
				"",
			)}/profile?with_mutual_guilds=true&with_mutual_friends=true`,
			{
				headers: this.localuser.headers,
			},
		).then((res) => res.json());
	}

	async getBadge(id: string) {
		if (this.localuser.badges.has(id)) {
			return this.localuser.badges.get(id);
		} else {
			if (this.resolving) {
				await this.resolving;
				return this.localuser.badges.get(id);
			}

			const prom = await this.getUserProfile();
			this.resolving = prom;
			const badges = prom.badges;
			this.resolving = false;
			for (const badge of badges) {
				this.localuser.badges.set(badge.id, badge);
			}
			return this.localuser.badges.get(id);
		}
	}

	buildpfp(guild: Guild | void | Member | null, hoverElm: void | HTMLElement): HTMLDivElement {
		const div = document.createElement("div");
		div.classList.add("pfpDiv");
		hoverElm ??= div;
		const pfp = createImg(this.getpfpsrc(), undefined, hoverElm);
		pfp.loading = "lazy";
		pfp.classList.add("pfp");
		if (!this.webhook) pfp.classList.add("userid:" + this.id);
		if (guild) {
			(async () => {
				if (guild instanceof Guild) {
					const memb = await Member.resolveMember(this, guild);
					if (!memb) return;
					pfp.setSrcs(memb.getpfpsrc());
				} else {
					pfp.setSrcs(guild.getpfpsrc());
				}
			})();
		}
		if (this.avatar_decoration_data && this.localuser.perminfo.user.decorations) {
			const dec = createImg(
				this.info.cdn +
					`/avatar-decoration-presets/${this.avatar_decoration_data.asset}.png` +
					new CDNParams({expectedSize: 96}),
				void 0,
				hoverElm,
			);
			dec.classList.add("avDec");
			div.append(dec);
		}
		div.append(pfp);
		return div;
	}
	createWidget(guild?: Guild) {
		guild = this.localuser.guildids.get("@me") as Guild;
		const div = document.createElement("div");
		div.classList.add("flexltr", "createdWebhook");
		//TODO make sure this is something I can actually do here
		const name = document.createElement("b");
		name.textContent = this.name;

		const nameBox = document.createElement("div");
		nameBox.classList.add("flexttb");
		nameBox.append(name);
		const pfp = this.buildpfp(undefined, div);
		div.append(pfp, nameBox);
		Member.resolveMember(this, guild).then((_) => {
			if (_) {
				_.subName(name);
				name.textContent = _.name;
				(pfp.children[0] as HTMLImageElement).src = _.getpfpsrc();
			} else if (guild.id !== "@me") {
				this.subName(name);
				const notFound = document.createElement("span");
				notFound.textContent = I18n.webhooks.notFound();
				nameBox.append(notFound);
			}
		});
		this.bind(div, guild, undefined);
		return div;
	}
	updateStatusSet = new Set<WeakRef<HTMLDivElement>>();
	contextMap = new WeakMap<HTMLDivElement, Guild | Channel>();
	localstatusUpdate = () => {};
	registerStatus(status: HTMLDivElement, thing: Guild | void | Member | null | Channel) {
		if (thing) {
			if (thing instanceof Member) {
				this.contextMap.set(status, thing.guild);
			} else {
				this.contextMap.set(status, thing);
			}
		}
		this.updateStatusSet.add(new WeakRef(status));
		this.updateStatus(status);
	}
	updateStatus(status: HTMLDivElement) {
		status.classList.remove("offlinestatus", "dndstatus", "onlinestatus", "typingstatus");
		switch (this.getStatus()) {
			case "offline":
			case "invisible":
				status.classList.add("offlinestatus");
				break;
			case "dnd":
				status.classList.add("dndstatus");
				break;
			case "online":
			default:
				status.classList.add("onlinestatus");
				break;
		}
		const m = this.contextMap.get(status);
		if (m) {
			let guild: Guild;
			let channel: Channel | void = undefined;
			if ("guild" in m) {
				channel = m;
				guild = m.guild;
			} else {
				guild = m;
			}
			const memb = this.members.get(guild);
			if (memb && !(memb instanceof Promise) && channel) {
				const typing = channel.typingmap.get(memb);

				if (typing) {
					status.classList.add("typingstatus");
				}
			}
		}
	}
	statusChange() {
		let has = false;
		for (const ref of this.updateStatusSet) {
			const elm = ref.deref();
			if (!elm || !document.body.contains(elm)) {
				this.updateStatusSet.delete(ref);
				continue;
			}
			has = true;
			this.updateStatus(elm);
		}
		return has;
	}
	buildstatuspfp(guild: Guild | void | Member | null | Channel): HTMLDivElement {
		const isChannel = !!(guild && "guild" in guild);
		const div = this.buildpfp(isChannel ? guild.guild : guild);

		const status = document.createElement("div");
		this.registerStatus(status, guild);
		status.classList.add("statusDiv");
		status.append(document.createElement("div"));

		div.append(status);
		return div;
	}

	userupdate(json: userjson): void {
		const up = json.username !== this.username;
		if (json.avatar !== this.avatar) {
			Array.from(document.getElementsByClassName("userid:" + this.id)).forEach((element) => {
				const img = element as safeImg;
				if ("setSrcs" in element) {
					img.setSrcs(this.getpfpsrc());
				} else {
					console.warn("element didn't have setSrcs property");
				}
			});
		}
		for (const key of Object.keys(json)) {
			if (key === "bio") {
				this.bio = new MarkDown(json[key], this.localuser);
				continue;
			}
			if (key === "id") {
				continue;
			}
			(this as any)[key] = (json as any)[key];
		}
		if ("rights" in this) {
			if (
				this === this.localuser.user &&
				(typeof this.rights == "string" || typeof this.rights == "number")
			) {
				this.localuser.updateRights(this.rights);
			}
		}
		if (up) {
			this.nameChange();
		}
	}

	bind(
		html: HTMLElement,
		guild: Guild | null = null,
		error = true,
		button: "right" | "left" | "none" = "right",
	): void {
		if (guild && guild.id !== "@me") {
			Member.resolveMember(this, guild)
				.then((member) => {
					User.contextmenu.bindContextmenu(html, this, member);
					if (member === undefined && error) {
						if (this.webhook) return;
						const errorSpan = document.createElement("span");
						errorSpan.textContent = "!";
						errorSpan.classList.add("membererror");
						html.after(errorSpan);
						return;
					}
					if (member) {
						member.bind(html);
					} else {
						if (button !== "none")
							User.contextmenu.bindContextmenu(html, this, undefined, undefined, undefined, button);
					}
				})
				.catch((err) => {
					console.log(err);
				});
		} else {
			if (button !== "none")
				User.contextmenu.bindContextmenu(html, this, undefined, undefined, undefined, button);
		}
		if (button !== "none")
			if (guild) {
				this.profileclick(html, guild);
			} else {
				this.profileclick(html);
			}
	}

	static async resolve(id: string, localuser: Localuser): Promise<User> {
		const time = SnowFlake.stringToUnixTime(id);

		if (time < 1420070400000 + 100)
			return new User(
				{
					id: "0",
					public_flags: 0,
					username: I18n.friends.notfound(),
					avatar: null,
					discriminator: "0000",
					bio: "",
					bot: false,
					premium_type: 0,
					premium_since: "",
					accent_color: 0,
					theme_colors: null,
					badge_ids: [],
				},
				localuser,
			);
		let user: User | undefined;
		if ((user = localuser.userMap.get(id))) return user;
		const json = await fetch(localuser.info.api.toString() + "/users/" + id + "/profile", {
			headers: localuser.headers,
		}).then((res) => res.json());
		if (json.code === 404) {
			return new User(
				{
					id: "0",
					public_flags: 0,
					username: I18n.friends.notfound(),
					avatar: null,
					discriminator: "0000",
					bio: "",
					bot: false,
					premium_type: 0,
					premium_since: "",
					accent_color: 0,
					theme_colors: null,
					badge_ids: [],
				},
				localuser,
			);
		}
		return new User(json.user, localuser);
	}

	changepfp(update: string | null): void {
		this.avatar = update;
		this.hypotheticalpfp = false;
	}

	async block() {
		await this.changeRelationship(2);
		const channel = this.localuser.channelfocus;
		if (channel) {
			for (const message of channel.messages) {
				message[1].generateMessage();
			}
		}
	}

	async unblock() {
		await this.changeRelationship(0);
		const channel = this.localuser.channelfocus;
		if (channel) {
			for (const message of channel.messages) {
				message[1].generateMessage();
			}
		}
	}
	/**
	 * @param guild this is an optional thing that'll get the src of the member if it exists, otherwise ignores it, this is meant to be fast, not accurate
	 */
	getpfpsrc(guild: Guild | void): string {
		if (this.hypotheticalpfp && this.avatar) {
			return this.avatar;
		}
		if (guild) {
			const member = this.members.get(guild);
			if (member instanceof Member) {
				return member.getpfpsrc();
			}
		}
		if (this.avatar !== null) {
			return (
				`${this.info.cdn}/avatars/${this.id.replace("#clone", "")}/${this.avatar}.png` +
				new CDNParams({expectedSize: 96})
			);
		} else {
			const int = Number((BigInt(this.id.replace("#clone", "")) >> 22n) % 6n);
			return `${this.info.cdn}/embed/avatars/${int}.png`;
		}
	}
	async getBadges() {
		let i = 0;
		let flagbits = this.public_flags;
		const ids = [
			"staff",
			"partner",
			"certified_moderator",
			"hypesquad",
			"hypesquad_house_1",
			"hypesquad_house_2",
			"hypesquad_house_3",
			"bug_hunter_level_1",
			"bug_hunter_level_2",
			"active_developer",
			"verified_developer",
			"early_supporter",
			"premium",
			"guild_booster_lvl1",
			"guild_booster_lvl2",
			"guild_booster_lvl3",
			"guild_booster_lvl4",
			"guild_booster_lvl5",
			"guild_booster_lvl6",
			"guild_booster_lvl7",
			"guild_booster_lvl8",
			"guild_booster_lvl9",
			"bot_commands",
			"automod",
			"application_guild_subscription",
			"legacy_username",
			"quest_completed",
		];
		let badgeids: string[] = [];
		while (flagbits !== 0) {
			if (flagbits & 1) {
				badgeids.push(ids[i]);
			}
			flagbits >>= 1;
			i++;
		}
		if (this.badge_ids) {
			badgeids = badgeids.concat(this.badge_ids);
		}

		let badges: {
			id: string;
			description: string;
			icon: string;
			link?: string;
			translate?: boolean;
		}[] = [];

		const b = (await Promise.all(badgeids.map((_) => this.getBadge(_)))).filter(
			(_) => _ !== undefined,
		);
		badges = b;

		return badges;
	}
	async highInfo() {
		return (await (
			await fetch(
				this.info.api +
					"/users/" +
					this.id +
					"/profile?with_mutual_guilds=true&with_mutual_friends=true",
				{headers: this.localuser.headers},
			)
		).json()) as highMemberJSON;
	}
	handleRelationship(relation: relationJson) {
		const nickChange = this.nickname !== relation.nickname;
		this.nickname = relation.nickname;
		this.relationshipType = relation.type;
		this.localuser.inrelation.add(this);
		if (nickChange) {
			this.nameChange();
		}
	}
	removeRelation() {
		const nickChange = this.nickname;
		this.nickname = null;
		this.relationshipType = 0;
		this.localuser.inrelation.delete(this);
		if (nickChange) {
			this.nameChange();
		}
	}
	static getLink(con: ConnectionJson): string | void {
		switch (con.type) {
			case "steam": {
				return `https://steamcommunity.com/profiles/${con.external_id}`;
			}
		}
	}
	async fullProfile(guild: Guild | null | Member = null) {
		console.log(guild);
		const membres = (async () => {
			if (!guild) return;
			let member: Member | undefined;
			if (guild instanceof Guild) {
				member = await Member.resolveMember(this, guild);
			} else {
				member = guild;
			}
			return member;
		})();
		const background = document.createElement("div");
		background.classList.add("background");
		background.onclick = () => {
			removeAni(background);
		};
		const div = document.createElement("div");
		div.onclick = (e) => e.stopImmediatePropagation();
		div.classList.add("centeritem", "profile");

		if (this.accent_color) {
			div.style.setProperty(
				"--accent_color",
				`#${this.accent_color.toString(16).padStart(6, "0")}`,
			);
		} else {
			div.style.setProperty("--accent_color", "transparent");
		}
		const banner = this.getBanner(guild);
		div.append(banner);
		membres.then((member) => {
			if (!member) return;
			if (member.accent_color && member.accent_color !== 0) {
				div.style.setProperty(
					"--accent_color",
					`#${member.accent_color.toString(16).padStart(6, "0")}`,
				);
			}
		});

		const badgediv = document.createElement("div");
		badgediv.classList.add("badges");
		(async () => {
			const badges = await this.getBadges();
			for (const badgejson of badges) {
				const badge = document.createElement(badgejson.link ? "a" : "div");
				badge.classList.add("badge");
				let src: string;
				if (URL.canParse(badgejson.icon)) {
					src = badgejson.icon;
				} else {
					src =
						this.info.cdn +
						"/badge-icons/" +
						badgejson.icon +
						".png" +
						new CDNParams({expectedSize: 32});
				}
				const img = createImg(src, undefined, badgediv);

				badge.append(img);
				let hovertxt: string;
				if (badgejson.translate) {
					//@ts-ignore
					hovertxt = I18n.badge[badgejson.description]();
				} else {
					hovertxt = badgejson.description;
				}
				const hover = new Hover(hovertxt);
				hover.addEvent(badge);
				if (badgejson.link && badge instanceof HTMLAnchorElement) {
					badge.href = badgejson.link;
				}
				badgediv.append(badge);
			}
		})();

		const pfp = this.buildstatuspfp(guild);
		div.appendChild(pfp);
		const userbody = document.createElement("div");
		userbody.classList.add("flexttb", "infosection");
		div.appendChild(userbody);

		const usernamehtml = document.createElement("h2");
		usernamehtml.textContent = this.name;

		userbody.appendChild(usernamehtml);

		if (this.bot) {
			const username = document.createElement("span");
			username.classList.add("bot");
			username.textContent = this.webhook ? I18n.webhook() : I18n.bot();
			usernamehtml.appendChild(username);
		}

		userbody.appendChild(badgediv);
		const discrimatorhtml = document.createElement("h3");
		discrimatorhtml.classList.add("tag");
		discrimatorhtml.textContent = `${this.username}#${this.discriminator}`;
		userbody.appendChild(discrimatorhtml);

		const pronounshtml = document.createElement("p");
		pronounshtml.textContent = this.pronouns || "";
		pronounshtml.classList.add("pronouns");
		userbody.appendChild(pronounshtml);

		membres.then((member) => {
			if (!member) return;
			if (member.pronouns && member.pronouns !== "") {
				pronounshtml.textContent = member.pronouns;
			}
		});

		const rule = document.createElement("hr");
		userbody.appendChild(rule);
		const float = new Float("");
		const infoDiv = document.createElement("div");
		infoDiv.classList.add("flexttb");
		const buttons = float.options.addButtons("", {top: true, titles: false});
		{
			const info = buttons.add(I18n.profile.userInfo());

			infoDiv.append(I18n.profile.bio(), document.createElement("hr"));
			const biohtml = this.bio.makeHTML();
			infoDiv.appendChild(biohtml);

			membres.then((member) => {
				if (!member) return;
				if (member.bio && member.bio !== "") {
					//TODO make markdown take Guild
					infoDiv.insertBefore(new MarkDown(member.bio, this.localuser).makeHTML(), biohtml);
					biohtml.remove();
				}
			});
			info.addHTMLArea(infoDiv);

			const roles = document.createElement("div");
			const joined = document.createElement("div");
			joined.textContent = I18n.profile.joined(new Date(this.getUnixTime()).toLocaleString());
			infoDiv.append(roles, document.createElement("hr"), joined);

			if (guild) {
				membres.then((member) => {
					if (!member) {
						this.subName(usernamehtml);
						return;
					}
					const p = document.createElement("p");
					p.textContent = I18n.profile.joinedMember(
						member.guild.properties.name,
						new Date(member.joined_at).toLocaleString(),
					);
					joined.append(p);

					usernamehtml.textContent = member.name;
					member.subName(usernamehtml);
					if (this.bot) {
						const username = document.createElement("span");
						username.classList.add("bot");
						username.textContent = this.webhook ? I18n.webhook() : I18n.bot();
						usernamehtml.appendChild(username);
					}

					roles.classList.add("flexltr", "rolesbox");
					for (const role of member.roles) {
						if (role.id === member.guild.id) continue;
						const roleDiv = document.createElement("div");
						roleDiv.classList.add("rolediv");
						const color = document.createElement("div");
						roleDiv.append(color);

						color.style.setProperty("--role-color", role.getColorStyle(true));
						color.classList.add("colorrolediv");
						const span = document.createElement("span");
						roleDiv.append(span);
						span.textContent = role.name;
						roles.append(roleDiv);
					}
				});
			}
		}

		(async () => {
			const memb = await membres;
			if (!memb) return;
			const perms = buttons.add(I18n.profile.permInfo());
			const permDiv = document.createElement("div");
			permDiv.classList.add("permbox");
			const permsL = Permissions.info()
				.filter((_) => memb.hasPermission(_.name, false))
				.map((_) => _.readableName);
			for (const perm of permsL) {
				const span = document.createElement("span");
				span.textContent = perm;
				permDiv.append(span);
			}
			perms.addHTMLArea(permDiv);
		})();

		const fhtml = float.generateHTML();
		fhtml.style.overflow = "auto";
		userbody.append(fhtml);

		document.body.append(background);
		background.append(div);
		console.log(background);
		(async () => {
			const high = await this.highInfo();
			const mut = buttons.add(I18n.profile.mut());
			const mutDiv = document.createElement("div");

			mutDiv.append(
				...high.mutual_guilds
					.map((_) => [this.localuser.guildids.get(_.id), _.nick] as const)
					.map(([guild, nick]) => {
						if (!guild) return;
						const icon = guild.generateGuildIcon(false);

						const box = document.createElement("div");
						box.classList.add("mutGuildBox", "flexltr");

						const info = document.createElement("div");
						info.classList.add("flexttb");
						const gname = document.createElement("span");
						gname.textContent = guild.properties.name;
						info.append(gname);
						box.append(icon, info);
						if (nick) info.append(nick);
						return box;
					})
					.filter((_) => _ !== undefined),
			);
			mut.addHTMLArea(mutDiv);

			if (high.mutual_friends) {
				const friends = buttons.add(I18n.profile.mutFriends());
				const div = document.createElement("div");
				div.classList.add("mutFriends");
				div.append(
					...high.mutual_friends
						.map((_) => new User(_, this.localuser))
						.map((user) => {
							const html = user.createWidget(this.localuser.lookingguild);
							html.onclick = (e) => {
								e.stopImmediatePropagation();
								e.preventDefault();
								user.fullProfile(guild);
								removeAni(background);
							};
							return html;
						}),
				);
				friends.addHTMLArea(div);
			}
			if (high.connected_accounts.length) {
				const cons = await this.localuser.getConnections();

				for (const con of high.connected_accounts) {
					const conic = cons[con.type];
					if (!conic) continue;
					const conDiv = document.createElement("div");
					conDiv.classList.add("flexltr", "conProfDiv");
					const url = User.getLink(con);
					if (url) {
						MarkDown.safeLink(conDiv, url);
						conDiv.style.cursor = "pointer";
					}

					if (conic.icon_url) {
						const span = document.createElement("span");
						span.classList.add("conImg", "svgicon", "conProfImg");
						span.style.setProperty("mask", `url("${conic.icon_url}")`);
						//span.alt = key;
						conDiv.append(span);
					} else {
						conDiv.textContent = con.type.charAt(0).toUpperCase() + con.type.slice(1);
					}

					const nameDateBox = document.createElement("div");
					nameDateBox.classList.add("flexttb");
					const username = document.createElement("span");
					username.textContent = con.name;
					nameDateBox.append(username);
					if (con.metadata && con.metadata.created_at) {
						const len = document.createElement("span");
						len.textContent = I18n.connections.since(
							new Date(con.metadata.created_at).toDateString(),
						);
						nameDateBox.append(len);
					}
					conDiv.append(nameDateBox);
					infoDiv.append(conDiv);
				}
			}
		})();
		return background;
	}

	async buildprofile(
		x: number,
		y: number,
		guild: Guild | null | Member = null,
		zIndex = -1,
	): Promise<HTMLDivElement> {
		const membres = (async () => {
			if (!guild) return;
			let member: Member | undefined;
			if (guild instanceof Guild) {
				member = await Member.resolveMember(this, guild);
			} else {
				member = guild;
			}
			return member;
		})();
		const div = document.createElement("div");
		if (zIndex !== -1) {
			div.style.zIndex = zIndex + "";
		}
		if (this.accent_color) {
			div.style.setProperty(
				"--accent_color",
				`#${this.accent_color.toString(16).padStart(6, "0")}`,
			);
		} else {
			div.style.setProperty("--accent_color", "transparent");
		}
		const banner = this.getBanner(guild);
		div.append(banner);
		membres.then((member) => {
			if (!member) return;
			if (member.accent_color && member.accent_color !== 0) {
				div.style.setProperty(
					"--accent_color",
					`#${member.accent_color.toString(16).padStart(6, "0")}`,
				);
			}
		});

		if (x !== -1) {
			div.style.left = `${x}px`;
			div.style.top = `${y}px`;
			div.classList.add("profile", "flexttb");
		} else {
			this.setstatus("online");
			div.classList.add("hypoprofile", "profile", "flexttb");
		}
		const badgediv = document.createElement("div");
		badgediv.classList.add("badges");
		(async () => {
			const badges = await this.getBadges();
			for (const badgejson of badges) {
				const badge = document.createElement(badgejson.link ? "a" : "div");
				badge.classList.add("badge");
				let src: string;
				if (URL.canParse(badgejson.icon)) {
					src = badgejson.icon;
				} else {
					src =
						this.info.cdn +
						"/badge-icons/" +
						badgejson.icon +
						".png" +
						new CDNParams({expectedSize: 32});
				}
				const img = createImg(src, undefined, badgediv);

				badge.append(img);
				let hovertxt: string;
				if (badgejson.translate) {
					//@ts-ignore
					hovertxt = I18n.badge[badgejson.description]();
				} else {
					hovertxt = badgejson.description;
				}
				const hover = new Hover(hovertxt);
				hover.addEvent(badge);
				if (badgejson.link && badge instanceof HTMLAnchorElement) {
					badge.href = badgejson.link;
				}
				badgediv.append(badge);
			}
		})();
		const pfp = this.buildstatuspfp(guild);
		pfp.onclick = (e) => {
			if (this.id.includes("clone")) return;
			this.fullProfile(guild);
			div.remove();
			e.stopImmediatePropagation();
			e.preventDefault();
		};
		div.appendChild(pfp);
		const userbody = document.createElement("div");
		userbody.classList.add("flexttb", "infosection");
		div.appendChild(userbody);
		const usernamehtml = document.createElement("h2");
		usernamehtml.textContent = this.username;

		userbody.appendChild(usernamehtml);
		if (this.bot) {
			const username = document.createElement("span");
			username.classList.add("bot");
			username.textContent = this.webhook ? I18n.webhook() : I18n.bot();
			usernamehtml.appendChild(username);
		}
		userbody.appendChild(badgediv);
		const discrimatorhtml = document.createElement("h3");
		discrimatorhtml.classList.add("tag");
		discrimatorhtml.textContent = `${this.username}#${this.discriminator}`;
		userbody.appendChild(discrimatorhtml);

		const pronounshtml = document.createElement("p");
		pronounshtml.textContent = this.pronouns || "";
		pronounshtml.classList.add("pronouns");
		userbody.appendChild(pronounshtml);

		membres.then((member) => {
			if (!member) return;
			if (member.pronouns && member.pronouns !== "") {
				pronounshtml.textContent = member.pronouns;
			}
		});

		const rule = document.createElement("hr");
		userbody.appendChild(rule);
		const biohtml = this.bio.makeHTML();
		userbody.appendChild(biohtml);

		membres.then((member) => {
			if (!member) return;
			if (member.bio && member.bio !== "") {
				//TODO make markdown take Guild
				userbody.insertBefore(new MarkDown(member.bio, this.localuser).makeHTML(), biohtml);
				biohtml.remove();
			}
		});

		const send = document.createElement("input");
		if (!this.id.includes("#clone")) div.append(send);
		send.placeholder = I18n.user.sendMessage(this.name);
		send.onkeyup = (e) => {
			if (e.key === "Enter") {
				this.opendm(send.value);
				div.remove();
			}
		};

		if (guild) {
			membres.then((member) => {
				if (!member) return;
				send.placeholder = I18n.user.sendMessage(member.name);
				usernamehtml.textContent = member.name;
				if (this.bot) {
					const username = document.createElement("span");
					username.classList.add("bot");
					username.textContent = this.webhook ? I18n.webhook() : I18n.bot();
					usernamehtml.appendChild(username);
				}
				const roles = document.createElement("div");
				roles.classList.add("flexltr", "rolesbox");
				for (const role of member.roles) {
					if (role.id === member.guild.id) continue;
					const roleDiv = document.createElement("div");
					roleDiv.classList.add("rolediv");
					const color = document.createElement("div");
					roleDiv.append(color);
					color.style.setProperty("--role-color", role.getColorStyle(true));
					color.classList.add("colorrolediv");
					const span = document.createElement("span");
					roleDiv.append(span);
					span.textContent = role.name;
					roles.append(roleDiv);
				}
				userbody.append(roles);
			});
		}

		if (x !== -1) {
			Contextmenu.declareMenu(div);
			document.body.appendChild(div);
			Contextmenu.keepOnScreen(div);
		}
		return div;
	}
	getBanner(guild: Guild | null | Member): HTMLImageElement {
		const banner = createImg(undefined);

		const bsrc = this.getBannerUrl();
		if (bsrc) {
			banner.setSrcs(bsrc);
			banner.classList.add("banner");
		}

		if (guild) {
			if (guild instanceof Member) {
				const bsrc = guild.getBannerUrl();
				if (bsrc) {
					banner.setSrcs(bsrc);
					banner.classList.add("banner");
				}
			} else {
				Member.resolveMember(this, guild).then((memb) => {
					if (!memb) return;
					const bsrc = memb.getBannerUrl();
					if (bsrc) {
						banner.setSrcs(bsrc);
						banner.classList.add("banner");
					}
				});
			}
		}
		return banner;
	}
	getBannerUrl(): string | undefined {
		if (this.banner) {
			if (!this.hypotheticalbanner) {
				return (
					`${this.info.cdn}/banners/${this.id.replace("#clone", "")}/${this.banner}.png` +
					new CDNParams({expectedSize: 160})
				);
			} else {
				return this.banner;
			}
		} else {
			return undefined;
		}
	}
	profileclick(obj: HTMLElement, guild?: Guild): void {
		const getIndex = (elm: HTMLElement) => {
			const index = getComputedStyle(elm).zIndex;
			if (index === "auto") {
				if (elm.parentElement) {
					return getIndex(elm.parentElement);
				}
			}
			return +index;
		};
		obj.onclick = (e: MouseEvent) => {
			const index = 1 + getIndex(obj);
			this.buildprofile(e.clientX, e.clientY, guild, index);
			e.stopPropagation();
		};
	}
}

User.setUpContextMenu();
export {User};
