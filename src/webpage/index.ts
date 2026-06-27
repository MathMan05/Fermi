import {Localuser} from "./localuser.js";
import {Contextmenu} from "./contextmenu.js";
import {mobile, Specialuser} from "./utils/utils.js";
import {setTheme} from "./utils/utils.js";
import {MarkDown} from "./markdown.js";
import {Message} from "./message.js";
import {File} from "./file.js";
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
import {Channel} from "./channel.js";
import type * as C from "./typeChecker/chekerIndex.js";

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
	function regSwap(l: Localuser) {
		l.onswap = (l) => {
			thisUser = l;
			regSwap(l);
		};
		l.fileExtange = (img, html) => {
			const blobArr: Blob[] = [];
			const htmlArr = imagesHtml;
			let i = 0;
			for (const file of images) {
				const img = imagesHtml.get(file);
				if (!img) continue;
				if (pasteImageElement.contains(img)) {
					pasteImageElement.removeChild(img);
					blobArr.push(images[i]);
				} else {
					i++;
				}
			}
			images = img;
			imagesHtml = html;
			for (const file of images) {
				const img = imagesHtml.get(file);
				if (!img) throw new Error("Image without HTML, exiting");
				pasteImageElement.append(img);
			}
			return [blobArr, htmlArr];
		};
	}
	const loaddesc = document.getElementById("load-desc") as HTMLSpanElement;
	try {
		const current = sessionStorage.getItem("currentuser") || Localuser.users.currentuser;
		if (!Localuser.users.users[current]) {
			thisUser = new Localuser(await new Promise<Specialuser>((res) => makeLogin(true, "", res)));
		} else {
			thisUser = new Localuser(Localuser.users.users[current]);
		}

		regSwap(thisUser);
		thisUser.initwebsocket().then(async () => {
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
	const channelw = document.getElementById("channelw");
	if (channelw)
		channelw.addEventListener("keypress", (e) => {
			if (e.ctrlKey || e.altKey || e.metaKey || e.metaKey) return;
			let owner = e.target as HTMLElement;
			while (owner !== channelw) {
				if (owner.tagName === "input" || owner.contentEditable !== "false") {
					return;
				}
				owner = owner.parentElement as HTMLElement;
			}
			typebox.markdown.boxupdate(Infinity);
		});
	menu.bindContextmenu(document.getElementById("channels") as HTMLDivElement);

	const pasteImageElement = document.getElementById("pasteimage") as HTMLDivElement;
	let replyingTo: Message | null = null;
	window.addEventListener("popstate", (e) => {
		if (e.state instanceof Object) {
			thisUser?.goToState(e.state);
		}
		//console.log(e.state,"state:3")
	});
	let nonceMap = new Map<string, string>();
	//@ts-expect-error unused right now, not needed
	function getNonce(id: string) {
		const nonce = nonceMap.get(id) || Math.floor(Math.random() * 1000000000) + "";
		nonceMap.set(id, nonce);
		return nonce;
	}
	const markdown = new MarkDown("", thisUser ?? undefined);
	async function sendMessage(channel: Channel, content: string) {
		if (!channel.canMessageRightNow()) return;
		if (channel.curCommand) {
			channel.submitCommand();
			return;
		}
		markdown.onUpdate("", false);

		replyingTo = thisUser?.focusChannel ? thisUser.focusChannel.replyingto : null;
		if (replyingTo?.div) {
			replyingTo.div.classList.remove("replying");
		}
		if (thisUser?.focusChannel) {
			thisUser.focusChannel.replyingto = null;
			thisUser.focusChannel.makereplybox();
		}
		const attachments = images.filter((_) => document.contains(imagesHtml.get(_) || null));
		while (images.length) {
			const elm = imagesHtml.get(images.pop() as Blob) as HTMLElement;
			if (pasteImageElement.contains(elm)) pasteImageElement.removeChild(elm);
		}
		typebox.innerHTML = "";
		typebox.markdown.txt = [];
		try {
			await new Promise<void>((mres, rej) =>
				channel.sendMessage(
					content,
					{
						attachments,
						embeds: [], // Add an empty array for the embeds property
						replyingto: replyingTo,
						sticker_ids: [],
						//nonce: getNonce(channel.id),
					},
					(res) => {
						if (res === "Ok") {
							mres();
						} else {
							rej();
						}
					},
				),
			);
		} catch {
			images = attachments;
			for (const file of images) {
				const img = imagesHtml.get(file);
				if (!img) continue;
				pasteImageElement.append(img);
			}
			channel.replyingto = replyingTo;
			channel.makereplybox();
			typebox.textContent = content;
			typebox.markdown.txt = content.split("");
			typebox.markdown.boxupdate(Infinity);
		}
		nonceMap.delete(channel.id);
	}
	const mobileSend = document.getElementById("mobileSend");
	if (mobileSend) {
		mobileSend.onclick = () => {
			const channel = thisUser?.focusChannel;
			if (!channel) return;
			const content = MarkDown.gatherBoxText(typebox);
			sendMessage(channel, content);
		};
	}
	async function handleEnter(event: KeyboardEvent): Promise<void> {
		if (event.isComposing) return;
		if (event.key === "Escape" && (images.length || thisUser?.focusChannel?.replyingto)) {
			while (images.length) {
				const elm = imagesHtml.get(images.pop() as Blob) as HTMLElement;
				if (pasteImageElement.contains(elm)) pasteImageElement.removeChild(elm);
			}
			if (thisUser?.focusChannel) {
				thisUser.focusChannel?.replyingto?.div?.classList.remove("replying");
				thisUser.focusChannel.replyingto = null;
				thisUser.focusChannel.makereplybox();
			}
			return;
		}
		if (thisUser?.handleKeyUp(event)) {
			return;
		}

		const channel = thisUser?.focusChannel;
		if (!channel) return;
		const content = MarkDown.gatherBoxText(typebox);
		if (content === "" && event.key === "ArrowUp") {
			channel.editLast();
			return;
		}
		channel.typingstart();

		if (event.key === "Enter" && !event.shiftKey && window.innerWidth > 600) {
			event.preventDefault();
			await sendMessage(channel, content);
		}
	}

	const typebox = document.getElementById("typebox") as CustomHTMLDivElement;

	typebox.markdown = markdown;
	typebox.addEventListener("keyup", handleEnter);
	typebox.addEventListener("keydown", (event) => {
		if (event.isComposing) return;
		thisUser?.keydown(event);
		if (event.key === "Enter" && !event.shiftKey && window.innerWidth > 600) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	});
	markdown.giveBox(typebox);
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
	let images: Blob[] = [];
	let imagesHtml = new WeakMap<Blob, HTMLElement>();

	document.addEventListener("paste", async (e: ClipboardEvent) => {
		if (!thisUser?.focusChannel) return;
		if (!e.clipboardData) return;

		for (const file of Array.from(e.clipboardData.files)) {
			const fileInstance = File.initFromBlob(file);
			e.preventDefault();
			const html = fileInstance.upHTML(images, imagesHtml, file);
			pasteImageElement.appendChild(html);
			images.push(file);
			imagesHtml.set(file, html);
		}
	});

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
	let dragendtimeout = setTimeout(() => {});
	document.addEventListener("dragover", (e) => {
		clearTimeout(dragendtimeout);
		const data = e.dataTransfer;
		const bg = document.getElementById("gimmefile") as HTMLDivElement;

		if (data) {
			const isfile = data.types.includes("Files") || data.types.includes("application/x-moz-file");
			if (!isfile) {
				bg.hidden = true;
				return;
			}
			e.preventDefault();
			bg.hidden = false;
			//console.log(data.types,data)
		} else {
			bg.hidden = true;
		}
	});
	document.addEventListener("dragleave", (_) => {
		dragendtimeout = setTimeout(() => {
			const bg = document.getElementById("gimmefile") as HTMLDivElement;
			bg.hidden = true;
		}, 1000);
	});
	document.addEventListener("dragenter", (e) => {
		e.preventDefault();
	});
	document.addEventListener("drop", (e) => {
		const data = e.dataTransfer;
		const bg = document.getElementById("gimmefile") as HTMLDivElement;
		bg.hidden = true;
		if (!thisUser?.focusChannel) {
			e.preventDefault();
			return;
		}
		if (data) {
			const isfile = data.types.includes("Files") || data.types.includes("application/x-moz-file");
			if (isfile) {
				e.preventDefault();
				console.log(data.files);
				for (const file of Array.from(data.files)) {
					const fileInstance = File.initFromBlob(file);
					const html = fileInstance.upHTML(images, imagesHtml, file);
					pasteImageElement.appendChild(html);
					images.push(file);
					imagesHtml.set(file, html);
				}
			}
		}
	});
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
			visible: () => false, //!!thisUser.channelfocus?.hasPermission("SEND_POLLS"),
		},
	);
	umenu.addButton(I18n.upload(), () => {
		const input = document.createElement("input");
		input.type = "file";
		input.click();
		input.multiple = true;
		console.log("clicked");
		if (!thisUser?.focusChannel) return;
		input.onchange = () => {
			if (input.files) {
				for (const file of Array.from(input.files)) {
					const fileInstance = File.initFromBlob(file);
					const html = fileInstance.upHTML(images, imagesHtml, file);
					pasteImageElement.appendChild(html);
					images.push(file);
					imagesHtml.set(file, html);
				}
			}
		};
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
