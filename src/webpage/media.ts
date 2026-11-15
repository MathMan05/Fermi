import {Contextmenu} from "./contextmenu.js";
import {I18n} from "./i18n.js";
import {Dialog} from "./settings.js";
import {ProgressiveArray} from "./utils/progessiveLoad.js";
export const menu = new Contextmenu<media, undefined>("media");
menu.addButton(
	() => I18n.media.download(),
	function () {
		const a = document.createElement("a");
		a.href = this.src;
		a.download = this.filename;
		a.click();
	},
);
menu.addButton(
	() => I18n.media.moreInfo(),
	async function () {
		const di = new Dialog(this.title);
		const options = di.float.options;
		if (this.img) {
			const img = document.createElement("img");
			img.classList.add("media-medium");
			img.src = this.img.url;
			if (this.img.description) img.alt = this.img.description;
			options.addHTMLArea(img);
		}
		if (this.artist) {
			options.addText(I18n.media.artist(this.artist));
		}
		if (this.composer) {
			options.addText(I18n.media.composer(this.composer));
		}
		{
			const mins = Math.floor((await this.length) / 60000);
			const seconds = Math.round(((await this.length) - mins * 60000) / 1000);
			options.addText(I18n.media.length(mins + "", seconds + ""));
		}

		di.show();
		if (this.copyright) {
			const text = options.addText(this.copyright);
			const txt = text.elm.deref();
			if (txt) {
				txt.classList.add("timestamp");
			}
		}
	},
);
export type mediaEvents =
	| {
			type: "play";
	  }
	| {
			type: "pause";
	  }
	| {
			type: "playing";
			time: number;
	  }
	| {
			type: "done";
	  }
	| {
			type: "audio";
			t: "start" | "stop";
	  }
	| {
			type: "audio";
			t: "skip";
			time: number;
	  }
	| {
			type: "end";
	  };

export function makePlayBox(
	mor: string | media,
	player: MediaPlayer,
	ctime = 0,
	url: Promise<string> | void,
) {
	const div = document.createElement("div");
	div.classList.add("flexltr", "Mplayer");

	const button = document.createElement("img");
	button.classList.add("svg-mediaButton", "svg-play");

	const vDiv = document.createElement("div");
	vDiv.classList.add("flexttb");

	const title = document.createElement("span");
	title.textContent = I18n.media.loading();

	const barDiv = document.createElement("div");
	barDiv.classList.add("flexltr");

	const bar = document.createElement("input");
	bar.type = "range";
	bar.disabled = true;
	bar.value = "" + ctime;
	bar.min = "0";

	const time = document.createElement("span");
	time.textContent = "0:00/..:..";

	const more = document.createElement("span");
	more.classList.add("svg-soundMore", "svg-mediaSettings");

	barDiv.append(bar, time);
	vDiv.append(title, barDiv);
	div.append(button, vDiv, more);
	(async () => {
		if (url) mor = await url;
		MediaPlayer.IdentifyFile(mor).then((thing) => {
			let audio: HTMLAudioElement | undefined = undefined;

			if (!thing) {
				const span = document.createElement("span");
				span.textContent = I18n.media.notFound();
				return;
			}
			menu.bindContextmenu(
				more,
				thing,
				undefined,
				() => {},
				() => {},
				"left",
			);
			player.addListener(thing.src, followUpdates, div);
			let int = setInterval((_) => {}, 1000);
			if (typeof mor !== "string") {
				const cmor = mor;
				const audioo = new Audio(cmor.src);
				audioo.load();
				audioo.autoplay = true;
				audioo.currentTime = ctime / 1000;
				int = setInterval(() => {
					if (button.classList.contains("svg-pause")) {
						player.addUpdate(cmor.src, {type: "playing", time: audioo.currentTime * 1000});
					}
				}, 100) as unknown as number;
				audioo.onplay = () => {
					player.addUpdate(cmor.src, {type: "play"});
				};
				audioo.onpause = () => {
					player.addUpdate(thing.src, {type: "pause"});
				};
				audioo.onloadeddata = () => {
					audio = audioo;
				};
				audioo.onended = () => {
					player.addUpdate(cmor.src, {type: "end"});
				};
			}
			button.onclick = () => {
				if (!player.isPlaying(thing.src)) {
					player.setToTopList(thing, +bar.value * 1000);
				} else {
					player.addUpdate(thing.src, {
						type: "audio",
						t: button.classList.contains("svg-play") ? "start" : "stop",
					});
				}
			};
			function followUpdates(cur: mediaEvents) {
				if (audio && cur.type !== "playing") {
				}
				if (cur.type == "audio" && audio) {
					if (cur.t == "start") {
						audio.play();
					} else if (cur.t == "stop") {
						audio.pause();
					} else if (cur.t == "skip" && audio) {
						audio.currentTime = cur.time / 1000;
					}
				}
				if (cur.type == "audio" && cur.t == "skip") {
					bar.value = "" + cur.time / 1000;
				}
				if (cur.type == "playing") {
					regenTime(cur.time);
					bar.value = "" + cur.time / 1000;
					button.classList.add("svg-pause");
					button.classList.remove("svg-play");
				} else if (cur.type === "play") {
					button.classList.add("svg-pause");
					button.classList.remove("svg-play");
				} else if (cur.type === "pause") {
					button.classList.add("svg-play");
					button.classList.remove("svg-pause");
				} else if (cur.type === "end") {
					clearInterval(int);
					if (audio) {
						audio.pause();
						audio.src = "";
						player.end();
					}
					button.classList.add("svg-play");
					button.classList.remove("svg-pause");
					regenTime();
				}
			}

			const med = thing;
			if (med.img) {
				let img: HTMLImageElement;
				if (mor instanceof Object) {
					img = button;
				} else {
					img = document.createElement("img");
					div.append(img);
				}
				img.classList.add("media-small");
				img.src = med.img.url;
			}
			function timeToString(time: number) {
				const minutes = Math.floor(time / 1000 / 60);
				const seconds = Math.round(time / 1000 - minutes * 60) + "";
				return `${minutes}:${seconds.padStart(2, "0")}`;
			}
			bar.oninput = () => {
				player.addUpdate(thing.src, {
					type: "audio",
					t: "skip",
					time: +bar.value * 1000,
				});
				regenTime(+bar.value * 1000);
			};
			async function regenTime(curTime: number = 0) {
				const len = await med.length;
				bar.disabled = false;
				bar.max = "" + len / 1000;

				time.textContent = `${timeToString(curTime)}/${timeToString(len)}`;
			}
			regenTime();
			title.textContent = thing.title;
		});
	})();
	return div;
}

export interface media {
	src: string;
	filename: string;
	img?: {
		url: string;
		description?: string;
	};
	title: string;
	artist?: string;
	composer?: string;
	sourcy?: string;
	year?: number;
	copyright?: string;
	length: number | Promise<number>;
}
export class MediaPlayer {
	lists: media[] = [];
	curAudio?: HTMLElement;
	private listeners: [(e: mediaEvents) => void, string][] = [];
	elm: HTMLDivElement;
	cur = 0;
	constructor() {
		this.elm = document.getElementById("player") as HTMLDivElement;
	}
	addElmToList(audio: media) {
		this.lists.unshift(audio);
	}
	addUpdate(e: string, update: mediaEvents) {
		for (const thing of this.listeners) {
			if (thing[1] === e) {
				thing[0](update);
			}
		}
	}
	addListener(audio: string, updates: (e: mediaEvents) => void, elm: HTMLElement) {
		this.listeners.push([updates, audio]);
		const int = setInterval(() => {
			if (!document.contains(elm)) {
				clearInterval(int);
				this.listeners = this.listeners.filter((_) => _[0] !== updates);
			}
		}, 1000);
	}
	isPlaying(str: string) {
		const med = this.lists[this.cur];
		if (!med) return false;
		return med.src === str;
	}
	setToTopList(audio: media, time: number) {
		const med = this.lists[this.cur];
		if (med) {
			this.addUpdate(med.src, {type: "end"});
		}
		this.lists.splice(this.cur, 0, audio);
		this.regenPlayer(time);
	}
	end() {
		if (this.curAudio) {
			this.curAudio.remove();
			this.cur++;
			this.regenPlayer(0);
		}
	}
	regenPlayer(time: number) {
		this.elm.innerHTML = "";
		if (this.lists.length > this.cur) {
			const audio = this.lists[this.cur];
			this.elm.append((this.curAudio = makePlayBox(audio, this, time)));
		}
	}
	static cache = new Map<string, media | Promise<media>>();
	static async IdentifyFile(url: string | media): Promise<media | null> {
		if (url instanceof Object) {
			return url;
		}
		const cValue = this.cache.get(url);
		if (cValue) {
			return cValue;
		}
		let resMedio = (_: media) => {};
		this.cache.set(url, new Promise<media>((res) => (resMedio = res)));
		const prog = new ProgressiveArray(url, {method: "get"});
		await prog.ready;

		const output: Partial<media> = {
			src: url,
		};
		try {
			const head = String.fromCharCode(await prog.next(), await prog.next(), await prog.next());
			if (head === "ID3") {
				const version = (await prog.next()) + (await prog.next()) * 256;

				if (version === 2) {
					//TODO I'm like 90% I can ignore *all* of the flags, but I need to check more sometime
					await prog.next();
					//debugger;
					const sizes = await prog.get8BitArray(4);
					prog.sizeLeft = (sizes[0] << 21) + (sizes[1] << 14) + (sizes[2] << 7) + sizes[3];
					const mappy = new Map<string, Uint8Array<ArrayBuffer>>();
					while (prog.sizeLeft > 0) {
						const Identify = String.fromCharCode(
							await prog.next(),
							await prog.next(),
							await prog.next(),
						);
						const sizeArr = await prog.get8BitArray(3);
						const size = (sizeArr[0] << 16) + (sizeArr[1] << 8) + sizeArr[2];
						if (Identify === String.fromCharCode(0, 0, 0)) {
							break;
						}
						if (!size) {
							throw Error("weirdness");
						}
						if (!Identify.match(/[A-Z0-9]/gm)) {
							console.error(`tried to get ${Identify} which doesn't exist`);
							break;
						}
						if (mappy.has(Identify)) {
							await prog.get8BitArray(size);
							//console.warn("Got dupe", Identify);
						} else {
							mappy.set(Identify, await prog.get8BitArray(size));
						}
					}
					const pic = mappy.get("PIC");
					if (pic) {
						let i = 5; //skipping info I don't need right now
						const desc: number[] = [];
						for (; pic[i]; i++) {
							desc.push(pic[i]);
						}
						const description = new TextDecoder().decode(new Uint8Array(desc));
						i++;
						const blob = new Blob([pic.slice(i, pic.length).buffer], {type: "image/jpeg"});
						const urlmaker = window.URL || window.webkitURL;
						const url = urlmaker.createObjectURL(blob);
						output.img = {url, description};
					}
					function decodeText(buf: ArrayBuffer) {
						let str = new TextDecoder().decode(buf);
						if (str.startsWith("\u0000")) {
							str = str.slice(1, str.length);
						}
						if (str.endsWith("\u0000")) {
							str = str.slice(0, str.length - 1);
						}
						return str;
					}
					const mapmap = {
						TT2: "title",
						TP1: "artist",
						TCM: "composer",
						TAL: "sourcy",
						TCO: "type",
						TEN: "copyright",
					} as const;
					for (const [key, ind] of Object.entries(mapmap)) {
						const temp = mappy.get(key);
						if (temp) {
							//@ts-ignore TS is being weird about this idk why
							output[ind] = decodeText(temp);
						}
					}
					const tye = mappy.get("TYE");
					if (tye) {
						output.year = +decodeText(tye.buffer);
					}
					//TODO more thoroughly check if these two are the same format
				} else if (version === 3 || version === 4) {
					const flags = await prog.next();
					if (flags & 0b01000000) {
						//TODO deal with the extended header
					}
					//debugger;
					const sizes = await prog.get8BitArray(4);
					prog.sizeLeft = (sizes[0] << 21) + (sizes[1] << 14) + (sizes[2] << 7) + sizes[3];
					const mappy = new Map<string, Uint8Array<ArrayBuffer>>();
					while (prog.sizeLeft > 0) {
						const Identify = String.fromCharCode(
							await prog.next(),
							await prog.next(),
							await prog.next(),
							await prog.next(),
						);
						const sizeArr = await prog.get8BitArray(4);
						const size = (sizeArr[0] << 24) + (sizeArr[1] << 16) + (sizeArr[2] << 8) + sizeArr[3];

						const flags = await prog.get8BitArray(2);
						const compression = !!(flags[1] & 0b10000000);
						if (compression) {
							//TODO Honestly, I don't know if I can do this with normal JS
							continue;
						}
						const encyption = !!(flags[1] & 0b01000000);
						if (encyption) {
							//TODO not sure what this would even do
							continue;
						}

						if (Identify === String.fromCharCode(0, 0, 0, 0)) {
							break;
						}
						if (!size) {
							//throw Error("weirdness");
						}
						if (!Identify.match(/[A-Z0-9]/gm)) {
							console.error(`tried to get ${Identify} which doesn't exist`);
							break;
						}
						if (mappy.has(Identify)) {
							await prog.get8BitArray(size);
							//console.warn("Got dupe", Identify);
						} else {
							mappy.set(Identify, await prog.get8BitArray(size));
						}
					}
					const pic = mappy.get("APIC");
					if (pic) {
						//const encoding = pic[0];
						let i = 1; //skipping info I don't need right now
						for (; pic[i]; i++) {}
						i += 2;
						let desc: number[] = [];
						for (; pic[i]; i++) {
							desc.push(pic[i]);
						}
						const description = new TextDecoder().decode(new Uint8Array(desc));
						i++;
						const blob = new Blob([pic.slice(i, pic.length).buffer], {type: "image/jpeg"});
						const urlmaker = window.URL || window.webkitURL;
						const url = urlmaker.createObjectURL(blob);
						output.img = {url, description};
					}
					function decodeText(buf: ArrayBuffer) {
						let str = new TextDecoder().decode(buf);
						if (str.startsWith("\u0000")) {
							str = str.slice(1, str.length);
						}
						if (str.endsWith("\u0000")) {
							str = str.slice(0, str.length - 1);
						}
						return str;
					}
					const mapmap = {
						TIT2: "title",
						TPE1: "artist",
						TCOM: "composer",
						TALB: "sourcy",
						TMED: "type",
						TENC: "copyright",
					} as const;
					for (const [key, ind] of Object.entries(mapmap)) {
						const temp = mappy.get(key);
						if (temp) {
							//@ts-ignore TS is being weird about this idk why
							output[ind] = decodeText(temp);
						}
					}
					const TYER = mappy.get("TYER");
					if (TYER) {
						output.year = +decodeText(TYER.buffer);
					}
					const TLEN = mappy.get("TLEN");
					if (TLEN) {
						output.length = +decodeText(TLEN.buffer);
					}
				}
			} //TODO implement more metadata types
		} catch (e) {
			console.error(e);
		} finally {
			output.filename = new URL(url).pathname.split("/").at(-1);
			prog.close();
			if (!output.length) {
				output.length = new Promise<number>(async (res) => {
					const audio = document.createElement("audio");
					audio.src = url;
					audio.onloadeddata = (_) => {
						output.length = audio.duration * 1000;
						res(audio.duration * 1000);
					};
					audio.load();
				});
			}
			if (!output.title) {
				output.title = output.filename;
			}
		}
		resMedio(output as media);
		return output as media;
	}
}
