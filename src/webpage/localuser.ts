import {Guild} from "./guild.js";
import {Channel} from "./channel.js";
import {Direct, Group} from "./direct.js";
import {User} from "./user.js";
import {createImg, getapiurls, getBulkUsers, installPGet, SW} from "./utils/utils.js";
import {getBulkInfo, setTheme, Specialuser} from "./utils/utils.js";
import {
	channeljson,
	expSessionJson,
	guildFolder,
	mainuserjson,
	memberjson,
	memberlistupdatejson,
	messageCreateJson,
	messagejson,
	presencejson,
	readyjson,
	sessionJson,
	startTypingjson,
	wsjson,
} from "./jsontypes.js";
import {Member} from "./member.js";
import {Dialog, Form, FormError, Options, Settings} from "./settings.js";
import {getTextNodeAtPosition, MarkDown, saveCaretPosition} from "./markdown.js";
import {Bot} from "./bot.js";
import {Role} from "./role.js";
import {VoiceFactory, voiceStatusStr} from "./voice.js";
import {I18n, langmap} from "./i18n.js";
import {Emoji} from "./emoji.js";
import {Play} from "./audio/play.js";
import {Message} from "./message.js";
import {badgeArr} from "./Dbadges.js";
import {Rights} from "./rights.js";
import {Contextmenu} from "./contextmenu.js";
import {Sticker} from "./sticker.js";
import {Hover} from "./hover.js";
import {AccountSwitcher} from "./utils/switcher.js";
import {Favorites} from "./favorites.js";
type traceObj = {
	micros: number;
	calls?: (string | traceObj)[];
};
type trace = [string, traceObj];
const wsCodesRetry = new Set([4000, 4001, 4002, 4003, 4005, 4007, 4008, 4009]);
interface CustomHTMLDivElement extends HTMLDivElement {
	markdown: MarkDown;
}

MarkDown.emoji = Emoji;
class Localuser {
	badges = new Map<
		string,
		{id: string; description: string; icon: string; link?: string; translate?: boolean}
	>(
		badgeArr as [
			string,
			{id: string; description: string; icon: string; link?: string; translate?: boolean},
		][],
	);
	lastSequence: number | null = null;
	get token() {
		return this.headers.Authorization;
	}
	userinfo!: Specialuser;
	serverurls!: Specialuser["serverurls"];
	initialized!: boolean;
	info!: Specialuser["serverurls"];
	headers!: {"Content-type": string; Authorization: string};
	ready!: readyjson;
	guilds!: Guild[];
	guildids: Map<string, Guild> = new Map();
	user!: User;
	idToPrev: Map<string, string | undefined> = new Map();
	idToNext: Map<string, string | undefined> = new Map();
	messages: Map<string, Message> = new Map();
	get status() {
		return this.user.status;
	}
	set status(status: string) {
		this.user.setstatus(status);
	}
	channelfocus: Channel | undefined;
	lookingguild: Guild | undefined;
	guildhtml: Map<string, HTMLDivElement> = new Map();
	ws: WebSocket | undefined;
	connectionSucceed = 0;
	errorBackoff = 0;
	channelids: Map<string, Channel> = new Map();
	readonly userMap: Map<string, User> = new Map();
	voiceFactory?: VoiceFactory;
	play?: Play;
	instancePing = {
		name: "Unknown",
	};
	mfa_enabled!: boolean;
	get perminfo() {
		return this.userinfo.localuserStore;
	}
	set perminfo(e) {
		this.userinfo.localuserStore = e;
	}
	static users = getBulkUsers();
	static async showAccountSwitcher(thisUser: Localuser) {
		const specialUser = await new AccountSwitcher().show();

		const onswap = thisUser.onswap;
		thisUser.unload();
		thisUser.swapped = true;
		const loading = document.getElementById("loading") as HTMLDivElement;
		loading.classList.remove("doneloading");
		loading.classList.add("loading");

		thisUser = new Localuser(specialUser);
		Localuser.users.currentuser = specialUser.uid;
		sessionStorage.setItem("currentuser", specialUser.uid);
		localStorage.setItem("userinfos", JSON.stringify(Localuser.users));

		thisUser.initwebsocket().then(() => {
			const loaddesc = document.getElementById("load-desc") as HTMLElement;
			thisUser.loaduser();
			thisUser.init();
			loading.classList.add("doneloading");
			loaddesc.textContent = I18n.loaded();
			loading.classList.remove("loading");
			console.log("done loading");
		});

		onswap?.(thisUser);
	}
	static userMenu = this.generateUserMenu();
	userResMap = new Map<string, Promise<User>>();
	async getUser(id: string) {
		let user = this.userMap.get(id);
		if (user) return user;
		const cache = this.userResMap.get(id);
		if (cache) return cache;
		const prom = User.resolve(id, this);
		this.userResMap.set(id, prom);
		await prom;
		this.userResMap.delete(id);
		return prom;
	}
	static generateUserMenu() {
		const menu = new Contextmenu<Localuser, void>("");
		menu.addButton(
			() => I18n.localuser.addStatus(),
			function () {
				const d = new Dialog(I18n.localuser.status());
				const opt = d.float.options.addForm(
					"",
					() => {
						const status = cust.value;
						sessionStorage.setItem("cstatus", JSON.stringify({text: status}));
						//this.user.setstatus(status);
						d.hide();
					},
					{
						fetchURL: this.info.api + "/users/@me/settings",
						method: "PATCH",
						headers: this.headers,
					},
				);
				opt.addText(I18n.localuser.customStatusWarn());
				opt.addPreprocessor((obj) => {
					if ("custom_status" in obj) {
						obj.custom_status = {text: obj.custom_status};
					}
				});
				const cust = opt.addTextInput(I18n.localuser.status(), "custom_status", {});
				d.show();
			},
		);
		menu.addButton(
			() => I18n.localuser.status(),
			function () {
				const d = new Dialog(I18n.localuser.status());
				const opt = d.float.options;
				const selection = ["online", "invisible", "dnd", "idle"] as const;
				const smap = selection.map((_) => I18n.user[_]());
				let index = selection.indexOf(this.status as "online" | "invisible" | "dnd" | "idle");
				if (index === -1) {
					index = 0;
				}
				opt
					.addSelect("", () => {}, smap, {
						defaultIndex: index,
					})
					.watchForChange(async (i) => {
						const status = selection[i];
						await fetch(this.info.api + "/users/@me/settings", {
							body: JSON.stringify({
								status,
							}),
							headers: this.headers,
							method: "PATCH",
						});
						sessionStorage.setItem("status", status);
						this.user.setstatus(status);
					});
				d.show();
			},
		);
		menu.addButton(
			() => I18n.switchAccounts(),
			function () {
				Localuser.showAccountSwitcher(this);
			},
		);
		return menu;
	}
	onswap?: (l: Localuser) => void;
	constructor(userinfo: Specialuser | -1) {
		Play.playURL("/audio/sounds.jasf").then((_) => {
			this.play = _;
		});

		//TODO get rid of this garbage
		if (userinfo === -1) {
			this.rights = new Rights("");
			return;
		}
		this.userinfo = userinfo;
		this.perminfo.guilds ??= {};
		this.perminfo.user ??= {};
		this.serverurls = this.userinfo.serverurls;
		this.initialized = false;
		this.info = this.serverurls;
		SW.postMessage({
			code: "canRefresh",
			host: new URL(this.info.cdn).host,
		});
		SW.captureEvent("refreshURL", async (e) => {
			SW.postMessage({
				code: "refreshedUrl",
				url: await this.refreshURL(e.url),
				oldurl: e.url,
			});
		});
		this.headers = {
			"Content-type": "application/json; charset=UTF-8",
			Authorization: this.userinfo.token,
		};
		this.favorites = new Favorites(this);
		const rights = this.perminfo.user.rights || "875069521787904";
		this.rights = new Rights(rights);

		if (this.perminfo.user.disableColors === undefined) this.perminfo.user.disableColors = true;
		this.updateTranslations();
	}
	favorites!: Favorites;
	readysup = false;
	get voiceAllowed() {
		return this.readysup;
	}
	mute = true;
	deaf = false;
	updateOtherMic = () => {};
	updateMic(updateVoice: boolean = true) {
		this.updateOtherMic();
		const mic = document.getElementById("mic") as HTMLElement;
		mic.classList.remove("svg-mic", "svg-micmute");
		if (this.voiceFactory && updateVoice) this.voiceFactory.mute = this.mute;
		if (this.mute) {
			mic.classList.add("svg-micmute");
		} else {
			mic.classList.add("svg-mic");
		}
	}
	channelByID(id: string): Channel | void {
		let channel: Channel | void = undefined;
		this.guilds.forEach((_) => {
			_.channels.forEach((_) => {
				if (_.id === id) {
					channel = _;
				}
			});
		});
		return channel;
	}
	trace: {trace: trace; time: Date}[] = [];
	handleTrace(str: string[]) {
		const json = str.map((_) => JSON.parse(_)) as trace[];
		console.log(json);
		this.trace.push(
			...json.map((trace) => {
				return {trace, time: new Date()};
			}),
		);
	}
	async queryBlog() {
		this.perminfo.localuser ??= {};
		const bstate = localStorage.getItem("blogUpdates") as "Yes" | "No" | "Wait" | null;
		if (!bstate) {
			localStorage.setItem("blogUpdates", "Wait");
		} else if (bstate === "Wait") {
			const pop = new Dialog("");
			pop.options.addText(I18n.blog.wantUpdates());
			const opts = pop.options.addOptions("", {ltr: true});
			opts.addButtonInput("", I18n.yes(), () => {
				localStorage.setItem("blogUpdates", "Yes");
				this.queryBlog();
				pop.hide();
			});
			opts.addButtonInput("", I18n.no(), () => {
				localStorage.setItem("blogUpdates", "No");
				this.queryBlog();
				pop.hide();
			});
			pop.show();
		} else if (bstate === "Yes") {
			const post = (await this.getPosts()).items[0];
			if (this.perminfo.localuser.mostRecent !== post.url) {
				this.perminfo.localuser.mostRecent = post.url;
				const pop = new Dialog(post.title);
				//TODO implement images for the rendering of this
				pop.options.addText(post.content_html);
				pop.options.addButtonInput("", I18n.blog.gotoPost(), () => {
					window.open(post.url);
					pop.hide();
				});
				pop.show();
			}
		}
	}
	guildFolders: guildFolder[] = [];
	async gottenReady(ready: readyjson): Promise<void> {
		await I18n.done;
		this.queryBlog();
		this.guildFolders = ready.d.user_settings.guild_folders;
		document.body.style.setProperty("--view-rest", I18n.message.viewrest());
		this.initialized = true;
		this.ready = ready;
		this.guilds = [];
		this.guildids = new Map();
		this.user = new User(ready.d.user, this);
		this.user.setstatus(sessionStorage.getItem("status") || "online");
		this.resume_gateway_url = ready.d.resume_gateway_url;
		this.session_id = ready.d.session_id;

		this.mdBox();

		this.voiceFactory = new VoiceFactory(
			{id: this.user.id},
			(g) => {
				if (this.ws) {
					this.ws.send(JSON.stringify(g));
				}
			},
			this.info.api.startsWith("https://"),
		);
		this.handleVoice();
		this.mfa_enabled = ready.d.user.mfa_enabled as boolean;
		this.userinfo.username = this.user.username;
		this.userinfo.id = this.user.id;
		this.userinfo.pfpsrc = this.user.getpfpsrc();

		if (ready.d.auth_token) {
			this.userinfo.token = ready.d.auth_token;
			this.userinfo.json.token = ready.d.auth_token;
			this.headers.Authorization = ready.d.auth_token;
			this.userinfo.updateLocal();
		}

		this.status = this.ready.d.user_settings.status;
		this.channelfocus = undefined;
		this.lookingguild = undefined;
		this.guildhtml = new Map();
		const members: {[key: string]: memberjson} = {};
		if (ready.d.merged_members) {
			for (const thing of ready.d.merged_members) {
				members[thing[0].guild_id] = thing[0];
			}
		}
		this.updateMic();
		const mic = document.getElementById("mic") as HTMLElement;
		mic.onclick = () => {
			this.mute = !this.mute;
			this.updateMic();
		};
		for (const thing of ready.d.guilds) {
			const temp = new Guild(thing, this, members[thing.id]);
			this.guilds.push(temp);
			this.guildids.set(temp.id, temp);
		}
		{
			const temp = new Direct(ready.d.private_channels, this);
			this.guilds.push(temp);
			this.guildids.set(temp.id, temp);
		}
		if (ready.d.user_guild_settings) {
			console.log(ready.d.user_guild_settings.entries);

			for (const thing of ready.d.user_guild_settings.entries) {
				(this.guildids.get(thing.guild_id) as Guild).notisetting(thing);
			}
		}
		if (ready.d.read_state) {
			for (const thing of ready.d.read_state.entries) {
				const channel = this.channelids.get(thing.channel_id);
				if (!channel) {
					continue;
				}
				channel.readStateInfo(thing);
			}
		}
		for (const relationship of ready.d.relationships) {
			const user = new User(relationship.user, this);
			user.handleRelationship(relationship);
		}

		this.pingEndpoint();

		this.generateFavicon();
	}
	inrelation = new Set<User>();
	outoffocus(): void {
		const servers = document.getElementById("servers") as HTMLDivElement;
		servers.innerHTML = "";
		const channels = document.getElementById("channels") as HTMLDivElement;
		channels.innerHTML = "";
		if (this.channelfocus) {
			this.channelfocus.infinite.delete();
		}
		this.lookingguild = undefined;
		this.channelfocus = undefined;
	}
	unload(): void {
		this.initialized = false;
		this.outoffocus();
		this.guilds = [];
		this.guildids = new Map();
		if (this.ws) {
			this.ws.close(4040);
		}
	}
	swapped = false;
	resume_gateway_url?: string;
	session_id?: string;
	async initwebsocket(resume = false): Promise<void> {
		let returny: () => void;
		if (!this.resume_gateway_url || !this.session_id) {
			resume = false;
		}
		const doComp = DecompressionStream && !localStorage.getItem("gateWayComp");
		const ws = new WebSocket(
			(resume ? this.resume_gateway_url : this.serverurls.gateway.toString()) +
				"?encoding=json&v=9" +
				(doComp ? "&compress=zlib-stream" : ""),
		);
		this.ws = ws;
		let ds: DecompressionStream;
		let w: WritableStreamDefaultWriter;
		let arr: Uint8Array;

		if (DecompressionStream) {
			ds = new DecompressionStream("deflate");
			w = ds.writable.getWriter();

			arr = new Uint8Array();
		}
		const promise = new Promise<void>((res) => {
			returny = res;
			ws.addEventListener("open", (_event) => {
				console.log("WebSocket connected");
				if (resume) {
					ws.send(
						JSON.stringify({
							op: 6,
							d: {
								token: this.token,
								session_id: this.session_id,
								seq: this.lastSequence,
							},
						}),
					);
					this.resume_gateway_url = undefined;
					this.session_id = undefined;
				} else {
					ws.send(
						JSON.stringify({
							op: 2,
							d: {
								token: this.token,
								capabilities: 16381,
								properties: {
									browser: "Fermi",
									client_build_number: 0, //might update this eventually lol
									release_channel: "Custom",
									browser_user_agent: navigator.userAgent,
								},
								compress: Boolean(DecompressionStream),
								presence: {
									status: sessionStorage.getItem("status") || "online",
									since: null, //new Date().getTime()
									activities: [],
									afk: false,
								},
							},
						}),
					);
				}
			});

			if (DecompressionStream) {
				(async () => {
					let build = "";
					for await (const data of ds.readable.tee()[0].pipeThrough(new TextDecoderStream())) {
						build += data;
						try {
							const temp = JSON.parse(build);
							build = "";
							await this.handleEvent(temp);
							if (temp.op === 0 && temp.t === "READY") {
								returny();
							}
						} catch {}
					}
				})();
			}
		});

		let order = new Promise<void>((res) => res());

		ws.addEventListener("message", async (event) => {
			const temp2 = order;
			order = new Promise<void>(async (res) => {
				await temp2;
				let temp: {op: number; t: string};
				try {
					if (event.data instanceof Blob) {
						const buff = await event.data.arrayBuffer();
						const array = new Uint8Array(buff);

						const temparr = new Uint8Array(array.length + arr.length);
						temparr.set(arr, 0);
						temparr.set(array, arr.length);
						arr = temparr;

						const len = array.length;
						if (
							!(
								array[len - 1] === 255 &&
								array[len - 2] === 255 &&
								array[len - 3] === 0 &&
								array[len - 4] === 0
							)
						) {
							return;
						}
						w.write(arr.buffer);
						arr = new Uint8Array();
						return; //had to move the while loop due to me being dumb
					} else {
						temp = JSON.parse(event.data);
					}

					await this.handleEvent(temp as readyjson);
					if (temp.op === 0 && temp.t === "READY") {
						returny();
					}
				} catch (e) {
					console.error(e);
				} finally {
					res();
				}
			});
		});

		ws.addEventListener("close", async (event) => {
			this.ws = undefined;
			console.log("WebSocket closed with code " + event.code);
			if (
				(event.code > 1000 && event.code < 1016 && this.errorBackoff === 0) ||
				(wsCodesRetry.has(event.code) && this.errorBackoff === 0)
			) {
				this.errorBackoff++;
				this.initwebsocket(true).then(() => {
					this.loaduser();
				});
				return;
			}
			this.unload();
			(document.getElementById("loading") as HTMLElement).classList.remove("doneloading");
			(document.getElementById("loading") as HTMLElement).classList.add("loading");
			this.fetchingmembers = new Map();
			this.noncemap = new Map();
			this.noncebuild = new Map();
			const loaddesc = document.getElementById("load-desc") as HTMLElement;
			if (
				(event.code > 1000 && event.code < 1016) ||
				wsCodesRetry.has(event.code) ||
				event.code == 4041
			) {
				if (this.connectionSucceed !== 0 && Date.now() > this.connectionSucceed + 20000) {
					this.errorBackoff = 0;
				} else this.errorBackoff++;
				this.connectionSucceed = 0;

				loaddesc.innerHTML = "";
				loaddesc.append(
					new MarkDown(
						I18n.errorReconnect(Math.round(0.2 + this.errorBackoff * 2.8) + ""),
					).makeHTML(),
				);
				switch (
					this.errorBackoff //try to recover from bad domain
				) {
					case 3:
						const newurls = await getapiurls(this.info.wellknown);
						if (newurls) {
							this.info = newurls;
							this.serverurls = newurls;
							this.userinfo.json.serverurls = this.info;
							break;
						}
						break;

					case 4: {
						const newurls = await getapiurls(new URL(this.info.wellknown).origin);
						if (newurls) {
							this.info = newurls;
							this.serverurls = newurls;
							this.userinfo.json.serverurls = this.info;
							break;
						}
						break;
					}
					case 5: {
						const breakappart = new URL(this.info.wellknown).host.split(".");
						const url = "https://" + breakappart.at(-2) + "." + breakappart.at(-1);
						const newurls = await getapiurls(url);
						if (newurls) {
							this.info = newurls;
							this.serverurls = newurls;
							this.userinfo.json.serverurls = this.info;
						}
						break;
					}
				}
				setTimeout(
					() => {
						if (this.swapped) return;
						loaddesc.textContent = I18n.retrying();
						this.initwebsocket().then(() => {
							this.loaduser();
							this.init();
							const loading = document.getElementById("loading") as HTMLElement;
							loading.classList.add("doneloading");
							loading.classList.remove("loading");
							loaddesc.textContent = I18n.loaded();
							console.log("done loading");
						});
					},
					200 + this.errorBackoff * 2800,
				);
			} else loaddesc.textContent = I18n.unableToConnect();
		});
		await promise;
	}
	interNonceMap = new Map<string, Message>();
	registerInterNonce(nonce: string, thing: Message) {
		this.interNonceMap.set(nonce, thing);
	}
	relationshipsUpdate = () => {};
	rights: Rights;
	updateRights(rights: string | number) {
		this.rights.update(rights);
		this.perminfo.user.rights = rights;
	}
	traceSub() {
		SW.captureEvent("trace", (e) => {
			this.handleTrace(e.trace);
		});
	}
	async handleEvent(temp: wsjson) {
		if (temp.d._trace) this.handleTrace(temp.d._trace);
		if (localStorage.getItem("logGateway")) console.debug(temp);
		if (temp.s) this.lastSequence = temp.s;
		if (temp.op === 9 && this.ws) {
			this.errorBackoff = 0;
			this.ws.close(4041);
		}
		if (temp.op == 0) {
			switch (temp.t) {
				case "INTERACTION_FAILURE":
				case "INTERACTION_CREATE":
				case "INTERACTION_SUCCESS":
					const m = this.interNonceMap.get(temp.d.nonce);
					if (m) {
						//Punt the events off to the message class
						m.interactionEvents(temp);
					}
					break;
				case "MESSAGE_CREATE":
					if (this.initialized) {
						this.messageCreate(temp);
					}
					break;
				case "MESSAGE_DELETE": {
					temp.d.guild_id ??= "@me";
					const channel = this.channelids.get(temp.d.channel_id);
					if (!channel) break;
					const message = channel.messages.get(temp.d.id);
					if (!message) break;
					message.deleteEvent();
					break;
				}
				case "READY":
					await this.gottenReady(temp as readyjson);
					break;
				case "MESSAGE_UPDATE": {
					temp.d.guild_id ??= "@me";
					const channel = this.channelids.get(temp.d.channel_id);
					if (!channel) break;
					const message = channel.messages.get(temp.d.id);
					if (!message) break;
					message.giveData(temp.d);
					break;
				}
				case "TYPING_START":
					if (this.initialized) {
						this.typingStart(temp);
					}
					break;
				case "USER_UPDATE":
					if (this.initialized) {
						const users = this.userMap.get(temp.d.id);
						if (users) {
							users.userupdate(temp.d);
						}
					}
					break;
				case "CHANNEL_PINS_UPDATE":
					temp.d.guild_id ??= "@me";
					const channel = this.channelids.get(temp.d.channel_id);
					if (!channel) break;
					delete channel.pinnedMessages;
					channel.lastpin = new Date() + "";
					const pinnedM = document.getElementById("pinnedMDiv");
					if (pinnedM) {
						pinnedM.classList.add("unreadPin");
					}
					break;
				case "CHANNEL_UPDATE":
					if (this.initialized) {
						this.updateChannel(temp.d);
					}
					break;
				case "CHANNEL_CREATE":
					if (this.initialized) {
						this.createChannel(temp.d);
					}
					break;
				case "CHANNEL_DELETE":
					if (this.initialized) {
						this.delChannel(temp.d);
					}
					break;
				case "GUILD_DELETE": {
					const guildy = this.guildids.get(temp.d.id);
					if (guildy) {
						this.guildids.delete(temp.d.id);
						this.guilds.splice(this.guilds.indexOf(guildy), 1);
						guildy.html.remove();
						if (guildy === this.lookingguild) {
							this.guildids.get("@me")?.loadGuild();
							this.guildids.get("@me")?.loadChannel();
						}
					}
					break;
				}
				case "GUILD_UPDATE": {
					const guildy = this.guildids.get(temp.d.id);
					if (guildy) {
						guildy.update(temp.d);
					}
					break;
				}
				case "GUILD_CREATE":
					(async () => {
						const guildy = new Guild(temp.d, this, this.user);
						this.guilds.push(guildy);
						this.guildids.set(guildy.id, guildy);
						const divy = guildy.generateGuildIcon();
						guildy.HTMLicon = divy;
						(document.getElementById("servers") as HTMLDivElement).insertBefore(
							divy,
							document.getElementById("bottomseparator"),
						);
						guildy.message_notifications = guildy.properties.default_message_notifications;
					})();
					break;
				case "MESSAGE_REACTION_ADD":
					{
						temp.d.guild_id ??= "@me";
						const guild = this.guildids.get(temp.d.guild_id);
						if (!guild) break;
						const channel = this.channelids.get(temp.d.channel_id);
						if (!channel) break;
						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;
						let thing: Member | {id: string};
						if (temp.d.member) {
							thing = (await Member.new(temp.d.member, guild)) as Member;
						} else {
							thing = {id: temp.d.user_id};
						}
						message.reactionAdd(temp.d.emoji, thing);
					}
					break;
				case "MESSAGE_REACTION_REMOVE":
					{
						temp.d.guild_id ??= "@me";
						const channel = this.channelids.get(temp.d.channel_id);
						if (!channel) break;

						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;

						message.reactionRemove(temp.d.emoji, temp.d.user_id);
					}
					break;
				case "MESSAGE_REACTION_REMOVE_ALL":
					{
						temp.d.guild_id ??= "@me";
						const channel = this.channelids.get(temp.d.channel_id);
						if (!channel) break;
						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;
						message.reactionRemoveAll();
					}
					break;
				case "MESSAGE_REACTION_REMOVE_EMOJI":
					{
						temp.d.guild_id ??= "@me";
						const channel = this.channelids.get(temp.d.channel_id);
						if (!channel) break;
						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;
						message.reactionRemoveEmoji(temp.d.emoji);
					}
					break;
				case "GUILD_MEMBERS_CHUNK":
					this.gotChunk(temp.d);
					break;
				case "GUILD_MEMBER_LIST_UPDATE": {
					this.memberListUpdate(temp);
					break;
				}
				case "READY_SUPPLEMENTAL":
					{
						temp.d.guilds.forEach((_) =>
							_.voice_states.forEach((status) => {
								if (this.voiceFactory && status.channel_id) {
									this.voiceFactory.voiceStateUpdate(status);
									console.log(status);
								}
							}),
						);
						this.readysup = temp.d.guilds.length !== 0;
					}
					break;
				case "VOICE_STATE_UPDATE":
					if (this.user.id === temp.d.user_id) {
						this.mute = temp.d.self_mute;
						this.updateMic(false);
					}
					if (this.voiceFactory) {
						this.voiceFactory.voiceStateUpdate(temp.d);
					}

					break;
				case "STREAM_SERVER_UPDATE": {
					if (this.voiceFactory) {
						this.voiceFactory.streamServerUpdate(temp);
					}
					break;
				}
				case "STREAM_CREATE": {
					if (this.voiceFactory) {
						this.voiceFactory.streamCreate(temp);
					}
					break;
				}
				case "VOICE_SERVER_UPDATE":
					if (this.voiceFactory) {
						this.voiceFactory.voiceServerUpdate(temp);
					}
					break;
				case "GUILD_ROLE_CREATE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.newRole(temp.d.role);
					break;
				}
				case "GUILD_ROLE_UPDATE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.updateRole(temp.d.role);
					break;
				}
				case "GUILD_ROLE_DELETE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.deleteRole(temp.d.role_id);
					break;
				}
				case "GUILD_MEMBER_UPDATE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.memberupdate(temp.d);
					break;
				}
				case "RELATIONSHIP_UPDATE":
				case "RELATIONSHIP_ADD": {
					(async () => {
						const user = temp.d.user ? new User(temp.d.user, this) : await this.getUser(temp.d.id);
						user.handleRelationship(temp.d);
						this.relationshipsUpdate();
						const me = this.guildids.get("@me");
						if (!me) return;
						me.unreads();
					})();
					break;
				}
				case "RELATIONSHIP_REMOVE": {
					const user = this.userMap.get(temp.d.id);
					if (!user) return;
					user.removeRelation();
					this.relationshipsUpdate();
					break;
				}
				case "PRESENCE_UPDATE": {
					if (temp.d.user) {
						const user = new User(temp.d.user, this);
						this.presences.set(temp.d.user.id, temp.d);
						user.setstatus(temp.d.status);
						if (user === this.user) this.loaduser();
					}
					break;
				}
				case "GUILD_MEMBER_ADD": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					Member.new(temp.d, guild);
					break;
				}
				case "GUILD_MEMBER_REMOVE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					const user = new User(temp.d.user, this);
					const member = user.members.get(guild);
					if (!(member instanceof Member)) break;
					member.remove();
					break;
				}
				case "GUILD_EMOJIS_UPDATE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.emojis = temp.d.emojis;
					guild.onEmojiUpdate(guild.emojis);
					break;
				}
				case "GUILD_STICKERS_UPDATE": {
					const guild = this.guildids.get(temp.d.guild_id);
					if (!guild) break;
					guild.stickers = temp.d.stickers.map((_) => new Sticker(_, guild));
					guild.onStickerUpdate(guild.stickers);
					break;
				}
				case "CHANNEL_RECIPIENT_REMOVE": {
					const guild = this.guildids.get("@me") as Direct;
					const channel = guild.channels.find(({id}) => id == temp.d.channel_id) as Group;
					if (!channel) break;
					channel.removeRec(new User(temp.d.user, this));
					break;
				}
				case "CHANNEL_RECIPIENT_ADD": {
					const guild = this.guildids.get("@me") as Direct;
					const channel = guild.channels.find(({id}) => id == temp.d.channel_id) as Group;
					if (!channel) break;
					channel.addRec(new User(temp.d.user, this));
					break;
				}
				case "MESSAGE_ACK": {
					const channel = this.channelByID(temp.d.channel_id);
					if (!channel) break;
					channel.lastreadmessageid = temp.d.message_id;
					channel.mentions = 0;
					channel.unreads();
					channel.guild.unreads();
					break;
				}

				default: {
					//@ts-expect-error
					console.warn("Unhandled case " + temp.t, temp);
				}
			}
			this.generateFavicon();
		} else if (temp.op === 10) {
			if (!this.ws) return;
			console.log("heartbeat down");
			this.heartbeat_interval = temp.d.heartbeat_interval;
			this.ws.send(JSON.stringify({op: 1, d: this.lastSequence}));
		} else if (temp.op === 11) {
			setTimeout((_: any) => {
				if (!this.ws) return;
				if (this.connectionSucceed === 0) this.connectionSucceed = Date.now();
				this.ws.send(JSON.stringify({op: 1, d: this.lastSequence}));
			}, this.heartbeat_interval);
		} else {
			console.log("Unhandled case " + temp.d, temp);
		}
	}
	get currentVoice() {
		return this.voiceFactory?.currentVoice;
	}
	async joinVoice(channel: Channel) {
		if (!this.voiceFactory) return;
		if (!this.ws) return;
		this.ws.send(
			JSON.stringify(this.voiceFactory.joinVoice(channel.id, channel.guild.id, this.mute)),
		);
		return undefined;
	}
	regenVoiceIcons = () => {};
	changeVCStatus(status: voiceStatusStr, channel: Channel) {
		const statuselm = document.getElementById("VoiceStatus");
		const VoiceGuild = document.getElementById("VoiceGuild");
		const VoiceButtons = document.getElementById("VoiceButtons");
		if (!statuselm || !VoiceGuild || !VoiceButtons) throw new Error("Missing status element");

		statuselm.textContent = I18n.Voice.status[status]();
		const guildName = document.createElement("span");
		guildName.textContent = channel.guild.properties.name;
		const channelName = document.createElement("span");
		channelName.textContent = channel.name;
		VoiceGuild.innerHTML = ``;
		VoiceGuild.append(guildName, " / ", channelName);
		VoiceGuild.onclick = () => {
			this.goToChannel(channel.id);
		};

		VoiceButtons.innerHTML = "";

		const leave = document.createElement("div");
		const leaveIcon = document.createElement("span");
		leaveIcon.classList.add("svg-hangup");
		leave.append(leaveIcon);

		leave.onclick = () => {
			channel.voice?.leave();
		};

		const screenShare = document.createElement("div");
		const screenShareIcon = document.createElement("span");
		const updateStreamIcon = () => {
			screenShareIcon.classList.remove("svg-stopstream", "svg-stream");
			if (channel.voice?.isLive()) {
				screenShareIcon.classList.add("svg-stopstream");
			} else {
				screenShareIcon.classList.add("svg-stream");
			}
		};
		updateStreamIcon();

		screenShare.append(screenShareIcon);

		screenShare.onclick = async () => {
			if (channel.voice?.isLive()) {
				channel.voice.stopStream();
			} else {
				const stream = await navigator.mediaDevices.getDisplayMedia();
				await channel.voice?.createLive(stream);
			}
			updateStreamIcon();
		};

		const video = document.createElement("div");
		const videoIcon = document.createElement("span");
		const updateVideoIconIcon = () => {
			videoIcon.classList.remove("svg-novideo", "svg-video");
			if (this.voiceFactory?.video) {
				videoIcon.classList.add("svg-video");
			} else {
				videoIcon.classList.add("svg-novideo");
			}
		};
		updateVideoIconIcon();

		video.append(videoIcon);

		video.onclick = async () => {
			if (this.voiceFactory?.video) {
				channel.voice?.stopVideo();
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
				channel.voice?.startVideo(cam);
			}
			updateVideoIconIcon();
		};

		this.regenVoiceIcons = () => {
			updateStreamIcon();
			updateVideoIconIcon();
		};
		VoiceButtons.append(leave, video, screenShare);

		const clear = () => {
			statuselm.textContent = "";
			VoiceGuild.textContent = "";
			VoiceButtons.innerHTML = "";
		};
		const conSet = new Set(["notconnected"]);
		if (conSet.has(status)) {
			setTimeout(() => {
				if (statuselm.textContent === I18n.Voice.status[status]()) {
					clear();
				}
			}, 2000);
		} else if (status === "left") {
			clear();
		}
	}
	handleVoice() {
		if (this.voiceFactory) {
			this.voiceFactory.onJoin = (voice) => {
				voice.onSatusChange = (status) => {
					let channel: Channel | undefined = undefined;
					for (const guild of this.guilds) {
						channel ||= guild.channels.find((_) => _.voice === voice);
					}
					if (channel) this.changeVCStatus(status, channel);
					else console.error("Uh, no channel found?");
				};
			};
		}
	}

	heartbeat_interval: number = 0;
	updateChannel(json: channeljson): void {
		const guild = this.guildids.get(json.guild_id || "@me");
		if (guild) {
			guild.updateChannel(json);
			if (json.guild_id === this.lookingguild?.id) {
				this.loadGuild(json.guild_id);
			}
		}
	}
	createChannel(json: channeljson): undefined | Channel {
		json.guild_id ??= "@me";
		const guild = this.guildids.get(json.guild_id);
		if (!guild) return;
		if (guild.channels.find((_) => _.id === json.id)) return;
		const channel = guild.createChannelpac(json);
		if (json.guild_id === this.lookingguild?.id) {
			this.loadGuild(json.guild_id, true);
		}
		if (channel.id === this.gotoid) {
			guild.loadGuild();
			guild.loadChannel(channel.id).then(() => {
				this.gotoRes();
				this.gotoRes = () => {};
				this.gotoid = undefined;
			});
		}
		return channel; // Add this line to return the 'channel' variable
	}
	listque = false;
	memberListQue() {
		if (this.listque) {
			return;
		}
		this.listque = true;
		setTimeout(async () => {
			await this.memberListUpdate();
			this.listque = false;
		}, 100);
	}
	async memberListUpdate(list: memberlistupdatejson | void) {
		if (this.searching) return;
		const guild = this.lookingguild;
		if (!guild) return;

		const channel = this.channelfocus;
		if (!channel) return;
		if (channel.voice && this.voiceAllowed) {
			return;
		}
		if (guild.id === "@me" && (channel as Group).type === 1) {
			const div = document.getElementById("sideDiv") as HTMLDivElement;
			div.textContent = "";
			return;
		}

		if (list) {
			if (list.d.guild_id !== guild.id) {
				return;
			}
			const counts = new Map<string, number>();
			for (const thing of list.d.ops[0].items) {
				if ("member" in thing) {
					await Member.new(thing.member, guild);
				} else {
					counts.set(thing.group.id, thing.group.count);
				}
			}
		}

		const elms: Map<Role | "offline" | "online", (Member | User)[]> = new Map([]);
		for (const role of guild.roles) {
			if (role.hoist) {
				elms.set(role, []);
			}
		}
		elms.set("online", []);
		elms.set("offline", []);
		let members = new Set<User | Member>(guild.members);
		if (channel instanceof Group) {
			members = new Set(channel.users);
			members.add(this.user);
		}
		members.forEach((member) => {
			if (member instanceof User) {
				return;
			}
			if (!channel.hasPermission("VIEW_CHANNEL", member)) {
				members.delete(member);
				console.log(member, "can't see");
				return;
			}
		});

		for (const [role, list] of elms) {
			members.forEach((member) => {
				const user = member instanceof Member ? member.user : member;
				if (role === "offline") {
					if (user.getStatus() === "offline" || user.getStatus() === "invisible") {
						list.push(member);
						members.delete(member);
					}
					return;
				}
				if (user.getStatus() === "offline" || user.getStatus() === "invisible") {
					return;
				}
				if (member instanceof Member) {
					if (role !== "online" && member.hasRole(role.id)) {
						list.push(member);
						members.delete(member);
					}
				}
			});
			if (!list.length) continue;
			list.sort((a, b) => {
				return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
			});
		}
		const online = [...members];
		online.sort((a, b) => {
			return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
		});
		elms.set("online", online);
		this.generateListHTML(elms, channel);
	}
	roleListMap = new WeakMap<
		HTMLDivElement,
		{
			role: Role | "offline" | "online";
			memberListMap: Map<HTMLElement, User>;
		}
	>();
	listGuild?: Guild;
	generateListHTML(elms: Map<Role | "offline" | "online", (Member | User)[]>, channel: Channel) {
		const div = document.getElementById("sideDiv") as HTMLDivElement;
		let roleMap = new Map<
			Role | "offline" | "online",
			{elm: HTMLDivElement; memberListMap: Map<HTMLElement, User>}
		>();
		if (channel.guild !== this.listGuild) {
			this.listGuild = channel.guild;
			div.innerHTML = "";
		}
		Array.from(div.children)
			.map((_) => [this.roleListMap.get(_ as HTMLDivElement), _ as HTMLDivElement] as const)
			.forEach(([role, elm]) => {
				if (role && elms.get(role.role)?.length) {
					if (document.contains(elm))
						roleMap.set(role.role, {elm, memberListMap: role.memberListMap});
				} else if (elm) {
					elm.remove();
				}
			});
		div.classList.remove("searchDiv");
		div.classList.remove("hideSearchDiv");
		let lastDiv: HTMLDivElement | void = undefined;
		for (const [role, list] of elms) {
			if (!list.length) continue;

			let category: HTMLDivElement;
			let memberMap: Map<HTMLElement, User>;
			const getF = roleMap.get(role);
			roleMap.delete(role);
			if (getF) {
				category = getF.elm;
				memberMap = getF.memberListMap;
				if (lastDiv) {
					const nextElm = lastDiv.nextElementSibling as HTMLElement | null;
					if (nextElm !== category) {
						lastDiv.after(category);
					}
				} else {
					const first = div.firstElementChild;
					if (first !== category) {
						div.prepend(category);
					}
				}
			} else {
				category = document.createElement("div");
				category.classList.add("memberList");
				let title = document.createElement("h3");
				if (role === "offline") {
					title.textContent = I18n.user.offline();
					category.classList.add("offline");
				} else if (role === "online") {
					title.textContent = I18n.user.online();
				} else {
					title.textContent = role.name;
				}
				category.append(title);
				const membershtml = document.createElement("div");
				membershtml.classList.add("flexttb");
				category.append(membershtml);
				memberMap = new Map();
				if (lastDiv) {
					lastDiv.after(category);
				} else {
					div.prepend(category);
				}
				this.roleListMap.set(category, {
					role,
					memberListMap: memberMap,
				});
			}
			lastDiv = category;
			const membershtml = category.getElementsByTagName("div")[0];
			const cur = new Set(
				list.map((member) => {
					return member instanceof Member ? member.user : member;
				}),
			);
			const userToHTMLMap = new Map<User, HTMLElement>();
			Array.from(membershtml.children)
				.map((_) => [_ as HTMLElement, memberMap.get(_ as HTMLElement)] as const)
				.forEach(([elm, memb]) => {
					if (!memb || !cur.has(memb)) {
						memberMap.delete(elm);
						elm.remove();
					} else {
						userToHTMLMap.set(memb, elm);
					}
				});
			const makeMemberDiv = (user: User, member: Member | User) => {
				user.localstatusUpdate = () => {
					this.memberListQue();
				};
				const memberdiv = document.createElement("div");
				memberMap.set(memberdiv, user);
				const pfp = user.buildstatuspfp(channel);
				const username = document.createElement("span");
				username.classList.add("ellipsis");
				username.textContent = member.name;
				member.subName(username);
				if (user.bot) {
					const bot = document.createElement("span");
					bot.classList.add("bot");
					bot.textContent = I18n.bot();
					username.appendChild(bot);
				}

				memberdiv.append(pfp, username);
				if (channel instanceof Group) {
					Group.groupMenu.bindContextmenu(memberdiv, channel, user);
					if (channel.owner_id === user.id) {
						const crown = document.createElement("span");
						crown.classList.add("svg-crown");
						memberdiv.append(crown);
					}
				}
				member.bind(username);
				user.bind(memberdiv, member instanceof Member ? member.guild : undefined, false);

				memberdiv.classList.add("flexltr", "liststyle", "memberListStyle");
				return memberdiv;
			};

			let lastElm: void | HTMLElement = void 0;
			for (const member of list) {
				const user = member instanceof Member ? member.user : member;
				let elm = userToHTMLMap.get(user);
				if (!elm) {
					elm = makeMemberDiv(user, member);
					if (!lastElm) {
						membershtml.append(elm);
					} else {
						lastElm.after(elm);
					}
				} else if (lastElm) {
					//@ts-expect-error TS Bug, let me know when it's fixed :3
					// https://github.com/microsoft/TypeScript/issues/62872
					const nextElm = lastElm.nextElementSibling;
					if (nextElm !== elm) {
						lastElm.after(elm);
					}
				} else {
					const first = membershtml.firstElementChild;
					if (first !== elm) {
						membershtml.prepend(elm);
					}
				}

				lastElm = elm;
			}
		}
	}
	emojiPicker(x: number, y: number, guildEmojis = true) {
		return Emoji.emojiPicker(x, y, guildEmojis ? this : undefined);
	}
	async getSidePannel() {
		if (this.ws && this.channelfocus) {
			console.log(this.channelfocus.guild.id);
			this.memberListQue();
			if (this.channelfocus.guild.id === "@me") {
				return;
			}
			if (!this.channelfocus.visable) return;
			this.ws.send(
				JSON.stringify({
					d: {
						channels: {[this.channelfocus.id]: [[0, 99]]},
						guild_id: this.channelfocus.guild.id,
					},
					op: 14,
				}),
			);
		} else {
			console.log("false? :3");
		}
	}
	async goToState(state: [string, string | undefined, string | undefined]) {
		const [guildid, channelid, messageid] = state;
		if (!channelid) {
			if (guildid === "@me") {
				const dir = this.guildids.get("@me") as Direct;
				dir.loadChannel(null, false);
			}
			return;
		}
		this.goToChannel(channelid, false, messageid);
	}

	gotoid: string | undefined;
	gotoRes = () => {};
	async goToChannel(channelid: string, addstate = true, messageid: undefined | string = undefined) {
		const channel = this.channelids.get(channelid);
		if (channel) {
			const guild = channel.guild;
			guild.loadGuild();
			await guild.loadChannel(channelid, addstate, messageid);
		} else {
			this.gotoid = channelid;
			return new Promise<void>((res) => (this.gotoRes = res));
		}
	}
	delChannel(json: channeljson): void {
		let guild_id = json.guild_id;
		guild_id ??= "@me";
		const guild = this.guildids.get(guild_id);
		if (guild) {
			guild.delChannel(json);
		}

		if (json.guild_id === this.lookingguild?.id) {
			this.loadGuild(json.guild_id, true);
		}
	}
	init(): void {
		const location = window.location.href.split("/");
		this.buildservers();
		if (location[3] === "channels") {
			const guild = this.loadGuild(location[4]);
			if (!guild) {
				return;
			}
			guild.loadChannel(location[5], true, location[6]);
			this.channelfocus = this.channelids.get(location[5]);
		}
	}
	loaduser(): void {
		(document.getElementById("username") as HTMLSpanElement).textContent = this.user.username;
		(document.getElementById("userpfp") as HTMLImageElement).src = this.user.getpfpsrc();
		(document.getElementById("status") as HTMLSpanElement).textContent = this.status;
	}
	isAdmin(): boolean {
		if (this.lookingguild) {
			return this.lookingguild.isAdmin();
		} else {
			return false;
		}
	}

	loadGuild(id: string, forceReload = false): Guild | undefined {
		this.searching = false;
		let guild = this.guildids.get(id);
		if (!guild) {
			guild = this.guildids.get("@me");
		}
		console.log(forceReload);
		if (!forceReload && this.lookingguild === guild) {
			return guild;
		}
		if (this.channelfocus && this.lookingguild !== guild) {
			this.channelfocus.infinite.delete();
			this.channelfocus = undefined;
		}
		if (this.lookingguild) {
			this.lookingguild.html.classList.remove("serveropen");
		}

		if (!guild) return;
		if (guild.html) {
			guild.html.classList.add("serveropen");
		}
		this.lookingguild = guild;
		(document.getElementById("serverName") as HTMLElement).textContent = guild.properties.name;
		const banner = document.getElementById("servertd");
		console.log(guild.banner, banner);
		if (banner) {
			if (guild.banner) {
				//https://cdn.discordapp.com/banners/677271830838640680/fab8570de5bb51365ba8f36d7d3627ae.webp?size=240
				banner.style.setProperty(
					"background-image",
					`linear-gradient(rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 40%), url(${this.info.cdn}/banners/${guild.id}/${guild.banner})`,
				);
				banner.classList.add("Banner");
				//background-image:
			} else {
				banner.style.removeProperty("background-image");
				banner.classList.remove("Banner");
			}
			if (guild.id !== "@me") {
				banner.style.setProperty("cursor", `pointer`);
				banner.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					const box = banner.getBoundingClientRect();
					Guild.contextmenu.makemenu(box.left + 16, box.bottom + 5, guild, undefined);
				};
			} else {
				banner.style.removeProperty("cursor");
				banner.onclick = () => {};
			}
		}
		//console.log(this.guildids,id)
		const channels = document.getElementById("channels") as HTMLDivElement;
		channels.innerHTML = "";
		const html = guild.getHTML();
		channels.appendChild(html);
		return guild;
	}
	dragMap = new WeakMap<
		HTMLElement,
		| Guild
		| {
				guilds: Guild[];
				color?: number | null;
				name: string;
				id: number;
		  }
	>();
	dragged?: HTMLElement;
	makeGuildDragable(
		elm: HTMLElement,
		thing:
			| Guild
			| {
					guilds: Guild[];
					color?: number | null;
					name: string;
					id: number;
			  },
	) {
		this.dragMap.set(elm, thing);
		elm.addEventListener("dragstart", (e) => {
			this.dragged = elm;
			e.stopImmediatePropagation();
		});
		elm.addEventListener("dragend", () => {
			delete this.dragged;
		});

		elm.style.position = "relative";
		elm.draggable = true;
		elm.addEventListener("dragenter", (event) => {
			console.log("enter");
			event.preventDefault();
			event.stopImmediatePropagation();
		});
		const guildWithin = (guild?: Guild) => {
			return !this.guildOrder.find((_) => _ === guild);
		};
		elm.addEventListener("dragover", (event) => {
			event.stopImmediatePropagation();
			const thingy = this.dragMap.get(this.dragged as HTMLElement);
			if (!thingy) return;
			if (this.dragged === elm) return;
			if (!(thingy instanceof Guild) && guildWithin(thing as Guild)) return;
			const height = elm.getBoundingClientRect().height;
			if (event.offsetY < 0.3 * 48) {
				elm.classList.add("dragTopView");
				elm.classList.remove("dragFolderView");
				elm.classList.remove("dragBottomView");
			} else if (height - event.offsetY < 0.3 * 48) {
				elm.classList.remove("dragTopView");
				elm.classList.remove("dragFolderView");
				elm.classList.add("dragBottomView");
			} else {
				elm.classList.remove("dragTopView");
				elm.classList.remove("dragBottomView");
				if (thingy instanceof Guild && (!(thing instanceof Guild) || !guildWithin(thing))) {
					elm.classList.add("dragFolderView");
				}
			}
			event.preventDefault();
		});
		elm.addEventListener("dragleave", () => {
			elm.classList.remove("dragFolderView");
			elm.classList.remove("dragTopView");
			elm.classList.remove("dragBottomView");
		});
		elm.addEventListener("drop", async (event) => {
			event.stopImmediatePropagation();
			if (!this.dragged) return;
			const drag = this.dragged;
			const thingy = this.dragMap.get(this.dragged);
			if (!thingy) return;
			elm.classList.remove("dragFolderView");
			elm.classList.remove("dragTopView");
			elm.classList.remove("dragBottomView");

			if (!(thingy instanceof Guild) && guildWithin(thing as Guild)) return;
			if (this.dragged === elm) return;

			const height = elm.getBoundingClientRect().height;
			let arr = this.guildOrder;
			console.warn(arr === this.guildOrder);
			let found = arr.find((elm) => {
				if (elm === thing) {
					return true;
				}
				if (!(elm instanceof Guild) && elm.guilds.find((_) => _ === thing)) {
					return true;
				}
				return false;
			});
			if (found && "guilds" in found && found !== thing) arr = found.guilds;
			console.warn(arr === this.guildOrder);
			const removeThingy = (thing = thingy) => {
				const index = this.guildOrder.indexOf(thing);
				if (-1 !== index) this.guildOrder.splice(index, 1);
				this.guildOrder.forEach((_) => {
					if (!(_ instanceof Guild)) {
						const index = _.guilds.indexOf(thing as Guild);
						if (-1 !== index) _.guilds.splice(index, 1);
					}
				});
			};
			console.log(arr, found);
			if (event.offsetY < 0.3 * 48) {
				removeThingy();
				elm.before(this.dragged);
				const index = arr.indexOf(thing);
				arr.splice(index, 0, thingy);
			} else if (height - event.offsetY < 0.3 * 48) {
				removeThingy();
				elm.after(this.dragged);
				arr.splice(arr.indexOf(thing) + 1, 0, thingy);
			} else if (thingy instanceof Guild && (!(thing instanceof Guild) || !guildWithin(thing))) {
				if (thing instanceof Guild) {
					await new Promise<void>((res) => {
						const dia = new Dialog(I18n.folder.create());
						const opt = dia.options;
						const color = opt.addColorInput(I18n.folder.color(), () => {});
						const name = opt.addTextInput(I18n.folder.name(), () => {});
						opt.addButtonInput("", I18n.submit(), () => {
							removeThingy();

							let id = 1;
							while (this.guildOrder.find((_) => _.id === id)) {
								id++;
							}
							const folder = {
								color: +("0x" + (color.value || "#0").split("#")[1]),
								name: name.value,
								guilds: [thing, thingy],
								id,
							};

							this.guildOrder.splice(this.guildOrder.indexOf(thing), 1, folder);
							const hold = document.createElement("hr");
							elm.after(hold);
							hold.after(
								this.makeFolder(
									folder,
									new Map([
										[thing, elm],
										[thingy, drag],
									]),
								),
							);
							hold.remove();

							dia.hide();
							res();
						});
						dia.show();
					});
				} else {
					removeThingy();
					thing.guilds.push(thingy);
					elm.append(drag);
				}
			}
			console.log(this.guildOrder);
			this.guildOrder = this.guildOrder.filter((folder) => {
				if (folder instanceof Guild) return true;
				if (folder.guilds.length === 0) {
					const servers = document.getElementById("servers");
					if (servers)
						Array.from(servers.children).forEach((_) => {
							const html = _ as HTMLElement;
							if (this.dragMap.get(html) === folder) html.remove();
						});
					return false;
				}
				return true;
			});
			await this.saveGuildOrder();
		});
	}
	async saveGuildOrder() {
		const guild_folders: guildFolder[] = this.guildOrder.map((elm) => {
			if (elm instanceof Guild) {
				return {
					id: null,
					name: null,
					guild_ids: [elm.id],
					color: null,
				};
			} else {
				return {
					id: elm.id,
					name: elm.name,
					guild_ids: elm.guilds.map((guild) => guild.id),
					color: elm.color,
				};
			}
		});

		await fetch(this.info.api + "/users/@me/settings", {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify({guild_folders}),
		});
	}
	makeGuildIcon(guild: Guild) {
		const divy = guild.generateGuildIcon();
		guild.HTMLicon = divy;
		this.makeGuildDragable(divy, guild);
		return divy;
	}
	makeFolder(
		folder: {color?: number | null; id: number; name: string; guilds: Guild[]},
		icons = new Map<Guild, HTMLElement | undefined>(),
	) {
		const folderDiv = document.createElement("div");
		folderDiv.classList.add("folder-div");
		const iconDiv = document.createElement("div");
		iconDiv.classList.add("folder-icon-div");
		const icon = document.createElement("span");
		icon.classList.add("svg-folder");

		const menu = new Contextmenu<void, void>("");
		menu.addButton(I18n.folder.edit(), () => {
			const dio = new Dialog(I18n.folder.edit());
			const opt = dio.options;
			const name = opt.addTextInput(I18n.folder.name(), () => {}, {
				initText: folder.name,
			});
			const color = opt.addColorInput(I18n.folder.color(), () => {}, {
				initColor: "#" + (folder.color || 0).toString(16),
			});
			opt.addButtonInput("", I18n.submit(), async () => {
				folder.name = name.value;
				folder.color = +("0x" + (color.value || "#0").split("#")[1]);
				icon.style.setProperty("--folder-color", "#" + folder.color.toString(16).padStart(6, "0"));
				if (!folder.color) icon.style.removeProperty("--folder-color");
				await this.saveGuildOrder();
				dio.hide();
			});
			dio.show();
		});

		menu.bindContextmenu(iconDiv);
		if (folder.color !== null && folder.color !== undefined) {
			icon.style.setProperty("--folder-color", "#" + folder.color.toString(16).padStart(6, "0"));
			if (!folder.color) icon.style.removeProperty("--folder-color");
		}
		iconDiv.append(icon);
		const divy = document.createElement("div");
		divy.append(
			...folder.guilds.map((guild) => {
				const icon = icons.get(guild);
				if (icon) return icon;
				return this.makeGuildIcon(guild);
			}),
		);
		divy.classList.add("guilds-div-folder");
		folderDiv.append(iconDiv, divy);
		let height = -1;
		const toggle = async (fast = false) => {
			if (height === -1) {
				divy.style.overflow = "clip";
				height = divy.getBoundingClientRect().height;
				divy.style.height = height + "px";
				await new Promise((res) => requestAnimationFrame(res));
				divy.style.height = "0px";
				this.perminfo.folderStates[folder.id].state = true;
			} else {
				divy.style.height = height + "px";
				if (!fast) await new Promise((res) => setTimeout(res, 200));
				divy.style.height = "unset";
				height = -1;
				divy.style.overflow = "unset";
				this.perminfo.folderStates[folder.id].state = false;
			}
		};
		iconDiv.onclick = () => toggle();
		this.perminfo.folderStates ??= {};
		this.perminfo.folderStates[folder.id] ??= {};
		if (this.perminfo.folderStates[folder.id].state === true) {
			toggle(true);
		}
		this.makeGuildDragable(folderDiv, folder);
		return folderDiv;
	}
	guildOrder: (
		| Guild
		| {
				guilds: Guild[];
				color?: number | null;
				name: string;
				id: number;
		  }
	)[] = [];
	buildservers(): void {
		const serverlist = document.getElementById("servers") as HTMLDivElement; //
		const outdiv = document.createElement("div");
		const home: any = document.createElement("span");
		const div = document.createElement("div");
		div.classList.add("home", "servericon");

		home.classList.add("svgicon", "svg-home");
		(this.guildids.get("@me") as Guild).html = outdiv;
		const unread = document.createElement("div");
		unread.classList.add("unread");
		outdiv.append(unread);
		outdiv.append(div);
		div.appendChild(home);

		outdiv.classList.add("servernoti");
		serverlist.append(outdiv);
		home.onclick = () => {
			const guild = this.guildids.get("@me");
			if (!guild) return;
			guild.loadGuild();
			guild.loadChannel();
		};
		const sentdms = document.createElement("div");
		sentdms.classList.add("sentdms");
		serverlist.append(sentdms);
		sentdms.id = "sentdms";

		const br = document.createElement("hr");
		br.classList.add("lightbr");
		serverlist.appendChild(br);
		const guilds = new Set(this.guilds);
		const dirrect = this.guilds.find((_) => _ instanceof Direct) as Direct;

		guilds.delete(dirrect);
		const folders = this.guildFolders
			.map((folder) => {
				return {
					guilds: folder.guild_ids
						.map((id) => {
							const guild = this.guildids.get(id);
							if (!guild) {
								console.error(`guild ${id} does not exist`);
								return;
							}
							if (!guilds.has(guild)) {
								console.error(`guild ${id} is already in a folder`);
								return;
							}
							guilds.delete(guild);
							return guild;
						})
						.filter((_) => _ !== undefined),
					color: folder.color,
					name: folder.name || "",
					id: folder.id || 0,
				};
			})
			.filter((_) => {
				if (_.guilds.length === 0) {
					console.error("empty folder depected");
					return false;
				}
				return true;
			})
			.map((folder) => {
				if (!folder.id && folder.guilds.length === 1) {
					return folder.guilds[0];
				}
				return folder;
			});
		const guildOrder = [...guilds, ...folders];
		this.guildOrder = guildOrder;
		for (const thing of guildOrder) {
			if (thing instanceof Guild) {
				serverlist.append(this.makeGuildIcon(thing));
			} else {
				const folderDiv = this.makeFolder(thing);
				serverlist.append(folderDiv);
			}
		}

		{
			const br = document.createElement("hr");
			br.classList.add("lightbr");
			serverlist.appendChild(br);
			br.id = "bottomseparator";

			const div = document.createElement("div");
			const plus = document.createElement("span");
			plus.classList.add("svgicon", "svg-plus");
			div.classList.add("home", "servericon");
			div.appendChild(plus);
			serverlist.appendChild(div);
			div.onclick = (_) => {
				this.createGuild();
			};
			const guilddsdiv = document.createElement("div");
			const guildDiscoveryContainer = document.createElement("span");
			guildDiscoveryContainer.classList.add("svgicon", "svg-explore");
			guilddsdiv.classList.add("home", "servericon");
			guilddsdiv.appendChild(guildDiscoveryContainer);
			serverlist.appendChild(guilddsdiv);
			guildDiscoveryContainer.addEventListener("click", () => {
				this.guildDiscovery();
			});
		}
		this.unreads();
		dirrect.unreaddms();
	}
	passTemplateID(id: string) {
		this.createGuild(id);
	}
	createGuild(templateID?: string) {
		const full = new Dialog("");
		const buttons = full.options.addButtons("", {top: true});
		const viacode = buttons.add(I18n.invite.joinUsing());
		{
			const form = viacode.addForm("", async (e: any) => {
				let parsed = "";
				if (e.code.includes("/")) {
					parsed = e.code.split("/")[e.code.split("/").length - 1];
				} else {
					parsed = e.code;
				}
				const json = await (
					await fetch(this.info.api + "/invites/" + parsed, {
						method: "POST",
						headers: this.headers,
					})
				).json();
				if (json.message) {
					throw new FormError(text, json.message);
				}
				full.hide();
			});
			const text = form.addTextInput(I18n.invite.inviteLinkCode(), "code");
		}
		const guildcreate = buttons.add(I18n.guild.create());
		{
			const form = guildcreate.addForm("", (fields: any) => {
				this.makeGuild(fields).then((_) => {
					if (_.message) {
						loading.hide();
						full.show();
						alert(_.errors.name._errors[0].message);
					} else {
						loading.hide();
						full.hide();
					}
				});
			});
			form.addImageInput(I18n.guild["icon:"](), "icon", {
				clear: true,
			});
			form.addTextInput(I18n.guild["name:"](), "name", {required: true});
			const loading = new Dialog("");
			loading.float.options.addTitle(I18n.guild.creating());
			form.onFormError = () => {
				loading.hide();
				full.show();
			};
			form.addPreprocessor(() => {
				loading.show();
				full.hide();
			});
		}
		const guildcreateFromTemplate = buttons.add(I18n.guild.createFromTemplate());
		{
			const form = guildcreateFromTemplate.addForm(
				"",
				(_: any) => {
					if (_.message) {
						loading.hide();
						full.show();
						alert(_.message);
						const htmlarea = buttons.htmlarea.deref();
						if (htmlarea) buttons.generateHTMLArea(guildcreateFromTemplate, htmlarea);
					} else {
						loading.hide();
						full.hide();
					}
				},
				{
					method: "POST",
					headers: this.headers,
				},
			);
			const template = form.addTextInput(I18n.guild.template(), "template", {
				initText: templateID || "",
			});
			form.addImageInput(I18n.guild["icon:"](), "icon", {files: "one", clear: true});
			form.addTextInput(I18n.guild["name:"](), "name", {required: true});

			const loading = new Dialog("");
			loading.float.options.addTitle(I18n.guild.creating());
			form.onFormError = () => {
				loading.hide();
				full.show();
			};
			form.addPreprocessor((e) => {
				loading.show();
				full.hide();
				if ("template" in e) delete e.template;
				let code: string;
				if (URL.canParse(template.value)) {
					const url = new URL(template.value);
					code = url.pathname.split("/").at(-1) as string;
					if (url.host === "discord.com") {
						code = "discord:" + code;
					}
				} else {
					code = template.value;
				}
				form.fetchURL = this.info.api + "/guilds/templates/" + code;
			});
		}
		full.show();
		if (templateID) {
			const htmlarea = buttons.htmlarea.deref();
			if (htmlarea) buttons.generateHTMLArea(guildcreateFromTemplate, htmlarea);
		}
	}
	async makeGuild(fields: {name: string; icon: string | null}) {
		return await (
			await fetch(this.info.api + "/guilds", {
				method: "POST",
				headers: this.headers,
				body: JSON.stringify(fields),
			})
		).json();
	}
	async guildDiscovery() {
		this.guildids.get("@me")?.loadChannel("discover");
	}
	messageCreate(messagep: messageCreateJson): void {
		messagep.d.guild_id ??= "@me";
		const channel = this.channelids.get(messagep.d.channel_id);
		if (channel) {
			channel.messageCreate(messagep);
			this.unreads();
		}
	}
	unreads(): void {
		for (const thing of this.guilds) {
			if (thing.id === "@me") {
				thing.unreads();
				continue;
			}
			const html = this.guildhtml.get(thing.id);
			thing.unreads(html);
		}
	}
	static favC = document.createElement("canvas");
	static favCTX = this.favC.getContext("2d") as CanvasRenderingContext2D;
	static favImg = this.getFaviconImg();
	static getFaviconImg() {
		const img = document.createElement("img");
		img.src = "/logo.webp";
		return img;
	}
	last = "-1";
	generateFavicon() {
		const make = () => {
			const favicon = document.getElementById("favicon") as HTMLLinkElement;

			let text = this.totalMentions() + "";
			if (this.last === text) return;
			this.last = text;
			if (text === "0") {
				favicon.href = "/favicon.ico";
				return;
			}
			if (+text > 99) text = "+99";

			const c = Localuser.favC;
			c.width = 256;
			c.height = 256;
			const ctx = Localuser.favCTX;
			ctx.drawImage(Localuser.favImg, 0, 0, c.width, c.height);
			ctx.fillStyle = "#F00";
			const pos = 0.675;

			ctx.beginPath();
			ctx.arc(c.width * pos, c.height * pos, c.width * (1 - pos), 0, 2 * Math.PI);
			ctx.fill();

			ctx.fillStyle = "#FFF";

			ctx.font = `bolder ${text.length === 1 ? 150 : 100}px sans-serif`;

			const messure = ctx.measureText(text);
			const height = messure.fontBoundingBoxAscent + messure.fontBoundingBoxDescent;
			ctx.fillText(text, c.width * pos - messure.width / 2, c.height * pos + height / 2 - 25);

			favicon.href = c.toDataURL("image/x-icon");
		};
		if (Localuser.favImg.complete) {
			make();
		}
		Localuser.favImg.onload = () => {
			make();
		};
	}
	totalMentions() {
		let sum = 0;
		for (const guild of this.guilds) {
			sum += guild.mentions;
		}
		for (const channel of (this.guildids.get("@me") as Direct).channels) {
			sum += channel.mentions;
		}
		return sum;
	}
	async typingStart(typing: startTypingjson): Promise<void> {
		const channel = this.channelids.get(typing.d.channel_id);
		if (!channel) return;
		channel.typingStart(typing);
	}
	updatepfp(file: Blob): void {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			fetch(this.info.api + "/users/@me", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					avatar: reader.result,
				}),
			});
		};
	}
	updatebanner(file: Blob | null): void {
		if (file) {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				fetch(this.info.api + "/users/@me", {
					method: "PATCH",
					headers: this.headers,
					body: JSON.stringify({
						banner: reader.result,
					}),
				});
			};
		} else {
			fetch(this.info.api + "/users/@me", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					banner: null,
				}),
			});
		}
	}
	updateProfile(json: {bio?: string; pronouns?: string; accent_color?: number}) {
		fetch(this.info.api + "/users/@me/profile", {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify(json),
		});
	}
	async getPosts() {
		return (await (await fetch("https://blog.fermi.chat/feed_json_created.json")).json()) as {
			items: {
				url: string;
				title: string;
				content_html: string;
				image: null | string;
			}[];
		};
	}
	async showusersettings() {
		const settings = new Settings(I18n.localuser.settings());
		{
			const userOptions = settings.addButton(I18n.localuser.userSettings(), {
				ltr: true,
			});
			const hypotheticalProfile = document.createElement("div");
			let file: undefined | File | null;
			let newpronouns: string | undefined;
			let newbio: string | undefined;
			const hypouser = this.user.clone();
			let color: string;
			async function regen() {
				hypotheticalProfile.textContent = "";
				const hypoprofile = await hypouser.buildprofile(-1, -1);

				hypotheticalProfile.appendChild(hypoprofile);
			}
			regen();
			const settingsLeft = userOptions.addOptions("");
			const settingsRight = userOptions.addOptions("");
			settingsRight.addHTMLArea(hypotheticalProfile);

			const finput = settingsLeft.addImageInput(
				I18n.uploadPfp(),
				(_) => {
					if (file) {
						this.updatepfp(file);
					}
				},
				{clear: true, initImg: this.user.getpfpsrc()},
			);
			finput.watchForChange((_) => {
				if (!_) {
					file = null;
					hypouser.avatar = null;
					hypouser.hypotheticalpfp = true;
					regen();
					return;
				}
				if (_.length) {
					file = _[0];
					const blob = URL.createObjectURL(file);
					hypouser.avatar = blob;
					hypouser.hypotheticalpfp = true;
					regen();
				}
			});
			let bfile: undefined | File | null;
			const binput = settingsLeft.addImageInput(
				I18n.uploadBanner(),
				(_) => {
					if (bfile !== undefined) {
						this.updatebanner(bfile);
					}
				},
				{
					clear: true,
					width: 96 * 3,
					initImg: this.user.banner ? this.user.getBannerUrl() : "",
					objectFit: "cover",
				},
			);
			binput.watchForChange((_) => {
				if (!_) {
					bfile = null;
					hypouser.banner = undefined;
					hypouser.hypotheticalbanner = true;
					regen();
					return;
				}
				if (_.length) {
					bfile = _[0];
					const blob = URL.createObjectURL(bfile);
					hypouser.banner = blob;
					hypouser.hypotheticalbanner = true;
					regen();
				}
			});
			let changed = false;
			const pronounbox = settingsLeft.addTextInput(
				I18n.pronouns(),
				(_) => {
					if (newpronouns !== undefined || newbio !== undefined || changed !== undefined) {
						this.updateProfile({
							pronouns: newpronouns,
							bio: newbio,
							accent_color: Number.parseInt("0x" + color.substring(1), 16),
						});
					}
				},
				{initText: this.user.pronouns},
			);
			pronounbox.watchForChange((_) => {
				hypouser.pronouns = _;
				newpronouns = _;
				regen();
			});
			const bioBox = settingsLeft.addMDInput(I18n.bio(), (_) => {}, {
				initText: this.user.bio.rawString,
			});
			bioBox.watchForChange((_) => {
				newbio = _;
				hypouser.bio = new MarkDown(_, this);
				regen();
			});

			if (this.user.accent_color) {
				color = "#" + this.user.accent_color.toString(16);
			} else {
				color = "transparent";
			}
			const colorPicker = settingsLeft.addColorInput(I18n.profileColor(), (_) => {}, {
				initColor: color,
			});

			colorPicker.watchForChange((_) => {
				console.log();
				color = _;
				hypouser.accent_color = Number.parseInt("0x" + _.substring(1), 16);
				changed = true;
				regen();
			});
		}
		{
			const tas = settings.addButton(I18n.localuser.themesAndSounds());
			{
				const themes = ["Dark", "WHITE", "Light", "Dark-Accent"];
				tas.addSelect(
					I18n.localuser["theme:"](),
					(_) => {
						localStorage.setItem("theme", themes[_]);
						setTheme();
					},
					themes,
					{
						defaultIndex: themes.indexOf(localStorage.getItem("theme") as string),
					},
				);
			}
			{
				const initArea = (index: number) => {
					if (index === sounds.length - 1) {
						const input = document.createElement("input");
						input.type = "file";
						input.accept = "audio/*";
						input.addEventListener("change", () => {
							if (input.files?.length === 1) {
								const file = input.files[0];

								let reader = new FileReader();
								reader.onload = () => {
									let dataUrl = reader.result;
									if (typeof dataUrl !== "string") return;
									this.perminfo.sound = {};
									try {
										this.perminfo.sound.cSound = dataUrl;
										console.log(this.perminfo.sound.cSound);
										this.playSound("custom");
									} catch (_) {
										alert(I18n.localuser.soundTooLarge());
									}
								};
								reader.readAsDataURL(file);
							}
						});
						area.append(input);
					} else {
						area.innerHTML = "";
					}
				};
				const sounds = [...(this.play?.tracks || []), I18n.localuser.customSound()];
				const initIndex = sounds.indexOf(this.getNotificationSound());
				const select = tas.addSelect(
					I18n.localuser.notisound(),
					(index) => {
						this.setNotificationSound(sounds[index]);
					},
					sounds,
					{defaultIndex: initIndex},
				);
				select.watchForChange((index) => {
					initArea(index);
					this.playSound(sounds[index]);
				});
				const input = document.createElement("input");
				input.type = "range";
				input.value = this.getNotiVolume() + "";
				input.min = "0";
				input.max = "100";
				input.onchange = () => {
					this.setNotificationVolume(+input.value);
					this.playSound(sounds[select.index]);
				};

				const area = document.createElement("div");
				initArea(initIndex);
				tas.addHTMLArea(area);
				tas.addText(I18n.notiVolume());
				tas.addHTMLArea(input);
			}

			{
				let userinfos = getBulkInfo();
				tas.addColorInput(
					I18n.localuser.accentColor(),
					(_) => {
						userinfos = getBulkInfo();
						userinfos.accent_color = _;
						localStorage.setItem("userinfos", JSON.stringify(userinfos));
						document.documentElement.style.setProperty("--accent-color", userinfos.accent_color);
					},
					{initColor: userinfos.accent_color},
				);
			}
			{
				const options = [[null, I18n.noEmojiFont()], ...Localuser.fonts] as const;
				const cur = localStorage.getItem("emoji-font");
				let index = options.findIndex((_) => _[1] == cur);
				if (index === -1) index = 0;
				tas.addSelect(
					I18n.emojiSelect(),
					(index) => {
						if (options[index][0]) {
							localStorage.setItem("emoji-font", options[index][1]);
						} else {
							localStorage.removeItem("emoji-font");
						}
						Localuser.loadFont();
					},
					options.map((font) => font[1]),
					{
						defaultIndex: index,
					},
				);
			}
		}
		{
			const update = settings.addButton(I18n.localuser.updateSettings());
			let index = ["false", "offlineOnly", "true"].indexOf(
				localStorage.getItem("SWMode") as string,
			);
			if (index === -1) {
				index = 2;
			}
			const sw = update.addSelect(
				I18n.localuser.swSettings(),
				() => {},
				(["SWOff", "SWOffline", "SWOn"] as const).map((e) => I18n.localuser[e]()),
				{
					defaultIndex: index,
				},
			);
			sw.onchange = (e) => {
				SW.setMode((["false", "offlineOnly", "true"] as const)[e]);
			};
			update.addButtonInput("", I18n.localuser.CheckUpdate(), async () => {
				const update = await SW.checkUpdates();
				const text = update ? I18n.localuser.updatesYay() : I18n.localuser.noUpdates();
				const d = new Dialog("");
				d.options.addTitle(text);
				if (update) {
					d.options.addButtonInput("", I18n.localuser.refreshPage(), () => {
						window.location.reload();
					});
				}
				d.show();
			});
			update.addButtonInput("", I18n.localuser.clearCache(), () => {
				SW.forceClear();
			});
		}
		{
			const security = settings.addButton(I18n.localuser.accountSettings());
			const genSecurity = () => {
				security.removeAll();
				if (this.mfa_enabled) {
					security.addButtonInput("", I18n.localuser["2faDisable"](), () => {
						const form = security.addSubForm(
							I18n.localuser["2faDisable"](),
							(_: any) => {
								if (_.message) {
									switch (_.code) {
										case 60008:
											form.error("code", I18n.localuser.badCode());
											break;
									}
								} else {
									this.mfa_enabled = false;
									security.returnFromSub();
									genSecurity();
								}
							},
							{
								fetchURL: this.info.api + "/users/@me/mfa/totp/disable",
								headers: this.headers,
							},
						);
						form.addTextInput(I18n.localuser["2faCode:"](), "code", {required: true});
					});
				} else {
					security.addButtonInput("", I18n.localuser["2faEnable"](), async () => {
						let secret = "";
						for (let i = 0; i < 18; i++) {
							secret += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)];
						}
						const form = security.addSubForm(
							I18n.localuser.setUp2fa(),
							(_: any) => {
								if (_.message) {
									switch (_.code) {
										case 60008:
											form.error("code", I18n.localuser.badCode());
											break;
										case 400:
											form.error("password", I18n.localuser.badPassword());
											break;
									}
								} else {
									genSecurity();
									this.mfa_enabled = true;
									security.returnFromSub();
								}
							},
							{
								fetchURL: this.info.api + "/users/@me/mfa/totp/enable/",
								headers: this.headers,
							},
						);
						form.addTitle(I18n.localuser.setUp2faInstruction());
						form.addText(I18n.localuser["2faCodeGive"](secret));
						form.addTextInput(I18n.localuser["password:"](), "password", {
							required: true,
							password: true,
						});
						form.addTextInput(I18n.localuser["2faCode:"](), "code", {required: true});
						form.setValue("secret", secret);
					});
				}
				{
					security.addButtonInput("", I18n.webauth.manage(), () => {
						const keyMenu = security.addSubOptions("Manage Keys");
						const addKey = (key: {name: string; id: string}) => {
							keyMenu.addButtonInput("", key.name, () => {
								const opt = keyMenu.addSubOptions(key.name);
								const button = opt.addButtonInput("", I18n.delete(), async () => {
									await fetch(this.info.api + "/users/@me/mfa/webauthn/credentials/" + key.id, {
										headers: this.headers,
										method: "DELETE",
									});
									keyMenu.returnFromSub();
									keyMenu.deleteElm(button);
								});
							});
						};
						keyMenu.addButtonInput("", I18n.webauth.addKey(), () => {
							const form = keyMenu.addSubForm(
								I18n.webauth.addKey(),
								async (obj) => {
									const body = obj as {ticket: string; challenge: string};
									const challenge = JSON.parse(body.challenge)
										.publicKey as PublicKeyCredentialCreationOptionsJSON;
									console.log(challenge.challenge);
									challenge.challenge = challenge.challenge
										.split("=")[0]
										.replaceAll("+", "-")
										.replaceAll("/", "_");
									console.log(challenge.challenge);
									const options = PublicKeyCredential.parseCreationOptionsFromJSON(challenge);
									const credential = (await navigator.credentials.create({
										publicKey: options,
									})) as unknown as {
										rawId: ArrayBuffer;
										response: {
											attestationObject: ArrayBuffer;
											clientDataJSON: ArrayBuffer;
										};
									};
									if (!credential) return;
									function toBase64(buf: ArrayBuffer) {
										return btoa(String.fromCharCode(...new Uint8Array(buf)));
									}
									const res = {
										rawId: toBase64(credential.rawId),
										response: {
											clientDataJSON: toBase64(credential.response.clientDataJSON),
											attestationObject: toBase64(credential.response.attestationObject),
										},
									};
									const key = await (
										await fetch(this.info.api + "/users/@me/mfa/webauthn/credentials", {
											headers: this.headers,
											method: "POST",
											body: JSON.stringify({
												ticket: body.ticket,
												credential: JSON.stringify(res),
												name: name.value,
											}),
										})
									).json();
									addKey(key);
									keyMenu.returnFromSub();
								},
								{
									fetchURL: this.info.api + "/users/@me/mfa/webauthn/credentials",
									method: "POST",
									headers: this.headers,
									tfaCheck: false,
								},
							);
							form.addTextInput(I18n.htmlPages.pwField(), "password", {
								password: true,
							});
							const name = form.options.addTextInput(I18n.webauth.keyname(), () => {}, {
								initText: "Key",
							});
						});
						fetch(this.info.api + "/users/@me/mfa/webauthn/credentials", {
							headers: this.headers,
						})
							.then((_) => _.json())
							.then((keys: {id: string; name: string}[]) => {
								for (const key of keys) {
									addKey(key);
								}
							});
					});
				}
				security.addButtonInput("", I18n.localuser.changeDiscriminator(), () => {
					const form = security.addSubForm(
						I18n.localuser.changeDiscriminator(),
						(_) => {
							security.returnFromSub();
						},
						{
							fetchURL: this.info.api + "/users/@me/",
							headers: this.headers,
							method: "PATCH",
						},
					);
					form.addTextInput(I18n.localuser.newDiscriminator(), "discriminator");
				});
				security.addButtonInput("", I18n.localuser.changeEmail(), () => {
					const form = security.addSubForm(
						I18n.localuser.changeEmail(),
						(_) => {
							security.returnFromSub();
						},
						{
							fetchURL: this.info.api + "/users/@me/",
							headers: this.headers,
							method: "PATCH",
						},
					);
					form.addTextInput(I18n.localuser["password:"](), "password", {
						password: true,
					});
					if (this.mfa_enabled) {
						form.addTextInput(I18n.localuser["2faCode:"](), "code");
					}
					form.addTextInput(I18n.localuser["newEmail:"](), "email");
				});
				security.addButtonInput("", I18n.localuser.changeUsername(), () => {
					const form = security.addSubForm(
						I18n.localuser.changeUsername(),
						(_) => {
							security.returnFromSub();
						},
						{
							fetchURL: this.info.api + "/users/@me/",
							headers: this.headers,
							method: "PATCH",
						},
					);
					form.addTextInput(I18n.localuser["password:"](), "password", {
						password: true,
					});
					if (this.mfa_enabled) {
						form.addTextInput(I18n.localuser["2faCode:"](), "code");
					}
					form.addTextInput(I18n.localuser.newUsername(), "username");
				});
				security.addButtonInput("", I18n.localuser.changePassword(), () => {
					const form = security.addSubForm(
						I18n.localuser.changePassword(),
						(_) => {
							security.returnFromSub();
						},
						{
							fetchURL: this.info.api + "/users/@me/",
							headers: this.headers,
							method: "PATCH",
						},
					);
					form.addTextInput(I18n.localuser["oldPassword:"](), "password", {
						password: true,
					});
					if (this.mfa_enabled) {
						form.addTextInput(I18n.localuser["2faCode:"](), "code");
					}
					let in1 = "";
					let in2 = "";
					form
						.addTextInput(I18n.localuser["newPassword:"](), "", {password: true})
						.watchForChange((text) => {
							in1 = text;
						});
					const copy = form.addTextInput("New password again:", "", {password: true});
					copy.watchForChange((text) => {
						in2 = text;
					});
					form.setValue("new_password", () => {
						if (in1 === in2) {
							return in1;
						} else {
							throw new FormError(copy, I18n.localuser.PasswordsNoMatch());
						}
					});
				});

				security.addSelect(
					I18n.localuser.language(),
					(e) => {
						I18n.setLanguage(I18n.options()[e]);
						this.updateTranslations();
					},
					[...langmap.values()],
					{
						defaultIndex: I18n.options().indexOf(I18n.lang),
					},
				);

				{
					security.addButtonInput("", I18n.logout.logout(), async () => {
						if (await this.userinfo.logout()) {
							window.location.href = "/";
						}
					});
				}
			};
			genSecurity();
		}
		{
			const accessibility = settings.addButton(I18n.accessibility.name());
			accessibility.addCheckboxInput(
				I18n.accessibility.roleColors(),
				(t) => {
					console.log(t);
					this.perminfo.user.disableColors = !t;
				},
				{
					initState: !this.perminfo.user.disableColors,
				},
			);
			accessibility.addCheckboxInput(
				I18n.channel.allowIcons(),
				(t) => {
					console.log(t);
					this.perminfo.user.disableIcons = !t;
				},
				{
					initState: !this.perminfo.user.disableIcons,
				},
			);
			const gifSettings = ["hover", "always", "never"] as const;
			accessibility.addSelect(
				I18n.accessibility.playGif(),
				(i) => {
					localStorage.setItem("gifSetting", gifSettings[i]);
				},
				gifSettings.map((_) => I18n.accessibility.gifSettings[_]()),
				{
					defaultIndex:
						((gifSettings as readonly string[]).indexOf(
							localStorage.getItem("gifSetting") as string,
						) + 1 || 1) - 1,
				},
			);
			accessibility.addSelect(
				I18n.accessibility.playIcon(),
				(i) => {
					localStorage.setItem("iconSetting", gifSettings[i]);
				},
				gifSettings.map((_) => I18n.accessibility.gifSettings[_]()),
				{
					defaultIndex:
						((gifSettings as readonly string[]).indexOf(
							localStorage.getItem("iconSetting") as string,
						) + 1 || 1) - 1,
				},
			);
		}
		{
			const connections = settings.addButton(I18n.localuser.connections());
			const connectionContainer = document.createElement("div");
			connectionContainer.id = "connection-container";

			fetch(this.info.api + "/connections", {
				headers: this.headers,
			})
				.then((r) => r.json() as Promise<{[key: string]: {enabled: boolean}}>)
				.then((json) => {
					Object.keys(json)
						.sort((key) => (json[key].enabled ? -1 : 1))
						.forEach((key) => {
							const connection = json[key];

							const container = document.createElement("div");
							container.textContent = key.charAt(0).toUpperCase() + key.slice(1);

							if (connection.enabled) {
								container.addEventListener("click", async () => {
									const connectionRes = await fetch(
										this.info.api + "/connections/" + key + "/authorize",
										{
											headers: this.headers,
										},
									);
									const connectionJSON = await connectionRes.json();
									window.open(connectionJSON.url, "_blank", "noopener noreferrer");
								});
							} else {
								container.classList.add("disabled");
							}

							connectionContainer.appendChild(container);
						});
				});
			connections.addHTMLArea(connectionContainer);
		}
		{
			const devPortal = settings.addButton(I18n.localuser.devPortal());

			fetch(this.info.api + "/teams", {
				headers: this.headers,
			}).then(async (teamsRes) => {
				const teams = await teamsRes.json();

				const button = devPortal.addButtonInput("", I18n.localuser.createApp(), () => {
					const form = devPortal.addSubForm(
						I18n.localuser.createApp(),
						(json: any) => {
							if (json.message) form.error("name", json.message);
							else {
								devPortal.returnFromSub();
								this.manageApplication(json.id, devPortal, () => {
									form.options.deleteElm(button);
								});
							}
						},
						{
							fetchURL: this.info.api + "/applications",
							headers: this.headers,
							method: "POST",
						},
					);

					form.addTextInput("Name:", "name", {required: true});
					form.addSelect(
						I18n.localuser["team:"](),
						"team_id",
						["Personal", ...teams.map((team: {name: string}) => team.name)],
						{
							defaultIndex: 0,
						},
					);
				});

				const appListContainer = document.createElement("div");
				appListContainer.id = "app-list-container";
				fetch(this.info.api + "/applications", {
					headers: this.headers,
				})
					.then((r) => r.json())
					.then((json) => {
						json.forEach(
							(application: {
								cover_image: any;
								icon: any;
								id: string | undefined;
								name: string | number;
								bot: any;
							}) => {
								const container = document.createElement("div");

								if (application.cover_image || application.icon) {
									const cover = createImg(
										this.info.cdn +
											"/app-icons/" +
											application.id +
											"/" +
											(application.cover_image || application.icon) +
											".png?size=256",
									);
									cover.alt = "";
									cover.loading = "lazy";
									container.appendChild(cover);
								}

								const name = document.createElement("h2");
								name.textContent = application.name + (application.bot ? " (Bot)" : "");
								container.appendChild(name);

								container.addEventListener("click", async () => {
									this.manageApplication(application.id, devPortal, () => {
										appListContainer.remove();
									});
								});
								appListContainer.appendChild(container);
							},
						);
					});
				devPortal.addHTMLArea(appListContainer);
			});
		}

		{
			const manageSessions = settings.addButton(I18n.deviceManage.title());
			(async () => {
				const json = (await (
					await fetch(this.info.api + "/auth/sessions?extended=true", {headers: this.headers})
				).json()) as {user_sessions: expSessionJson[]};
				for (const session of json.user_sessions.sort(
					(a, b) => +new Date(a.last_seen) - +new Date(b.last_seen),
				)) {
					const div = document.createElement("div");
					div.classList.add("flexltr", "sessionDiv");

					const info = document.createElement("div");
					info.classList.add("flexttb");
					div.append(info);

					let line2 = "";
					const last = session.last_seen_location_info;
					if (last) {
						line2 += last.country_name;
						if (last.region) line2 += ", " + last.region;
						if (last.city) line2 += ", " + last.city;
					}
					if (line2) {
						line2 += " • ";
					}
					const format = new Intl.RelativeTimeFormat(I18n.lang, {style: "short"});
					const time = (Date.now() - +new Date(session.last_seen)) / 1000;
					if (time < 60) {
						line2 += format.format(-Math.floor(time), "seconds");
					} else if (time < 60 * 60) {
						line2 += format.format(-Math.floor(time / 60), "minutes");
					} else if (time < 60 * 60 * 24) {
						line2 += format.format(-Math.floor(time / 60 / 60), "hours");
					} else if (time < 60 * 60 * 24 * 7) {
						line2 += format.format(-Math.floor(time / 60 / 60 / 24), "days");
					} else if (time < 60 * 60 * 24 * 365) {
						line2 += format.format(-Math.floor(time / 60 / 60 / 24 / 7), "weeks");
					} else {
						line2 += format.format(-Math.floor(time / 60 / 60 / 24 / 365), "years");
					}
					const loc = document.createElement("span");
					loc.textContent = line2;
					info.append(loc);
					const r = manageSessions.addHTMLArea(div);
					div.onclick = () => {
						const sub = manageSessions.addSubOptions(I18n.deviceManage.manageDev());
						sub.addText(I18n.deviceManage.ip(session.last_seen_ip));
						sub.addText(I18n.deviceManage.last(session.approx_last_used_time));
						if (last) {
							sub.addText(I18n.deviceManage.estimateWarn());
							sub.addText(I18n.deviceManage.continent(last.continent_name));
							sub.addText(I18n.deviceManage.country(last.country_name));
							if (last.region) sub.addText(I18n.deviceManage.region(last.region));
							if (last.city) sub.addText(I18n.deviceManage.city(last.city));
							if (last.postal) sub.addText(I18n.deviceManage.postal(last.postal));
							sub.addText(I18n.deviceManage.longitude(last.longitude + ""));
							sub.addText(I18n.deviceManage.latitude(last.latitude + ""));
						}
						if (session.id !== this.session_id) {
							sub.addButtonInput("", I18n.deviceManage.logout(), () => {
								div.remove();
								r.html = document.createElement("div");
								manageSessions.returnFromSub();
								fetch(this.info.api + "/auth/sessions/logout", {
									method: "POST",
									headers: this.headers,
									body: JSON.stringify({
										session_id_hashes: [session.id_hash],
									}),
								});
							});
						} else sub.addText(I18n.deviceManage.curSes());
					};
				}
			})();
		}

		{
			const deleteAccount = settings.addButton(I18n.localuser.deleteAccount()).addForm(
				"",
				(e) => {
					if ("message" in e) {
						if (typeof e.message === "string") {
							throw new FormError(password, e.message);
						}
					} else {
						this.userinfo.remove();
						window.location.href = "/";
					}
				},
				{
					headers: this.headers,
					method: "POST",
					fetchURL: this.info.api + "/users/@me/delete/",
					traditionalSubmit: false,
					submitText: I18n.localuser.deleteAccountButton(),
				},
			);
			const shrek = deleteAccount.addTextInput(
				I18n.localuser.areYouSureDelete(I18n.localuser.sillyDeleteConfirmPhrase()),
				"shrek",
			);
			const password = deleteAccount.addTextInput(I18n.localuser["password:"](), "password", {
				password: true,
			});
			deleteAccount.addPreprocessor((obj) => {
				if ("shrek" in obj) {
					if (obj.shrek !== I18n.localuser.sillyDeleteConfirmPhrase()) {
						throw new FormError(shrek, I18n.localuser.mustTypePhrase());
					}
					delete obj.shrek;
				} else {
					throw new FormError(shrek, I18n.localuser.mustTypePhrase());
				}
			});
		}
		if (
			this.rights.hasPermission("OPERATOR") ||
			this.rights.hasPermission("CREATE_REGISTRATION_TOKENS")
		) {
			const manageInstance = settings.addButton(I18n.localuser.manageInstance());
			if (this.rights.hasPermission("OPERATOR")) {
				manageInstance.addButtonInput("", I18n.manageInstance.stop(), () => {
					const menu = new Dialog("");
					const options = menu.float.options;
					options.addTitle(I18n.manageInstance.AreYouSureStop());
					const yesno = options.addOptions("", {ltr: true});
					yesno.addButtonInput("", I18n.yes(), () => {
						fetch(this.info.api + "/stop", {headers: this.headers, method: "POST"});
						menu.hide();
					});
					yesno.addButtonInput("", I18n.no(), () => {
						menu.hide();
					});
					menu.show();
				});
			}
			if (this.rights.hasPermission("CREATE_REGISTRATION_TOKENS")) {
				manageInstance.addButtonInput("", I18n.manageInstance.createTokens(), () => {
					const tokens = manageInstance.addSubOptions(I18n.manageInstance.createTokens(), {
						noSubmit: true,
					});
					const count = tokens.addTextInput(I18n.manageInstance.count(), () => {}, {
						initText: "1",
					});
					const length = tokens.addTextInput(I18n.manageInstance.length(), () => {}, {
						initText: "32",
					});
					const format = tokens.addSelect(
						I18n.manageInstance.format(),
						() => {},
						[
							I18n.manageInstance.TokenFormats.JSON(),
							I18n.manageInstance.TokenFormats.plain(),
							I18n.manageInstance.TokenFormats.URLs(),
						],
						{
							defaultIndex: 2,
						},
					);
					format.watchForChange((e) => {
						if (e !== 2) {
							urlOption.removeAll();
						} else {
							makeURLMenu();
						}
					});
					const urlOption = tokens.addOptions("");
					const urlOptionsJSON = {
						url: window.location.origin,
						type: "Jank",
					};
					function makeURLMenu() {
						urlOption
							.addTextInput(I18n.manageInstance.clientURL(), () => {}, {
								initText: urlOptionsJSON.url,
							})
							.watchForChange((str) => {
								urlOptionsJSON.url = str;
							});
						urlOption
							.addSelect(
								I18n.manageInstance.regType(),
								() => {},
								["Jank", I18n.manageInstance.genericType()],
								{
									defaultIndex: ["Jank", "generic"].indexOf(urlOptionsJSON.type),
								},
							)
							.watchForChange((i) => {
								urlOptionsJSON.type = ["Jank", "generic"][i];
							});
					}
					makeURLMenu();
					tokens.addButtonInput("", I18n.manageInstance.create(), async () => {
						const params = new URLSearchParams();
						params.set("count", count.value);
						params.set("length", length.value);
						const json = (await (
							await fetch(
								this.info.api + "/auth/generate-registration-tokens?" + params.toString(),
								{
									headers: this.headers,
								},
							)
						).json()) as {tokens: string[]};
						if (format.index === 0) {
							pre.textContent = JSON.stringify(json.tokens);
						} else if (format.index === 1) {
							pre.textContent = json.tokens.join("\n");
						} else if (format.index === 2) {
							if (urlOptionsJSON.type === "Jank") {
								const options = new URLSearchParams();
								options.set("instance", this.info.wellknown);
								pre.textContent = json.tokens
									.map((token) => {
										options.set("token", token);
										return `${urlOptionsJSON.url}/register?` + options.toString();
									})
									.join("\n");
							} else {
								const options = new URLSearchParams();
								pre.textContent = json.tokens
									.map((token) => {
										options.set("token", token);
										return `${urlOptionsJSON.url}/register?` + options.toString();
									})
									.join("\n");
							}
						}
					});
					tokens.addButtonInput("", I18n.manageInstance.copy(), async () => {
						try {
							if (pre.textContent) {
								await navigator.clipboard.writeText(pre.textContent);
							}
						} catch (err) {
							console.error(err);
						}
					});
					const pre = document.createElement("pre");
					tokens.addHTMLArea(pre);
				});
			}
		}
		(async () => {
			const jankInfo = settings.addButton(I18n.jankInfo());
			const img = document.createElement("img");
			img.src = "/logo.svg";
			jankInfo.addHTMLArea(img);
			img.width = 128;
			img.height = 128;
			const ver = await (await fetch("/getupdates")).text();
			jankInfo.addMDText(
				new MarkDown(
					I18n.clientDesc(ver, window.location.origin, this.rights.allow + ""),
					undefined,
				),
			);
		})();
		const installP = installPGet();
		if (installP) {
			const c = settings.addButton(I18n.localuser.install());
			c.addText(I18n.localuser.installDesc());
			c.addButtonInput("", I18n.localuser.installJank(), async () => {
				//@ts-expect-error have to do this :3
				await installP.prompt();
			});
		}
		{
			const trusted = settings.addButton(I18n.localuser.trusted());
			trusted.addMDText(new MarkDown(I18n.localuser.trustedDesc()));
			for (const thing of MarkDown.trustedDomains) {
				const div = document.createElement("div");
				div.classList.add("flexltr", "trustedDomain");

				const name = document.createElement("span");
				name.textContent = thing;

				const remove = document.createElement("button");
				remove.textContent = I18n.remove();
				remove.onclick = () => {
					MarkDown.saveTrusted();
					MarkDown.trustedDomains.delete(thing);
					MarkDown.saveTrusted(true);
					div.remove();
				};

				div.append(name, remove);
				trusted.addHTMLArea(div);
			}
		}
		{
			const blog = settings.addButton(I18n.blog.blog());
			blog.addCheckboxInput(
				I18n.blog.blogUpdates(),
				(check) => {
					if (check) {
						localStorage.setItem("blogUpdates", "Yes");
					} else {
						localStorage.setItem("blogUpdates", "No");
					}
				},
				{initState: localStorage.getItem("blogUpdates") === "Yes"},
			);
			(async () => {
				const posts = await this.getPosts();
				for (const post of posts.items) {
					const div = document.createElement("div");
					div.classList.add("flexltr", "blogDiv");
					if (post.image) {
						//TODO handle this case, no blog posts currently do this
					}
					const titleStuff = document.createElement("div");
					titleStuff.classList.add("flexttb");

					const h2 = document.createElement("h2");
					h2.textContent = post.title;

					const p = document.createElement("p");
					p.textContent = post.content_html;
					titleStuff.append(h2, p);
					div.append(titleStuff);
					blog.addHTMLArea(div);
					MarkDown.safeLink(div, post.url);
				}
			})();
		}
		{
			const devSettings = settings.addButton(I18n.devSettings.name(), {noSubmit: true});
			devSettings.addText(I18n.devSettings.description());
			devSettings.addHR();
			const box1 = devSettings.addCheckboxInput(I18n.devSettings.logGateway(), () => {}, {
				initState: Boolean(localStorage.getItem("logGateway")),
			});
			box1.onchange = (e) => {
				if (e) {
					localStorage.setItem("logGateway", "true");
				} else {
					localStorage.removeItem("logGateway");
				}
			};
			const box2 = devSettings.addCheckboxInput(I18n.devSettings.badUser(), () => {}, {
				initState: Boolean(localStorage.getItem("logbad")),
			});
			box2.onchange = (e) => {
				if (e) {
					localStorage.setItem("logbad", "true");
				} else {
					localStorage.removeItem("logbad");
				}
			};

			const box3 = devSettings.addCheckboxInput(I18n.devSettings.traces(), () => {}, {
				initState: Boolean(localStorage.getItem("traces")),
			});
			box3.onchange = (e) => {
				if (e) {
					localStorage.setItem("traces", "true");
				} else {
					localStorage.removeItem("traces");
				}
			};
			const box4 = devSettings.addCheckboxInput(I18n.devSettings.cache(), () => {}, {
				initState: !!localStorage.getItem("isDev"),
			});
			box4.onchange = (e) => {
				if (e) {
					localStorage.setItem("isDev", "true");
				} else {
					localStorage.removeItem("isDev");
				}
				SW.postMessage({code: "isDev", dev: e});
			};
			devSettings.addText(I18n.devSettings.cacheDesc());

			const box5 = devSettings.addCheckboxInput(I18n.devSettings.captureTrace(), () => {}, {
				initState: !!localStorage.getItem("capTrace"),
			});
			box5.onchange = (e) => {
				if (e) {
					localStorage.setItem("capTrace", "true");
				} else {
					localStorage.removeItem("capTrace");
				}
				SW.traceInit();
			};

			const box6 = devSettings.addCheckboxInput(I18n.devSettings.gatewayComp(), () => {}, {
				initState: !!localStorage.getItem("gateWayComp"),
			});
			box6.onchange = (e) => {
				if (e) {
					localStorage.setItem("gateWayComp", "true");
				} else {
					localStorage.removeItem("gateWayComp");
				}
				SW.traceInit();
			};
		}
		if (this.trace.length && localStorage.getItem("traces")) {
			const traces = settings.addButton(I18n.localuser.trace(), {
				noSubmit: true,
			});
			const traceArr = this.trace;

			const sel = traces.addSelect(
				"",
				() => {},
				this.trace.map((_) =>
					I18n.trace.traces(
						_.trace[0],
						_.trace[1].micros / 1000 + "",
						_.time.getHours() + ":" + _.time.getMinutes(),
					),
				),
			);
			function generateTraceHTML(trace: trace, indent: number): HTMLElement {
				const div = document.createElement("div");
				div.classList.add("traceDiv", "flexttb");

				const head = document.createElement("div");
				div.append(head);

				const title = document.createElement("h3");
				title.textContent = I18n.trace.totalTime(trace[1].micros / 1000 + "", trace[0]);
				const indents = document.createElement("span");
				indents.classList.add("visually-hidden");
				indents.textContent = "  ".repeat(indent);
				title.prepend(indents);
				head.append(title);

				if (!trace[1].calls) return div;

				let objs: {name: string; val: traceObj}[] = [];
				{
					const names = trace[1].calls.filter((_) => typeof _ === "string");
					const vals = trace[1].calls.filter((_) => _ instanceof Object);
					let i = 0;
					for (const name of names) {
						const val = vals[i];
						objs.push({name, val});
						i++;
					}
				}

				const bars = document.createElement("div");
				bars.classList.add("flexltr", "traceBars");

				const colors = ["red", "orange", "yellow", "lime", "blue", "indigo", "violet"];
				let i = 0;
				for (const thing of objs) {
					const bar = document.createElement("div");
					bar.style.setProperty(
						"flex-grow",
						Math.ceil((thing.val.micros / trace[1].micros) * 1000) + "",
					);
					bar.style.setProperty("background", colors[i % colors.length]);
					bars.append(bar);
					new Hover(I18n.trace.totalTime(thing.val.micros / 1000 + "", thing.name)).addEvent(bar);
					i++;
				}
				const body = document.createElement("div");
				div.append(body);
				head.append(bars);
				let dropped = false;
				head.onclick = () => {
					if (!trace[1].calls) return;
					if (dropped) {
						dropped = false;
						body.innerHTML = "";
						return;
					}

					let i = 0;
					for (const obj of objs) {
						body.append(generateTraceHTML([obj.name, obj.val], indent + 1));
						i++;
					}
					dropped = true;
				};

				div.classList.add("dropDownTrace");
				head.classList.add("traceHead");
				return div;
			}
			const blank = document.createElement("div");
			traces.addHTMLArea(blank);
			const updateInfo = () => {
				const trace = traceArr[sel.index];
				blank.innerHTML = "";
				blank.append(generateTraceHTML(trace.trace, 0));
			};
			sel.onchange = () => {
				updateInfo();
			};
			updateInfo();
		}
		{
			const instanceInfo = settings.addButton(I18n.instanceInfo.name());
			fetch(this.info.api + "/policies/instance/")
				.then((_) => _.json())
				.then((body) => {
					const json = body as {
						instanceName: string;
						instanceDescription: string | null;
						frontPage: string | null;
						tosPage: string | null;
						correspondenceEmail: string | null;
						correspondenceUserID: string | null;
						image: string | null;
						instanceId: string;
						autoCreateBotUsers: false;
						publicUrl: string | null;
					};
					instanceInfo.addTitle(json.instanceName);
					if (json.correspondenceEmail) {
						const a = document.createElement("a");
						a.target = "_blank";
						a.rel = "noreferrer";
						a.href = "mailto:" + json.correspondenceEmail;
						a.textContent = I18n.instanceInfo.contact();
						instanceInfo.addHTMLArea(a);
					}
					if (json.tosPage)
						instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.tosPage(json.tosPage)));
					if (json.publicUrl)
						instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.publicUrl(json.publicUrl)));
					if (json.frontPage)
						instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.frontPage(json.frontPage)));
					instanceInfo.addButtonInput("", I18n.instInfo(), () => {
						this.instanceStats();
					});
				});
		}
		settings.show();
	}
	readonly botTokens: Map<string, string> = new Map();
	async manageApplication(appId = "", container: Options, deleteButton: () => void) {
		if (this.perminfo.applications) {
			for (const item of Object.keys(this.perminfo.applications)) {
				this.botTokens.set(item, this.perminfo.applications[item]);
			}
		}
		const res = await fetch(this.info.api + "/applications/" + appId, {
			headers: this.headers,
		});
		const json = await res.json();
		console.error(json);
		const form = container.addSubForm(json.name, () => {}, {
			fetchURL: this.info.api + "/applications/" + appId,
			method: "PATCH",
			headers: this.headers,
			traditionalSubmit: true,
		});
		form.addTextInput(I18n.localuser.appName(), "name", {initText: json.name});
		form.addMDInput(I18n.localuser.description(), "description", {
			initText: json.description,
		});
		form.addImageInput("Icon:", "icon", {
			clear: true,
			initImg: json.icon ? this.info.cdn + "/app-icons/" + appId + "/" + json.icon : "",
		});
		form.addTextInput(I18n.localuser.privacyPolcyURL(), "privacy_policy_url", {
			initText: json.privacy_policy_url,
		});
		form.addTextInput(I18n.localuser.TOSURL(), "terms_of_service_url", {
			initText: json.terms_of_service_url,
		});
		form.addCheckboxInput(I18n.localuser.publicAvaliable(), "bot_public", {
			initState: json.bot_public,
		});
		form.addCheckboxInput(I18n.localuser.requireCode(), "bot_require_code_grant", {
			initState: json.bot_require_code_grant,
		});
		form.addButtonInput("", I18n.localuser[json.bot ? "manageBot" : "addBot"](), async () => {
			if (!json.bot) {
				if (!confirm(I18n.localuser.confirmAddBot())) {
					return;
				}
				const updateRes = await fetch(this.info.api + "/applications/" + appId + "/bot", {
					method: "POST",
					headers: this.headers,
				});
				const updateJSON = await updateRes.json();
				this.botTokens.set(appId, updateJSON.token);
			}
			this.manageBot(appId, form);
		});
		form.addButtonInput("", I18n.applications.delete(), () => {
			const sub = form.addSubForm(
				I18n.applications.delete(),
				() => {
					deleteButton();
					container.returnFromSub();
				},
				{
					fetchURL: this.info.api + "/applications/" + appId + "/delete",
					method: "POST",
					headers: this.headers,
					submitText: I18n.delete(),
				},
			);
			sub.addText(I18n.applications.sure(json.name));
		});
	}
	async manageBot(appId = "", container: Form) {
		const res = await fetch(this.info.api + "/applications/" + appId, {
			headers: this.headers,
		});
		const json = await res.json();
		if (!json.bot) {
			return alert(I18n.localuser.confuseNoBot());
		}
		const bot: User = new User(json.bot, this);
		const form = container.addSubForm(
			I18n.localuser.editingBot(bot.username),
			(out) => {
				console.log(out);
			},
			{
				method: "PATCH",
				fetchURL: this.info.api + "/applications/" + appId + "/bot",
				headers: this.headers,
				traditionalSubmit: true,
			},
		);
		form.addTextInput(I18n.localuser.botUsername(), "username", {
			initText: bot.username,
		});
		form.addImageInput(I18n.localuser.botAvatar(), "avatar", {
			initImg: bot.getpfpsrc(),
			clear: true,
		});
		form.addButtonInput("", I18n.localuser.resetToken(), async () => {
			if (!confirm(I18n.localuser.confirmReset())) {
				return;
			}
			const updateRes = await fetch(this.info.api + "/applications/" + appId + "/bot/reset", {
				method: "POST",
				headers: this.headers,
			});
			const updateJSON = await updateRes.json();
			text.setText(I18n.localuser.tokenDisplay(updateJSON.token));
			this.botTokens.set(appId, updateJSON.token);
			if (this.perminfo.applications[appId]) {
				this.perminfo.applications[appId] = updateJSON.token;
			}
		});
		const text = form.addText(
			I18n.localuser.tokenDisplay(
				this.botTokens.has(appId) ? (this.botTokens.get(appId) as string) : "*****************",
			),
		);
		const check = form.addOptions("", {noSubmit: true});
		if (!this.perminfo.applications) {
			this.perminfo.applications = {};
		}
		const checkbox = check.addCheckboxInput(I18n.localuser.saveToken(), () => {}, {
			initState: !!this.perminfo.applications[appId],
		});
		checkbox.watchForChange((_) => {
			if (_) {
				if (this.botTokens.has(appId)) {
					this.perminfo.applications[appId] = this.botTokens.get(appId);
				} else {
					alert(I18n.localuser.noToken());
					checkbox.setState(false);
				}
			} else {
				delete this.perminfo.applications[appId];
			}
		});
		form.addButtonInput("", I18n.localuser.advancedBot(), () => {
			const token = this.botTokens.get(appId);
			if (token) {
				//TODO check if this is actually valid or not
				const botc = new Bot(bot as unknown as mainuserjson, token, this);
				botc.settings();
			}
		});
		form.addButtonInput("", I18n.localuser.botInviteCreate(), () => {
			Bot.InviteMaker(appId, form, this.info);
		});
	}
	//TODO make this an option
	readonly autofillregex = Object.freeze(/(^|\s|\n)[@#:]([a-zA-Z0-9]*)$/i);
	mdBox() {
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		const typeMd = typebox.markdown;
		typeMd.owner = this;
		typeMd.onUpdate = (str, pre) => {
			this.search(document.getElementById("searchOptions") as HTMLDivElement, typeMd, str, pre);
		};
	}
	async pinnedClick(rect: DOMRect) {
		if (!this.channelfocus) return;
		await this.channelfocus.pinnedClick(rect);
	}
	async makeStickerBox(rect: DOMRect) {
		const sticker = await Sticker.stickerPicker(
			-0 + rect.right - window.innerWidth,
			-20 + rect.top - window.innerHeight,
			this,
		);
		this.favorites.addStickerFreq(sticker.id);
		console.log(sticker);
		if (this.channelfocus) {
			this.channelfocus.sendMessage("", {
				embeds: [],
				attachments: [],
				sticker_ids: [sticker.id],
				replyingto: this.channelfocus.replyingto,
			});
			this.channelfocus.replyingto = null;
		}
	}

	async makeGifBox(rect: DOMRect) {
		interface fullgif {
			id: string;
			title: string;
			url: string;
			src: string;
			gif_src: string;
			width: number;
			height: number;
			preview: string;
		}
		const menu = document.createElement("div");
		menu.classList.add("flexttb", "gifmenu");
		menu.style.bottom = window.innerHeight - rect.top + 15 + "px";
		menu.style.right = window.innerWidth - rect.right + "px";
		document.body.append(menu);
		Contextmenu.keepOnScreen(menu);
		Contextmenu.declareMenu(menu);
		const trending = (await (
			await fetch(
				this.info.api + "/gifs/trending?" + new URLSearchParams([["locale", I18n.lang]]),
				{headers: this.headers},
			)
		).json()) as {
			categories: {
				name: string;
				src: string;
			}[];
			gifs: [fullgif];
		};
		const gifbox = document.createElement("div");
		gifbox.classList.add("gifbox");
		const search = document.createElement("input");
		let gifs = gifbox;
		const placeGifs = (
			gifs: HTMLDivElement,
			gifReturns: {src: string; width: number; height: number; title?: string}[],
		) => {
			const width = menu.getBoundingClientRect().width;
			let left = 0;
			let right = width < 370 ? Infinity : 0;
			console.warn(right, width);
			for (const gif of gifReturns) {
				const div = document.createElement("div");
				div.classList.add("gifBox");
				const img = createImg(gif.src);
				this.refreshIfNeeded(gif.src).then((url) => {
					if (url === gif.src) return;
					img.setSrcs(url);
				});
				if (gif.title) img.alt = gif.title;
				const scale = gif.width / 196;

				img.width = gif.width / scale;
				img.height = gif.height / scale;
				div.append(img);

				if (left <= right) {
					div.style.top = left + "px";
					left += Math.ceil(img.height) + 10;
					div.style.left = "5px";
				} else {
					div.style.top = right + "px";
					right += Math.ceil(img.height) + 10;
					div.style.left = "210px";
				}

				gifs.append(div);

				div.onclick = () => {
					if (this.channelfocus) {
						this.channelfocus.sendMessage(gif.src, {
							embeds: [],
							attachments: [],
							sticker_ids: [],
							replyingto: this.channelfocus.replyingto,
						});
						menu.remove();
						this.channelfocus.replyingto = null;
					}
				};
			}
			gifs.style.height = (right == Infinity ? left : Math.max(left, right)) + "px";
		};
		const searchBox = async () => {
			gifs.remove();
			if (search.value === "") {
				menu.append(gifbox);
				gifs = gifbox;
				return;
			}
			gifs = document.createElement("div");
			gifs.classList.add("gifbox");
			menu.append(gifs);
			const sValue = search.value;
			const gifReturns = (await (
				await fetch(
					this.info.api +
						"/gifs/search?" +
						new URLSearchParams([
							["locale", I18n.lang],
							["q", sValue],
							["limit", "500"],
						]),
					{headers: this.headers},
				)
			).json()) as fullgif[];
			if (sValue !== search.value) {
				return;
			}
			placeGifs(
				gifs,
				gifReturns.map((gif) => {
					return {src: gif.gif_src, width: gif.width, height: gif.height, title: gif.title};
				}),
			);
		};
		let last = "";
		search.onkeyup = () => {
			if (last === search.value) {
				return;
			}
			last = search.value;
			searchBox();
		};
		search.classList.add("searchGifBar");
		search.placeholder = I18n.searchGifs();
		const favs = this.favorites.favoriteGifs();
		if (favs.length) {
			favs.forEach(async (_) => (_.src = await this.refreshIfNeeded(_.src)));

			const div = document.createElement("div");
			div.classList.add("gifPreviewBox");
			const img = document.createElement("img");
			img.src = favs[0].src;
			img.src = await this.refreshIfNeeded(img.src);
			const title = document.createElement("span");
			title.textContent = I18n.favoriteGifs();
			div.append(img, title);
			gifbox.append(div);
			div.onclick = (e) => {
				e.stopImmediatePropagation();
				search.remove();
				gifs.remove();
				gifs = document.createElement("div");
				gifs.classList.add("gifbox");

				const div = document.createElement("div");
				div.classList.add("flexltr", "title");

				const back = document.createElement("span");
				back.classList.add("svg-leftArrow");
				back.onclick = (e) => {
					e.stopImmediatePropagation();
					div.remove();
					gifs.remove();
					gifs = gifbox;
					menu.append(search, gifbox);
				};

				const title = document.createElement("h3");
				title.textContent = I18n.favoriteGifs();
				div.append(back, title);

				menu.append(div, gifs);
				placeGifs(gifs, favs);
			};
		}
		for (const category of trending.categories) {
			const div = document.createElement("div");
			div.classList.add("gifPreviewBox");
			const img = document.createElement("img");
			img.src = category.src;
			const title = document.createElement("span");
			title.textContent = category.name;
			div.append(img, title);
			gifbox.append(div);
			div.onclick = (e) => {
				e.stopImmediatePropagation();
				search.value = category.name;
				searchBox();
			};
		}
		menu.append(search, gifbox);
		search.focus();
	}
	async TBEmojiMenu(rect: DOMRect) {
		const typebox = document.getElementById("typebox") as CustomHTMLDivElement;
		const p = saveCaretPosition(typebox);
		if (!p) return;
		const original = MarkDown.getText();

		const emoji = await Emoji.emojiPicker(
			-0 + rect.right - window.innerWidth,
			-20 + rect.top - window.innerHeight,
			this,
		);
		this.favorites.addEmoji(emoji.id || (emoji.emoji as string));
		p();
		const md = typebox.markdown;
		this.MDReplace(
			emoji.id
				? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
				: (emoji.emoji as string),
			original,
			md,
			null,
		);
	}
	MDReplace(
		replacewith: string,
		original: string,
		typebox: MarkDown,
		start: RegExp | null = this.autofillregex,
	) {
		let raw = typebox.rawString;
		let empty = raw.length === 0;
		raw = original !== "" ? raw.split(original)[1] : raw;
		if (raw === undefined && !empty) return;
		if (empty) {
			raw = "";
		}
		raw = (start ? original.replace(start, "") : original) + replacewith + raw;

		typebox.txt = raw.split("");
		const match = start ? original.match(start) : true;
		if (match) {
			typebox.boxupdate(
				replacewith.length - (match === true ? 0 : match[0].length),
				false,
				original.length,
			);
		}
	}
	fileExtange!: (
		files: Blob[],
		html: WeakMap<Blob, HTMLElement>,
	) => [Blob[], WeakMap<Blob, HTMLElement>];
	MDSearchOptions(
		options: (
			| [string, string, void | HTMLElement]
			| [string, string, void | HTMLElement, () => void | boolean]
		)[],
		original: string,
		div: HTMLDivElement = document.getElementById("searchOptions") as HTMLDivElement,
		typebox?: MarkDown,
	) {
		if (!div) return;
		div.innerHTML = "";
		let i = 0;
		const htmloptions: HTMLSpanElement[] = [];
		for (const [name, replace, elm, func] of options) {
			if (i == 8) {
				break;
			}
			i++;
			const span = document.createElement("span");
			htmloptions.push(span);
			if (elm) {
				span.append(elm);
			}

			span.append(name);
			span.onclick = (e) => {
				if (e) {
					if (replace) {
						const selection = window.getSelection() as Selection;
						const box = typebox?.box.deref();
						if (!box) return;
						if (selection) {
							const pos = getTextNodeAtPosition(
								box,
								original.length -
									(original.match(this.autofillregex) as RegExpMatchArray)[0].length +
									replace.length,
							);
							selection.removeAllRanges();
							const range = new Range();
							range.setStart(pos.node, pos.position);
							selection.addRange(range);
						}
						box.focus();
					}
					e.preventDefault();
				}
				if (!func?.() && typebox) {
					this.MDReplace(replace, original, typebox);
				}
				div.innerHTML = "";
				remove();
			};
			div.prepend(span);
		}
		const remove = () => {
			if (div && div.innerHTML === "") {
				this.keyup = () => false;
				this.keydown = () => {};
				return true;
			}
			return false;
		};
		if (htmloptions[0]) {
			let curindex = 0;
			let cur = htmloptions[0];
			cur.classList.add("selected");
			const cancel = new Set(["ArrowUp", "ArrowDown", "Enter", "Tab"]);
			this.keyup = (event) => {
				if (remove()) return false;

				if (cancel.has(event.key)) {
					switch (event.key) {
						case "ArrowUp":
							if (htmloptions[curindex + 1]) {
								cur.classList.remove("selected");
								curindex++;
								cur = htmloptions[curindex];
								cur.classList.add("selected");
							}
							break;
						case "ArrowDown":
							if (htmloptions[curindex - 1]) {
								cur.classList.remove("selected");
								curindex--;
								cur = htmloptions[curindex];
								cur.classList.add("selected");
							}
							break;
						case "Enter":
						case "Tab":
							cur.click();
							break;
					}
					return true;
				}
				return false;
			};
			this.keydown = (event) => {
				if (remove()) return;
				if (cancel.has(event.key)) {
					event.preventDefault();
				}
			};
		} else {
			remove();
		}
	}
	MDFindChannel(name: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		const maybe: [number, Channel][] = [];
		if (this.lookingguild && this.lookingguild.id !== "@me") {
			for (const channel of this.lookingguild.channels) {
				const confidence = channel.similar(name);
				if (confidence > 0) {
					maybe.push([confidence, channel]);
				}
			}
		}
		maybe.sort((a, b) => b[0] - a[0]);
		this.MDSearchOptions(
			maybe.map((a) => ["# " + a[1].name, `<#${a[1].id}> `, undefined]),
			original,
			box,
			typebox,
		);
	}
	MDFineMentionGen(name: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		let members: [Member | Role | User | "@everyone" | "@here", number][] = [];
		if (this.lookingguild && name !== "everyone" && name !== "here") {
			if (this.lookingguild.id === "@me") {
				const dirrect = this.channelfocus as Group;

				for (const user of dirrect.users) {
					const rank = user.compare(name);
					if (rank > 0) {
						members.push([user, rank]);
					}
				}
			} else {
				for (const member of this.lookingguild.members) {
					const rank = member.compare(name);
					if (rank > 0) {
						members.push([member, rank]);
					}
				}
				for (const role of this.lookingguild.roles.filter((_) => _.id !== this.lookingguild?.id)) {
					const rank = role.compare(name);
					if (rank > 0) {
						members.push([role, rank]);
					}
				}
			}
			function similar(str2: string | null | undefined) {
				if (!str2) return 0;
				const strl = Math.max(name.length, 1);
				if (str2.includes(name)) {
					return strl / str2.length;
				} else if (str2.toLowerCase().includes(name.toLowerCase())) {
					return strl / str2.length / 1.2;
				}
				return 0;
			}
			const everyoneScore = similar("everyone");
			if (everyoneScore) members.push(["@everyone", everyoneScore]);
			const hereScore = similar("here");
			if (hereScore) members.push(["@here", hereScore]);
		}
		members.sort((a, b) => b[1] - a[1]);
		this.MDSearchOptions(
			members.map((a) => [
				typeof a[0] === "string" ? a[0] : "@" + a[0].name,
				a[0] instanceof Role
					? `<@&${a[0].id}> `
					: typeof a[0] === "string"
						? a[0] + " "
						: `<@${a[0].id}> `,
				undefined,
			]),
			original,
			box,
			typebox,
		);
	}
	MDFindMention(name: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		if (this.ws && this.lookingguild) {
			this.MDFineMentionGen(name, original, box, typebox);
			if (this.lookingguild.member_count <= this.lookingguild.members.size) return;
			if (this.lookingguild.id !== "@me") {
				this.lookingguild.searchMembers(8, name).then(async () => {
					if (!typebox.rawString.startsWith(original)) return;
					this.MDFineMentionGen(name, original, box, typebox);
				});
			}
		}
	}
	findEmoji(search: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		const emj = Emoji.searchEmoji(search, this, 10);
		const map = emj.map(([emoji]): [string, string, HTMLElement, () => void] => {
			return [
				emoji.name,
				emoji.id
					? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
					: (emoji.emoji as string),
				emoji.getHTML(),
				() => {
					this.favorites.addEmoji(emoji.id || (emoji.emoji as string));
				},
			];
		});
		this.MDSearchOptions(map, original, box, typebox);
	}
	async findCommands(search: string, box: HTMLDivElement, md: MarkDown) {
		const guild = this.lookingguild;
		if (!guild) return;
		const commands = await guild.getCommands();
		const sorted = commands
			.map((_) => [_, _.similar(search)] as const)
			.filter((_) => _[1] !== 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		this.MDSearchOptions(
			sorted.map(([elm]) => {
				return [
					`/${elm.localizedName}`,
					"",
					undefined,
					() => {
						this.channelfocus?.startCommand(elm);
						return true;
					},
				] as const;
			}),
			"",
			box,
			md,
		);
		console.log(sorted, search);
	}
	search(box: HTMLDivElement, md: MarkDown, str: string, pre: boolean) {
		if (!pre) {
			const match = str.match(this.autofillregex);

			if (match) {
				const trim = match[0].trim();
				const [type, search] = [trim[0], trim.split(/@|#|:/)[1]];
				switch (type) {
					case "#":
						this.MDFindChannel(search, str, box, md);
						break;
					case "@":
						this.MDFindMention(search, str, box, md);
						break;
					case ":":
						if (search.length >= 2) {
							this.findEmoji(search, str, box, md);
						} else {
							this.MDSearchOptions([], "", box, md);
						}
						break;
					default:
						return;
				}
				return;
			}
			const command = str.match(/^\/((\s*[\w\d]+)*)$/);
			if (command) {
				const search = command[1];
				this.findCommands(search, box, md);
			}
		}
		box.innerHTML = "";
	}
	searching = false;
	updateTranslations() {
		const searchBox = document.getElementById("searchBox") as HTMLDivElement;
		searchBox.style.setProperty("--hint-text", JSON.stringify(I18n.search.search()));
	}
	curSearch?: Symbol;
	mSearch(query: string) {
		const searchy = Symbol("search");
		this.curSearch = searchy;
		const p = new URLSearchParams("?");
		this.searching = true;
		p.set("content", query.trim());
		p.set("sort_by", "timestamp");
		p.set("sort_order", "desc");
		let maxpage: undefined | number = undefined;
		const sideDiv = document.getElementById("sideDiv");
		const sideContainDiv = document.getElementById("sideContainDiv");
		if (!sideDiv || !sideContainDiv) return;
		const genPage = (page: number) => {
			p.set("offset", page * 50 + "");
			fetch(this.info.api + `/guilds/${this.lookingguild?.id}/messages/search/?` + p.toString(), {
				headers: this.headers,
			})
				.then((_) => _.json())
				.then((json: {messages: [messagejson][]; total_results: number}) => {
					if (this.curSearch !== searchy) {
						return;
					}
					//FIXME total_results shall be ignored as it's known to be bad, spacebar bug.
					const messages = json.messages
						.map(([m]) => {
							const c = this.channelids.get(m.channel_id);
							if (!c) return;
							if (c.messages.get(m.id)) {
								return c.messages.get(m.id);
							}
							return new Message(m, c, true);
						})
						.filter((_) => _ !== undefined);
					sideDiv.innerHTML = "";
					if (messages.length == 0 && page !== 0) {
						maxpage = page - 1;
						genPage(page - 1);
						return;
					} else if (messages.length !== 50) {
						maxpage = page;
					}
					const sortBar = document.createElement("div");
					sortBar.classList.add("flexltr", "sortBar");

					const newB = document.createElement("button");
					const old = document.createElement("button");
					[newB.textContent, old.textContent] = [I18n.search.new(), I18n.search.old()];
					old.onclick = () => {
						p.set("sort_order", "asc");
						deleteMessages();
						genPage(0);
					};
					newB.onclick = () => {
						p.set("sort_order", "desc");
						deleteMessages();
						genPage(0);
					};
					if (p.get("sort_order") === "asc") {
						old.classList.add("selectedB");
					} else {
						newB.classList.add("selectedB");
					}

					const spaceElm = document.createElement("div");
					spaceElm.classList.add("spaceElm");

					sortBar.append(I18n.search.page(page + 1 + ""), spaceElm, newB, old);

					sideDiv.append(sortBar);

					sideContainDiv.classList.add("searchDiv");
					let channel: Channel | undefined = undefined;
					function deleteMessages() {
						for (const elm of htmls) elm.remove();
					}
					const htmls: HTMLElement[] = [];
					sideContainDiv.classList.remove("hideSearchDiv");
					for (const message of messages) {
						if (channel !== message.channel) {
							channel = message.channel;
							const h3 = document.createElement("h3");
							h3.textContent = channel.name;
							h3.classList.add("channelSTitle");
							sideDiv.append(h3);
							htmls.push(h3);
						}
						const html = message.buildhtml(undefined, true);
						if (message.div) console.error(message.div);
						html.addEventListener("click", async () => {
							try {
								sideContainDiv.classList.add("hideSearchDiv");
								(await message.channel.getmessage(message.id))?.deleteDiv();

								await message.channel.getHTML(true, true, message.id);
							} catch (e) {
								console.error(e);
							}
						});
						sideDiv.append(html);
						htmls.push(html);
					}
					if (messages.length === 0) {
						const noMs = document.createElement("h3");
						noMs.textContent = I18n.search.nofind();
						sideDiv.append(noMs);
					}
					const bottombuttons = document.createElement("div");
					bottombuttons.classList.add("flexltr", "searchNavButtons");
					const next = document.createElement("button");
					if (page == maxpage) next.disabled = true;
					next.onclick = () => {
						deleteMessages();
						genPage(page + 1);
					};
					const prev = document.createElement("button");
					prev.onclick = () => {
						deleteMessages();
						genPage(page - 1);
					};
					if (page == 0) prev.disabled = true;
					[next.textContent, prev.textContent] = [I18n.search.next(), I18n.search.back()];
					bottombuttons.append(prev, next);
					sideDiv.append(bottombuttons);
					sideDiv.scrollTo({top: 0, behavior: "instant"});
				});
		};
		if (query === "") {
			sideContainDiv.classList.remove("searchDiv");
			sideContainDiv.classList.remove("hideSearchDiv");
			sideDiv.innerHTML = "";
			this.searching = false;
			this.getSidePannel();
			return;
		}
		genPage(0);
	}

	keydown: (event: KeyboardEvent) => unknown = () => {};
	keyup: (event: KeyboardEvent) => boolean = () => false;
	handleKeyUp(event: KeyboardEvent): boolean {
		if (this.keyup(event)) {
			return true;
		}
		if (event.key === "Escape") {
			if (event.ctrlKey) {
				this.lookingguild?.markAsRead();
			} else {
				this.channelfocus?.readbottom();
				this.channelfocus?.goToBottom();
			}
			return true;
		}

		return false;
	}
	//---------- resolving members code -----------
	readonly waitingmembers = new Map<
		string,
		Map<string, (returns: memberjson | undefined) => void>
	>();
	readonly presences: Map<string, presencejson> = new Map();
	static font?: FontFace;
	static async loadFont() {
		const fontName = localStorage.getItem("emoji-font");
		if (this.font) {
			//TODO see when/if this can be removed
			//@ts-ignore this is stupid. it's been here since 2020
			document.fonts.delete(this.font);
		}
		const realname = this.fonts.find((_) => _[1] === fontName)?.[0];
		if (realname) {
			const font = new FontFace("emojiFont", `url("/emoji/${realname}")`);
			await font.load();
			console.error("fun");
			//TODO see when/if this can be removed
			//@ts-ignore this is stupid. it's been here since 2020
			document.fonts.add(font);
			console.log(font);
			this.font = font;
		}
	}
	static get fonts() {
		return [
			["NotoColorEmoji-Regular.ttf", "Noto Color Emoji"],
			["OpenMoji-color-glyf_colr_0.woff2", "OpenMoji"],
			["Twemoji-16.0.1.ttf", "Twemoji"],
			["BlobmojiCompat.ttf", "Blobmoji"],
		] as const;
	}
	async resolvemember(id: string, guildid: string): Promise<memberjson | undefined> {
		if (guildid === "@me") {
			return undefined;
		}
		const guild = this.guildids.get(guildid);
		const borked = true;
		if (!guild || (borked && guild.member_count > 250)) {
			try {
				const req = await fetch(this.info.api + "/guilds/" + guildid + "/members/" + id, {
					headers: this.headers,
				});
				if (req.status !== 200) {
					return undefined;
				}
				return await req.json();
			} catch {
				return undefined;
			}
		}
		let guildmap = this.waitingmembers.get(guildid);
		if (!guildmap) {
			guildmap = new Map();
			this.waitingmembers.set(guildid, guildmap);
		}
		const promise: Promise<memberjson | undefined> = new Promise((res) => {
			guildmap.set(id, res);
			this.getmembers();
		});
		return await promise;
	}
	fetchingmembers: Map<string, boolean> = new Map();
	noncemap: Map<string, (r: [memberjson[], string[]]) => void> = new Map();
	noncebuild: Map<string, [memberjson[], string[], number[]]> = new Map();
	searchMap = new Map<
		string,
		(arg: {
			chunk_index: number;
			chunk_count: number;
			nonce: string;
			not_found?: string[];
			members?: memberjson[];
			presences: presencejson[];
		}) => unknown
	>();
	async gotChunk(chunk: {
		chunk_index: number;
		chunk_count: number;
		nonce: string;
		not_found?: string[];
		members?: memberjson[];
		presences: presencejson[];
	}) {
		for (const thing of chunk.presences) {
			if (thing.user) {
				this.presences.set(thing.user.id, thing);
			}
		}
		if (this.searchMap.has(chunk.nonce)) {
			const func = this.searchMap.get(chunk.nonce);
			this.searchMap.delete(chunk.nonce);
			if (func) {
				func(chunk);
				return;
			}
		}
		chunk.members ??= [];
		const arr = this.noncebuild.get(chunk.nonce);
		if (!arr) return;
		arr[0] = arr[0].concat(chunk.members);
		if (chunk.not_found) {
			arr[1] = chunk.not_found;
		}
		arr[2].push(chunk.chunk_index);
		if (arr[2].length === chunk.chunk_count) {
			this.noncebuild.delete(chunk.nonce);
			const func = this.noncemap.get(chunk.nonce);
			if (!func) return;
			func([arr[0], arr[1]]);
			this.noncemap.delete(chunk.nonce);
		}
	}
	async getmembers() {
		const promise = new Promise((res) => {
			setTimeout(res, 10);
		});
		await promise; //allow for more to be sent at once :P
		if (this.ws) {
			this.waitingmembers.forEach(async (value, guildid) => {
				const keys = value.keys();
				if (this.fetchingmembers.has(guildid)) {
					return;
				}
				const build: string[] = [];
				for (const key of keys) {
					build.push(key);
					if (build.length === 100) {
						break;
					}
				}
				if (!build.length) {
					this.waitingmembers.delete(guildid);
					return;
				}
				const promise: Promise<[memberjson[], string[]]> = new Promise((res) => {
					const nonce = "" + Math.floor(Math.random() * 100000000000);
					this.noncemap.set(nonce, res);
					this.noncebuild.set(nonce, [[], [], []]);
					if (!this.ws) return;
					this.ws.send(
						JSON.stringify({
							op: 8,
							d: {
								user_ids: build,
								guild_id: guildid,
								limit: 100,
								nonce,
								presences: true,
							},
						}),
					);
					this.fetchingmembers.set(guildid, true);
				});
				const prom = await promise;
				const data = prom[0];
				for (const thing of data) {
					if (value.has(thing.id)) {
						const func = value.get(thing.id);
						if (!func) {
							value.delete(thing.id);
							continue;
						}
						func(thing);
						value.delete(thing.id);
					}
				}
				for (const thing of prom[1]) {
					if (value.has(thing)) {
						const func = value.get(thing);
						if (!func) {
							value.delete(thing);
							continue;
						}
						func(undefined);
						value.delete(thing);
					}
				}
				this.fetchingmembers.delete(guildid);
				this.getmembers();
			});
		}
	}
	async pingEndpoint() {
		const userInfo = getBulkInfo();
		if (!userInfo.instances) userInfo.instances = {};
		const wellknown = this.info.wellknown;
		if (!userInfo.instances[wellknown]) {
			const pingRes = await fetch(this.info.api + "/ping");
			const pingJSON = await pingRes.json();
			userInfo.instances[wellknown] = pingJSON;
			localStorage.setItem("userinfos", JSON.stringify(userInfo));
		}
		this.instancePing = userInfo.instances[wellknown].instance;

		this.pageTitle("Loading...");
	}
	pageTitle(channelName = "", guildName = "") {
		(document.getElementById("channelname") as HTMLSpanElement).textContent = channelName;
		(document.getElementsByTagName("title")[0] as HTMLTitleElement).textContent =
			channelName +
			(guildName ? " | " + guildName : "") +
			" | " +
			this.instancePing.name +
			" | Fermi";
	}
	async instanceStats() {
		const dialog = new Dialog("");
		dialog.options.addTitle(I18n.instanceStats.name(this.instancePing.name));
		dialog.show();
		const res = await fetch(this.info.api + "/policies/stats", {
			headers: this.headers,
		});
		const json = await res.json();
		dialog.options.addText(I18n.instanceStats.users(json.counts.user));
		dialog.options.addText(I18n.instanceStats.servers(json.counts.guild));
		dialog.options.addText(I18n.instanceStats.messages(json.counts.message));
		dialog.options.addText(I18n.instanceStats.members(json.counts.members));
	}

	async refreshIfNeeded(url: string) {
		const urlObj = new URL(url);
		if (urlObj.host === new URL(this.info.cdn).host) {
			if (urlObj.searchParams.get("ex")) {
				if (Number.parseInt(urlObj.searchParams.get("ex") || "", 16) >= Date.now() - 5000) {
					return url;
				}
			}
			const newUrl = this.refreshURL(url);
			newUrl.then((_) => (url = _));
			return newUrl;
		}
		return url;
	}

	refreshTimeOut?: NodeJS.Timeout;
	urlsToRefresh: [string, (arg: string) => void][] = [];
	refreshURL(url: string): Promise<string> {
		if (!this.refreshTimeOut) {
			this.refreshTimeOut = setTimeout(async () => {
				const refreshes = this.urlsToRefresh;
				this.urlsToRefresh = [];
				delete this.refreshTimeOut;
				const res = await fetch(this.info.api + "/attachments/refresh-urls", {
					method: "POST",
					body: JSON.stringify({attachment_urls: refreshes.map((_) => _[0])}),
					headers: this.headers,
				});
				const body: {
					refreshed_urls: string[];
				} = await res.json();
				let i = 0;
				for (const url of body.refreshed_urls) {
					refreshes[i][1](url);
					i++;
				}
			}, 100);
		}
		return new Promise((res) => {
			this.urlsToRefresh.push([url, res]);
		});
	}
	getNotiVolume(): number {
		const userinfos = getBulkInfo();
		return userinfos.preferences.volume ?? 20;
	}
	setNotificationVolume(volume: number) {
		const userinfos = getBulkInfo();
		userinfos.preferences.volume = volume;
		localStorage.setItem("userinfos", JSON.stringify(userinfos));
	}
	setNotificationSound(sound: string) {
		const userinfos = getBulkInfo();
		userinfos.preferences.notisound = sound;
		localStorage.setItem("userinfos", JSON.stringify(userinfos));
	}
	playSound(name = this.getNotificationSound()) {
		const volume = this.getNotiVolume();
		if (this.play) {
			const voice = this.play.tracks.includes(name);
			if (voice) {
				this.play.play(name, volume);
			} else if (this.perminfo.sound && this.perminfo.sound.cSound) {
				const audio = document.createElement("audio");
				audio.volume = volume / 100;
				audio.src = this.perminfo.sound.cSound;
				audio.play().catch();
			}
		} else {
			console.error("play object is missing");
		}
	}
	getNotificationSound() {
		const userinfos = getBulkInfo();
		return userinfos.preferences.notisound;
	}
}
export {Localuser};
