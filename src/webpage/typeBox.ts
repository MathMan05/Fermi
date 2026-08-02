import {Channel} from "./channel";
import {Localuser} from "./localuser";
import {MarkDown, saveCaretPosition} from "./markdown";
import {File} from "./file";
import {I18n} from "./i18n";
import {mobile} from "./utils/utils";
class BoxState {
	text: string;
	files: globalThis.File[];
	constructor(text: string, files: globalThis.File[]) {
		this.text = text;
		this.files = files;
	}
}
export class TypeBox {
	static box = document.getElementById("typebox") as HTMLDivElement;
	private static localuser?: Localuser;
	static markdown = new MarkDown("");
	private static files: globalThis.File[] = [];
	private static imagesHtml = new WeakMap<Blob, HTMLElement>();
	private static pasteImageElement = document.getElementById("pasteimage") as HTMLDivElement;
	private static nonceMap = new Map<string, string>();
	static getNonce(id: string) {
		const nonce = this.nonceMap.get(id) || Math.floor(Math.random() * 1000000000) + "";
		this.nonceMap.set(id, nonce);
		return nonce;
	}
	static focus() {
		this.box.focus();
	}
	static init() {
		this.box.addEventListener("keyup", this.handleEnter.bind(this));
		this.box.addEventListener("keydown", (event) => {
			if (event.isComposing) return;
			this.localuser?.keydown(event);
			if (event.key === "Enter" && !event.shiftKey && window.innerWidth > 600) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		});
		this.markdown.giveBox(this.box);
		const mobileSend = document.getElementById("mobileSend");
		if (mobileSend) {
			mobileSend.onclick = () => {
				const channel = this.localuser?.focusChannel;
				if (!channel) return;
				const content = MarkDown.gatherBoxText(this.box);
				this.sendMessage(channel, content);
			};
		}
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
				this.markdown.boxupdate(Infinity);
			});
		document.addEventListener("paste", async (e: ClipboardEvent) => {
			if (!this.localuser?.focusChannel) return;
			if (!e.clipboardData) return;

			for (const file of Array.from(e.clipboardData.files)) {
				e.preventDefault();
				this.addFile(file);
			}
			this.localuser?.updateSend();
		});
		let dragendtimeout = setTimeout(() => {});
		document.addEventListener("dragover", (e) => {
			clearTimeout(dragendtimeout);
			const data = e.dataTransfer;
			const bg = document.getElementById("gimmefile") as HTMLDivElement;

			if (data) {
				const isfile =
					data.types.includes("Files") || data.types.includes("application/x-moz-file");
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
			if (!this.localuser?.focusChannel) {
				e.preventDefault();
				return;
			}
			if (data) {
				const isfile =
					data.types.includes("Files") || data.types.includes("application/x-moz-file");
				if (isfile) {
					e.preventDefault();
					console.log(data.files);
					for (const file of Array.from(data.files)) {
						this.addFile(file);
					}
					this.localuser?.updateSend();
				}
			}
		});
	}
	private static cMap = new Map<string, BoxState>();
	private static channelToID(c: Channel) {
		return c.id;
	}
	static saveBox() {
		if (!this.localuser?.focusChannel) return;
		const state = new BoxState(MarkDown.gatherBoxText(this.box), this.files);
		this.pasteImageElement.textContent = "";
		this.box.textContent = "";
		this.files = [];
		this.markdown.txt = [];
		this.cMap.set(this.channelToID(this.localuser.focusChannel), state);
	}
	static restoreBox(c = this.localuser?.focusChannel) {
		if (!c) return;
		const state = this.cMap.get(this.channelToID(c));
		this.box.textContent = "";
		this.pasteImageElement.textContent = "";
		if (state) {
			this.markdown.txt = [...state.text];
			this.files = state.files;
		} else {
			this.markdown.txt = [];
			this.files = [];
		}
		this.box.append(this.markdown.makeHTML({keep: true}));
		this.markdown.owner = c;
		this.markdown.boxupdate(Infinity);
		for (const file of this.files) {
			this.addFile(file, false);
		}
	}
	static changeWrite() {
		if (!this.localuser?.focusChannel) return;
		const c = this.localuser.focusChannel;
		const canMessage = c.canMessage;
		try {
			this.box.contentEditable = canMessage ? "plaintext-only" : "false";
		} catch {
			this.box.contentEditable = canMessage ? "true" : "false";
		}
		(document.getElementById("upload") as HTMLElement).style.visibility = canMessage
			? "visible"
			: "hidden";
		(document.getElementById("gifTB") as HTMLElement).style.display = canMessage ? "block" : "none";
		(document.getElementById("stickerTB") as HTMLElement).style.display = canMessage
			? "block"
			: "none";
		(document.getElementById("emojiTB") as HTMLElement).style.display = canMessage
			? "block"
			: "none";
		(document.getElementById("mobileSend") as HTMLElement).style.display = canMessage
			? "block"
			: "none";
		(document.getElementById("typediv") as HTMLElement).style.visibility = "visible";
		if (!mobile) {
			this.box.focus();
		} else {
			this.box.blur();
		}
	}
	static saveCarrot() {
		return saveCaretPosition(this.box);
	}
	static updateSend() {
		if (
			(this.markdown.rawString && this.markdown.rawString !== "\n") ||
			document.getElementById("pasteimage")?.children.length
		) {
			this.box.parentElement!.classList.remove("noConent");
		} else {
			this.box.parentElement!.classList.add("noConent");
		}
	}
	static changeVisablity(visable: boolean) {
		if (visable) {
		} else {
			this.box.contentEditable = "" + false;
			const replybox = document.getElementById("replybox") as HTMLElement;
			replybox.classList.add("hideReplyBox");
			this.box.classList.remove("typeboxreplying");
			(document.getElementById("upload") as HTMLElement).style.visibility = "hidden";
			(document.getElementById("typediv") as HTMLElement).style.visibility = "hidden";
			(document.getElementById("sideDiv") as HTMLElement).innerHTML = "";
		}
	}
	static addFile(blob: globalThis.File, add = true) {
		const file = File.initFromBlob(blob);
		const html = file.upHTML(this.files, this.imagesHtml, blob, () => {
			this.localuser?.updateSend();
		});
		this.pasteImageElement.appendChild(html);
		if (add) this.files.push(blob);
		this.imagesHtml.set(blob, html);
	}
	static updateReplying() {
		const c = this.localuser?.focusChannel;
		const replybox = document.getElementById("replybox") as HTMLElement;
		if (c && c.replyingto) {
			this.box.classList.add("typeboxreplying");
			replybox.innerHTML = "";
			const span = document.createElement("span");
			span.textContent = I18n.replyingTo(c.replyingto.author.username);
			const X = document.createElement("button");
			X.onclick = (_) => {
				if (c.replyingto?.div) {
					c.replyingto.div.classList.remove("replying");
				}
				replybox.classList.add("hideReplyBox");
				c.replyingto = null;
				replybox.innerHTML = "";
				TypeBox.updateReplying();
			};
			replybox.classList.remove("hideReplyBox");
			X.classList.add("cancelReply", "svgicon", "svg-x");
			replybox.append(span);
			replybox.append(X);
		} else {
			replybox.classList.add("hideReplyBox");
			replybox.innerHTML = "";
			this.box.classList.remove("typeboxreplying");
		}
	}
	static uploadFiles() {
		const input = document.createElement("input");
		input.type = "file";
		input.click();
		input.multiple = true;
		console.log("clicked");
		if (!this.localuser?.focusChannel) return;
		input.onchange = () => {
			if (input.files) {
				for (const file of Array.from(input.files)) {
					this.addFile(file);
				}
				this.localuser?.updateSend();
			}
		};
	}
	static regSwap(l: Localuser) {
		l.onswap = (l) => {
			this.localuser = l;
			this.regSwap(l);
		};
		this.localuser = l;
	}
	private static async handleEnter(event: KeyboardEvent): Promise<void> {
		if (event.isComposing) return;
		if (event.key === "Escape" && (this.files.length || this.localuser?.focusChannel?.replyingto)) {
			while (this.files.length) {
				const elm = this.imagesHtml.get(this.files.pop() as Blob) as HTMLElement;
				if (this.pasteImageElement.contains(elm)) this.pasteImageElement.removeChild(elm);
			}
			if (this.localuser?.focusChannel) {
				this.localuser.focusChannel?.replyingto?.div?.classList.remove("replying");
				this.localuser.focusChannel.replyingto = null;
				this.localuser.focusChannel.makereplybox();
			}
			this.localuser?.updateSend();
			return;
		}
		if (this.localuser?.handleKeyUp(event)) {
			return;
		}

		const channel = this.localuser?.focusChannel;
		if (!channel) return;
		const content = MarkDown.gatherBoxText(this.box);
		if (content === "" && event.key === "ArrowUp") {
			channel.editLast();
			return;
		}
		channel.typingstart();

		if (event.key === "Enter" && !event.shiftKey && window.innerWidth > 600) {
			event.preventDefault();
			await this.sendMessage(channel, content);
		}
	}
	private static async sendMessage(channel: Channel, content: string) {
		if (!channel.canMessageRightNow()) return;
		if (channel.curCommand) {
			channel.submitCommand();
			return;
		}
		this.markdown.onUpdate("", false);

		let replyingTo = this.localuser?.focusChannel ? this.localuser.focusChannel.replyingto : null;
		if (replyingTo?.div) {
			replyingTo.div.classList.remove("replying");
		}
		if (this.localuser?.focusChannel) {
			this.localuser.focusChannel.replyingto = null;
			this.localuser.focusChannel.makereplybox();
		}
		const attachments = this.files.filter((_) => document.contains(this.imagesHtml.get(_) || null));
		while (this.files.length) {
			const elm = this.imagesHtml.get(this.files.pop() as Blob) as HTMLElement;
			if (this.pasteImageElement.contains(elm)) this.pasteImageElement.removeChild(elm);
		}
		this.box.innerHTML = "";
		this.markdown.txt = [];
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
			this.files = attachments;
			for (const file of this.files) {
				const img = this.imagesHtml.get(file);
				if (!img) continue;
				this.pasteImageElement.append(img);
			}
			channel.replyingto = replyingTo;
			channel.makereplybox();
			this.box.textContent = content;
			this.markdown.txt = content.split("");
			this.markdown.boxupdate(Infinity);
		}
		this.nonceMap.delete(channel.id);
	}
}
TypeBox.init();
