import {Contextmenu} from "./contextmenu.js";
import {MarkDown} from "./markdown.js";
type sides = "right" | "bottom";
class Hover {
	str: string | MarkDown | (() => Promise<MarkDown | string> | MarkDown | string);
	customHTML?: () => HTMLElement;
	weak: boolean;
	side: sides;
	constructor(
		txt: string | MarkDown | (() => Promise<MarkDown | string> | MarkDown | string),
		{customHTML, weak, side}: {customHTML?: () => HTMLElement; weak: boolean; side?: sides} = {
			weak: true,
		},
	) {
		this.customHTML = customHTML;
		this.weak = weak;
		this.str = txt;
		this.side = side || "bottom";
	}
	static map = new WeakMap<HTMLElement, () => void>();
	static elm: HTMLElement = document.createElement("div");
	static bound: HTMLElement = document.createElement("div");
	static timeout: NodeJS.Timeout;
	static watchForGone() {
		clearInterval(this.timeout);
		this.timeout = setInterval(() => {
			if (!document.contains(this.bound)) {
				this.elm.remove();
				clearInterval(this.timeout);
			}
		}, 100);
	}
	get elm2() {
		return Hover.elm;
	}
	set elm2(elm: HTMLElement) {
		Hover.elm = elm;
	}
	addEvent(elm: HTMLElement) {
		let timeOut = setTimeout(() => {}, 0);
		const RM = () => {
			this.elm2.remove();
		};

		elm.addEventListener("mouseover", () => {
			clearTimeout(timeOut);
			timeOut = setTimeout(async () => {
				RM();
				this.elm2 = await this.makeHover(elm);
				Hover.bound = elm;
				Hover.watchForGone();
			}, 100);
		});
		elm.addEventListener("mouseout", () => {
			clearTimeout(timeOut);
			RM();
		});
		new MutationObserver((e) => {
			if (e[0].removedNodes.length) {
				clearTimeout(timeOut);
				RM();
			}
		}).observe(elm, {childList: true});
		Hover.map.get(elm)?.();
		Hover.map.set(elm, () => {
			alert("happened");
			clearTimeout(timeOut);
			this.elm2.remove();
		});
	}
	prevDiv = new WeakRef(document.createElement("div"));
	async makeHover(elm: HTMLElement) {
		const prev = this.prevDiv.deref();
		if (prev) prev.remove();
		if (!document.contains(elm)) return document.createElement("div");
		const div = document.createElement("div");
		this.prevDiv = new WeakRef(div);

		if (this.customHTML) {
			div.append(this.customHTML());
		} else {
			if (this.str instanceof MarkDown) {
				div.append(this.str.makeHTML());
			} else if (this.str instanceof Function) {
				const hover = await this.str();
				if (hover instanceof MarkDown) {
					div.append(hover.makeHTML());
				} else {
					div.innerText = hover;
				}
			} else {
				div.innerText = this.str;
			}
		}
		document.body.append(div);
		div.classList.add("hoverthing");

		const box = elm.getBoundingClientRect();
		const box2 = div.getBoundingClientRect();
		if (this.side === "bottom") {
			div.style.top = box.bottom + 4 + "px";
			div.style.left = Math.floor((box.left + box.right - box2.width) / 2) + "px";
		} else if (this.side === "right") {
			div.style.left = box.right + 4 + "px";
			div.style.top = Math.floor(box.top + box.height / 4) + "px";
		}

		if (this.weak) {
			div.addEventListener("mouseover", () => {
				div.remove();
			});
		}

		Contextmenu.keepOnScreen(div);
		return div;
	}
}
export {Hover};
