import {hcolors} from "../colors.js";

interface clikeConf {
	names: string[];
	keywords: string[];
	firstLineShabang: boolean;
	hashComments: boolean;
	doubleSlashComments: boolean;
	multilineSlashComments: boolean;
	JSLikeTemplateStrings: boolean;
}
function regex(config: clikeConf): RegExp {
	const conds = [] as string[];
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
		'"(\\\\(.|\\n)|[^"\\n\\\\])*"?|\'(\\\\(.|\\n)|[^"\\n\\\\])*\'?|\\s+|[a-zA-Z][a-zA-Z0-9]*|[0-9][a-zA-Z0-9]*\\.?[a-zA-Z0-9]*|' +
			conds.join("|"),
		"gm",
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
	if (config.firstLineShabang) {
		const m = code.match(/^#!.*\n?/m);
		if (m) {
			code = code.replace(/^#!.*\n?/m, "");
			yield {
				type: hcolors.comment,
				content: m[0],
			};
		}
	}
	for (const [lex] of code.matchAll(r)) {
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
				type: keywords.has(lex) ? hcolors.keyword : hcolors.identifier,
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
