import {Localuser} from "./localuser.js";
import {Channel} from "./channel.js";
import {Emoji} from "./emoji.js";
import {Guild} from "./guild.js";
import {I18n} from "./i18n.js";
import {Dialog} from "./settings.js";

class MarkDown {
	static emoji?: typeof Emoji;
	txt: string[];
	keep: boolean;
	stdsize: boolean;
	owner: Localuser | Channel | void;
	info: Localuser["info"] | void = undefined;
	constructor(
		text: string | string[],
		owner: MarkDown["owner"],
		{keep = false, stdsize = false} = {},
	) {
		if (typeof text === typeof "") {
			this.txt = (text as string).split("");
		} else {
			this.txt = text as string[];
		}
		if (this.txt === undefined) {
			this.txt = [];
		}
		if (owner) {
			this.info = owner.info;
		}
		this.keep = keep;
		this.owner = owner;
		this.stdsize = stdsize;
	}
	get channel() {
		if (!this.owner) return;
		if ("user" in this.owner) {
			return;
		} else if (this.owner) {
			return this.owner;
		}
		return null;
	}
	get localuser() {
		if (!this.owner) return;
		if ("user" in this.owner) {
			return this.owner;
		} else if (this.owner) {
			return this.owner.localuser;
		}
		return null;
	}
	get rawString() {
		return this.txt.join("");
	}
	get textContent() {
		return this.makeHTML().textContent;
	}
	static getText() {
		return text;
	}
	makeHTML({keep = this.keep, stdsize = this.stdsize} = {}) {
		return this.markdown(this.txt, {keep, stdsize});
	}
	markdown(text: string | string[], {keep = false, stdsize = false} = {}) {
		if (!keep && !stdsize) {
			let str: string;
			if (text instanceof Array) {
				str = text.join("");
			} else {
				str = text;
			}
			const span = document.createElement("span");
			span.classList.add("md-emoji", "bigemojiUni");

			const matched = str.match(/^((<a?:[A-Za-z\d_]*:\d*>|([^\da-zA-Z <>])) *){1,3}$/u);
			if (matched) {
				const map = [...str.matchAll(/<a?:[A-Za-z\d_]*:\d*>|[^\da-zA-Z <>]+/gu).map(([_]) => _)];
				const seg = new Intl.Segmenter("en-US", {granularity: "grapheme"});
				const invalid = map.find((str) => {
					if (str.length > 10) return false;
					if (Array.from(seg.segment(str)).length !== 1) return true;
					return false;
				});
				if (!invalid) {
					for (const match of map) {
						if (match.length > 10) {
							const parts = match.match(/^<(a)?:\w+:(\d{10,30})>$/);
							if (parts && parts[2]) {
								const owner = this.channel ? this.channel.guild : this.localuser;
								if (!owner) continue;
								const emoji = new Emoji(
									{name: match, id: parts[2], animated: Boolean(parts[1])},
									owner,
								);
								span.appendChild(emoji.getHTML(true, !keep));

								continue;
							}
						} else {
							span.append(match);
						}
					}
					return span;
				}
			}
		}
		let txt: string[];
		if (typeof text === typeof "") {
			txt = (text as string).split("");
		} else {
			txt = text as string[];
		}
		if (txt === undefined) {
			txt = [];
		}
		const span = document.createElement("span");
		let current = document.createElement("span");
		function appendcurrent() {
			if (current.innerHTML !== "") {
				span.append(current);
				current = document.createElement("span");
			}
		}
		function getCurLast(): Node | undefined {
			return Array.from(span.childNodes).at(-1);
		}
		for (let i = 0; i < txt.length; i++) {
			if (txt[i] === "\n" || i === 0) {
				let first = i === 0;
				if (first) {
					i--;
				}
				let element: HTMLElement = document.createElement("span");
				let keepys = "";

				if (txt[i + 1] === "#") {
					if (txt[i + 2] === "#") {
						if (txt[i + 3] === "#" && txt[i + 4] === " ") {
							element = document.createElement("h3");
							keepys = "### ";
							i += 5;
						} else if (txt[i + 3] === " ") {
							element = document.createElement("h2");
							element.classList.add("h2md");
							keepys = "## ";
							i += 4;
						}
					} else if (txt[i + 2] === " ") {
						element = document.createElement("h1");
						keepys = "# ";
						i += 3;
					}
				} else if (txt[i + 1] === ">" && txt[i + 2] === " ") {
					element = document.createElement("div");
					const line = document.createElement("div");
					line.classList.add("quoteline");
					element.append(line);
					element.classList.add("quote");
					keepys = "> ";
					i += 3;
				}
				if (keepys) {
					appendcurrent();
					if (!first && !stdsize) {
						span.appendChild(document.createElement("br"));
					}
					const build: string[] = [];
					for (; txt[i] !== "\n" && txt[i] !== undefined; i++) {
						build.push(txt[i]);
					}
					try {
						if (stdsize) {
							element = document.createElement("span");
						}
						if (keep) {
							element.append(keepys);
						}
						element.appendChild(this.markdown(build, {keep, stdsize}));
						span.append(element);
					} finally {
						i -= 1;
						continue;
					}
				}
				const bullet = new Set("*+- ");
				if (bullet.has(txt[i + 1])) {
					let list = document.createElement("ul");
					let depth = 0;
					while (true) {
						let j = i + 1;
						let build = "";
						for (; txt[j] === " "; j++) {
							build += txt[j];
						}
						build += txt[j];
						j++;
						build += txt[j];
						j++;
						const match = build.match(/( *)[+*-] $/);
						if (match) {
							const arr: string[] = [];
							for (; txt[j] && txt[j] !== "\n"; j++) {
								arr.push(txt[j]);
							}
							i = j;
							const line = this.markdown(arr);
							if (keep) {
								if (!first) {
									current.textContent += "\n";
								} else {
									first = false;
								}
								current.textContent += build;
								appendcurrent();
								span.append(line);
								depth = 2;
							} else {
								const curDepth = 0 | (match[1].length / 2);
								if (curDepth > depth) {
									depth++;
									const newlist = document.createElement("ul");
									list.append(newlist);
									list = newlist;
								} else {
									while (curDepth < depth) {
										depth--;
										list = list.parentElement as HTMLUListElement;
									}
								}
								const li = document.createElement("li");
								li.append(line);
								list.append(li);
							}
						} else {
							break;
						}
						if (!txt[j]) {
							break;
						}
					}
					if (depth !== 0 || list.children.length) {
						if (!keep) {
							while (0 < depth) {
								depth--;
								list = list.parentElement as HTMLUListElement;
							}
							appendcurrent();
							span.append(list);
						}
						i--;
						continue;
					}
				}
				if (first) {
					i++;
				}
			}
			if (txt[i] === "\\") {
				const chatset = new Set("\\`{}[]()<>*_#+-.!|@".split(""));
				if (chatset.has(txt[i + 1])) {
					if (keep) {
						current.textContent += txt[i];
					}
					current.textContent += txt[i + 1];
					i++;
					continue;
				}
			}
			if (txt[i] === "\n") {
				if (!stdsize) {
					const last = getCurLast();
					if (last instanceof HTMLElement && last.contentEditable === "false") {
						span.append(document.createElement("span"));
					}
					appendcurrent();
					if (keep) {
						span.append(new Text("\n"));
					} else {
						span.append(document.createElement("br"));
					}
				}
				continue;
			}
			if (txt[i] === "`") {
				let count = 1;
				if (txt[i + 1] === "`") {
					count++;
					if (txt[i + 2] === "`") {
						count++;
					}
				}
				let build = "";
				if (keep) {
					build += "`".repeat(count);
				}
				let find = 0;
				let j = i + count;
				let init = true;
				for (; txt[j] !== undefined && (txt[j] !== "\n" || count === 3) && find !== count; j++) {
					if (txt[j] === "`") {
						find++;
					} else {
						if (find !== 0) {
							build += "`".repeat(find);
							find = 0;
						}
						if (init && count === 3) {
							if (txt[j] === " " || txt[j] === "\n") {
								init = false;
							}
							if (keep) {
								build += txt[j];
							}
							continue;
						}
						build += txt[j];
					}
				}
				if (stdsize) {
					build = build.replaceAll("\n", "");
				}
				if (find === count) {
					appendcurrent();
					i = j;
					if (keep) {
						build += "`".repeat(find);
					}
					if (count !== 3 && !stdsize) {
						const samp = document.createElement("samp");
						samp.textContent = build;
						span.appendChild(samp);
					} else {
						const pre = document.createElement("pre");
						if (build.at(-1) === "\n") {
							build = build.substring(0, build.length - 1);
						}
						if (txt[i] === "\n") {
							i++;
						}
						pre.textContent = build;
						span.appendChild(pre);
					}
					i--;
					continue;
				}
			}

			if (txt[i] === "*") {
				let count = 1;
				if (txt[i + 1] === "*") {
					count++;
					if (txt[i + 2] === "*") {
						count++;
					}
				}
				let build: string[] = [];
				let find = 0;
				let j = i + count;
				for (; txt[j] !== undefined && find !== count; j++) {
					if (txt[j] === "*") {
						find++;
					} else {
						build.push(txt[j]);
						if (find !== 0) {
							build = build.concat(new Array(find).fill("*"));
							find = 0;
						}
					}
				}
				if (find === count && (count != 1 || txt[i + 1] !== " ")) {
					appendcurrent();
					i = j;

					const stars = "*".repeat(count);
					if (count === 1) {
						const i = document.createElement("i");
						if (keep) {
							i.append(stars);
						}
						i.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							i.append(stars);
						}
						span.appendChild(i);
					} else if (count === 2) {
						const b = document.createElement("b");
						if (keep) {
							b.append(stars);
						}
						b.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							b.append(stars);
						}
						span.appendChild(b);
					} else {
						const b = document.createElement("b");
						const i = document.createElement("i");
						if (keep) {
							b.append(stars);
						}
						b.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							b.append(stars);
						}
						i.appendChild(b);
						span.appendChild(i);
					}
					i--;
					continue;
				}
			}

			if (txt[i] === "_") {
				let count = 1;
				if (txt[i + 1] === "_") {
					count++;
					if (txt[i + 2] === "_") {
						count++;
					}
				}
				let build: string[] = [];
				let find = 0;
				let j = i + count;
				for (; txt[j] !== undefined && find !== count; j++) {
					if (txt[j] === "_") {
						find++;
					} else {
						build.push(txt[j]);
						if (find !== 0) {
							build = build.concat(new Array(find).fill("_"));
							find = 0;
						}
					}
				}
				if (
					find === count &&
					(count != 1 || txt[j] === " " || txt[j] === "\n" || txt[j] === undefined)
				) {
					appendcurrent();
					i = j;
					const underscores = "_".repeat(count);
					if (count === 1) {
						const i = document.createElement("i");
						if (keep) {
							i.append(underscores);
						}
						i.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							i.append(underscores);
						}
						span.appendChild(i);
					} else if (count === 2) {
						const u = document.createElement("u");
						if (keep) {
							u.append(underscores);
						}
						u.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							u.append(underscores);
						}
						span.appendChild(u);
					} else {
						const u = document.createElement("u");
						const i = document.createElement("i");
						if (keep) {
							i.append(underscores);
						}
						i.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							i.append(underscores);
						}
						u.appendChild(i);
						span.appendChild(u);
					}
					i--;
					continue;
				}
			}

			if (txt[i] === "~" && txt[i + 1] === "~") {
				const count = 2;
				let build: string[] = [];
				let find = 0;
				let j = i + 2;
				for (; txt[j] !== undefined && find !== count; j++) {
					if (txt[j] === "~") {
						find++;
					} else {
						build.push(txt[j]);
						if (find !== 0) {
							build = build.concat(new Array(find).fill("~"));
							find = 0;
						}
					}
				}
				if (find === count) {
					appendcurrent();
					i = j - 1;
					const tildes = "~~";
					if (count === 2) {
						const s = document.createElement("s");
						if (keep) {
							s.append(tildes);
						}
						s.appendChild(this.markdown(build, {keep, stdsize}));
						if (keep) {
							s.append(tildes);
						}
						span.appendChild(s);
					}
					continue;
				}
			}
			if (txt[i] === "|" && txt[i + 1] === "|") {
				const count = 2;
				let build: string[] = [];
				let find = 0;
				let j = i + 2;
				for (; txt[j] !== undefined && find !== count; j++) {
					if (txt[j] === "|") {
						find++;
					} else {
						build.push(txt[j]);
						if (find !== 0) {
							build = build.concat(new Array(find).fill("~"));
							find = 0;
						}
					}
				}
				if (find === count) {
					appendcurrent();
					i = j - 1;
					const pipes = "||";
					if (count === 2) {
						const j = document.createElement("j");
						if (keep) {
							j.append(pipes);
						}
						j.appendChild(this.markdown(build, {keep, stdsize}));
						j.classList.add("spoiler");
						j.onclick = MarkDown.unspoil;
						if (keep) {
							j.click();
						}
						if (keep) {
							j.append(pipes);
						}
						span.appendChild(j);
					}
					continue;
				}
			}
			if (
				!keep &&
				txt[i] === "h" &&
				txt[i + 1] === "t" &&
				txt[i + 2] === "t" &&
				txt[i + 3] === "p"
			) {
				let build = "http";
				let j = i + 4;
				const endchars = new Set("\\<>|[] \n(){}");
				for (; txt[j] !== undefined; j++) {
					const char = txt[j];
					if (endchars.has(char)) {
						break;
					}
					build += char;
				}
				if (URL.canParse(build)) {
					appendcurrent();
					const a = document.createElement("a");
					//a.href=build;

					a.textContent = build;
					if (!stdsize) {
						const replace = MarkDown.safeLink(a, build, this.localuser);
						if (replace) {
							a.textContent = replace;
							a.classList.add("mentionMD");
						}
						a.target = "_blank";
					}

					i = j - 1;
					span.appendChild(a);
					continue;
				}
			}
			if (txt[i] === "@") {
				let j = i + 1;
				let everyone = true;
				for (const char of "everyone") {
					if (char !== txt[j]) {
						everyone = false;
						break;
					}
					j++;
				}
				let here = false;
				if (!everyone) {
					here = true;
					for (const char of "here") {
						if (char !== txt[j]) {
							here = false;
							break;
						}
						j++;
					}
				}
				if (everyone || here) {
					i = j - 1;
					const mention = document.createElement("span");
					mention.classList.add("mentionMD");
					mention.contentEditable = "false";
					mention.textContent = everyone ? "@everyone" : "@here";
					appendcurrent();
					span.appendChild(mention);
					mention.setAttribute("real", everyone ? `@everyone` : "@here");
					continue;
				}
			}
			if (txt[i] === "<") {
				if ((txt[i + 1] === "@" || txt[i + 1] === "#") && this.localuser) {
					let id = "";
					const role = txt[i + 1] === "@" && txt[i + 2] === "&";
					let j = i + 2 + +role;
					const numbers = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
					for (; txt[j] !== undefined; j++) {
						const char = txt[j];
						if (!numbers.has(char)) {
							break;
						}
						id += char;
					}

					if (txt[j] === ">") {
						appendcurrent();
						const last = getCurLast();
						if (
							last instanceof HTMLBRElement ||
							(last instanceof HTMLElement && last.contentEditable === "false")
						) {
							span.append(document.createElement("span"));
						}
						const mention = document.createElement("span");
						mention.classList.add("mentionMD");
						mention.contentEditable = "false";
						const char = txt[i + 1];
						i = j;
						switch (char) {
							case "@":
								if (role) {
									if (this.channel) {
										const role = this.channel.guild.roleids.get(id);
										if (role) {
											mention.textContent = `@${role.name}`;
											mention.style.color = `var(--role-${role.id})`;
										} else {
											mention.textContent = I18n.guild.unknownRole();
										}
									}
								} else {
									(async () => {
										mention.textContent = I18n.userping.resolving();
										const user = await this.localuser?.getUser(id);
										if (user) {
											mention.textContent = `@${user.name}`;
											let guild: null | Guild = null;
											if (this.channel) {
												guild = this.channel.guild;
											}
											if (!keep) {
												user.bind(mention, guild, true, stdsize ? "none" : "left");
											}
											if (guild) {
												guild.resolveMember(user).then((member) => {
													if (member) {
														mention.textContent = `@${member.name}`;
													}
												});
											}
										} else {
											mention.textContent = I18n.userping.unknown();
										}
									})();
								}
								break;
							case "#":
								const channel = this.localuser.channelids.get(id);
								if (channel) {
									mention.textContent = `#${channel.name}`;
									if (!keep && !stdsize) {
										mention.onclick = (_) => {
											if (!this.localuser) return;
											this.localuser.goToChannel(id);
										};
									}
								} else {
									mention.textContent = "#unknown";
								}
								break;
						}
						span.appendChild(mention);
						mention.setAttribute("real", `<${char}${role ? "&" : ""}${id}>`);
						continue;
					}
				} else {
					let j = i + 1;
					let build = "";
					const invalid = new Set([">", "<"]);
					for (; txt[j] !== undefined; j++) {
						const char = txt[j];
						if (invalid.has(char)) {
							break;
						}
						build += char;
					}
					if (URL.canParse(build) && txt[j] === ">") {
						const url = new URL(build);
						const allowedprotocols = new Set(["https:", "http:"]);
						if (allowedprotocols.has(url.protocol)) {
							i = j;

							if (keep) {
								current.textContent += `<${build}>`;
							} else {
								appendcurrent();
								const a = document.createElement("a");
								if (!stdsize) {
									const text = MarkDown.safeLink(a, build, this.localuser);
									if (text) {
										a.textContent = text;
										a.classList.add("mentionMD");
									} else {
										a.textContent = build;
									}
									a.target = "_blank";
								}
								span.appendChild(a);
							}
							continue;
						}
					}
				}
			}
			if (txt[i] === "<" && txt[i + 1] === "t" && txt[i + 2] === ":") {
				let found = false;
				const build = ["<", "t", ":"];
				let j = i + 3;
				for (; txt[j] !== void 0; j++) {
					build.push(txt[j]);

					if (txt[j] === ">") {
						found = true;
						break;
					}
				}

				if (found) {
					appendcurrent();
					i = j;
					const parts = build
						.join("")
						.match(/^<t:([0-9]{1,16})(:([tTdDfFR]))?>$/) as RegExpMatchArray;
					const dateInput = new Date(Number.parseInt(parts[1]) * 1000);
					let time = "";
					if (Number.isNaN(dateInput.getTime())) time = build.join("");
					else {
						if (parts[3] === "d")
							time = dateInput.toLocaleString(void 0, {
								day: "2-digit",
								month: "2-digit",
								year: "numeric",
							});
						else if (parts[3] === "D")
							time = dateInput.toLocaleString(void 0, {
								day: "numeric",
								month: "long",
								year: "numeric",
							});
						else if (!parts[3] || parts[3] === "f")
							time =
								dateInput.toLocaleString(void 0, {
									day: "numeric",
									month: "long",
									year: "numeric",
								}) +
								" " +
								dateInput.toLocaleString(void 0, {
									hour: "2-digit",
									minute: "2-digit",
								});
						else if (parts[3] === "F")
							time =
								dateInput.toLocaleString(void 0, {
									day: "numeric",
									month: "long",
									year: "numeric",
									weekday: "long",
								}) +
								" " +
								dateInput.toLocaleString(void 0, {
									hour: "2-digit",
									minute: "2-digit",
								});
						else if (parts[3] === "t")
							time = dateInput.toLocaleString(void 0, {
								hour: "2-digit",
								minute: "2-digit",
							});
						else if (parts[3] === "T")
							time = dateInput.toLocaleString(void 0, {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							});
						else if (parts[3] === "R")
							//TODO make this a little less bad
							time =
								Math.round((Date.now() - Number.parseInt(parts[1]) * 1000) / 1000 / 60) +
								" minutes ago";
					}

					const timeElem = document.createElement("span");
					timeElem.classList.add("markdown-timestamp");
					timeElem.textContent = time;
					span.appendChild(timeElem);
					continue;
				}
			}

			if (
				txt[i] === "<" &&
				(txt[i + 1] === ":" || (txt[i + 1] === "a" && txt[i + 2] === ":" && this.owner))
			) {
				const Emoji = MarkDown.emoji;
				let found = false;
				const build = txt[i + 1] === "a" ? ["<", "a", ":"] : ["<", ":"];
				let j = i + build.length;
				for (; txt[j] !== void 0; j++) {
					build.push(txt[j]);

					if (txt[j] === ">") {
						found = true;
						break;
					}
				}

				if (found && Emoji) {
					const buildjoin = build.join("");
					const parts = buildjoin.match(/^<(a)?:\w+:(\d{10,30})>$/);
					if (parts && parts[2]) {
						appendcurrent();
						i = j;
						const isEmojiOnly = txt.join("").trim() === buildjoin.trim() && !stdsize;
						const owner = this.channel ? this.channel.guild : this.localuser;
						if (!owner) continue;
						const emoji = new Emoji(
							{name: buildjoin, id: parts[2], animated: Boolean(parts[1])},
							owner,
						);
						span.appendChild(emoji.getHTML(isEmojiOnly, !keep));

						continue;
					}
				}
			}

			if (txt[i] == "[" && !keep) {
				let partsFound = 0;
				let j = i + 1;
				const build = ["["];
				for (; txt[j] !== void 0; j++) {
					build.push(txt[j]);

					if (partsFound === 0 && txt[j] === "]") {
						if (
							(txt[j + 1] === "(" &&
								txt[j + 2] === "h" &&
								txt[j + 3] === "t" &&
								txt[j + 4] === "t" &&
								txt[j + 5] === "p" &&
								(txt[j + 6] === "s" || txt[j + 6] === ":")) ||
							(txt[j + 1] === "(" &&
								txt[j + 2] === "<" &&
								txt[j + 3] === "h" &&
								txt[j + 4] === "t" &&
								txt[j + 5] === "t" &&
								txt[j + 6] === "p" &&
								(txt[j + 7] === "s" || txt[j + 7] === ":"))
						) {
							partsFound++;
						} else {
							break;
						}
					} else if (partsFound === 1 && txt[j] === ")") {
						partsFound++;
						break;
					}
				}
				if (partsFound === 2) {
					appendcurrent();

					const parts = build.join("").match(/^\[(.+)\]\(<?(https?:.+?)>?( ('|").+('|"))?\)$/);
					if (parts) {
						const linkElem = document.createElement("a");

						if (URL.canParse(parts[2])) {
							i = j;
							if (!stdsize) {
								MarkDown.safeLink(linkElem, parts[2]);
								linkElem.append(this.markdown(parts[1], {keep, stdsize}));
								linkElem.target = "_blank";
								linkElem.rel = "noopener noreferrer";
							}
							linkElem.title =
								(parts[3] ? parts[3].substring(2, parts[3].length - 1) + "\n\n" : "") + parts[2];
							span.appendChild(linkElem);

							continue;
						}
					}
				}
			}
			current.textContent += txt[i];
		}
		appendcurrent();
		const last = getCurLast();
		if (last && last instanceof Text && last.textContent === "\n" && Error.prototype.stack === "") {
			span.append(current);
		}
		if (
			last &&
			last instanceof HTMLElement &&
			(last.contentEditable === "false" || last instanceof HTMLBRElement)
		) {
			span.append(current);
		}
		return span;
	}
	static unspoil(e: any): void {
		e.target.classList.remove("spoiler");
		e.target.classList.add("unspoiled");
	}
	onUpdate: (upto: string, pre: boolean) => unknown = () => {};
	box = new WeakRef(document.createElement("div"));
	giveBox(box: HTMLDivElement, onUpdate: (upto: string, pre: boolean) => unknown = () => {}) {
		this.box = new WeakRef(box);
		this.onUpdate = onUpdate;
		box.addEventListener("keydown", (_) => {
			if (_.isComposing) return;
			if (Error.prototype.stack !== "") return;
			if (_.key === "Enter") {
				const selection = window.getSelection() as Selection;
				if (!selection) return;
				const range = selection.getRangeAt(0);
				const node = new Text("\n");
				range.insertNode(node);
				const g = node.nextSibling;
				if (g) range.setStart(g, 0);
				_.preventDefault();
				return;
			}
		});
		let prevcontent = "";
		box.onkeyup = (_) => {
			if (_.isComposing) return;
			let content = MarkDown.gatherBoxText(box);
			if (content === "\n") content = "";
			if (content !== prevcontent) {
				prevcontent = content;
				this.txt = content.split("");
				this.boxupdate(undefined, undefined, undefined, _.key === "Backspace");
				MarkDown.gatherBoxText(box);
			}
		};
		box.addEventListener("compositionend", () => {
			let content = MarkDown.gatherBoxText(box);
			if (content === "\n") content = "";
			if (content !== prevcontent) {
				prevcontent = content;
				this.txt = content.split("");
				this.boxupdate(undefined, undefined, undefined, false);
				MarkDown.gatherBoxText(box);
			}
		});
		box.onpaste = (_) => {
			if (!_.clipboardData) return;
			const types = _.clipboardData.types;
			console.log(types);
			if (types.includes("Files")) {
				_.preventDefault();
				return;
			}
			const selection = window.getSelection() as Selection;

			if (types.includes("text/html")) {
				const data = _.clipboardData.getData("text/html");
				const html = new DOMParser().parseFromString(data, "text/html");
				const txt = MarkDown.gatherBoxText(html.body);
				console.log(txt);
				const rstr = selection.toString();
				saveCaretPosition(box)?.();
				const content = this.textContent;
				if (content) {
					const [_first, end] = content.split(text);
					if (rstr) {
						const tw = text.split(rstr);
						tw.pop();
						text = tw.join("");
					}
					const boxText = text + txt + end;
					box.textContent = boxText;
					const len = text.length + txt.length;
					text = boxText;
					this.txt = text.split("");
					this.boxupdate(len, false, 0);
				} else {
					box.textContent = txt;
					text = txt;
					this.txt = text.split("");
					this.boxupdate(txt.length, false, 0);
				}
				_.preventDefault();
			} else if (types.includes("text/plain")) {
				//Allow the paste like normal
			} else {
				_.preventDefault();
			}
		};
	}
	customBox?: [(arg1: string) => HTMLElement, (arg1: HTMLElement) => string];
	clearCustom() {
		this.customBox = undefined;
	}
	setCustomBox(
		stringToHTML: (arg1: string) => HTMLElement,
		HTMLToString = MarkDown.gatherBoxText.bind(MarkDown),
	) {
		this.customBox = [stringToHTML, HTMLToString];
	}
	boxEnabled = true;
	boxupdate(
		offset = 0,
		allowLazy = true,
		computedLength: void | number = undefined,
		backspace = false,
	) {
		if (!this.boxEnabled) return;
		const box = this.box.deref();
		if (!box) return;
		let restore: undefined | ((backspace: boolean) => void);
		if (this.customBox) {
			restore = saveCaretPosition(box, offset, this.customBox[1], computedLength);
		} else {
			restore = saveCaretPosition(
				box,
				offset,
				MarkDown.gatherBoxText.bind(MarkDown),
				computedLength,
			);
		}

		if (this.customBox) {
			//TODO maybe the custom logic applies here as well, but that's a later thing
			box.innerHTML = "";
			box.append(this.customBox[0](this.rawString));
		} else {
			//console.time();
			const html = this.makeHTML({keep: true});
			const condition =
				html.childNodes.length == 1 &&
				html.childNodes[0].childNodes.length === 1 &&
				html.childNodes[0].childNodes[0];
			//console.log(box.cloneNode(true), html.cloneNode(true));
			//TODO this may be slow, may want to check in on this in the future if it is
			if ((!box.hasChildNodes() || html.isEqualNode(Array.from(box.childNodes)[0])) && allowLazy) {
				//console.log("no replace needed");
			} else {
				if (
					!(box.childNodes.length === 1 && box.childNodes[0] instanceof Text && condition) ||
					!allowLazy
				) {
					box.innerHTML = "";
					box.append(html);
				} else {
					//console.log("empty replace not happened");
				}
			}
			//console.timeEnd();
		}
		if (restore) {
			restore(backspace);
		}
		this.onUpdate(text, formatted);
	}
	static gatherBoxText(element: HTMLElement): string {
		if (element.tagName.toLowerCase() === "img") {
			return (element as HTMLImageElement).alt;
		}
		if (element.tagName.toLowerCase() === "br") {
			return "\n";
		}
		if (element.hasAttribute("real")) {
			return element.getAttribute("real") as string;
		}
		if (element.tagName.toLowerCase() === "pre" || element.tagName.toLowerCase() === "samp") {
			formatted = true;
		} else {
			formatted = false;
		}
		let build = "";
		const arr = Array.from(element.childNodes);
		for (const thing of arr) {
			if (thing instanceof Text) {
				const text = thing.textContent;
				build += text;

				continue;
			}
			const text = this.gatherBoxText(thing as HTMLElement);
			if (text) {
				build += text;
			}
		}
		return build;
	}
	static trustedDomains = this.getTrusted();
	static getTrusted() {
		const domains = localStorage.getItem("trustedDomains");
		if (domains) {
			return new Set(JSON.parse(domains) as string[]);
		}
		return new Set([location.host, "fermi.chat", "blog.fermi.chat"]);
	}
	static saveTrusted(remove = false) {
		if (!remove) {
			this.trustedDomains = this.trustedDomains.union(this.getTrusted());
		}
		const domains = JSON.stringify([...this.trustedDomains]);

		localStorage.setItem("trustedDomains", domains);
	}
	static safeLink(
		elm: HTMLElement,
		url: string,
		localuser: Localuser | null = null,
	): string | void {
		if (elm instanceof HTMLAnchorElement) {
			elm.rel = "noopener noreferrer";
		}
		if (URL.canParse(url)) {
			const Url = new URL(url);
			if (localuser) {
				const [_, _2, ...path] = Url.pathname.split("/");

				const guild = localuser.guildids.get(path[0]);
				const channel = guild?.getChannel(path[1]);
				if (channel) {
					const message = isNaN(+path[2]) ? undefined : path[2];
					elm.onmouseup = (_) => {
						channel.getHTML(true, true, message);
					};
					if (message) {
						return I18n.messageLink(channel.name);
					} else {
						return I18n.channelLink(channel.name);
					}
				}
			}
			if (elm instanceof HTMLAnchorElement && this.trustedDomains.has(Url.host)) {
				elm.href = url;
				elm.target = "_blank";
				return;
			}
			elm.onmouseup = (_) => {
				let parent: HTMLElement | null = elm;
				while (parent) {
					if (parent.classList.contains("unspoiled")) break;
					if (parent.classList.contains("spoiler")) return;
					parent = parent.parentElement;
				}
				if (_.button === 2) return;
				function open() {
					const proxy = window.open(url, "_blank");
					if (proxy && _.button === 1) {
						proxy.focus();
					} else if (proxy) {
						window.focus();
					}
				}
				if (this.trustedDomains.has(Url.host)) {
					open();
				} else {
					const full = new Dialog("");
					full.options.addTitle(I18n.leaving());
					full.options.addText(I18n.goingToURL(Url.host));
					const options = full.options.addOptions("", {ltr: true});
					options.addButtonInput("", I18n.nevermind(), () => full.hide());
					options.addButtonInput("", I18n.goThere(), () => {
						open();
						full.hide();
					});
					options.addButtonInput("", I18n.goThereTrust(), () => {
						open();
						full.hide();
						this.trustedDomains.add(Url.host);
						this.saveTrusted();
					});
					full.show();
				}
			};
		} else {
			throw new Error(url + " is not a valid URL");
		}
	}
	/*
	static replace(base: HTMLElement, newelm: HTMLElement) {
	const basechildren = base.children;
	const newchildren = newelm.children;
	for (const thing of Array.from(newchildren)) {
	base.append(thing);
	}
	}
	*/
}

//solution from https://stackoverflow.com/questions/4576694/saving-and-restoring-caret-position-for-contenteditable-div
let text = "";
let formatted = false;
function saveCaretPosition(
	context: HTMLElement,
	offset = 0,
	txtLengthFunc = MarkDown.gatherBoxText.bind(MarkDown),
	computedLength: void | number = undefined,
) {
	const selection = window.getSelection() as Selection;
	if (!selection) return;
	try {
		const range = selection.getRangeAt(0);

		let base = selection.anchorNode as Node;
		range.setStart(base, 0);
		let baseString: string;
		let i = 0;
		const index = selection.focusOffset;

		for (const thing of Array.from(base.childNodes)) {
			if (i === index) {
				base = thing;
				break;
			}
			i++;
		}
		const prev = base.previousSibling;
		let len = 0;
		if ((!prev || prev instanceof HTMLBRElement) && base instanceof HTMLBRElement) {
			len--;
		}
		if (
			!(base instanceof Text) &&
			!(
				base instanceof HTMLSpanElement &&
				base.className === "" &&
				base.children.length == 0 &&
				!(base instanceof HTMLBRElement)
			)
		) {
			if (base instanceof HTMLElement) {
				baseString = txtLengthFunc(base);
			} else {
				baseString = base.textContent || "";
			}
		} else {
			baseString = selection.toString();
		}
		range.setStart(context, 0);

		let build = "";
		//I think this is working now :3
		function crawlForText(context: Node) {
			//@ts-ignore
			const children = [...context.childNodes];
			if (children.length === 1 && children[0] instanceof Text) {
				if (selection.containsNode(context, false)) {
					build += txtLengthFunc(context as HTMLElement);
				} else if (selection.containsNode(context, true)) {
					if (context.contains(base) || context === base || base.contains(context)) {
						build += baseString;
					} else {
						build += context.textContent;
					}
				} else {
					console.error(context);
				}
				return;
			}
			for (const node of children as Node[]) {
				if (selection.containsNode(node, false)) {
					if (node instanceof HTMLElement) {
						build += txtLengthFunc(node);
					} else {
						build += node.textContent;
					}
				} else if (selection.containsNode(node, true)) {
					if (node instanceof HTMLElement) {
						crawlForText(node);
					} else {
						console.error(node, "This shouldn't happen");
					}
				} else {
					//console.error(node,"This shouldn't happen");
				}
			}
		}
		crawlForText(context);
		if (baseString === "\n") {
			build += baseString;
		}
		text = build;
		len += build.length;
		if (computedLength !== undefined) {
			len = computedLength;
		}
		len = Math.min(len, txtLengthFunc(context).length);
		len += offset;
		return function restore(backspace = false) {
			if (!selection) return;
			const pos = getTextNodeAtPosition(context, len, txtLengthFunc);
			if (
				pos.node instanceof Text &&
				pos.node.textContent === "\n" &&
				pos.node.nextSibling &&
				Error.prototype.stack === "" &&
				!backspace
			) {
				if (pos.node.nextSibling instanceof Text && pos.node.nextSibling.textContent === "\n") {
					pos.position = 1;
				} else {
					pos.node = pos.node.nextSibling;
					pos.position = 0;
				}
			}
			selection.removeAllRanges();
			const range = new Range();
			range.setStart(pos.node, pos.position);
			selection.addRange(range);
		};
	} catch {
		return undefined;
	}
}

function getTextNodeAtPosition(
	root: Node,
	index: number,
	txtLengthFunc = MarkDown.gatherBoxText.bind(MarkDown),
): {
	node: Node;
	position: number;
} {
	if (index === 0) {
		return {
			node: root,
			position: 0,
		};
	}
	if (root instanceof Text) {
		return {
			node: root,
			position: index,
		};
	} else if (root instanceof HTMLBRElement) {
		return {
			node: root,
			position: 0,
		};
	} else if (root instanceof HTMLElement && root.hasAttribute("real")) {
		return {
			node: root,
			position: -1,
		};
	}

	let lastElm: Node = root;
	for (const node of root.childNodes as unknown as Node[]) {
		lastElm = node;
		let len: number;
		if (node instanceof HTMLElement) {
			len = txtLengthFunc(node).length;
		} else {
			len = (node.textContent || "").length;
		}
		if (len <= index && (len < index || len !== 0)) {
			index -= len;
			if (index === 0) {
				let nodey = node;
				let bad = false;
				while (nodey.childNodes.length) {
					nodey = Array.from(nodey.childNodes).at(-1) as ChildNode;
					if (nodey instanceof HTMLElement && nodey.contentEditable === "false") {
						bad = true;
						break;
					}
				}
				if (
					!(nodey instanceof HTMLBRElement) &&
					(!(nodey instanceof HTMLElement) || nodey.contentEditable === "false") &&
					!bad
				) {
					return {
						node: nodey,
						position: (nodey.textContent || "").length,
					};
				}
			}
		} else {
			const returny = getTextNodeAtPosition(node, index);
			if (returny.position === -1) {
				index = 0;
				continue;
			}
			return returny;
		}
	}
	if (!(lastElm instanceof HTMLElement && lastElm.hasAttribute("real"))) {
		while (lastElm && !(lastElm instanceof Text || lastElm instanceof HTMLBRElement)) {
			lastElm = lastElm.childNodes[lastElm.childNodes.length - 1];
		}
		if (lastElm) {
			const position = (lastElm.textContent as string).length;
			return {
				node: lastElm,
				position,
			};
		}
	}
	const span = document.createElement("span");
	root.appendChild(span);
	return {
		node: span,
		position: 0,
	};
}
export {MarkDown, saveCaretPosition, getTextNodeAtPosition};
