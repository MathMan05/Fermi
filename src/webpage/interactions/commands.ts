import {Channel} from "../channel.js";
import {Guild} from "../guild.js";
import {I18n} from "../i18n.js";
import {commandJson, commandOptionJson} from "../jsontypes.js";
import {Localuser} from "../localuser.js";
import {SnowFlake} from "../snowflake.js";
import {removeAni} from "../utils/utils.js";
function focusInput(html: HTMLElement) {
	const input = html.getElementsByTagName("input")[0];
	if (input) input.focus();
}
function focusElm(node: HTMLElement | Text, before = true) {
	const selection = window.getSelection();
	if (!selection) return;
	var range = document.createRange();
	if (before) {
		range.setStartBefore(node);
	} else {
		range.setStartAfter(node);
	}
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}
export class Command extends SnowFlake {
	owner: Localuser | Guild;
	type: 1 | 2 | 3 | 4;
	applicationId: string;
	name: string;
	nameLocalizations: Record<string, string>;
	descriptionLocalizations: Record<string, string>;
	description: string;
	defaultMemberPerms: BigInt;
	permissions: {
		user: boolean;
		roles: Record<string, boolean>;
		channels: Record<string, boolean>;
	};
	nsfw: boolean;
	gpr: number;
	version: string;
	handler: 1 | 2 | 3;
	options: Option[];
	readonly rawJson: Readonly<commandJson>;
	get localuser() {
		if (this.owner instanceof Localuser) {
			return this.owner;
		} else {
			return this.owner.owner;
		}
	}
	constructor(command: commandJson, owner: Localuser | Guild) {
		super(command.id);
		this.rawJson = Object.freeze(structuredClone(command));
		this.owner = owner;
		this.type = command.type;
		this.applicationId = command.application_id;
		this.name = command.name;
		this.nameLocalizations = command.name_localizations || {};
		this.description = command.description;
		this.descriptionLocalizations = command.description_localizations || {};
		this.defaultMemberPerms = BigInt(command.default_member_permissions || "0");
		this.permissions = {
			user: command.permissions?.user || true,
			roles: command.permissions?.roles || {},
			channels: command.permissions?.channels || {},
		};
		command.options ||= [];
		this.options = command.options.map((_) => Option.toOption(_, this));
		this.nsfw = command.nsfw;
		this.gpr = command.global_popularity_rank || 0;
		this.version = command.version;
		this.handler = command.handler || 1;
	}
	get localizedName() {
		return this.nameLocalizations[I18n.lang] || this.name;
	}
	get localizedDescription() {
		return this.descriptionLocalizations[I18n.lang] || this.description;
	}
	similar(search: string) {
		if (search.length === 0) {
			return 0.1;
		}
		const similar = (str: string) => {
			if (str.includes(search)) {
				return search.length / str.length;
			} else if (str.toLowerCase().includes(search.toLowerCase())) {
				return str.length / str.length / 1.4;
			} else {
				return 0;
			}
		};
		return Math.max(
			similar(this.name),
			similar(this.description),
			similar(this.localizedDescription),
			similar(this.localizedName),
		);
	}
	state = new WeakMap<
		Channel,
		(
			| {
					option: Option;
					state: string;
			  }
			| string
		)[]
	>();
	collect(html: HTMLElement, channel: Channel, node?: Node): boolean {
		const states = this.state.get(channel);
		const build: (
			| {
					option: Option;
					state: string;
			  }
			| string
		)[] = [];
		if (!states) return false;

		let gotname = false;
		for (const elm of Array.from(html.childNodes)) {
			if (elm instanceof HTMLElement) {
				if (elm.classList.contains("commandFront")) {
					gotname = true;
					continue;
				}
				const name = elm.getAttribute("commandName");
				const state = states.find((_) => _ instanceof Object && _.option.match(name || ""));
				if (state) {
					build.push(state);
				} else {
					const option = this.options.find((_) => _.match(name || ""));
					if (option) {
						build.push({option, state: ""});
					}
				}
			} else if (elm instanceof Text) {
				build.push(elm.textContent || "");
			}
		}

		if (node instanceof Text) {
			this.searchAtr(node, channel, html);
		}

		if (gotname) {
			this.state.set(channel, build);
		} else {
			this.state.delete(channel);
		}

		return gotname;
	}
	searchAtr(textNode: Text, channel: Channel, Divhtml: HTMLElement) {
		const text = (textNode.textContent || "").trim();
		const states = this.state.get(channel);
		if (!states) {
			this.localuser.MDSearchOptions(
				[],
				"",
				document.getElementById("searchOptions") as HTMLDivElement,
			);
			return;
		}
		const opts = this.options
			.filter((obj) => !states.find((_) => _ instanceof Object && _.option === obj))
			.map((opt) => [opt, opt.similar(text)] as const)
			.filter((_) => _[1])
			.sort((a, b) => a[1] - b[1])
			.slice(0, 6)
			.map((_) => _[0]);
		this.localuser.MDSearchOptions(
			opts.map((opt) => {
				return {
					name: opt.localizedName,
					replace: "",
					otherLogic: () => {
						const html = opt.toHTML("", channel);
						textNode.after(html);
						textNode.remove();
						this.collect(Divhtml, channel);
						console.log(this.state.get(channel));
						focusInput(html);
						return true;
					},
				};
			}),
			"",
			document.getElementById("searchOptions") as HTMLDivElement,
		);
	}
	render(html: HTMLElement, channel: Channel) {
		console.warn(this.rawJson);
		html.innerHTML = "";
		let state = this.state.get(channel);
		if (!state) {
			const req = this.options.filter((_) => _.required);
			state = req.map((option) => ({option, state: ""}));
			this.state.set(channel, state);
		}
		const command = document.createElement("span");
		command.classList.add("commandFront");
		command.textContent = `/${this.localizedName}`;
		command.contentEditable = "false";
		html.append(command);
		let lastElm: HTMLElement | undefined = undefined;
		for (const thing of state) {
			if (typeof thing === "string") {
				html.append(thing);
				continue;
			}
			const {option, state} = thing;
			const opt = option.toHTML(state, channel);
			lastElm = opt;
			html.append(opt);
		}
		if (lastElm) {
			focusInput(lastElm);
		} else {
			const node = new Text();
			node.textContent = "";
			html.append(node);
			focusElm(node, false);
		}
	}
	stateChange(option: Option, channel: Channel, state: string) {
		const states = this.state.get(channel);
		if (!states) return;
		const stateObj = states.find((_) => _ instanceof Object && _.option === option);
		if (stateObj && stateObj instanceof Object) {
			stateObj.state = state;
		}
	}
	getState(option: Option, channel: Channel) {
		const states = this.state.get(channel);
		if (!states) return;
		const stateObj = states.find((_) => _ instanceof Object && _.option === option);
		if (stateObj && stateObj instanceof Object) {
			return stateObj.state;
		}
		return;
	}
	get info() {
		return this.owner.info;
	}

	get headers() {
		return this.owner.headers;
	}

	async submit(html: HTMLElement, channel: Channel) {
		try {
			const nonce = Math.floor(Math.random() * 10 ** 9) + "";
			const states = this.state.get(channel);
			if (!states) {
				return true;
			}
			const opts = states.filter((_) => typeof _ !== "string");
			const options = opts.map(({option, state}) => {
				return option.toJson(state);
			});
			const madeit = new Set(opts.map((_) => _.option));
			for (const thing of this.options) {
				if (thing.required && !madeit.has(thing)) {
					throw new OptionError(I18n.commands.required(thing.localizedName));
				}
			}

			await fetch(this.info.api + "/interactions", {
				method: "POST",
				headers: this.headers,
				body: JSON.stringify({
					type: 2,
					nonce: nonce,
					guild_id: channel.owner.id,
					channel_id: channel.id,
					application_id: this.applicationId,
					session_id: this.localuser.session_id,
					data: {
						application_command: this.rawJson,
						attachments: [],
						id: this.id,
						name: this.name,
						options,
						type: 1,
						version: this.version,
					},
				}),
			});
			this.state.delete(channel);
		} catch (e) {
			if (e instanceof OptionError) {
				const message = e.message;
				const error = document.createElement("span");
				error.classList.add("commandError");
				error.textContent = message;
				html.parentElement?.append(error);
				removeAni(error, 25000);
			}
			return false;
		}
		return true;
	}
}
abstract class Option {
	type: number;
	required: boolean;
	private name: string;
	private description: string;
	private nameLocalizations: Record<string, string>;
	private descriptionLocalizations: Record<string, string>;
	constructor(optionjson: commandOptionJson) {
		this.required = optionjson.required || false;
		this.name = optionjson.name;
		this.nameLocalizations = optionjson.name_localizations || {};
		this.description = optionjson.description;
		this.descriptionLocalizations = optionjson.description_localizations || {};
		this.type = optionjson.type;
	}
	match(str: string) {
		return str === this.name;
	}
	get localizedName() {
		return this.nameLocalizations[I18n.lang] || this.name;
	}
	get localizedDescription() {
		return this.descriptionLocalizations[I18n.lang] || this.description;
	}
	static toOption(optionjson: commandOptionJson, owner: Command): Option {
		switch (optionjson.type) {
			case 3:
				return new StringOption(optionjson, owner);
			default:
				return new ErrorOption(optionjson);
		}
	}
	abstract toHTML(state: string, channel: Channel): HTMLElement;
	imprintName(html: HTMLElement) {
		html.setAttribute("commandName", this.name);
	}
	similar(search: string) {
		if (search.length === 0) {
			return 0.1;
		}
		const similar = (str: string) => {
			if (str.includes(search)) {
				return search.length / str.length;
			} else if (str.toLowerCase().includes(search.toLowerCase())) {
				return str.length / str.length / 1.4;
			} else {
				return 0;
			}
		};
		return Math.max(
			similar(this.name),
			similar(this.description),
			similar(this.localizedDescription),
			similar(this.localizedName),
		);
	}
	toJson(state: string) {
		return {
			value: this.getValue(state),
			type: this.type,
			name: this.name,
		};
	}
	getValue(state: string): string | number {
		return state;
	}
}
class ErrorOption extends Option {
	constructor(optionjson: commandOptionJson) {
		super(optionjson);
		this.required = false;
	}
	toHTML(): HTMLElement {
		const span = document.createElement("span");
		this.imprintName(span);
		span.textContent = "Fermi doesn't impl this yet";
		return span;
	}
}
class OptionError extends Error {
	constructor(reason: string) {
		super(reason);
	}
}
class StringOption extends Option {
	minLeng: number;
	maxLeng: number;
	choices: commandOptionJson["choices"];
	autocomplete: boolean;
	owner: Command;
	constructor(optionjson: commandOptionJson, owner: Command) {
		super(optionjson);
		this.owner = owner;
		this.minLeng = optionjson.min_length || 0;
		this.maxLeng = optionjson.min_length || 6000;
		this.choices = optionjson.choices;
		this.autocomplete = optionjson.autocomplete || false;
	}

	toHTML(state: string, channel: Channel): HTMLElement {
		const div = document.createElement("div");
		div.contentEditable = "false";
		div.classList.add("flexltr", "commandinput");
		this.imprintName(div);

		const label = document.createElement("span");
		label.textContent = this.localizedName + ":";

		const input = document.createElement("input");
		input.type = "text";
		input.value = state;
		input.onkeydown = (e) => {
			if (input.selectionStart === 0 && e.key === "Backspace") {
				const before = !!div.nextSibling;
				const sib = div.nextSibling || div.previousSibling;
				div.remove();
				focusElm(sib as HTMLElement, before);
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		};
		input.onkeyup = (e) => {
			if (input.selectionStart === input.value.length && e.key === "ArrowRight") {
				focusElm(div, false);
			}
			const last = this.owner.getState(this, channel);
			this.owner.stateChange(this, channel, input.value);
			if (this.choices?.length && last !== input.value) {
				this.displayChoices(input, channel);
			}
		};

		div.append(label, input);
		return div;
	}
	displayChoices(input: HTMLInputElement, channel: Channel) {
		const value = input.value;
		if (!this.choices) return;
		const similar = (str?: string | null) => {
			if (str === null || str === undefined) return 0;
			if (str.includes(value)) {
				return value.length / str.length;
			} else if (str.toLowerCase().includes(value.toLowerCase())) {
				return str.length / str.length / 1.4;
			} else {
				return 0;
			}
		};

		const options = (
			value
				? this.choices
						.map(
							(_) =>
								[_, Math.max(similar(_.name), similar(_.name_localizations?.[I18n.lang]))] as const,
						)
						.filter((_) => _[1] !== 0)
						.sort((a, b) => a[1] - b[1])
						.map((_) => _[0])
				: this.choices
		).slice(0, 10);

		this.owner.localuser.MDSearchOptions(
			options.map((elm) => {
				return {
					name: `${elm.name_localizations?.[I18n.lang] || elm.name}`,
					replace: "",
					otherLogic: () => {
						input.value = elm.name_localizations?.[I18n.lang] || elm.name;
						this.owner.stateChange(this, channel, input.value);
						return true;
					},
				};
			}),
			"",
		);
	}
	getValue(state: string) {
		if (this.choices?.length) {
			const choice = this.choices.find((choice) => {
				if (choice.name === state) {
					return true;
				} else if (choice.name_localizations?.[I18n.lang] === state) {
					return true;
				}
				return false;
			});
			if (choice) {
				return choice.value;
			}
			throw new OptionError(I18n.commands.errorNotValid(state || '""', this.localizedName));
		}
		return state;
	}
}
