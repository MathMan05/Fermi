import http from "http";
import fs from "node:fs/promises";
import path from "node:path";
import {observe} from "./stats.js";
import {getApiUrls} from "./utils.js";
import {fileURLToPath} from "node:url";
import {readFileSync} from "fs";
import process from "node:process";

const devmode = (process.env.NODE_ENV || "development") === "development";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
type dirtype = Map<string, dirtype | string>;
async function getDirectories(path: string): Promise<dirtype> {
	return new Map(
		await Promise.all(
			(await fs.readdir(path)).map(async function (file): Promise<[string, string | dirtype]> {
				if ((await fs.stat(path + "/" + file)).isDirectory()) {
					return [file, await getDirectories(path + "/" + file)];
				} else {
					return [file, file];
				}
			}),
		),
	);
}

let dirs: dirtype | undefined = undefined;
async function combinePath(path: string, tryAgain = true, reqpath: string): Promise<string> {
	if (!dirs) {
		dirs = await getDirectories(__dirname);
	}
	const pathDir = path
		.split("/")
		.reverse()
		.filter((_) => _ !== "");
	function find(arr: string[], search: dirtype | string | undefined): boolean {
		if (search == undefined) return false;
		if (arr.length === 0) {
			return typeof search == "string";
		}
		if (typeof search == "string") {
			return false;
		}
		const thing = arr.pop() as string;
		return find(arr, search.get(thing));
	}
	if (find(pathDir, dirs)) {
		return __dirname + path;
	} else if (reqpath.startsWith("/channels")) {
		return __dirname + "/webpage/app.html";
	} else {
		if (!path.includes(".")) {
			const str = await combinePath(path + ".html", false, reqpath);
			if (str !== __dirname + "/webpage/404.html") {
				return str;
			}
		}
		if (devmode && tryAgain) {
			dirs = await getDirectories(__dirname);
			return combinePath(path, false, reqpath);
		}
		return __dirname + "/webpage/404.html";
	}
}
interface Instance {
	name: string;
	[key: string]: any;
}
function guessMime(str: string) {
	const ext = str.split(".").at(-1);
	switch (ext) {
		case "js":
		case "cjs":
			return "text/javascript";
		case "html":
			return "text/html";
		case "css":
			return "text/css";
		case "svg":
			return "image/svg+xml";
		case "ico":
			return "image/x-icon";
		case "png":
		case "jpeg":
		case "webp":
			return "image/" + ext;
		default:
			return "text/plain";
	}
}
const app = http.createServer(async (req, res) => {
	const url = new URL(req.url as string, "http://localhost");
	const pathstr = url.pathname;

	async function sendFile(file: string) {
		try {
			const f = await fs.readFile(file);
			res.writeHead(200, {"Content-Type": guessMime(file)});
			res.write(f);
			res.end();
		} catch {
			res.writeHead(404, {"Content-Type": "text/html"});
			res.write("Uh, this ain't supposed to happen");
			res.end();
		}
	}

	if (pathstr === "/") {
		sendFile(path.join(__dirname, "webpage", "index.html"));
		return;
	}

	if (pathstr.startsWith("/instances.json")) {
		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write(JSON.stringify(instances));
		res.end();
		return;
	}

	if (pathstr.startsWith("/invite/")) {
		sendFile(path.join(__dirname, "webpage", "invite.html"));
		return;
	}
	if (pathstr.startsWith("/template/")) {
		sendFile(path.join(__dirname, "webpage", "template.html"));
		return;
	}
	const filePath = await combinePath("/webpage/" + pathstr, true, pathstr);
	sendFile(filePath);
});

export type instance = {
	name: string;
	description?: string;
	descriptionLong?: string;
	image?: string;
	url?: string;
	language: string;
	country: string;
	display: boolean;
	urls?: {
		wellknown: string;
		api: string;
		cdn: string;
		gateway: string;
		login?: string;
	};
	contactInfo?: {
		discord?: string;
		github?: string;
		email?: string;
		spacebar?: string;
		matrix?: string;
		mastodon?: string;
	};
};
const instances = JSON.parse(
	readFileSync(process.env.JANK_INSTANCES_PATH || __dirname + "/webpage/instances.json").toString(),
) as instance[];

const instanceNames = new Map<string, Instance>();

for (const instance of instances) {
	instanceNames.set(instance.name, instance);
}

async function updateInstances(): Promise<void> {
	try {
		const response = await fetch(
			"https://raw.githubusercontent.com/spacebarchat/spacebarchat/master/instances/instances.json",
		);
		const json = (await response.json()) as Instance[];
		for (const instance of json) {
			if (instanceNames.has(instance.name)) {
				const existingInstance = instanceNames.get(instance.name);
				if (existingInstance) {
					for (const key of Object.keys(instance)) {
						if (!(key in existingInstance)) {
							existingInstance[key] = instance[key];
						}
					}
				}
			} else {
				instances.push(instance as any);
			}
		}
		observe(instances);
	} catch (error) {
		console.error("Error updating instances:", error);
	}
}

updateInstances();
/*
app.set("trust proxy", (ip: unknown) => {
	if (typeof ip !== "string") return false;
	return ip.startsWith("127.");
});
*/
const PORT = process.env.PORT || Number(process.argv[2]) || 8080;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

export {getApiUrls};
