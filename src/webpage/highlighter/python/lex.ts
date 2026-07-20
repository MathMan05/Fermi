import {hcolors} from "../colors.js";

const r =
	/"""((\\(.|\n)|[^"\\]|"(?!")|""(?!"))*)(""")?|"(\\(.|\n)|[^"\n\\])*"?|'(\\(.|\n)|[^"\n\\])*'?|\s+|#.*|[~()\[\]|:;`=+\-*\/\\&^%$.]|[a-zA-Z][a-zA-Z0-9]*|[0-9][a-zA-Z0-9]*\.?[a-zA-Z0-9]*|./gm;
const keywords = new Set([
	"False",
	"None",
	"True",
	"and",
	"as",
	"assert",
	"async",
	"await",
	"break",
	"class",
	"continue",
	"def",
	"del",
	"elif",
	"else",
	"except",
	"finally",
	"for",
	"from",
	"global",
	"if",
	"import",
	"in",
	"is",
	"lambda",
	"nonlocal",
	"not",
	"or",
	"pass",
	"raise",
	"return",
	"try",
	"while",
	"with",
	"yield",
]);
export function* lex(code: string) {
	for (const [lex] of code.matchAll(r)) {
		if (lex.startsWith("#")) {
			yield {
				type: hcolors.comment,
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
