import {Contextmenu} from "./contextmenu.js";
import {Guild} from "./guild.js";
import {Hover} from "./hover.js";
import {I18n} from "./i18n.js";
import {stickerJson} from "./jsontypes.js";
import {Localuser} from "./localuser.js";
import {SnowFlake} from "./snowflake.js";
import {CDNParams} from "./utils/cdnParams.js";
import {createImg} from "./utils/utils.js";

class Sticker extends SnowFlake {
	name: string;
	type: number;
	format_type: number;
	owner: Guild | Localuser;
	description: string;
	tags: string;
	get guild() {
		return this.owner;
	}
	get localuser() {
		if (this.owner instanceof Localuser) {
			return this.owner;
		}
		return this.owner.localuser;
	}
	constructor(json: stickerJson, owner: Guild | Localuser) {
		super(json.id);
		this.name = json.name;
		this.type = json.type;
		this.format_type = json.format_type;
		this.owner = owner;
		this.tags = json.tags;
		this.description = json.description || "";
	}
	getHTML(): HTMLElement {
		const img = createImg(
			this.owner.info.cdn + "/stickers/" + this.id + ".webp" + new CDNParams({expectedSize: 160}),
		);
		img.classList.add("sticker");
		const hover = new Hover(this.name);
		hover.addEvent(img);
		img.alt = this.description;
		return img;
	}
	static searchStickers(search: string, localuser: Localuser, results = 50): [Sticker, number][] {
		//NOTE this function is used for searching in the emoji picker for reactions, and the emoji auto-fill
		const ranked: [Sticker, number][] = [];
		function similar(json: Sticker) {
			if (json.name.includes(search)) {
				ranked.push([json, search.length / json.name.length]);
				return true;
			} else if (json.name.toLowerCase().includes(search.toLowerCase())) {
				ranked.push([json, search.length / json.name.length / 1.4]);
				return true;
			} else {
				return false;
			}
		}
		const weakGuild = new WeakMap<Sticker, Guild>();
		for (const guild of localuser.guilds.values()) {
			if (guild.id !== "@me" && guild.stickers.size !== 0) {
				for (const [, sticker] of guild.stickers) {
					if (similar(sticker)) {
						weakGuild.set(sticker, guild);
					}
				}
			}
		}
		ranked.sort((a, b) => b[1] - a[1]);
		return ranked.splice(0, results).map((a) => {
			return a;
		});
	}
	static getFromId(id: string, localuser: Localuser) {
		for (const guild of localuser.guilds.values()) {
			const stick = guild.stickers.get(id);
			if (stick) {
				return stick;
			}
		}
		return undefined;
	}
	static emojiMap = new WeakMap<Localuser, Map<string, Sticker | void>>();
	static async lookupEmoji(id: string, localuser: Localuser): Promise<Sticker | void> {
		const guild = localuser.guilds
			.values()
			.find((guild) => guild.emojis.find((emoji) => emoji.id === id));
		if (guild) {
			const sticker = guild.stickers.get(id);
			if (sticker) return sticker;
		}

		const map = this.emojiMap.get(localuser) || new Map();
		this.emojiMap.set(localuser, map);

		if (map.has(id)) return map.get(id);

		const res = await fetch(localuser.info.api + `/stickers/${id}`, {
			headers: localuser.headers,
		});
		if (res.status === 403) {
			map.set(id, undefined);
			return undefined;
		}
		const json = (await res.json()) as stickerJson;
		map.set(id, json);
		return new Sticker(json, localuser);
	}
	static async stickerPicker(x: number, y: number, localuser: Localuser): Promise<Sticker> {
		let res: (r: Sticker) => void;
		this;
		const promise: Promise<Sticker> = new Promise((r) => {
			res = r;
		});
		const menu = document.createElement("div");
		menu.classList.add("flexttb", "stickerPicker");
		if (y > 0) {
			menu.style.top = y + "px";
		} else {
			menu.style.bottom = y * -1 + "px";
		}
		if (x > 0) {
			menu.style.left = x + "px";
		} else {
			menu.style.right = x * -1 + "px";
		}

		const topBar = document.createElement("div");
		topBar.classList.add("flexltr", "emojiHeading");
		const guilds = [
			localuser.focusGuild,
			...localuser.guilds.values().filter((guild) => guild !== localuser.focusGuild),
		]
			.filter((guild) => guild !== undefined)
			.filter((guild) => guild.id != "@me" && guild.stickers.size > 0);
		if (guilds.length === 0) {
			const title = document.createElement("h2");
			title.textContent = I18n.noStickers();
			topBar.append(title);
			menu.append(topBar);
			Contextmenu.declareMenu(menu);
			document.body.append(menu);
			Contextmenu.keepOnScreen(menu);
			return new Promise(() => {});
		}
		const title = document.createElement("h2");
		title.textContent = guilds[0].properties.name;
		title.classList.add("emojiTitle");
		topBar.append(title);

		const search = document.createElement("input");
		search.type = "text";
		topBar.append(search);

		let html: HTMLElement | undefined = undefined;
		let topSticker: undefined | Sticker = undefined;
		const updateSearch = () => {
			if (search.value === "") {
				if (html) html.click();
				search.style.removeProperty("width");
				topSticker = undefined;
				return;
			}

			search.style.setProperty("width", "3in");
			title.innerText = "";
			body.innerHTML = "";
			const searchResults = Sticker.searchStickers(search.value, localuser, 200);
			if (searchResults[0]) {
				topSticker = searchResults[0][0];
			}
			for (const [sticker] of searchResults) {
				const emojiElem = document.createElement("div");
				emojiElem.classList.add("stickerSelect");

				emojiElem.append(sticker.getHTML());
				body.append(emojiElem);

				emojiElem.addEventListener("click", () => {
					res(sticker);
					Contextmenu.declareMenu();
				});
			}
		};
		search.addEventListener("input", () => {
			updateSearch.call(this);
		});
		search.addEventListener("keyup", (e) => {
			if (e.key === "Enter" && topSticker) {
				res(topSticker);
				Contextmenu.declareMenu();
			}
		});

		menu.append(topBar);

		const selection = document.createElement("div");
		selection.classList.add("flexltr", "emojirow");
		const body = document.createElement("div");
		body.classList.add("stickerBody");

		let isFirst = true;
		let i = 0;
		guilds.forEach((guild) => {
			const select = document.createElement("div");
			if (i === 0) {
				html = select;
				i++;
			}
			select.classList.add("emojiSelect");

			if (guild.properties.icon) {
				const img = document.createElement("img");
				img.classList.add("pfp", "servericon", "emoji-server");
				img.crossOrigin = "anonymous";
				img.src =
					localuser.info.cdn +
					"/icons/" +
					guild.properties.id +
					"/" +
					guild.properties.icon +
					".png" +
					new CDNParams({expectedSize: 48});
				img.alt = "Server: " + guild.properties.name;
				select.appendChild(img);
			} else {
				const div = document.createElement("span");
				div.textContent = guild.properties.name
					.replace(/'s /g, " ")
					.replace(/\w+/g, (word) => word[0])
					.replace(/\s/g, "");
				select.append(div);
			}

			selection.append(select);

			const clickEvent = () => {
				search.value = "";
				updateSearch.call(this);
				title.textContent = guild.properties.name;
				body.innerHTML = "";
				for (const [, sticker] of guild.stickers) {
					const stickerElem = document.createElement("div");
					stickerElem.classList.add("stickerSelect");
					stickerElem.append(sticker.getHTML());
					body.append(stickerElem);
					stickerElem.addEventListener("click", () => {
						res(sticker);
						Contextmenu.declareMenu();
					});
				}
			};

			select.addEventListener("click", clickEvent);
			if (isFirst) {
				clickEvent();
				isFirst = false;
			}
		});

		Contextmenu.declareMenu(menu);
		document.body.append(menu);
		Contextmenu.keepOnScreen(menu);
		menu.append(selection);
		menu.append(body);
		search.focus();
		return promise;
	}
}
export {Sticker};
