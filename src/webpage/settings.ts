import {
	checkInstance,
	getInstances,
	getStringURLMapPair,
	instancefetch,
	InstanceInfo,
	removeAni,
} from "./utils/utils.js";
import {Emoji} from "./emoji.js";
import {I18n} from "./i18n.js";
import {Localuser} from "./localuser.js";
import {MarkDown} from "./markdown.js";

interface OptionsElement<x> {
	//
	generateHTML(): HTMLElement;
	submit: () => void;
	readonly watchForChange: (func: (arg1: x) => void) => void;
	value: x;
}
//future me stuff
export class Buttons implements OptionsElement<unknown> {
	readonly name: string;
	readonly buttons: [string, Options | string][];
	readonly buttonMap = new Map<Options | string, HTMLElement>();
	buttonList!: HTMLDivElement;
	warndiv!: HTMLElement;
	value: unknown;
	top = false;
	titles = true;
	constructor(name: string, {top = false, titles = true} = {}) {
		this.top = top;
		this.buttons = [];
		this.name = name;
		this.titles = titles;
	}
	add(name: string, thing?: Options | undefined) {
		if (!thing) {
			thing = new Options(this.titles ? name : "", this);
		}
		const button = [name, thing] as [string, string | Options];
		this.buttons.push(button);
		const htmlarea = this.htmlarea.deref();
		const buttonTable = this.buttonTable.deref();
		if (buttonTable && htmlarea) buttonTable.append(this.makeButtonHTML(button, htmlarea));
		return thing;
	}
	htmlarea = new WeakRef(document.createElement("div"));
	buttonTable = new WeakRef(document.createElement("div"));
	generateHTML() {
		const buttonList = document.createElement("div");
		buttonList.classList.add("Buttons");
		buttonList.classList.add(this.top ? "flexttb" : "flexltr");
		this.buttonList = buttonList;
		const htmlarea = document.createElement("div");
		htmlarea.classList.add("flexgrow", "settingsHTMLArea");
		const buttonTable = this.generateButtons(htmlarea);
		if (this.buttons[0]) {
			this.generateHTMLArea(this.buttons[0][1], htmlarea);
			htmlarea.classList.add("mobileHidden");
		}
		buttonList.append(buttonTable);
		buttonList.append(htmlarea);
		this.htmlarea = new WeakRef(htmlarea);
		this.buttonTable = new WeakRef(buttonTable);
		return buttonList;
	}
	makeButtonHTML(buttond: [string, string | Options], optionsArea: HTMLElement) {
		const button = document.createElement("button");
		this.buttonMap.set(buttond[1], button);
		button.classList.add("SettingsButton");
		button.textContent = buttond[0];
		button.onclick = (_) => {
			this.generateHTMLArea(buttond[1], optionsArea);
			optionsArea.classList.remove("mobileHidden");
			if (this.warndiv) {
				this.warndiv.remove();
			}
		};
		return button;
	}
	generateButtons(optionsArea: HTMLElement) {
		const buttonTable = document.createElement("div");
		buttonTable.classList.add("settingbuttons");
		if (this.top) {
			buttonTable.classList.add("flexltr");
		}
		for (const thing of this.buttons) {
			buttonTable.append(this.makeButtonHTML(thing, optionsArea));
		}
		return buttonTable;
	}
	handleString(str: string): HTMLElement {
		const div = document.createElement("span");
		div.textContent = str;
		return div;
	}
	last?: Options | string;
	generateHTMLArea(buttonInfo: Options | string, htmlarea: HTMLElement) {
		if (this.last) {
			const elm = this.buttonMap.get(this.last);
			if (elm) {
				elm.classList.remove("activeSetting");
			}
		}
		this.last = buttonInfo;
		const elm = this.buttonMap.get(buttonInfo);
		if (elm) {
			elm.classList.add("activeSetting");
		}
		let html: HTMLElement;
		if (buttonInfo instanceof Options) {
			buttonInfo.subOptions = undefined;
			html = buttonInfo.generateHTML();
		} else {
			html = this.handleString(buttonInfo);
		}

		htmlarea.innerHTML = "";
		htmlarea.append(html);

		return html;
	}
	changed(html: HTMLElement) {
		this.warndiv = html;
		this.buttonList.append(html);
	}
	watchForChange() {}
	save() {}
	submit() {}
}

class TextInput implements OptionsElement<string> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: string) => void;
	value: string;
	input!: WeakRef<HTMLInputElement>;
	password: boolean;
	constructor(
		label: string,
		onSubmit: (str: string) => void,
		owner: Options,
		{initText = "", password = false} = {},
	) {
		this.label = label;
		this.value = initText;
		this.owner = owner;
		this.onSubmit = onSubmit;
		this.password = password;
	}
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const input = document.createElement("input");
		input.value = this.value;
		input.type = this.password ? "password" : "text";
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		div.append(input);
		return div;
	}
	onChange() {
		this.owner.changed();
		const input = this.input.deref();
		if (input) {
			const value = input.value as string;
			this.onchange(value);
			this.value = value;
		}
	}
	onchange: (str: string) => void = (_) => {};
	watchForChange(func: (str: string) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.value);
	}
}
class DateInput extends TextInput {
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const input = document.createElement("input");
		input.value = this.value;
		input.type = "date";
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		div.append(input);
		return div;
	}
}
class SettingsMDText implements OptionsElement<void> {
	readonly onSubmit!: (str: string) => void;
	value!: void;
	text: MarkDown;
	elm!: WeakRef<HTMLSpanElement>;
	constructor(text: MarkDown) {
		this.text = text;
	}
	generateHTML(): HTMLSpanElement {
		const span = document.createElement("span");
		this.elm = new WeakRef(span);
		this.setText(this.text);
		return span;
	}
	setText(text: MarkDown) {
		this.text = text;
		if (this.elm) {
			const span = this.elm.deref();
			if (span) {
				span.innerHTML = "";

				span.append(text.makeHTML());
			}
		}
	}
	watchForChange() {}
	submit() {}
}

class SettingsText implements OptionsElement<void> {
	readonly onSubmit!: (str: string) => void;
	value!: void;
	readonly text: string;
	elm!: WeakRef<HTMLSpanElement>;
	constructor(text: string) {
		this.text = text;
	}
	generateHTML(): HTMLSpanElement {
		const span = document.createElement("span");
		span.innerText = this.text;
		this.elm = new WeakRef(span);
		return span;
	}
	setText(text: string) {
		if (this.elm) {
			const span = this.elm.deref();
			if (span) {
				span.innerText = text;
			}
		}
	}
	watchForChange() {}
	submit() {}
}
class SettingsTitle implements OptionsElement<void> {
	readonly onSubmit!: (str: string) => void;
	value!: void;
	readonly text: string;
	constructor(text: string) {
		this.text = text;
	}
	generateHTML(): HTMLSpanElement {
		const span = document.createElement("h2");
		span.innerText = this.text;
		return span;
	}
	watchForChange() {}
	submit() {}
}
class CheckboxInput implements OptionsElement<boolean> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: boolean) => void;
	value: boolean;
	input!: WeakRef<HTMLInputElement>;
	constructor(
		label: string,
		onSubmit: (str: boolean) => void,
		owner: Options,
		{initState = false} = {},
	) {
		this.label = label;
		this.value = initState;
		this.owner = owner;
		this.onSubmit = onSubmit;
	}
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = this.value;
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		div.append(input);
		return div;
	}
	private onChange() {
		this.owner.changed();
		const input = this.input.deref();
		if (input) {
			const value = input.checked as boolean;
			this.value = value;
			this.onchange(value);
		}
	}
	setState(state: boolean) {
		if (this.input) {
			const checkbox = this.input.deref();
			if (checkbox) {
				checkbox.checked = state;
				this.value = state;
			}
		}
	}
	onchange: (str: boolean) => void = (_) => {};
	watchForChange(func: (str: boolean) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.value);
	}
}

class ButtonInput implements OptionsElement<void> {
	readonly label: string;
	readonly owner: Options;
	readonly onClick: () => void;
	textContent: string;
	value!: void;
	constructor(label: string, textContent: string, onClick: () => void, owner: Options, {} = {}) {
		this.label = label;
		this.owner = owner;
		this.onClick = onClick;
		this.textContent = textContent;
	}
	buttonHtml?: HTMLButtonElement;
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		if (this.label) {
			const span = document.createElement("span");
			span.classList.add("inlinelabel");
			span.textContent = this.label;
			div.append(span);
		}
		const button = document.createElement("button");
		button.textContent = this.textContent;
		button.onclick = this.onClickEvent.bind(this);
		this.buttonHtml = button;
		div.append(button);
		return div;
	}
	private onClickEvent() {
		this.onClick();
	}
	watchForChange() {}
	submit() {}
}

export class ColorInput implements OptionsElement<string> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: string) => void;
	colorContent: string;
	input!: WeakRef<HTMLInputElement>;
	value: string;
	constructor(
		label: string,
		onSubmit: (str: string) => void,
		owner: Options,
		{initColor = "#000000"} = {},
	) {
		this.label = label;
		this.colorContent = initColor;
		this.value = initColor;
		this.owner = owner;
		this.onSubmit = onSubmit;
	}
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const input = document.createElement("input");
		input.value = this.colorContent;
		input.type = "color";
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		div.append(input);
		return div;
	}
	private onChange() {
		this.owner.changed();
		const input = this.input.deref();
		if (input) {
			const value = input.value as string;
			this.value = value;
			this.onchange(value);
			this.colorContent = value;
		}
	}
	onchange: (str: string) => void = (_) => {};
	watchForChange(func: (str: string) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.colorContent);
	}
}

class SelectInput implements OptionsElement<number> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: number) => void;
	options: readonly string[];
	index: number;
	select!: WeakRef<HTMLSelectElement>;
	radio: boolean;
	get value() {
		return this.index;
	}
	constructor(
		label: string,
		onSubmit: (str: number) => void,
		options: readonly string[],
		owner: Options,
		{defaultIndex = 0, radio = false} = {},
	) {
		this.label = label;
		this.index = defaultIndex;
		this.owner = owner;
		this.onSubmit = onSubmit;
		this.options = options;
		this.radio = radio;
	}
	generateHTML(): HTMLDivElement {
		if (this.radio) {
			const map = new WeakMap<HTMLInputElement, number>();
			const div = document.createElement("div");
			const fieldset = document.createElement("fieldset");
			fieldset.addEventListener("change", () => {
				let i = -1;
				for (const thing of Array.from(fieldset.children)) {
					i++;
					if (i === 0) {
						continue;
					}
					const checkbox = thing.children[0].children[0] as HTMLInputElement;
					if (checkbox.checked) {
						this.onChange(map.get(checkbox));
					}
				}
			});
			const legend = document.createElement("legend");
			legend.textContent = this.label;
			fieldset.appendChild(legend);
			let i = 0;
			for (const thing of this.options) {
				const div = document.createElement("div");
				const input = document.createElement("input");
				input.classList.add("radio");
				input.type = "radio";
				input.name = this.label;
				input.value = thing;
				map.set(input, i);
				if (i === this.index) {
					input.checked = true;
				}
				const label = document.createElement("label");

				label.appendChild(input);
				const span = document.createElement("span");
				span.textContent = thing;
				label.appendChild(span);
				div.appendChild(label);
				fieldset.appendChild(div);
				i++;
			}
			div.appendChild(fieldset);
			return div;
		}
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const selectSpan = document.createElement("span");
		selectSpan.classList.add("selectspan");
		const select = document.createElement("select");

		select.onchange = this.onChange.bind(this, -1);
		for (const thing of this.options) {
			const option = document.createElement("option");
			option.textContent = thing;
			select.appendChild(option);
		}
		this.select = new WeakRef(select);
		select.selectedIndex = this.index;
		selectSpan.append(select);
		const selectArrow = document.createElement("span");
		selectArrow.classList.add("svgicon", "svg-category", "selectarrow");
		selectSpan.append(selectArrow);
		div.append(selectSpan);
		return div;
	}
	private onChange(index = -1) {
		this.owner.changed();
		if (index !== -1) {
			this.index = index;
			this.onchange(index);
			return;
		}
		const select = this.select.deref();
		if (select) {
			const value = select.selectedIndex;
			this.onchange(value);
			this.index = value;
		}
	}
	onchange: (str: number) => void = (_) => {};
	watchForChange(func: (str: number) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.index);
	}
}
class MDInput implements OptionsElement<string> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: string) => void;
	value: string;
	input!: WeakRef<HTMLTextAreaElement>;
	constructor(
		label: string,
		onSubmit: (str: string) => void,
		owner: Options,
		{initText = ""} = {},
	) {
		this.label = label;
		this.value = initText;
		this.owner = owner;
		this.onSubmit = onSubmit;
	}
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		div.append(document.createElement("br"));
		const input = document.createElement("textarea");
		input.value = this.value;
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		div.append(input);
		return div;
	}
	onChange() {
		this.owner.changed();
		const input = this.input.deref();
		if (input) {
			const value = input.value as string;
			this.onchange(value);
			this.value = value;
		}
	}
	onchange: (str: string) => void = (_) => {};
	watchForChange(func: (str: string) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.value);
	}
}
class EmojiInput implements OptionsElement<Emoji | undefined | null> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: Emoji | undefined | null) => void;
	input!: WeakRef<HTMLInputElement>;
	value!: Emoji | undefined | null;
	localuser: Localuser;
	clear: boolean;
	guild: boolean;
	constructor(
		label: string,
		onSubmit: (str: Emoji | undefined | null) => void,
		owner: Options,
		localuser: Localuser,
		{
			initEmoji = undefined,
			clear = false,
			guild = true,
		}: {initEmoji?: undefined | Emoji; clear?: boolean; guild?: boolean} = {},
	) {
		this.label = label;
		this.owner = owner;
		this.guild = guild;
		this.onSubmit = onSubmit;
		this.value = initEmoji;
		this.localuser = localuser;
		this.clear = !!clear;
	}
	generateHTML(): HTMLElement {
		const outDiv = document.createElement("div");
		outDiv.classList.add("flexltr");
		const div = document.createElement("div");
		div.classList.add("flexltr", "emojiForm");
		const label = document.createElement("span");
		label.textContent = this.label;

		let emoji: HTMLElement;
		if (this.value) {
			emoji = this.value.getHTML();
		} else {
			emoji = document.createElement("span");
			emoji.classList.add("emptyEmoji");
		}
		div.onclick = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			(async () => {
				const emj = await this.localuser.emojiPicker(e.x, e.y, this.guild);
				if (emj) {
					this.value = emj;
					emoji.remove();
					emoji = emj.getHTML();
					div.append(emoji);
					this.onchange(emj);
					this.owner.changed();
				}
			})();
		};
		div.append(label, emoji);
		outDiv.append(div);
		if (this.clear) {
			const button = document.createElement("button");
			button.textContent = I18n.settings.clear();
			button.onclick = () => {
				this.value = null;
				emoji.remove();
				this.onchange(null);
				this.owner.changed();
				emoji = document.createElement("span");
				emoji.classList.add("emptyEmoji");
				div.append(emoji);
			};
			outDiv.append(button);
		}

		return outDiv;
	}
	onchange = (_: Emoji | undefined | null) => {};
	watchForChange(func: (arg1: Emoji | undefined | null) => void) {
		this.onchange = func;
	}
	submit() {
		this.onSubmit(this.value);
	}
}

class FileInput implements OptionsElement<FileList | null | undefined> {
	readonly label: string;
	readonly owner: Options;
	readonly onSubmit: (str: FileList | null) => void;
	input!: WeakRef<HTMLInputElement>;
	value: FileList | null | undefined = undefined;
	clear: boolean;
	constructor(
		label: string,
		onSubmit: (str: FileList | null) => void,
		owner: Options,
		{clear = false} = {},
	) {
		this.label = label;
		this.owner = owner;
		this.onSubmit = onSubmit;
		this.clear = clear;
	}
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const innerDiv = document.createElement("div");
		innerDiv.classList.add("flexltr", "fileinputdiv");
		const input = document.createElement("input");
		input.type = "file";
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		innerDiv.append(input);
		if (this.clear) {
			const button = document.createElement("button");
			button.textContent = I18n.settings.clear();
			button.onclick = (_) => {
				if (this.onchange) {
					this.onchange(null);
				}
				this.value = null;
				this.owner.changed();
			};
			innerDiv.append(button);
		}
		div.append(innerDiv);
		return div;
	}
	onChange() {
		this.owner.changed();
		const input = this.input.deref();
		if (input) {
			this.value = input.files;
			if (this.onchange) {
				this.onchange(input.files);
			}
		}
	}
	onchange: ((str: FileList | null | undefined) => void) | null = null;
	watchForChange(func: (str: FileList | null | undefined) => void) {
		this.onchange = func;
	}
	submit() {
		const input = this.input.deref();
		if (input) {
			this.onSubmit(input.files);
		}
	}
}
class ImageInput extends FileInput {
	img: HTMLElement;
	constructor(
		label: string,
		onSubmit: (str: FileList | null) => void,
		owner: Options,
		{clear = false, initImg = "", width = -1, objectFit = ""} = {},
	) {
		super(label, onSubmit, owner, {clear});

		console.log(initImg);
		let hasimg = "" !== initImg;
		const input = document.createElement("input");
		input.type = "file";
		input.oninput = this.onChange.bind(this);
		this.input = new WeakRef(input);
		input.accept = "image/*";
		const img = document.createElement("img");
		img.src = initImg;

		const button = document.createElement("button");
		button.textContent = I18n.settings.clear();
		button.onclick = (_) => {
			img.src = "";
			if (this.onchange) {
				this.onchange(null);
			}
			this.value = null;
			this.owner.changed();
			hasimg = false;
			genImg();
		};
		this.clearbutton = button;

		input.addEventListener("change", () => {
			if (!input.files) return;
			const reader = new FileReader();
			reader.onload = (imgf) => {
				const res = imgf.target?.result;
				if (!res) return;
				if (typeof res !== "string") return;
				img.src = res;
				hasimg = true;
				genImg();
			};
			reader.readAsDataURL(input.files[0]);
		});
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = I18n.settings.img();
		const genImg = () => {
			console.warn(hasimg);
			if (hasimg) {
				div.append(img);
				span.remove();
			} else {
				div.append(span);
				img.remove();
			}
		};
		if (width !== -1) {
			div.style.width = width + "px";
			img.style.width = width + "px";
		}
		if (objectFit) img.style.objectFit = objectFit;
		console.warn(objectFit);
		this.img = div;
		div.onclick = () => {
			input.click();
		};
		genImg();
	}
	clearbutton: HTMLButtonElement;
	generateHTML(): HTMLDivElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = this.label;
		div.append(span);
		const innerDiv = document.createElement("div");
		innerDiv.classList.add("flexltr", "fileinputdiv");
		innerDiv.append(this.img);

		if (this.clear) {
			innerDiv.append(this.clearbutton);
		}
		div.append(innerDiv);
		return div;
	}
}

class HtmlArea implements OptionsElement<void> {
	submit: () => void;
	html: (() => HTMLElement) | HTMLElement;
	value!: void;
	constructor(html: (() => HTMLElement) | HTMLElement, submit: () => void) {
		this.submit = submit;
		this.html = html;
	}
	generateHTML(): HTMLElement {
		if (this.html instanceof Function) {
			return (this.html = this.html());
		} else {
			return this.html;
		}
	}
	watchForChange() {}
}
/**
 * This is a simple wrapper class for Options to make it happy so it can be used outside of Settings.
 */
class Float {
	options: Options;
	html: WeakRef<HTMLElement> = new WeakRef(document.createElement("div"));
	/**
	 * This is a simple wrapper class for Options to make it happy so it can be used outside of Settings.
	 */
	constructor(name: string, options = {ltr: false, noSubmit: true}) {
		this.options = new Options(name, this, options);
	}
	changed(d: HTMLElement) {
		const html = this.html.deref();
		if (!html) return;
		html.append(d);
	}
	generateHTML() {
		const html = this.options.generateHTML();
		this.html = new WeakRef(html);
		return html;
	}
}
class Dialog {
	float: Float;
	get options() {
		return this.float.options;
	}
	background = new WeakRef(document.createElement("div"));
	constructor(name: string, {ltr = false, noSubmit = true} = {}) {
		this.float = new Float(name, {ltr, noSubmit});
	}
	show(hideOnClick = true) {
		const background = document.createElement("div");
		background.classList.add("background");
		if (!hideOnClick) background.classList.add("solidBackground");
		const center = this.float.generateHTML();
		center.classList.add("centeritem", "nonimagecenter");
		center.classList.remove("titlediv");
		background.append(center);
		document.body.append(background);
		this.background = new WeakRef(background);
		background.onclick = (_) => {
			if (hideOnClick && _.target === background) {
				removeAni(background);
			}
		};
		background.tabIndex = 0;
		background.focus();
		background.onkeydown = (e) => {
			if (e.key === "Escape" && hideOnClick) {
				removeAni(background);
			}
		};
		return center;
	}
	hide() {
		const background = this.background.deref();
		if (!background) return;
		removeAni(background);
	}
}
class InstancePicker implements OptionsElement<InstanceInfo | null> {
	value: InstanceInfo | null = null;
	owner: Options | Form;
	verify = document.createElement("p");
	onchange = (_: InstanceInfo) => {};
	instance?: string;
	watchForChange(func: (arg1: InstanceInfo) => void) {
		this.onchange = func;
	}
	constructor(
		owner: Options | Form,
		onchange?: InstancePicker["onchange"],
		button?: HTMLButtonElement,
		instance?: string,
	) {
		this.owner = owner;
		this.instance = instance;
		if (onchange) {
			this.onchange = onchange;
		}
		this.button = button;
	}
	generateHTML(): HTMLElement {
		const div = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = I18n.htmlPages.instanceField();
		div.append(span);

		const verify = this.verify;
		verify.classList.add("verify");
		div.append(verify);

		const input = this.input;
		input.type = "search";
		input.setAttribute("list", "instances");
		div.append(input);
		let cur = 0;
		input.onkeyup = async () => {
			const thiscur = ++cur;
			await new Promise((res) => setTimeout(res, 500));
			if (thiscur !== cur) return;
			const urls = await checkInstance(input.value, verify, this.button);
			if (thiscur === cur && urls) {
				this.onchange(urls);
			}
		};

		InstancePicker.picker = this;
		InstancePicker.genDataList();

		return div;
	}
	button?: HTMLButtonElement;
	input = document.createElement("input");
	giveButton(button: HTMLButtonElement | undefined) {
		this.button = button;
	}
	static picker?: InstancePicker;
	static genDataList() {
		let datalist = document.getElementById("instances");
		if (!datalist) {
			datalist = document.createElement("datalist");
			datalist.setAttribute("id", "instances");
			document.body.append(datalist);
		}

		const json = getInstances();

		const [stringURLMap, stringURLsMap] = getStringURLMapPair();
		if (!json) {
			instancefetch.then(this.genDataList.bind(this));
			return;
		}

		if (json.length !== 0) {
			let name =
				this.picker?.instance || new URLSearchParams(window.location.search).get("instance");
			if (!name) {
				const l = localStorage.getItem("instanceinfo");
				if (l) {
					const json = JSON.parse(l);
					if (json.value) {
						name = json.value;
					} else {
						name = json.wellknown;
					}
				}
			}
			if (!name) {
				name = json[0].name;
			}
			if (this.picker) {
				checkInstance(
					name,
					this.picker.verify,
					this.picker.button || document.createElement("button"),
				).then((e) => {
					if (e) this.picker?.onchange(e);
				});
				this.picker.input.value = name;
			}
		}

		if (datalist.childElementCount !== 0) {
			return;
		}

		for (const instance of json) {
			if (instance.display === false) {
				continue;
			}
			const option = document.createElement("option");
			option.disabled = !instance.online;
			option.value = instance.name;
			if (instance.url) {
				stringURLMap.set(option.value, instance.url);
				if (instance.urls) {
					stringURLsMap.set(instance.url, instance.urls);
				}
			} else if (instance.urls) {
				stringURLsMap.set(option.value, instance.urls);
			} else {
				option.disabled = true;
			}
			if (instance.description) {
				option.label = instance.description;
			} else {
				option.label = instance.name;
			}
			datalist.append(option);
		}
	}
	submit() {}
}
setTimeout(InstancePicker.genDataList.bind(InstancePicker), 0);
export {Dialog};
class Options implements OptionsElement<void> {
	name: string;
	haschanged = false;
	options: OptionsElement<any>[];
	readonly owner: Buttons | Options | Form | Float;
	readonly ltr: boolean;
	value!: void;
	readonly html: WeakMap<OptionsElement<any>, WeakRef<HTMLDivElement>> = new WeakMap();
	readonly noSubmit: boolean = false;
	container: WeakRef<HTMLDivElement> = new WeakRef(document.createElement("div"));
	vsmaller = false;
	constructor(
		name: string,
		owner: Buttons | Options | Form | Float,
		{ltr = false, noSubmit = false, vsmaller = false} = {},
	) {
		this.name = name;
		this.options = [];
		this.owner = owner;
		this.ltr = ltr;
		this.noSubmit = noSubmit;
		this.vsmaller = vsmaller;
	}
	removeAll() {
		this.returnFromSub();
		while (this.options.length) {
			this.options.pop();
		}
		const container = this.container.deref();
		if (container) {
			container.innerHTML = "";
		}
	}
	watchForChange() {}
	addOptions(name: string, {ltr = false, noSubmit = false} = {}) {
		const options = new Options(name, this, {ltr, noSubmit});
		this.options.push(options);
		this.generate(options);
		return options;
	}
	addButtons(name: string, {top = false, titles = true} = {}) {
		const buttons = new Buttons(name, {top, titles});
		this.options.push(buttons);
		this.generate(buttons);
		return buttons;
	}
	subOptions: Options | Form | undefined;
	genTop() {
		const container = this.container.deref();
		if (container) {
			if (this.isTop()) {
				this.generateContainter();
			} else if (this.owner instanceof Options) {
				this.owner.genTop();
			} else {
				(this.owner as Form).owner.genTop();
			}
		} else {
			throw new Error("Tried to make a sub menu when the options weren't rendered");
		}
	}
	addSubOptions(name: string, {ltr = false, noSubmit = false} = {}) {
		const options = new Options(name, this, {ltr, noSubmit});
		this.subOptions = options;
		this.genTop();
		return options;
	}
	addSubForm(
		name: string,
		onSubmit: (arg1: object, sent: object) => void,
		{
			ltr = false,
			submitText = "Submit",
			fetchURL = "",
			headers = {},
			method = "POST",
			traditionalSubmit = false,
			tfaCheck = true,
		} = {},
	) {
		const options = new Form(name, this, onSubmit, {
			ltr,
			submitText,
			fetchURL,
			headers,
			method,
			traditionalSubmit,
			tfaCheck,
		});
		this.subOptions = options;
		this.genTop();
		return options;
	}
	addEmojiInput(
		label: string,
		onSubmit: (str: Emoji | null | undefined) => void,
		localuser: Localuser,
		{initEmoji = undefined, clear = false, guild = true} = {} as {
			initEmoji?: Emoji;
			clear?: boolean;
			guild?: boolean;
		},
	) {
		const emoji = new EmojiInput(label, onSubmit, this, localuser, {
			initEmoji: initEmoji,
			clear,
			guild,
		});
		this.options.push(emoji);
		this.generate(emoji);
		return emoji;
	}
	addInstancePicker(
		onchange?: InstancePicker["onchange"],
		{button, instance}: {button?: HTMLButtonElement; instance?: string} = {},
	) {
		const instancePicker = new InstancePicker(this, onchange, button, instance);
		this.options.push(instancePicker);
		this.generate(instancePicker);
		return instancePicker;
	}
	returnFromSub() {
		this.subOptions = undefined;
		this.genTop();
	}
	addSelect(
		label: string,
		onSubmit: (str: number) => void,
		selections: readonly string[],
		{defaultIndex = 0, radio = false} = {},
	) {
		const select = new SelectInput(label, onSubmit, selections, this, {
			defaultIndex,
			radio,
		});
		this.options.push(select);
		this.generate(select);
		return select;
	}
	addImageInput(
		label: string,
		onSubmit: (files: FileList | null) => void,
		{clear = false, initImg = "", width = -1, objectFit = ""} = {},
	) {
		const FI = new ImageInput(label, onSubmit, this, {clear, initImg, width, objectFit});
		this.options.push(FI);
		this.generate(FI);
		return FI;
	}
	addFileInput(label: string, onSubmit: (files: FileList | null) => void, {clear = false} = {}) {
		const FI = new FileInput(label, onSubmit, this, {clear});
		this.options.push(FI);
		this.generate(FI);
		return FI;
	}
	addDateInput(label: string, onSubmit: (str: string) => void, {initText = ""} = {}) {
		const textInput = new DateInput(label, onSubmit, this, {
			initText,
		});
		this.options.push(textInput);
		this.generate(textInput);
		return textInput;
	}
	addTextInput(
		label: string,
		onSubmit: (str: string) => void,
		{initText = "", password = false} = {},
	) {
		const textInput = new TextInput(label, onSubmit, this, {
			initText,
			password,
		});
		this.options.push(textInput);
		this.generate(textInput);
		return textInput;
	}
	addColorInput(label: string, onSubmit: (str: string) => void, {initColor = ""} = {}) {
		const colorInput = new ColorInput(label, onSubmit, this, {initColor});
		this.options.push(colorInput);
		this.generate(colorInput);
		return colorInput;
	}
	addMDInput(label: string, onSubmit: (str: string) => void, {initText = ""} = {}) {
		const mdInput = new MDInput(label, onSubmit, this, {initText});
		this.options.push(mdInput);
		this.generate(mdInput);
		return mdInput;
	}
	addHTMLArea(html: (() => HTMLElement) | HTMLElement, submit: () => void = () => {}) {
		const htmlarea = new HtmlArea(html, submit);
		this.options.push(htmlarea);
		this.generate(htmlarea);
		return htmlarea;
	}
	addButtonInput(label: string, textContent: string, onSubmit: () => void) {
		const button = new ButtonInput(label, textContent, onSubmit, this);
		this.options.push(button);
		this.generate(button);
		return button;
	}
	addCheckboxInput(label: string, onSubmit: (str: boolean) => void, {initState = false} = {}) {
		const box = new CheckboxInput(label, onSubmit, this, {initState});
		this.options.push(box);
		this.generate(box);
		return box;
	}
	addText(str: string) {
		const text = new SettingsText(str);
		this.options.push(text);
		this.generate(text);
		return text;
	}
	addMDText(str: MarkDown) {
		const text = new SettingsMDText(str);
		this.options.push(text);
		this.generate(text);
		return text;
	}
	addHR() {
		const rule = new HorrizonalRule();
		this.options.push(rule);
		this.generate(rule);
		return rule;
	}
	addTitle(str: string) {
		const text = new SettingsTitle(str);
		this.options.push(text);
		this.generate(text);
		return text;
	}
	addForm(
		name: string,
		onSubmit: (arg1: object, sent: object) => void,
		{
			ltr = false,
			submitText = I18n.submit(),
			fetchURL = "",
			headers = {},
			method = "POST",
			traditionalSubmit = false,
			vsmaller = false,
		} = {},
	) {
		const options = new Form(name, this, onSubmit, {
			ltr,
			submitText,
			fetchURL,
			headers,
			method,
			traditionalSubmit,
			vsmaller,
		});
		this.options.push(options);
		this.generate(options);
		return options;
	}
	generate(elm: OptionsElement<any>) {
		const container = this.container.deref();
		if (container) {
			const div = document.createElement("div");
			if (!(elm instanceof Options)) {
				div.classList.add("optionElement");
			}
			const html = elm.generateHTML();
			div.append(html);
			this.html.set(elm, new WeakRef(div));
			container.append(div);
		}
	}
	deleteElm(opt: OptionsElement<any>) {
		const html = this.html.get(opt)?.deref();
		this.options = this.options.filter((_) => _ !== opt);
		if (!html) return;
		html.remove();
		this.html.delete(opt);
	}
	title: WeakRef<HTMLElement> = new WeakRef(document.createElement("h2"));
	generateHTML(): HTMLElement {
		const div = document.createElement("div");
		div.classList.add("flexttb", "titlediv");
		if (this.vsmaller) div.classList.add("vsmaller");
		if (this.owner instanceof Options) {
			div.classList.add("optionElement");
		}
		const title = document.createElement("h2");
		title.textContent = this.name;
		div.append(title);
		if (this.name !== "") title.classList.add("settingstitle");
		this.title = new WeakRef(title);
		const container = document.createElement("div");
		this.container = new WeakRef(container);
		container.classList.add(this.ltr ? "flexltr" : "flexttb", "flexspace");
		this.generateContainter();
		div.append(container);
		return div;
	}
	generateName(): (HTMLElement | string)[] {
		const build: (HTMLElement | string)[] = [];
		if (this.owner instanceof Buttons) {
			const span = document.createElement("span");
			span.classList.add("svg-intoMenu", "svgicon", "mobileback");
			build.push(span);
			span.onclick = () => {
				const container = this.container.deref();
				if (!container) return;
				if (!container.parentElement) return;
				if (!container.parentElement.parentElement) return;
				container.parentElement.parentElement.classList.add("mobileHidden");
			};
		}
		if (this.subOptions) {
			if (this.name !== "") {
				const name = document.createElement("span");
				name.innerText = this.name;
				name.classList.add("clickable");
				name.onclick = () => {
					this.returnFromSub();
				};
				build.push(name);
				build.push(" > ");
			}
			if (this.subOptions instanceof Options) {
				build.push(...this.subOptions.generateName());
			} else {
				build.push(...this.subOptions.options.generateName());
			}
		} else {
			const name = document.createElement("span");
			name.innerText = this.name;
			build.push(name);
		}
		return build;
	}
	isTop() {
		return (
			(this.owner instanceof Options && this.owner.subOptions !== this) ||
			(this.owner instanceof Form && this.owner.owner.subOptions !== this.owner) ||
			this.owner instanceof Settings ||
			this.owner instanceof Buttons ||
			this.owner instanceof Float
		);
	}
	generateContainter() {
		const container = this.container.deref();
		if (container) {
			container.innerHTML = "";
			const title = this.title.deref();
			if (title) title.innerHTML = "";

			console.log(container.children);
			if (this.isTop()) {
				if (title) {
					const elms = this.generateName();
					title.append(...elms);
				}
			}
			if (!this.subOptions) {
				for (const thing of this.options) {
					this.generate(thing);
				}
			} else {
				container.append(this.subOptions.generateHTML());
			}
			if (title && title.innerText !== "") {
				title.classList.add("settingstitle");
			} else if (title) {
				title.classList.remove("settingstitle");
			}
			if (this.owner instanceof Form && this.owner.button) {
				const button = this.owner.button.deref();
				if (button) {
					button.hidden = false;
				}
			}
		} else {
			console.warn("tried to generate container, but it did not exist");
		}
	}
	changed() {
		if (this.noSubmit) {
			return;
		}
		if (this.owner instanceof Options || this.owner instanceof Form) {
			this.owner.changed();
			return;
		}
		if (!this.haschanged) {
			const div = document.createElement("div");
			div.classList.add("flexltr", "savediv");
			const span = document.createElement("span");
			div.append(span);
			span.textContent = I18n.settings.unsaved();
			const button = document.createElement("button");
			button.textContent = I18n.settings.save();
			div.append(button);
			this.haschanged = true;
			this.owner.changed(div);

			button.onclick = (_) => {
				if (this.owner instanceof Buttons) {
					this.owner.save();
				}
				div.remove();
				this.submit();
			};
		}
	}
	submit() {
		this.haschanged = false;
		if (this.subOptions) {
			this.subOptions.submit();
			return;
		}

		for (const thing of this.options) {
			thing.submit();
		}
	}
}
class Captcha implements OptionsElement<string> {
	owner: Form;
	value: string = "";
	constructor(owner: Form) {
		this.owner = owner;
	}
	div?: HTMLElement;
	generateHTML(): HTMLElement {
		const div = document.createElement("div");
		this.div = div;
		return div;
	}
	submit() {}
	onchange = (_: string) => {};
	watchForChange(func: (arg1: string) => void) {
		this.onchange = func;
	}
	static hcaptcha?: HTMLDivElement;
	static async waitForCaptcha(ctype: "hcaptcha") {
		switch (ctype) {
			case "hcaptcha":
				if (!this.hcaptcha) throw Error("no captcha found");
				const hcaptcha = this.hcaptcha;
				console.log(hcaptcha);
				//@ts-expect-error
				while (!hcaptcha.children[1].children.length || !hcaptcha.children[1].children[1].value) {
					await new Promise<void>((res) => setTimeout(res, 100));
				}
				//@ts-expect-error
				return hcaptcha.children[1].children[1].value;
		}
	}
	async makeCaptcha({
		captcha_sitekey,
		captcha_service,
	}: {
		captcha_sitekey: string;
		captcha_service: "hcaptcha";
	}): Promise<string> {
		if (!this.div) throw new Error("Div doesn't exist yet to give catpcha");
		switch (captcha_service) {
			case "hcaptcha":
				if (Captcha.hcaptcha) {
					this.div.append(Captcha.hcaptcha);
					Captcha.hcaptcha.setAttribute("data-sitekey", captcha_sitekey);
					eval("hcaptcha.reset()");
					return Captcha.waitForCaptcha(captcha_service);
				} else {
					const capt = document.createElement("div");
					const capty = document.createElement("div");
					capty.classList.add("h-captcha");

					capty.setAttribute("data-sitekey", captcha_sitekey);
					const script = document.createElement("script");
					script.src = "https://js.hcaptcha.com/1/api.js";
					capt.append(script);
					capt.append(capty);
					Captcha.hcaptcha = capt;
					this.div.append(capt);
					return Captcha.waitForCaptcha(captcha_service);
				}
		}
	}
	static async makeCaptcha(json: {
		captcha_sitekey: string;
		captcha_service: "hcaptcha";
	}): Promise<string> {
		const float = new Dialog("", {noSubmit: true});
		float.options.addTitle(I18n.form.captcha());
		const cap = float.options.addForm("", () => {}, {traditionalSubmit: true}).addCaptcha();
		float.show();
		const ret = cap.makeCaptcha(json);
		await ret;
		float.hide();
		return ret;
	}
}
class FormError extends Error {
	elem: OptionsElement<any>;
	message: string;
	constructor(elem: OptionsElement<any>, message: string) {
		super(message);
		this.message = message;
		this.elem = elem;
	}
}
async function handle2fa(json: any, api: string): Promise<false | any> {
	if (json.ticket) {
		if (json.webauthn) {
			const challenge = JSON.parse(json.webauthn)
				.publicKey as PublicKeyCredentialRequestOptionsJSON;
			challenge.challenge = challenge.challenge
				.split("=")[0]
				.replaceAll("+", "-")
				.replaceAll("/", "_");
			challenge.allowCredentials?.forEach(
				(_) => (_.id = _.id.split("=")[0].replaceAll("+", "-").replaceAll("/", "_")),
			);
			console.log(challenge);
			const options = PublicKeyCredential.parseRequestOptionsFromJSON(challenge);
			const credential = (await navigator.credentials.get({publicKey: options})) as unknown as {
				rawId: ArrayBuffer;
				response: {
					[key: string]: ArrayBuffer;
				};
			};
			if (!credential) return false;
			function toBase64(buf: ArrayBuffer) {
				return btoa(String.fromCharCode(...new Uint8Array(buf)));
			}
			const keys = ["authenticatorData", "clientDataJSON", "signature"];
			const response = {} as any;
			for (const key of keys) {
				response[key] = toBase64(credential.response[key] as ArrayBuffer);
			}
			const res = {
				rawId: toBase64(credential.rawId),
				response,
			};
			const resObj = await fetch(api + "/auth/mfa/webauthn", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({code: JSON.stringify(res), ticket: json.ticket}),
			});
			if (!resObj.ok) return false;
			const jsonRes = await resObj.json();
			return jsonRes;
		} else {
			return new Promise<boolean>((resolution) => {
				const better = new Dialog("");
				const form = better.options.addForm(
					"",
					(res: any) => {
						if (res.message) {
							throw new FormError(ti, res.message);
						} else {
							resolution(res);
							better.hide();
						}
					},
					{
						fetchURL: api + "/auth/mfa/totp",
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
					},
				);
				form.addTitle(I18n["2faCode"]());
				form.addPreprocessor((e) => {
					//@ts-ignore
					e.ticket = json.ticket;
				});
				const ti = form.addTextInput("", "code");
				better.show();
			});
		}
	} else {
		return false;
	}
}
async function handleCaptcha(json: any, build: any, cap: Captcha | undefined) {
	if (json.captcha_sitekey) {
		let token: string;
		if (cap) {
			token = await cap.makeCaptcha(json);
		} else {
			token = await Captcha.makeCaptcha(json);
		}
		build.captcha_key = token;
		return true;
	}
	return false;
}
export {FormError};
class Form implements OptionsElement<object> {
	name: string;
	readonly options: Options;
	readonly owner: Options;
	readonly ltr: boolean;
	readonly names: Map<string, OptionsElement<any>> = new Map();
	readonly required: WeakSet<OptionsElement<any>> = new WeakSet();
	readonly submitText: string;
	fetchURL: string;
	readonly headers = {};
	readonly method: string;
	value!: object;
	traditionalSubmit: boolean;
	values: {[key: string]: any} = {};
	tfaCheck: boolean;
	constructor(
		name: string,
		owner: Options,
		onSubmit: (arg1: object, sent: object) => void,
		{
			ltr = false,
			submitText = I18n.submit(),
			fetchURL = "",
			headers = {},
			method = "POST",
			traditionalSubmit = false,
			vsmaller = false,
			tfaCheck = true,
		} = {},
	) {
		this.traditionalSubmit = traditionalSubmit;
		this.name = name;
		this.tfaCheck = tfaCheck;
		this.method = method;
		this.submitText = submitText;
		this.options = new Options(name, this, {ltr, vsmaller});
		this.owner = owner;
		this.fetchURL = fetchURL;
		this.headers = headers;
		this.ltr = ltr;
		this.onSubmit = onSubmit;
	}
	setValue(key: string, value: any) {
		//the value can't really be anything, but I don't care enough to fix this
		this.values[key] = value;
	}
	addSubOptions(name: string, {ltr = false, noSubmit = false} = {}) {
		if (this.button && this.button.deref()) {
			(this.button.deref() as HTMLElement).hidden = true;
		}
		return this.options.addSubOptions(name, {ltr, noSubmit});
	}
	addHTMLArea(html: (() => HTMLElement) | HTMLElement, onSubmit = () => {}) {
		return this.options.addHTMLArea(html, onSubmit);
	}
	private captcha?: Captcha;
	addCaptcha() {
		if (this.captcha) throw new Error("only one captcha is allowed per form");
		const cap = new Captcha(this);
		this.options.options.push(cap);
		this.options.generate(cap);
		this.captcha = cap;
		return cap;
	}
	addSubForm(
		name: string,
		onSubmit: (arg1: object, sent: object) => void,
		{
			ltr = false,
			submitText = I18n.submit(),
			fetchURL = "",
			headers = {},
			method = "POST",
			traditionalSubmit = false,
		} = {},
	) {
		if (this.button && this.button.deref()) {
			console.warn("hidden");
			(this.button.deref() as HTMLElement).hidden = true;
		}
		return this.options.addSubForm(name, onSubmit, {
			ltr,
			submitText,
			fetchURL,
			headers,
			method,
			traditionalSubmit,
		});
	}
	generateContainter() {
		this.options.generateContainter();
		if (this.options.isTop() && this.button && this.button.deref()) {
			(this.button.deref() as HTMLElement).hidden = false;
		}
	}
	selectMap = new WeakMap<SelectInput, readonly (number | string | null | undefined)[]>();
	addSelect(
		label: string,
		formName: string,
		selections: string[],
		{defaultIndex = 0, required = false, radio = false} = {},
		correct: readonly (string | number | null | undefined)[] = selections,
	) {
		const select = this.options.addSelect(label, (_) => {}, selections, {
			defaultIndex,
			radio,
		});
		this.selectMap.set(select, correct);
		this.names.set(formName, select);
		if (required) {
			this.required.add(select);
		}
		return select;
	}
	readonly fileOptions: Map<FileInput, {files: "one" | "multi"}> = new Map();
	addFileInput(
		label: string,
		formName: string,
		{required = false, files = "one", clear = false} = {},
	) {
		const FI = this.options.addFileInput(label, (_) => {}, {clear});
		if (files !== "one" && files !== "multi") throw new Error("files should equal one or multi");
		this.fileOptions.set(FI, {files});
		this.names.set(formName, FI);
		if (required) {
			this.required.add(FI);
		}
		return FI;
	}
	addImageInput(
		label: string,
		formName: string,
		{required = false, files = "one", clear = false, initImg = "", width = -1, objectFit = ""} = {},
	) {
		const FI = this.options.addImageInput(label, (_) => {}, {clear, initImg, width, objectFit});
		if (files !== "one" && files !== "multi") throw new Error("files should equal one or multi");
		this.fileOptions.set(FI, {files});
		this.names.set(formName, FI);
		if (required) {
			this.required.add(FI);
		}
		return FI;
	}
	addEmojiInput(
		label: string,
		formName: string,
		localuser: Localuser,
		{initEmoji = undefined, required = false, clear = false, guild = true} = {} as {
			initEmoji?: Emoji;
			required: boolean;
			clear?: boolean;
			guild?: boolean;
		},
	) {
		const emoji = this.options.addEmojiInput(label, () => {}, localuser, {
			initEmoji: initEmoji,
			clear,
			guild,
		});
		if (required) {
			this.required.add(emoji);
		}
		this.names.set(formName, emoji);
		return emoji;
	}
	addDateInput(label: string, formName: string, {initText = "", required = false} = {}) {
		const dateInput = this.options.addDateInput(label, (_) => {}, {
			initText,
		});
		this.names.set(formName, dateInput);
		if (required) {
			this.required.add(dateInput);
		}
		return dateInput;
	}
	addTextInput(
		label: string,
		formName: string,
		{initText = "", required = false, password = false} = {},
	) {
		const textInput = this.options.addTextInput(label, (_) => {}, {
			initText,
			password,
		});
		this.names.set(formName, textInput);
		if (required) {
			this.required.add(textInput);
		}
		return textInput;
	}
	addColorInput(label: string, formName: string, {initColor = "", required = false} = {}) {
		const colorInput = this.options.addColorInput(label, (_) => {}, {
			initColor,
		});
		this.names.set(formName, colorInput);
		if (required) {
			this.required.add(colorInput);
		}
		return colorInput;
	}

	addMDInput(label: string, formName: string, {initText = "", required = false} = {}) {
		const mdInput = this.options.addMDInput(label, (_) => {}, {initText});
		this.names.set(formName, mdInput);
		if (required) {
			this.required.add(mdInput);
		}
		return mdInput;
	}
	/**
	 * This function does not integrate with the form, so be aware of that
	 *
	 */
	addButtonInput(label: string, textContent: string, onSubmit: () => void) {
		return this.options.addButtonInput(label, textContent, onSubmit);
	}
	/**
	 * This function does not integrate with the form, so be aware of that
	 *
	 */
	addOptions(name: string, {ltr = false, noSubmit = false} = {}) {
		return this.options.addOptions(name, {ltr, noSubmit});
	}
	addCheckboxInput(label: string, formName: string, {initState = false, required = false} = {}) {
		const box = this.options.addCheckboxInput(label, (_) => {}, {initState});
		this.names.set(formName, box);
		if (required) {
			this.required.add(box);
		}
		return box;
	}
	addText(str: string) {
		return this.options.addText(str);
	}
	addMDText(str: MarkDown) {
		return this.options.addMDText(str);
	}
	addHR() {
		return this.options.addHR();
	}
	addTitle(str: string) {
		this.options.addTitle(str);
	}
	handleError(error: FormError) {
		this.onFormError(error);
		const elm = this.options.html.get(error.elem);
		if (elm) {
			const html = elm.deref();
			if (html) {
				this.makeError(html, error.message);
			}
		}
	}
	button!: WeakRef<HTMLButtonElement>;
	generateHTML(): HTMLElement {
		const div = document.createElement("div");
		div.append(this.options.generateHTML());
		div.classList.add("FormSettings");
		if (!this.traditionalSubmit && this.submitText) {
			const button = document.createElement("button");
			button.onclick = (_) => {
				this.submit();
			};
			button.textContent = this.submitText;
			div.append(button);
			if (this.options.subOptions) {
				button.hidden = true;
			}
			this.button = new WeakRef(button);
		}
		return div;
	}
	onSubmit:
		| ((arg1: object, sent: object) => void)
		| ((arg1: object, sent: object) => Promise<void>);
	watchForChange(func: (arg1: object) => void) {
		this.onSubmit = func;
	}
	changed() {
		if (this.traditionalSubmit) {
			this.owner.changed();
		}
	}
	preprocessor: (obj: Object) => void = () => {};
	addPreprocessor(func: (obj: Object) => void) {
		this.preprocessor = func;
	}
	onFormError = (_: FormError) => {};
	async submit() {
		if (this.options.subOptions) {
			this.options.subOptions.submit();
			return;
		}
		console.log("start");
		const build = {};
		for (const key of Object.keys(this.values)) {
			const thing = this.values[key];
			if (thing instanceof Function) {
				try {
					(build as any)[key] = thing();
				} catch (e: any) {
					if (e instanceof FormError) {
						this.handleError(e);
					}
					return;
				}
			} else {
				(build as any)[key] = thing;
			}
		}
		console.log("middle");
		const promises: Promise<void>[] = [];
		for (const thing of this.names.keys()) {
			if (thing === "") continue;
			const input = this.names.get(thing) as OptionsElement<any>;
			if (input instanceof SelectInput) {
				(build as any)[thing] = (this.selectMap.get(input) as string[])[input.value];
				continue;
			} else if (input instanceof FileInput) {
				const options = this.fileOptions.get(input);
				if (!options) {
					throw new Error(
						"FileInput without its options is in this form, this should never happen.",
					);
				}
				if (options.files === "one") {
					console.log(input.value);
					if (input.value) {
						const reader = new FileReader();
						reader.readAsDataURL(input.value[0]);
						const promise = new Promise<void>((res) => {
							reader.onload = () => {
								(build as any)[thing] = reader.result;
								res();
							};
						});
						promises.push(promise);
						continue;
					}
				} else {
					console.error(options.files + " is not currently implemented");
				}
			} else if (input instanceof EmojiInput) {
				if (!input.value) {
					(build as any)[thing] = input.value;
				} else if (input.value.id) {
					(build as any)[thing] = input.value.id;
				} else if (input.value.emoji) {
					(build as any)[thing] = input.value.emoji;
				}
				continue;
			}
			(build as any)[thing] = input.value;
		}
		console.log("middle2");
		await Promise.allSettled(promises);
		try {
			this.preprocessor(build);
		} catch (e) {
			if (e instanceof FormError) {
				this.handleError(e);
			}
			return;
		}
		if (this.fetchURL !== "") {
			const onSubmit = async (json: any) => {
				try {
					await this.onSubmit(json, build);
				} catch (e) {
					console.error(e);
					if (e instanceof FormError) {
						this.handleError(e);
					}
					return;
				}
			};
			const doFetch = async () => {
				fetch(this.fetchURL, {
					method: this.method,
					body: JSON.stringify(build),
					headers: this.headers,
				})
					.then((_) => {
						return _.text();
					})
					.then((_) => {
						if (_ === "") return {};
						return JSON.parse(_);
					})
					.then(async (json) => {
						if (await handleCaptcha(json, build, this.captcha)) {
							return await doFetch();
						}
						const match = this.fetchURL.match(/https?:\/\/[^\/]*\/api/gm);
						if (match && this.tfaCheck) {
							const tried = await handle2fa(json, match[0]);
							if (tried) {
								return await onSubmit(tried);
							}
						}
						if (json.ticket) {
						}
						if (json.errors) {
							if (this.errors(json)) {
								return;
							}
						}
						onSubmit(json);
					});
			};
			doFetch();
		} else {
			try {
				await this.onSubmit(build, build);
			} catch (e) {
				if (e instanceof FormError) {
					this.handleError(e);
				}
				return;
			}
		}
		console.warn("needs to be implemented");
	}

	errors(errors: {
		code: number;
		message: string;
		errors: {[key: string]: {_errors: {message: string; code: string}[]}};
	}) {
		if (!(errors instanceof Object)) {
			return;
		}
		for (const error of Object.keys(errors.errors)) {
			const elm = this.names.get(error);
			if (elm) {
				const ref = this.options.html.get(elm);
				if (ref && ref.deref()) {
					const html = ref.deref() as HTMLDivElement;
					const errorMessage = errors.errors[error]._errors[0].message;
					this.makeError(html, errorMessage);
					return true;
				}
			}
		}
		return false;
	}
	error(formElm: string, errorMessage: string) {
		const elm = this.names.get(formElm);
		if (elm) {
			const htmlref = this.options.html.get(elm);
			if (htmlref) {
				const html = htmlref.deref();
				if (html) {
					this.makeError(html, errorMessage);
				}
			}
		} else {
			console.warn(formElm + " is not a valid form property");
		}
	}
	makeError(e: HTMLDivElement, message: string) {
		let element = e.getElementsByClassName("suberror")[0] as HTMLElement;
		if (!element) {
			const div = document.createElement("div");
			div.classList.add("suberror", "suberrora");
			e.append(div);
			element = div;
		} else {
			element.classList.remove("suberror");
			setTimeout((_) => {
				element.classList.add("suberror");
			}, 100);
		}
		element.textContent = message;
	}
}
class HorrizonalRule implements OptionsElement<unknown> {
	constructor() {}
	generateHTML(): HTMLElement {
		return document.createElement("hr");
	}
	watchForChange(_: (arg1: undefined) => void) {
		throw new Error("don't do this");
	}
	submit = () => {};
	value = undefined;
}
class Settings extends Buttons {
	static readonly Buttons = Buttons;
	static readonly Options = Options;
	html!: HTMLElement | null;
	constructor(name: string) {
		super(name);
	}
	addButton(name: string, {ltr = false, optName = name, noSubmit = false} = {}): Options {
		const options = new Options(optName, this, {ltr, noSubmit});
		this.add(name, options);
		return options;
	}
	show() {
		const background = document.createElement("div");
		background.classList.add("flexttb", "menu", "background");

		const title = document.createElement("h2");
		title.textContent = this.name;
		title.classList.add("settingstitle");
		background.append(title);

		background.append(this.generateHTML());

		const exit = document.createElement("span");
		exit.classList.add("exitsettings", "svgicon", "svg-x");
		background.append(exit);
		exit.onclick = (_) => {
			this.hide();
		};
		background.addEventListener("keyup", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				// Cancel the default action, if needed
				this.hide();
			}
		});
		document.body.append(background);
		background.setAttribute("tabindex", "0");
		background.focus();

		this.html = background;
	}
	hide() {
		if (this.html) {
			const html = this.html;
			html.classList.add("bgRemove");
			html.addEventListener("animationend", (e: AnimationEvent) => {
				if (e.animationName === "bg-out") html.remove();
			});
			this.html = null;
		}
	}
}

export {Settings, OptionsElement, Options, Form, Float};
