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
async function moveFiles(curPath: string, newPath: string, first = true) {
	async function processFile(file: string) {
		const Prom: Promise<unknown>[] = [];
		const fullPath = path.join(curPath, file);
		if ((await fs.stat(fullPath)).isDirectory()) {
			const rel = path.relative(path.join(__dirname, "src", "less"), fullPath);
			if (!rel || !rel.startsWith("..")) {
				return;
			}
			await fs.mkdir(path.join(newPath, file), {recursive: true});
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

						let mod = await swc.bundle({
							entry: sPath,
							target: "browser",
							output: {
								path: path.parse(sPath).dir,
								name: path.parse(sPath).base,
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
						});

						const code = mod[path.parse(sPath).base] || mod;
						const newfileDir = path.join(newPath, path.parse(sPath).name);

						await Promise.all([
							fs.writeFile(
								newfileDir + ".js",
								code.code + "\n" + `//# sourceMappingURL= ${path.parse(sPath).name}.js.map`,
							),
							code.map ? fs.writeFile(newfileDir + ".js.map", code.map as string) : null,
						]);
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
							mod.code + "\n" + `//# sourceMappingURL= ${plainname}.js.map`,
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
async function build() {
	console.time("build");

	console.time("Cleaning dir");
	try {
		await fs.rm(path.join(__dirname, "dist"), {recursive: true});
	} catch {}
	await fs.mkdir(path.join(__dirname, "dist"));
	console.timeEnd("Cleaning dir");
	try {
		console.time("Compiling Less to dist");
		const distWeb = path.join(__dirname, "dist", "webpage");
		try {
			await fs.mkdir(distWeb, {recursive: true});
		} catch {}
		try {
			child_process.execSync(
				`npx lessc --clean-css src/less/theme.less ${path.join(distWeb, "themes.css")}`,
				{stdio: "inherit"},
			);
		} catch (e) {
			console.error("Less compile (theme.less -> dist) failed:", e);
		}
		try {
			child_process.execSync(
				`npx lessc --clean-css src/less/style/style.less ${path.join(distWeb, "style.css")}`,
				{stdio: "inherit"},
			);
		} catch (e) {
			console.error("Less compile (style.less -> dist) failed:", e);
		}
		console.timeEnd("Compiling Less to dist");
	} catch (e) {
		console.error("Error while compiling Less to dist:", e);
	}

	console.time("Moving and compiling files");
	await moveFiles(path.join(__dirname, "src"), path.join(__dirname, "dist"));
	console.timeEnd("Moving and compiling files");

	console.time("Moving translations");
	try {
		await fs.mkdir(path.join(__dirname, "dist", "webpage", "translations"));
	} catch {}
	let langs = await fs.readdir(path.join(__dirname, "translations"));
	langs = langs.filter((e) => e !== "qqq.json");
	const langobj = {};
	for (const lang of langs) {
		const str = await fs.readFile(path.join(__dirname, "translations", lang));
		const json = JSON.parse(str.toString());
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
		console.time("Getting git commit hash");
		revision = child_process.execSync("git rev-parse HEAD").toString().trim();
		await fs.writeFile(path.join(__dirname, "dist", "webpage", "getupdates"), revision);
		console.timeEnd("Getting git commit hash");
	}

	console.time("Writing version");
	await fs.writeFile(path.join(__dirname, "dist", "webpage", "getupdates"), revision);
	console.timeEnd("Writing version");

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
