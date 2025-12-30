import {I18n} from "../i18n.js";
import {MarkDown} from "../markdown.js";
import {Dialog} from "../settings.js";
import {fix} from "./cssMagic.js";
import {messageFrom, messageTo} from "./serviceType.js";
import {isLoopback, trimTrailingSlashes} from "./netUtils";

fix();
const apiDoms = new Set<string>();
let instances:
	| {
			name: string;
			description?: string;
			descriptionLong?: string;
			image?: string;
			url?: string;
			display?: boolean;
			online?: boolean;
			uptime: {alltime: number; daytime: number; weektime: number};
			urls: {
				wellknown: string;
				api: string;
				cdn: string;
				gateway: string;
				login?: string;
			};
	  }[]
	| null = null;
setTheme();
export function setTheme() {
	let name = localStorage.getItem("theme");
	if (!name) {
		localStorage.setItem("theme", "Dark");
		name = "Dark";
	}
	document.body.className = name + "-theme";
}
export function getBulkUsers() {
	const json = getBulkInfo();
	apiDoms.clear();
	for (const thing in json.users) {
		const user = (json.users[thing] = new Specialuser(json.users[thing]));
		apiDoms.add(new URL(user.serverurls.api).host);
	}
	if (localStorage.getItem("capTrace")) {
		SW.postMessage({
			code: "apiUrls",
			hosts: [...apiDoms],
		});
	} else {
		SW.postMessage({
			code: "apiUrls",
			hosts: undefined,
		});
	}
	return json;
}
export function getBulkInfo() {
	return JSON.parse(localStorage.getItem("userinfos") as string);
}
export function setDefaults() {
	let userinfos = getBulkInfo();
	if (!userinfos) {
		localStorage.setItem(
			"userinfos",
			JSON.stringify({
				currentuser: null,
				users: {},
				preferences: {
					theme: "Dark",
					notifications: false,
					notisound: "three",
				},
			}),
		);
		userinfos = getBulkInfo();
	}
	if (userinfos.users === undefined) {
		userinfos.users = {};
	}
	if (userinfos.accent_color === undefined) {
		userinfos.accent_color = "#3096f7";
	}
	document.documentElement.style.setProperty("--accent-color", userinfos.accent_color);
	if (userinfos.preferences === undefined) {
		userinfos.preferences = {
			theme: "Dark",
			notifications: false,
			notisound: "three",
		};
	}
	if (userinfos.preferences && userinfos.preferences.notisound === undefined) {
		console.warn("uhoh");
		userinfos.preferences.notisound = "three";
	}
	localStorage.setItem("userinfos", JSON.stringify(userinfos));
}
setDefaults();
export class Specialuser {
	serverurls: InstanceUrls;
	email: string;
	token: string;
	loggedin;
	json;
	constructor(json: any) {
		if (json instanceof Specialuser) {
			console.error("specialuser can't construct from another specialuser");
		}
		this.serverurls = json.serverurls;
		let apistring = new URL(json.serverurls.api).toString();
		apistring = apistring.replace(/\/(v\d+\/?)?$/, "") + "/v9";
		this.serverurls.api = apistring;
		this.serverurls.cdn = new URL(json.serverurls.cdn).toString().replace(/\/$/, "");
		this.serverurls.gateway = new URL(json.serverurls.gateway).toString().replace(/\/$/, "");
		this.serverurls.wellknown = new URL(json.serverurls.wellknown).toString().replace(/\/$/, "");
		this.email = json.email;
		this.token = json.token;
		this.loggedin = json.loggedin;
		this.json = json;
		this.json.localuserStore ??= {};
		if (!this.serverurls || !this.email || !this.token) {
			console.error("There are fundamentally missing pieces of info missing from this user");
		}
	}
	async logout() {
		for (let i = 0; i < 3; i++) {
			try {
				const ok = (
					await fetch(this.serverurls.api + "/auth/logout", {
						method: "POST",
						headers: {Authorization: this.token},
					})
				).ok;
				if (ok) break;
			} catch {}
			if (i == 2) {
				const d = new Dialog("");
				if (
					await new Promise<boolean>((res) => {
						const buttons = d.options.addOptions(I18n.logout.error.title(), {
							ltr: true,
						});
						buttons.addText(I18n.logout.error.desc());
						buttons.addButtonInput("", I18n.logout.error.cont(), () => {
							res(false);
							d.hide();
						});
						buttons.addButtonInput("", I18n.logout.error.cancel(), () => {
							res(true);
							d.hide();
						});
						d.show();
					})
				)
					return false;
			}
		}
		this.remove();
		return true;
	}
	remove() {
		const info = getBulkInfo();
		delete info.users[this.uid];
		if (info.currentuser === this.uid) {
			const user = info.users[0];
			if (user) {
				info.currentuser = new Specialuser(user).uid;
			} else {
				info.currentuser = null;
			}
		}
		if (sessionStorage.getItem("currentuser") === this.uid) {
			sessionStorage.removeItem("currentuser");
		}
		localStorage.setItem("userinfos", JSON.stringify(info));
	}
	set pfpsrc(e) {
		this.json.pfpsrc = e;
		this.updateLocal();
	}
	get pfpsrc() {
		return this.json.pfpsrc;
	}
	set username(e) {
		this.json.username = e;
		this.updateLocal();
	}
	get username() {
		return this.json.username;
	}
	set localuserStore(e) {
		this.json.localuserStore = e;
		this.updateLocal();
	}
	proxySave(e: Object) {
		return new Proxy(e, {
			set: (target, p, newValue, receiver) => {
				const bool = Reflect.set(target, p, newValue, receiver);
				try {
					this.updateLocal();
				} catch (_) {
					Reflect.deleteProperty(target, p);
					throw _;
				}
				return bool;
			},
			get: (target, p, receiver) => {
				const value = Reflect.get(target, p, receiver) as unknown;
				if (value instanceof Object) {
					return this.proxySave(value);
				}
				return value;
			},
		});
	}
	get localuserStore() {
		type jsonParse = {
			[key: string | number]: any;
		};
		return this.proxySave(this.json.localuserStore) as {
			[key: string | number]: jsonParse;
		};
	}
	set id(e) {
		this.json.id = e;
		this.updateLocal();
	}
	get id() {
		return this.json.id;
	}
	get uid() {
		return this.email + this.serverurls.wellknown;
	}
	toJSON() {
		return this.json;
	}
	updateLocal() {
		const info = getBulkInfo();
		info.users[this.uid] = this.toJSON();
		localStorage.setItem("userinfos", JSON.stringify(info));
	}
}
//this currently does not work, and need to be implemented better at some time.
if (!localStorage.getItem("SWMode")) {
	localStorage.setItem("SWMode", "SWOn");
}
export function trimswitcher() {
	const json = getBulkInfo();
	const map = new Map();
	for (const thing in json.users) {
		const user = json.users[thing];
		let wellknown = user.serverurls.wellknown;
		if (wellknown.at(-1) !== "/") {
			wellknown += "/";
		}
		wellknown = (user.id || user.email) + "@" + wellknown;
		if (map.has(wellknown)) {
			const otheruser = map.get(wellknown);
			if (otheruser[1].serverurls.wellknown.at(-1) === "/") {
				delete json.users[otheruser[0]];
				map.set(wellknown, [thing, user]);
			} else {
				delete json.users[thing];
			}
		} else {
			map.set(wellknown, [thing, user]);
		}
	}
	for (const thing in json.users) {
		if (thing.at(-1) === "/") {
			const user = json.users[thing];
			delete json.users[thing];
			json.users[thing.slice(0, -1)] = user;
		}
	}
	localStorage.setItem("userinfos", JSON.stringify(json));
	console.log(json);
}
export function adduser(user: typeof Specialuser.prototype.json): Specialuser {
	const suser = new Specialuser(user);
	const info = getBulkInfo();
	info.users[suser.uid] = suser;
	info.currentuser = suser.uid;
	sessionStorage.setItem("currentuser", suser.uid);
	localStorage.setItem("userinfos", JSON.stringify(info));
	return suser;
}
class Directory {
	static home = this.createHome();
	handle: FileSystemDirectoryHandle;
	writeWorker?: Worker;
	private constructor(handle: FileSystemDirectoryHandle) {
		this.handle = handle;
	}
	static async createHome(): Promise<Directory> {
		navigator.storage.persist();
		const home = new Directory(await navigator.storage.getDirectory());
		return home;
	}
	async *getAllInDir() {
		for await (const [name, handle] of this.handle.entries()) {
			if (handle instanceof FileSystemDirectoryHandle) {
				yield [name, new Directory(handle)] as [string, Directory];
			} else if (handle instanceof FileSystemFileHandle) {
				yield [name, await handle.getFile()] as [string, File];
			} else {
				console.log(handle, "oops :3");
			}
		}
		console.log("done");
	}
	async getRawFileHandler(name: string) {
		return await this.handle.getFileHandle(name);
	}
	async getRawFile(name: string) {
		try {
			return await (await this.handle.getFileHandle(name)).getFile();
		} catch {
			return undefined;
		}
	}
	async getString(name: string): Promise<string | undefined> {
		try {
			return await (await this.getRawFile(name))!.text();
		} catch {
			return undefined;
		}
	}
	initWorker() {
		if (this.writeWorker) return this.writeWorker;
		this.writeWorker = new Worker("/utils/dirrWorker.js");
		this.writeWorker.onmessage = (event) => {
			const res = this.wMap.get(event.data[0]);
			this.wMap.delete(event.data[0]);
			if (!res) throw new Error("Res is not defined here somehow");
			res(event.data[1]);
		};
		return this.writeWorker;
	}
	wMap = new Map<number, (input: boolean) => void>();
	async setStringWorker(name: FileSystemFileHandle, value: ArrayBuffer) {
		const worker = this.initWorker();
		const random = Math.random();
		worker.postMessage([name, value, random]);
		return new Promise<boolean>((res) => {
			this.wMap.set(random, res);
		});
	}
	async setString(name: string, value: string): Promise<boolean> {
		const file = await this.handle.getFileHandle(name, {create: true});
		const contents = new TextEncoder().encode(value);

		if (file.createWritable as unknown) {
			const stream = await file.createWritable({keepExistingData: false});
			await stream.write(contents);
			await stream.close();
			return true;
		} else {
			//Curse you webkit!
			return await this.setStringWorker(file, contents.buffer as ArrayBuffer);
		}
	}
	async getDir(name: string) {
		return new Directory(await this.handle.getDirectoryHandle(name, {create: true}));
	}
}

export {Directory};

const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
export {mobile, iOS};

const datalist = document.getElementById("instances");
console.warn(datalist);
export const instancefetch = fetch("/instances.json")
	.then((res) => res.json())
	.then(
		async (
			json: {
				name: string;
				description?: string;
				descriptionLong?: string;
				image?: string;
				url?: string;
				display?: boolean;
				online?: boolean;
				uptime: {alltime: number; daytime: number; weektime: number};
				urls: {
					wellknown: string;
					api: string;
					cdn: string;
					gateway: string;
					login?: string;
				};
			}[],
		) => {
			await I18n.done;
			instances = json;
		},
	);
const stringURLMap = new Map<string, string>();

const stringURLsMap = new Map<
	string,
	{
		wellknown: string;
		api: string;
		cdn: string;
		gateway: string;
		login?: string;
	}
>();

export interface InstanceUrls {
	admin?: string;
	api: string;
	cdn: string;
	gateway: string;
	wellknown: string;
}

export interface InstanceInfo extends InstanceUrls {
	value: string;
}

export async function getapiurls(str: string): Promise<InstanceUrls | null> {
	str = str.trim();
	if (!str) return null;

	console.info("Attempting to fetch .well-known's for", str);

	// Override first:
	let urls: InstanceUrls | null = await getInstanceInfo(str);
	if (urls) return urls;

	// Otherwise, fall back to looking it up...
	try {
		urls = await getApiUrlsV2(str);
		if (!urls) throw new Error("meow");
		return urls;
	} catch {
		return await getApiUrlsV1(str);
	}
}

//region Instance list
export async function getInstanceInfo(str: string): Promise<InstanceInfo | null> {
	// wait for it to be loaded...? Where is this even comming from?
	if (stringURLMap.size == 0) {
		await new Promise<void>((res, _) => {
			let intervalId = setInterval(() => {
				if (stringURLMap.size !== 0) {
					clearInterval(intervalId);
					res();
				}
			}, 10);
		});
	}

	console.info("Checking if we already know", str, "in our instance lists:", {
		stringURLMap,
		stringURLsMap,
	});

	if (stringURLMap.has(str)) {
		console.error("OOH WE GOT STRING->URL MAP ENTRY FOR", str, "!!!!", stringURLMap.get(str));
		return (await getapiurls(stringURLMap.get(str)!)) as InstanceInfo;
	}

	if (stringURLsMap.has(str)) {
		console.error(
			"WE GOT URL->INSTANCE MAP ENTRY FOR ",
			str,
			"!!!!!!!!!!11",
			stringURLsMap.get(str),
		);
		return stringURLsMap.get(str) as InstanceInfo;
	}

	return null;
}
//endregion

//region Well-Known v2
export async function getApiUrlsV2(str: string): Promise<InstanceUrls | null> {
	if (!URL.canParse(str)) {
		console.log("getApiUrlsV2:", str, "is not a parseable url");
		return null;
	}
	try {
		const info = await fetch(str + "/.well-known/spacebar/client").then((r) => r.json());
		return {
			admin: info.admin?.baseUrl,
			api: info.api.baseUrl + "/api/v" + info.api.apiVersions.default,
			gateway: info.gateway.baseUrl,
			cdn: info.cdn.baseUrl,
			wellknown: str,
		};
	} catch (e) {
		console.log("No .well-known v2 for", str, (e as Error).message);
		return null;
	}
}
//endregion

//region Well-Known v1
/**
 * this function checks if a string is an instance, it'll either return the API urls or null
 */
export async function getApiUrlsV1(str: string): Promise<InstanceUrls | null> {
	function appendApi(str: string) {
		return str.includes("api") ? str : str.endsWith("/") ? str + "api" : str + "/api";
	}
	if (!URL.canParse(str)) {
		if (stringURLMap.size === 0) {
			await new Promise<void>((res) => {
				let intervalID = setInterval(() => {
					if (stringURLMap.size !== 0) {
						clearInterval(intervalID);
						res();
					}
				}, 100);
			});
		}
		const val = stringURLMap.get(str);
		if (val) {
			str = val;
		} else {
			const val = stringURLsMap.get(str);
			if (val) {
				const response = await fetch(val.api + (val.api.endsWith("/") ? "" : "/") + "ping");
				if (response.ok) {
					if (val.login) {
						return val as InstanceUrls;
					} else {
						val.login = val.api;
						return val as InstanceUrls;
					}
				}
			} else if (!str.match(/^https?:\/\//gm)) {
				str = "https://" + str;
			}
		}
	}
	if (str.at(-1) !== "/") {
		str += "/";
	}
	let api: string;
	try {
		const info = await fetch(`${str}.well-known/spacebar`).then((x) => x.json());
		api = trimTrailingSlashes(info.api);
	} catch {
		api = str;
	}
	if (!URL.canParse(api)) {
		return null;
	}
	const url = new URL(api);
	let urls: undefined | InstanceUrls;
	function fixApi() {
		if (!urls) return;
		urls = {
			wellknown: trimTrailingSlashes(urls.wellknown),
			api: trimTrailingSlashes(urls.api),
			cdn: trimTrailingSlashes(urls.cdn),
			gateway: trimTrailingSlashes(urls.gateway),
		};
	}

	try {
		const info = await fetch(
			`${api}${url.pathname.includes("api") ? "" : "api"}/policies/instance/domains`,
		).then((x) => x.json());
		const apiurl = new URL(info.apiEndpoint);
		urls = {
			api: apiurl.origin + appendApi(apiurl.pathname),
			gateway: info.gateway,
			cdn: info.cdn,
			wellknown: str,
		};
		fixApi();
	} catch {
		const val = stringURLsMap.get(str);
		if (val) {
			const response = await fetch(trimTrailingSlashes(val.api) + "/ping");
			if (response.ok) {
				if (val.login) {
					urls = val as InstanceUrls;
					fixApi();
				} else {
					val.login = val.api;
					urls = val as InstanceUrls;
					fixApi();
				}
			}
		}
	}
	if (urls) {
		if (isLoopback(urls.api) !== isLoopback(str)) {
			return new Promise<InstanceUrls | null>((res) => {
				const menu = new Dialog("");
				const options = menu.float.options;
				options.addMDText(new MarkDown(I18n.incorrectURLS(), undefined));
				const opt = options.addOptions("", {ltr: true});
				let clicked = false;
				opt.addButtonInput("", I18n.yes(), async () => {
					if (clicked) return;
					clicked = true;
					if (urls == null) throw new Error("How the fuck was `urls` null here?");
					const temp = new URL(str);
					temp.port = "";
					const newOrigin = temp.host;
					const protocol = temp.protocol;
					const tempurls = {
						api: new URL(urls.api),
						cdn: new URL(urls.cdn),
						gateway: new URL(urls.gateway),
						wellknown: new URL(urls.wellknown),
					};
					tempurls.api.host = newOrigin;
					tempurls.api.protocol = protocol;

					tempurls.cdn.host = newOrigin;
					tempurls.api.protocol = protocol;

					tempurls.gateway.host = newOrigin;
					tempurls.gateway.protocol = temp.protocol === "http:" ? "ws:" : "wss:";

					tempurls.wellknown.host = newOrigin;
					tempurls.wellknown.protocol = protocol;

					try {
						if (
							!(
								await fetch(
									tempurls.api + (tempurls.api.toString().endsWith("/") ? "" : "/") + "ping",
								)
							).ok
						) {
							res(null);
							menu.hide();
							return;
						}
					} catch {
						res(null);
						menu.hide();
						return;
					}
					res({
						api: tempurls.api.toString(),
						cdn: tempurls.cdn.toString(),
						gateway: tempurls.gateway.toString(),
						wellknown: tempurls.wellknown.toString(),
					});
					menu.hide();
				});
				const no = opt.addButtonInput("", I18n.no(), async () => {
					if (clicked) return;
					clicked = true;
					if (urls == null) throw new Error("How the fuck was `urls` null here?");
					try {
						//TODO make this a promise race for when the server just never responds
						//TODO maybe try to strip ports as another way to fix it
						if (!(await fetch(urls.api + "ping")).ok) {
							res(null);
							menu.hide();
							return;
						}
					} catch {
						res(null);
						return;
					}
					res(urls);
					menu.hide();
				});
				const span = document.createElement("span");
				options.addHTMLArea(span);
				const t = setInterval(() => {
					if (!document.contains(span)) {
						clearInterval(t);
						no.onClick();
					}
				}, 100);
				menu.show();
			});
		}
		//*/
		try {
			if (!(await fetch(urls.api + "/ping")).ok) {
				return null;
			}
		} catch {
			return null;
		}
		return urls;
	}
	return null;
}
//endregion

async function isAnimated(src: string) {
	try {
		src = new URL(src).pathname;
	} catch {}
	return src.endsWith(".apng") || src.endsWith(".gif") || src.split("/").at(-1)?.startsWith("a_");
}
const staticImgMap = new Map<string, string | Promise<string>>();
export async function removeAni(elm: HTMLElement, time = 500) {
	elm.classList.add("removeElm");
	const ani = elm.getAnimations();
	await Promise.race([
		Promise.all(ani.map((_) => _.finished)),
		new Promise<void>((res) => setTimeout(res, time)),
	]);
	if (document.contains(elm)) elm.remove();
}
export type safeImg = HTMLImageElement & {
	setSrcs: (nsrc: string, nstaticsrc: string | void) => void;
	isAnimated: () => Promise<boolean>;
};
export function createImg(
	src: string | undefined,
	staticsrc: string | void,
	elm: HTMLElement | void,
	type: "gif" | "icon" = "gif",
): safeImg {
	const settings =
		localStorage.getItem(type === "gif" ? "gifSetting" : "iconSetting") ||
		("hover" as "hover") ||
		"always" ||
		"never";
	const img = document.createElement("img");
	img.addEventListener("error", () => {
		img.classList.add("error");
	});
	elm ||= img;
	if (src) {
		isAnimated(src).then((animated) => {
			if (animated) {
				img.crossOrigin = "anonymous";
			}
			img.src = settings !== "always" ? staticsrc || src || "" : src || "";
		});
	}
	img.onload = async () => {
		if (settings === "always") return;
		if (!src) return;
		if ((await isAnimated(src)) && !staticsrc) {
			let s = staticImgMap.get(src);
			if (s) {
				staticsrc = await s;
			} else {
				staticImgMap.set(
					src,
					new Promise(async (res) => {
						const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
						const ctx = c.getContext("2d");
						if (!ctx) return;
						ctx.drawImage(img, 0, 0);
						const blob = await c.convertToBlob();
						res(URL.createObjectURL(blob));
					}),
				);
				staticsrc = (await staticImgMap.get(src)) as string;
			}
			img.src = staticsrc;
		}
	};
	elm.onmouseover = () => {
		if (settings === "never") return;
		if (img.src !== src && src) {
			img.src = src;
		}
	};
	elm.onmouseleave = () => {
		if (staticsrc && settings !== "always") {
			img.src = staticsrc;
		}
	};

	return Object.assign(img, {
		setSrcs: (nsrc: string, nstaticsrc: string | void) => {
			src = nsrc;
			staticsrc = nstaticsrc;
			if (src) {
				isAnimated(src).then((animated) => {
					if (animated) {
						img.crossOrigin = "anonymous";
					}
					img.src = settings !== "always" ? staticsrc || src || "" : src || "";
				});
			}
		},
		isAnimated: async () => {
			return !!(src && (await isAnimated(src)));
		},
	});
}

/**
 *
 * This function takes in a string and checks if the string is a valid instance
 * the string may be a URL or the name of the instance
 * the alt property is something you may fire on success.
 */
const checkInstance = Object.assign(
	async function (
		instance: string,
		verify = document.getElementById("verify"),
		loginButton = (document.getElementById("loginButton") ||
			document.getElementById("createAccount") ||
			document.createElement("button")) as HTMLButtonElement,
	) {
		await instancefetch;
		try {
			loginButton.disabled = true;
			verify!.textContent = I18n.login.checking();
			const instanceValue = instance;
			const instanceinfo = (await getapiurls(instanceValue)) as InstanceInfo;
			if (instanceinfo) {
				instanceinfo.value = instanceValue;
				localStorage.setItem("instanceinfo", JSON.stringify(instanceinfo));
				verify!.textContent = I18n.login.allGood();
				loginButton.disabled = false;
				if (checkInstance.alt) {
					checkInstance.alt(instanceinfo);
				}
				setTimeout((_: any) => {
					console.log(verify!.textContent);
					verify!.textContent = "";
				}, 3000);
				return instanceinfo;
			} else {
				verify!.textContent = I18n.login.invalid();
				loginButton.disabled = true;
				return;
			}
		} catch {
			console.log("catch");
			verify!.textContent = I18n.login.invalid();
			loginButton.disabled = true;
			return;
		}
	},
	{} as {
		alt?: (e: InstanceInfo) => void;
	},
);
{
	//TODO look at this and see if this can be made less hacky :P
	const originalFetch = window.fetch;
	window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
		const url = new URL(input instanceof Request ? input.url : input, window.location.href);
		if (apiDoms.has(url.host)) {
			init = init || {};
			init.credentials ??= "include";
		}

		return originalFetch(input, init);
	};
}
export {checkInstance};

export class SW {
	static worker: undefined | ServiceWorker;
	static port?: MessagePort;
	static init() {
		SW.setMode(
			(localStorage.getItem("SWMode") as "false" | "offlineOnly" | "true" | undefined) || "true",
		);
		const port = new MessageChannel();
		SW.worker?.postMessage(
			{
				code: "port",
				port: port.port2,
			},
			[port.port2],
		);
		this.port = port.port1;
		this.port.onmessage = (e) => {
			this.handleMessage(e.data);
		};
		window.addEventListener("beforeunload", () => {
			this.postMessage({code: "close"});
			port.port1.close();
		});
		this.postMessage({code: "ping"});
		this.postMessage({code: "isDev", dev: !!localStorage.getItem("isDev")});
		this.captureEvent("updates", (update, stop) => {
			this.needsUpdate ||= update.updates;
			if (update) {
				stop();
				const updateIcon = document.getElementById("updateIcon");
				if (updateIcon) {
					updateIcon.hidden = false;
				}
			}
		});
	}
	static traceInit() {
		getBulkUsers();
	}
	static needsUpdate = false;
	static async postMessage(message: messageTo) {
		if (!("serviceWorker" in navigator)) return;
		while (!this.port) {
			await new Promise((res) => setTimeout(res, 100));
		}
		this.port.postMessage(message);
	}
	static eventListeners = new Map<
		messageFrom["code"],
		Set<(y: messageFrom, remove: () => void) => void>
	>();
	static captureEvent<X extends messageFrom["code"]>(
		name: X,
		fucny: (y: Extract<messageFrom, {code: X}>, remove: () => void) => void,
	) {
		let sett = this.eventListeners.get(name);
		if (!sett) {
			sett = new Set();
			this.eventListeners.set(name, sett);
		}
		sett.add(fucny as () => void);
	}
	static uncaptureEvent<X extends messageFrom["code"]>(
		name: X,
		fucny: (y: Extract<messageFrom, {code: X}>, remove: () => void) => void,
	) {
		let sett = this.eventListeners.get(name);
		if (!sett) return;
		sett.delete(fucny as () => void);
	}
	static async handleMessage(message: messageFrom) {
		const sett = this.eventListeners.get(message.code);
		if (sett) {
			for (const thing of sett) {
				thing(message, () => {
					this.uncaptureEvent(message.code, thing);
				});
			}
		}
		switch (message.code) {
			case "pong": {
				console.log(message);
				break;
			}
			case "close": {
				for (const thing of await navigator.serviceWorker.getRegistrations()) {
					await thing.unregister();
				}
				await this.start();
				this.postMessage({code: "replace"});
				break;
			}
			case "closing": {
				await this.start();
				break;
			}
			case "updates": {
				break;
			}
			case "isValid": {
			}
		}
	}

	static async isValid(url: string): Promise<boolean> {
		return new Promise((res) => {
			this.captureEvent("isValid", (e, stop) => {
				if (e.url === url) {
					res(e.valid);
					stop();
				}
			});
			this.postMessage({code: "isValid", url});
		});
	}
	static async checkUpdates(): Promise<boolean> {
		if (this.needsUpdate) return true;
		return new Promise((res) => {
			this.captureEvent("updates", (update, remove) => {
				remove;
				res(update.updates);
			});
			this.postMessage({code: "CheckUpdate"});
		});
	}
	static async start() {
		if (!("serviceWorker" in navigator)) return;
		return new Promise<void>((res) => {
			navigator.serviceWorker
				.register("/service.js", {
					scope: "/",
				})
				.then((registration) => {
					let serviceWorker: ServiceWorker | undefined;
					if (registration.installing) {
						serviceWorker = registration.installing;
						console.log("installing");
					} else if (registration.waiting) {
						serviceWorker = registration.waiting;
						console.log("waiting");
					} else if (registration.active) {
						serviceWorker = registration.active;
						console.log("active");
					}
					SW.worker = serviceWorker;
					SW.init();

					if (serviceWorker) {
						console.log(serviceWorker.state);
						serviceWorker.addEventListener("statechange", (_) => {
							console.log(serviceWorker.state);
						});
						res();
					}
				});
		});
	}
	static setMode(mode: "false" | "offlineOnly" | "true") {
		localStorage.setItem("SWMode", mode);
		if (this.worker) {
			this.worker.postMessage({data: mode, code: "setMode"});
		}
	}

	static forceClear() {
		if (this.worker) {
			this.worker.postMessage({code: "ForceClear"});
		}
	}
}
SW.start();
let installPrompt: Event | undefined = undefined;
window.addEventListener("beforeinstallprompt", (event) => {
	event.preventDefault();
	installPrompt = event;
});
export function installPGet() {
	return installPrompt;
}

export function getInstances() {
	return instances;
}
export function getStringURLMapPair() {
	return [stringURLMap, stringURLsMap] as const;
}
