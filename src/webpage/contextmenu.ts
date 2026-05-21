import {mobile, removeAni} from "./utils/utils.js";
type iconJson =
	| {
			src: string;
	  }
	| {
			css: string;
	  }
	| {
			html: HTMLElement;
	  };

interface menuPart<x, y> {
	group?: string;
	makeContextHTML(
		obj1: x,
		obj2: y,
		menu: HTMLDivElement,
		layered: contextCluster<unknown, unknown>[],
		processed: WeakSet<menuPart<unknown, unknown>>,
	): void;
}

class ContextButton<x, y> implements menuPart<x, y> {
	private text: string | ((this: x, arg: y) => string);
	private onClick: (this: x, arg: y, e: MouseEvent) => void;
	private icon?: iconJson;
	private visible?: (this: x, arg: y) => boolean;
	private enabled?: (this: x, arg: y) => boolean;
	//TODO there *will* be more colors
	private color?: "red" | "blue";
	group?: string;
	constructor(
		text: ContextButton<x, y>["text"],
		onClick: ContextButton<x, y>["onClick"],
		addProps: {
			icon?: iconJson;
			visible?: (this: x, arg: y) => boolean;
			enabled?: (this: x, arg: y) => boolean;
			color?: "red" | "blue";
			group?: string;
		} = {},
	) {
		this.text = text;
		this.onClick = onClick;
		this.icon = addProps.icon;
		this.visible = addProps.visible;
		this.enabled = addProps.enabled;
		this.color = addProps.color;
		this.group = addProps.group;
	}
	isVisible(obj1: x, obj2: y): boolean {
		if (!this.visible) return true;
		return this.visible.call(obj1, obj2);
	}
	makeContextHTML(obj1: x, obj2: y, menu: HTMLDivElement) {
		if (!this.isVisible(obj1, obj2)) {
			return;
		}

		const intext = document.createElement("button");
		intext.classList.add("contextbutton");
		intext.append(this.textContent(obj1, obj2));

		intext.disabled = !!this.enabled && !this.enabled.call(obj1, obj2);

		if (this.icon) {
			if ("src" in this.icon) {
				const icon = document.createElement("img");
				icon.classList.add("svgicon");
				icon.src = this.icon.src;
				intext.append(icon);
			} else if ("css" in this.icon) {
				const icon = document.createElement("span");
				icon.classList.add(this.icon.css, "svgicon");
				switch (this.color) {
					case "red":
						icon.style.background = "var(--red)";
						break;
					case "blue":
						icon.style.background = "var(--blue)";
						break;
				}
				intext.append(icon);
			} else {
				intext.append(this.icon.html);
			}
		}

		switch (this.color) {
			case "red":
				intext.style.color = "var(--red)";
				break;
			case "blue":
				intext.style.color = "var(--blue)";
				break;
		}

		intext.onclick = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			removeAni(menu);
			this.onClick.call(obj1, obj2, e);
		};

		menu.append(intext);
	}
	textContent(x: x, y: y) {
		if (this.text instanceof Function) {
			return this.text.call(x, y);
		}
		return this.text;
	}
}
class ContextGroup<x, y> implements menuPart<x, y> {
	private visible?: (this: x, arg: y) => boolean;
	groupSel: string;
	group = undefined;
	constructor(
		group: string,
		addProps: {
			visible?: (this: x, arg: y) => boolean;
		} = {},
	) {
		this.visible = addProps.visible;

		this.groupSel = group;
	}
	isVisible(obj1: x, obj2: y): boolean {
		if (!this.visible) return true;
		return this.visible.call(obj1, obj2);
	}
	makeContextHTML(
		x: x,
		y: y,
		menuHtml: HTMLDivElement,
		layered: contextCluster<unknown, unknown>[],
		processed: WeakSet<menuPart<unknown, unknown>>,
	) {
		if (!this.isVisible(x, y)) {
			return;
		}
		for (const [menu, x, y] of layered) {
			for (const part of menu.buttons) {
				if (part.group === this.groupSel && !processed.has(part)) {
					processed.add(part);
					part.makeContextHTML(x, y, menuHtml, [], processed);
				}
			}
		}
	}
}
class Seperator<x, y> implements menuPart<x, y> {
	private visible?: (obj1: x, obj2: y) => boolean;
	group?: string;
	constructor(visible?: (obj1: x, obj2: y) => boolean, group?: string) {
		this.visible = visible;
		this.group = group;
	}
	makeContextHTML(obj1: x, obj2: y, menu: HTMLDivElement): void {
		if (!this.visible || this.visible(obj1, obj2)) {
			if (
				!menu.children[menu.children.length - 1] ||
				menu.children[menu.children.length - 1].tagName === "HR"
			) {
				return;
			}
			menu.append(document.createElement("hr"));
		}
	}
}

class ContextMenuText<x, y> implements menuPart<x, y> {
	private visible?: (obj1: x, obj2: y) => boolean;
	group?: string;
	text: string;
	constructor(text: string, visible?: (obj1: x, obj2: y) => boolean, group?: string) {
		this.visible = visible;
		this.group = group;
		this.text = text;
	}
	makeContextHTML(obj1: x, obj2: y, menu: HTMLDivElement): void {
		if (!this.visible || this.visible(obj1, obj2)) {
			const span = document.createElement("span");
			span.textContent = this.text;
			menu.append(span);
		}
	}
}
class ContextMenuSlider<x, y> implements menuPart<x, y> {
	private visible?: (obj1: x, obj2: y) => boolean;
	group?: string;
	text: ContextButton<x, y>["text"];
	slider: (obj1: x, obj2: y, slide: number) => unknown;
	startVal?: (obj1: x, obj2: y) => number;
	constructor(
		text: ContextButton<x, y>["text"],
		slider: (obj1: x, obj2: y, slide: number) => unknown,
		visible?: (obj1: x, obj2: y) => boolean,
		group?: string,
		{startVal}: {startVal?: (obj1: x, obj2: y) => number} = {},
	) {
		this.visible = visible;
		this.group = group;
		this.text = text;
		this.slider = slider;
		this.startVal = startVal;
	}
	makeContextHTML(obj1: x, obj2: y, menu: HTMLDivElement): void {
		if (!this.visible || this.visible(obj1, obj2)) {
			const sliderDiv = document.createElement("div");
			sliderDiv.classList.add("flexttb");
			const span = document.createElement("span");
			span.textContent = typeof this.text == "string" ? this.text : this.text.call(obj1, obj2);
			sliderDiv.append(span);

			const slider = document.createElement("input");
			slider.type = "range";
			sliderDiv.append(slider);
			slider.value = this.startVal?.(obj1, obj2) + "" || "100";
			slider.oninput = () => {
				this.slider(obj1, obj2, +slider.value);
			};
			menu.append(sliderDiv);
		}
	}
}

declare global {
	interface HTMLElementEventMap {
		layered: LayeredEvent;
	}
}
type contextCluster<X, Y> = [Contextmenu<X, Y>, X, Y];
class LayeredEvent extends CustomEvent<unknown> {
	menus: contextCluster<unknown, unknown>[];
	primary?: contextCluster<unknown, unknown>;
	side: "top" | "bottom";
	constructor(mouse: MouseEvent, menus: LayeredEvent["menus"], side: "top" | "bottom") {
		super("layered", {bubbles: true});
		this.side = side;
		this.menus = menus;
		queueMicrotask(() => {
			console.log(this);
			const pop = this.primary || menus.pop();
			if (!pop) return;
			const [menu, addinfo, other] = pop;
			menu.makemenu(mouse.clientX, mouse.clientY, addinfo, other, undefined, menus, this.side);
		});
	}
}

class Contextmenu<x, y> {
	static currentmenu: HTMLElement | "" = "";
	static prevmenus: HTMLElement[] = [];
	name: string;
	buttons: menuPart<x, y>[];
	div!: HTMLDivElement;
	static declareMenu(html: HTMLElement | false = false, keep: false | true | HTMLElement = false) {
		if (Contextmenu.currentmenu !== "") {
			if (keep === false) {
				removeAni(Contextmenu.currentmenu);
			} else if (keep === true) {
				this.prevmenus.push(Contextmenu.currentmenu);
			} else {
				while (Contextmenu.currentmenu && Contextmenu.currentmenu !== keep) {
					removeAni(Contextmenu.currentmenu);
					Contextmenu.currentmenu = this.prevmenus.pop() || "";
				}
				if (Contextmenu.currentmenu) {
					this.prevmenus.push(Contextmenu.currentmenu);
				}
			}
		}
		if (html) {
			Contextmenu.currentmenu = html;
		} else {
			Contextmenu.currentmenu = this.prevmenus.pop() || "";
		}
	}
	static setup() {
		Contextmenu.declareMenu();
		document.addEventListener("click", (event) => {
			while (Contextmenu.currentmenu && !Contextmenu.currentmenu.contains(event.target as Node)) {
				Contextmenu.declareMenu();
			}
		});
	}
	private layered = false;
	constructor(name: string, layered = false) {
		this.name = name;
		this.layered = layered;
		this.buttons = [];
	}

	addButton(
		text: ContextButton<x, y>["text"],
		onClick: ContextButton<x, y>["onClick"],
		addProps: {
			icon?: iconJson;
			visible?: (this: x, arg: y) => boolean;
			enabled?: (this: x, arg: y) => boolean;
			color?: "red" | "blue";
			group?: string;
		} = {},
	) {
		const button = new ContextButton(text, onClick, addProps);
		this.buttons.push(button);
		return button;
	}
	excluded = [] as string[];
	excludeGroup(group: string) {
		this.excluded.push(group);
	}
	addSeperator(visible?: (obj1: x, obj2: y) => boolean, group?: string) {
		this.buttons.push(new Seperator(visible, group));
	}
	addText(text: string, visible?: (obj1: x, obj2: y) => boolean, group?: string) {
		this.buttons.push(new ContextMenuText(text, visible, group));
	}
	addSlider(
		text: ContextButton<x, y>["text"],
		slider: (obj1: x, obj2: y, val: number) => unknown,
		visible?: (obj1: x, obj2: y) => boolean,
		group?: string,
		opts: {startVal?: (obj1: x, obj2: y) => number} = {},
	) {
		this.buttons.push(new ContextMenuSlider(text, slider, visible, group, opts));
	}
	addGroup(
		group: string,
		addprops?: {
			visible?: (this: x, arg: y) => boolean;
		},
	) {
		this.buttons.push(new ContextGroup<x, y>(group, addprops));
	}
	makemenu(
		x: number,
		y: number,
		addinfo: x,
		other: y,
		keep: boolean | HTMLElement = false,
		layered: LayeredEvent["menus"] = [],
		side: "top" | "bottom" = "top",
	) {
		if (side === "bottom") {
			y = y - window.innerHeight;
		}
		const div = document.createElement("div");
		div.classList.add("contextmenu", "flexttb");
		const processed = new WeakSet<menuPart<unknown, unknown>>();

		const excluded = new Set(layered.flatMap((_) => _[0].excluded));

		for (const button of this.buttons) {
			if (excluded.has(button.group || "")) continue;
			button.makeContextHTML(addinfo, other, div, layered, processed);
		}
		if (div.children[div.children.length - 1]?.tagName !== "HR") {
			div.append(document.createElement("hr"));
		}
		new ContextGroup<x, y>("default").makeContextHTML(addinfo, other, div, layered, processed);

		while (div.children[div.children.length - 1]?.tagName === "HR") {
			div.children[div.children.length - 1].remove();
		}
		if (div.childNodes.length === 0) return;

		Contextmenu.declareMenu(div, keep);

		if (y > 0) {
			div.style.top = y + "px";
		} else {
			div.style.bottom = y * -1 + "px";
		}
		if (x > 0) {
			div.style.left = x + "px";
		} else {
			div.style.right = x * -1 + "px";
		}

		document.body.appendChild(div);
		Contextmenu.keepOnScreen(div);

		return this.div;
	}
	bindContextmenu(
		obj: HTMLElement,
		addinfo: x,
		other: y,
		touchDrag: (x: number, y: number) => unknown = () => {},
		touchEnd: (x: number, y: number) => unknown = () => {},
		click: "right" | "left" = "right",
		side: "top" | "bottom" = "top",
	) {
		const func = (event: MouseEvent) => {
			const selectedText = window.getSelection();
			if (selectedText) {
				//Don't override context menus for highlighted text
				for (let ranges = 0; ranges < selectedText.rangeCount; ranges++) {
					const range = selectedText.getRangeAt(ranges);
					const rect = range.getBoundingClientRect();
					if (
						rect.left < event.clientX &&
						rect.right > event.clientX &&
						rect.top < event.clientY &&
						rect.bottom > event.clientY
					) {
						return;
					}
				}
			}
			event.stopImmediatePropagation();
			event.preventDefault();
			const layered = new LayeredEvent(event, [], side);
			obj.dispatchEvent(layered);
		};
		obj.addEventListener("layered", (layered) => {
			if (this.layered) {
				layered.menus.push([this as Contextmenu<unknown, unknown>, addinfo, other]);
			} else if (!layered.primary) {
				layered.primary = [this as Contextmenu<unknown, unknown>, addinfo, other];
			}
			return;
		});
		if (click === "right") {
			obj.addEventListener("contextmenu", func);
		} else {
			obj.addEventListener("click", func);
		}
		//NOTE not sure if this code is correct, seems fine at least for now
		if (mobile) {
			let hold: NodeJS.Timeout | undefined;
			let x!: number;
			let y!: number;
			obj.addEventListener(
				"touchstart",
				(event: TouchEvent) => {
					x = event.touches[0].pageX;
					y = event.touches[0].pageY;
					if (event.touches.length > 1) {
						event.preventDefault();
						event.stopImmediatePropagation();
						this.makemenu(event.touches[0].clientX, event.touches[0].clientY, addinfo, other);
					} else {
						//
						event.stopImmediatePropagation();
						hold = setTimeout(() => {
							if (lastx ** 2 + lasty ** 2 > 10 ** 2) return;
							this.makemenu(event.touches[0].clientX, event.touches[0].clientY, addinfo, other);
							console.log(obj);
						}, 500);
					}
				},
				{passive: false},
			);
			let lastx = 0;
			let lasty = 0;
			obj.addEventListener("touchend", () => {
				if (hold) {
					clearTimeout(hold);
				}
				touchEnd(lastx, lasty);
			});
			obj.addEventListener("touchmove", (event) => {
				lastx = event.touches[0].pageX - x;
				lasty = event.touches[0].pageY - y;
				touchDrag(lastx, lasty);
			});
		}
		return func;
	}
	static keepOnScreen(obj: HTMLElement) {
		const html = document.documentElement.getBoundingClientRect();
		const docheight = window.innerHeight;
		const docwidth = html.width;
		const box = obj.getBoundingClientRect();
		if (box.right > docwidth) {
			obj.style.left = Math.floor(docwidth - box.width) + "px";
		}
		if (box.bottom > docheight) {
			obj.style.top = Math.floor(docheight - box.height) + "px";
		}
	}
}
Contextmenu.setup();
export {Contextmenu};
