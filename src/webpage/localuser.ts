import {Guild} from "./guild.js";
import {Channel} from "./channel.js";
import {Direct, Group} from "./direct.js";
import {User} from "./user.js";
import {createImg, getapiurls, getBulkUsers, getInstances, SW} from "./utils/utils.js";
import {getBulkInfo, Specialuser} from "./utils/utils.js";
import {
	channeljson,
	guildFolder,
	mainuserjson,
	memberjson,
	memberlistupdatejson,
	messageCreateJson,
	messagejson,
	presencejson,
	readStateEntry,
	readyjson,
	startTypingjson,
	wsjson,
	pollUpdateJson,
	applicationJson,
} from "./jsontypes.js";
import {Member} from "./member.js";
import {Dialog, Form, FormError, Options} from "./settings.js";
import {getTextNodeAtPosition, MarkDown} from "./markdown.js";
import {Bot} from "./bot.js";
import {Role} from "./role.js";
import {VoiceFactory, voiceStatusStr} from "./voice.js";
import {I18n} from "./i18n.js";
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
import {getPreferences, setPreferences} from "./utils/storage/userPreferences";
import {getDeveloperSettings} from "./utils/storage/devSettings";
import {PromiseLock} from "./utils/promiseLock.js";
import {CDNParams} from "./utils/cdnParams.js";
import {SnowFlake} from "./snowflake.js";
import {trimTrailingSlashes} from "./utils/netUtils.js";
import {Versions} from "./versions.js";
import {Shortcut} from "./shortcuts/shortcut.js";
import {getShortcuts} from "./utils/storage/shortcuts.js";
import {TypeBox} from "./typeBox.js";
import {InstnaceConfig} from "./instanceConfig.js";
import {FS} from "./fs/index.js";
import {decode64} from "./utils/base64.js";
import {showBanner} from "./utils/bannerController.js";
export type traceObj = {
	micros: number;
	calls?: (string | traceObj)[];
};
export type trace = [string, traceObj];
const wsCodesRetry = new Set([4000, 4001, 4002, 4003, 4005, 4007, 4008, 4009]);

interface MDSearchOption {
	name: string;
	replace: string;
	icon?: HTMLElement;
	otherLogic?: () => boolean;
}

MarkDown.emoji = Emoji;
class Localuser {
	readonly badges = new Map<
		string,
		{id: string; description: string; icon: string; link?: string; translate?: boolean}
	>(badgeArr);
	lastSequence: number | null = null;
	get token() {
		return this.headers.Authorization;
	}
	userinfo!: Specialuser;
	initialized!: boolean;
	get info() {
		return this.userinfo.serverurls;
	}
	set info(e) {
		this.userinfo.serverurls = e;
	}
	headers!: {"Content-type": string; Authorization: string};
	user!: User;
	readonly guilds = new Map<string, Guild>();
	readonly channels: Map<string, Channel> = new Map();
	readonly userMap: Map<string, User> = new Map();
	readonly messages = new Map<string, Message>();
	readonly idToPrev = new Map<string, string | undefined>();
	readonly idToNext = new Map<string, string | undefined>();
	static readonly globalShortcuts = new Shortcut();
	fs = new FS();
	get status() {
		return this.user.status;
	}
	set status(status: string) {
		this.user.setstatus(status);
	}
	focusChannel?: Channel;
	focusGuild?: Guild;
	private ws?: WebSocket;
	private connectionSucceed = 0;
	private errorBackoff = 0;
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
	static async showAccountSwitcher(thisUser?: Localuser) {
		const specialUser = await new AccountSwitcher().show();

		const onswap = thisUser?.onswap;
		thisUser?.unload();
		if (thisUser) thisUser.swapped = true;
		const loading = document.getElementById("loading") as HTMLDivElement;
		loading.classList.remove("doneloading");
		loading.classList.add("loading");

		thisUser = new Localuser(specialUser);
		Localuser.users.currentuser = specialUser.uid;
		sessionStorage.setItem("currentuser", specialUser.uid);
		localStorage.setItem("userinfos", JSON.stringify(Localuser.users));

		thisUser.initwebsocket().then(async () => {
			const loaddesc = document.getElementById("load-desc") as HTMLElement;
			thisUser.loaduser();
			await thisUser.init();
			loading.classList.add("doneloading");
			loaddesc.textContent = I18n.loaded();
			loading.classList.remove("loading");
			console.log("done loading");
		});

		onswap?.(thisUser);
	}
	static userMenu = this.generateUserMenu();
	private readonly userResMap = new Map<string, Promise<User>>();
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
	async searchMembers(limit: number, query: string, guild: Guild): Promise<Member[]> {
		if (guild.id !== "@me") {
			return new Promise<Member[]>((res) => {
				const nonce = Math.floor(Math.random() * 10 ** 8) + "";
				this.ws!.send(
					JSON.stringify({
						op: 8,
						d: {
							guild_id: [guild.id],
							query,
							limit,
							presences: true,
							nonce,
						},
					}),
				);
				this.searchMap.set(nonce, async (e) => {
					console.log(e);
					if (e.members && e.members[0]) {
						if (e.members[0].user) {
							res(
								(await Promise.all(e.members.map(async (_) => await Member.new(_, guild)))).filter(
									(_) => _ !== undefined,
								),
							);
						} else {
							const prom1: Promise<User>[] = [];
							for (const thing of e.members) {
								prom1.push(this.getUser(thing.id));
							}
							await Promise.all(prom1);
							res(
								(await Promise.all(e.members.map(async (_) => await Member.new(_, guild)))).filter(
									(_) => _ !== undefined,
								),
							);
						}
					}
					return [];
				});
			});
		}
		return [];
	}
	onswap?: (l: Localuser) => void;
	constructor(userinfo: Specialuser) {
		this.conf = new InstnaceConfig(userinfo.serverurls.api);
		Play.playURL("/audio/sounds.jasf").then((_) => {
			this.play = _;
		});

		this.userinfo = userinfo;
		this.perminfo.guilds ??= {};
		this.perminfo.user ??= {};
		this.perminfo.user.decorations ??= true;
		this.initialized = false;
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
		Versions.makeVersion(this.info.api, "start");
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
		const prefs = getPreferences();
		const bstate = prefs.showBlogUpdates;
		if (bstate === undefined) {
			const pop = new Dialog("");
			pop.options.addText(I18n.blog.wantUpdates());
			const opts = pop.options.addOptions("", {ltr: true});
			opts.addButtonInput("", I18n.yes(), async () => {
				prefs.showBlogUpdates = true;
				await setPreferences(prefs);
				this.queryBlog();
				pop.hide();
			});
			opts.addButtonInput("", I18n.no(), async () => {
				prefs.showBlogUpdates = false;
				await setPreferences(prefs);
				this.queryBlog();
				pop.hide();
			});
			pop.show();
		} else if (bstate) {
			const post = (await this.getPosts()).items[0];
			this.perminfo.localuser ??= {};
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
	readonly unknownRead = new Map<string, readStateEntry>();
	conf: InstnaceConfig;
	async gottenReady(ready: readyjson): Promise<void> {
		showBanner();
		this.conf = new InstnaceConfig(this.info.api);
		this.getGifProvidors();
		await I18n.done;
		await this.conf.ready;
		this.errorBackoff = 0;
		this.queryBlog();
		this.guildFolders = ready.d.user_settings.guild_folders;
		document.body.style.setProperty("--view-rest", I18n.message.viewrest());
		this.initialized = true;
		this.guilds.clear();
		this.channels.clear();
		this.userResMap.clear();
		this.inrelation.clear();
		this.userMap.clear();
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

		this.status = ready.d.user_settings.status;
		this.focusChannel = undefined;
		this.focusGuild = undefined;
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
			this.guilds.set(temp.id, temp);
		}
		{
			const temp = new Direct(ready.d.private_channels, this);
			this.guilds.set(temp.id, temp);
		}
		if (ready.d.user_guild_settings) {
			console.log(ready.d.user_guild_settings.entries);

			for (const thing of ready.d.user_guild_settings.entries) {
				(this.guilds.get(thing.guild_id) as Guild).notisetting(thing);
			}
		}
		if (ready.d.read_state) {
			for (const thing of ready.d.read_state.entries) {
				const channel = this.channels.get(thing.channel_id);
				if (!channel) {
					this.unknownRead.set(thing.channel_id, thing);
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
		const prefs = getPreferences();
		const ml = document.getElementById("memberlisttoggle")!;
		if (prefs.checkMemberList) {
			ml.classList = "";
		} else {
			ml.classList = "svgicon svg-friends";
		}
	}
	readonly inrelation = new Set<User>();
	outoffocus(): void {
		const servers = document.getElementById("guildRail") as HTMLDivElement;
		servers.innerHTML = "";
		const channels = document.getElementById("channels") as HTMLDivElement;
		channels.innerHTML = "";
		if (this.focusChannel) {
			this.focusChannel.infinite.delete();
		}
		this.focusGuild = undefined;
		this.focusChannel = undefined;
	}
	giveMessage(m: messagejson) {
		const c = this.channels.get(m.channel_id);
		if (!c) return;
		new Message(m, c);
	}
	unload(): void {
		this.initialized = false;
		this.outoffocus();
		this.guilds.clear();
		this.channels.clear();
		this.userResMap.clear();
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
		if (!resume) {
			this.messages.clear();
			this.idToPrev.clear();
			this.idToNext.clear();
		}
		const doComp = DecompressionStream && !getDeveloperSettings().gatewayCompression;
		const ws = new WebSocket(
			(resume ? this.resume_gateway_url : this.info.gateway.toString()) +
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
								}, //TODO think this through, it's just a stupid large number to fix op 8 requests
								large_threshold: 100000000,
							},
						}),
					);
				}
			});

			if (DecompressionStream) {
				(async () => {
					let build = "";
					for await (const data of ds.readable.pipeThrough(new TextDecoderStream())) {
						build += data;
						try {
							const temp = JSON.parse(build);
							build = "";
							await this.handleEvent(temp);

							if (temp.op === 0 && temp.t === "READY") {
								console.log("in here?");
								returny();
							}
						} catch (e) {
							if (!(e instanceof SyntaxError)) {
								console.error(e);
							}
						}
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
			this.voiceFactory?.close();
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
			this.fetchingmembers.clear();
			this.memberNonceMap.clear();
			this.memberNonceBuild.clear();
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
							this.userinfo.json.serverurls = this.info;
							break;
						}
						break;

					case 4: {
						const newurls = await getapiurls(new URL(this.info.wellknown).origin);
						if (newurls) {
							this.info = newurls;
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
							this.userinfo.json.serverurls = this.info;
						}
						break;
					}
				}
				setTimeout(
					() => {
						if (this.swapped) return;
						loaddesc.textContent = I18n.retrying();
						this.initwebsocket().then(async () => {
							console.log("FINE ME");
							this.loaduser();
							await this.init();
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
		console.log("here?");
		await promise;
		console.warn("huh");
	}
	readonly interNonceMap = new Map<string, Message>();
	registerInterNonce(nonce: string, thing: Message) {
		this.interNonceMap.set(nonce, thing);
	}
	relationshipsUpdate = () => {};
	rights: Rights;
	updateRights(rights: string | number) {
		if (this.rights.isSameAs(rights)) return;
		this.rights.update(rights);
		this.perminfo.user.rights = rights;
	}
	traceSub() {
		SW.captureEvent("trace", (e) => {
			this.handleTrace(e.trace);
		});
	}
	readonly relChangeUpdateMap = new Map<string, (() => void)[]>();
	async relationChange(id: string): Promise<void> {
		const arr = this.relChangeUpdateMap.get(id) || [];
		const {promise, resolve} = Promise.withResolvers<void>();
		arr.push(resolve);
		this.relChangeUpdateMap.set(id, arr);
		return promise;
	}
	conectionChange = () => {};
	async handleEvent(temp: wsjson) {
		try {
			window.checker?.checkEvent(temp);
		} catch (e) {
			console.error(e);
		}
		if (temp.d._trace) this.handleTrace(temp.d._trace);
		if (getDeveloperSettings().gatewayLogging) console.debug(temp);
		if (temp.s) this.lastSequence = temp.s;
		if (temp.op === 9 && this.ws) {
			this.errorBackoff = 0;
			this.ws.close(4041);
		}
		if (temp.op == 0) {
			switch (temp.t) {
				case "THREAD_MEMBERS_UPDATE": {
					const channel = this.channels.get(temp.d.id);
					if (!channel) return;
					if (temp.d.added_members) {
						for (const memb of temp.d.added_members) {
							if (memb.user_id === this.user.id) {
								channel.member = memb;
								channel.parent?.createguildHTML();
							} else {
								//TODO store these somewhere
							}
						}
					}
					if (temp.d.removed_member_ids) {
						for (const id of temp.d.removed_member_ids) {
							if (id === this.user.id) {
								channel.member = undefined;
								channel.parent?.createguildHTML();
							} else {
								//TODO unstore these somewhere
							}
						}
					}
					break;
				}
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
				case "USER_NOTE_UPDATE": {
					const u = this.userMap.get(temp.d.id);
					if (u) u.note = temp.d.note;
					break;
				}
				case "USER_CONNECTIONS_UPDATE": {
					this.conectionChange();
					break;
				}
				case "MESSAGE_POLL_VOTE_ADD":
				case "MESSAGE_POLL_VOTE_REMOVE": {
					const m = this.messages.get(temp.d.message_id);
					m?.pollUpdate(temp);
					const f = this.pollUpdateSubMap.get(temp.d.message_id);
					f?.(temp);
					break;
				}
				case "MESSAGE_DELETE": {
					temp.d.guild_id ??= "@me";
					const channel = this.channels.get(temp.d.channel_id);
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
					const channel = this.channels.get(temp.d.channel_id);
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
					const channel = this.channels.get(temp.d.channel_id);
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
						if (temp.d.id === this.focusChannel?.id) {
							TypeBox.changeWrite();
						}
					}
					break;
				case "CHANNEL_CREATE":
				case "THREAD_CREATE":
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
					const guildy = this.guilds.get(temp.d.id);
					if (guildy) {
						this.guilds.delete(temp.d.id);
						guildy.html.remove();
						if (guildy === this.focusGuild) {
							this.guilds.get("@me")?.loadGuild();
							this.guilds.get("@me")?.loadChannel();
						}
					}
					break;
				}
				case "GUILD_UPDATE": {
					const guildy = this.guilds.get(temp.d.id);
					if (guildy) {
						guildy.update(temp.d);
					}
					break;
				}
				case "GUILD_CREATE":
					(async () => {
						const m = temp.d.members.find(({id}) => id === this.user.id);
						const guildy = new Guild(temp.d, this, m ?? this.user);
						this.guilds.set(guildy.id, guildy);
						for (const m of temp.d.members) {
							Member.newUnsafe(m, guildy);
						}
						const divy = this.makeGuildIcon(guildy);
						guildy.HTMLicon = divy;
						(document.getElementById("guildRail") as HTMLDivElement).insertBefore(
							divy,
							document.getElementById("bottomseparator"),
						);
						guildy.messageNotifications = guildy.properties.default_message_notifications;
						guildy.showWelcome();
					})();
					break;
				case "MESSAGE_REACTION_ADD":
					{
						temp.d.guild_id ??= "@me";
						const guild = this.guilds.get(temp.d.guild_id);
						if (!guild) break;
						const channel = this.channels.get(temp.d.channel_id);
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
						const channel = this.channels.get(temp.d.channel_id);
						if (!channel) break;

						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;

						message.reactionRemove(temp.d.emoji, temp.d.user_id);
					}
					break;
				case "MESSAGE_REACTION_REMOVE_ALL":
					{
						temp.d.guild_id ??= "@me";
						const channel = this.channels.get(temp.d.channel_id);
						if (!channel) break;
						const message = channel.messages.get(temp.d.message_id);
						if (!message) break;
						message.reactionRemoveAll();
					}
					break;
				case "MESSAGE_REACTION_REMOVE_EMOJI":
					{
						temp.d.guild_id ??= "@me";
						const channel = this.channels.get(temp.d.channel_id);
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
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.newRole(temp.d.role);
					break;
				}
				case "GUILD_ROLE_UPDATE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.updateRole(temp.d.role);
					if (guild === this.focusGuild) {
						TypeBox.changeWrite();
					}
					break;
				}
				case "GUILD_ROLE_DELETE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.deleteRole(temp.d.role_id);
					if (guild === this.focusGuild) {
						TypeBox.changeWrite();
					}
					break;
				}
				case "GUILD_MEMBER_UPDATE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.memberupdate(temp.d);
					if (temp.d.id === this.user.id) {
						if (guild === this.focusGuild) {
							TypeBox.changeWrite();
						}
					}
					break;
				}
				case "RELATIONSHIP_UPDATE":
				case "RELATIONSHIP_ADD": {
					(async () => {
						const user = temp.d.user ? new User(temp.d.user, this) : await this.getUser(temp.d.id);
						user.handleRelationship(temp.d);
						this.relationshipsUpdate();
						const me = this.guilds.get("@me");
						if (me) me.unreads();
						const arr = this.relChangeUpdateMap.get(user.id);
						if (arr) {
							arr.forEach((_) => _());
							this.relChangeUpdateMap.delete(user.id);
						}
					})();
					break;
				}
				case "RELATIONSHIP_REMOVE": {
					const user = this.userMap.get(temp.d.id);
					if (!user) return;
					user.removeRelation();
					this.relationshipsUpdate();
					const arr = this.relChangeUpdateMap.get(user.id);
					if (arr) {
						arr.forEach((_) => _());
						this.relChangeUpdateMap.delete(user.id);
					}
					const me = this.guilds.get("@me");
					if (me) me.unreads();
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
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					Member.new(temp.d, guild);
					break;
				}
				case "GUILD_MEMBER_REMOVE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					const user = new User(temp.d.user, this);
					const member = user.members.get(guild);
					if (!(member instanceof Member)) break;
					member.remove();
					break;
				}
				case "GUILD_EMOJIS_UPDATE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.emojis = temp.d.emojis;
					guild.onEmojiUpdate(guild.emojis);
					break;
				}
				case "GUILD_STICKERS_UPDATE": {
					const guild = this.guilds.get(temp.d.guild_id);
					if (!guild) break;
					guild.stickers.clear();
					temp.d.stickers.forEach((sticker) =>
						guild.stickers.set(sticker.id, new Sticker(sticker, guild)),
					);

					guild.onStickerUpdate(guild.stickers);
					break;
				}
				case "CHANNEL_RECIPIENT_REMOVE": {
					const guild = this.guilds.get("@me") as Direct;
					const channel = guild.channels.find(({id}) => id == temp.d.channel_id) as Group;
					if (!channel) break;
					channel.removeRec(new User(temp.d.user, this));
					break;
				}
				case "CHANNEL_RECIPIENT_ADD": {
					const guild = this.guilds.get("@me") as Direct;
					const channel = guild.channels.find(({id}) => id == temp.d.channel_id) as Group;
					if (!channel) break;
					channel.addRec(new User(temp.d.user, this));
					break;
				}
				case "MESSAGE_ACK": {
					const channel = this.channels.get(temp.d.channel_id);
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
				const reasons = this.generateReasons();

				if (this.connectionSucceed === 0) this.connectionSucceed = Date.now();
				this.ws.send(
					JSON.stringify({
						op: 40,
						d: {seq: this.lastSequence, qos: {ver: 27, active: !!reasons.length, reasons}},
					}),
				);
			}, this.heartbeat_interval);
		} else {
			console.log("Unhandled case " + temp.d, temp);
		}
	}
	generateReasons() {
		const reasons: string[] = [];
		if (!document.hidden) reasons.push("foregrounded");
		return reasons;
	}
	setUserAudio(id: string, vol: number) {
		if (!this.perminfo.userAudio) this.perminfo.userAudio = {};
		this.perminfo.userAudio[id] = vol;
		const v = this.voiceFactory?.currentVoice;
		if (v) {
			const u = v.uVolMap.get(id);
			if (u) u.volume = vol / 100;
		}
	}
	getUserAudio(id: string) {
		if (!this.perminfo.userAudio) this.perminfo.userAudio = {};

		return (this.perminfo.userAudio[id] as number) ?? 100;
	}
	get currentVoice() {
		return this.voiceFactory?.currentVoice;
	}
	async getAudioDeviceList() {
		return (await navigator.mediaDevices.enumerateDevices()).filter(
			(dev) => dev.kind === "audioinput",
		);
	}
	async setNewDefualtDevice(id: string) {
		const devices = await this.getAudioDeviceList();
		const d = devices.find((_) => _.deviceId === id);
		if (!d) return;
		const device = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: {exact: d.deviceId},
			},
		});
		if (!device) return;
		await this.voiceFactory?.currentVoice?.giveMicTrack(device);
		this.perminfo.localuser ??= {};
		this.perminfo.localuser.defaultAudio = id;
	}
	getDefaultAudio() {
		return this.perminfo.localuser.defaultAudio || "default";
	}
	async joinVoice(channel: Channel) {
		if (!this.voiceFactory) return;
		if (!this.ws) return;
		const v = this.voiceFactory.joinVoice(channel.id, channel.guild.id, this.mute);
		this.perminfo.localuser ??= {};
		if (this.perminfo.localuser.defaultAudio) {
			const devices = await this.getAudioDeviceList();
			const d = devices.find((_) => _.deviceId === this.perminfo.localuser.defaultAudio);
			if (d) {
				navigator.mediaDevices
					.getUserMedia({
						audio: {
							deviceId: {exact: d.deviceId},
						},
					})
					.then((_) => v.giveMicTrack(_));
				return;
			}
		}
		const d = await navigator.mediaDevices.getUserMedia({video: false, audio: true});
		this.perminfo.localuser.defaultAudio = d.getAudioTracks()[0]?.id;
		v.giveMicTrack(d);
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
					let channel: Channel | undefined = this.channels.values().find((_) => _.voice === voice);
					if (channel) this.changeVCStatus(status, channel);
					else console.error("Uh, no channel found?");
				};
			};
		}
	}

	heartbeat_interval: number = 0;
	updateChannel(json: channeljson): void {
		const guild = this.guilds.get(json.guild_id || "@me");
		if (guild) {
			guild.updateChannel(json);
			if (json.guild_id === this.focusGuild?.id) {
				this.loadGuild(json.guild_id);
			}
		}
	}
	async createChannel(json: channeljson): Promise<undefined | Channel> {
		const c = this.channels.get(json.id);
		if (c) {
			c.updateChannel(json);
			return c;
		}
		json.guild_id ??= "@me";
		const guild = this.guilds.get(json.guild_id);
		if (!guild) return;
		if (guild.channels.find((_) => _.id === json.id)) return;
		const channel = guild.createChannelpac(json);
		if (json.guild_id === this.focusGuild?.id) {
			this.loadGuild(json.guild_id, true);
		}
		if (channel.id === this.gotoid) {
			guild.loadGuild();
			if (channel?.type !== 4) {
				await guild.loadChannel(channel.id);
			}
			this.gotoRes();
			this.gotoRes = () => {};
			this.gotoid = undefined;
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
		const guild = this.focusGuild;
		if (!guild) return;

		const channel = this.focusChannel;
		if (!channel || !channel.hasPermission("VIEW_CHANNEL")) return;
		if (channel.voice && this.voiceAllowed) {
			const div = document.getElementById("sideDiv") as HTMLDivElement;
			div.textContent = "";
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
			await Promise.all(
				list.d.ops[0].items.map(async (member) => {
					if ("member" in member) {
						if (this.userMap.get(member.member.id)?.members.has(guild)) return;
						if (this.focusGuild?.id && this.focusGuild?.id !== "@me")
							await this.getMember(member.member.user!.id, this.focusGuild.id);
					} else {
						counts.set(member.group.id, member.group.count);
					}
				}),
			);
		}

		const elms: Map<Role | "offline" | "online", (Member | User)[]> = new Map([]);
		for (const role of guild.roles) {
			if (role.hoist) {
				elms.set(role, []);
			}
		}
		elms.set("online", []);
		elms.set("offline", []);
		let members = new Set<User | Member>(guild.members.values());
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
	instanceString(): string {
		const insts = getInstances();
		if (insts) {
			for (const inst of insts) {
				if (trimTrailingSlashes(inst.url ?? "") === trimTrailingSlashes(this.info.wellknown)) {
					return inst.name;
				}
			}
		}
		console.log("failed with", insts, this.info.wellknown);
		return this.info.wellknown;
	}
	readonly roleListMap = new WeakMap<
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
		if (this.ws && this.focusChannel) {
			console.log(this.focusChannel.guild.id);
			this.memberListQue();
			if (this.focusChannel.guild.id === "@me") {
				return;
			}
			if (!this.focusChannel.visible) return;
			this.ws.send(
				JSON.stringify({
					d: {
						channels: {[this.focusChannel.id]: [[0, 99]]},
						guild_id: this.focusChannel.guild.id,
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
				const dir = this.guilds.get("@me") as Direct;
				dir.loadChannel(null, false);
			}
			return;
		}
		this.goToChannel(channelid, false, messageid);
	}

	gotoid: string | undefined;
	gotoRes = () => {};
	async goToChannel(channelid: string, addstate = true, messageid: undefined | string = undefined) {
		const channel = this.channels.get(channelid);
		if (channel?.type === 4) return;
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
		const guild = this.guilds.get(guild_id);
		if (guild) {
			guild.delChannel(json);
		}

		if (json.guild_id === this.focusGuild?.id) {
			this.loadGuild(json.guild_id, true);
		}
	}
	async init() {
		const location = window.location.href.split("/");
		this.buildservers();
		this.generateFavicon();
		if (location[3] === "channels") {
			const guild = this.loadGuild(location[4]);
			if (!guild) {
				return;
			}
			await guild.loadChannel(location[5], true, location[6]);
			this.focusChannel = this.channels.get(location[5]);
		}
	}
	loaduser(): void {
		const userpfp = document.getElementById("userpfp") as HTMLImageElement;
		(document.getElementById("username") as HTMLSpanElement).textContent = this.user.username;
		userpfp.src = this.user.getpfpsrc();
		userpfp.classList = `pfp userid:${this.user.id}`;
		(document.getElementById("status") as HTMLSpanElement).textContent = this.status;
	}
	isAdmin(): boolean {
		if (this.focusGuild) {
			return this.focusGuild.member.isAdmin();
		} else {
			return false;
		}
	}

	loadGuild(id: string, forceReload = false): Guild | undefined {
		TypeBox.saveBox();
		this.searching = false;
		let guild = this.guilds.get(id);
		if (!guild) {
			guild = this.guilds.get("@me");
		}
		console.log(forceReload);
		if (!forceReload && this.focusGuild === guild) {
			return guild;
		}
		if (this.focusChannel && this.focusGuild !== guild) {
			this.focusChannel.infinite.delete();
			this.focusChannel = undefined;
		}
		if (this.focusGuild) {
			this.focusGuild.html.classList.remove("serveropen");
		}

		if (!guild) return;
		if (guild.html) {
			guild.html.classList.add("serveropen");
		}
		this.focusGuild = guild;
		(document.getElementById("serverName") as HTMLElement).textContent = guild.properties.name;
		const banner = document.getElementById("servertd");
		console.log(guild.banner, banner);
		if (banner) {
			if (guild.banner) {
				//https://cdn.discordapp.com/banners/677271830838640680/fab8570de5bb51365ba8f36d7d3627ae.webp?size=240
				banner.style.setProperty(
					"background-image",
					`linear-gradient(rgba(80, 80, 80, 1) 0%, rgba(80, 80, 80, 0) 40%), url(${this.info.cdn}/banners/${guild.id}/${guild.banner + new CDNParams({expectedSize: 128})})`,
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
	readonly dragMap = new WeakMap<
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
					const servers = document.getElementById("guildRail");
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
				if (!folder.color && folder.color !== 0) icon.style.removeProperty("--folder-color");
				await this.saveGuildOrder();
				dio.hide();
			});
			dio.show();
		});

		menu.bindContextmenu(iconDiv);
		if (folder.color !== null && folder.color !== undefined) {
			folderDiv.style.setProperty(
				"--folder-color",
				"#" + folder.color.toString(16).padStart(6, "0"),
			);
			if (!folder.color && folder.color !== 0) folderDiv.style.removeProperty("--folder-color");
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
		this.perminfo.localuser ??= {};
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
		const serverlist = document.getElementById("guildRail") as HTMLDivElement; //
		const outdiv = document.createElement("div");
		const home: any = document.createElement("span");
		const div = document.createElement("div");
		div.classList.add("home", "servericon");

		home.classList.add("svgicon", "svg-home");
		(this.guilds.get("@me") as Guild).html = outdiv;
		const unread = document.createElement("div");
		unread.classList.add("unread");
		outdiv.append(unread);
		outdiv.append(div);
		div.appendChild(home);

		outdiv.classList.add("servernoti");
		serverlist.append(outdiv);
		home.onclick = () => {
			const guild = this.guilds.get("@me");
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
		const guilds = new Set(this.guilds.values());
		const dirrect = this.guilds.get("@me") as Direct;

		guilds.delete(dirrect);
		const folders = this.guildFolders
			.map((folder) => {
				return {
					guilds: folder.guild_ids
						.map((id) => {
							const guild = this.guilds.get(id);
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
			new Hover(I18n.discovery(), {
				side: "right",
				weak: true,
			}).addEvent(guilddsdiv);
			new Hover(I18n.addGuild(), {
				side: "right",
				weak: true,
			}).addEvent(div);
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
				if (URL.canParse(template.value) && new URL(template.value).protocol.startsWith("http")) {
					const url = new URL(template.value);
					code = url.pathname.split("/").at(-1) as string;
					if (url.host === "discord.com" || url.host === "discord.new") {
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
		this.guilds.get("@me")?.loadChannel("discover");
	}
	messageCreate(messagep: messageCreateJson): void {
		messagep.d.guild_id ??= "@me";
		const channel = this.channels.get(messagep.d.channel_id);
		if (channel) {
			channel.messageCreate(messagep);
			this.unreads();
		}
	}
	unreads(): void {
		for (const thing of this.guilds.values()) {
			if (thing.id === "@me") {
				thing.unreads();
				continue;
			}
			const html = thing.html;
			thing.unreads(html);
		}
	}
	private static favC = document.createElement("canvas");
	private static favCTX = this.favC.getContext("2d") as CanvasRenderingContext2D;
	private static favImg = this.getFaviconImg();
	static getFaviconImg() {
		const img = document.createElement("img");
		img.src = "/logo.webp";
		return img;
	}
	private last = "-1";
	private generateFavicon() {
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
		for (const guild of this.guilds.values()) {
			sum += guild.mentions;
		}
		for (const channel of (this.guilds.get("@me") as Direct).channels) {
			sum += channel.mentions;
		}
		return sum;
	}
	async typingStart(typing: startTypingjson): Promise<void> {
		const channel = this.channels.get(typing.d.channel_id);
		if (!channel) return;
		channel.typingStart(typing);
	}
	updatepfp(file: Blob | null): void {
		if (file) {
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
		} else {
			fetch(this.info.api + "/users/@me", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					avatar: null,
				}),
			});
		}
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
		const text = await (await fetch("https://blog.fermi.chat/feed_rss_created.xml")).text();
		const xml = new DOMParser().parseFromString(text, "text/xml");
		const posts = Array.from(xml.getElementsByTagName("channel")[0].getElementsByTagName("item"));
		return {
			items: posts.map((post) => {
				return {
					url: post.getElementsByTagName("link")[0].textContent,
					title: post.getElementsByTagName("title")[0].textContent,
					content_html: post.getElementsByTagName("description")[0].textContent,
					image: post.getElementsByTagName("image")[0]?.textContent ?? null,
				};
			}),
		} satisfies {
			items: {
				url: string;
				title: string;
				content_html: string;
				image: null | string;
			}[];
		};
	}
	async getConnections() {
		const json = await fetch(this.info.api + "/connections", {
			headers: this.headers,
		}).then((r) => r.json() as Promise<{[key: string]: {enabled: boolean; icon_url?: string}}>);
		json["domain"] = {enabled: true, icon_url: "/icons/domain.svg"};
		return json;
	}
	gifProvideors: {name: string; api_name: string}[] = [];
	selectedGifProfidor?: {name: string; api_name: string};
	async getGifProvidors() {
		const res = (await (
			await fetch(this.info.api + "/gifs", {
				headers: this.headers,
			})
		).json()) as {name: string; api_name: string}[];
		if (res[0] && !("name" in res[0])) {
			if (res.length === 3) {
				this.gifProvideors = [
					{name: "Giphy", api_name: "giphy"},
					{name: "Klipy", api_name: "klipy"},
				];
			}
		} else {
			this.gifProvideors = res.filter((_) => _.name !== "tenor");
		}
		this.figureDefaultProvidor();
	}
	async figureDefaultProvidor() {
		const prefs = getPreferences();
		this.selectedGifProfidor =
			this.gifProvideors.find((_) => _.api_name == prefs.gifProvidor) || this.gifProvideors[0];
	}
	domainVerification() {
		const d = new Dialog(I18n.domain.title(), {noSubmit: true});
		const text = d.options.addTextInput(I18n.domain.domain(), () => {});
		d.options.addButtonInput("", I18n.submit(), async () => {
			const dom = text.value;
			d.options.removeAll();
			console.log(dom);
			const res = await fetch(this.info.api + "/users/@me/connections/domain/" + dom, {
				method: "POST",
				headers: this.headers,
			});
			if (res.ok) {
				d.hide();
			} else {
				const json = (await res.json()) as {code?: number; message: string; proof: string};
				if (json.code === 50187) {
					const err = d.options.addErrorBox();
					d.options.addMDText(new MarkDown(I18n.domain.dnsinst(dom, json.proof)));

					d.options.addButtonInput("", I18n.submit(), async () => {
						const dom = text.value;
						const res = await fetch(this.info.api + "/users/@me/connections/domain/" + dom, {
							method: "POST",
							headers: this.headers,
						});
						if (res.ok) {
							d.hide();
						} else {
							err.showError((await res.json()).message);
						}
					});
				} else {
					d.options.addText(json.message);
				}
			}
		});
		d.show();
	}
	static initShortcuts() {
		const cur = getShortcuts();
		for (const [name, combo] of cur) {
			this.globalShortcuts.registerKeycombo(combo, name);
		}
		this.globalShortcuts.registerShortcut("gifSearch", () => {
			document.getElementById("gifTB")?.click();
		});
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
			initImg: json.icon
				? this.info.cdn +
					"/app-icons/" +
					appId +
					"/" +
					json.icon +
					new CDNParams({expectedSize: 96})
				: "",
		});
		form.addTextInput(I18n.localuser.privacyPolcyURL(), "privacy_policy_url", {
			initText: json.privacy_policy_url,
		});
		form.addText(I18n.localuser.appID(appId));
		form.addSubButtonInput(
			I18n.localuser.showSecret(),
			(opt) => {
				opt.addText(I18n.localuser.clientSecret(json.verify_key));
			},
			{
				intText: I18n.localuser.secret(),
			},
		);
		form.addTextInput(I18n.localuser.TOSURL(), "terms_of_service_url", {
			initText: json.terms_of_service_url,
		});
		form.addCheckboxInput(I18n.localuser.publicAvaliable(), "bot_public", {
			initState: json.bot_public,
		});
		form.addCheckboxInput(I18n.localuser.requireCode(), "bot_require_code_grant", {
			initState: json.bot_require_code_grant,
		});
		//TODO remove this conditional once https://codeberg.org/MelodyChat/Harmony/pulls/278 is merged
		if (false as boolean)
			form.addMDInput(I18n.localuser.redirURIs(), "redirect_uris", {
				initText: json.redirect_uris.join("\n"),
			});
		form.addPreprocessor((_) => {
			if ("redirect_uris" in _ && typeof _.redirect_uris === "string") {
				_.redirect_uris = _.redirect_uris.split("\n");
			}
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
	updateSend() {
		TypeBox.updateSend();
	}
	//TODO make this an option
	readonly autofillregex = Object.freeze(/(^|\s|\n|>)[@#:]([a-zA-Z0-9]*)$/i);
	mdBox() {
		const typeMd = TypeBox.markdown;
		typeMd.owner = this;
		typeMd.onUpdate = (str, pre) => {
			this.search(document.getElementById("searchOptions") as HTMLDivElement, typeMd, str, pre);
			this.updateSend();
		};
	}
	async pinnedClick(rect: DOMRect) {
		if (!this.focusChannel) return;
		await this.focusChannel.pinnedClick(rect);
	}
	async makeStickerBox(rect: DOMRect) {
		const sticker = await Sticker.stickerPicker(
			-0 + rect.right - window.innerWidth,
			-20 + rect.top - window.innerHeight,
			this,
		);
		this.favorites.addStickerFreq(sticker.id);
		console.log(sticker);
		if (this.focusChannel) {
			this.focusChannel.sendMessage("", {
				embeds: [],
				attachments: [],
				sticker_ids: [sticker.id],
				replyingto: this.focusChannel.replyingto,
			});
			this.focusChannel.replyingto = null;
			this.focusChannel.makereplybox();
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
				this.info.api +
					"/gifs/trending?" +
					new URLSearchParams([
						["locale", I18n.lang],
						["provider", this.selectedGifProfidor?.api_name!],
					]),
				{headers: this.headers},
			)
		).json()) as {
			categories: {
				name: string;
				src: string;
			}[];
			gifs: [fullgif];
		};

		await fetch(
			this.info.api +
				"/gifs/trending-gifs?" +
				new URLSearchParams([
					["locale", I18n.lang],
					["provider", this.selectedGifProfidor?.api_name!],
				]),
			{headers: this.headers},
		);
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

				div.onmousedown = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					if (this.focusChannel) {
						this.focusChannel.sendMessage(gif.src, {
							embeds: [],
							attachments: [],
							sticker_ids: [],
							replyingto: this.focusChannel.replyingto,
						});
						menu.remove();
						this.focusChannel.replyingto = null;
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
							["provider", this.selectedGifProfidor?.api_name!],
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
		//TODO fix this once we swap over
		search.placeholder = I18n.searchGifs(this.selectedGifProfidor?.name!);
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
		const p = TypeBox.saveCarrot();
		if (!p) return;
		const original = MarkDown.getText();

		const emoji = await Emoji.emojiPicker(
			-0 + rect.right - window.innerWidth,
			-20 + rect.top - window.innerHeight,
			this,
		);
		this.favorites.addEmoji(emoji.id || (emoji.emoji as string));
		p();
		const md = TypeBox.markdown;
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
		raw = (start ? original.replace(start, "") : original) + " " + replacewith + raw;

		typebox.txt = raw.split("");
		const match = start ? original.match(start) : true;
		if (match) {
			typebox.boxupdate(
				replacewith.length - (match === true ? 0 : match[0].length) + 1,
				false,
				original.length,
			);
		}
	}
	MDSearchOptions(
		options: MDSearchOption[],
		original: string,
		div: HTMLDivElement = document.getElementById("searchOptions") as HTMLDivElement,
		typebox?: MarkDown,
	) {
		if (!div) return;
		div.innerHTML = "";
		let i = 0;
		const htmloptions: HTMLSpanElement[] = [];

		for (const {name, replace, icon, otherLogic} of options) {
			if (i == 8) {
				break;
			}
			i++;
			const span = document.createElement("span");
			htmloptions.push(span);
			if (icon) {
				span.append(icon);
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
				if (!otherLogic?.() && typebox) {
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
		if (this.focusGuild && this.focusGuild.id !== "@me") {
			for (const channel of this.focusGuild.channels.filter((_) => _.visible)) {
				const confidence = channel.similar(name);
				if (confidence > 0) {
					maybe.push([confidence, channel]);
				}
			}
		}
		maybe.sort((a, b) => b[0] - a[0]);
		this.MDSearchOptions(
			maybe.map((a) => {
				return {name: "# " + a[1].shortName, replace: `<#${a[1].id}> `};
			}),
			original,
			box,
			typebox,
		);
	}
	MDFineMentionGen(name: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		let members: [Member | Role | User | "@everyone" | "@here", number][] = [];
		if (this.focusGuild && name !== "everyone" && name !== "here") {
			if (this.focusGuild.id === "@me") {
				const dirrect = this.focusChannel as Group;

				for (const user of dirrect.users) {
					const rank = user.compare(name);
					if (rank > 0) {
						members.push([user, rank]);
					}
				}
			} else {
				for (const [_, member] of this.focusGuild.members) {
					if (!this.focusChannel?.hasPermission("VIEW_CHANNEL", member)) continue;
					const rank = member.compare(name);
					if (rank > 0) {
						members.push([member, rank]);
					}
				}
				for (const role of this.focusGuild.roles.filter((_) => _.id !== this.focusGuild?.id)) {
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
			members.map(([member]) => {
				const icon =
					member instanceof Member
						? member.user.buildpfp(member)
						: member instanceof User
							? member.buildpfp()
							: undefined;
				icon?.classList.add("pfpSearch");
				return {
					name: typeof member === "string" ? member : "@" + member.name,
					replace:
						member instanceof Role
							? `<@&${member.id}> `
							: typeof member === "string"
								? member + " "
								: `<@${member.id}> `,
					icon: icon,
				};
			}),
			original,
			box,
			typebox,
		);
	}
	private MDGenID = 0;
	MDFindMention(name: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		if (this.ws && this.focusGuild) {
			const id = ++this.MDGenID;
			this.MDFineMentionGen(name, original, box, typebox);
			if (this.focusGuild.member_count <= this.focusGuild.members.size) return;
			if (this.focusGuild.id !== "@me") {
				this.focusGuild.searchMembers(8, name).then(async () => {
					if (!typebox.rawString.startsWith(original)) return;
					if (this.MDGenID === id) this.MDFineMentionGen(name, original, box, typebox);
				});
			}
		}
	}
	findEmoji(search: string, original: string, box: HTMLDivElement, typebox: MarkDown) {
		const emj = Emoji.searchEmoji(search, this, 10);
		const map = emj.map(([emoji]): MDSearchOption => {
			return {
				name: emoji.name,
				replace: emoji.id
					? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
					: (emoji.emoji as string),
				icon: emoji.getHTML(),
				otherLogic: () => {
					this.favorites.addEmoji(emoji.id || (emoji.emoji as string));
					return false;
				},
			};
		});
		this.MDSearchOptions(map, original, box, typebox);
	}
	async findCommands(search: string, box: HTMLDivElement, md: MarkDown) {
		const guild = this.focusGuild;
		if (!guild) return;
		const commands = await guild.getCommands();
		const sorted = commands
			.map((_) => [_, _.similar(search)] as const)
			.filter((_) => _[1] !== 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		this.MDSearchOptions(
			sorted.map(([elm]) => {
				return {
					name: `/${elm.localizedName}`,
					replace: "",
					otherLogic: () => {
						this.focusChannel?.startCommand(elm);
						return true;
					},
				};
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
	makePoll() {
		const d = new Dialog(I18n.makePoll());
		const opt = d.options;
		const q = opt.addTextInput(I18n.poll.question(), () => {});
		opt.addText(I18n.poll.answers());
		const ansField = document.createElement("div");
		ansField.classList.add("flexttb", "pollAnsM");
		const answers = ["", ""] as string[];
		const genAnswerField = () => {
			ansField.textContent = "";
			for (let i = 0; i < answers.length; i++) {
				const si = i;
				const div = document.createElement("div");
				div.classList.add("flexltr");
				const input = document.createElement("input");
				input.type = "text";
				input.value = answers[i];
				input.onchange = () => {
					answers[si] = input.value;
				};

				const del = document.createElement("span");
				del.classList.add("svg-delete", "svgicon");
				div.append(input, del);
				del.onclick = () => {
					answers.splice(si, 1);
					genAnswerField();
				};
				ansField.append(div);
			}
		};
		genAnswerField();
		opt.addHTMLArea(ansField);
		opt.addButtonInput("", I18n.poll.newAnswer(), () => {
			answers.push("");
			genAnswerField();
		});
		const hours = [1, 4, 8, 24, 72, 168, 336] as const;
		const h = opt.addSelect(
			I18n.poll.duration(),
			() => {},
			//@ts-ignore-error this is fine :P
			hours.map((_) => I18n.poll.durCount[_ + ""]()),
			{
				defaultIndex: 3,
			},
		);
		const c = opt.addCheckboxInput(I18n.poll.mult(), () => {});
		opt.addButtonInput("", I18n.submit(), () => {
			const chan = this.focusChannel;
			if (!chan) return;
			chan.sendMessage("", {
				poll: {
					question: {
						text: q.value,
					},
					answers: answers.map((_) => ({poll_media: {text: _}})),
					duration: hours[h.index] as number,
					allow_multiselect: c.value,
				},
			});
			d.hide();
		});
		d.show();
	}
	curSearch?: Symbol;
	pollUpdateSubMap = new Map<string, (u: pollUpdateJson) => void>();
	subToPollUpdate(m: string, func: ((u: pollUpdateJson) => void) | null) {
		if (func) this.pollUpdateSubMap.set(m, func);
		else this.pollUpdateSubMap.delete(m);
	}
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
		let authorIds = [] as string[];
		let mentionIds = [] as string[];
		let channels = [] as Channel[];
		const genPage = (page: number) => {
			p.set("offset", page * 50 + "");
			const guildSearch = this.focusGuild?.id !== "@me";
			fetch(
				this.info.api +
					`${guildSearch ? `/guilds/${this.focusGuild?.id}` : `/channels/${this.focusChannel?.id}`}/messages/search/?` +
					p.toString() +
					(authorIds.length ? authorIds.map((_) => `&author_id=${_}`).join("") : "") +
					(mentionIds.length ? mentionIds.map((_) => `&mentions=${_}`).join("") : "") +
					(channels.length ? channels.map((_) => `&channel_id=${_.id}`).join("") : ""),
				{
					headers: this.headers,
				},
			)
				.then((_) => _.json())
				.then((json: {messages: [messagejson][]; total_results: number}) => {
					if (this.curSearch !== searchy) {
						return;
					}
					//FIXME total_results shall be ignored as it's known to be bad, spacebar bug.
					const messages = json.messages
						.map(([m]) => {
							const c = this.channels.get(m.channel_id);
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

					const settingsB = document.createElement("button");
					settingsB.textContent = I18n.search.settings();
					settingsB.onclick = () => {
						const d = new Dialog(I18n.search.settings());
						const opt = d.options;
						const b = p.get("max_id");
						const before = opt.addDateInput(I18n.search.before(), () => {}, {
							initText: b ? new Date(SnowFlake.stringToUnixTime(b)) : undefined,
						});
						before.onchange = (_) => {
							if (before.dateValue) p.set("max_id", SnowFlake.DateToID(before.dateValue));
							else p.delete("max_id");
							console.log([...p.entries()], before.dateValue);
						};

						const a = p.get("min_id");
						const after = opt.addDateInput(I18n.search.after(), () => {}, {
							initText: a ? new Date(SnowFlake.stringToUnixTime(a)) : undefined,
						});
						after.onchange = (_) => {
							if (after.dateValue) p.set("min_id", SnowFlake.DateToID(after.dateValue));
							else p.delete("min_id");
							console.log([...p.entries()], after.dateValue);
						};
						opt.addCheckboxInput(I18n.search.includensfw(), () => {}, {
							initState: p.get("include_nsfw") !== "false",
						}).onchange = (s) => {
							if (s) p.delete("include_nsfw");
							else p.set("include_nsfw", "false");
						};
						const userSearch = async (name: string, ids: string[]) => {
							const g = this.focusGuild;
							if (!g) return [];
							g.searchMembers(8, name);
							const members = [] as [User | Member, number][];
							if (g.id === "@me") {
								const dirrect = this.focusChannel as Group;

								for (const user of dirrect.users) {
									const rank = user.compare(name);
									if (rank > 0) {
										members.push([user, rank]);
									}
								}
							} else {
								for (const [_, member] of g.members) {
									const rank = member.compare(name);
									if (rank > 0) {
										members.push([member, rank]);
									}
								}
							}
							const idSet = new Set(ids);
							members.sort((a, b) => b[1] - a[1]);

							return members
								.filter((_) => !idSet.has(_[0].id))
								.slice(0, 5)
								.map(([_]) => {
									return {value: _.id, name: _.name};
								});
						};
						opt.addAsyncMultiSelect(I18n.search.authors(), () => {}, userSearch, {
							defaultValues: authorIds
								.map((id) => {
									const g = this.focusGuild;
									if (!g || g.id === "@me") {
										return this.userMap.get(id);
									} else {
										return [...g.members.values()].find(({id: d}) => d === id);
									}
								})
								.filter((_) => _ !== undefined)
								.map((_) => ({value: _.id, name: _.name})),
						}).onchange = (values: string[]) => {
							authorIds = values;
						};

						opt.addAsyncMultiSelect(I18n.search.mentions(), () => {}, userSearch, {
							defaultValues: mentionIds
								.map((id) => {
									const g = this.focusGuild;
									if (!g || g.id === "@me") {
										return this.userMap.get(id);
									} else {
										return [...g.members.values()].find(({id: d}) => d === id);
									}
								})
								.filter((_) => _ !== undefined)
								.map((_) => ({value: _.id, name: _.name})),
						}).onchange = (values: string[]) => {
							mentionIds = values;
						};
						if (this.focusGuild?.id !== "@me")
							opt.addAsyncMultiSelect(
								I18n.search.channels(),
								() => {},
								(name, ids) => {
									const g = this.focusGuild;
									if (!g) return [];
									const c = g.channels.filter((_) => _.visible);

									const maybe: [number, Channel][] = [];

									for (const channel of c) {
										const confidence = channel.similar(name);
										if (confidence > 0) {
											maybe.push([confidence, channel]);
										}
									}

									maybe.sort((a, b) => b[0] - a[0]);
									const idSet = new Set(ids);

									return maybe
										.filter((_) => !idSet.has(_[1].id))
										.slice(0, 5)
										.map(([_r, _]) => {
											return {value: _.id, name: _.name};
										});
								},
								{
									defaultValues: channels.map((_) => ({name: _.name, value: _.id})),
								},
							).onchange = (values: string[]) => {
								const g = this.focusGuild;
								if (!g) return;
								channels = values.map((id) => g.getChannel(id)).filter((_) => _ !== undefined);
							};
						d.onhide = () => {
							genPage(0);
						};
						d.show();
					};

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

					sortBar.append(I18n.search.page(page + 1 + ""), spaceElm, settingsB, newB, old);

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
								await message.channel.focus(message.id);
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
				this.focusGuild?.markAsRead();
			} else {
				this.focusChannel?.readbottom();
				this.focusChannel?.goToBottom();
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
		const prefs = getPreferences();
		const fontName = prefs.emojiFont;

		if (this.font) {
			//TODO see when/if this can be removed
			//@ts-ignore this is stupid. it's been here since 2020
			document.fonts.delete(this.font);
		}

		const realname = this.fonts.find((_) => _[1] === fontName)?.[0];
		if (realname) {
			const font = new FontFace("emojiFont", `url("/emoji/${realname}")`);
			await font.load();
			console.error("Loaded font:", fontName, "/", realname);
			//TODO see when/if this can be removed
			//@ts-ignore this is stupid. it's been here since 2020
			document.fonts.add(font);
			console.log(font);
			this.font = font;
		}
	}
	static get fonts() {
		const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
		return [
			[`NotoColorEmoji-Regular.${isFirefox ? "woff2" : "ttf"}`, "Noto Color Emoji"],
			[`OpenMoji-color-glyf_colr_0.woff2`, "OpenMoji"],
			[`Twemoji-16.0.1.${isFirefox ? "woff2" : "ttf"}`, "Twemoji"],
			[`BlobmojiCompat.${isFirefox ? "woff2" : "ttf"}`, "Blobmoji"],
		] as const;
	}
	readonly getMemberMap = new Map<string, Promise<Member | undefined>>();
	async getMember(id: string, guildid: string): Promise<Member | undefined> {
		const user = this.userMap.get(id);
		const guild = this.guilds.get(guildid) as Guild;
		if (user) {
			const memb = user.members.get(guild);
			if (memb) return memb;
		}
		const uid = id + "-" + guildid;
		const prom = this.getMemberMap.get(uid);
		if (prom) return prom;
		const prom2 = new Promise<Member | undefined>(async (res) => {
			const json = await this.resolvemember(id, guildid);
			if (!json) {
				res(undefined);
				return;
			}
			res(Member.new(json, guild));
		});
		this.getMemberMap.set(uid, prom2);
		return prom2;
	}
	memberLock = new PromiseLock();
	async resolvemember(id: string, guildid: string): Promise<memberjson | undefined> {
		if (guildid === "@me") {
			return undefined;
		}
		const guild = this.guilds.get(guildid);
		//TODO well, maybe think this over, I set the member count and whatnot, maybe for "large enough" guilds I return a member that's filled out blankly unless its needed to be fully resolved, added stuff to identify to make it work
		const borked = false;
		if (!guild || (borked && guild.member_count > 250)) {
			const unlock = await this.memberLock.acquireLock();
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
			} finally {
				unlock();
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
	private readonly fetchingmembers = new Map<string, boolean>();
	private readonly memberNonceMap = new Map<string, (r: [memberjson[], string[]]) => void>();
	private readonly memberNonceBuild = new Map<string, [memberjson[], string[], number[]]>();
	private readonly searchMap = new Map<
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
		const arr = this.memberNonceBuild.get(chunk.nonce);
		if (!arr) return;
		arr[0] = arr[0].concat(chunk.members);
		if (chunk.not_found) {
			arr[1] = chunk.not_found;
		}
		arr[2].push(chunk.chunk_index);
		if (arr[2].length === chunk.chunk_count) {
			this.memberNonceBuild.delete(chunk.nonce);
			const func = this.memberNonceMap.get(chunk.nonce);
			if (!func) return;
			func([arr[0], arr[1]]);
			this.memberNonceMap.delete(chunk.nonce);
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
					this.memberNonceMap.set(nonce, res);
					this.memberNonceBuild.set(nonce, [[], [], []]);
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

	private refreshTimeOut?: NodeJS.Timeout;
	private urlsToRefresh: [string, (arg: string) => void][] = [];
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
	async playSound(name = this.getNotificationSound()) {
		const volume = this.getNotiVolume();
		if (this.play) {
			const voice = this.play.tracks.includes(name);
			if (voice) {
				this.play.play(name, volume);
			} else {
				const audio = document.createElement("audio");
				let sound = await this.fs.getFile("/customSound", false);
				if (this.perminfo.sound?.cSound) {
					const s = this.perminfo.sound.cSound as string;
					if (!s) return;
					const byteString = s.split(",")[1];

					sound = await this.fs.getFile("/customSound", true);
					if (!sound) return;
					await sound.write(decode64(byteString));
					delete this.perminfo.sound;
				}
				if (!sound) return;
				audio.volume = volume / 100;
				audio.src = await sound.getURL();
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
Localuser.globalShortcuts.listen(document.body);
Localuser.initShortcuts();
export {Localuser};
