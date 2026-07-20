import {hcolors} from "../colors.js";

const r =
	/"(\\(.|\n)|[^"\n\\])*"?|<!--(([^-])|-[^-]|--[^>])*(-->)?|[a-zA-Z][a-zA-Z0-9]*\s*=|<[\s\/]*[^<> ]+|.|\n/gm;

export function* lex(code: string) {
	for (const [lex] of code.matchAll(r)) {
		if (lex.startsWith("<!--")) {
			yield {
				type: hcolors.comment,
				content: lex,
			};
		} else if (lex.startsWith('"')) {
			yield {
				type: hcolors.string,
				content: lex,
			};
		} else if (lex.startsWith("<")) {
			yield {
				type: hcolors.identifier,
				content: lex,
			};
		} else if (lex.match(/[a-zA-Z][a-zA-Z0-9]*\s*=/)) {
			yield {
				type: hcolors.number,
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
