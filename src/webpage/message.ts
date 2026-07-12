import {Contextmenu} from "./contextmenu.js";
import {User} from "./user.js";
import {Member} from "./member.js";
import {MarkDown, saveCaretPosition} from "./markdown.js";
import {Embed} from "./embed.js";
import {Channel} from "./channel.js";
import {Localuser} from "./localuser.js";
import {File} from "./file.js";
import {SnowFlake} from "./snowflake.js";
import {
	channeljson,
	emojijson,
	interactionEvents,
	memberjson,
	messagejson,
	polljson,
	pollUpdateJson,
	userjson,
} from "./jsontypes.js";
import {Emoji} from "./emoji.js";
import {mobile} from "./utils/utils.js";
import {I18n} from "./i18n.js";
import {Hover} from "./hover.js";
import {Dialog} from "./settings.js";
import {Sticker} from "./sticker.js";
import {Components} from "./interactions/compontents.js";
import {ImagesDisplay} from "./disimg";
import {ReportMenu} from "./reporting/report.js";
import {getDeveloperSettings} from "./utils/storage/devSettings.js";
class Message extends SnowFlake {
	static contextmenu = new Contextmenu<Message, void>("message menu");
	stickers!: Sticker[];
	owner: Channel;
	headers: Localuser["headers"];
	embeds: Embed[] = [];
	author!: User;
	mentions = new Set<string>();
	mention_roles = new Set<string>();
	mention_everyone!: boolean;
	attachments: File[] = []; //probably should be its own class tbh, should be Attachments[]
	message_reference?: {
		guild_id: string;
		channel_id: string;
		message_id: string;
	};
	type!: number;
	private timestamp!: number | string;
	content!: MarkDown;
	static del: Promise<void>;
	static resolve: () => void;

	private weakDiv?: WeakRef<HTMLDivElement>;
	get div(): HTMLDivElement | undefined {
		return this.weakDiv?.deref();
	}
	set div(div: HTMLDivElement | undefined) {
		if (div === undefined) {
			this.weakDiv = undefined;
			return;
		}
		this.weakDiv = new WeakRef(div);
	}

	member?: Member;
	reactions: {
		count: number;
		emoji: emojijson;
		me: boolean;
	}[] = [];
	pinned: boolean = false;
	flags: number = 0;
	poll?: polljson;
	nonce: string = "";
	components?: Components;
	edited_timestamp: string | null = null;
	thread?: Channel;

	getTimeStamp() {
		return new Date(this.timestamp).getTime();
	}
	static setup() {
		this.del = new Promise((_) => {
			this.resolve = _;
		});
		Message.setupcmenu();
	}
	static setupcmenu() {
		const editTypes = new Set([0, 19]);
		Message.contextmenu.addButton(
			() => I18n.message.edit(),
			function (this: Message) {
				this.setEdit();
			},
			{
				visible: function () {
					return this.author.id === this.localuser.user.id && editTypes.has(this.type);
				},

				icon: {
					css: "svg-edit",
				},
			},
		);
		Message.contextmenu.addButton(
			() => I18n.reply(),
			function (this: Message) {
				this.channel.setReplying(this);
			},
			{
				icon: {
					css: "svg-reply",
				},
				visible: function () {
					return !this.ephemeral && this.channel.hasPermission("SEND_MESSAGES");
				},
			},
		);

		Message.contextmenu.addButton(
			() => I18n.message.reactionAdd(),
			function (this: Message, _, e: MouseEvent) {
				Emoji.emojiPicker(e.x, e.y, this.localuser).then((_) => {
					this.reactionToggle(_);
				});
			},
			{
				icon: {
					css: "svg-emoji",
				},
				visible: function () {
					return this.channel.hasPermission("ADD_REACTIONS");
				},
			},
		);

		Message.contextmenu.addButton(
			() => I18n.message.createThread(),
			function () {
				const dio = new Dialog(I18n.message.threadOptions());
				const opt = dio.options.addForm(
					"",
					(body) => {
						const channelJson = body as channeljson;
						this.guild.goToThread(channelJson.id);
						dio.hide();
					},
					{
						fetchURL:
							this.info.api + "/channels/" + this.channel.id + "/messages/" + this.id + "/threads",
						headers: this.headers,
					},
				);
				opt.addTextInput(I18n.threads.name(), "name");
				dio.show();
			},
			{
				visible: function () {
					return this.channel.hasPermission("CREATE_PUBLIC_THREADS");
				},
			},
		);
		Message.contextmenu.addButton(
			() => I18n.message.reactions(),
			function (this: Message) {
				this.viewReactions();
			},
			{
				visible: function () {
					return !!this.reactions.length;
				},
			},
		);

		Message.contextmenu.addSeperator();
		Message.contextmenu.addButton(
			() => I18n.copyrawtext(),
			function (this: Message) {
				navigator.clipboard.writeText(this.content.rawString);
			},
			{
				icon: {
					css: "svg-copy",
				},
			},
		);
		Message.contextmenu.addGroup("copyLink");
		Message.contextmenu.addButton(
			() => I18n.copyLink(),
			function (this: Message) {
				navigator.clipboard.writeText(
					`${window.location.origin}/channels/${this.guild.id}/${this.channel.id}/${this.id}`,
				);
			},
			{
				//TODO make icon
			},
		);
		Message.contextmenu.addButton(
			() => I18n.pinMessage(),
			async function (this: Message) {
				const f = await fetch(`${this.info.api}/channels/${this.channel.id}/pins/${this.id}`, {
					method: "PUT",
					headers: this.headers,
				});
				if (!f.ok) alert(I18n.unableToPin());
			},
			{
				icon: {
					css: "svg-pin",
				},
				visible: function () {
					if (this.pinned) return false;
					if (this.channel.guild.id === "@me") return true;
					return this.channel.hasPermission("MANAGE_MESSAGES");
				},
			},
		);

		Message.contextmenu.addButton(
			() => I18n.unpinMessage(),
			async function (this: Message) {
				const f = await fetch(`${this.info.api}/channels/${this.channel.id}/pins/${this.id}`, {
					method: "DELETE",
					headers: this.headers,
				});
				if (!f.ok) alert(I18n.unableToPin());
			},
			{
				icon: {
					css: "svg-pin",
				},
				visible: function () {
					if (!this.pinned) return false;
					if (this.channel.guild.id === "@me") return true;
					return this.channel.hasPermission("MANAGE_MESSAGES");
				},
			},
		);

		Message.contextmenu.addButton(
			() => I18n.copymessageid(),
			function (this: Message) {
				navigator.clipboard.writeText(this.id);
			},
		);

		Message.contextmenu.addSeperator();
		Message.contextmenu.addButton(
			() => I18n.message.delete(),
			function (this: Message) {
				this.confirmDelete();
			},
			{
				visible: function () {
					return this.canDelete();
				},
				icon: {
					css: "svg-delete",
				},
				color: "red",
			},
		);
		Message.contextmenu.addButton(
			() => I18n.message.endPoll(),
			function (this: Message) {
				this.confirmDeletePoll();
			},
			{
				visible: function () {
					return (
						this.author.id === this.localuser.user.id &&
						!!this.poll &&
						!this.poll.results?.is_finalized
					);
				},
				color: "red",
			},
		);
		Message.contextmenu.addButton(
			() => I18n.message.report(),
			async function () {
				const menu = await ReportMenu.makeReport("message", this.localuser, {message: this});
				menu?.spawnMenu();
			},
			{
				visible: function () {
					const settings = getDeveloperSettings();
					return this.author.id !== this.localuser.user.id && settings.reportSystem;
				},
				color: "red",
			},
		);

		Message.contextmenu.addSeperator();
		Message.contextmenu.addButton(
			() => I18n.usedFermi(),
			() => {},
			{
				visible: function () {
					return !!this.nonce && this.nonce.length <= 9 && this.nonce.length !== 0;
				},
				enabled: () => false,
			},
		);
	}
	viewReactions() {
		const dio = new Dialog(I18n.message.reactionsTitle());
		const div = document.createElement("div");
		div.classList.add("flexltr");
		const reactions = document.createElement("div");
		reactions.classList.add("flexttb", "reactionList");

		const list = document.createElement("div");
		list.classList.add("flexttb", "reactionUserList");
		let curSelect = document.createElement("div");
		reactions.append(
			...this.reactions.map((reaction) => {
				const button = document.createElement("div");

				console.log(reaction);
				const emoji = new Emoji(reaction.emoji, this.guild);
				button.append(emoji.getHTML(), `(${reaction.count})`);
				let users: User[] | undefined = undefined;
				button.onclick = async () => {
					curSelect.classList.remove("current");

					curSelect = button;
					curSelect.classList.add("current");
					if (!users) {
						const f = await fetch(
							`${this.info.api}/channels/${this.channel.id}/messages/${this.id}/reactions/${reaction.emoji.name}?limit=50&type=0`,
							{headers: this.headers},
						);
						users = ((await f.json()) as userjson[]).map((_) => new User(_, this.localuser));
					}
					list.innerHTML = "";
					list.append(
						...users.map((user) => {
							return user.createWidget(this.guild);
						}),
					);
				};

				return button;
			}),
		);
		//@ts-ignore
		[...reactions.children][0].click();
		div.append(reactions, list);
		dio.options.addHTMLArea(div);
		dio.show();
	}

	setEdit() {
		const prev = this.channel.editing;
		this.channel.editing = this;
		if (prev) prev.generateMessage();
		this.generateMessage(undefined, false);
	}
	constructor(messagejson: messagejson, owner: Channel, dontStore = false) {
		super(messagejson.id);
		this.owner = owner;
		this.headers = this.owner.headers;
		this.giveData(messagejson);
		if (!dontStore) {
			this.owner.messages.set(this.id, this);
			if (messagejson.referenced_message)
				this.localuser.giveMessage(messagejson.referenced_message);
		}
	}
	reactionToggle(emoji: string | Emoji) {
		if (emoji instanceof Emoji && !emoji.id && emoji.emoji) {
			emoji = emoji.emoji;
		}
		let remove = !!this.reactions.find((_) =>
			typeof emoji === "string" ? _.emoji.name === emoji : _.emoji.name === emoji.name,
		)?.me;

		let reactiontxt: string;
		if (emoji instanceof Emoji) {
			if (emoji.id) {
				reactiontxt = `${emoji.name}:${emoji.id}`;
			} else {
				reactiontxt = encodeURIComponent(emoji.name);
			}
		} else {
			reactiontxt = encodeURIComponent(emoji);
		}
		if (!remove) {
			this.localuser.favorites.addReactEmoji(
				emoji instanceof Emoji ? emoji.id || (emoji.emoji as string) : emoji,
			);
		}
		fetch(
			`${this.info.api}/channels/${this.channel.id}/messages/${this.id}/reactions/${reactiontxt}/@me`,
			{
				method: remove ? "DELETE" : "PUT",
				headers: this.headers,
			},
		);
	}

	giveData(messagejson: messagejson) {
		const func = this.channel.infinite.snapBottom();
		for (const thing of Object.keys(messagejson)) {
			if (thing === "attachments") {
				this.attachments = [];
				for (const thing of messagejson.attachments) {
					this.attachments.push(new File(thing, this));
				}
				continue;
			} else if (thing === "content") {
				this.content = new MarkDown(messagejson[thing] || "", this.channel);
				continue;
			} else if (thing === "id") {
				continue;
			} else if (thing === "member") {
				Member.new(messagejson.member as memberjson, this.guild).then((_) => {
					this.member = _;
				});
				continue;
			} else if (thing === "embeds") {
				this.embeds = [];
				for (const thing in messagejson.embeds) {
					this.embeds[thing] = new Embed(messagejson.embeds[thing], this);
				}
				continue;
			} else if (thing === "author" || thing === "mentions") {
				continue;
			} else if (thing === "sticker_items") {
				this.stickers = (messagejson.sticker_items || []).map((_) => {
					const guild = this.localuser.guilds.get(_.guild_id as string);
					return new Sticker(_, guild || this.localuser);
				});
			} else if (thing === "components" && messagejson.components) {
				this.components = new Components(messagejson.components, this);
				continue;
			} else if (thing === "thread" && messagejson.thread) {
				let thread = this.localuser.channels.get(messagejson.thread.id);
				if (!thread) {
					thread = new Channel(messagejson.thread, this.guild);
					thread.resolveparent();
					this.localuser.channels.set(thread.id, thread);
				}
				this.thread = thread;
				continue;
			} else if (thing === "mention_roles") continue;
			(this as any)[thing] = (messagejson as any)[thing];
		}
		this.stickers ||= [];
		if (messagejson.reactions?.length) {
			console.log(messagejson.reactions, ":3");
		}
		if (messagejson.webhook) {
			messagejson.author.webhook = messagejson.webhook;
		}
		if (messagejson.author.id) {
			this.author = new User(messagejson.author, this.localuser, false);
		}
		this.mentions.clear();
		if (messagejson.mentions)
			messagejson.mentions.forEach((_) => {
				new User(_, this.localuser);
				this.mentions.add(_.id);
			});
		this.mention_roles.clear();
		if (messagejson.mention_roles)
			messagejson.mention_roles.forEach((id) => this.mention_roles.add(id));

		if (!this.member && this.guild.id !== "@me") {
			this.author.resolvemember(this.guild).then((_) => {
				this.member = _;
			});
		}
		if (this.div) {
			this.generateMessage();
			return;
		}
		if (+this.id > +(this.channel.lastmessageid || "0")) {
			func();
		}
	}
	canDelete() {
		return this.channel.hasPermission("MANAGE_MESSAGES") || this.author === this.localuser.user;
	}
	get channel() {
		return this.owner;
	}
	get guild() {
		return this.owner.guild;
	}
	get localuser() {
		return this.owner.localuser;
	}
	get info() {
		return this.owner.info;
	}
	interactionDiv?: HTMLDivElement;
	interactionEvents(event: interactionEvents) {
		if (!this.interactionDiv) return;
		this.interactionDiv.classList.remove("failed");
		switch (event.t) {
			case "INTERACTION_CREATE":
				this.interactionDiv.textContent = I18n.interactions.started();
				break;
			case "INTERACTION_SUCCESS":
				this.interactionDiv.textContent = I18n.interactions.worked();
				setTimeout(() => {
					if (this.interactionDiv?.textContent === I18n.interactions.worked()) {
						this.interactionDiv.textContent = "";
					}
				}, 1000);
				break;
			case "INTERACTION_FAILURE":
				this.interactionDiv.textContent = I18n.interactions.failed();
				this.interactionDiv.classList.add("failed");
				setTimeout(() => {
					if (this.interactionDiv?.textContent === I18n.interactions.failed()) {
						this.interactionDiv.textContent = "";
					}
				}, 5000);
				break;
		}
	}
	messageevents(obj: HTMLDivElement) {
		let drag = false;
		Message.contextmenu.bindContextmenu(
			obj,
			this,
			undefined,
			(x) => {
				//console.log(x);
				if (x < -20) {
					obj.style.translate = x + 20 + "px 0px";
				} else obj.style.translate = 0 + "px";

				if (!drag && x < 20) {
					return;
				}

				drag = true;
				this.channel.moveForDrag(Math.max(x, 0));
			},
			(x, y) => {
				drag = false;
				console.log(x, y);
				obj.style.translate = 0 + "px";
				this.channel.moveForDrag(-1);
				if (x > 60) {
					console.log("In here?");
					const toggle = document.getElementById("maintoggle") as HTMLInputElement;
					toggle.checked = false;
					console.log(toggle);
				}
				if (x < -40) {
					this.channel.setReplying(this);
				}
			},
		);
		this.div = obj;
		obj.classList.add("messagediv");
	}
	deleteDiv() {
		if (!this.div) return;
		try {
			this.div.remove();
			this.div = undefined;
		} catch (e) {
			console.error(e);
		}
	}

	mentionsuser(userd: User | Member) {
		if (this.mention_everyone) return true;
		if (userd instanceof User) {
			return !!this.mentions.has(userd.id);
		} else if (userd instanceof Member) {
			if (!!this.mentions.has(userd.id)) {
				return true;
			} else {
				return !this.mention_roles.isDisjointFrom(userd.roleIds); //if the message mentions a role the user has
			}
		} else {
			return false;
		}
	}
	getimages() {
		const build: File[] = [];
		for (const thing of this.attachments) {
			if (thing.content_type.startsWith("image/")) {
				build.push(thing);
			}
		}
		return build;
	}
	getUnixTime(): number {
		return new Date(this.timestamp).getTime();
	}
	async edit(content: string) {
		if (content === this.content.textContent) {
			return;
		}
		return await fetch(this.info.api + "/channels/" + this.channel.id + "/messages/" + this.id, {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify({content}),
		});
	}
	async delete() {
		await fetch(`${this.info.api}/channels/${this.channel.id}/messages/${this.id}`, {
			headers: this.headers,
			method: "DELETE",
		});
	}
	deleteEvent() {
		if (!this.channel.messages.has(this.id)) return;
		if (!this.id.includes("fake") && this.channel.messageCount !== undefined)
			this.channel.messageCount--;
		console.log("deleted");
		this.channel.infinite.deleteId(this.id);
		if (this.div) {
			this.div.remove();
			this.div.innerHTML = "";
			this.div = undefined;
		}
		const prev = this.channel.idToPrev.get(this.id);
		const next = this.channel.idToNext.get(this.id);

		this.channel.messages.delete(this.id);
		if (this.channel.idToPrev.has(this.id) && this.channel.idToNext.has(this.id)) {
			if (next) this.channel.idToPrev.set(next, prev);
			if (prev) this.channel.idToNext.set(prev, next);
		} else if (prev) {
			this.channel.idToNext.delete(prev);
		} else if (next) {
			this.channel.idToPrev.delete(next);
		}
		if (prev) {
			const prevMessage = this.channel.messages.get(prev);
			if (prevMessage) {
				prevMessage.generateMessage();
			}
		}
		if (next) {
			const nextMessage = this.channel.messages.get(next);
			if (nextMessage) {
				nextMessage.generateMessage();
			}
		}
		if (this.channel.lastmessage === this || this.channel.lastmessageid === this.id) {
			if (prev) {
				this.channel.lastmessage = this.channel.messages.get(prev);
				this.channel.lastmessageid = prev;
			} else {
				this.channel.lastmessage = undefined;
				this.channel.lastmessageid = undefined;
			}
		}
		if (this.channel.lastreadmessageid === this.id) {
			if (prev) {
				this.channel.lastreadmessageid = prev;
			} else {
				this.channel.lastreadmessageid = undefined;
			}
		}
		console.log("deleted done");
	}
	pollUpdate(update: pollUpdateJson) {
		if (!this.poll) return;
		if (!this.poll.results) this.poll.results = {is_finalized: false, answer_counts: []};
		let ans = this.poll.results.answer_counts.find((_) => _.id === update.d.answer_id);
		if (!ans) {
			ans = {id: update.d.answer_id, count: 0, me_voted: false};
			this.poll.results.answer_counts.push(ans);
		}
		if (update.t === "MESSAGE_POLL_VOTE_ADD") {
			ans.count++;
			if (update.d.user_id === this.localuser.user.id) ans.me_voted = true;
		} else {
			ans.count--;
			if (update.d.user_id === this.localuser.user.id) ans.me_voted = false;
		}
	}
	reactdiv!: WeakRef<HTMLDivElement>;
	blockedPropigate() {
		const previd = this.channel.idToPrev.get(this.id);
		if (!previd) {
			this.generateMessage();
			return;
		}
		const premessage = this.channel.messages.get(previd);
		if (premessage?.author === this.author) {
			premessage.blockedPropigate();
		} else {
			this.generateMessage();
		}
	}
	interaction: messagejson["interaction"];
	get ephemeral() {
		return !!(this.flags & (1 << 6));
	}
	generateMessage(
		premessage?: Message | undefined,
		ignoredblock = false,
		dupe: false | HTMLDivElement = false,
	) {
		const div = dupe || this.div;
		if (!div) return;
		if (div === this.div) {
			this.div.classList.add("messagediv");
		}
		if (this.type === 21) {
			this.channel.parent?.getmessage(this.message_reference?.message_id as string).then((_) => {
				const gen = _?.generateMessage(undefined, undefined, div);
				if (!gen) {
					//idk
				}
			});
			return div;
		}

		const editmode = this.channel.editing === this;
		if (!premessage && !dupe) {
			premessage = this.channel.messages.get(this.channel.idToPrev.get(this.id) as string);
		}
		if (
			this.mentionsuser(this.guild.member) ||
			this.ephemeral ||
			this.interaction?.user.id === this.localuser.user.id
		) {
			div.classList.add("mentioned");
		}
		div.style.setProperty(
			"--time-text",
			JSON.stringify(
				new Date(this.getUnixTime()).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}),
			),
		);

		if (this === this.channel.replyingto) {
			div.classList.add("replying");
		}
		div.innerHTML = "";
		const build = document.createElement("div");

		build.classList.add("flexltr", "message");

		if (this.interaction) {
			const replyline = document.createElement("div");

			const minipfp = document.createElement("img");
			minipfp.classList.add("replypfp");
			replyline.appendChild(minipfp);

			const username = document.createElement("span");
			username.classList.add("username");
			replyline.appendChild(username);

			const reply = document.createElement("div");
			reply.classList.add("replytext", "ellipsis");
			reply.textContent = I18n.interactions.replyline();
			replyline.appendChild(reply);

			const user = new User(this.interaction.user, this.localuser);

			minipfp.src = user.getpfpsrc();
			Member.resolveMember(user, this.guild).then((member) => {
				if (member) {
					minipfp.src = member.getpfpsrc();
					username.textContent = member.name;
					member.subName(username);
				} else {
					user.subName(username);
				}
			});
			user.bind(minipfp, this.guild);
			username.textContent = user.name;
			user.bind(username, this.guild);

			replyline.classList.add("flexltr", "replyflex");

			div.appendChild(replyline);
		}

		div.classList.remove("zeroheight");
		if (this.author.relationshipType === 2) {
			if (ignoredblock) {
				if (premessage?.author !== this.author) {
					const span = document.createElement("span");
					span.textContent = I18n.hideBlockedMessages();
					div.append(span);
					span.classList.add("blocked");
					span.onclick = (_) => {
						let next: Message | undefined = this;
						while (next?.author === this.author) {
							next.generateMessage();
							next = this.channel.messages.get(this.channel.idToNext.get(next.id) as string);
						}
					};
				}
			} else {
				div.classList.remove("topMessage");
				if (premessage?.author === this.author) {
					div.classList.add("zeroheight");
					premessage.blockedPropigate();
					div.appendChild(build);
					return div;
				} else {
					build.classList.add("blocked", "topMessage");
					const span = document.createElement("span");
					let count = 1;
					let next = this.channel.messages.get(this.channel.idToNext.get(this.id) as string);
					while (next?.author === this.author) {
						count++;
						next = this.channel.messages.get(this.channel.idToNext.get(next.id) as string);
					}
					span.textContent = I18n.showBlockedMessages(count + "");
					build.append(span);
					span.onclick = (_) => {
						const func = this.channel.infinite.snapBottom();
						let next: Message | undefined = this;
						while (next?.author === this.author) {
							next.generateMessage(undefined, true);
							next = this.channel.messages.get(this.channel.idToNext.get(next.id) as string);
							console.log("loopy");
						}
						func();
					};
					div.appendChild(build);
					return div;
				}
			}
		}

		if (this.message_reference && this.type !== 6 && this.type !== 18 && this.type !== 46) {
			const replyline = document.createElement("div");

			const minipfp = document.createElement("img");
			minipfp.classList.add("replypfp");
			replyline.appendChild(minipfp);

			const username = document.createElement("span");
			replyline.appendChild(username);

			const reply = document.createElement("div");
			username.classList.add("username");
			reply.classList.add("replytext", "ellipsis");
			replyline.appendChild(reply);

			replyline.classList.add("flexltr", "replyflex");
			// TODO: Fix this
			this.channel.getmessage(this.message_reference.message_id).then((message) => {
				if (!message) {
					minipfp.remove();
					username.textContent = I18n.message.deleted();
					username.classList.remove("username");
					return;
				}
				if (message.author.relationshipType === 2) {
					username.textContent = "Blocked user";
					return;
				}
				if (message.attachments?.length || message.embeds?.length || message.stickers.length) {
					const b = document.createElement("b");
					b.innerText = I18n.message.attached();
					b.style.paddingRight = "4px";
					reply.append(b);
				}
				const author = message.author;
				reply.appendChild(message.content.makeHTML({stdsize: true}));
				minipfp.src = author.getpfpsrc();

				author.bind(minipfp, this.guild);
				username.textContent = author.name;
				author.bind(username, this.guild);
				Member.resolveMember(author, this.guild).then((member) => {
					if (member) {
						username.textContent = member.name;
						minipfp.src = member.getpfpsrc();
						member.subName(username);
					} else {
						author.subName(username);
					}
				});
			});
			reply.onclick = (_) => {
				if (!this.message_reference) return;
				// TODO: FIX this
				this.channel.focus(this.message_reference.message_id);
			};
			div.appendChild(replyline);
		}
		div.appendChild(build);
		const text = document.createElement("div");
		text.classList.add("commentrow", "flexttb");

		const messageTypes = new Set([0, 19, 20]);
		if (messageTypes.has(this.type) || this.attachments.length !== 0) {
			const pfpRow = document.createElement("div");
			let current = true;
			if (premessage !== undefined) {
				const old = new Date(premessage.timestamp).getTime() / 1000;
				const newt = new Date(this.timestamp).getTime() / 1000;
				current = newt - old > 600;
			}
			const combine =
				premessage?.author != this.author ||
				current ||
				this.message_reference ||
				!messageTypes.has(premessage.type) ||
				this.interaction;
			if (combine) {
				const pfp = this.author.buildpfp(this.guild, div);
				this.author.bind(pfp, this.guild, false);
				pfpRow.appendChild(pfp);
			}
			pfpRow.classList.add("pfprow");
			build.appendChild(pfpRow);

			if (combine) {
				const username = document.createElement("span");
				username.classList.add("username", "ellipsis");
				this.author.bind(username, this.guild);
				const membProm = Member.resolveMember(this.author, this.guild);
				membProm.then((member) => {
					if (member) {
						username.textContent = member.name;
						member.subName(username);
						const icon = member.getRoleIcon();
						if (icon) username.after(icon);
					} else {
						this.author.subName(username);
					}
				});
				div.classList.add("topMessage");
				username.textContent = this.author.name;
				const userwrap = document.createElement("div");
				userwrap.classList.add("userwrap");
				userwrap.appendChild(username);
				if (this.author.bot) {
					const username = document.createElement("span");
					username.classList.add("bot");
					username.textContent = this.author.webhook ? I18n.webhook() : I18n.bot();
					userwrap.appendChild(username);
				}
				const time = document.createElement("span");
				time.textContent = "  " + formatTime(new Date(this.timestamp));
				time.classList.add("timestamp");
				userwrap.appendChild(time);
				const hover = new Hover(new Date(this.timestamp).toString());
				hover.addEvent(time);
				if (this.edited_timestamp) {
					const edit = document.createElement("span");
					edit.classList.add("timestamp");
					edit.textContent = I18n.message.edited();
					const hover = new Hover(new Date(this.edited_timestamp).toString());
					hover.addEvent(edit);
					userwrap.append(edit);
				}
				membProm.then((memb) => {
					if (memb) {
						if (memb.commuicationDisabledLeft()) {
							const icon = document.createElement("span");
							icon.classList.add("svg-timeout");
							username.after(icon);
							const date = memb.communication_disabled_until as Date;
							new Hover(I18n.channel.timedOutUntil(date.toLocaleString())).addEvent(icon);
						}
					}
				});
				text.appendChild(userwrap);
			} else {
				div.classList.remove("topMessage");
			}
			const messagedwrap = document.createElement("div");
			if (editmode) {
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
				const md = new MarkDown(this.content.rawString, this.owner, {keep: true});
				area.append(md.makeHTML());
				area.addEventListener("keyup", (event) => {
					if (this.localuser.keyup(event)) return;
					if (event.key === "Enter" && !event.shiftKey) {
						this.edit(md.rawString);
						this.channel.editing = null;
						this.generateMessage();
					}
				});
				area.addEventListener("keydown", (event) => {
					this.localuser.keydown(event);
					if (event.key === "Enter" && !event.shiftKey) event.preventDefault();
					if (event.key === "Escape") {
						this.channel.editing = null;
						this.generateMessage();
					}
				});
				md.giveBox(area, (str, pre) => {
					this.localuser.search(search, md, str, pre);
				});
				sb.append(search);
				box.append(sb, area);
				messagedwrap.append(box);
				setTimeout(() => {
					area.focus();
					const fun = saveCaretPosition(area, Infinity);
					if (fun) fun();
				});
				box.oncontextmenu = (e) => {
					e.stopImmediatePropagation();
				};
			} else {
				this.content.onUpdate = () => {};
				const messaged = this.content.makeHTML();
				if (!this.embeds.find((_) => _.json.url === messaged.textContent)) {
					messagedwrap.classList.add("flexttb");
					messagedwrap.appendChild(messaged);
					if (!combine && this.edited_timestamp) {
						const edit = document.createElement("span");
						edit.classList.add("timestamp");
						edit.textContent = I18n.message.edited();
						const hover = new Hover(new Date(this.edited_timestamp).toString());
						hover.addEvent(edit);
						messaged.append(edit);
					}
				}
			}
			text.appendChild(messagedwrap);

			if (this.attachments.length) {
				const attach = document.createElement("div");
				attach.classList.add("flexltr", "attachments");
				for (const thing of this.attachments) {
					attach.appendChild(thing.getHTML());
				}
				messagedwrap.appendChild(attach);
			}
			if (this.embeds.length) {
				const embeds = document.createElement("div");
				for (const thing of this.embeds) {
					embeds.appendChild(thing.generateHTML());
				}
				messagedwrap.appendChild(embeds);
			}
			//
		} else if (this.type === 7) {
			const messages = I18n.welcomeMessages("|||").split("\n");
			const message = messages[Number(BigInt(this.id) % BigInt(messages.length))];
			const [first, second] = message.split("|||");
			const welcome = document.createElement("div");
			text.appendChild(welcome);

			const firstspan = document.createElement("span");
			firstspan.textContent = first;
			welcome.appendChild(firstspan);

			// TODO: settings how?
			if (false) {
				const img = document.createElement("img");
				img.classList.add("avatar");
				img.style.height = "1em";
				img.style.width = "1em";
				img.style.objectFit = "cover";
				img.src = this.author.getpfpsrc(this.guild) + "?size=1";
				img.loading = "lazy";
				img.decoding = "async";
				img.addEventListener(
					"load",
					() => {
						img.src = this.author.getpfpsrc(this.guild) + "?size=" + firstspan.clientHeight;
					},
					{once: true},
				);
				img.onclick = () => {
					const full = new ImagesDisplay([
						new File(
							{
								content_type: "image/webp",
								filename: "0",
								id: "0",
								size: 0,
								url: this.author.getpfpsrc(this.guild),
							},
							this,
						),
					]);
					full.show();
				};

				welcome.appendChild(img);
			}

			const username = document.createElement("span");
			username.textContent = this.author.name;
			//this.author.profileclick(username);
			this.author.bind(username, this.guild);
			welcome.appendChild(username);
			username.classList.add("username");

			const secondspan = document.createElement("span");
			secondspan.textContent = second;
			welcome.appendChild(secondspan);

			const time = document.createElement("span");
			time.textContent = "  " + formatTime(new Date(this.timestamp));
			time.classList.add("timestamp");
			welcome.append(time);
			div.classList.add("topMessage");
		} else if (this.type === 6) {
			const pinText = document.createElement("div");
			text.appendChild(pinText);

			const m = I18n.message.pin("||").split("||");
			if (m.length === 2) pinText.append(m.shift() as string);

			const username = document.createElement("span");
			username.textContent = this.author.name;
			//this.author.profileclick(username);
			this.author.bind(username, this.guild);
			pinText.appendChild(username);
			username.classList.add("username");

			const afterText = document.createElement("span");
			afterText.textContent = m[0];
			afterText.onclick = (_) => {
				if (!this.message_reference) return;
				this.channel.infinite.focus(this.message_reference.message_id);
			};
			afterText.classList.add("pinText");
			pinText.append(afterText);

			const time = document.createElement("span");
			time.textContent = "  " + formatTime(new Date(this.timestamp));
			time.classList.add("timestamp");
			pinText.append(time);
			div.classList.add("topMessage");
		} else if (this.type === 18) {
			const text = document.createElement("div");
			build.appendChild(text);

			const m = I18n.message.thread("|||", "???").split("|||");
			if (m.length === 2) text.append(m.shift() as string);

			const username = document.createElement("span");
			username.textContent = this.author.name;
			//this.author.profileclick(username);
			this.author.bind(username, this.guild);
			text.appendChild(username);
			username.classList.add("username");
			const midText = m[0].split("???");

			const afterText = document.createElement("span");
			afterText.textContent = midText[0];
			text.append(afterText);

			const threadName = document.createElement("span");
			threadName.textContent = this.content.rawString;
			threadName.classList.add("pinText");
			text.append(threadName);
			threadName.onclick = () => {
				this.guild.goToThread(this.message_reference?.channel_id as string);
			};

			const time = document.createElement("span");
			time.textContent = "  " + formatTime(new Date(this.timestamp));
			time.classList.add("timestamp");
			text.append(time);
			div.classList.add("topMessage");
		} else if (this.type === 46) {
			build.classList.remove("flexltr");
			build.classList.add("flexttb");
			const t = I18n.message.pollRes("$$$$", "||||");
			const content = document.createElement("div");
			content.classList.add("flexltr", "pollRes");
			const username = document.createElement("span");
			this.author.bind(username, this.guild);
			username.classList.add("username");
			const [before, after] = t.split("$$$$");
			username.textContent = this.author.name;
			const [b1, a1] = before.split("||||") as [string, undefined | string];
			const [b2, a2] = after.split("||||") as [string, undefined | string];
			const b1s = document.createElement("span");
			b1s.textContent = b1;
			content.append(b1s);
			const poll = document.createElement("span");
			poll.classList.add("pollText", "username");
			poll.onclick = () => {
				this.channel.focus(this.message_reference?.message_id!, true);
			};
			this.channel.getmessage(this.message_reference?.message_id!).then((_) => {
				if (!_) return;
				poll.textContent = _!.poll!.question!.text;
			});

			if (a1) {
				content.append(poll);
				const a1s = document.createElement("span");
				a1s.textContent = a1;
				content.append(a1s);
			}
			content.append(username);
			const b2s = document.createElement("span");
			b2s.textContent = b2;
			content.append(b2s);
			if (a2) {
				content.append(poll);
				const a2s = document.createElement("span");
				a2s.textContent = a2;
				content.append(a2s);
			}
			build.append(content);

			const resBody = document.createElement("div");
			resBody.classList.add("embed", "flexltr", "pollresembed");
			const res = document.createElement("div");
			res.classList.add("flexttb");
			const m = new Map((this.embeds[0].json.fields ?? []).map((f) => [f.name, f.value] as const));
			if (m.has("victor_answer_text")) {
				const ans = document.createElement("span");
				ans.textContent = m.get("victor_answer_text") + "";
				const winning = document.createElement("span");
				const per = Number(m.get("victor_answer_votes")) / Number(m.get("total_votes"));
				winning.textContent = I18n.poll.winningAnswer(Math.round(per * 100) + "");
				res.append(ans, winning);
			} else {
				res.textContent = I18n.poll.tie();
			}
			const view = document.createElement("button");
			view.textContent = I18n.poll.view();
			view.onclick = () => {
				this.channel.focus(this.message_reference?.message_id!, true);
			};
			resBody.append(res, view);

			build.append(resBody);

			this.bindButtonEvent();
			return div;
		}
		build.appendChild(text);
		const stickerArea = document.createElement("div");
		stickerArea.classList.add("flexltr", "stickerMArea");
		for (const sticker of this.stickers) {
			stickerArea.append(sticker.getHTML());
		}
		div.append(stickerArea);

		if (this.poll) {
			const pollbody = document.createElement("div");
			pollbody.classList.add("flexttb", "pollBody");
			let voted = false;
			const genPoll = () => {
				if (!this.poll) return;
				pollbody.textContent = "";
				const d = new Date(this.poll.expiry);
				const expired = +d < Date.now() || this.poll.results?.is_finalized || false;
				const nupdate = () => {
					fetch(`${this.info.api}/channels/${this.channel.id}/polls/${this.id}/answers/@me`, {
						method: "PUT",
						headers: this.headers,
						body: JSON.stringify({
							answer_ids: [...r.values()]
								.filter((_) => _.me_voted)
								.map(({id}) => id)
								.filter((_) => _),
						}),
					});
					voted = !!r.values.length;
				};
				if (!this.poll.results) this.poll.results = {is_finalized: false, answer_counts: []};
				const r = new Map((this.poll.results?.answer_counts ?? []).map((_) => [_.id, _] as const));
				const question = document.createElement("h3");
				question.textContent = this.poll.question.text;
				pollbody.append(question);
				let ccount = [...r.values()].reduce((e, l) => e + +l.me_voted, 0);
				if (this.poll.allow_multiselect) voted = !!ccount;
				for (const a of this.poll.answers) {
					const aarea = document.createElement("div");
					aarea.classList.add("flexltr", "answerArea");
					const span = document.createElement("span");
					span.textContent = a.poll_media.text;
					const check = document.createElement("input");
					check.type = "checkbox";
					check.disabled = expired;
					check.checked = !!r.get(a.answer_id ?? -1)?.me_voted;

					aarea.append(span, check);
					if (!expired)
						check.onclick = (e) => {
							e.stopImmediatePropagation();
							if (ccount && check.checked && !this.poll?.allow_multiselect) {
								check.checked = false;
								return;
							} else ccount += check.checked ? 1 : -1;
							if (this.poll?.allow_multiselect && ccount) voted = true;
							let g = r.get(a.answer_id ?? -1);
							if (!g) {
								g = {count: 0, id: a.answer_id ?? -1, me_voted: false};
								this.poll?.results?.answer_counts.push(g);
								r.set(a.answer_id ?? -1, g);
							}
							g.me_voted = check.checked;
							if (this.poll?.allow_multiselect) nupdate();
						};
					if (voted || expired) {
						const total = [...r.values()].reduce((e, l) => e + l.count, 0);
						const count = document.createElement("span");
						count.classList.add("countpollspan");
						let c = r.get(a.answer_id ?? -1)?.count ?? 0;
						if (isNaN(c)) c = 0;
						let per = Math.round((c / total) * 100);
						if (isNaN(per)) per = 0;
						count.textContent = I18n.poll.count("" + c, per + "");
						aarea.append(count);
						if (per)
							aarea.style.background = `linear-gradient(to right, var(--green) ${per}%, var(--bg) ${100 - per}%)`;
					}
					aarea.onclick = () => check.click();
					pollbody.append(aarea);
				}

				if (!this.poll.allow_multiselect) {
					const submit = document.createElement("button");
					submit.textContent = I18n.submit();
					pollbody.append(submit);
					if (expired) {
						submit.disabled = true;
					} else {
						submit.onclick = () => {
							nupdate();
						};
					}
				}

				if (expired) {
				} else {
					const expiresAt = document.createElement("span");
					const updatePollTime = async () => {
						if (document.contains(expiresAt))
							expiresAt.textContent = I18n.poll.expires(MarkDown.relTime(d, updatePollTime));
					};
					expiresAt.textContent = I18n.poll.expires(MarkDown.relTime(d));
					queueMicrotask(() => MarkDown.relTime(d, updatePollTime));
					pollbody.append(expiresAt);
				}
			};
			genPoll();
			this.localuser.subToPollUpdate(this.id, () => {
				if (document.contains(div)) {
					genPoll();
				} else {
					this.localuser.subToPollUpdate(this.id, null);
				}
			});

			div.append(pollbody);
		}

		if (!dupe) {
			if (this.components && this.components.components.length) {
				const cdiv = this.components.getHTML();
				cdiv.classList.add("messageComps");
				text.append(cdiv);

				const ndiv = document.createElement("div");
				ndiv.classList.add("compAppStatus");
				this.interactionDiv = ndiv;
				text.append(ndiv);
			}
			const reactions = document.createElement("div");
			reactions.classList.add("flexltr", "reactiondiv");
			this.reactdiv = new WeakRef(reactions);
			this.updateReactions();
			div.append(reactions);
		}
		if (this.ephemeral) {
			const ephemeral = document.createElement("div");
			ephemeral.classList.add("flexltr", "ephemeralDiv");
			const span = document.createElement("span");
			span.textContent = I18n.interactions.onlyYou();

			const a = document.createElement("a");
			a.onclick = () => {
				this.deleteEvent();
			};
			a.textContent = I18n.interactions.ephemeralDismiss();
			ephemeral.append(span, a);
			div.append(ephemeral);
		}
		const unreadLine = premessage && premessage.id === this.channel.lastreadmessageid;
		let datelineNeeded = false;
		if ((premessage || unreadLine) && !dupe) {
			const thisTime = new Date(this.getUnixTime());
			if (premessage && !unreadLine) {
				const prevTime = new Date(premessage.getUnixTime());
				datelineNeeded =
					thisTime.getDay() !== prevTime.getDay() ||
					thisTime.getMonth() !== prevTime.getMonth() ||
					thisTime.getFullYear() !== prevTime.getFullYear();
			} else {
				datelineNeeded = true;
			}
			if (datelineNeeded) {
				const dateline = document.createElement("div");
				if (unreadLine) {
					dateline.classList.add("unreadDateline");
				}
				dateline.classList.add("flexltr", "dateline");
				dateline.append(document.createElement("hr"));
				const span = document.createElement("span");
				span.innerText = Intl.DateTimeFormat(I18n.lang, {
					year: "numeric",
					month: "long",
					day: "2-digit",
				}).format(thisTime);
				dateline.append(span);
				dateline.append(document.createElement("hr"));
				const messageDiv = document.createElement("div");
				messageDiv.append(...Array.from(div.children));
				messageDiv.classList = div.classList + "";
				div.classList = "";
				div.append(dateline, messageDiv);
			}
		}
		this.bindButtonEvent();

		if (!dupe && this.thread) {
			const thread = this.thread;
			const threadBox = document.createElement("div");
			threadBox.classList.add("flexttb", "threadBox");
			const topRow = document.createElement("div");
			topRow.classList.add("flexltr");
			const title = document.createElement("span");
			title.textContent = thread.name;
			topRow.onclick = () => {
				this.localuser.goToChannel(thread.id);
			};
			const messages = document.createElement("span");
			messages.classList.add("clickable");
			messages.textContent = I18n.message.messages(thread.messageCount + "");
			console.log(thread);
			topRow.append(title, messages);
			threadBox.append(topRow);
			div.append(threadBox);
		}

		return div;
	}
	bindButtonEvent() {
		if (!this.div) return;
		const div = this.div.classList.contains("messagediv")
			? this.div
			: (this.div.getElementsByClassName("messagediv")[0] as HTMLDivElement);
		if (!div) return;
		let buttons: HTMLDivElement | undefined;
		div.onmouseenter = (_) => {
			if (mobile) return;
			if (buttons) {
				buttons.remove();
				buttons = undefined;
			}
			if (div) {
				buttons = document.createElement("div");
				buttons.classList.add("messageButtons", "flexltr");
				let addedRec = false;
				if (this.channel.hasPermission("ADD_REACTIONS")) {
					const favs = this.localuser.favorites
						.emojiReactFreq()
						.slice(0, 6)
						.filter(([emoji]) => {
							return !this.reactions.find(
								(_) => _.emoji.id === emoji || _.emoji.emoji === emoji || _.emoji.name === emoji,
							)?.me;
						})
						.slice(0, 3);
					for (const [emoji] of favs) {
						addedRec = true;
						const container = document.createElement("button");
						if (isNaN(+emoji)) {
							container.append(emoji);
						} else {
							const emj = Emoji.getEmojiFromIDOrString(emoji, this.localuser);
							container.append(emj.getHTML(false, false));
						}
						container.onclick = () => {
							this.reactionToggle(emoji);
						};
						buttons.append(container);
					}
				}
				if (addedRec) {
					Array.from(buttons.children).at(-1)?.classList.add("vr-message");
				}
				if (this.channel.hasPermission("SEND_MESSAGES") && !this.ephemeral) {
					const container = document.createElement("button");
					const reply = document.createElement("span");
					reply.classList.add("svg-reply", "svgicon");
					container.append(reply);
					buttons.append(container);
					container.onclick = (_) => {
						this.channel.setReplying(this);
					};
				}
				if (this.channel.hasPermission("ADD_REACTIONS")) {
					const container = document.createElement("button");
					const reply = document.createElement("span");
					reply.classList.add("svg-emoji", "svgicon");
					container.append(reply);
					buttons.append(container);
					container.onclick = (e) => {
						e.stopImmediatePropagation();
						e.preventDefault();
						Emoji.emojiPicker(e.x, e.y, this.localuser).then((_) => {
							this.reactionToggle(_);
						});
					};
				}
				if (this.author === this.localuser.user && this.type !== 46) {
					const container = document.createElement("button");
					const edit = document.createElement("span");
					edit.classList.add("svg-edit", "svgicon");
					container.append(edit);
					buttons.append(container);
					container.onclick = (_) => {
						this.setEdit();
					};
				}
				if (this.canDelete()) {
					const container = document.createElement("button");
					const reply = document.createElement("span");
					reply.classList.add("svg-delete", "svgicon");
					container.append(reply);
					buttons.append(container);
					container.onclick = (_) => {
						if (_.shiftKey) {
							this.delete();
							return;
						}
						this.confirmDelete();
					};
				}
				if (buttons.childNodes.length !== 0) {
					div.append(buttons);
				}
			}
		};
		div.onmouseleave = (_) => {
			if (buttons) {
				buttons.remove();
				buttons = undefined;
			}
		};
	}
	confirmDelete() {
		const diaolog = new Dialog("");
		diaolog.options.addTitle(I18n.deleteConfirm());
		const options = diaolog.options.addOptions("", {ltr: true});
		options.addButtonInput("", I18n.yes(), () => {
			this.delete();
			diaolog.hide();
		});
		options.addButtonInput("", I18n.no(), () => {
			diaolog.hide();
		});
		diaolog.show();
	}
	confirmDeletePoll() {
		const diaolog = new Dialog("");
		diaolog.options.addTitle(I18n.deleteConfirmPoll());
		const options = diaolog.options.addOptions("", {ltr: true});
		options.addButtonInput("", I18n.yes(), () => {
			fetch(`${this.info.api}/channels/${this.channel.id}/polls/${this.id}/expire`, {
				headers: this.headers,
				method: "POST",
			});
			diaolog.hide();
		});
		options.addButtonInput("", I18n.no(), () => {
			diaolog.hide();
		});
		diaolog.show();
	}
	updateReactions() {
		const reactdiv = this.reactdiv.deref();
		if (!reactdiv) return;
		const func = this.channel.infinite.snapBottom();
		reactdiv.innerHTML = "";
		for (const thing of this.reactions) {
			const reaction = document.createElement("div");
			reaction.classList.add("reaction");
			if (thing.me) {
				reaction.classList.add("meReacted");
			}
			let emoji: HTMLElement;
			if (thing.emoji.id || /\d{17,21}/.test(thing.emoji.name)) {
				if (/\d{17,21}/.test(thing.emoji.name)) {
					thing.emoji.id = thing.emoji.name; //Should stop being a thing once the server fixes this bug
				}
				const emo = new Emoji(
					thing.emoji as {name: string; id: string; animated: boolean},
					this.guild,
				);
				emoji = emo.getHTML(false, false);
			} else {
				emoji = document.createElement("p");
				emoji.textContent = thing.emoji.name;
			}
			const h = new Hover(async () => {
				//TODO this can't be real, name conflicts must happen, but for now it's fine
				const f = await fetch(
					`${this.info.api}/channels/${this.channel.id}/messages/${this.id}/reactions/${thing.emoji.name}?limit=3&type=0`,
					{headers: this.headers},
				);
				const json = (await f.json()) as userjson[];
				let build = "";
				let users = json.map((_) => new User(_, this.localuser));
				//FIXME this is a spacebar bug, I can't fix this the api ignores limit and just sends everything.
				users = users.splice(0, 3);
				let first = true;
				for (const user of users) {
					if (!first) {
						build += ", ";
					}
					build += user.name;
					first = false;
				}
				if (thing.count > 3) {
					build = I18n.message.andMore(build);
				} else {
				}
				build += "\n" + I18n.message.reactedWith(thing.emoji.name);
				return build;
			});
			h.addEvent(reaction);
			const count = document.createElement("p");
			count.textContent = "" + thing.count;
			count.classList.add("reactionCount");
			reaction.append(count);
			reaction.append(emoji);
			reactdiv.append(reaction);

			reaction.onclick = (_) => {
				this.reactionToggle(new Emoji(thing.emoji, this.guild));
			};
		}
		func();
	}
	reactionAdd(data: {name: string; id?: string}, member: Member | {id: string}) {
		for (const thing of this.reactions) {
			if (thing.emoji.name === data.name || (thing.emoji.id === data.id && data.id)) {
				thing.count++;
				if (member.id === this.localuser.user.id) {
					thing.me = true;
				}
				this.updateReactions();
				return;
			}
		}
		this.reactions.push({
			count: 1,
			emoji: data,
			me: member.id === this.localuser.user.id,
		});
		this.updateReactions();
	}
	reactionRemove(data: {name: string; id?: string}, id: string) {
		for (const i in this.reactions) {
			const thing = this.reactions[i];
			console.log(thing, data);
			if (thing.emoji.name === data.name || (thing.emoji.id === data.id && data.id)) {
				thing.count--;
				if (thing.count === 0) {
					this.reactions.splice(Number(i), 1);
					this.updateReactions();
					return;
				}
				if (id === this.localuser.user.id) {
					thing.me = false;
					this.updateReactions();
					return;
				}
			}
		}
	}
	reactionRemoveAll() {
		this.reactions = [];
		this.updateReactions();
	}
	reactionRemoveEmoji(emoji: Emoji) {
		for (const i in this.reactions) {
			const reaction = this.reactions[i];
			if (
				(reaction.emoji.id && reaction.emoji.id == emoji.id) ||
				(!reaction.emoji.id && reaction.emoji.name == emoji.name)
			) {
				this.reactions.splice(Number(i), 1);
				this.updateReactions();
				break;
			}
		}
	}
	buildhtml(premessage?: Message | undefined, dupe = false): HTMLElement {
		const id = this.channel.nonceMap.get(this.nonce);
		if (id && !dupe) {
			this.channel.destroyFakeMessage(id);
		}
		if (dupe) {
			return this.generateMessage(premessage, false, document.createElement("div")) as HTMLElement;
		}
		if (this.div) {
			console.error(`HTML for ${this.id} already exists, aborting`);
			return this.div;
		}
		try {
			const div = document.createElement("div");
			this.div = div;
			this.messageevents(div);
			return this.generateMessage(premessage) as HTMLElement;
		} catch (e) {
			console.error(e);
		}
		return this.div as HTMLElement;
	}
}
let now: string;
let yesterdayStr: string;

function formatTime(date: Date) {
	updateTimes();
	const datestring = date.toLocaleDateString();
	const formatTime = (date: Date) =>
		date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});

	if (datestring === now) {
		return I18n.todayAt(formatTime(date));
	} else if (datestring === yesterdayStr) {
		return I18n.yesterdayAt(formatTime(date));
	} else {
		return I18n.otherAt(date.toLocaleDateString(), formatTime(date));
	}
}
let tomorrow = 0;
updateTimes();
function updateTimes() {
	if (tomorrow < Date.now()) {
		const d = new Date();
		tomorrow = d.setHours(24, 0, 0, 0);
		now = new Date().toLocaleDateString();
		const yesterday = new Date(now);
		yesterday.setDate(new Date().getDate() - 1);
		yesterdayStr = yesterday.toLocaleDateString();
	}
}
Message.setup();
export {Message};
