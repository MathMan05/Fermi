import {Guild} from "../guild.js";
import {I18n} from "../i18n.js";
import {Localuser} from "../localuser.js";
import {MarkDown} from "../markdown.js";
import {Member} from "../member.js";
import {Message} from "../message.js";
import {User} from "../user.js";
import {removeAni} from "../utils/utils.js";
import {
	buttonTypes,
	report,
	reportElements,
	reportMessagePut,
	reportNode,
	reportPut,
	reportTypes,
	reportUserPut,
	reportGuildPut,
	reportGuildDiscovery,
	reportApplicationPut,
} from "./types.js";
interface InfoMap {
	message?: Message;
	user?: User;
	member?: Member;
	failMessage?: string;
	guild?: Guild;
	guild_id?: string;
	dyn_preview?: () => HTMLElement;
	application_id?: string;
}
export class ReportMenu {
	variant: string;
	name: reportTypes;
	owner: Localuser;
	postbackUrl: URL;
	rootNodeId: number;
	successNodeId: number;
	failNodeId: number;
	reportNodes: Record<string, ReportNode>;
	get localuser() {
		return this.owner;
	}
	get info() {
		return this.localuser.info;
	}
	nodes: ReportNode[];
	options: string[] = [];
	infoMap: InfoMap;
	node?: ReportNode;
	constructor(json: report, localuser: Localuser, infoMap: InfoMap) {
		if (json.version !== "1.0") throw new Error("uh oh");
		this.name = json.name;
		this.variant = json.variant;
		this.owner = localuser;
		this.postbackUrl = new URL(json.postback_url, this.info.api);
		this.rootNodeId = json.root_node_id;
		this.successNodeId = json.success_node_id;
		this.failNodeId = json.fail_node_id;
		this.reportNodes = {};
		for (const [id, nodejson] of Object.entries(json.nodes)) {
			this.reportNodes[id] = new ReportNode(nodejson, this);
		}
		const first = this.reportNodes[this.rootNodeId];
		if (!first) throw new Error("unable to find first node");
		this.nodes = [];
		this.infoMap = infoMap;
	}
	div?: HTMLDivElement;
	async spawnMenu() {
		const background = document.createElement("div");
		background.classList.add("background");
		background.onkeydown = (e) => {
			if (e.key == "Escape") {
				removeAni(background);
			}
		};
		background.onclick = () => {
			removeAni(background);
		};

		const div = document.createElement("div");
		div.classList.add("flexttb", "reportMenu");
		background.append(div);
		this.div = div;
		div.onclick = (e) => {
			e.stopImmediatePropagation();
		};
		const first = this.reportNodes[this.rootNodeId];
		first.render();

		document.body.append(background);
	}
	static async makeReport(type: reportTypes, localuser: Localuser, infoMap: InfoMap = {}) {
		const res = await fetch(localuser.info.api + "/reporting/menu/" + type, {
			headers: localuser.headers,
		});
		if (!res.ok) return;
		const json = (await res.json()) as report;
		return new ReportMenu(json, localuser, infoMap);
	}
	async submit(takeToScreen = true) {
		const obj: Omit<reportPut, "name"> = {
			version: "1.0",
			variant: this.variant,
			language: I18n.lang,
			breadcrumbs: [...this.nodes.map((_) => _.id), this.node?.id as number],
			elements: this.gatherElements(),
		};
		let realBody: any;
		switch (this.name) {
			case "message": {
				const message = this.infoMap.message;
				if (!message) throw new Error("Message expected");
				const m: reportMessagePut = {
					...obj,
					name: "message",
					message_id: message.id,
					channel_id: message.channel.id,
				};
				realBody = m;
				break;
			}
			case "user": {
				const user = this.infoMap.user;
				if (!user) throw new Error("User expected");
				const m: reportUserPut = {
					...obj,
					name: "user",
					user_id: user.id,
					guild_id: this.infoMap.member?.guild.id || "@me",
				};
				realBody = m;
				break;
			}
			case "guild": {
				const guild = this.infoMap.guild;
				if (!guild) throw new Error("Guild expected");
				const m: reportGuildPut = {
					...obj,
					name: "guild",
					guild_id: guild.id,
				};
				realBody = m;
				break;
			}
			case "guild_discovery": {
				const id = this.infoMap.guild_id;
				if (!id) throw new Error("id expected");
				const m: reportGuildDiscovery = {
					...obj,
					name: "guild_discovery",
					guild_id: id,
				};
				realBody = m;
				break;
			}
			case "application": {
				const id = this.infoMap.application_id;
				if (!id) throw new Error("id expected");
				const m: reportApplicationPut = {
					...obj,
					name: "application",
					application_id: id,
				};
				realBody = m;
				break;
			}
		}
		const res = await fetch(this.postbackUrl, {
			method: "POST",
			headers: this.localuser.headers,
			body: JSON.stringify(realBody),
		});
		if (res.ok) {
			if (takeToScreen) {
				const suc = this.reportNodes[this.successNodeId];
				if (!suc) throw new Error("unable to find suc node");
				suc.render();
			}
		} else {
			const json = await res.json();
			this.errorNode(json?.message);
		}
	}
	errorNode(message?: string) {
		const error = this.reportNodes[this.failNodeId];
		this.infoMap.failMessage = message;
		if (!error) throw new Error("unable to find suc node");
		error.render();
	}
	gatherElements() {
		let elms: Record<string, string[]> = {};
		for (const node of this.nodes) {
			elms = {
				...node.gatherElements(),
				...elms,
			};
		}
		return elms;
	}
}
class ReportNode {
	owner: ReportMenu;
	key: string;
	header: string;
	subheader: string | null;
	info: string | null;
	buttonType?: buttonTypes;
	buttonTarget?: number;
	elements: ReportElement[];
	reportType: string | null;
	children: [string, number][];
	isMultiSelectRequired: boolean;
	isAutoSubmit: boolean;
	id: number;
	constructor(json: reportNode, owner: ReportMenu) {
		this.owner = owner;
		this.header = json.header;
		this.subheader = json.subheader;
		this.key = json.key;
		this.buttonType = json.button?.type;
		this.buttonTarget = json.button?.target || undefined;
		this.elements = json.elements.map((_) => new ReportElement(_, this));
		this.reportType = json.report_type;
		this.children = json.children;
		this.isMultiSelectRequired = json.is_multi_select_required;
		this.isAutoSubmit = json.is_auto_submit;
		this.id = json.id;
		this.info = json.info;
	}
	div?: HTMLDivElement;
	render() {
		if (this.owner.node) {
			if (this.owner.node.div) removeAni(this.owner.node.div);
		}
		this.owner.node = this;
		const div = document.createElement("div");
		div.classList.add("flexttb", "reportElm");
		this.div = div;
		const title = document.createElement("h2");
		title.textContent = this.header;
		div.append(title);

		if (this.subheader) {
			const sub = document.createElement("h3");
			sub.append(new MarkDown(this.subheader).makeHTML());
			div.append(sub);
		}
		div.append(document.createElement("hr"));
		if (this.info) {
			const info = document.createElement("span");
			info.textContent = this.info;
			div.append(info);
		}
		div.append(...this.elements.map((e) => e.makeHTML()));
		const children = document.createElement("div");
		children.classList.add("reportChildren", "flexttb");
		children.append(
			...this.children.map(([name, id]) => {
				const button = document.createElement("button");
				button.textContent = name;
				button.onclick = () => {
					this.jumpPannel(id, true, name);
				};
				return button;
			}),
			...this.elements
				.filter((_) => _.json.type === "external_link")
				.map(({json}) => {
					if (json.type !== "external_link") return;
					if (json.skip_if_unlocalized && !json.is_localized) return;
					const data = json.data;
					const button = document.createElement("button");
					button.textContent = data.link_text;
					button.onclick = () => {
						window.open(data.url, "_blank")?.focus();
					};
					return button;
				})
				.filter((_) => _ !== undefined),
		);

		const buttonDiv = document.createElement("div");
		buttonDiv.classList.add("flexltr", "reportButtonDiv");
		console.log(this.buttonType);
		switch (this.buttonType) {
			case "next": {
				const next = document.createElement("button");
				next.textContent = I18n.report.next();
				buttonDiv.append(next);
				next.onclick = () => {
					if (this.isMultiSelectRequired) {
						for (const elm of this.elements) {
							if (elm.notFilled()) {
								return;
							}
						}
					}
					if (this.buttonTarget !== undefined) this.jumpPannel(this.buttonTarget, true);
				};
				break;
			}
			case "submit": {
				const submit = document.createElement("button");
				submit.textContent = I18n.report.submit();
				buttonDiv.append(submit);
				submit.onclick = () => {
					this.owner.submit();
				};
				break;
			}
			case "cancel": {
				const cancel = document.createElement("button");
				cancel.textContent = I18n.report.cancel();
				buttonDiv.prepend(cancel);
				cancel.onclick = () => {
					const div = this.owner.div?.parentElement;
					if (div) removeAni(div);
				};
				break;
			}

			default:
				console.log(this.buttonType);
		}
		if (
			this.buttonType !== "cancel" &&
			this.buttonType !== "done" &&
			!this.elements.find((e) => e.json.type === "skip") &&
			this.owner.nodes.length
		) {
			const back = document.createElement("button");
			back.textContent = I18n.report.back();
			buttonDiv.prepend(back);
			back.onclick = () => {
				const pop = this.owner.nodes.pop();
				this.owner.options.pop();
				if (pop) {
					this.jumpPannel(pop.id);
				}
			};
		}

		div.append(children, buttonDiv);
		if (this.isAutoSubmit) this.owner.submit(false);

		this.owner.div?.append(div);
	}
	gatherElements() {
		const elms: Record<string, string[]> = {};
		for (const thing of this.elements) {
			if (thing.options?.length) elms[thing.json.name] = thing.options;
		}
		return elms;
	}

	jumpPannel(id: number, push = false, option = "") {
		if (push) {
			this.owner.nodes.push(this);
			this.owner.options.push(option);
		}
		const next = this.owner.reportNodes[id];
		if (!next) throw new Error("node doesn't exist");
		next.render();
	}
	getSelectStr() {
		let comb: string[] = [];
		for (const elm of this.elements) {
			if (elm.optionReal.length) {
				comb.push(...elm.optionReal);
			}
		}
		console.log(comb, this);
		return new Intl.ListFormat(I18n.lang).format(comb);
	}
}
class ReportElement {
	json: reportElements;
	owner: ReportNode;
	options: string[] = [];
	optionReal: string[] = [];
	constructor(json: reportElements, owner: ReportNode) {
		this.json = json;
		this.owner = owner;
	}
	makeHTML() {
		const div = document.createElement("div");
		div.classList.add("reportOption", "flexttb");
		const json = this.json;
		if (json.skip_if_unlocalized && !json.is_localized) {
			return div;
		}
		const map = this.owner.owner.infoMap;
		switch (json.type) {
			case "message_preview": {
				const m = this.owner.owner.infoMap.message;
				if (m) {
					div.append(m.buildhtml(undefined, true));
				} else {
					//Apparently discord is dumb and will use in menus without messages
					//div.append("You should never see this");
				}
				break;
			}
			case "breadcrumbs": {
				const title = document.createElement("span");
				title.textContent = I18n.report.summary();
				div.append(title);
				const ul = document.createElement("ul");

				for (let i = 0; i < this.owner.owner.options.length; i++) {
					const str = this.owner.owner.options[i];
					if (str) {
						const li = document.createElement("li");
						li.textContent = str;
						ul.append(li);
					}
					const op = this.owner.owner.nodes[i];
					if (op) {
						const str = op.getSelectStr();
						if (str) {
							const li = document.createElement("li");
							li.textContent = str;
							ul.append(li);
						}
					}
				}

				div.append(ul);
				break;
			}
			case "ignore_users":
			case "share_with_parents": {
				//TODO implement when spacebar implements these
				break;
			}
			case "block_users": {
				const user = map.message?.author || map.user;
				if (!user) break;
				const button = document.createElement("button");
				button.textContent = I18n.report.blockUser();
				div.append(button);
				button.onclick = () => {
					user.block();
				};
				break;
			}
			case "mute_users": {
				const message = map.message;
				if (!message) break;
				if (!message.guild.member.hasPermission("MUTE_MEMBERS")) break;
				(async () => {
					const member = await Member.resolveMember(message.author, message.guild);
					if (!member) return;

					const button = document.createElement("button");
					button.textContent = I18n.report.timeout();
					div.append(button);
					button.onclick = () => {
						member.timeout();
					};
				})();

				break;
			}
			case "app_preview": {
				//TODO figure out what this is supposed to be
				break;
			}
			case "user_preview": {
				const user = map.user;
				if (!user) break;
				div.append(user.createWidget(map.member?.guild));
				break;
			}
			case "external_link":
			case "skip": {
				break;
			}
			case "checkbox": {
				div.classList.add("friendGroupSelect");
				for (const [subName, name, desc] of json.data) {
					const elm = document.createElement("div");
					elm.classList.add("flexltr", "checkCard");
					const check = document.createElement("input");
					check.type = "checkbox";
					check.checked = this.options.includes(subName);
					check.onclick = (e) => e.stopImmediatePropagation();
					elm.onclick = (e) => {
						e.stopImmediatePropagation();
						check.click();
					};
					check.onchange = () => {
						if (check.checked) {
							this.options.push(subName);
						} else {
							this.options = this.options.filter((_) => _ !== subName);
						}
						this.optionReal = this.options.map(
							(_) => json.data.find((e) => e[0] === _)?.[1] as string,
						);
					};

					const names = document.createElement("div");
					names.classList.add("flexttb");
					const nameElm = document.createElement("span");
					nameElm.textContent = name;
					names.append(nameElm);
					if (desc) {
						const descElm = document.createElement("span");
						descElm.textContent = desc;
						names.append(descElm);
					}
					elm.append(names, check);
					div.append(elm);
				}
				break;
			}
			case "fail": {
				if (!this.owner.owner.infoMap.failMessage) break;
				const span = document.createElement("span");
				span.textContent = this.owner.owner.infoMap.failMessage;
				div.append(span);
				break;
			}
			case "text": {
				const h4 = document.createElement("h4");
				h4.textContent = json.data.header;
				const p = document.createElement("p");
				p.textContent = json.data.body;
				div.append(h4, p);
				break;
			}
			case "guild_preview": {
				const guild = map.guild;
				if (!guild) break;
				const guildDiv = document.createElement("div");
				guildDiv.classList.add("flexltr");
				guildDiv.append(guild.generateGuildIcon(false));
				const title = document.createElement("h4");
				title.textContent = guild.properties.name;
				guildDiv.append(title);
				div.append(guildDiv);
				break;
			}
			case "guild_discovery_preview": {
				const dyn = map.dyn_preview;
				if (!dyn) break;
				div.append(dyn());
				break;
			}
			default:
				console.log(json);
				div.textContent = this.json.type;
		}

		return div;
	}
	notFilled() {
		switch (this.json.type) {
			case "checkbox":
				return !this.options.length;
			default:
				return false;
		}
	}
}
