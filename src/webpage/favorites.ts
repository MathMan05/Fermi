import {favandfreq, freq} from "./jsontypes.js";
import {Localuser} from "./localuser.js";
const enum saveImportance {
	no = 0,
	verylow = 1,
	low = 2,
	medium = 3,
	high = 4,
}
interface permStore {
	current: {
		gifs: favandfreq["favoriteGifs"]["gifs"];
		emojiFrecency: favandfreq["emojiFrecency"]["emojis"];
		emojiReactionFrecency: favandfreq["emojiReactionFrecency"]["emojis"];
		guildAndChannelFrecency: favandfreq["guildAndChannelFrecency"]["guildAndChannels"];
		favorite_stickers: string[];
		sticker_frecency: favandfreq["sticker_frecency"]["stickers"];
		favorite_emojis: string[];
	};
	needsSave: saveImportance;
	lastSave: number;
	lastDecay: number;
	old: favandfreqimp;
}
type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? RecursivePartial<U>[]
		: T[P] extends object | undefined
			? RecursivePartial<T[P]>
			: T[P];
};

type favandfreqimp = Omit<
	favandfreq,
	| "application_command_frecency"
	| "favorite_soundboard_sounds"
	| "application_frecency"
	| "heard_sound_frecency"
	| "played_sound_frecency"
>;

export class Favorites {
	owner: Localuser;
	// ----- stuff that needs to store ----
	private gifs: favandfreq["favoriteGifs"]["gifs"] = {};
	private emojiFrecency: favandfreq["emojiFrecency"]["emojis"] = {};
	private emojiReactionFrecency: favandfreq["emojiReactionFrecency"]["emojis"] = {};
	private guildAndChannelFrecency: favandfreq["guildAndChannelFrecency"]["guildAndChannels"] = {};
	private favorite_stickers: string[] = [];
	private sticker_frecency: favandfreq["sticker_frecency"]["stickers"] = {};
	private favorite_emojis: string[] = [];
	private needsSave: saveImportance = 0;
	private lastSave = 0;
	private lastDecay = 0;
	private old!: favandfreqimp;
	// ----- end of stuff that needs to store ----
	get info() {
		return this.owner.info;
	}
	get headers() {
		return this.owner.headers;
	}
	constructor(owner: Localuser) {
		this.owner = owner;
		this.setup();
	}
	get store() {
		return (this.owner.perminfo.favoriteStore || {}) as permStore;
	}
	hasGif(gif: string) {
		return !!this.gifs[gif];
	}
	loadFromLocal() {
		const store: RecursivePartial<permStore> = this.store;
		store.current ||= {};
		store.current.gifs ||= {};
		store.current.emojiFrecency ||= {};
		store.current.emojiReactionFrecency ||= {};
		store.current.guildAndChannelFrecency ||= {};
		store.current.sticker_frecency ||= {};
		store.current.favorite_stickers = [];
		store.current.favorite_emojis = [];
		function deapClone(clone: any) {
			const val = JSON.parse(JSON.stringify(clone));
			return val;
		}
		const old = deapClone((store.old ||= {})) as Partial<favandfreqimp>;
		old.favoriteGifs ||= {
			gifs: {},
			hideTooltip: false,
		};
		old.emojiFrecency ||= {
			emojis: {},
		};
		old.emojiReactionFrecency ||= {
			emojis: {},
		};
		old.guildAndChannelFrecency ||= {
			guildAndChannels: {},
		};

		old.favorite_emojis ||= {emojis: []};
		old.favorite_stickers ||= {sticker_ids: []};
		old.sticker_frecency ||= {
			stickers: {},
		};
		store.old = old;

		store.needsSave ||= 0;
		store.lastSave ||= Date.now();
		store.lastDecay ||= Date.now();

		this.needsSave = store.needsSave;
		this.lastSave = store.lastSave;
		this.lastDecay = store.lastDecay;

		this.old = old as favandfreq;

		this.favorite_emojis = deapClone(store.current.favorite_emojis);
		this.sticker_frecency = deapClone(store.current.sticker_frecency);
		this.favorite_stickers = deapClone(store.current.favorite_stickers);
		this.gifs = deapClone(store.current.gifs);
		this.emojiFrecency = deapClone(store.current.emojiFrecency);
		this.emojiReactionFrecency = deapClone(store.current.emojiReactionFrecency);

		this.guildAndChannelFrecency = deapClone(store.current.guildAndChannelFrecency);
	}
	saveLocal() {
		const save: permStore = {
			old: this.old,
			current: {
				emojiFrecency: this.emojiFrecency,
				gifs: this.gifs,
				emojiReactionFrecency: this.emojiReactionFrecency,
				guildAndChannelFrecency: this.guildAndChannelFrecency,
				favorite_stickers: this.favorite_stickers,
				sticker_frecency: this.sticker_frecency,
				favorite_emojis: this.favorite_emojis,
			},
			lastDecay: this.lastDecay,
			lastSave: this.lastSave,
			needsSave: this.needsSave,
		};
		this.owner.perminfo.favoriteStore = save;
	}
	async saveNetwork() {
		await this.startSync(false);
		const body: {settings: favandfreqimp} = {
			settings: {
				favoriteGifs: {
					gifs: this.gifs,
					hideTooltip: false,
				},
				emojiFrecency: {
					emojis: this.emojiFrecency,
				},
				emojiReactionFrecency: {
					emojis: this.emojiReactionFrecency,
				},
				guildAndChannelFrecency: {
					guildAndChannels: this.guildAndChannelFrecency,
				},
				favorite_stickers: {sticker_ids: this.favorite_stickers},
				sticker_frecency: {
					stickers: this.sticker_frecency,
				},
				favorite_emojis: {emojis: this.favorite_emojis},
			},
		};
		const res = await fetch(this.info.api + "/users/@me/settings-proto/2/json", {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify(body),
		});
		if (res.ok) {
			this.needsSave = saveImportance.no;
			this.lastSave = Date.now();
		}
	}
	async startSync(save = true) {
		const sat = fetch(this.info.api + "/users/@me/settings-proto/2/json", {
			headers: this.headers,
		});
		const res: {settings: Partial<favandfreq>} = await (await sat).json();
		//TODO remove this eventually
		delete this.emojiReactionFrecency["undefined"];
		delete this.store.current.emojiReactionFrecency["undefined"];
		if (res.settings.emojiReactionFrecency)
			delete res.settings.emojiReactionFrecency.emojis["undefined"];
		this.saveDifs(res.settings, save);
	}
	async setup() {
		try {
			this.loadFromLocal();
			await this.startSync();
		} catch (e) {
			console.error(e);
		}
	}
	getOld(): favandfreqimp {
		return this.old;
	}
	setOld(newold: favandfreqimp) {
		this.old = structuredClone(newold);
		this.saveLocal();
		return;
	}
	mixNewOldNetwork(
		newf: {[key: string]: freq},
		old: {[key: string]: freq},
		net: {[key: string]: freq},
	) {
		const oldKeys = new Set(Object.keys(old));
		const newKeys = new Set(Object.keys(newf));
		const removedKeys = oldKeys.difference(newKeys);
		const addedKeys = newKeys.difference(oldKeys);
		for (const key of removedKeys) {
			delete net[key];
		}
		for (const key of addedKeys) {
			if (net[key]) {
				const newEmj = newf[key];
				const netEmj = net[key];
				netEmj.totalUses += newEmj.totalUses;
				netEmj.score += newEmj.score;
				netEmj.recentUses = newEmj.recentUses
					.concat(netEmj.recentUses)
					.sort((a, b) => Number(BigInt(b) - BigInt(a)))
					.splice(0, 20);
			} else {
				net[key] = newf[key];
			}
		}
		const sharedKeys = newKeys.intersection(oldKeys);
		for (const key of sharedKeys) {
			const oldEmj = old[key];
			const newEmj = newf[key];
			if (net[key]) {
				const netEmj = net[key];
				netEmj.totalUses += newEmj.totalUses - oldEmj.totalUses;
				netEmj.score += newEmj.score - oldEmj.score;

				netEmj.recentUses = newEmj.recentUses
					.concat(netEmj.recentUses)
					.sort((a, b) => Number(BigInt(b) - BigInt(a)))
					.splice(0, 20);
			} else {
				net[key] = newEmj;
			}
		}
	}
	saveDifs(diffs: Partial<favandfreq>, save = true) {
		const old = this.getOld();
		if (diffs.favoriteGifs?.gifs) {
			const oldKeys = new Set(Object.keys(old.favoriteGifs.gifs));
			const newKeys = new Set(Object.keys(this.gifs));
			const removedKeys = oldKeys.difference(newKeys);
			const addedKeys = newKeys.difference(oldKeys);
			for (const key of removedKeys) {
				delete diffs.favoriteGifs.gifs[key];
			}
			for (const key of addedKeys) {
				diffs.favoriteGifs.gifs[key] = this.gifs[key];
			}
			old.favoriteGifs.gifs = this.gifs = diffs.favoriteGifs.gifs;
		}

		if (diffs.favorite_stickers?.sticker_ids) {
			const oldKeys = new Set(Object.keys(old.favorite_stickers.sticker_ids));
			const newKeys = new Set(Object.keys(this.favorite_stickers));
			const removedKeys = oldKeys.difference(newKeys);
			const addedKeys = newKeys.difference(oldKeys);

			diffs.favorite_stickers.sticker_ids = diffs.favorite_stickers.sticker_ids.filter(
				(_) => !removedKeys.has(_),
			);

			diffs.favorite_stickers.sticker_ids = [
				...new Set([...diffs.favorite_stickers.sticker_ids, ...addedKeys]),
			];

			old.favorite_stickers.sticker_ids = this.favorite_stickers =
				diffs.favorite_stickers.sticker_ids;
		}

		if (diffs.favorite_emojis?.emojis) {
			const oldKeys = new Set(Object.keys(old.favorite_emojis.emojis));
			const newKeys = new Set(Object.keys(this.favorite_emojis));
			const removedKeys = oldKeys.difference(newKeys);
			const addedKeys = newKeys.difference(oldKeys);

			diffs.favorite_emojis.emojis = diffs.favorite_emojis.emojis.filter(
				(_) => !removedKeys.has(_),
			);

			diffs.favorite_emojis.emojis = [...new Set([...diffs.favorite_emojis.emojis, ...addedKeys])];

			old.favorite_emojis.emojis = this.favorite_emojis = diffs.favorite_emojis.emojis;
		}

		if (diffs.emojiFrecency?.emojis) {
			this.mixNewOldNetwork(
				this.emojiFrecency,
				old.emojiFrecency.emojis,
				diffs.emojiFrecency.emojis,
			);
			old.emojiFrecency.emojis = this.emojiFrecency = diffs.emojiFrecency.emojis;
		}
		if (diffs.emojiReactionFrecency?.emojis) {
			this.mixNewOldNetwork(
				this.emojiReactionFrecency,
				old.emojiReactionFrecency.emojis,
				diffs.emojiReactionFrecency.emojis,
			);
			old.emojiReactionFrecency.emojis = this.emojiReactionFrecency =
				diffs.emojiReactionFrecency.emojis;
		}
		if (diffs.guildAndChannelFrecency?.guildAndChannels) {
			this.mixNewOldNetwork(
				this.guildAndChannelFrecency,
				old.guildAndChannelFrecency.guildAndChannels,
				diffs.guildAndChannelFrecency.guildAndChannels,
			);
			old.guildAndChannelFrecency.guildAndChannels = this.guildAndChannelFrecency =
				diffs.guildAndChannelFrecency.guildAndChannels;
		}

		if (diffs.sticker_frecency?.stickers) {
			this.mixNewOldNetwork(
				this.sticker_frecency,
				old.sticker_frecency.stickers,
				diffs.sticker_frecency.stickers,
			);
			old.sticker_frecency.stickers = this.sticker_frecency = diffs.sticker_frecency.stickers;
		}

		this.setOld(old);

		this.decayScore(save);
	}
	favoriteGifs() {
		return structuredClone(Object.values(this.gifs).sort((a, b) => a.order - b.order));
	}
	favoriteStickers() {
		return structuredClone(this.favorite_stickers);
	}
	stickersFreq() {
		return Object.entries(this.sticker_frecency).sort((a, b) => b[1].score - a[1].score);
	}
	favoriteEmojis() {
		return structuredClone(this.favorite_emojis);
	}
	emojiFreq() {
		return Object.entries(this.emojiFrecency).sort((a, b) => b[1].score - a[1].score);
	}
	emojiReactFreq() {
		return Object.entries(this.emojiReactionFrecency).sort((a, b) => b[1].score - a[1].score);
	}
	async addEmoji(nameOrID: string) {
		const obj = (this.emojiFrecency[nameOrID] ??= {
			totalUses: 0,
			recentUses: [],
			frecency: -1,
			score: 0,
		});
		obj.totalUses++;
		obj.recentUses.unshift(Math.floor(Date.now()) + "");
		obj.recentUses = obj.recentUses.splice(0, 20);
		obj.score += 100;
		await this.save(saveImportance.low);
	}
	async addStickerFreq(id: string) {
		const obj = (this.sticker_frecency[id] ??= {
			totalUses: 0,
			recentUses: [],
			frecency: -1,
			score: 0,
		});
		obj.totalUses++;
		obj.recentUses.unshift(Math.floor(Date.now()) + "");
		obj.recentUses = obj.recentUses.splice(0, 20);
		obj.score += 100;
		await this.save(saveImportance.low);
	}
	async addReactEmoji(nameOrID: string) {
		if (nameOrID === "undefined" || nameOrID === undefined) return;
		const obj = (this.emojiReactionFrecency[nameOrID] ??= {
			totalUses: 0,
			recentUses: [],
			frecency: -1,
			score: 0,
		});
		obj.totalUses++;
		obj.recentUses.unshift(Math.floor(Date.now()) + "");
		obj.recentUses = obj.recentUses.splice(0, 20);
		obj.score += 100;
		await this.save(saveImportance.low);
	}
	async addChannelGuild(ID: string) {
		const obj = (this.guildAndChannelFrecency[ID] ??= {
			totalUses: 0,
			recentUses: [],
			frecency: -1,
			score: 0,
		});
		obj.totalUses++;
		obj.recentUses.unshift(Math.floor(Date.now()) + "");
		obj.recentUses = obj.recentUses.splice(0, 5);
		obj.score += 100;
		await this.save(saveImportance.verylow);
	}
	async unfavoriteGif(name: string) {
		delete this.gifs[name];
		await this.save(saveImportance.high);
	}

	async favoriteSticker(id: string) {
		this.favorite_stickers.push(id);
		await this.save(saveImportance.high);
	}
	async unfavoriteSticker(id: string) {
		this.favorite_stickers = this.favorite_stickers.filter((_) => _ !== id);
		await this.save(saveImportance.high);
	}

	async favoriteEmoji(idorname: string) {
		this.favorite_emojis.push(idorname);
		await this.save(saveImportance.high);
	}
	async unfavoriteEmoji(idorname: string) {
		this.favorite_emojis = this.favorite_emojis.filter((_) => _ !== idorname);
		await this.save(saveImportance.high);
	}

	async favoriteGif(
		name: string,
		gif: Omit<favandfreq["favoriteGifs"]["gifs"][""], "order" | "format">,
	) {
		this.gifs[name] = {
			...gif,
			width: Math.round(gif.width),
			height: Math.round(gif.height),
			format: "GIF_TYPE_IMAGE",
			order: Object.keys(this.gifs).length + 1,
		};
		await this.save(saveImportance.high);
	}
	async removeFavoriteGif(name: string) {
		delete this.gifs[name];
		await this.save(saveImportance.high);
	}

	async decayScore(save = true) {
		const delta = (Date.now() - this.lastDecay) / 1000 / 60 / 60 / 12;
		if (delta < 1) {
			//Don't decay scores if less than 12 hours since last decay
			return;
		}
		// Did some math and I found I liked these values for g and n
		// f\left(x\right)=\left(\frac{x}{g}+1\right)^{-n}
		const decay = (delta / 20 + 1) ** -0.35;
		Object.values(this.emojiFrecency).forEach((emoji) => {
			emoji.score *= decay;
			emoji.score ^= 0;
		});
		Object.values(this.emojiReactionFrecency).forEach((emoji) => {
			emoji.score *= decay;
			emoji.score ^= 0;
		});
		Object.values(this.guildAndChannelFrecency).forEach((thing) => {
			thing.score *= decay;
			thing.score ^= 0;
		});
		this.lastDecay = Date.now();
		if (save) await this.save(saveImportance.low);
	}

	async save(importance: saveImportance) {
		this.saveLocal();
		let time = 0;
		this.needsSave = Math.max(this.needsSave, importance);
		switch (this.needsSave) {
			case saveImportance.no:
			case saveImportance.verylow:
				return;
			case saveImportance.low:
				time = 24 * 60 * 60 * 1000;
				break;
			case saveImportance.medium:
				time = 30 * 60 * 1000;
				break;
			case saveImportance.high:
				await this.saveNetwork();
				return;
		}
		if (this.lastSave + time < Date.now()) {
			await this.saveNetwork();
			return;
		}
	}
}
