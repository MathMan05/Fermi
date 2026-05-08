import {Guild} from "./guild.js";
import {Channel} from "./channel.js";
import {Message} from "./message.js";
import {Localuser} from "./localuser.js";
import {User} from "./user.js";
import {channeljson, dirrectjson, memberjson, messageCreateJson, readyjson} from "./jsontypes.js";
import {Permissions} from "./permissions.js";
import {SnowFlake} from "./snowflake.js";
import {Contextmenu} from "./contextmenu.js";
import {I18n} from "./i18n.js";
import {Dialog, Float, FormError} from "./settings.js";
import {Discovery} from "./discovery.js";
import {createImg} from "./utils/utils.js";
import {CDNParams} from "./utils/cdnParams.js";

class Direct extends Guild {
	channels: Group[];
	getUnixTime(): number {
		throw new Error("Do not call this for Direct, it does not make sense");
	}
	discovery: Discovery;
	constructor(json: dirrectjson[], owner: Localuser) {
		super(-1, owner, null);
		this.message_notifications = 0;
		this.channels = [];
		// @ts-ignore it's a hack, but it's a hack that works
		this.properties = {};
		this.roles = [];
		this.roleids = new Map();
		this.prevchannel = undefined;
		this.properties.name = I18n.DMs.name();
		for (const thing of json) {
			const temp = new Group(thing, this);
			this.channels.push(temp);
			this.localuser.channelids.set(temp.id, temp);
		}
		this.headchannels = this.channels;
		this.discovery = new Discovery(this);
	}
	createChannelpac(json: any) {
		const thischannel = new Group(json, this);
		this.channels.push(thischannel);
		this.localuser.channelids.set(thischannel.id, thischannel);
		this.sortchannels();
		this.printServers();
		return thischannel;
	}
	delChannel(json: channeljson) {
		const channel = this.localuser.channelids.get(json.id) as Group;
		super.delChannel(json);
		if (channel) {
			channel.del();
		}
	}
	freindDiv?: HTMLDivElement;
	getHTML() {
		const voiceArea = document.getElementById("voiceArea") as HTMLElement;
		voiceArea.innerHTML = "";
		const sideContainDiv = document.getElementById("sideContainDiv");
		if (sideContainDiv) {
			sideContainDiv.classList.remove("searchDiv");
			sideContainDiv.classList.remove("hideSearchDiv");
		}
		const searchBox = document.getElementById("searchBox");
		if (searchBox) searchBox.textContent = "";

		const ddiv = document.createElement("div");
		const build = super.getHTML();
		const freindDiv = document.createElement("div");
		freindDiv.classList.add("liststyle", "flexltr", "friendsbutton");

		const icon = document.createElement("span");
		icon.classList.add("svgicon", "svg-friends", "space");
		freindDiv.append(icon);
		this.freindDiv = freindDiv;

		freindDiv.append(I18n.friends.friends());
		freindDiv.onclick = () => {
			this.loadChannel(null);
		};

		const newDm = document.createElement("div");
		newDm.classList.add("flexltr", "dmline");
		newDm.onclick = () => this.makeGroup();

		const span = document.createElement("span");
		span.classList.add("svg-plus", "svgicon", "addchannel");

		newDm.append(I18n.dms(), span);

		ddiv.append(freindDiv, newDm, build);
		return ddiv;
	}
	async loadChannel(id?: string | null | undefined, addstate = true, message?: string) {
		if (id === "discover") {
			this.removePrevChannel();
			this.discovery.makeMenu();
			return;
		}
		await super.loadChannel(id, addstate, message);
	}
	async makeGroup() {
		const dio = new Dialog(I18n.group.select());
		const opt = dio.options;
		dio.show();
		const invited = await User.makeSelector(
			opt,
			I18n.group.createdm(),
			[...this.localuser.inrelation].filter((_) => _.relationshipType === 1),
		);
		dio.hide();
		if (invited && invited.size !== 0) {
			const {id}: {id: string} = await (
				await fetch(this.localuser.info.api + "/users/@me/channels", {
					method: "POST",
					headers: this.headers,
					body: JSON.stringify({
						recipients: [...invited].map((_) => _.id),
					}),
				})
			).json();
			this.localuser.goToChannel(id);
			dio.hide();
		}
	}
	noChannel(addstate: boolean) {
		if (addstate) {
			history.pushState([this.id, undefined], "", "/channels/" + this.id);
		}
		if (this.freindDiv) {
			this.freindDiv.classList.add("viewChannel");
		}
		this.localuser.pageTitle(I18n.friends.friendlist());
		const channelTopic = document.getElementById("channelTopic") as HTMLSpanElement;
		channelTopic.removeAttribute("hidden");
		channelTopic.textContent = "";
		channelTopic.onclick = () => {};

		const loading = document.getElementById("loadingdiv") as HTMLDivElement;
		loading.classList.remove("loading");
		this.localuser.getSidePannel();

		const messages = document.getElementById("scrollWrap") as HTMLDivElement;
		for (const thing of Array.from(messages.getElementsByClassName("messagecontainer"))) {
			thing.remove();
		}
		const container = document.createElement("div");
		container.classList.add("messagecontainer", "flexttb", "friendcontainer");

		messages.append(container);
		const checkVoid = () => {
			if (this.localuser.channelfocus !== undefined || this.localuser.lookingguild !== this) {
				this.localuser.relationshipsUpdate = () => {};
			}
		};
		function genuserstrip(user: User, icons: HTMLElement): HTMLElement {
			const div = document.createElement("div");
			div.classList.add("flexltr", "liststyle");
			user.bind(div);
			div.append(user.buildpfp(undefined, div));

			const userinfos = document.createElement("div");
			userinfos.classList.add("flexttb");
			const username = document.createElement("span");
			username.textContent = user.name;
			user.subName(username);
			userinfos.append(username, user.getStatus());
			div.append(userinfos);
			User.contextmenu.bindContextmenu(div, user, undefined);
			userinfos.style.flexGrow = "1";

			div.append(icons);
			return div;
		}
		{
			const online = document.createElement("button");
			online.textContent = I18n.friends.online();
			channelTopic.append(online);
			const genOnline = () => {
				this.localuser.relationshipsUpdate = genOnline;
				checkVoid();
				container.innerHTML = "";
				container.append(I18n.friends["online:"]());
				for (const user of this.localuser.inrelation) {
					if (user.relationshipType === 1 && user.online) {
						const buttonc = document.createElement("div");
						const button1 = document.createElement("span");
						button1.classList.add("svg-frmessage", "svgicon");
						buttonc.append(button1);
						buttonc.classList.add("friendlyButton");
						buttonc.onclick = (e) => {
							e.stopImmediatePropagation();
							user.opendm();
						};
						container.append(genuserstrip(user, buttonc));
					}
				}
			};
			online.onclick = genOnline;
			genOnline();
		}
		{
			const all = document.createElement("button");
			all.textContent = I18n.friends.all();
			const genAll = () => {
				this.localuser.relationshipsUpdate = genAll;
				checkVoid();
				container.innerHTML = "";
				container.append(I18n.friends["all:"]());
				for (const user of this.localuser.inrelation) {
					if (user.relationshipType === 1) {
						const buttonc = document.createElement("div");
						const button1 = document.createElement("span");
						button1.classList.add("svg-frmessage", "svgicon");
						buttonc.append(button1);
						buttonc.classList.add("friendlyButton");
						buttonc.onclick = (e) => {
							e.stopImmediatePropagation();
							user.opendm();
						};
						container.append(genuserstrip(user, buttonc));
					}
				}
			};
			all.onclick = genAll;
			channelTopic.append(all);
		}
		{
			const pending = document.createElement("button");
			pending.textContent = I18n.friends.pending();
			const genPending = () => {
				this.localuser.relationshipsUpdate = genPending;
				checkVoid();
				container.innerHTML = "";
				container.append(I18n.friends["pending:"]());
				for (const user of this.localuser.inrelation) {
					if (user.relationshipType === 3 || user.relationshipType === 4) {
						const buttons = document.createElement("div");
						buttons.classList.add("flexltr");
						const buttonc = document.createElement("div");
						const button1 = document.createElement("span");
						button1.classList.add("svgicon", "svg-x");
						if (user.relationshipType === 3) {
							const buttonc = document.createElement("div");
							const button2 = document.createElement("span");
							button2.classList.add("svgicon", "svg-x");
							button2.classList.add("svg-addfriend");
							buttonc.append(button2);
							buttonc.classList.add("friendlyButton");
							buttonc.append(button2);
							buttons.append(buttonc);
							buttonc.onclick = (e) => {
								e.stopImmediatePropagation();
								user.changeRelationship(1);
								outerDiv.remove();
							};
						}
						buttonc.append(button1);
						buttonc.classList.add("friendlyButton");
						buttonc.onclick = (e) => {
							e.stopImmediatePropagation();
							user.changeRelationship(0);
							outerDiv.remove();
						};
						buttons.append(buttonc);
						const outerDiv = genuserstrip(user, buttons);
						container.append(outerDiv);
					}
				}
			};
			pending.onclick = genPending;
			channelTopic.append(pending);
		}
		{
			const blocked = document.createElement("button");
			blocked.textContent = I18n.friends.blocked();

			const genBlocked = () => {
				this.localuser.relationshipsUpdate = genBlocked;
				checkVoid();
				container.innerHTML = "";
				container.append(I18n.friends.blockedusers());
				for (const user of this.localuser.inrelation) {
					if (user.relationshipType === 2) {
						const buttonc = document.createElement("div");
						const button1 = document.createElement("span");
						button1.classList.add("svg-x", "svgicon");
						buttonc.append(button1);
						buttonc.classList.add("friendlyButton");
						buttonc.onclick = (e) => {
							user.changeRelationship(0);
							e.stopImmediatePropagation();
							outerDiv.remove();
						};
						const outerDiv = genuserstrip(user, buttonc);
						container.append(outerDiv);
					}
				}
			};
			blocked.onclick = genBlocked;
			channelTopic.append(blocked);
		}
		{
			const add = document.createElement("button");
			add.textContent = I18n.friends.addfriend();
			add.onclick = () => {
				this.localuser.relationshipsUpdate = () => {};
				container.innerHTML = "";
				const float = new Float("");
				const options = float.options;
				const form = options.addForm(
					"",
					(e: any) => {
						console.log(e);
						if (e.code === 404) {
							throw new FormError(text, I18n.friends.notfound());
						} else if (e.code === 400) {
							throw new FormError(text, e.message.split("Error: ")[1]);
						} else {
							const box = text.input.deref();
							if (!box) return;
							box.value = "";
							box.placeholder = I18n.friends.requestsent();
						}
					},
					{
						method: "POST",
						fetchURL: this.info.api + "/users/@me/relationships",
						headers: this.headers,
					},
				);
				const text = form.addTextInput(I18n.friends.addfriendpromt(), "username");
				form.addPreprocessor((obj: any) => {
					const [username, discriminator] = obj.username.split("#");
					obj.username = username;
					obj.discriminator = discriminator;
					if (!discriminator) {
						throw new FormError(text, I18n.friends.discnotfound());
					}
				});
				container.append(float.generateHTML());
			};
			channelTopic.append(add);
		}
	}
	get mentions() {
		let mentions = 0;
		for (const thing of this.localuser.inrelation) {
			if (thing.relationshipType === 3) {
				mentions += 1;
			}
		}
		return mentions;
	}
	giveMember(_member: memberjson) {
		throw new Error("not a real guild, can't give member object");
	}
	getRole() {
		return null;
	}
	hasRole() {
		return false;
	}
	isAdmin() {
		return false;
	}
	unreaddms() {
		for (const thing of this.channels) {
			(thing as Group).unreads();
		}
	}
}

const dmPermissions = new Permissions("0");
dmPermissions.setPermission("ADD_REACTIONS", 1);
dmPermissions.setPermission("VIEW_CHANNEL", 1);
dmPermissions.setPermission("SEND_MESSAGES", 1);
dmPermissions.setPermission("EMBED_LINKS", 1);
dmPermissions.setPermission("ATTACH_FILES", 1);
dmPermissions.setPermission("READ_MESSAGE_HISTORY", 1);
dmPermissions.setPermission("MENTION_EVERYONE", 1);
dmPermissions.setPermission("USE_EXTERNAL_EMOJIS", 1);
dmPermissions.setPermission("USE_APPLICATION_COMMANDS", 1);
dmPermissions.setPermission("USE_EXTERNAL_STICKERS", 1);
dmPermissions.setPermission("USE_EMBEDDED_ACTIVITIES", 1);
dmPermissions.setPermission("USE_SOUNDBOARD", 1);
dmPermissions.setPermission("USE_EXTERNAL_SOUNDS", 1);
dmPermissions.setPermission("SEND_VOICE_MESSAGES", 1);
dmPermissions.setPermission("SEND_POLLS", 1);
dmPermissions.setPermission("USE_EXTERNAL_APPS", 1);

dmPermissions.setPermission("CONNECT", 1);
dmPermissions.setPermission("SPEAK", 1);
dmPermissions.setPermission("STREAM", 1);
dmPermissions.setPermission("USE_VAD", 1);
class Group extends Channel {
	users: User[];
	owner_id?: string;
	static groupcontextmenu = new Contextmenu<Group, undefined>("channel menu");
	static groupMenu = this.makeGroupMenu();
	static makeGroupMenu() {
		const menu = new Contextmenu<Group, User>("group menu", true);
		menu.addButton(
			function (user) {
				return I18n.member.kick(user.name, this.name);
			},
			function (user) {
				fetch(this.info.api + `/channels/${this.id}/recipients/${user.id}`, {
					method: "DELETE",
					headers: this.headers,
				});
			},
			{
				group: "default",
				visible: function (user) {
					return this.localuser.user.id !== user.id && this.owner_id === this.localuser.user.id;
				},
				color: "red",
			},
		);
		return menu;
	}

	static setupcontextmenu() {
		this.groupcontextmenu.addButton(
			() => I18n.DMs.markRead(),
			function (this: Group) {
				this.readbottom();
			},
		);

		this.groupcontextmenu.addSeperator();

		this.groupcontextmenu.addButton(
			() => I18n.group.edit(),
			function () {
				this.edit();
			},
			{
				visible: function () {
					return this.type !== 1;
				},
			},
		);

		this.groupcontextmenu.addButton(
			() => I18n.DMs.close(),
			function (this: Group) {
				this.deleteChannel();
			},
			{
				color: "red",
			},
		);

		this.groupcontextmenu.addButton(
			() => I18n.DMs.add(),
			function (this: Group) {
				this.addPerson();
			},
		);

		this.groupcontextmenu.addSeperator();

		this.groupcontextmenu.addButton(
			() => I18n.user.copyId(),
			function () {
				navigator.clipboard.writeText(this.users[0].id);
			},
			{
				visible: function () {
					return this.type === 1;
				},
			},
		);

		this.groupcontextmenu.addButton(
			() => I18n.DMs.copyId(),
			function (this: Group) {
				navigator.clipboard.writeText(this.id);
			},
		);
	}

	async addPerson() {
		const d = new Dialog(I18n.DMs.add());
		const options = [...this.localuser.inrelation]
			.filter((user) => user.relationshipType === 1)
			.filter((user) => !this.users.includes(user));
		d.show();
		const users = await User.makeSelector(d.options, "Add person", options, {single: true});
		d.hide();
		if (!users) return;
		const [user] = [...users];
		if (!user) return;
		await fetch(this.info.api + "/channels/" + this.id + "/recipients/" + user.id, {
			headers: this.headers,
			method: "PUT",
		});
	}
	edit() {
		const dio = new Dialog(I18n.group.edit());
		const form = dio.options.addForm("", () => {}, {
			fetchURL: this.info.api + "/channels/" + this.id,
			headers: this.headers,
			method: "PATCH",
		});
		form.addTextInput(I18n.channel["name:"](), "name", {
			initText: this.name === this.defaultName() ? "" : this.name,
            maxLength: this.localuser.instanceLimits.channel?.maxName ?? 9999,
		});
		form.addImageInput(I18n.channel.icon(), "icon", {
			initImg: this.icon ? this.iconUrl() : undefined,
		});
		form.onSubmit = () => {
			dio.hide();
		};
		dio.show();
	}
	addRec(user: User) {
		this.users.push(user);
		this.users = [...new Set(this.users)];
		if (this.localuser.channelfocus === this) {
			this.localuser.memberListQue();
		}
	}
	removeRec(user: User) {
		this.users = this.users.filter((u) => u !== user);
		if (this.localuser.channelfocus === this) {
			this.localuser.memberListQue();
		}
	}
	updateChannel(json: channeljson): void {
		super.updateChannel(json);
		this.owner_id = json.owner_id;
		this.icon = json.icon;
		this.makeIcon();
	}
	defaultName() {
		return this.users.map((_) => _.name).join(", ");
	}
	constructor(json: dirrectjson, owner: Direct) {
		super(-1, owner, json.id);

		this.icon = json.icon;
		this.type = json.type;
		this.owner_id = json.owner_id;

		json.recipients = json.recipients.filter((_) => _.id !== this.localuser.user.id);
		const userSet = new Set(json.recipients.map((user) => new User(user, this.localuser)));
		if (userSet.size === 0) {
			userSet.add(this.localuser.user);
		}

		this.users = [...userSet];
		this.name = json.name || this.defaultName();

		userSet.add(this.localuser.user);

		this.name ??= this.localuser.user.username;
		this.parent_id!;
		this.parent!;
		this.children = [];
		this.guild_id = "@me";
		this.permission_overwrites = new Map();
		if (json.last_message_id) {
			this.setLastMessageId(json.last_message_id);
		} else {
			this.lastmessageid = undefined;
		}
		this.mentions = 0;

		this.setUpInfiniteScroller();
		this.updatePosition();
	}
	updatePosition(time?: number) {
		if (time) {
			this.position = time;
		} else if (this.lastmessage) {
			this.position = this.lastmessage.getTimeStamp();
		} else if (this.lastmessageid) {
			this.position = SnowFlake.stringToUnixTime(this.lastmessageid);
		} else {
			this.position = 0;
		}
		this.position = -Math.max(this.position, this.getUnixTime());

		const html = this.html?.deref();
		if (!html) return;
		const parent = html.parentElement;
		if (!parent) return;
		parent.prepend(html);
	}
	createguildHTML() {
		const div = document.createElement("div");
		Group.groupcontextmenu.bindContextmenu(div, this, undefined);
		this.html = new WeakRef(div);
		div.classList.add("flexltr", "liststyle");
		const myhtml = document.createElement("span");
		myhtml.classList.add("ellipsis");
		myhtml.textContent = this.type === 1 && this.users[0] ? this.users[0].name : this.name;
		this.nameSpan = new WeakRef(myhtml);

		div.appendChild(this.makeIcon());

		div.appendChild(myhtml);
		(div as any).myinfo = this;
		div.onclick = (_) => {
			this.getHTML();
			const toggle = document.getElementById("maintoggle") as HTMLInputElement;
			toggle.checked = true;
		};

		return div;
	}
	getname() {
		return this.name;
	}
	notititle(message: Message) {
		if (this.users.length === 1) {
			return message.author.username;
		} else {
			return this.getname() + " > " + message.author.username;
		}
	}
	readStateInfo(json: readyjson["d"]["read_state"]["entries"][0]): void {
		super.readStateInfo(json);
	}
	readbottom() {
		super.readbottom();
		this.unreads();
	}
	get hasunreads() {
		return this.mentions !== 0;
	}
	all: WeakRef<HTMLElement> = new WeakRef(document.createElement("div"));
	noti?: WeakRef<HTMLElement>;
	del() {
		const all = this.all.deref();
		if (all) {
			all.remove();
		}
		if (this.myhtml) {
			this.myhtml.remove();
		}
	}
	groupDmDiv = new WeakRef(document.createElement("div"));
	makeIcon(): HTMLElement {
		if (this.type === 1) {
			return this.users[0].buildstatuspfp(this);
		} else {
			const div = this.groupDmDiv.deref() || document.createElement("div");
			div.innerHTML = "";
			div.classList.add("groupDmDiv");
			if (this.icon) {
				const img = createImg(
					this.info.cdn +
						"/channel-icons/" +
						this.id +
						"/" +
						this.icon +
						".png" +
						new CDNParams({expectedSize: 32}),
				);
				img.classList.add("pfp");
				div.append(img);
			} else {
				for (const user of this.users.slice(0, 5)) {
					div.append(user.buildpfp(undefined));
				}
			}
			return div;
		}
	}
	unreads() {
		const sentdms = document.getElementById("sentdms") as HTMLDivElement; //Need to change sometime
		let current = this.all.deref();
		if (!current || !document.body.contains(current)) current = undefined;
		if (this.mentions) {
			{
				const noti = this.noti?.deref();
				if (noti) {
					noti.textContent = this.mentions + "";
					return;
				}
			}
			const div = document.createElement("div");
			div.classList.add("servernoti");
			const noti = document.createElement("div");
			noti.classList.add("unread", "notiunread", "pinged");
			noti.textContent = "" + this.mentions;
			this.noti = new WeakRef(noti);
			const buildpfp = this.makeIcon();
			this.all = new WeakRef(div);
			buildpfp.classList.add("mentioned");
			div.append(buildpfp, noti);
			sentdms.append(div);
			div.onclick = (_) => {
				this.guild.loadGuild();
				this.getHTML();
				const toggle = document.getElementById("maintoggle") as HTMLInputElement;
				toggle.checked = true;
			};
		} else if (current) {
			current.remove();
		} else {
		}
	}

	hasPermission(name: string): boolean {
		return dmPermissions.hasPermission(name);
	}
	async messageCreate(messagep: messageCreateJson): Promise<void> {
		await super.messageCreate(messagep);
		this.updatePosition();
		console.log(this);
	}
}
export {Direct, Group};

Group.setupcontextmenu();
