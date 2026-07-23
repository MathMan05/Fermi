import {hcolors} from "../colors.js";

interface clikeConf {
	names: string[];
	keywords: string[];
	firstLineShebang?: boolean;
	hashComments?: boolean;
	doubleSlashComments?: boolean;
	multilineSlashComments?: boolean;
	JSLikeTemplateStrings?: boolean;
	multiLine?: string;
}
function regex(config: clikeConf): RegExp {
	const conds = [] as string[];
	if (config.multiLine && "escape" in RegExp) {
		const chars = config.multiLine;
		const charArr = [...chars];
		const matchOpts = [`\\\\(?:.|\\s|\\n)`, `(?:[^${charArr[0]}]|\\n)`] as string[];
		for (let i = 0; i < chars.length - 1; i++) {
			matchOpts.push(
				RegExp.escape(config.multiLine.slice(0, i + 1)) + `(?:(?=\\\\)|\\n|[^${charArr[i + 1]}]|$)`,
			);
		}
		conds.push(
			`(${RegExp.escape(config.multiLine)}(?:${matchOpts.join("|")})*(?:${RegExp.escape(config.multiLine)})?)`,
		);
	}
	conds.push(`\'(\\\\(.|\\n)|[^"\\n\\\\])*\'?`);
	conds.push(`"(\\\\(.|\\n)|[^"\\n\\\\])*"?`);
	if (config.hashComments) {
		conds.push("#.*");
	}
	if (config.doubleSlashComments) {
		conds.push("\\/\\/.*");
	}
	if (config.multilineSlashComments) {
		conds.push("\\/\\*([^*]|\\*([^\\/]|$))*(\\*\\/)?");
	}
	if (config.multilineSlashComments) {
		conds.push("\\/\\*([^*]|\\*([^\\/]|$))*(\\*\\/)?");
	}
	if (config.JSLikeTemplateStrings) {
		conds.push("`(\\\\.|[^`])*`?");
	}
	conds.push("(.|\n)");

	return new RegExp(
		"\\s+|[a-z_A-Z][a-z_A-Z0-9]*|[0-9][a-z_A-Z0-9]*\\.?[a-zA-Z_0-9]*|" + conds.join("|"),
		"g",
	);
}
let j: undefined | clikeConf[] = undefined;
export async function canLex(lang: string) {
	if (!j) {
		j = await (await fetch("/highlighter/clike/langs.json")).json();
	}
	const conf = j!.find((_) => _.names.includes(lang));
	if (conf) {
		return (code: string) => {
			return lex(code, conf);
		};
	}
	return undefined;
}
function* lex(code: string, config: clikeConf) {
	const r = regex(config);
	const keywords = new Set(config.keywords);
	if (config.firstLineShebang) {
		const m = code.match(/^#!.*\n?/m);
		if (m) {
			code = code.replace(/^#!.*\n?/m, "");
			yield {
				type: hcolors.comment,
				content: m[0],
			};
		}
	}
	const matches = Array.from(code.matchAll(r));
	let i = -1;
	function identifyTypeOfWord(word: string) {
		if (keywords.has(word)) {
			return hcolors.keyword;
		} else {
			const next = nextNonBlank();
			if (next) {
				if (next.startsWith("(")) {
					return hcolors.function;
				}
			}

			const prev = prevNonBlank();
			if (prev) {
				if (prev.endsWith(".")) {
					return hcolors.property;
				}
			}
			if (word.match(/^[A-Z]/)) return hcolors.class;
			return hcolors.identifier;
		}
	}
	function isBlank(lex: string) {
		if (lex.match(/^\s*$/)) {
			return true;
		} else if (lex.startsWith("//") && config.doubleSlashComments) {
			return true;
		} else if (lex.startsWith("/*") && config.multilineSlashComments) {
			return true;
		} else if (lex.startsWith("#") && config.hashComments) {
			return true;
		}
		return false;
	}
	function prevNonBlank() {
		for (let j = i - 1; j >= 0; j--) {
			const lex = matches[j][0];
			if (isBlank(lex)) continue;
			return lex;
		}
		return null;
	}
	function nextNonBlank() {
		for (let j = i + 1; j < matches.length; j++) {
			const lex = matches[j][0];
			if (isBlank(lex)) continue;
			return lex;
		}
		return null;
	}
	for (const [lex] of matches) {
		i++;
		if (lex.startsWith("//") && config.doubleSlashComments) {
			yield {
				type: hcolors.comment,
				content: lex,
			};
		} else if (lex.startsWith("/*") && config.multilineSlashComments) {
			yield {
				type: hcolors.comment,
				content: lex,
			};
		} else if (lex.startsWith("#") && config.hashComments) {
			yield {
				type: hcolors.comment,
				content: lex,
			};
		} else if (lex.startsWith("`") && config.JSLikeTemplateStrings) {
			yield {
				type: hcolors.string,
				content: lex,
			};
		} else if (lex.match(/^("|')/)) {
			yield {
				type: hcolors.string,
				content: lex,
			};
		} else if (lex.match(/^[0-9]/)) {
			yield {
				type: hcolors.number,
				content: lex,
			};
		} else if (lex.match(/^[a-zA-Z]/)) {
			yield {
				type: identifyTypeOfWord(lex),
				content: lex,
			};
		} else {
			yield {
				type: hcolors.symbol,
				content: lex,
			};
		}
	}
}
