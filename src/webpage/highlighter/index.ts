import {canLex} from "./clike/lex.js";
import {highlightFromLex} from "./highlight.js";
import {lex as xmlex} from "./xml/lex.js";
export async function highlight(
	elm: HTMLElement,
	lang: string,
	skipStart: number = 0,
	skipEnd: number = 0,
) {
	let i = 0;
	while (!document.body.contains(elm)) {
		for (let i = 0; i < 4; i++) {
			await new Promise<void>((res) => queueMicrotask(res));
		}
		i++;
		if (i === 100) break;
	}
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
