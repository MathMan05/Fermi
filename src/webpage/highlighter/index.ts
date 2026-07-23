import {canLex} from "./clike/lex.js";
import {highlightFromLex} from "./highlight.js";
import {lex as xmlex} from "./xml/lex.js";
export async function highlight(
	elm: HTMLElement,
	lang: string,
	skipStart: number = 0,
	skipEnd: number = 0,
) {
	await new Promise((res) => setTimeout(res));
	lang = lang.trim();
	let content = elm.textContent;
	if (skipStart) {
		content = content.slice(skipStart);
	}
	if (skipEnd) {
		content = content.slice(0, content.length - skipEnd);
	}
	if (lang === "xml" || lang === "html" || lang === "htmlx" || lang === "qml" || lang === "gmx") {
		highlightFromLex(elm, xmlex(content), skipStart);
	} else {
		const clike = await canLex(lang);
		if (clike) highlightFromLex(elm, clike(content), skipStart);
	}
}
