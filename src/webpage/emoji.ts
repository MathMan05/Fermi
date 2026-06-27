import {Contextmenu} from "./contextmenu.js";
import {Guild} from "./guild.js";
import {Hover} from "./hover.js";
import {I18n} from "./i18n.js";
import {emojijson, emojiSource} from "./jsontypes.js";
import {Localuser} from "./localuser.js";
import {BinRead} from "./utils/binaryUtils.js";
import {CDNParams} from "./utils/cdnParams.js";
import {removeAni} from "./utils/utils.js";

//I need to recompile the emoji format for translation
class Emoji {
	static emojis: {
		name: string;
		emojis: {
			name: string;
			emoji: string;
		}[];
	}[];
	name: string;
	id?: string;
	emoji?: string;
	animated: boolean;
	owner?: Guild | Localuser;
	get guild() {
		if (this.owner instanceof Guild) {
			return this.owner;
		}
		return null;
	}
	get localuser() {
		if (this.owner instanceof Guild) {
			return this.owner.localuser;
		} else {
			return this.owner;
		}
	}
	constructor(json: emojijson, owner?: Guild | Localuser) {
		this.name = json.name;
		this.id = json.id;
		this.animated = json.animated || false;
		this.owner = owner;
		this.emoji = json.emoji;
	}
	get humanName() {
		if (this.id) {
			const trim = this.name.split(":")[1];
			if (trim) {
				return trim;
			}
		}
		return this.name;
	}
	static emojiMap = new WeakMap<Localuser, Map<string, emojiSource | void>>();
	static async lookupEmoji(id: string, localuser: Localuser): Promise<emojiSource | void> {
		const guild = localuser.guilds
			.values()
			.find((guild) => guild.emojis.find((emoji) => emoji.id === id));
		if (guild) {
			return {
				type: "GUILD",
				guild: {
					id: guild.id,
					name: guild.properties.name,
					nsfw: guild.properties.nsfw,
					icon: guild.properties.icon,
					features: guild.properties.features,
					description: guild.properties.description,
				},
			};
		}

		const map = this.emojiMap.get(localuser) || new Map();
		this.emojiMap.set(localuser, map);

		if (map.has(id)) return map.get(id);

		const res = await fetch(localuser.info.api + `/emojis/${id}/source`, {
			headers: localuser.headers,
		});
		if (res.status === 403) {
			map.set(id, undefined);
			return undefined;
		}
		const json = (await res.json()) as emojiSource;
		map.set(id, json);
		return json;
	}
	getHTML(bigemoji: boolean = false, click = true) {
		if (this.id) {
			if (!this.owner) throw new Error("owner is missing for custom emoji!");
			const emojiElem = document.createElement("img");
			emojiElem.classList.add("md-emoji");
			emojiElem.classList.add(bigemoji ? "bigemoji" : "smallemoji");
			emojiElem.crossOrigin = "anonymous";
			emojiElem.src =
				this.owner.info.cdn +
				"/emojis/" +
				this.id +
				"." +
				(this.animated ? "gif" : "png") +
				new CDNParams({expectedSize: 32, animated: this.animated});
			emojiElem.alt = this.name;
			emojiElem.loading = "lazy";

			const hover = new Hover(this.humanName);
			hover.addEvent(emojiElem);
			if (click)
				emojiElem.onclick = async (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					const div = document.createElement("div");
					div.style.top = e.clientY + "px";
					div.style.left = e.clientX + "px";
					div.classList.add("flexttb", "EmojiGuildMenu");

					const localuser = this.localuser as Localuser;
					const lookup = await Emoji.lookupEmoji(this.id as string, localuser);

					const top = document.createElement("div");
					top.classList.add("flexltr", "GuildEmojiTop");

					const toptext = document.createElement("div");
					toptext.classList.add("flexttb");
					div.append(toptext);

					const name = document.createElement("span");
					name.textContent = `:${this.humanName}:`;

					const desc = document.createElement("span");

					toptext.append(name, desc);
					top.append(this.getHTML(true, false), toptext);

					if (!lookup?.guild) {
						desc.textContent = I18n.emoji.found.private();
						return;
					}
					const guild = localuser.guilds.get(lookup.guild?.id as string);
					if (guild) {
						if (localuser.focusGuild === guild) {
							desc.textContent = I18n.emoji.found.this();
						} else {
							desc.textContent = I18n.emoji.found.other();
						}
					} else {
						desc.textContent = I18n.emoji.found.not();
					}

					const h3 = document.createElement("h3");
					h3.textContent = I18n.emoji.from();

					const guildRow = document.createElement("div");
					guildRow.classList.add("flexltr", "guildEmojiRow");

					const guildText = document.createElement("div");
					guildText.classList.add("flexttb", "guildEmojiText");

					const guildName = document.createElement("span");
					guildName.textContent = lookup.guild.name;

					const guildDesc = document.createElement("span");
					const discoverable = lookup.guild.features.find((_) => _ === "DISCOVERABLE");
					if (discoverable) {
						if (lookup.guild.description) {
							guildDesc.textContent = lookup.guild.description;
						}
					} else {
						guildDesc.textContent = I18n.emoji.privateGuild();
					}

					guildText.append(guildName, guildDesc);
					if (!guild && discoverable) {
						const button = document.createElement("button");
						button.textContent = I18n.emoji.join();
						button.classList.add("emojiJoin");
						guildText.append(button);
						button.onclick = async () => {
							const joinRes = await fetch(
								localuser.info.api + "/guilds/" + lookup.guild?.id + "/members/@me",
								{
									method: "PUT",
									headers: localuser.headers,
								},
							);
							if (joinRes.ok) {
								removeAni(div);
							}
						};
					}
					guildRow.append(
						Guild.generateGuildIcon({...lookup.guild, info: localuser.info}, false)
							.lastChild as HTMLElement,
						guildText,
					);
					div.append(top, h3, guildRow);

					document.body.append(div);
					Contextmenu.keepOnScreen(div);
					Contextmenu.declareMenu(div);
				};

			return emojiElem;
		} else if (this.emoji || this.name) {
			const emojiElem = document.createElement("span");
			emojiElem.classList.add("md-emoji");
			emojiElem.classList.add(bigemoji ? "bigemoji" : "smallemoji");
			emojiElem.textContent = this.emoji || this.name;

			const hover = new Hover(this.humanName);
			hover.addEvent(emojiElem);

			return emojiElem;
		} else {
			throw new Error("This path should *never* be gone down, this means a malformed emoji");
		}
	}
	static decodeEmojiList(buffer: ArrayBuffer) {
		const reader = new BinRead(buffer);
		const build: {name: string; emojis: {name: string; emoji: string}[]}[] = [];
		let cats = reader.read16();

		for (; cats !== 0; cats--) {
			const name = reader.readString16();
			const emojis: {
				name: string;
				skin_tone_support: boolean;
				emoji: string;
			}[] = [];
			let emojinumber = reader.read16();
			for (; emojinumber !== 0; emojinumber--) {
				//console.log(emojis);
				const name = reader.readString8();
				const len = reader.read8();
				const skin_tone_support = len > 127;
				const emoji = reader.readStringNo(len - Number(skin_tone_support) * 128);
				emojis.push({
					name,
					skin_tone_support,
					emoji,
				});
			}
			build.push({
				name,
				emojis,
			});
		}
		this.emojis = build;
	}
	static grabEmoji() {
		fetch("/emoji.bin")
			.then((e) => {
				return e.arrayBuffer();
			})
			.then((e) => {
				Emoji.decodeEmojiList(e);
			});
	}
	static getEmojiFromIDOrString(idOrString: string, localuser: Localuser) {
		for (const list of Emoji.emojis) {
			const emj = list.emojis.find((_) => _.emoji === idOrString);
			if (emj) {
				return new Emoji(emj, localuser);
			}
		}
		for (const guild of localuser.guilds.values()) {
			if (!guild.emojis) continue;
			const emj = guild.emojis.find((_) => _.id === idOrString);
			if (emj) {
				return new Emoji(emj, localuser);
			}
		}
		return new Emoji(
			{
				id: idOrString,
				name: "",
			},
			localuser,
		);
	}
	static async emojiPicker(
		this: typeof Emoji,
		x: number,
		y: number,
		localuser?: Localuser,
	): Promise<Emoji> {
		let res: (r: Emoji) => void;
		this;
		const promise: Promise<Emoji> = new Promise((r) => {
			res = r;
		});
		const menu = document.createElement("div");
		menu.classList.add("flexttb", "emojiPicker");
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

		const title = document.createElement("h2");
		title.textContent = Emoji.emojis[0].name;
		title.classList.add("emojiTitle");
		topBar.append(title);

		const search = document.createElement("input");
		search.type = "text";
		topBar.append(search);

		let html: HTMLElement | undefined = undefined;
		let topEmoji: undefined | Emoji = undefined;
		function updateSearch(this: typeof Emoji) {
			if (search.value === "") {
				if (html) html.click();
				search.style.removeProperty("width");
				topEmoji = undefined;
				return;
			}

			search.style.setProperty("width", "3in");
			title.innerText = "";
			body.innerHTML = "";
			const searchResults = this.searchEmoji(search.value, localuser, 200);
			if (searchResults[0]) {
				topEmoji = searchResults[0][0];
			}
			for (const [emoji] of searchResults) {
				const emojiElem = document.createElement("div");
				emojiElem.classList.add("emojiSelect");

				emojiElem.append(emoji.getHTML(false, false));
				body.append(emojiElem);

				emojiElem.addEventListener("click", () => {
					res(emoji);
					Contextmenu.declareMenu();
				});
			}
		}
		search.addEventListener("input", () => {
			updateSearch.call(this);
		});
		search.addEventListener("keyup", (e) => {
			if (e.key === "Enter" && topEmoji) {
				res(topEmoji);
				Contextmenu.declareMenu();
			}
		});

		menu.append(topBar);

		const selection = document.createElement("div");
		selection.classList.add("flexltr", "emojirow");
		const body = document.createElement("div");
		body.classList.add("emojiBody");

		let isFirst = true;
		if (localuser) {
			[
				localuser.focusGuild,
				...localuser.guilds.values().filter((guild) => guild !== localuser.focusGuild),
			]
				.filter((_) => _ !== undefined)
				.filter((guild) => guild.id != "@me" && guild.emojis.length > 0)
				.forEach((guild) => {
					const select = document.createElement("div");
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
						for (const emojit of guild.emojis) {
							const emojiElem = document.createElement("div");
							emojiElem.classList.add("emojiSelect");

							const emojiClass = new Emoji(
								{
									id: emojit.id as string,
									name: emojit.name,
									animated: emojit.animated as boolean,
								},
								localuser,
							);
							emojiElem.append(emojiClass.getHTML(false, false));
							body.append(emojiElem);

							emojiElem.addEventListener("click", () => {
								res(emojiClass);
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
		}

		let i = 0;

		Contextmenu.declareMenu(menu);
		document.body.append(menu);
		Contextmenu.keepOnScreen(menu);
		const recent = localuser?.favorites.emojiFreq();
		if (recent && recent.length >= 15 && localuser) {
			const select = document.createElement("div");
			select.classList.add("svg-history");
			selection.append(select);
			console.log("appended");
			select.onclick = () => {
				title.textContent = I18n.recentEmoji();
				body.innerHTML = "";
				for (const [emj] of recent) {
					const emoji = Emoji.getEmojiFromIDOrString(emj, localuser);
					const emojihtml = document.createElement("div");
					emojihtml.classList.add("emojiSelect");
					emojihtml.append(emoji.getHTML(false, false));
					body.append(emojihtml);
					emojihtml.onclick = (_) => {
						res(emoji);
						Contextmenu.declareMenu();
					};
				}
			};
			select.click();
			i++;
		}

		for (const thing of Emoji.emojis) {
			const select = document.createElement("div");
			select.textContent = thing.emojis[0].emoji;
			select.classList.add("emojiSelect");
			selection.append(select);
			const clickEvent = () => {
				search.value = "";
				updateSearch.call(this);
				title.textContent = thing.name;
				body.innerHTML = "";
				for (const emojit of thing.emojis.map((_) => new Emoji(_, localuser))) {
					const emoji = document.createElement("div");
					emoji.classList.add("emojiSelect");
					emoji.append(emojit.getHTML(false, false));
					body.append(emoji);
					emoji.onclick = (_) => {
						res(emojit);
						Contextmenu.declareMenu();
					};
				}
			};
			select.onclick = clickEvent;
			if (i === 0) {
				html = select;
				clickEvent();
			}
			i++;
		}
		menu.append(selection);
		menu.append(body);
		search.focus();
		return promise;
	}
	static searchEmoji(search: string, localuser?: Localuser, results = 50): [Emoji, number][] {
		//NOTE this function is used for searching in the emoji picker for reactions, and the emoji auto-fill
		const ranked: [emojijson, number][] = [];
		function similar(json: emojijson) {
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
		for (const group of this.emojis) {
			for (const emoji of group.emojis) {
				similar(emoji);
			}
		}
		const weakGuild = new WeakMap<emojijson, Guild>();
		if (localuser) {
			for (const guild of localuser.guilds.values()) {
				if (guild.id !== "@me" && guild.emojis.length !== 0) {
					for (const emoji of guild.emojis) {
						if (similar(emoji)) {
							weakGuild.set(emoji, guild);
						}
					}
				}
			}
		}
		ranked.sort((a, b) => b[1] - a[1]);
		return ranked.splice(0, results).map((a) => {
			return [new Emoji(a[0], weakGuild.get(a[0]) || localuser), a[1]];
		});
	}
}
Emoji.grabEmoji();
export {Emoji};
