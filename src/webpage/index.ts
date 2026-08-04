import {Localuser} from "./localuser.js";
import {Contextmenu} from "./contextmenu.js";
import {mobile, Specialuser} from "./utils/utils.js";
import {setTheme} from "./utils/utils.js";
import {MarkDown} from "./markdown.js";
import {I18n} from "./i18n.js";
import "./utils/pollyfills.js";
import {makeLogin} from "./login.js";
import {Hover} from "./hover.js";
import "./templatePage.js";
import "./more.js";
import "./recover.js";
import "./home.js";
import "./invite.js";
import "./oauth2/auth.js";
import "./audio/page.js";
import "./404.js";
import type * as C from "./typeChecker/chekerIndex.js";
import {TypeBox} from "./typeBox.js";

if (window.location.pathname === "/app") {
	window.location.pathname = "/channels/@me";
}
export interface CustomHTMLDivElement extends HTMLDivElement {
	markdown: MarkDown;
}
declare global {
	interface Window {
		checker?: typeof C.Check;
	}
}
if (localStorage.getItem("checkTypes")) {
	const i = (await import(
		"/typeChecker/chekerIndex.js" as "./typeChecker/chekerIndex.js"
	)) as typeof C;
	window.checker = i.Check;
}
if (window.location.pathname.startsWith("/donate")) {
	await I18n.done;
	I18n.translatePage();
	const desc = document.getElementById("hostDesc")!;
	desc.innerHTML = "";
	desc.append(
		...I18n.donate.host
			.desc("$NotAlisa")
			.split("\n")
			.flatMap((_, i) => (i ? [document.createElement("br"), _] : _)),
	);
}
if (window.location.pathname.startsWith("/channels")) {
	let templateID = new URLSearchParams(window.location.search).get("templateID");
	await I18n.done;
	Localuser.loadFont();

	I18n.translatePage();

	const userInfoElement = document.getElementById("userinfo") as HTMLDivElement;
	userInfoElement.addEventListener("click", (event) => {
		event.stopImmediatePropagation();
		const rect = userInfoElement.getBoundingClientRect();
		if (!thisUser) return;
		Localuser.userMenu.makemenu(rect.x, rect.top - 10 - window.innerHeight, thisUser);
	});

	const switchAccountsElement = document.getElementById("switchaccounts") as HTMLDivElement;
	switchAccountsElement.addEventListener("click", async (event) => {
		event.stopImmediatePropagation();
		if (!thisUser) return;
		Localuser.showAccountSwitcher(thisUser);
	});

	let thisUser: Localuser | null = null;

	const loaddesc = document.getElementById("load-desc") as HTMLSpanElement;
	try {
		const current = sessionStorage.getItem("currentuser") || Localuser.users.currentuser;
		if (!Localuser.users.users[current]) {
			thisUser = new Localuser(await new Promise<Specialuser>((res) => makeLogin(true, "", res)));
		} else {
			thisUser = new Localuser(Localuser.users.users[current]);
		}

		thisUser.initwebsocket().then(async () => {
			if (thisUser) TypeBox.regSwap(thisUser);
			thisUser?.loaduser();
			console.warn("huh");
			await thisUser?.init();
			console.warn("huh2");
			const loading = document.getElementById("loading") as HTMLDivElement;
			loading.classList.add("doneloading");
			loading.classList.remove("loading");
			loaddesc.textContent = I18n.loaded();
			console.log("done loading");
			if (templateID) {
				thisUser?.passTemplateID(templateID);
			}
		});
	} catch (e) {
		debugger;
		console.error(e);
		loaddesc.textContent = I18n.accountNotStart();
		thisUser = null;
	}
	//TODO move this to the channel/guild class, this is a weird spot
	const menu = new Contextmenu<void, void>("create rightclick");
	menu.addButton(
		I18n.channel.createChannel(),
		() => {
			if (thisUser?.focusGuild) {
				thisUser?.focusGuild.createchannels();
			}
		},
		{
			visible: function () {
				return thisUser?.focusGuild?.member.hasPermission("MANAGE_CHANNELS") || false;
			},
		},
	);

	menu.addButton(
		I18n.channel.createCatagory(),
		() => {
			if (thisUser?.focusGuild) {
				thisUser?.focusGuild.createcategory();
			}
		},
		{
			visible: function () {
				return thisUser?.focusGuild?.member.hasPermission("MANAGE_CHANNELS") || false;
			},
		},
	);

	menu.bindContextmenu(document.getElementById("channels") as HTMLDivElement);

	window.addEventListener("popstate", (e) => {
		if (e.state instanceof Object) {
			thisUser?.goToState(e.state);
		}
		//console.log(e.state,"state:3")
	});

	{
		const searchBox = document.getElementById("searchBox") as CustomHTMLDivElement;
		const markdown = new MarkDown("", thisUser ?? undefined);
		searchBox.markdown = markdown;
		const searchX = document.getElementById("searchX") as HTMLElement;
		searchBox.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				thisUser?.mSearch(markdown.rawString);
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
				thisUser?.mSearch("");
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
	}

	await setTheme();

	function userSettings(): void {
		thisUser?.showusersettings();
	}

	(document.getElementById("settings") as HTMLImageElement).onclick = userSettings;
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
		thisUser?.pinnedClick(pinnedM.getBoundingClientRect());
		e.preventDefault();
		e.stopImmediatePropagation();
	};
	const umenu = new Contextmenu<void, void>("upload");
	umenu.addButton(
		I18n.makePoll(),
		() => {
			thisUser?.makePoll();
		},
		{
			//TODO re-enable this once polls is merged
			visible: () => !!thisUser?.focusChannel?.hasPermission("SEND_POLLS"),
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
		thisUser?.TBEmojiMenu(emojiTB.getBoundingClientRect());
	};

	const gifTB = document.getElementById("gifTB") as HTMLElement;
	gifTB.onmousedown = (e) => e.stopImmediatePropagation();
	gifTB.onclick = (e) => {
		e.preventDefault();
		e.stopImmediatePropagation();
		thisUser?.makeGifBox(gifTB.getBoundingClientRect());
	};

	const stickerTB = document.getElementById("stickerTB") as HTMLElement;
	stickerTB.onmousedown = (e) => e.stopImmediatePropagation();
	stickerTB.onclick = (e) => {
		e.preventDefault();
		e.stopImmediatePropagation();
		thisUser?.makeStickerBox(stickerTB.getBoundingClientRect());
	};
	const updateIcon = document.getElementById("updateIcon");
	if (updateIcon) {
		new Hover(() => updateIcon.textContent || "").addEvent(updateIcon);
		updateIcon.onclick = () => {
			window.location.reload();
		};
	}
}
