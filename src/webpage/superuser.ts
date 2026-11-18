import {Play} from "./audio/play";
import {Contextmenu} from "./contextmenu";
import {FS} from "./fs";
import {Hover} from "./hover";
import {I18n} from "./i18n";
import {Localuser} from "./localuser";
import {makeLogin} from "./login";
import {showusersettings} from "./mainSettings";
import {MarkDown} from "./markdown";
import {TypeBox} from "./typeBox";
import {decode64} from "./utils/base64";
import {getPreferences} from "./utils/storage/userPreferences";
import {getBulkInfo, mobile, setTheme, Specialuser} from "./utils/utils";

export class SuperUser {
	locals: Localuser[] = [];
	current?: Localuser;
	static font?: FontFace;
	constructor() {}
	static channelMenu: Contextmenu<SuperUser, void>;
	static {
		this.channelMenu = new Contextmenu<SuperUser, void>("create rightclick");
		this.channelMenu.addButton(
			I18n.channel.createChannel(),
			function () {
				if (this.current?.focusGuild) {
					this.current.focusGuild.createchannels();
				}
			},
			{
				visible: function () {
					return this.current?.focusGuild?.member.hasPermission("MANAGE_CHANNELS") || false;
				},
			},
		);

		this.channelMenu.addButton(
			I18n.channel.createCatagory(),
			function () {
				if (this.current?.focusGuild) {
					this.current.focusGuild.createcategory();
				}
			},
			{
				visible: function () {
					return this.current?.focusGuild?.member.hasPermission("MANAGE_CHANNELS") || false;
				},
			},
		);
	}
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
	async init() {
		let templateID = new URLSearchParams(window.location.search).get("templateID");
		const userInfoElement = document.getElementById("userinfo") as HTMLDivElement;
		userInfoElement.addEventListener("click", (event) => {
			event.stopImmediatePropagation();
			const rect = userInfoElement.getBoundingClientRect();
			if (!this.current) return;
			Localuser.userMenu.makemenu(rect.x, rect.top - 10 - window.innerHeight, this.current);
		});

		const switchAccountsElement = document.getElementById("switchaccounts") as HTMLDivElement;
		switchAccountsElement.addEventListener("click", async (event) => {
			event.stopImmediatePropagation();
			if (!this.current) return;
			Localuser.showAccountSwitcher(this, this.current);
		});
		const loaddesc = document.getElementById("load-desc") as HTMLSpanElement;
		try {
			const current = sessionStorage.getItem("currentuser") || Localuser.users.currentuser;
			if (!Localuser.users.users[current]) {
				this.current = new Localuser(
					await new Promise<Specialuser>((res) => makeLogin(true, "", res)),
					this,
				);
			} else {
				this.current = new Localuser(Localuser.users.users[current], this);
			}

			this.current.initwebsocket().then(async () => {
				if (this.current) TypeBox.regSwap(this.current);
				this.current?.loaduser();
				await this.current?.init();
				const loading = document.getElementById("loading") as HTMLDivElement;
				loading.classList.add("doneloading");
				loading.classList.remove("loading");
				loaddesc.textContent = I18n.loaded();

				if (templateID) {
					this.current?.passTemplateID(templateID);
				}
			});
		} catch (e) {
			console.error(e);
			loaddesc.textContent = I18n.accountNotStart();
			this.current = undefined;
		}
		SuperUser.channelMenu.bindContextmenu(
			document.getElementById("channels") as HTMLDivElement,
			this,
		);
		window.addEventListener("popstate", (e) => {
			if (e.state instanceof Object) {
				this.current?.goToState(e.state);
			}
			//console.log(e.state,"state:3")
		});
		this.setupBoxes();
		await setTheme();
		(document.getElementById("settings") as HTMLImageElement).onclick =
			this.userSettings.bind(this);
		const memberListToggle = document.getElementById("memberlisttoggle") as HTMLInputElement;
		memberListToggle.checked = !localStorage.getItem("memberNotChecked");
		memberListToggle.onchange = () => {
			if (!memberListToggle.checked) {
				localStorage.setItem("memberNotChecked", "true");
			} else {
				localStorage.removeItem("memberNotChecked");
			}
		};
		if (mobile) {
			const channelWrapper = document.getElementById("channelw") as HTMLDivElement;
			channelWrapper.onclick = () => {
				const toggle = document.getElementById("maintoggle") as HTMLInputElement;
				toggle.checked = true;
			};
			memberListToggle.checked = false;
		}

		const pinnedM = document.getElementById("pinnedM") as HTMLElement;
		pinnedM.onclick = (e) => {
			this.current?.pinnedClick(pinnedM.getBoundingClientRect());
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		const umenu = new Contextmenu<void, void>("upload");
		umenu.addButton(
			I18n.makePoll(),
			() => {
				this.current?.makePoll();
			},
			{
				//TODO re-enable this once polls is merged
				visible: () => !!this.current?.focusChannel?.hasPermission("SEND_POLLS"),
			},
		);
		umenu.addButton(I18n.upload(), () => {
			TypeBox.uploadFiles();
		});
		umenu.bindContextmenu(
			document.getElementById("upload")!,
			undefined,
			undefined,
			undefined,
			undefined,
			"left",
			"bottom",
		);
		const emojiTB = document.getElementById("emojiTB") as HTMLElement;
		emojiTB.onmousedown = (e) => e.stopImmediatePropagation();
		emojiTB.onclick = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.current?.TBEmojiMenu(emojiTB.getBoundingClientRect());
		};

		const gifTB = document.getElementById("gifTB") as HTMLElement;
		gifTB.onmousedown = (e) => e.stopImmediatePropagation();
		gifTB.onclick = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.current?.makeGifBox(gifTB.getBoundingClientRect());
		};

		const stickerTB = document.getElementById("stickerTB") as HTMLElement;
		stickerTB.onmousedown = (e) => e.stopImmediatePropagation();
		stickerTB.onclick = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.current?.makeStickerBox(stickerTB.getBoundingClientRect());
		};
		const updateIcon = document.getElementById("updateIcon");
		if (updateIcon) {
			new Hover(() => updateIcon.textContent || "").addEvent(updateIcon);
			updateIcon.onclick = () => {
				window.location.reload();
			};
		}
	}
	userSettings(): void {
		if (this.current) showusersettings(this.current);
	}
	setupBoxes() {
		const searchBox = document.getElementById("searchBox") as HTMLDivElement;
		const markdown = new MarkDown("", this.current ?? undefined);
		const searchX = document.getElementById("searchX") as HTMLElement;
		searchBox.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.current?.mSearch(markdown.rawString);
			}
		});
		searchBox.addEventListener("keyup", () => {
			if (searchBox.textContent === "") {
				setTimeout(() => (searchBox.innerHTML = ""), 0);
				searchX.classList.add("svg-search");
				searchX.classList.remove("svg-plainx");
				searchBox.parentElement!.classList.remove("searching");
			} else {
				searchX.classList.remove("svg-search");
				searchX.classList.add("svg-plainx");
				searchBox.parentElement!.classList.add("searching");
			}
		});
		const sideContainDiv = document.getElementById("sideContainDiv") as HTMLElement;
		searchBox.onclick = () => {
			sideContainDiv.classList.remove("hideSearchDiv");
		};
		searchX.onclick = () => {
			if (searchX.classList.contains("svg-plainx")) {
				markdown.txt = [];
				searchBox.innerHTML = "";
				searchX.classList.add("svg-search");
				searchBox.parentElement!.classList.remove("searching");
				searchX.classList.remove("svg-plainx");
				this.current?.mSearch("");
			} else {
				searchBox.parentElement!.classList.add("searching");
			}
		};

		markdown.giveBox(searchBox);
		markdown.setCustomBox((e) => {
			const span = document.createElement("span");
			span.textContent = e.replace("\n", "");
			return span;
		});
		Play.playURL("/audio/sounds.jasf").then((_) => {
			this.play = _;
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
	play?: Play;
	fs = new FS();
	async playSound(local: Localuser, name = this.getNotificationSound()) {
		const volume = this.getNotiVolume();
		if (this.play) {
			const voice = this.play.tracks.includes(name);
			if (voice) {
				this.play.play(name, volume);
			} else {
				const audio = document.createElement("audio");
				let sound = await this.fs.getFile("/customSound", false);
				if (local.perminfo.sound?.cSound) {
					const s = local.perminfo.sound.cSound as string;
					if (!s) return;
					const byteString = s.split(",")[1];

					sound = await this.fs.getFile("/customSound", true);
					if (!sound) return;
					await sound.write(decode64(byteString));
					delete local.perminfo.sound;
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
