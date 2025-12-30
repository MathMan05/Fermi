import {messageFrom, messageTo} from "./utils/serviceType";

async function deleteoldcache() {
	await caches.delete("cache");
}
type files = {[key: string]: string | files};
async function getAllFiles() {
	const files = await fetch("/files.json");
	const json: files = await files.json();
	return json;
}
async function downloadAllFiles() {
	async function cachePath(path: string, json: files) {
		await Promise.all(
			Object.entries(json).map(async ([name, thing]) => {
				if (typeof thing === "string") {
					const lpath = path + "/" + name;
					if (lpath.endsWith(".map") && !dev) {
						return;
					}
					const res = await fetch(lpath);
					putInCache(new URL(path, self.location.origin), res);
				} else {
					await cachePath(path + "/" + name, thing);
				}
			}),
		);
	}

	const json = await getAllFiles();

	cachePath("", json);
}
async function getFromCache(request: URL) {
	request = new URL(request, self.location.href);
	const port = rMap.get(request.host);
	if (port) {
		request.search = "";
	}
	const cache = await caches.open(port ? "cdn" : "cache");
	return cache.match(request);
}
async function putInCache(request: URL | string, response: Response) {
	request = new URL(request, self.location.href);
	const port = rMap.get(request.host);
	if (port) {
		request.search = "";
	}
	const cache = await caches.open(port ? "cdn" : "cache");

	try {
		console.log(await cache.put(request, response));
	} catch (error) {
		console.error(error);
	}
}

let lastcache: string;
self.addEventListener("activate", async () => {
	console.log("Service Worker activated");
	checkCache();
});
async function tryToClose() {
	const portArr = [...ports];
	if (portArr.length) {
		for (let i = 1; i < portArr.length; i++) {
			portArr[i].postMessage({code: "closing"});
		}
		portArr[0].postMessage({code: "close"});
	} else {
		throw new Error("No Fermi clients connected?");
	}
}
function sendAll(message: messageFrom) {
	for (const port of ports) {
		port.postMessage(message);
	}
}
async function checkCache() {
	if (checkedrecently) {
		return false;
	}
	const cache = await caches.open("cache");
	const promise = await cache.match("/getupdates");
	if (promise) {
		lastcache = await promise.text();
	}
	console.log(lastcache);
	return fetch("/getupdates").then(async (data) => {
		setTimeout(
			(_: any) => {
				checkedrecently = false;
			},
			1000 * 60 * 30,
		);
		if (!data.ok) return false;
		const text = await data.clone().text();
		console.log(text, lastcache);
		if (lastcache !== text) {
			deleteoldcache();
			putInCache("/getupdates", data);
			await downloadAllFiles();
			tryToClose();
			checkedrecently = true;
			sendAll({
				code: "updates",
				updates: true,
			});
			return true;
		}
		checkedrecently = true;
		return false;
	});
}
var checkedrecently = false;

function samedomain(url: string | URL) {
	return new URL(url).origin === self.origin;
}

let enabled = "false";
let offline = false;
function toPathNoDefault(url: string) {
	const Url = new URL(url);
	let html: string | undefined = undefined;
	const path = Url.pathname;
	if (path.startsWith("/channels")) {
		html = "./app";
	} else if (path.startsWith("/invite/") || path === "/invite") {
		html = "./invite";
	} else if (path.startsWith("/template/") || path === "/template") {
		html = "./template";
	} else if (path === "/") {
		html = "./index";
	}
	return html;
}
function toPath(url: string): string {
	const Url = new URL(url);
	return toPathNoDefault(url) || Url.pathname;
}
let fails = 0;
async function getfile(req: Request): Promise<Response> {
	checkCache();
	if (!samedomain(req.url) || enabled === "false" || (enabled === "offlineOnly" && !offline)) {
		const response = await fetch(req.clone());
		if (samedomain(req.url)) {
			if (enabled === "offlineOnly" && response.ok) {
				putInCache(toPath(req.url), response.clone());
			}
			if (!response.ok) {
				fails++;
				if (fails > 5) {
					offline = true;
				}
			}
		}
		return response;
	}

	let path = toPath(req.url);
	if (path === "/instances.json") {
		//TODO the client shouldn't really even fetch this, it should just ask the SW for it
		return await fetch(path);
	}
	console.log("Getting path: " + path);
	const responseFromCache = await caches.match(path);
	if (responseFromCache) {
		console.log("cache hit");
		return responseFromCache;
	}
	try {
		const responseFromNetwork = await fetch(path);
		if (responseFromNetwork.ok) {
			await putInCache(path, responseFromNetwork.clone());
		}
		return responseFromNetwork;
	} catch (e) {
		console.error(e);
		return new Response(null);
	}
}
const promURLMap = new Map<string, (url: string) => void>();
async function refreshUrl(url: URL, port: MessagePort): Promise<string> {
	port.postMessage({
		code: "refreshURL",
		url: url.toString(),
	});
	return new Promise((res) => promURLMap.set(url.toString(), res));
}
self.addEventListener("fetch", async (e) => {
	const event = e as FetchEvent;
	const host = URL.canParse(event.request.url) && new URL(event.request.url).host;
	let req = event.request;

	const port = rMap.get(host || "");
	if (port) {
		const url = new URL(event.request.url);
		const ignore = ["/api", "/_spacebar"].find((_) => url.pathname.startsWith(_));
		if (!ignore) {
			const expired =
				url.searchParams.get("ex") &&
				Number.parseInt(url.searchParams.get("ex") || "", 16) < Date.now() - 5000;
			event.respondWith(
				new Promise(async (res) => {
					const cached = await getFromCache(url);
					if (cached) {
						res(cached);
						return;
					}
					if (expired) {
						const old = url;
						const p = Date.now();
						req = await Promise.race<Request>([
							new Promise(async (res) => res(new Request(await refreshUrl(url, port), req))),
							new Promise((res) => setTimeout(() => res(req), 5000)),
						]);
						console.log(p - Date.now(), old === url);
					}
					const f = await fetch(req);
					res(f);
					putInCache(url, f.clone());
				}),
			);
			return;
		}
	}

	if (apiHosts?.has(host || "")) {
		try {
			const response = await fetch(req.clone());
			try {
				event.respondWith(response.clone());
			} catch {}

			const json = await response.json();
			if (json._trace) {
				sendAll({
					code: "trace",
					trace: json._trace,
				});
			}
		} catch (e) {
			console.error(e);
			//Wasn't meant to be ig lol
		}
		return;
	}

	if (req.method === "POST") {
		return;
	}
	if (new URL(req.url).pathname.startsWith("/api/")) {
		return;
	}
	try {
		event.respondWith(getfile(req));
	} catch (e) {
		console.error(e);
	}
});
const ports = new Set<MessagePort>();
let dev = false;
let apiHosts: Set<string> | void;
const rMap = new Map<string, MessagePort>();
function listenToPort(port: MessagePort) {
	function sendMessage(message: messageFrom) {
		port.postMessage(message);
	}
	port.onmessage = async (e) => {
		const data = e.data as messageTo;
		switch (data.code) {
			case "ping": {
				sendMessage({
					code: "pong",
					count: ports.size,
				});
				break;
			}
			case "close": {
				ports.delete(port);
				break;
			}
			case "replace": {
				//@ts-ignore-error Just the type or wrong or something
				self.skipWaiting();
				break;
			}
			case "CheckUpdate": {
				checkedrecently = false;
				if (!(await checkCache())) {
					sendMessage({
						code: "updates",
						updates: false,
					});
				}

				break;
			}
			case "isValid": {
				sendMessage({code: "isValid", url: data.url, valid: !!toPathNoDefault(data.url)});
				break;
			}
			case "isDev": {
				const refetch = !dev && data.dev;
				dev = data.dev;
				if (refetch) {
					getAllFiles();
				}
				break;
			}
			case "apiUrls": {
				if (data.hosts) {
					apiHosts = new Set(data.hosts);
				} else {
					apiHosts = undefined;
				}
				break;
			}
			case "canRefresh": {
				rMap.set(data.host, port);
				break;
			}
			case "refreshedUrl": {
				const res = promURLMap.get(data.oldurl);
				if (res) {
					res(data.url);
					promURLMap.delete(data.oldurl);
				}
			}
		}
	};
	port.addEventListener("close", () => {
		ports.delete(port);
	});
}
self.addEventListener("message", (message) => {
	const data = message.data;
	switch (data.code) {
		case "setMode":
			enabled = data.data;
			break;
		case "ForceClear":
			deleteoldcache();
			break;
		case "port": {
			const port = data.port as MessagePort;
			ports.add(port);
			listenToPort(port);
		}
	}
});
