import {hcolors} from "./colors";
function ifCSSAllows() {
	if (!("CSS" in globalThis && CSS.highlights && globalThis.Highlight)) return () => {};
	const strLen = (str: string) => {
		return [...str].length;
	};
	const highkeyword = new Highlight();
	CSS.highlights.set("highkeyword", highkeyword);

	const highnumber = new Highlight();
	CSS.highlights.set("highnumber", highnumber);

	const highstring = new Highlight();
	CSS.highlights.set("highstring", highstring);

	const highsymbol = new Highlight();
	CSS.highlights.set("highsymbol", highsymbol);
	const highcomment = new Highlight();
	CSS.highlights.set("highcomment", highcomment);

	const highidentifier = new Highlight();
	CSS.highlights.set("highidentifier", highidentifier);

	const highFunc = new Highlight();
	CSS.highlights.set("highFunc", highFunc);

	const highClass = new Highlight();
	CSS.highlights.set("highClass", highClass);

	const highProp = new Highlight();
	CSS.highlights.set("highProp", highProp);
	const f = new FinalizationRegistry<string>((id) => {
		eliMap.delete(id);
	});
	const eliMap = new Map<string, [Highlight, Range][]>();
	function addToRangeMap(r: Range, elm: HTMLElement, h: Highlight) {
		let prop = elm.getAttribute("UUID");
		if (!prop) {
			prop = Math.random() + "";
			elm.setAttribute("UUID", prop);
			f.register(elm, prop);
		}
		let r2: [Highlight, Range][] | undefined = eliMap.get(prop);
		if (!r2) {
			r2 = [] as [Highlight, Range][];
			eliMap.set(prop, r2);
		}
		r2.push([h, r]);
	}
	function clearHighlights(elm: HTMLElement) {
		let prop = elm.getAttribute("UUID");
		if (!prop) return;
		const m = eliMap.get(prop);
		if (!m) return;
		eliMap.delete(prop);
		for (const [h, r] of m) {
			h.delete(r);
		}
	}

	function highlight(r: Range, color: hcolors, elm: HTMLElement) {
		switch (color) {
			case hcolors.keyword:
				highkeyword.add(r);
				addToRangeMap(r, elm, highkeyword);
				break;
			case hcolors.number:
				highnumber.add(r);
				addToRangeMap(r, elm, highnumber);
				break;
			case hcolors.comment:
				highcomment.add(r);
				addToRangeMap(r, elm, highcomment);
				break;
			case hcolors.identifier:
				highidentifier.add(r);
				addToRangeMap(r, elm, highidentifier);
				break;
			case hcolors.string:
				highstring.add(r);
				addToRangeMap(r, elm, highstring);
				break;
			case hcolors.symbol:
				highsymbol.add(r);
				addToRangeMap(r, elm, highsymbol);
				break;
			case hcolors.function:
				highFunc.add(r);
				addToRangeMap(r, elm, highFunc);
				break;
			case hcolors.class:
				highClass.add(r);
				addToRangeMap(r, elm, highClass);
				break;
			case hcolors.property:
				highProp.add(r);
				addToRangeMap(r, elm, highProp);
				break;
			default:
				color satisfies never;
		}
	}
	return function highlightFromLex(
		elm: HTMLElement,
		lex: Iterable<{
			type: hcolors;
			content: string;
		}>,
		skipStart: number,
	) {
		clearHighlights(elm);
		const nodes = Array.from(elm.childNodes) as Text[];
		let r = new Range();
		const lexed = Array.from(lex);
		if (skipStart) {
			lexed.unshift({type: hcolors.symbol, content: " ".repeat(skipStart)});
		}
		if (lexed.length === 0) return;
		let i = 1;
		let lenToGo = strLen(lexed[0].content);
		let t = lexed[0].type;
		r.setStart(nodes[0], 0);
		function getNextNode() {
			if (!lexed[i]) {
				const last = nodes.at(-1) as Text;
				r.setEnd(last, strLen(last.textContent));
				highlight(r, t, elm);
				return -1;
			} else highlight(r, t, elm);
			lenToGo = strLen(lexed[i].content);
			t = lexed[i].type;
			i++;
			return 0;
		}

		for (const node of nodes) {
			let len = strLen(node.textContent);
			let start = 0;
			while (len) {
				if (len < lenToGo) {
					lenToGo -= len;
					break;
				} else {
					start += lenToGo;
					r.setEnd(node, start);
					len -= lenToGo;
					if (getNextNode() === -1) return;
					r = new Range();
					r.setStart(node, start);
				}
			}
		}
	};
}
export const highlightFromLex = ifCSSAllows();
