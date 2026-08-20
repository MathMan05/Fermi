import {promises as fs} from "fs";
import * as swc from "@swc/core";
import {fileURLToPath} from "node:url";
import path from "node:path";
import child_process from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let urlMaybe = process.env.URL;
if (urlMaybe && URL.canParse(urlMaybe)) {
	if (urlMaybe.endsWith("/")) {
		const temp = urlMaybe.split("/");
		temp.pop();
		urlMaybe = temp.join("/");
	}
} else {
	urlMaybe = undefined;
}
let entryPoints: {sPath: string; newPath: string}[] = [];
async function bundleFiles() {
	const filter = new Set<string>();
	entryPoints = entryPoints.filter((_) => {
		if (filter.has(_.sPath)) return false;
		filter.add(_.sPath);
		return true;
	});
	let mod = await swc.bundle(
		entryPoints.map(({sPath}) => {
			return {
				entry: sPath,
				output: {
					path: path.parse(sPath).dir,
					name: path.parse(sPath).base,
				},
				env: {
					targets: "Chrome > 120",
				},
				module: {
					minify: true,
					sourceMaps: true,
					isModule: true,
					jsc: {
						minify: {
							mangle: false,
						},
					},
				},
				externalModules: ["/translations/langs.js"],
				options: {
					minify: !process.argv.includes("watch"),
					jsc: {
						minify: {
							mangle: false,
						},
					},
				},
			};
		}),
	);

	await Promise.all(
		entryPoints.map(async ({sPath, newPath}) => {
			const code = mod[path.parse(sPath).base] || mod;
			const newfileDir = path.join(newPath, path.parse(sPath).name);

			await Promise.all([
				fs.writeFile(
					newfileDir + ".js",
					code.code + "\n" + `//# sourceMappingURL=${path.parse(sPath).name}.js.map`,
				),
				code.map ? fs.writeFile(newfileDir + ".js.map", code.map as string) : null,
			]);
		}),
	);
}
async function moveFiles(curPath: string, newPath: string, first = true) {
	async function processFile(file: string) {
		const Prom: Promise<unknown>[] = [];
		if ((await fs.stat(path.join(curPath, file))).isDirectory()) {
			await fs.mkdir(path.join(newPath, file));
			Prom.push(moveFiles(path.join(curPath, file), path.join(newPath, file), false));
		} else {
			if (!file.endsWith(".ts")) {
				if (file.endsWith(".html")) {
					for (const [, match] of (await fs.readFile(path.join(curPath, file)))
						.toString()
						.matchAll(/<script.*?src="(.*?)"/gm)) {
						const sPathTemp = path.format({
							root: path.join(__dirname, "src", "webpage"),
							base: match,
						});
						const newPath = path.join(
							path.format({
								root: path.join(__dirname, "dist", "webpage"),
								base: match,
							}),
							"../",
						);
						const temp2 = path.parse(sPathTemp);
						//@ts-ignore
						delete temp2.base;
						temp2.ext = ".ts";
						const sPath = path.format(temp2);
						entryPoints.push({sPath, newPath});
					}
				}
				if (file.includes("sitemap")) {
					if (urlMaybe) {
						let map = (await fs.readFile(path.join(curPath, file))).toString();
						//@ts-expect-error I don't know TS just doesn't seem to know I'm on modern JS
						map = map.replaceAll("$$$", urlMaybe);

						await fs.writeFile(path.join(newPath, file), map);
					}
				} else if (file.includes("robots.txt") && urlMaybe) {
					let robots = (await fs.readFile(path.join(curPath, file))).toString();
					robots += "\n\nSitemap: " + urlMaybe + "/sitemap.xml";
					await fs.writeFile(path.join(newPath, file), robots);
				} else {
					await fs.copyFile(path.join(curPath, file), path.join(newPath, file));
				}
			} else {
				const plainname = file.split(".ts")[0];
				const newfileDir = path.join(newPath, plainname);
				let mod = first
					? await swc.transformFile(path.join(curPath, file), {
							minify: true,
							sourceMaps: true,
							isModule: true,
							jsc: {
								minify: {
									mangle: !process.argv.includes("watch"),
								},
							},
						})
					: false;
				if (mod) {
					await Promise.all([
						fs.writeFile(
							newfileDir + ".js",
							mod.code + "\n" + `//# sourceMappingURL=${plainname}.js.map`,
						),
						mod.map ? fs.writeFile(newfileDir + ".js.map", mod.map as string) : null,
					]);
				}
			}
		}
		await Promise.all(Prom);
	}
	await Promise.all((await fs.readdir(curPath)).map((_) => processFile(_)));
}
async function crawlDir(dir: string) {
	const dirs = await fs.readdir(dir);
	const m = await Promise.all(
		dirs.map(async (file) => {
			const idir = path.join(dir, file);
			const stats = await fs.lstat(idir);
			if (stats.isDirectory()) {
				return [file, await crawlDir(idir)] as const;
			} else {
				if (file.startsWith(".")) {
					//Don't show hidden files lol
					return [file, undefined] as const;
				}
				return [file, file] as const;
			}
		}),
	);
	const obj = {};
	m.forEach((_) => (obj[_[0]] = _[1]));
	return obj;
}
async function build() {
	entryPoints = [];
	console.time("build");

	console.time("Cleaning dir");
	try {
		await fs.rm(path.join(__dirname, "dist"), {recursive: true});
	} catch {}
	await fs.mkdir(path.join(__dirname, "dist"));
	console.timeEnd("Cleaning dir");

	console.time("Moving files");
	await moveFiles(path.join(__dirname, "src"), path.join(__dirname, "dist"));
	console.timeEnd("Moving files");

	console.time("Bundling TS");
	await bundleFiles();
	console.timeEnd("Bundling TS");

	console.time("Moving translations");
	try {
		await fs.mkdir(path.join(__dirname, "dist", "webpage", "translations"));
	} catch {}
	let langs = await fs.readdir(path.join(__dirname, "translations"));
	langs = langs.filter((e) => e !== "qqq.json");
	const langobj = {};
	for (const lang of langs) {
		const str = (await fs.readFile(path.join(__dirname, "translations", lang))).toString();
		const json = JSON.parse(str);
		langobj[lang] = json.readableName;
		fs.writeFile(path.join(__dirname, "dist", "webpage", "translations", lang), str);
	}
	await fs.writeFile(
		path.join(__dirname, "dist", "webpage", "translations", "langs.js"),
		`const langs=${JSON.stringify(langobj)};export{langs}`,
	);
	console.timeEnd("Moving translations");

	let revision = process.env.VER;
	if (!revision) {
		console.time("Getting git tag");
		revision = child_process.execSync("git tag --points-at HEAD").toString().trim();

		console.timeEnd("Getting git tag");
	}
	if (!revision) {
		console.time("Getting git commit hash");
		revision = child_process.execSync("git rev-parse HEAD").toString().trim();
		console.timeEnd("Getting git commit hash");
	}
	console.time("Writing version");
	await fs.writeFile(path.join(__dirname, "dist", "webpage", "getupdates"), revision);
	console.timeEnd("Writing version");

	console.time("Building Service File");
	const dir = await crawlDir(path.join(__dirname, "dist", "webpage"));
	dir["files.json"] = "files.json";
	await fs.writeFile(path.join(__dirname, "dist", "webpage", "files.json"), JSON.stringify(dir));

	console.timeEnd("Building Service File");

	console.timeEnd("build");
	console.log("");
}

await build();
if (process.argv.includes("watch")) {
	let last = Date.now();
	(async () => {
		for await (const thing of fs.watch(path.join(__dirname, "src"), {recursive: true})) {
			if (Date.now() - last < 100) {
				continue;
			}
			last = Date.now();
			try {
				await build();
			} catch {}
		}
	})();
	(async () => {
		for await (const thing of fs.watch(path.join(__dirname, "translations"))) {
			if (Date.now() - last < 100) {
				continue;
			}
			last = Date.now();
			try {
				await build();
			} catch {}
		}
	})();
}
