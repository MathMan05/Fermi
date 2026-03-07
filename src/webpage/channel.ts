import {Message} from "./message.js";
import {Contextmenu} from "./contextmenu.js";
import {Guild, makeInviteMenu} from "./guild.js";
import {Localuser} from "./localuser.js";
import {Permissions} from "./permissions.js";
import {Dialog, Float, Settings} from "./settings.js";
import {Role, RoleList} from "./role.js";
import {InfiniteScroller} from "./infiniteScroller.js";
import {SnowFlake} from "./snowflake.js";
import {
	channeljson,
	embedjson,
	filejson,
	memberjson,
	messageCreateJson,
	messagejson,
	mute_config,
	readyjson,
	startTypingjson,
	tagjson,
	threadMember,
	threadMetadata,
} from "./jsontypes.js";
import {MarkDown, saveCaretPosition} from "./markdown.js";
import {Member} from "./member.js";
import {Voice} from "./voice.js";
import {User} from "./user.js";
import {I18n} from "./i18n.js";
import {mobile, createImg, safeImg} from "./utils/utils.js";
import {webhookMenu} from "./webhooks.js";
import {File} from "./file.js";
import {Sticker} from "./sticker.js";
import {CustomHTMLDivElement} from "./index.js";
import {Direct} from "./direct.js";
import {NotificationHandler} from "./notificationHandler.js";
import {Command} from "./interactions/commands.js";
import {Tag} from "./tag.js";
import {CDNParams} from "./utils/cdnParams.js";

class Channel extends SnowFlake {
	editing!: Message | null;
	type!: number;
	owner!: Guild;
	headers!: Localuser["headers"];
	name!: string;
	parent_id?: string;
	parent: Channel | undefined;
	children!: Channel[];
	guild_id!: string;
	permission_overwrites!: Map<string, Permissions>;
	permission_overwritesar: [Role | Promise<User>, Permissions][] = [];
	topic!: string;
	nsfw!: boolean;
	position: number = 0;
	private lastreadmessageidint?: string;
	get lastreadmessageid() {
		return this.lastreadmessageidint;
	}
	set lastreadmessageid(id: string | undefined) {
		const cur = this.lastreadmessageidint;
		this.lastreadmessageidint = id;
		const m = this.messages.get(this.idToNext.get(cur as string) as string);
		if (m) {
			console.log(m);
			m.generateMessage();
		}
		const m2 = this.messages.get(this.idToNext.get(id as string) as string);
		if (m2) {
			m2.generateMessage();
		}
	}
	lastmessageid?: string;
	trueLastMessageid?: string;
	rate_limit_per_user: number = 0;
	mentions = 0;
	lastpin!: string;
	move_id?: string;
	typing!: number;
	message_notifications: number = 3;
	allthewayup!: boolean;
	static contextmenu = new Contextmenu<Channel, undefined>("channel menu");
	replyingto!: Message | null;
	infinite!: InfiniteScroller;
	idToPrev: Map<string, string | undefined>;
	idToNext: Map<string, string | undefined>;
	messages: Map<string, Message>;
	voice?: Voice;
	bitrate: number = 128000;
	threadData?: threadMetadata;
	mute_config: mute_config | null = {selected_time_window: -1, end_time: 0};
	updateEvents = new Set<() => void>();
	fireEvents() {
		for (const thing of this.updateEvents) {
			thing();
		}
	}
	setLastMessageId(id: string) {
		this.lastmessageid = id;
		try {
			if (BigInt(id) > BigInt(this.trueLastMessageid || "0")) {
				this.trueLastMessageid = id;
			}
		} catch {}
	}
	handleUserOverrides(settings: {
		message_notifications: number;
		muted: boolean;
		mute_config: mute_config | null;
		channel_id: string;
	}) {
		this.message_notifications = settings.message_notifications;
		this.mute_config = settings.mute_config;
	}
	static setupcontextmenu() {
		this.contextmenu.addButton(
			() => I18n.channel.markRead(),
			function (this: Channel) {
				this.readbottom();
			},
		);

		//TODO invite icon
		this.contextmenu.addButton(
			() => I18n.channel.makeInvite(),
			function (this: Channel) {
				this.createInvite();
			},
			{
				visible: function () {
					return this.hasPermission("CREATE_INSTANT_INVITE") && this.type !== 4 && !this.isThread();
				},
				color: "blue",
			},
		);
		this.contextmenu.addSeperator();
		this.contextmenu.addButton(
			() => I18n.threads.leave(),
			function () {
				fetch(this.info.api + "/channels/" + this.id + "/thread-members/@me", {
					method: "DELETE",
					headers: this.headers,
				});
			},
			{
				visible: function () {
					return this.isThread() && !!this.member;
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.threads.join(),
			function () {
				fetch(this.info.api + "/channels/" + this.id + "/thread-members/@me", {
					method: "POST",
					headers: this.headers,
				});
			},
			{
				visible: function () {
					return this.isThread() && !this.member;
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.threads.editTags(),
			function () {
				this.editTags();
			},
			{
				visible: function () {
					return !!(this.isThread() && this.parent?.isForum() && this.parent.availableTags);
				},
			},
		);

		this.contextmenu.addSeperator();
		//TODO notifcations icon
		this.contextmenu.addButton(
			() => I18n.guild.notifications(),
			function () {
				this.setnotifcation();
			},
		);
		this.contextmenu.addButton(
			() => I18n.channel.mute(),
			function () {
				this.muteChannel();
			},
			{
				visible: function () {
					return !this.muted && this.type !== 4;
				},
			},
		);
		this.contextmenu.addButton(
			() => I18n.channel.unmute(),
			function () {
				this.unmuteChannel();
			},
			{
				visible: function () {
					return this.muted;
				},
			},
		);

		this.contextmenu.addButton(
			() => I18n.channel.settings(),
			function (this: Channel) {
				this.generateSettings();
			},
			{
				visible: function () {
					return this.hasPermission("MANAGE_CHANNELS") || this.owner_id === this.localuser.user.id;
				},
				icon: {
					css: "svg-settings",
				},
			},
		);

		this.contextmenu.addButton(
			function () {
				if (this.isThread()) {
					return I18n.channel.deleteThread();
				}
				if (this.type === 4) {
					return I18n.channel.deleteCat();
				}
				return I18n.channel.delete();
			},
			function (this: Channel) {
				this.deleteChannel();
			},
			{
				visible: function () {
					return this.isThread()
						? this.hasPermission("MANAGE_THREADS")
						: this.hasPermission("MANAGE_CHANNELS");
				},
				icon: {
					css: "svg-delete",
				},
				color: "red",
			},
		);

		this.contextmenu.addSeperator();
		//TODO copy ID icon
		this.contextmenu.addButton(
			function () {
				if (this.type == 4) {
					return I18n.channel.copyIdCat();
				}
				return I18n.channel.copyId();
			},
			function (this: Channel) {
				navigator.clipboard.writeText(this.id);
			},
		);
	}
	unmuteChannel() {
		const mute_config = {
			selected_time_window: -1,
			end_time: 0,
		};
		fetch(this.info.api + "/users/@me/guilds/" + this.guild.id + "/settings", {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify({
				channel_overrides: {
					[this.id]: {
						message_notifications: this.mentions,
						muted: false,
						mute_config,
						channel_id: this.id,
					},
				},
			}),
		});
		this.mute_config = mute_config;
		this.html?.deref()?.classList.remove("muted");
		this.unreads();
		this.guild.unreads();
	}
	muteChannel() {
		const dio = new Dialog(I18n.channel.mute());
		const opt = dio.options;
		let time = 1800;
		opt.addSelect(
			I18n.muteDuration(),
			() => {},
			(["30m", "1h", "6h", "12h", "1d", "7d", "30d", "never"] as const).map((e) =>
				I18n.inviteOptions[e](),
			),
		).onchange = (e) => {
			time = [1800, 3600, 21600, 43200, 86400, 604800, 2592000, 1 << 30][e];
		};
		opt.addButtonInput("", I18n.submit(), () => {
			const mute_config = {
				selected_time_window: time,
				end_time: Math.floor(new Date(Date.now() + time * 1000).getTime()),
			};
			fetch(this.info.api + "/users/@me/guilds/" + this.guild.id + "/settings", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					channel_overrides: {
						[this.id]: {
							message_notifications: this.mentions,
							muted: true,
							mute_config,
							channel_id: this.id,
						},
					},
				}),
			});
			this.mute_config = mute_config;
			this.html?.deref()?.classList.add("muted");
			dio.hide();
			this.unreads();
			this.guild.unreads();
		});
		dio.show();
	}
	get muted() {
		return !!this.mute_config && new Date(this.mute_config.end_time).getTime() > Date.now();
	}
	icon?: string;
	iconUrl() {
		return (
			`${this.info.cdn}/channel-icons/${this.id}/${this.icon}.png` +
			new CDNParams({expectedSize: 32})
		);
	}
	createInvite() {
		const div = document.createElement("div");
		div.classList.add("invitediv");
		const text = document.createElement("span");
		text.classList.add("ellipsis");
		div.append(text);
		let uses = 0;
		let expires = 1800;
		const copycontainer = document.createElement("div");
		copycontainer.classList.add("copycontainer");
		const copy = document.createElement("span");
		copy.classList.add("copybutton", "svgicon", "svg-copy");
		copycontainer.append(copy);
		copycontainer.onclick = (_) => {
			if (text.textContent) {
				navigator.clipboard.writeText(text.textContent);
			}
		};
		div.append(copycontainer);
		const update = () => {
			fetch(`${this.info.api}/channels/${this.id}/invites`, {
				method: "POST",
				headers: this.headers,
				body: JSON.stringify({
					flags: 0,
					target_type: null,
					target_user_id: null,
					max_age: expires + "",
					max_uses: uses,
					temporary: uses !== 0,
				}),
			})
				.then((_) => _.json())
				.then((json) => {
					const params = new URLSearchParams("");
					params.set("instance", this.info.wellknown);
					const encoded = params.toString();
					text.textContent = `${location.origin}/invite/${json.code}?${encoded}`;
				});
		};
		update();
		const inviteOptions = new Dialog("", {noSubmit: true});
		inviteOptions.options.addTitle(I18n.inviteOptions.title());
		inviteOptions.options.addText(I18n.invite.subtext(this.name, this.guild.properties.name));

		inviteOptions.options.addSelect(
			I18n.invite.expireAfter(),
			() => {},
			(["30m", "1h", "6h", "12h", "1d", "7d", "30d", "never"] as const).map((e) =>
				I18n.inviteOptions[e](),
			),
		).onchange = (e) => {
			expires = [1800, 3600, 21600, 43200, 86400, 604800, 2592000, 0][e];
			update();
		};

		const timeOptions = (["1", "5", "10", "25", "50", "100"] as const).map((e) =>
			I18n.inviteOptions.limit(e),
		);
		timeOptions.unshift(I18n.inviteOptions.noLimit());
		inviteOptions.options.addSelect(I18n.invite.expireAfter(), () => {}, timeOptions).onchange = (
			e,
		) => {
			uses = [0, 1, 5, 10, 25, 50, 100][e];
			update();
		};

		inviteOptions.options.addHTMLArea(div);
		inviteOptions.show();
	}
	generateSettings() {
		this.sortPerms();
		const settings = new Settings(I18n.channel.settingsFor(this.name));
		{
			const gensettings = settings.addButton(I18n.channel.settings());
			const form = gensettings.addForm("", () => {}, {
				fetchURL: this.info.api + "/channels/" + this.id,
				method: "PATCH",
				headers: this.headers,
				traditionalSubmit: true,
			});
			form.addTextInput(I18n.channel["name:"](), "name", {
				initText: this.name,
                maxLength: this.localuser.instanceLimits.channel?.maxName ?? 9999,
			});
			form.addMDInput(I18n.channel["topic:"](), "topic", {
				initText: this.topic,
                maxLength: this.localuser.instanceLimits.channel?.maxTopic ?? 9999,
			});
			form.addImageInput(I18n.channel.icon(), "icon", {
				initImg: this.icon ? this.iconUrl() : undefined,
				clear: true,
			});
			form.addCheckboxInput(I18n.channel["nsfw:"](), "nsfw", {
				initState: this.nsfw,
			});
			const times = [
				0,
				5,
				10,
				15,
				30,
				60,
				120,
				300,
				600,
				900,
				1800,
				60 * 60,
				60 * 60 * 2,
				60 * 60 * 6,
			];
			form.addSelect(
				I18n.channel.slowmode(),
				"rate_limit_per_user",
				["0s", "5s", "10s", "15s", "30s", "1m", "2m", "5m", "10m", "15m", "30m", "1h", "2h", "6h"],
				{
					defaultIndex: (times.findIndex((_) => _ === this.rate_limit_per_user) + 1 || 1) - 1,
				},
				times,
			);
			const arcTimes = [60, 60 * 24, 60 * 24 * 3, 60 * 24 * 7];
			form.addSelect(
				I18n.channel.hideThreads(),
				"default_auto_archive_duration",
				["1h", "24h", "3d", "7d"],
				{
					defaultIndex: arcTimes.findIndex((_) => _ === (this.defaultAutoArchiveDuration ?? 1440)),
				},
				arcTimes,
			);
			if (this.isForum()) {
				form.addText(I18n.forum.settings.editTags());
				const tags = document.createElement("div");
				tags.classList.add("forumTagSelect");
				const tagSet = new Set<string>();
				const makeTagHTML = (tag: Tag) => {
					tagSet.add(tag.id);
					let html = tag.makeHTML();
					html.onclick = () => {
						const d = new Dialog(I18n.forum.settings.editTag());
						const f = d.options.addForm(
							"",
							(_, obj) => {
								tag.update(obj as tagjson);
								const newhtml = tag.makeHTML();
								html.parentNode?.insertBefore(newhtml, html);
								html.remove();
								newhtml.onclick = html.onclick;
								html = newhtml;
								d.hide();
							},
							{
								fetchURL: this.info.api + "/channels/" + this.id + "/tags/" + tag.id,
								method: "PUT",
								headers: this.headers,
							},
						);
						f.addTextInput(I18n.forum.settings.tagName(), "name", {
							initText: tag.name,
						});
						f.addCheckboxInput(I18n.forum.settings.moderated(), "moderated", {
							initState: tag.moderated,
						});
						f.addButtonInput("", I18n.forum.settings.delTag(), async () => {
							const res = await fetch(this.info.api + "/channels/" + this.id + "/tags/" + tag.id, {
								method: "DELETE",
								headers: this.headers,
							});
							if (res.ok) {
								d.hide();
								html.remove();
							}
						});
						d.show();
					};
					tags.append(html);
				};
				for (const tag of this.availableTags) {
					makeTagHTML(tag);
				}
				form.addHTMLArea(tags);
				form.addButtonInput("", I18n.forum.settings.addTag(), () => {
					const d = new Dialog(I18n.forum.settings.editTag());
					const f = d.options.addForm(
						"",
						(json) => {
							const channel = json as channeljson;
							if (!channel.available_tags) return;
							const dontHave = channel.available_tags.filter((_) => !tagSet.has(_.id));
							for (const tagJson of dontHave) {
								makeTagHTML(new Tag(tagJson, this));
							}
							d.hide();
						},
						{
							fetchURL: this.info.api + "/channels/" + this.id + "/tags",
							method: "POST",
							headers: this.headers,
						},
					);
					f.addTextInput(I18n.forum.settings.tagName(), "name", {
						initText: "",
					});
					f.addCheckboxInput(I18n.forum.settings.moderated(), "moderated", {
						initState: false,
					});
					d.show();
				});
			}
			if (this.type !== 4 && !this.isThread() && !this.isForum()) {
				const options = ["voice", "text", "announcement"] as const;
				form.addSelect(
					"Type:",
					"type",
					options.map((e) => I18n.channel[e]()),
					{
						defaultIndex: options.indexOf(
							{0: "text", 2: "voice", 5: "announcement", 4: "category"}[this.type] as
								| "text"
								| "voice"
								| "announcement",
						),
					},
					options,
				);
				form.addPreprocessor((obj: any) => {
					obj.type = {text: 0, voice: 2, announcement: 5, category: 4}[obj.type as string];
				});
			}
		}
		if (!this.isThread()) {
			const s1 = settings.addButton(I18n.channel.permissions(), {optName: ""});

			(async () => {
				const list = await Promise.all(
					this.permission_overwritesar.map(async (_) => {
						return [await _[0], _[1]] as [Role | User, Permissions];
					}),
				);

				s1.options.push(
					new RoleList(list, this.guild, this.updateRolePermissions.bind(this), this),
				);
			})();
			const inviteMenu = settings.addButton(I18n.guild.invites());
			makeInviteMenu(inviteMenu, this.owner, this.info.api + `/channels/${this.id}/invites`);

			const webhooks = settings.addButton(I18n.webhooks.base());
			webhookMenu(this.guild, this.info.api + `/channels/${this.id}/webhooks`, webhooks, this.id);
		}

		settings.show();
	}
	sortPerms() {
		console.log(this.permission_overwritesar + "");
		this.permission_overwritesar.sort((a, b) => {
			if (a[0] instanceof Promise) return -1;
			if (b[0] instanceof Promise) return 1;
			return this.guild.roles.indexOf(a[0]) - this.guild.roles.indexOf(b[0]);
		});
		console.log(this.permission_overwritesar + "");
	}
	setUpInfiniteScroller() {
		this.infinite = new InfiniteScroller(
			async (id: string, offset: number): Promise<string | undefined> => {
				if (offset === 1) {
					if (this.idToPrev.has(id)) {
						return this.idToPrev.get(id);
					} else {
						await this.grabBefore(id);
						return this.idToPrev.get(id);
					}
				} else {
					if (this.idToNext.has(id)) {
						return this.idToNext.get(id);
					} else if (this.lastmessage?.id !== id) {
						await this.grabAfter(id);
						return this.idToNext.get(id);
					} else {
					}
				}
				return undefined;
			},
			(id: string): HTMLElement => {
				//await new Promise(_=>{setTimeout(_,Math.random()*10)})
				const message = this.messages.get(id);
				try {
					if (message) {
						const html = this.fakeMessages.get(message);
						if (html) {
							return html;
						}
						return message.buildhtml();
					} else {
						console.error(id + " not found");
					}
				} catch (e) {
					console.error(e);
				}
				return document.createElement("div");
			},
			async (id: string) => {
				const message = this.messages.get(id);
				try {
					if (message) {
						const html = this.fakeMessages.get(message);
						if (html) {
							html.remove();
							return true;
						}
						message.deleteDiv();
						return true;
					}
				} catch (e) {
					console.error(e);
				} finally {
				}
				return false;
			},
			this.readbottom.bind(this),
		);
	}
	last_pin_timestamp?: string;
	member?: threadMember;

	memberCount?: number;
	messageCount?: number;
	totalMessageSent?: number;
	availableTags: Tag[] = [];
	flags!: number;
	defaultAutoArchiveDuration!: number;

	constructor(json: channeljson | -1, owner: Guild, id: string = json === -1 ? "" : json.id) {
		super(id);
		this.idToNext = owner.localuser.idToNext;
		this.idToPrev = owner.localuser.idToPrev;
		this.messages = owner.localuser.messages;

		this.owner = owner;
		this.headers = this.owner.headers;

		if (json === -1) {
			return;
		}
		this.localuser.channelids.set(this.id, this);
		this.flags = json.flags || 0;
		this.memberCount = json.member_count;
		this.defaultAutoArchiveDuration = json.default_auto_archive_duration;
		this.appliedTags = json.applied_tags || [];
		this.availableTags = json.available_tags?.map((tag) => new Tag(tag, this)) || [];
		this.messageCount = json.message_count;
		this.totalMessageSent = json.total_message_sent;
		this.owner_id = json.owner_id;
		this.member = json.member;
		this.rate_limit_per_user = json.rate_limit_per_user || 0;
		this.editing;
		this.type = json.type;

		this.name = json.name;
		if (json.parent_id) {
			this.parent_id = json.parent_id;
		}
		this.parent = undefined;
		this.children = [];
		this.icon = json.icon;
		this.guild_id = json.guild_id;
		this.permission_overwrites = new Map();
		this.permission_overwritesar = [];
		for (const thing of json.permission_overwrites || []) {
			if (!this.permission_overwrites.has(thing.id)) {
				//either a bug in the server requires this, or the API is cursed
				this.permission_overwrites.set(thing.id, new Permissions(thing.allow, thing.deny));
				const permission = this.permission_overwrites.get(thing.id);
				if (permission) {
					const role = this.guild.roleids.get(thing.id);
					if (role) {
						this.permission_overwritesar.push([role, permission]);
					} else {
						this.permission_overwritesar.push([this.localuser.getUser(thing.id), permission]);
					}
				}
			}
		}

		this.topic = json.topic;
		this.nsfw = json.nsfw;
		this.position = json.position;
		this.lastreadmessageid = undefined;
		if (json.last_message_id) {
			this.setLastMessageId(json.last_message_id);
		} else {
			this.lastmessageid = undefined;
		}
		if (this.type === 2 && this.localuser.voiceFactory) {
			this.voice = this.localuser.voiceFactory.makeVoice(this.guild.id, this.id, {
				bitrate: this.bitrate,
			});
			this.setUpVoice();
		}
		this.setUpInfiniteScroller();
		this.perminfo ??= {};
		this.threadData = json.thread_metadata;
		const read = this.localuser.unknownRead.get(this.id);
		if (read) {
			this.readStateInfo(read);
			this.localuser.unknownRead.delete(this.id);
		}
	}
	get perminfo() {
		return this.guild.perminfo.channels[this.id];
	}
	set perminfo(e) {
		this.guild.perminfo.channels[this.id] = e;
	}
	isAdmin() {
		return this.guild.isAdmin();
	}
	get guild() {
		return this.owner;
	}
	get localuser() {
		return this.guild.localuser;
	}
	get info() {
		return this.owner.info;
	}
	pinnedMessages?: Message[];
	async pinnedClick(rect: DOMRect) {
		const div = document.createElement("div");
		div.classList.add("flexttb", "pinnedMessages");
		div.style.top = rect.bottom + 20 + "px";
		div.style.right = window.innerWidth - rect.right + "px";
		document.body.append(div);
		Contextmenu.keepOnScreen(div);
		Contextmenu.declareMenu(div);
		this.last_pin_timestamp = this.lastpin;
		const l = (e: MouseEvent) => {
			if (e.target instanceof HTMLElement && div.contains(e.target)) {
				return;
			}
			div.remove();
			document.removeEventListener("click", l);
		};
		document.addEventListener("mouseup", l);
		if (!this.pinnedMessages) {
			const pinnedM = (await (
				await fetch(`${this.info.api}/channels/${this.id}/pins`, {headers: this.headers})
			).json()) as messagejson[];
			this.pinnedMessages = pinnedM.map((_) => {
				if (this.messages.has(_.id)) {
					return this.messages.get(_.id) as Message;
				} else {
					return new Message(_, this);
				}
			});
		}
		const pinnedM = document.getElementById("pinnedMDiv");
		if (pinnedM) {
			pinnedM.classList.remove("unreadPin");
		}
		if (this.pinnedMessages.length === 0) {
			const b = document.createElement("b");
			b.textContent = I18n.noPins();
			div.append(b);
			return;
		}
		div.append(
			...this.pinnedMessages.map((_) => {
				const html = _.buildhtml(undefined, true);
				html.style.cursor = "pointer";
				html.onclick = async () => {
					div.remove();
					await this.focus(_.id);
				};
				Message.contextmenu.bindContextmenu(html, _);
				return html;
			}),
		);
	}
	readStateInfo(json: readyjson["d"]["read_state"]["entries"][0]) {
		const next = this.messages.get(this.idToNext.get(this.lastreadmessageid as string) as string);
		this.lastreadmessageid = isNaN(+json.last_message_id) ? "0" : json.last_message_id;
		this.mentions = json.mention_count;
		this.mentions ??= 0;
		this.lastpin = json.last_pin_timestamp;
		if (next) {
			next.generateMessage();
		}
	}
	get hasunreads(): boolean {
		return this.unreadState();
	}
	private unreadState(): boolean {
		if (this.muted) return false;
		if (!this.hasPermission("VIEW_CHANNEL")) {
			return false;
		}
		if (this.mentions) return true;
		let lastreadmessage = SnowFlake.stringToUnixTime(this.lastreadmessageid || "0");
		if (this.guild.member) {
			const joinedAt = new Date(this.guild.member.joined_at).getTime();
			if (!lastreadmessage || lastreadmessage < joinedAt) {
				lastreadmessage = joinedAt;
			}
		}
		const lastmessage = SnowFlake.stringToUnixTime(this.trueLastMessageid || "0");
		return !!lastmessage && (!lastreadmessage || lastmessage > lastreadmessage) && this.type !== 4;
	}

	hasPermission(name: string, member = this.guild.member): boolean {
		if (member.isAdmin()) {
			return true;
		}
		if (this.isThread() && this.parent) {
			return this.parent.hasPermission(name, member);
		}
		if (this.guild.member.commuicationDisabledLeft()) {
			const allowSet = new Set(["READ_MESSAGE_HISTORY", "VIEW_CHANNEL"]);
			if (!allowSet.has(name)) {
				return false;
			}
		}
		const roles = new Set(member.roles);
		const everyone = this.guild.roleids.get(this.guild.id);
		if (everyone) roles.add(everyone);

		const premission = this.permission_overwrites.get(member.id);
		if (premission) {
			const perm = premission.getPermission(name);
			if (perm) {
				return perm === 1;
			}
		}

		for (const thing of roles) {
			const premission = this.permission_overwrites.get(thing.id);
			if (premission) {
				const perm = premission.getPermission(name);
				if (perm) {
					return perm === 1;
				}
			}
		}
		for (const thing of roles) {
			if (thing.permissions.getPermission(name)) {
				return true;
			}
		}
		return false;
	}
	get canMessage(): boolean {
		if (this.permission_overwritesar.length === 0 && this.hasPermission("MANAGE_CHANNELS")) {
			const role = this.guild.roles.find((_) => _.name === "@everyone");
			if (role) {
				this.addRoleToPerms(role);
			}
		}
		return this.isThread()
			? this.hasPermission("SEND_MESSAGES_IN_THREADS")
			: this.hasPermission("SEND_MESSAGES");
	}
	sortchildren() {
		this.children.sort((a, b) => {
			return a.position - b.position;
		});
	}
	resolveparent(_guild: Guild = this.owner) {
		const parentid = this.parent_id;
		if (!parentid) return false;
		this.parent = this.localuser.channelids.get(parentid);
		this.parent ??= undefined;
		if (this.parent !== undefined) {
			this.parent.children.push(this);
		}
		return this.parent !== undefined;
	}
	calculateReorder(position: number) {
		const build: {
			id: string;
			position: number | undefined;
			parent_id: string | undefined;
		}[] = [];
		for (const thing of this.children) {
			const thisthing: {
				id: string;
				position: number | undefined;
				parent_id: string | undefined;
			} = {id: thing.id, position: undefined, parent_id: undefined};

			if (thing.position != position) {
				thisthing.position = thing.position = position;
			}
			if (thing.move_id && thing.move_id !== thing.parent_id) {
				thing.parent_id = thing.move_id;
				thisthing.parent_id = thing.parent?.id;
				thing.move_id = undefined;
				//console.log(this.guild.channelids[thisthing.parent_id.id]);
			}
			if (thisthing.position || thisthing.parent_id) {
				build.push(thisthing);
			}
			position++;
		}
		return [build, position] as const;
	}
	static dragged: [Channel, HTMLDivElement] | [] = [];
	html: WeakRef<HTMLDivElement> | undefined;
	get visible() {
		return this.hasPermission("VIEW_CHANNEL");
	}
	voiceUsers = new WeakRef(document.createElement("div"));
	iconElm = new WeakRef(document.createElement("span") as HTMLSpanElement | safeImg);
	renderIcon() {
		let icon = this.iconElm.deref();
		if (this.icon && !this.localuser.perminfo.user.disableIcons) {
			if (icon instanceof HTMLImageElement) {
				icon.setSrcs(this.iconUrl());
			} else {
				const old = icon;
				const div = this.html?.deref();
				icon = createImg(this.iconUrl(), undefined, div, "icon");
				this.iconElm = new WeakRef(icon);
				if (old) {
					try {
						old.before(icon);
						old.remove();
					} catch {}
				}
			}
			icon.classList.add("space");
			return icon;
		} else if (!(icon instanceof HTMLSpanElement)) {
			const old = icon;
			icon = document.createElement("span");
			this.iconElm = new WeakRef(icon);
			if (old) {
				try {
					old.before(icon);
					old.remove();
				} catch {}
			}
		}
		icon.classList = "";
		if (this.type === 0) {
			if (this.guild.properties.rules_channel_id === this.id) {
				icon.classList.add("space", "svgicon", "svg-rules");
			} else {
				icon.classList.add("space", "svgicon", this.nsfw ? "svg-channelnsfw" : "svg-channel");
			}
		} else if (this.type === 2) {
			//
			icon.classList.add("space", "svgicon", this.nsfw ? "svg-voicensfw" : "svg-voice");
		} else if (this.type === 5) {
			//
			icon.classList.add("space", "svgicon", this.nsfw ? "svg-announcensfw" : "svg-announce");
		} else if (this.type === 15) {
			icon.classList.add("space", "svgicon", this.nsfw ? "svg-forumnsfw" : "svg-forum");
		} else {
			console.log(this.type);
		}
		return icon;
	}
	isThread() {
		return this.type === 10 || this.type === 11 || this.type === 12;
	}
	createguildHTML(admin = false): HTMLDivElement {
		const div = this.html?.deref() || document.createElement("div");
		div.innerHTML = "";

		if (this.muted) {
			div.classList.add("muted");
			setTimeout(
				() => {
					div.classList.remove("muted");
				},
				Math.min((this.mute_config?.end_time as number) - Date.now(), 2147483647),
			);
		}

		this.html = new WeakRef(div);
		if (!this.visible) {
			let quit = true;
			for (const thing of this.children) {
				if (thing.visible) {
					quit = false;
				}
			}
			if (quit) {
				return div;
			}
		}
		div.draggable = admin && !this.isThread();
		div.addEventListener("dragstart", (e) => {
			Channel.dragged = [this, div];
			e.stopImmediatePropagation();
		});
		div.addEventListener("dragend", () => {
			Channel.dragged = [];
		});
		const childrendiv = document.createElement("div");
		childrendiv.classList.add("channels");
		for (const channel of this.children.filter((_) => !_.isThread() || _.threadVis())) {
			childrendiv.appendChild(channel.createguildHTML(admin));
		}

		if (this.type === 4) {
			this.sortchildren();
			const caps = document.createElement("div");

			const decdiv = document.createElement("div");
			const decoration = document.createElement("span");
			decoration.classList.add("svgicon", "collapse-icon", "svg-category");
			decdiv.appendChild(decoration);

			const myhtml = document.createElement("p2");
			myhtml.classList.add("ellipsis");
			myhtml.textContent = this.name;
			this.nameSpan = new WeakRef(myhtml);
			decdiv.appendChild(myhtml);
			caps.appendChild(decdiv);

			if (admin) {
				const addchannel = document.createElement("span");
				addchannel.classList.add("addchannel", "svgicon", "svg-plus");
				caps.appendChild(addchannel);
				addchannel.onclick = (_) => {
					this.guild.createchannels(this.createChannel.bind(this));
				};
				this.coatDropDiv(decdiv, childrendiv);
			}
			div.appendChild(caps);
			caps.classList.add("flexltr", "capsflex");
			decdiv.classList.add("flexltr", "channeleffects");
			decdiv.classList.add("channel");

			Channel.contextmenu.bindContextmenu(decdiv, this, undefined);

			setTimeout((_: any) => {
				if (!this.perminfo.collapsed) {
					childrendiv.style.height = childrendiv.scrollHeight + "px";
				}
			}, 100);

			if (this.perminfo.collapsed) {
				decoration.classList.add("hiddencat");
				childrendiv.style.height = "0px";
			}
			const handleColapse = async (animate: boolean = true) => {
				if (this.perminfo.collapsed) {
					decoration.classList.add("hiddencat");
					childrendiv.style.height = childrendiv.scrollHeight + "px";
					await new Promise((res) => setTimeout(res, 0));
					childrendiv.style.height = "0px";
				} else {
					decoration.classList.remove("hiddencat");
					if (childrendiv.style.height === "0px" && animate) {
						childrendiv.style.height = childrendiv.scrollHeight + "px";
					} else {
						childrendiv.style.removeProperty("height");
					}
				}
			};
			const observer = new MutationObserver(handleColapse.bind(this, false));
			observer.observe(childrendiv, {childList: true, subtree: true});

			decdiv.onclick = () => {
				this.perminfo.collapsed = !this.perminfo.collapsed;
				handleColapse();
			};
		} else {
			childrendiv.classList.add("threads");
			div.classList.add("channel");
			this.unreads();
			Channel.contextmenu.bindContextmenu(div, this, undefined);
			if (admin && !this.isThread()) {
				this.coatDropDiv(div);
			}
			const button = document.createElement("button");
			button.classList.add("channelbutton");

			div.append(button);
			const myhtml = document.createElement("span");
			myhtml.classList.add("ellipsis");
			myhtml.textContent = this.name;
			this.nameSpan = new WeakRef(myhtml);
			const decoration = this.renderIcon();
			button.appendChild(decoration);
			button.appendChild(myhtml);
			button.onclick = (_) => {
				this.getHTML();
				const toggle = document.getElementById("maintoggle") as HTMLInputElement;
				toggle.checked = true;
			};
			if (this.type === 2) {
				const voiceUsers = document.createElement("div");
				div.append(voiceUsers);
				this.voiceUsers = new WeakRef(voiceUsers);
				this.updateVoiceUsers();
			}
		}
		div.appendChild(childrendiv);
		return div;
	}
	owner_id?: string;
	threadVis() {
		return (this.member && !this.threadData?.archived) || this.localuser.channelfocus === this;
	}
	async moveForDrag(x: number) {
		const mainarea = document.getElementById("mainarea");
		if (!mainarea) return;
		if (x === -1) {
			mainarea.style.removeProperty("left");
			mainarea.style.removeProperty("transition");
			return;
		}
		mainarea.style.left = x + "px";
		mainarea.style.transition = "left 0s";
	}
	async setUpVoice() {
		if (!this.voice) return;
		this.voice.onMemberChange = async (memb, joined) => {
			console.log(memb, joined);
			if (typeof memb !== "string") {
				await Member.new(memb, this.guild);
			}

			const users = this.usersDiv.deref();
			if (users) {
				const user = await this.localuser.getUser(typeof memb === "string" ? memb : memb.id);
				if (joined) {
					this.makeUserBox(user, users);
				} else {
					this.destUserBox(user);
				}
			}

			this.updateVoiceUsers();
			if (this.voice === this.localuser.currentVoice) {
				this.localuser.play?.play("join", this.localuser.getNotiVolume());
			}
		};
		this.voice.onUserChange = (user, change) => {
			this.boxChange(user, change);
		};
		this.voice.onSpeakingChange = (id, speaking) => {
			const box = this.boxMap.get(id);
			if (box) {
				if (speaking) {
					box.classList.add("speaking");
				} else {
					box.classList.remove("speaking");
				}
			}
			const tray = this.voiceTray.get(id);
			console.log("tray! :3");
			if (tray && tray.parentElement) {
				const parent = tray.parentElement;
				const pfp = Array.from(parent.children)[0];
				if (speaking) {
					pfp.classList.add("speaking");
				} else {
					pfp.classList.remove("speaking");
				}
			}
		};
	}
	voiceTray = new Map<string, HTMLDivElement>();
	async updateVoiceUsers() {
		const voiceUsers = this.voiceUsers.deref();
		if (!voiceUsers || !this.voice) return;
		console.warn(this.voice.userids);

		const html = (
			await Promise.all(
				this.voice.userids
					.entries()
					.toArray()
					.map(async (_) => {
						const user = await User.resolve(_[0], this.localuser);
						console.log(user);
						const member = await Member.resolveMember(user, this.guild);
						const array = [member, _[1]] as [Member, (typeof _)[1]];
						return array;
					}),
			)
		).flatMap(([member, obj]) => {
			if (!member) {
				console.warn("This is weird, member doesn't exist :P");
				return [];
			}
			const div = document.createElement("div");
			div.classList.add("voiceuser", "flexltr");
			const span = document.createElement("span");
			span.textContent = member.name;
			member.subName(span);

			const tray = document.createElement("div");
			tray.classList.add("flexltr", "voiceTray");

			div.append(member.user.buildpfp(member), span, tray);
			member.user.bind(div, member.guild);

			this.voiceTray.set(member.id, tray);
			this.boxChange(member.id, obj);
			return div;
		});

		voiceUsers.innerHTML = "";
		voiceUsers.append(...html);
	}
	get myhtml() {
		if (this.html) {
			return this.html.deref();
		} else {
			return;
		}
	}
	readbottom() {
		if (!this.unreadState()) {
			this.guild.unreads();
			return;
		}
		this.mentions = 0;
		console.log(this.trueLastMessageid);
		fetch(this.info.api + "/channels/" + this.id + "/messages/" + this.trueLastMessageid + "/ack", {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({}),
		});
		const next = this.messages.get(this.idToNext.get(this.lastreadmessageid as string) as string);
		this.lastreadmessageid = this.trueLastMessageid;
		this.guild.unreads();
		this.unreads();
		if (next) {
			next.generateMessage();
		}
		this.infinite.toBottom();
	}
	static lastDragDiv = document.createElement("div");
	coatDropDiv(div: HTMLDivElement, container: HTMLElement | false = false) {
		div.style.position = "relative";
		div.addEventListener("dragenter", (event) => {
			console.log("enter");
			event.preventDefault();
		});
		const dragDiv = () => {
			if (Channel.lastDragDiv !== div) {
				Channel.lastDragDiv.classList.remove("dragTopView");
				Channel.lastDragDiv.classList.remove("dragBottomView");
			}
			Channel.lastDragDiv = div;
		};

		div.addEventListener("dragover", (event) => {
			dragDiv();
			const height = div.getBoundingClientRect().height;

			if (event.offsetY / height < 0.5) {
				div.classList.add("dragTopView");
				div.classList.remove("dragBottomView");
			} else {
				div.classList.remove("dragTopView");
				div.classList.add("dragBottomView");
			}
			event.preventDefault();
		});
		div.addEventListener("dragleave", () => {
			dragDiv();
			div.classList.remove("dragTopView");
			div.classList.remove("dragBottomView");
		});
		div.addEventListener("drop", (event) => {
			dragDiv();
			div.classList.remove("dragTopView");
			div.classList.remove("dragBottomView");
			const that = Channel.dragged[0];
			if (!that) return;
			event.preventDefault();
			const height = div.getBoundingClientRect().height;
			const before = event.offsetY / height < 0.5;
			if (container && that.type !== 4 && !before) {
				that.move_id = this.id;
				if (that.parent) {
					that.parent.children.splice(that.parent.children.indexOf(that), 1);
				}
				that.parent = this;
				container.prepend(Channel.dragged[1] as HTMLDivElement);
				this.children.unshift(that);
			} else {
				console.log(this, Channel.dragged);
				let thisy = this as Channel;
				if (that.type === 4) {
					console.log("check", this);
					if (this.parent) {
						thisy = this.parent;
						console.log("overwrite :3", thisy);
					}
				}
				that.move_id = thisy.parent_id;
				if (that.parent) {
					that.parent.children.splice(that.parent.children.indexOf(that), 1);
				} else {
					thisy.guild.headchannels.splice(thisy.guild.headchannels.indexOf(that), 1);
				}
				that.parent = thisy.parent;
				if (that.parent) {
					const build: Channel[] = [];
					for (let i = 0; i < that.parent.children.length; i++) {
						build.push(that.parent.children[i]);
						if (that.parent.children[i] === thisy) {
							if (before) build.pop();
							build.push(that);
							if (before) build.push(thisy);
						}
					}
					that.parent.children = build;
					console.log(build);
				} else {
					const build: Channel[] = [];
					for (let i = 0; i < thisy.guild.headchannels.length; i++) {
						build.push(thisy.guild.headchannels[i]);
						if (thisy.guild.headchannels[i] === thisy) {
							if (before) build.pop();
							build.push(that);
							if (before) build.push(thisy);
						}
					}
					thisy.guild.headchannels = build;
				}
				if (Channel.dragged[1]) {
					if (this === thisy && this.type !== 4) {
						if (before) {
							div.before(Channel.dragged[1]);
						} else {
							div.after(Channel.dragged[1]);
						}
					} else {
						let tdiv = div.parentElement as HTMLDivElement;
						if (!tdiv) return;
						tdiv = tdiv.parentElement as HTMLDivElement;
						if (!tdiv) return;

						Channel.dragged[1].remove();
						if (before) {
							tdiv.before(Channel.dragged[1]);
						} else {
							tdiv.after(Channel.dragged[1]);
						}
					}
				}
			}
			this.guild.calculateReorder(that.id);
		});

		return div;
	}
	createChannel(name: string, type: number) {
		fetch(this.info.api + "/guilds/" + this.guild.id + "/channels", {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({
				name,
				type,
				parent_id: this.id,
				permission_overwrites: [],
			}),
		})
			.then((_) => _.json())
			.then((_) => this.guild.goToChannelDelay(_.id));
	}
	deleteChannel() {
		fetch(this.info.api + "/channels/" + this.id, {
			method: "DELETE",
			headers: this.headers,
		});
	}
	setReplying(message: Message) {
		if (this.replyingto?.div) {
			this.replyingto.div.classList.remove("replying");
		}
		this.replyingto = message;
		const typebox = document.getElementById("typebox") as HTMLElement;
		typebox.focus();
		if (!this.replyingto?.div) return;
		console.log(message);
		this.replyingto.div.classList.add("replying");
		this.makereplybox();
	}
	makereplybox() {
		const replybox = document.getElementById("replybox") as HTMLElement;
		const typebox = document.getElementById("typebox") as HTMLElement;
		if (this.replyingto) {
			replybox.innerHTML = "";
			const span = document.createElement("span");
			span.textContent = I18n.replyingTo(this.replyingto.author.username);
			const X = document.createElement("button");
			X.onclick = (_) => {
				if (this.replyingto?.div) {
					this.replyingto.div.classList.remove("replying");
				}
				replybox.classList.add("hideReplyBox");
				this.replyingto = null;
				replybox.innerHTML = "";
				typebox.classList.remove("typeboxreplying");
			};
			replybox.classList.remove("hideReplyBox");
			X.classList.add("cancelReply", "svgicon", "svg-x");
			replybox.append(span);
			replybox.append(X);
			typebox.classList.add("typeboxreplying");
		} else {
			replybox.classList.add("hideReplyBox");
			replybox.innerHTML = "";
			typebox.classList.remove("typeboxreplying");
		}
	}
	async getmessage(id: string): Promise<Message | undefined> {
		const message = this.messages.get(id);
		if (message) {
			return message;
		} else {
			const gety = await fetch(
				this.info.api + "/channels/" + this.id + "/messages?limit=1&around=" + id,
				{headers: this.headers},
			);
			const json = await gety.json();
			if (json.length === 0) {
				return undefined;
			}
			return new Message(json[0], this);
		}
	}
	async getMessages(id: string) {
		const m = await this.getmessage(id);
		if (!m) return;
		const waits: Promise<unknown>[] = [];
		let m1: string | undefined = m.id;
		for (let i = 0; i <= 50; i++) {
			if (!m1) {
				waits.push(this.grabBefore(id));
				break;
			}
			if ((this.idToNext.has(m1) && !this.idToNext.get(m1)) || this.lastmessage?.id === m1) break;
			m1 = this.idToNext.get(m1);
		}
		m1 = m.id;
		for (let i = 0; i <= 50; i++) {
			if (!m1) {
				waits.push(this.grabAfter(id));
				break;
			}
			if (this.idToPrev.has(m1) && !this.idToPrev.get(m1)) break;
			m1 = this.idToPrev.get(m1);
		}
		await Promise.all(waits);
		console.log(waits);
	}
	async focus(id: string, flash = true) {
		const prom = this.getMessages(id);

		if (await Promise.race([prom, new Promise((res) => setTimeout(() => res(true), 300))])) {
			const loading = document.getElementById("loadingdiv") as HTMLDivElement;
			Channel.regenLoadingMessages();
			loading.classList.add("loading");
			await prom;
			loading.classList.remove("loading");
		}

		if (this.localuser.channelfocus !== this) {
			await this.getHTML(true);
		}

		try {
			await this.infinite.focus(id, flash, true);
		} catch {}
	}
	editLast() {
		let message: Message | undefined = this.lastmessage;
		while (message && message.author !== this.localuser.user) {
			message = this.messages.get(this.idToPrev.get(message.id) as string);
		}
		if (message) {
			message.setEdit();
		}
	}
	static genid: number = 0;
	nsfwPannel() {
		(document.getElementById("typebox") as HTMLDivElement).contentEditable = "" + false;
		(document.getElementById("upload") as HTMLElement).style.visibility = "hidden";
		(document.getElementById("typediv") as HTMLElement).style.visibility = "hidden";
		const messages = document.getElementById("scrollWrap") as HTMLDivElement;
		const messageContainers = Array.from(messages.getElementsByClassName("messagecontainer"));
		for (const thing of messageContainers) {
			thing.remove();
		}
		const elements = Array.from(messages.getElementsByClassName("scroller"));
		for (const elm of elements) {
			elm.remove();
			console.warn("rouge element detected and removed");
		}
		const div = document.getElementById("sideDiv") as HTMLDivElement;
		div.innerHTML = "";
		const float = new Float("");
		const options = float.options;
		//@ts-ignore weird hack, ik, but the user here does have that information
		//TODO make an extention of the user class with these aditional properties
		//TODO make a popup for `nsfw_allowed==null` to input age
		if (this.localuser.user.nsfw_allowed) {
			options.addTitle("This is a NSFW channel, do you wish to proceed?");
			const buttons = options.addOptions("", {ltr: true});
			buttons.addButtonInput("", "Yes", () => {
				this.perminfo.nsfwOk = true;
				this.getHTML();
			});
			buttons.addButtonInput("", "No", () => {
				window.history.back();
			});
		} else {
			options.addTitle("You are not allowed in this channel.");
		}
		const html = float.generateHTML();
		html.classList.add("messagecontainer");
		messages.append(html);
	}
	unreadPins() {
		if (!this.last_pin_timestamp && !this.lastpin) return false;
		return this.last_pin_timestamp !== this.lastpin;
	}
	boxMap = new Map<string, HTMLElement>();
	liveMap = new Map<string, HTMLElement>();
	destUserBox(user: User) {
		const box = this.boxMap.get(user.id);
		if (!box) return;
		box.remove();
		this.boxMap.delete(user.id);
		const live = this.liveMap.get(user.id);
		if (live) {
			live.remove();
			this.liveMap.delete(user.id);
		}
	}
	boxVid(id: string, elm: HTMLVideoElement) {
		//TODO make a loading screen thingy if the video isn't progressing in time yet
		const box = this.boxMap.get(id);
		if (!box) return;
		console.log("vid", elm);
		box.append(elm);
	}
	makeBig(box: HTMLElement) {
		const par = box.parentElement;
		if (!par) return;
		if (par.children[0] !== box || !box.classList.contains("bigBox")) {
			box.classList.add("bigBox");
			if (par.children[0] !== box) {
				par.children[0].classList.remove("bigBox");
			}
		} else {
			par.children[0].classList.remove("bigBox");
		}
		par.prepend(box);
	}
	decorateLive(id: string) {
		if (!this.voice) return;
		const box = this.liveMap.get(id);
		if (!box) return;
		box.innerHTML = "";
		const live = this.voice.getLive(id);
		const self = id === this.localuser.user.id;
		if (!this.voice.open) {
			const span = document.createElement("span");
			span.textContent = I18n.vc.joinForStream();
			box.append(span);
		} else if (live) {
			const leave = document.createElement("button");
			leave.classList.add("leave");
			leave.textContent = self ? I18n.vc.stopstream() : I18n.vc.leavestream();
			leave.onclick = (e) => {
				e.stopImmediatePropagation();
				if (self) {
					this.voice?.stopStream();
				} else {
					this.voice?.leaveLive(id);
				}
			};
			box.append(live, leave);
		} else if (!self) {
			const joinB = document.createElement("button");
			joinB.textContent = I18n.vc.joinstream();
			joinB.classList.add("joinb");
			box.append(joinB);
			joinB.onclick = () => {
				if (!this.voice) return;
				box.innerHTML = "";
				const span = document.createElement("span");
				span.textContent = I18n.vc.joiningStream();
				box.append(span);
				this.voice.joinLive(id);
			};
		}
	}
	purgeVid(id: string) {
		const box = this.boxMap.get(id);
		if (!box) return;
		const videos = Array.from(box.getElementsByTagName("video"));
		videos.forEach((_) => _.remove());
	}
	boxChange(id: string, change: {deaf: boolean; muted: boolean; video: boolean; live: boolean}) {
		const box = this.boxMap.get(id);

		if (!this.voice) return;
		if (box) {
			console.warn("purge:" + id);
			const vid = this.voice.videos.get(id);
			if (vid && change.video) {
				this.boxVid(id, vid);
			} else if (!change.video) {
				this.purgeVid(id);
			}
			Array.from(box.getElementsByClassName("statBub")).forEach((_) => _.remove());
			const statBub = document.createElement("div");
			statBub.classList.add("statBub");
			if (change.muted) {
				const span = document.createElement("span");
				span.classList.add("svg-micmute");
				statBub.append(span);
				box.append(statBub);
			} else if (change.video) {
				const span = document.createElement("span");
				span.classList.add("svg-video");
				statBub.append(span);
				box.append(statBub);
			}
		}

		const live = this.liveMap.get(id);
		if (live && !change.live) {
			live.remove();
			this.liveMap.delete(id);
		} else if (!live && change.live && box) {
			const livediv = document.createElement("div");
			this.liveMap.set(id, livediv);
			livediv.onclick = () => {
				this.makeBig(livediv);
			};
			box.parentElement?.prepend(livediv);
			this.decorateLive(id);
		}

		const tray = this.voiceTray.get(id);
		if (tray) {
			console.warn("tray build", tray, change);
			tray.innerHTML = "";
			if (change.muted) {
				const span = document.createElement("span");
				span.classList.add("svg-micmute");
				tray.append(span);
			}
			if (change.video) {
				const span = document.createElement("span");
				span.classList.add("svg-video");
				tray.append(span);
			}
		}
	}
	async makeUserBox(user: User, users: HTMLElement) {
		const memb = Member.resolveMember(user, this.guild);
		const box = document.createElement("div");
		box.onclick = () => {
			this.makeBig(box);
		};
		this.boxMap.set(user.id, box);
		if (user.accent_color != undefined) {
			box.style.setProperty(
				"--accent_color",
				`#${user.accent_color.toString(16).padStart(6, "0")}`,
			);
		}
		memb.then((_) => {
			if (!_) return;
			if (_.accent_color !== undefined) {
				box.style.setProperty("--accent_color", `#${_.accent_color.toString(16).padStart(6, "0")}`);
			}
		});

		box.append(user.buildpfp(this.guild));

		const span = document.createElement("span");
		span.textContent = user.name;
		memb.then((_) => {
			if (!_) {
				user.subName(span);
				return;
			}
			_.subName(span);
			span.textContent = _.name;
		});
		span.classList.add("voiceUsername");
		box.append(span);
		users.append(box);
		if (!this.voice) return;
		const change = this.voice.userids.get(user.id);
		if (!change) return;
		this.boxChange(user.id, change);
	}
	usersDiv = new WeakRef(document.createElement("div"));
	async setUpVoiceArea() {
		if (!this.voice) throw new Error("voice not found?");
		const voiceArea = document.getElementById("voiceArea") as HTMLElement;
		const buttonRow = document.createElement("div");
		buttonRow.classList.add("flexltr", "buttonRow");
		const updateMicIcon = () => {
			mspan.classList.remove("svg-micmute", "svg-mic");
			mspan.classList.add(this.localuser.mute ? "svg-micmute" : "svg-mic");
		};

		const mute = document.createElement("div");
		const mspan = document.createElement("span");
		mute.append(mspan);
		updateMicIcon();
		this.localuser.updateOtherMic = updateMicIcon;
		mute.onclick = () => {
			this.localuser.mute = !this.localuser.mute;
			this.localuser.updateMic();
		};
		mute.classList.add("muteVoiceIcon");

		const updateCallIcon = () => {
			cspan.classList.remove("svg-call", "svg-hangup");
			cspan.classList.add(this.voice?.open ? "svg-hangup" : "svg-call");
		};
		const call = document.createElement("div");
		const cspan = document.createElement("span");
		call.append(cspan);
		updateCallIcon();
		call.onclick = async () => {
			if (this.voice?.userids.has(this.localuser.user.id)) {
				this.voice.leave();
			} else if (this.voice) {
				await this.localuser.joinVoice(this);
			}
			updateCallIcon();
		};
		call.classList.add("callVoiceIcon");

		const updateVideoIcon = () => {
			vspan.classList.remove("svg-video", "svg-novideo");
			vspan.classList.add(this.localuser.voiceFactory?.video ? "svg-video" : "svg-novideo");
		};
		const video = document.createElement("div");
		const vspan = document.createElement("span");
		video.append(vspan);
		updateVideoIcon();
		video.onclick = async () => {
			if (!this.voice) return;
			if (!this.voice.open) return;
			if (this.localuser.voiceFactory?.video) {
				this.voice.stopVideo();
			} else {
				const cam = await navigator.mediaDevices.getUserMedia({
					video: {
						advanced: [
							{
								aspectRatio: 1.75,
							},
						],
					},
				});
				if (!cam) return;
				this.voice.startVideo(cam);
			}
			updateVideoIcon();
		};
		video.classList.add("callVoiceIcon");

		const updateLiveIcon = () => {
			lspan.classList.remove("svg-stream", "svg-stopstream");
			lspan.classList.add(this.voice?.isLive() ? "svg-stopstream" : "svg-stream");
		};
		const live = document.createElement("div");
		const lspan = document.createElement("span");
		live.append(lspan);
		updateLiveIcon();
		live.onclick = async () => {
			if (!this.voice?.open) return;
			if (this.voice?.isLive()) {
				this.voice?.stopStream();
			} else {
				const stream = await navigator.mediaDevices.getDisplayMedia();
				const v = await this.voice?.createLive(stream);
				console.log(v);
			}
			updateLiveIcon();
		};
		live.classList.add("callVoiceIcon");

		const chat = document.createElement("div");
		const chatspan = document.createElement("span");
		chatspan.classList.add("svg-frmessage");
		chat.append(chatspan);
		updateLiveIcon();
		chat.onclick = async () => {
			this.voiceMode = this.voiceMode === "VoiceOnly" ? "ChatAndVoice" : "VoiceOnly";
			this.getHTML(true);
		};
		chat.classList.add("callVoiceIcon");

		buttonRow.append(mute, video, live, call, chat);

		const users = document.createElement("div");
		const mut = new MutationObserver(() => {
			const arr = Array.from(users.children);
			const box = arr.find((_) => _.classList.contains("bigBox"));
			if (box && arr[0] !== box) {
				users.prepend(box);
			}
		});
		mut.observe(users, {
			childList: true,
		});
		users.classList.add("voiceUsers");

		this.voice.userids.forEach(async (_, id) => {
			const user = await this.localuser.getUser(id);
			this.makeUserBox(user, users);
		});
		[...this.liveMap].forEach(([_, box]) => {
			users.prepend(box);
		});
		this.usersDiv = new WeakRef(users);

		voiceArea.append(users, buttonRow);
		this.voice.onVideo = (vid, id) => {
			this.localuser.regenVoiceIcons();
			console.warn("happened");
			this.boxVid(id, vid);
			updateVideoIcon();
		};
		this.voice.onGotStream = (_vid, id) => {
			this.localuser.regenVoiceIcons();
			updateLiveIcon();
			this.decorateLive(id);
		};
		this.voice.onconnect = () => {
			if (!this.voice) return;
			for (const [_, user] of this.voice.users) {
				this.decorateLive(user);
			}
		};
		this.voice.onLeaveStream = (id) => {
			this.decorateLive(id);
			updateLiveIcon();
			this.localuser.regenVoiceIcons();
		};

		this.voice.onLeave = () => {
			updateCallIcon();
			updateVideoIcon();
			for (const [id] of this.boxMap) {
				this.purgeVid(id);
			}
			if (!this.voice) return;
			for (const [_, user] of this.voice.users) {
				this.decorateLive(user);
			}
		};
	}
	files: Blob[] = [];
	htmls = new WeakMap<Blob, HTMLElement>();
	textSave = "";
	collectBox() {
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		const [files, html] = this.localuser.fileExtange([], new WeakMap<Blob, HTMLElement>());
		this.files = files;
		this.htmls = html;
		this.textSave = MarkDown.gatherBoxText(typebox);
		typebox.textContent = "";
	}
	curCommand?: Command;
	curWatch = () => {};
	async submitCommand() {
		if (!this.curCommand) return;
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		if (await this.curCommand.submit(typebox, this)) {
			this.curCommand = undefined;
			const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
			typebox.markdown.boxEnabled = true;
			typebox.innerHTML = "";
			typebox.markdown.boxupdate();
			typebox.removeEventListener("keyup", this.curWatch);
		}
	}
	startCommand(command: Command) {
		this.curCommand = command;
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		typebox.markdown.boxEnabled = false;
		const func = () => {
			const node = window.getSelection()?.focusNode;
			if (this.localuser.channelfocus === this) {
				const out = command.collect(typebox, this, node || undefined);
				if (!out) {
					typebox.markdown.boxEnabled = true;
					typebox.markdown.boxupdate();
					typebox.removeEventListener("keyup", func);
				}
			}
		};
		this.curWatch = func;
		typebox.addEventListener("keyup", func);
		command.render(typebox, this);
	}
	isForum() {
		return this.type === 15 || this.type === 16;
	}
	async renderThread(update = true) {
		let div = document.createElement("div");
		if (update) {
			const up = async () => {
				if (!document.contains(div)) {
					this.updateEvents.delete(up);
					return;
				}
				console.log(this.updateEvents);
				const c = await this.renderThread(false);
				if (!c) return;
				div.after(c);
				div.remove();
				div = c;
			};
			this.updateEvents.add(up);
		}
		div.classList.add("flexttb", "forumPostBody");
		div.onclick = (e) => {
			if (e.button === 0) this.getHTML();
		};
		Channel.contextmenu.bindContextmenu(div, this, undefined);
		const tags = document.createElement("div");
		tags.classList.add("flexltr", "tagDiv");
		for (const tagid of this.appliedTags) {
			const tag = this.parent?.availableTags.find((tag) => tag.id === tagid);
			if (!tag) continue;
			tags.append(tag.makeHTML());
		}
		div.append(tags);

		const title = document.createElement("h3");
		title.textContent = new MarkDown(this.name).makeHTML().textContent;
		div.append(title);

		const member =
			(await this.localuser.getMember(this.owner_id as string, this.guild.id)) ||
			(await User.resolve(this.owner_id as string, this.localuser));
		const message = this.localuser.messages.get(this.id);

		const name = document.createElement("span");
		name.classList.add("forumUsername");
		name.textContent = (member?.name || I18n.user.deleted()) + ": ";

		const messageContent = document.createElement("span");
		messageContent.classList.add("messageForumContent");
		if (message) messageContent.append(message.content.makeHTML());
		else messageContent.textContent = I18n.message.deleted();

		const mrow = document.createElement("div");
		mrow.classList.add("flexltr");
		mrow.append(name, messageContent);
		div.append(mrow);

		const micon = document.createElement("span");
		micon.classList.add("svg-frmessage", "svgicon");

		const mcount = document.createElement("span");
		mcount.textContent = this.messageCount + "";

		const msep = document.createElement("span");
		msep.classList.add("msep");

		const mtime = document.createElement("span");
		const updateTime = () => {
			mtime.textContent = MarkDown.relTime(
				new Date(
					this.lastmessageid ? SnowFlake.stringToUnixTime(this.lastmessageid) : this.getUnixTime(),
				),
				() => {
					if (!document.contains(mtime)) return;
					updateTime();
				},
			);
		};
		updateTime();

		const lrow = document.createElement("div");
		lrow.classList.add("forumMessageRow", "flexltr");

		lrow.append(micon, mcount, msep, mtime);
		div.append(lrow);

		return div;
	}
	appliedTags = [] as string[];
	forumFilters = {
		sortActive: true,
		recentFirst: true,
		tagMatchAll: false,
		tags: [] as string[],
	};
	hasFetchedForForum = false;
	editTags() {
		const d = new Dialog(I18n.threads.editTags());
		if (!this.appliedTags || !this.parent) return;
		let tagList = [...this.appliedTags];
		const patchList = () => {
			fetch(this.info.api + "/channels/" + this.id, {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					applied_tags: tagList,
				}),
			});
		};

		const tags = document.createElement("div");
		tags.classList.add("forumTagSelect");
		for (const tag of this.parent.availableTags.filter(
			(tag) => !tag.moderated || this.hasPermission("MANAGE_THREADS"),
		)) {
			const html = tag.makeHTML();
			html.onclick = () => {
				if (tagList.includes(tag.id)) {
					tagList = tagList.filter((id) => id !== tag.id);
					html.classList.remove("selected");
					patchList();
				} else {
					tagList.push(tag.id);
					tagList.sort();
					html.classList.add("selected");
					patchList();
				}
			};
			if (tagList.includes(tag.id)) html.classList.add("selected");
			tags.append(html);
		}
		const opt = d.options;
		opt.addHTMLArea(tags);
		d.show();
	}
	async fetchForum() {
		const arr = (await (
			await fetch(this.info.api + "/channels/" + this.id + "/post-data", {
				method: "POST",
				headers: this.headers,
				body: JSON.stringify({thread_ids: this.children.map(({id}) => id)}),
			})
		).json()) as {
			threads: Record<string, {first_message: null | messagejson; owner: null | memberjson}>;
		};
		for (const [id, {first_message, owner}] of Object.entries(arr.threads)) {
			const child = this.children.find(({id: cid}) => cid === id);
			if (!child) continue;
			if (owner) Member.new(owner, this.guild);
			if (first_message) {
				const m = this.localuser.messages.get(first_message.id);
				if (!m) this.localuser.messages.set(first_message.id, new Message(first_message, child));
			}
		}
		this.hasFetchedForForum = true;
		return;
	}

	umap = new Map<string, [number, string]>();
	search: [string, number, string][] = [];
	hasAllThreads = false;

	async fetchThreads(text: string, offset: number) {
		const filters = this.forumFilters;
		const uid = `${filters.recentFirst}-${filters.sortActive}-${filters.tagMatchAll}-${filters.tags.join("-")}-${text}`;
		const search = new URLSearchParams([
			["archived", "true"],
			["limit", "25"],
			["sort_by", filters.sortActive ? "last_message_time" : "creation_time"],
			["sort_order", filters.recentFirst ? "desc" : "asc"],
			["tag_setting", filters.tagMatchAll ? "match_all" : "match_some"],
			["offset", offset + ""],
			["tag", filters.tags.join(",")],
		]);
		const res = (await (
			await fetch(this.info.api + "/channels/" + this.id + "/threads/search?" + search, {
				headers: this.headers,
			})
		).json()) as {
			threads: channeljson[];
			members: memberjson[];
			messages: messagejson[];
			total_results: number;
			has_more: boolean;
		};
		for (const threadjson of res.threads) {
			if (this.localuser.channelids.has(threadjson.id)) continue;
			const thread = new Channel(threadjson, this.guild);
			this.localuser.channelids.set(threadjson.id, thread);
			thread.resolveparent();
		}
		for (const message of res.messages) {
			const thread = this.localuser.channelids.get(message.channel_id);
			if (!thread) continue;
			const m = this.localuser.messages.get(message.id);
			if (!m) this.localuser.messages.set(message.id, new Message(message, thread));
		}
		for (const member of res.members) {
			Member.new(member, this.guild);
		}
		if (res.has_more) {
			const lastid = res.threads.at(-1)?.id as string;
			if (text) {
				const arr = this.search.find(([id]) => id === uid);
				if (arr) {
					arr[1] = offset + 25;
					arr[2] = lastid;
				} else {
					this.search.push([uid, offset + 25, lastid]);
					if (this.search.length > 200) {
						this.search.shift();
					}
				}
			} else {
				this.umap.set(uid, [offset + 25, lastid]);
			}
		} else {
			if (text) {
				const arr = this.search.find(([id]) => id === uid);
				if (arr) {
					arr[1] = offset + 25;
					arr[2] = "-1";
				} else {
					this.search.push([uid, offset + 25, "-1"]);
					if (this.search.length > 200) {
						this.search.shift();
					}
				}
			} else {
				this.umap.clear();
				this.search = [];
				this.hasAllThreads = true;
			}
		}
	}

	genCurSort(text: string, offset: number) {
		const filters = this.forumFilters;
		text = text.toLowerCase();
		let match = this.children.filter((thread) => thread.name.toLowerCase().includes(text));
		const tagSet = new Set(filters.tags);
		if (tagSet.size)
			match = match.filter((thread) => {
				const tags = new Set(thread.appliedTags);
				if (filters.tagMatchAll) {
					return tagSet.isSubsetOf(tags);
				} else {
					return tags.intersection(tagSet).size;
				}
			});
		match.sort((c1, c2) => {
			if (filters.sortActive) {
				return +(Number(c1.lastmessageid || c1.id) > Number(c2.lastmessageid || c2.id)) ^
					+filters.recentFirst
					? 1
					: -1;
			} else {
				return +(Number(c1.id) > Number(c2.id)) ^ +filters.recentFirst ? 1 : -1;
			}
		});

		return [match.slice(offset, offset + 25), !!match.at(offset + 25)] as const;
	}

	async findMatches(text: string, offset: number): Promise<readonly [Channel[], boolean]> {
		if (this.hasAllThreads) return this.genCurSort(text, offset);

		const filters = this.forumFilters;
		const uid = `${filters.recentFirst}-${filters.sortActive}-${filters.tagMatchAll}-${filters.tags.join("-")}-${text}`;
		let offset2 = 0;
		let lastid = "";
		if (text) {
			[, offset2, lastid] = this.search.find(([id]) => id === uid) || ["", 0, ""];
		} else {
			[offset2, lastid] = this.umap.get(uid) || [0, ""];
		}

		if (lastid) {
			const [list, more] = this.genCurSort(text, offset);
			for (const elm of list) {
				if (elm.id === lastid) {
					await this.fetchThreads(text, offset2);
					return this.genCurSort(text, offset);
				}
			}
			return [list, more];
		} else {
			await this.fetchThreads(text, offset2);
			return this.genCurSort(text, offset);
		}
	}

	async forumSearch(text: string, div: HTMLDivElement) {
		while (!this.hasFetchedForForum) await this.fetchForum();
		let offset = 0;
		const flipPage = async (by: number) => {
			offset += by;
			div.scrollTop = 0;
			const [match, more] = await this.findMatches(text, offset);

			await renderDiv(match, more);
		};

		const renderDiv = async (threads: Channel[], more: boolean) => {
			div.innerHTML = "";

			const sortRow = document.createElement("div");
			sortRow.classList.add("flexltr", "forumSortRow");
			div.append(sortRow);

			const cMenu = new Contextmenu<void, void>("sortAndStuff");
			const opts = I18n.forum.sortOptions;

			cMenu.addText(opts.sortby.title());
			cMenu.addButton(
				opts.sortby.recent(),
				() => {
					this.forumFilters.sortActive = true;
					flipPage(0);
				},
				{
					icon: {
						css: this.forumFilters.sortActive ? "svg-select" : "svg-noSelect",
					},
				},
			);
			cMenu.addButton(
				opts.sortby.posted(),
				() => {
					this.forumFilters.sortActive = false;
					flipPage(0);
				},
				{
					icon: {
						css: this.forumFilters.sortActive ? "svg-noSelect" : "svg-select",
					},
				},
			);
			cMenu.addSeperator();

			cMenu.addText(opts.sortOrder.title());
			cMenu.addButton(
				opts.sortOrder.recent(),
				() => {
					this.forumFilters.recentFirst = true;
					flipPage(0);
				},
				{
					icon: {
						css: this.forumFilters.recentFirst ? "svg-select" : "svg-noSelect",
					},
				},
			);

			cMenu.addButton(
				opts.sortOrder.old(),
				() => {
					this.forumFilters.recentFirst = false;
					flipPage(0);
				},
				{
					icon: {
						css: this.forumFilters.recentFirst ? "svg-noSelect" : "svg-select",
					},
				},
			);
			cMenu.addSeperator();

			cMenu.addText(opts.tagMatch.title());
			cMenu.addButton(
				opts.tagMatch.some(),
				() => {
					this.forumFilters.tagMatchAll = false;
					flipPage(0);
				},
				{
					icon: {css: this.forumFilters.tagMatchAll ? "svg-noSelect" : "svg-select"},
				},
			);
			cMenu.addButton(
				opts.tagMatch.all(),
				() => {
					this.forumFilters.tagMatchAll = true;
					flipPage(0);
				},
				{
					icon: {
						css: this.forumFilters.tagMatchAll ? "svg-select" : "svg-noSelect",
					},
				},
			);

			const sortOptionButton = document.createElement("button");
			sortOptionButton.textContent = opts.name();

			sortOptionButton.onclick = (e) => {
				if (e.button !== 0) return;
				e.preventDefault();
				e.stopImmediatePropagation();
				const box = sortOptionButton.getBoundingClientRect();
				cMenu.makemenu(box.left, box.bottom + 6);
			};

			const tags = document.createElement("div");
			tags.classList.add("forumTagSelect");

			const allMenu = new Contextmenu<void, void>("allTagMenu");

			for (const tag of this.availableTags) {
				const html = tag.makeHTML();
				if (this.forumFilters.tags.includes(tag.id)) html.classList.add("selected");
				html.onclick = () => {
					if (this.forumFilters.tags.includes(tag.id)) {
						this.forumFilters.tags = this.forumFilters.tags.filter((id) => id !== tag.id);
					} else {
						this.forumFilters.tags.push(tag.id);
						this.forumFilters.tags.sort();
					}
					flipPage(0);
				};
				tags.append(html);
				allMenu.addButton(
					tag.name,
					() => {
						if (this.forumFilters.tags.includes(tag.id)) {
							this.forumFilters.tags = this.forumFilters.tags.filter((id) => id !== tag.id);
						} else {
							this.forumFilters.tags.push(tag.id);
							this.forumFilters.tags.sort();
						}
						flipPage(0);
					},
					{
						icon: {css: this.forumFilters.tags.includes(tag.id) ? "svg-select" : "svg-noSelect"},
					},
				);
			}

			const allTags = document.createElement("button");
			allTags.classList.add("allTagButton");
			allTags.textContent = I18n.forum.allTags();

			allTags.onclick = (e) => {
				if (e.button !== 0) return;
				e.preventDefault();
				e.stopImmediatePropagation();
				const box = allTags.getBoundingClientRect();
				allMenu.makemenu(box.right - window.innerWidth, box.bottom + 6);
			};

			sortRow.append(sortOptionButton, tags, allTags);

			div.append(...(await Promise.all(threads.map((_) => _.renderThread()))));

			const buttonRow = document.createElement("div");
			buttonRow.classList.add("flexltr", "forumButtonRow");

			const next = document.createElement("button");
			next.textContent = I18n.forum.next();
			next.disabled = !more;
			if (more) {
				next.onclick = () => {
					flipPage(25);
				};
			}

			const back = document.createElement("button");
			back.textContent = I18n.forum.back();
			back.disabled = !offset;
			if (offset) {
				back.onclick = () => {
					flipPage(-25);
				};
			}

			buttonRow.append(back, next);
			div.append(buttonRow);
		};
		await flipPage(0);
	}
	renderForum() {
		(document.getElementById("typediv") as HTMLElement).style.visibility = "hidden";
		const container = document.createElement("div");

		container.classList.add("messagecontainer", "flexttb", "forumBody");
		(document.getElementById("scrollWrap") as HTMLElement).append(container);
		const superContainer = document.createElement("div");
		superContainer.classList.add("forumHead", "flexttb");
		const headContainer = document.createElement("div");
		superContainer.append(headContainer);
		headContainer.classList.add("flexltr");
		container.append(superContainer);

		const icon = document.createElement("span");
		icon.classList.add("svgicon", "svg-search", "forumIcon");
		headContainer.append(icon);

		const text = document.createElement("input");
		text.type = "text";
		text.classList.add("forumSearch");
		headContainer.append(text);
		text.placeholder = I18n.forum.creorsear();

		const post = document.createElement("button");
		post.textContent = I18n.forum.newPost();
		post.classList.add("newPostForumButton");
		headContainer.append(post);

		post.onclick = () => {
			const postF = async () => {
				if (this.flags & (1 << 4) && !tagList.length) {
					showError(I18n.forum.errors.tagsReq());
					return;
				}
				const content = md.rawString;
				if (!content) {
					showError(I18n.forum.errors.requireText());
					return;
				}
				const res = (await (
					await fetch(this.info.api + "/channels/" + this.id + "/threads", {
						method: "POST",
						headers: this.headers,
						body: JSON.stringify({
							name: text.value,
							applied_tags: tagList,
							message: {
								content,
							},
						}),
					})
				).json()) as channeljson;
				this.localuser.goToChannel(res.id);
			};
			post.onclick = postF;
			post.textContent = I18n.forum.post();
			const box = document.createElement("div");
			box.classList.add("messageEditContainer");
			const area = document.createElement("div");
			const sb = document.createElement("div");
			sb.style.position = "absolute";
			sb.style.width = "100%";
			const search = document.createElement("div");
			search.classList.add("searchOptions", "flexttb");
			area.classList.add("editMessage");
			try {
				area.contentEditable = "plaintext-only";
			} catch {
				area.contentEditable = "true";
			}
			const md = new MarkDown("", this, {keep: true});
			area.append(md.makeHTML());
			area.addEventListener("keyup", (event) => {
				if (this.localuser.keyup(event)) return;
			});
			area.addEventListener("keydown", (event) => {
				this.localuser.keydown(event);
			});
			md.giveBox(area, (str, pre) => {
				this.localuser.search(search, md, str, pre);
			});
			sb.append(search);
			box.append(sb, area);
			superContainer.append(box);
			setTimeout(() => {
				area.focus();
				const fun = saveCaretPosition(area, Infinity);
				if (fun) fun();
			});
			box.oncontextmenu = (e) => {
				e.stopImmediatePropagation();
			};

			let tagList: string[] = [];

			const tags = document.createElement("div");
			tags.classList.add("forumTagSelect");
			for (const tag of this.availableTags.filter(
				(tag) => !tag.moderated || this.hasPermission("MANAGE_THREADS"),
			)) {
				const html = tag.makeHTML();
				html.onclick = () => {
					if (tagList.includes(tag.id)) {
						tagList = tagList.filter((id) => id !== tag.id);
						html.classList.remove("selected");
					} else {
						tagList.push(tag.id);
						tagList.sort();
						html.classList.add("selected");
					}
				};
				tags.append(html);
			}
			superContainer.append(tags);
			function showError(text: string) {
				errorText.textContent = text;
				setTimeout(() => {
					errorText.textContent = "";
				}, 5000);
			}

			const errorText = document.createElement("span");
			errorText.classList.add("forumPostError");
			superContainer.append(errorText);
		};

		const theadList = document.createElement("div");
		theadList.classList.add("flexttb", "forumList");
		container.append(theadList);

		let curidsearch = 0;
		text.onkeyup = async () => {
			const thisid = ++curidsearch;
			await new Promise((res) => setTimeout(res, 120));
			if (thisid !== curidsearch) return;
			this.forumSearch(text.value, theadList);
		};
		this.forumSearch("", theadList);
	}
	async getHTML(addstate = true, getMessages: boolean | void = undefined, aroundMessage?: string) {
		if (!this.visible) {
			this.guild.loadChannel();
			return;
		}
		if (this.owner instanceof Direct) {
			this.owner.freindDiv?.classList.remove("viewChannel");
		}
		if (this.localuser.channelfocus) {
			this.localuser.channelfocus.collectBox();
		}
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		typebox.markdown.boxEnabled = !this.curCommand;
		if (this.curCommand) {
			this.curCommand.render(typebox, this);
		}
		typebox.style.setProperty("--channel-text", JSON.stringify(I18n.channel.typebox(this.name)));
		if (!this.curCommand && !this.isForum()) {
			const md = typebox.markdown;
			md.owner = this;
			typebox.textContent = this.textSave;
			md.boxupdate(Infinity);
		}
		if (this.isForum()) {
			typebox.textContent = "";
		}
		this.localuser.fileExtange(this.files, this.htmls);

		if (getMessages === undefined) {
			getMessages = this.type !== 2 || !this.localuser.voiceAllowed;
		}

		const messages = document.getElementById("scrollWrap") as HTMLDivElement;
		const messageContainers = Array.from(messages.getElementsByClassName("messagecontainer"));
		for (const thing of messageContainers) {
			thing.remove();
		}
		const chatArea = document.getElementById("chatArea") as HTMLElement;

		const voiceArea = document.getElementById("voiceArea") as HTMLElement;
		voiceArea.innerHTML = "";
		if (getMessages) {
			chatArea.style.removeProperty("display");
		} else {
			if (this.voiceMode === "VoiceOnly") {
				chatArea.style.setProperty("display", "none");
			} else {
				chatArea.style.removeProperty("display");
				getMessages = true;
			}
			this.setUpVoiceArea();
		}

		const pinnedM = document.getElementById("pinnedMDiv");
		if (pinnedM) {
			if (this.unreadPins()) {
				pinnedM.classList.add("unreadPin");
			} else {
				pinnedM.classList.remove("unreadPin");
			}
		}
		if (addstate) {
			history.pushState(
				[this.guild_id, this.id, aroundMessage],
				"",
				"/channels/" + this.guild_id + "/" + this.id + (aroundMessage ? `/${aroundMessage}` : ""),
			);
		}
		this.localuser.pageTitle("#" + this.name);
		const channelTopic = document.getElementById("channelTopic") as HTMLSpanElement;
		if (this.topic) {
			channelTopic.innerHTML = "";
			channelTopic.append(new MarkDown(this.topic, this).makeHTML());
			channelTopic.removeAttribute("hidden");
			channelTopic.onclick = () => {
				const d = new Dialog(this.name);
				d.options.addHTMLArea(new MarkDown(this.topic, this).makeHTML());
				d.show();
			};
		} else {
			channelTopic.setAttribute("hidden", "");
			channelTopic.onclick = () => {};
		}
		if (this.guild !== this.localuser.lookingguild) {
			this.guild.loadGuild();
		}

		if (this.localuser.channelfocus && this.localuser.channelfocus.myhtml) {
			this.localuser.channelfocus.myhtml.classList.remove("viewChannel");
		}
		if (this.myhtml) {
			this.myhtml.classList.add("viewChannel");
		}
		const id = ++Channel.genid;

		if (this.localuser.channelfocus && this.localuser.channelfocus !== this) {
			this.localuser.channelfocus.infinite.delete();

			if (this.localuser.channelfocus.isThread() && !this.localuser.channelfocus.member) {
				const prev = this.localuser.channelfocus;
				this.localuser.channelfocus = this;
				prev.parent?.createguildHTML();
			}
		} else if (this.localuser.channelfocus === this && !aroundMessage && !this.isForum()) {
			if (this.lastmessageid)
				this.infinite.focus(aroundMessage || this.lastmessageid, !!aroundMessage, true);
			return;
		}
		this.guild.prevchannel = this;
		this.guild.perminfo.prevchannel = this.id;
		this.localuser.channelfocus = this;

		if (this.isThread() && !this.member) {
			this.parent?.createguildHTML();
			if (this.myhtml) {
				this.myhtml.classList.add("viewChannel");
			}
		}

		if (
			this.nsfw && //@ts-ignore another hack
			(!this.perminfo.nsfwOk || !this.localuser.user.nsfw_allowed)
		) {
			this.nsfwPannel();
			return;
		}
		this.slowmode();
		this.localuser.getSidePannel();
		if (this.isForum()) {
			this.renderForum();
			return;
		}

		const prom = this.infinite.delete();
		if (getMessages) {
			const loading = document.getElementById("loadingdiv") as HTMLDivElement;
			Channel.regenLoadingMessages();
			loading.classList.add("loading");
		}
		this.rendertyping();

		try {
			(document.getElementById("typebox") as HTMLDivElement).contentEditable = this.canMessage
				? "plaintext-only"
				: "false";
		} catch {
			(document.getElementById("typebox") as HTMLDivElement).contentEditable = this.canMessage
				? "true"
				: "false";
		}
		(document.getElementById("upload") as HTMLElement).style.visibility = this.canMessage
			? "visible"
			: "hidden";
		(document.getElementById("typediv") as HTMLElement).style.visibility = "visible";
		if (!mobile) {
			(document.getElementById("typebox") as HTMLDivElement).focus();
		}
		if (getMessages) await this.putmessages();
		await prom;
		if (id !== Channel.genid) {
			return;
		}
		this.makereplybox();

		if (getMessages) await this.buildmessages(aroundMessage);
		//loading.classList.remove("loading");
	}
	typingmap: Map<Member, number> = new Map();
	async typingStart(typing: startTypingjson): Promise<void> {
		const memb = await Member.new(typing.d.member!, this.guild);
		if (!memb) return;
		this.typingmap.set(memb, Date.now());
		memb.user.statusChange();
		setTimeout(() => {
			this.rendertyping();
			memb.user.statusChange();
		}, 10000);
		if (memb.id === this.localuser.user.id) {
			console.log("you is typing");
			return;
		}
		console.log("user is typing and you should see it");
		this.rendertyping();
	}
	similar(str: string) {
		if (this.type === 4) return -1;
		const strl = Math.max(str.length, 1);
		if (this.name.includes(str)) {
			return strl / this.name.length;
		} else if (this.name.toLowerCase().includes(str.toLowerCase())) {
			return strl / this.name.length / 1.2;
		}
		return 0;
	}
	rendertyping(): void {
		const typingtext = document.getElementById("typing") as HTMLDivElement;
		let build = "";
		let showing = false;
		let i = 0;
		const curtime = Date.now() - 5000;
		for (const thing of this.typingmap.keys()) {
			const self = thing.id === this.localuser.user.id;
			if ((this.typingmap.get(thing) as number) > curtime) {
				if (!self) {
					if (i !== 0) {
						build += ", ";
					}
					i++;
					if (thing.nick) {
						build += thing.nick;
					} else {
						build += thing.user.username;
					}
					showing = true;
				}
			} else {
				this.typingmap.delete(thing);
			}
		}
		build = I18n.typing(i + "", build);
		if (this.localuser.channelfocus === this) {
			if (showing) {
				typingtext.classList.remove("hidden");
				const typingtext2 = document.getElementById("typingtext") as HTMLDivElement;
				typingtext2.textContent = build;
			} else {
				typingtext.classList.add("hidden");
			}
		}
	}
	static regenLoadingMessages() {
		const loading = document.getElementById("loadingdiv") as HTMLDivElement;
		loading.innerHTML = "";
		for (let i = 0; i < 15; i++) {
			const div = document.createElement("div");
			div.classList.add("loadingmessage");
			if (Math.random() < 0.5) {
				const pfp = document.createElement("div");
				pfp.classList.add("loadingpfp");
				const username = document.createElement("div");
				username.style.width = Math.floor(Math.random() * 96 * 1.5 + 40) + "px";
				username.classList.add("loadingcontent");
				div.append(pfp, username);
			}
			const content = document.createElement("div");
			content.style.width = Math.floor(Math.random() * 96 * 3 + 40) + "px";
			content.style.height = Math.floor(Math.random() * 3 + 1) * 20 + "px";
			content.classList.add("loadingcontent");
			div.append(content);
			loading.append(div);
		}
	}
	lastmessage: Message | undefined;
	setnotifcation() {
		const optionsArr = ["all", "onlyMentions", "none", "default"] as const;
		const defualt = I18n.guild[optionsArr[this.guild.message_notifications]]();
		const options = optionsArr.map((e) => I18n.guild[e](defualt));
		const notiselect = new Dialog("");
		const form = notiselect.options.addForm(
			"",
			(_, sent: any) => {
				notiselect.hide();
				console.log(sent);
				this.message_notifications = sent.channel_overrides[this.id].message_notifications;
			},
			{
				fetchURL: `${this.info.api}/users/@me/guilds/${this.guild.id}/settings/`,
				method: "PATCH",
				headers: this.headers,
			},
		);
		form.addSelect(
			I18n.guild.selectnoti(),
			"message_notifications",
			options,
			{
				radio: true,
				defaultIndex: this.message_notifications,
			},
			[0, 1, 2, 3],
		);

		form.addPreprocessor((e: any) => {
			const message_notifications = e.message_notifications;
			delete e.message_notifications;
			e.channel_overrides = {
				[this.id]: {
					message_notifications,
					muted: this.muted,
					mute_config: this.mute_config,
					channel_id: this.id,
				},
			};
		});
		notiselect.show();
	}
	async putmessages() {
		//TODO swap out with the WS op code
		if (this.allthewayup) {
			return;
		}
		if (this.lastreadmessageid && this.messages.has(this.lastreadmessageid)) {
			return;
		}
		const j = await fetch(this.info.api + "/channels/" + this.id + "/messages?limit=100", {
			headers: this.headers,
		});

		const response = (await j.json()) as messagejson[];
		if (response.length !== 100) {
			this.allthewayup = true;
		}
		let prev: Message | undefined;
		for (const thing of response) {
			const message = new Message(thing, this);
			if (prev) {
				this.idToNext.set(message.id, prev.id);
				this.idToPrev.set(prev.id, message.id);
			} else {
				this.lastmessage = message;
				this.setLastMessageId(message.id);
			}
			prev = message;
		}
		if (!response.length) {
			this.lastmessageid = undefined;
			this.lastreadmessageid = undefined;
		}
		await this.slowmode();
	}
	delChannel(json: channeljson) {
		const build: Channel[] = [];
		for (const thing of this.children) {
			if (thing.id !== json.id) {
				build.push(thing);
			}
		}
		this.children = build;
	}
	afterProm?: Promise<void>;
	afterProms = new Map<string, () => void>();
	async grabAfter(id: string) {
		if (this.idToNext.has(id)) {
			return;
		}
		if (id === this.lastmessage?.id) {
			return;
		}
		if (this.afterProm) return new Promise<void>((res) => this.afterProms.set(id, res));
		let tempy: string | undefined = id;
		while (tempy && tempy.includes("fake")) {
			tempy = this.idToPrev.get(tempy);
		}
		if (!tempy) return;
		id = tempy;
		this.afterProm = new Promise(async (res) => {
			const messages = (await (
				await fetch(this.info.api + "/channels/" + this.id + "/messages?limit=100&after=" + id, {
					headers: this.headers,
				})
			).json()) as messagejson[];
			let i = 0;
			let previd: string = id;
			for (const response of messages) {
				let messager: Message;
				let willbreak = false;
				if (this.messages.has(response.id)) {
					messager = this.messages.get(response.id) as Message;
					willbreak = true;
				} else {
					messager = new Message(response, this);
				}
				this.idToPrev.set(messager.id, previd);
				this.idToNext.set(previd, messager.id);

				const res = this.afterProms.get(previd);
				if (res) {
					res();
					this.afterProms.delete(previd);
				}

				previd = messager.id;
				if (willbreak) {
					break;
				}
				i++;
			}
			if (i === 0) {
				this.idToNext.set(id, undefined);
			}
			{
				const res = this.afterProms.get(previd);
				if (res) {
					res();
					this.beforeProms.delete(previd);
				}
			}
			res();
			this.afterProm = undefined;
			if (this.afterProms.size !== 0) {
				const [id] = this.afterProms.entries().next().value as [string, () => void];
				this.grabAfter(id);
			}
		});
		return new Promise<void>((res) => this.afterProms.set(id, res));
	}
	async getArround(id: string) {
		if (!this.messages.has(id)) {
			await this.getmessage(id);
		} else {
			console.log("have " + id);
		}
		await Promise.all([this.grabBefore(id), this.grabAfter(id)]);
	}
	topid!: string;
	beforeProm?: Promise<void>;
	beforeProms = new Map<string, () => void>();
	async grabBefore(id: string) {
		if (this.beforeProm) return this.beforeProm;
		if (this.topid && id === this.topid) {
			return;
		}
		this.beforeProm = new Promise<void>(async (res) => {
			let tempy: string | undefined = id;
			while (tempy && tempy.includes("fake")) {
				tempy = this.idToPrev.get(tempy);
			}
			if (!tempy) {
				const res2 = this.beforeProms.get(id);
				res2?.();
				res();
				return;
			}
			id = tempy;
			const messages = (await (
				await fetch(
					this.info.api + "/channels/" + this.id + "/messages?before=" + id + "&limit=100",
					{
						headers: this.headers,
					},
				)
			).json()) as messagejson[];
			let previd = id;
			let i = 0;
			for (const response of messages) {
				let messager: Message;
				if (this.messages.has(response.id)) {
					messager = this.messages.get(response.id) as Message;
				} else {
					messager = new Message(response, this);
				}

				this.idToNext.set(messager.id, previd);
				this.idToPrev.set(previd, messager.id);

				const res = this.beforeProms.get(previd);
				if (res) {
					res();
					this.beforeProms.delete(previd);
				}

				previd = messager.id;

				if (i < 99) {
					this.topid = previd;
				}

				i++;
			}
			if (i < 100) {
				this.allthewayup = true;
				if (i === 0) {
					this.topid = id;
					this.idToPrev.set(id, undefined);
				}
			}
			{
				const res = this.beforeProms.get(previd);
				if (res) {
					res();
					this.beforeProms.delete(previd);
				}
			}
			this.beforeProm = undefined;
			res();
			if (this.beforeProms.size !== 0) {
				const [id] = this.beforeProms.entries().next().value as [string, () => void];
				this.grabBefore(id);
			}
		});
		return new Promise<void>((res) => this.beforeProms.set(id, res));
	}
	async buildmessages(id: string | void) {
		this.infinitefocus = false;
		await this.tryfocusinfinate(id, !!id);
	}
	infinitefocus = false;
	async tryfocusinfinate(id: string | void, flash = false) {
		if (typeof id === "string" && !this.messages.has(id)) await this.getmessage(id);
		if (this.infinitefocus) return;
		this.infinitefocus = true;
		const messages = document.getElementById("scrollWrap") as HTMLDivElement;
		const messageContainers = Array.from(messages.getElementsByClassName("messagecontainer"));
		for (const thing of messageContainers) {
			thing.remove();
		}
		const loading = document.getElementById("loadingdiv") as HTMLDivElement;
		const removetitle = document.getElementById("removetitle");
		//messages.innerHTML="";
		if (!id) {
			if (this.lastreadmessageid && this.messages.has(this.lastreadmessageid)) {
				id = this.lastreadmessageid;
			} else if (this.lastreadmessageid && (id = this.findClosest(this.lastreadmessageid))) {
			} else if (this.lastmessageid && this.messages.has(this.lastmessageid)) {
				id = this.goBackIds(this.lastmessageid, 50);
			}
		}
		if (!id) {
			if (!removetitle) {
				const title = document.createElement("h2");
				title.id = "removetitle";
				title.textContent = I18n.noMessages();
				title.classList.add("titlespace", "messagecontainer");
				messages.append(title);
			}
			this.infinitefocus = false;
			loading.classList.remove("loading");
			return;
		} else if (removetitle) {
			removetitle.remove();
		}
		if (this.localuser.channelfocus !== this) {
			return;
		}
		const elements = Array.from(messages.getElementsByClassName("scroller"));
		for (const elm of elements) {
			elm.remove();
			console.warn("rouge element detected and removed");
		}
		messages.append(await this.infinite.getDiv(id, flash));
		/*
		await this.infinite.watchForChange().then(async (_) => {
			//await new Promise(resolve => setTimeout(resolve, 0));

			await this.infinite.focus(id, falsh); //if someone could figure out how to make this work correctly without this, that's be great :P


			this.infinite.focus(id, falsh, true);
		});
		*/
		await this.focus(id, flash);
		loading.classList.remove("loading");
		//this.infinite.focus(id.id,false);
	}
	private goBackIds(id: string, back: number, returnifnotexistant = true): string | undefined {
		while (back !== 0) {
			const nextid = this.idToPrev.get(id);
			if (nextid) {
				id = nextid;
				back--;
			} else {
				if (returnifnotexistant) {
					break;
				} else {
					return undefined;
				}
			}
		}
		return id;
	}
	private findClosest(id: string | undefined) {
		const mTime = (id: string) => {
			return this.messages.get(id)?.getTimeStamp() || -1;
		};
		if (!this.lastmessageid || !id) return;
		let flake: string | undefined = this.lastmessageid;
		const time = mTime(id);
		let flaketime = mTime(flake);
		while (flake && time < flaketime) {
			flake = this.idToPrev.get(flake);

			if (!flake) {
				return;
			}
			flaketime = mTime(flake);
		}
		return flake;
	}
	nameSpan = new WeakRef(document.createElement("span") as HTMLElement);
	updateChannel(json: channeljson) {
		this.type = json.type;
		if (json.flags !== undefined) this.flags = json.flags;
		this.name = json.name;
		this.owner_id = json.owner_id;
		this.icon = json.icon;
		this.defaultAutoArchiveDuration = json.default_auto_archive_duration;
		this.renderIcon();
		this.threadData = json.thread_metadata;
		this.rate_limit_per_user = json.rate_limit_per_user || 0;
		this.appliedTags = json.applied_tags || this.appliedTags;
		this.availableTags =
			json.available_tags?.map((tag) => new Tag(tag, this)) || this.availableTags;
		this.slowmode();

		const span = this.nameSpan.deref();
		if (span) span.textContent = this.name;
		const parent = this.localuser.channelids.get(json.parent_id);
		if (parent) {
			this.parent = parent;
			this.parent_id = parent.id;
		} else {
			this.parent = undefined;
			this.parent_id = undefined;
		}

		this.guild_id = json.guild_id;
		const oldover = this.permission_overwrites;
		this.permission_overwrites = new Map();
		this.permission_overwritesar = [];
		for (const thing of json.permission_overwrites || []) {
			this.permission_overwrites.set(thing.id, new Permissions(thing.allow, thing.deny));
			const permisions = this.permission_overwrites.get(thing.id);
			if (permisions) {
				const role = this.guild.roleids.get(thing.id);
				if (role) {
					this.permission_overwritesar.push([role, permisions]);
				} else {
					this.permission_overwritesar.push([this.localuser.getUser(thing.id), permisions]);
				}
			}
		}
		const nchange = [...new Set<string>().union(oldover).difference(this.permission_overwrites)];
		const pchange = [...new Set<string>().union(this.permission_overwrites).difference(oldover)];
		for (const thing of nchange) {
			const role = this.guild.roleids.get(thing);
			if (role) {
				this.croleUpdate(role, new Permissions("0"), false);
			} else {
				const user = this.localuser.getUser(thing);
				user.then((_) => {
					if (_) this.croleUpdate(_, new Permissions("0"), false);
				});
			}
		}
		for (const thing of pchange) {
			const role = this.guild.roleids.get(thing);
			const perms = this.permission_overwrites.get(thing);
			if (role && perms) {
				this.croleUpdate(role, perms, true);
			} else if (perms) {
				const user = this.localuser.getUser(thing);
				user.then((_) => {
					if (_) this.croleUpdate(_, perms, true);
				});
			}
		}
		console.log(pchange, nchange);
		this.topic = json.topic;
		this.nsfw = json.nsfw;
		this.fireEvents();
	}
	croleUpdate: (role: Role | User, perm: Permissions, added: boolean) => unknown = () => {};
	typingstart() {
		if (this.typing > Date.now()) {
			return;
		}
		this.typing = Date.now() + 6000;
		fetch(this.info.api + "/channels/" + this.id + "/typing", {
			method: "POST",
			headers: this.headers,
		});
	}
	get trueNotiValue() {
		const val = this.notification;
		if (val === "default") {
			switch (Number(this.guild.message_notifications)) {
				case 0:
					return "all";
				case 1:
					return "mentions";
				case 2:
					return "none";
				default:
					return "mentions";
			}
		}

		return val;
	}
	get notification() {
		let notinumber: number | null = this.message_notifications;
		if (Number(notinumber) === 3) {
			notinumber = null;
		}
		notinumber ??= this.guild.message_notifications;
		console.warn("info:", notinumber);
		switch (Number(notinumber)) {
			case 0:
				return "all";
			case 1:
				return "mentions";
			case 2:
				return "none";
			case 3:
			default:
				return "default";
		}
	}
	fakeMessages = new WeakMap<Message, HTMLElement>();
	nonceMap = new Map<string, string>();
	destroyFakeMessage(id: string) {
		const message = this.messages.get(id);
		if (!message) return;
		message.deleteEvent();

		const div = this.fakeMessages.get(message);
		div?.remove();
		this.fakeMessages.delete(message);
		this.messages.delete(id);

		for (const {url} of message.attachments) {
			try {
				URL.revokeObjectURL(url);
			} catch {}
		}
	}

	async makeFakeMessage(
		content: string,
		files: filejson[] = [],
		reply = undefined,
		sticker_ids: string[],
		nonce: string,
		embeds: embedjson[] = [],
	) {
		if (this.nonces.has(nonce)) return;
		const m = new Message(
			{
				author: this.localuser.user.tojson(),
				channel_id: this.id,
				guild_id: this.guild.id,
				id: "fake" + Math.random(),
				content: content.trim(),
				timestamp: new Date().toISOString(),
				edited_timestamp: null,
				mentions: [],
				mention_roles: [],
				mention_everyone: false,
				attachments: files,
				tts: false,
				embeds,
				reactions: [],
				nonce,
				type: 0,
				pinned: false,
				message_reference: reply,
				sticker_items: sticker_ids
					.map((_) => {
						return Sticker.getFromId(_, this.localuser);
					})
					.filter((_) => _ !== undefined),
			},
			this,
		);
		if (!this.lastmessageid) {
			this.topid = m.id;
		}
		this.nonceMap.set(nonce, m.id);
		const prev = this.lastmessage;
		const makeRecent = () => {
			if (this.lastmessageid) {
				this.idToNext.set(this.lastmessageid, m.id);
				this.idToPrev.set(m.id, this.lastmessageid);
			}
			this.lastmessage = m;
			this.setLastMessageId(m.id);
		};
		makeRecent();

		const html = m.buildhtml(prev, true);
		html.classList.add("messagediv", "loadingMessage");
		this.fakeMessages.set(m, html);
		let loadingP = document.createElement("span");

		const buttons = document.createElement("div");
		buttons.classList.add("flexltr");

		const retryB = document.createElement("button");
		retryB.textContent = I18n.message.retry();

		const dont = document.createElement("button");
		dont.textContent = I18n.message.delete();
		dont.onclick = (_) => {
			this.fakeMessages.delete(m);
			html.remove();
			for (const {url} of m.attachments) {
				URL.revokeObjectURL(url);
			}
		};
		dont.style.marginLeft = "4px";
		buttons.append(retryB, dont);

		if (this === this.localuser.channelfocus) {
			if (!this.infinitefocus) {
				await this.tryfocusinfinate();
			}
			await this.infinite.addedBottom();
			this.focus(m.id, false);
		}

		return {
			progress: (total: number, sofar: number) => {
				if (total < 20000 || sofar === total) {
					loadingP.remove();
					return;
				}
				html.append(loadingP);
				loadingP.textContent = File.filesizehuman(sofar) + " / " + File.filesizehuman(total);
			},
			failed: (retry: () => void) => {
				m.deleteEvent();
				makeRecent();
				loadingP.remove();
				html.append(buttons);
				retryB.onclick = () => {
					retry();
					html.classList.remove("erroredMessage");
					buttons.remove();
				};
				html.classList.add("erroredMessage");
			},
			void: () => {
				m.deleteEvent();
				html.remove();
			},
		};
	}
	async uploadFile(files: globalThis.File[]) {
		const urls = (await (
			await fetch(this.info.api + "/channels/" + this.id + "/attachments", {
				headers: this.headers,
				body: JSON.stringify({
					files: files.map((file, index) => {
						return {
							file_size: file.size,
							filename: file.name,
							id: index + "",
						};
					}),
				}),
				method: "POST",
			})
		).json()) as {
			attachments: {
				id: string;
				upload_url: string;
				upload_filename: string;
				original_content_type?: string;
			}[];
		};
		Promise.all(
			urls.attachments.map(async ({upload_url, id}) => {
				return await (
					await fetch(upload_url, {
						body: files[+id],
						method: "PUT",
					})
				).json();
			}),
		);
		return urls.attachments;
	}
	nonces = new Set<string>();
	lastSentMessage?: Message;
	canMessageRightNow() {
		if (this.guild.member) {
			const member = this.guild.member;
			if (member.commuicationDisabledLeft()) return false;
		}
		const t = this.lastSentMessage?.getTimeStamp();
		if (!t) return true;
		if (
			this.hasPermission("BYPASS_SLOWMODE") ||
			this.hasPermission("MANAGE_MESSAGES") ||
			this.hasPermission("MANAGE_CHANNELS")
		)
			return true;
		let canMessage = t + this.rate_limit_per_user * 1000;
		return canMessage <= Date.now();
	}
	async slowmode(bad = false) {
		const realbox = document.getElementById("realbox") as HTMLDivElement;
		Array.from(realbox.getElementsByClassName("slowmodeTimer")).forEach((_) => _.remove());
		if (this.guild.member) {
			const member = this.guild.member;
			const left = member.commuicationDisabledLeft();
			if (left) {
				const span = document.createElement("span");
				span.classList.add("slowmodeTimer");
				realbox.append(span);
				const canMessage = +(member.communication_disabled_until as Date);
				const tick = () => {
					const timeTill = canMessage - Date.now();
					if (timeTill <= 0 || !document.contains(span)) {
						if (document.contains(span)) span.remove();
						clearInterval(int);
						return;
					}
					span.textContent = I18n.channel.TimeOutCool(formatTime(timeTill));
				};
				tick();
				const int = setInterval(tick, 1000);
			}
		}
		function formatTime(timeTill: number) {
			let seconds = Math.round(timeTill / 1000);
			let minutes = Math.floor(seconds / 60);
			seconds -= minutes * 60;
			let hours = Math.floor(minutes / 60);
			minutes -= hours * 60;
			let build = "";
			build = seconds + "";
			if (minutes || hours) {
				build = minutes + ":" + build.padStart(2, "0");
			}
			if (hours) {
				build = hours + ":" + build.padStart(5, "0");
			}
			return build;
		}
		if (!this.rate_limit_per_user) return;
		if (
			this.hasPermission("BYPASS_SLOWMODE") ||
			this.hasPermission("MANAGE_MESSAGES") ||
			this.hasPermission("MANAGE_CHANNELS")
		)
			return;
		let m: Message | undefined = this.lastSentMessage || this.lastmessage;
		if (!this.lastSentMessage) {
			while (m) {
				if (m.author.id === this.localuser.user.id) {
					this.lastSentMessage = m;
					break;
				}
				m = this.messages.get(this.idToNext.get(m.id) as string);
			}
		}

		if (!m && bad) {
			const q = new URLSearchParams([
				["author_id", this.localuser.user.id],
				["limit", "1"],
			]);
			const {
				messages: [message],
			} = (await (
				await fetch(this.info.api + "/guilds/" + this.guild.id + "/messages/search/?" + q, {
					headers: this.headers,
				})
			).json()) as {messages: messagejson[]};
			m = new Message(message, this);
			this.lastSentMessage = m;
		}
		if (!m) return;
		const t = m.getTimeStamp();
		let canMessage = t + this.rate_limit_per_user * 1000;

		if (canMessage <= Date.now()) {
			realbox.classList.remove("cantSendMessage");
			return;
		} else {
			realbox.classList.add("cantSendMessage");
			const span = document.createElement("span");
			span.classList.add("slowmodeTimer");
			realbox.append(span);
			const tick = () => {
				const timeTill = canMessage - Date.now();
				if (timeTill <= 0 || !document.contains(span)) {
					if (document.contains(span)) span.remove();
					clearInterval(int);
					return;
				}
				span.textContent = I18n.channel.SlowmodeCool(formatTime(timeTill));
			};
			tick();
			const int = setInterval(tick, 1000);
		}
	}
	async sendMessage(
		content: string,
		{
			attachments = [],
			replyingto = null,
			embeds = [],
			sticker_ids = [],
			nonce = undefined,
		}: {
			attachments: Blob[];
			embeds: embedjson[];
			replyingto: Message | null;
			sticker_ids: string[];
			nonce?: string;
		},
		onRes = (_e: "Ok" | "NotOk") => {},
	) {
		let ressy = (_e: "Ok" | "NotOk") => {};
		let resOnce = false;
		if (
			content.trim() === "" &&
			attachments.length === 0 &&
			embeds.length == 0 &&
			sticker_ids.length === 0
		) {
			return;
		}
		let replyjson: any;
		if (replyingto) {
			replyjson = {
				guild_id: replyingto.guild.id,
				channel_id: replyingto.channel.id,
				message_id: replyingto.id,
			};
		}

		let prom: Promise<void>;
		let res: XMLHttpRequest;
		let funcs:
			| undefined
			| {
					progress: (total: number, sofar: number) => void;
					failed: (restart: () => void) => void;
					void: () => void;
			  };
		const progress = (e: ProgressEvent<EventTarget>) => {
			funcs?.progress(e.total, e.loaded);
		};

		const fail = () => {
			console.warn("failed");
			funcs?.failed(() => {
				res.open("POST", this.info.api + "/channels/" + this.id + "/messages");
				res.setRequestHeader("Authorization", this.headers.Authorization);
				if (ctype) {
					res.setRequestHeader("Content-type", ctype);
				}
				res.send(rbody);
			});
		};

		const promiseHandler = (resolve: () => void) => {
			res.responseType = "json";
			res.onload = () => {
				if (res.status !== 200) {
					ressy("NotOk");
					onRes("NotOk");
					fail();
					const body = res.response as {code: number};
					if (body.code === 20016) {
						this.slowmode(true);
					}
					return;
				} else {
					ressy("Ok");
					onRes("Ok");
					if (!resOnce && res?.status) {
						resOnce = true;
					}
				}
				resolve();
			};
		};

		let rbody: string | FormData;
		let ctype: string | undefined;
		const maybeUpdate = () => {
			if ("updatePosition" in this && this.updatePosition instanceof Function) {
				console.log("here?");
				this.updatePosition(Date.now());
			}
		};
		maybeUpdate();
		ressy = async (e) => {
			if (e == "NotOk") {
				funcs?.void();
				return;
			}
		};
		if (attachments.length === 0) {
			const body = {
				content,
				nonce: nonce || Math.floor(Math.random() * 1000000000) + "",
				message_reference: undefined,
				sticker_ids,
				embeds,
			};
			if (replyjson) {
				body.message_reference = replyjson;
			}
			res = new XMLHttpRequest();
			res.responseType = "json";
			res.upload.onprogress = progress;
			res.onerror = fail;
			prom = new Promise<void>(promiseHandler);
			res.open("POST", this.info.api + "/channels/" + this.id + "/messages");
			res.setRequestHeader("Content-type", (ctype = this.headers["Content-type"]));
			res.setRequestHeader("Authorization", this.headers.Authorization);
			funcs = await this.makeFakeMessage(
				content,
				[],
				body.message_reference,
				sticker_ids,
				body.nonce,
				embeds,
			);

			try {
				res.send((rbody = JSON.stringify(body)));
			} catch {
				fail();
			}
			/*
			res = fetch(this.info.api + "/channels/" + this.id + "/messages", {
				method: "POST",
				headers: this.headers,
				body: JSON.stringify(body),
			});
			*/
		} else {
			const formData = new FormData();
			const body = {
				content,
				nonce: nonce || Math.floor(Math.random() * 1000000000) + "",
				message_reference: undefined,
				sticker_ids,
				embeds,
			};
			if (replyjson) {
				body.message_reference = replyjson;
			}
			formData.append("payload_json", JSON.stringify(body));
			for (const i in attachments) {
				formData.append("files[" + i + "]", attachments[i]);
			}

			res = new XMLHttpRequest();
			res.responseType = "json";
			res.upload.onprogress = progress;
			res.onerror = fail;
			prom = new Promise<void>(promiseHandler);
			res.open("POST", this.info.api + "/channels/" + this.id + "/messages", true);

			res.setRequestHeader("Authorization", this.headers.Authorization);

			funcs = await this.makeFakeMessage(
				content,
				attachments.map((_) => ({
					id: "string",
					filename: "",
					content_type: _.type,
					size: _.size,
					url: URL.createObjectURL(_),
				})),
				body.message_reference,
				sticker_ids,
				body.nonce,
			);
			try {
				res.send((rbody = formData));
			} catch {
				fail();
			}
			/*
			res = fetch(this.info.api + "/channels/" + this.id + "/messages", {
				method: "POST",
				body: formData,
				headers: {Authorization: this.headers.Authorization},
			});
			*/
		}

		return prom;
	}
	unreads() {
		if (!this.hasunreads) {
			if (this.myhtml) {
				this.myhtml.classList.remove("cunread", "mentioned");
			}
		} else {
			if (this.myhtml) {
				this.myhtml.classList.add("cunread");
			}
			if (this.mentions !== 0) {
				this.myhtml?.classList.add("mentioned");
			}
		}
	}
	async goToBottom() {
		if (this.lastmessageid) await this.focus(this.lastmessageid, false);
	}
	async messageCreate(messagep: messageCreateJson): Promise<void> {
		if (this.totalMessageSent !== undefined) this.totalMessageSent++;
		if (this.messageCount !== undefined) this.messageCount++;
		if (!this.hasPermission("VIEW_CHANNEL")) {
			return;
		}
		if (this.messages.get(messagep.d.id)) {
			console.error("Duped message?");
			return;
		}
		this.nonces.add(messagep.d.nonce);
		setTimeout(
			() => {
				this.nonces.delete(messagep.d.nonce);
			},
			1000 * 60 * 5,
		);

		if (!this.lastmessageid) {
			this.topid = messagep.d.id;
		}
		const messagez = new Message(messagep.d, this);
		Member.resolveMember(messagez.author, this.guild).then((_) => {
			this.typingmap.delete(_ as Member);
			this.rendertyping();
		});
		this.lastmessage = messagez;
		if (this.lastmessageid && this.lastmessageid !== messagez.id) {
			this.idToNext.set(this.lastmessageid, messagez.id);
			this.idToPrev.set(messagez.id, this.lastmessageid);
		} else {
			console.error("something bad happened");
		}
		if (
			(messagez.mentionsuser(this.localuser.user) || this.guild.id === "@me") &&
			messagez.author !== this.localuser.user
		) {
			this.mentions++;
		}
		this.setLastMessageId(messagez.id);

		if (this.infinite.atBottom()) {
			this.lastreadmessageid = messagez.id;
		}

		this.unreads();
		this.guild.unreads();
		if (this === this.localuser.channelfocus) {
			if (!this.infinitefocus) {
				await this.tryfocusinfinate();
			}
			await this.infinite.addedBottom();
		}

		if (messagez.author === this.localuser.user) {
			this.lastSentMessage = messagez;
			this.slowmode();
			this.mentions = 0;
			this.unreads();
			this.guild.unreads();
			if (this == this.localuser.channelfocus) {
				setTimeout(() => this.goToBottom());
			}
		}
		this.fireEvents();

		if (messagez.author === this.localuser.user) {
			return;
		}
		if (this.localuser.lookingguild?.prevchannel === this && document.hasFocus()) {
			return;
		}

		this.notify(messagez);
	}
	notititle(message: Message): string {
		return message.author.username + " > " + this.guild.properties.name + " > " + this.name;
	}
	notify(message: Message, deep = 0) {
		if (this.muted) return;

		if (this.localuser.status === "dnd") return;

		if (this.guild.muted) {
			return;
		}
		if (this.trueNotiValue === "none") {
			return;
		} else if (this.notification === "mentions" && !message.mentionsuser(this.localuser.user)) {
			return;
		}
		if (message.author.relationshipType == 2) {
			return;
		}

		if (this.localuser.play) {
			this.localuser.playSound();
		} else {
			console.warn("no play 3:");
		}
		if ("Notification" in window && Notification.permission === "granted") {
			NotificationHandler.sendMessageNotification(message);
		} else if (Notification.permission !== "denied") {
			Notification.requestPermission().then(() => {
				if (deep === 3) {
					return;
				}
				this.notify(message, deep + 1);
			});
		}
	}
	voiceMode: "VoiceOnly" | "ChatAndVoice" = "VoiceOnly";
	async addRoleToPerms(role: Role | User) {
		await fetch(this.info.api + "/channels/" + this.id + "/permissions/" + role.id, {
			method: "PUT",
			headers: this.headers,
			body: JSON.stringify({
				allow: "0",
				deny: "0",
				id: role.id,
				type: role instanceof User ? 1 : 0,
			}),
		});
		const perm = new Permissions("0", "0");
		this.permission_overwrites.set(role.id, perm);
		this.permission_overwritesar.push([
			role instanceof User ? new Promise<User>((res) => res(role)) : role,
			perm,
		]);
	}
	async updateRolePermissions(id: string, perms: Permissions) {
		const permission = this.permission_overwrites.get(id);
		if (permission) {
			permission.allow = perms.allow;
			permission.deny = perms.deny;
		} else {
			//this.permission_overwrites.set(id,perms);
		}
		await fetch(this.info.api + "/channels/" + this.id + "/permissions/" + id, {
			method: "PUT",
			headers: this.headers,
			body: JSON.stringify({
				allow: perms.allow.toString(),
				deny: perms.deny.toString(),
				id,
				type: this.localuser.userMap.get(id) ? 1 : 0,
			}),
		});
	}
}
Channel.setupcontextmenu();
export {Channel};
