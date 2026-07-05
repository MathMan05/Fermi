function fragAppend(div: HTMLElement, pre = false) {
	let qued = false;
	const par = div.parentElement as Element;
	if (!par) throw new Error("parrent is missing");
	function appendFrag() {
		const elms = Array.from(frag.children) as HTMLElement[];
		let didForce = false;
		if (pre) {
			if (supports) {
				if (par.scrollTop === 0) {
					par.scrollTop += 3;
					didForce = true;
				}
			}
		}
		div[pre ? "prepend" : "append"](frag);

		if (didForce) {
			par.scrollTop -= 3;
		}
		if (pre && !supports) {
			let top = -Infinity;
			let bottom = Infinity;
			elms.forEach((_) => {
				const rec = _.getBoundingClientRect();
				top = Math.max(top, rec.top);
				bottom = Math.min(bottom, rec.bottom);
			});
			const h = top - bottom;
			const p = div.parentNode;
			if (p instanceof HTMLElement) {
				p.scrollTop += h;
			}
		}
	}
	const frag = document.createDocumentFragment();
	let count = 0;
	return (elm: HTMLElement) =>
		new Promise<void>((res) => {
			count++;
			frag[pre ? "prepend" : "append"](elm);
			elm.classList.add("noFlex");
			if (!qued) {
				let lcount = count;
				function wait(t = 0) {
					if (count !== lcount) {
						lcount = count;
						t = 0;
					}
					if (t === 10) {
						appendFrag();
						qued = false;
						res();
						return;
					}
					queueMicrotask(() => {
						wait(t + 1);
					});
				}
				wait();
				qued = true;
			} else {
				res();
			}
		});
}

const supports = CSS.supports("overflow-anchor", "auto");
class InfiniteScroller {
	readonly getIDFromOffset: (ID: string, offset: number) => Promise<string | undefined>;
	readonly getHTMLFromID: (ID: string) => HTMLElement;
	readonly destroyFromID: (ID: string) => Promise<boolean>;
	readonly reachesBottom: () => void;

	private weakDiv = new WeakRef(document.createElement("div"));
	private curFocID?: string;
	private curElms = new Map<string, HTMLElement>();
	private backElm = new Map<string, string | undefined>();
	private forElm = new Map<string, string | undefined>();
	private weakElmId = new WeakMap<HTMLElement, string>();

	get div() {
		return this.weakDiv.deref();
	}
	set div(div: HTMLDivElement | undefined) {
		this.weakDiv = new WeakRef(div || document.createElement("div"));
	}
	get scroller() {
		return this.div?.children[0] as HTMLDivElement | undefined;
	}

	constructor(
		getIDFromOffset: InfiniteScroller["getIDFromOffset"],
		getHTMLFromID: InfiniteScroller["getHTMLFromID"],
		destroyFromID: InfiniteScroller["destroyFromID"],
		reachesBottom: InfiniteScroller["reachesBottom"] = () => {},
	) {
		this.getIDFromOffset = getIDFromOffset;
		this.getHTMLFromID = getHTMLFromID;
		this.destroyFromID = destroyFromID;
		this.reachesBottom = reachesBottom;
	}
	observer: IntersectionObserver = new IntersectionObserver(console.log);

	private heightMap = new WeakMap<HTMLElement, number>();
	private createObserver(root: HTMLDivElement) {
		const scroller = root.children[0];
		function sorted() {
			return Array.from(scroller.children).filter((_) => visable.has(_)) as HTMLElement[];
		}
		if ("ResizeObserver" in globalThis) {
			let height = 0;
			new ResizeObserver((e) => {
				const nh = e[0].target.getBoundingClientRect().height;
				if (height) {
					if (this.scrollBottom - height + nh < 2) root.scrollTop = root.scrollHeight;
					else if (root.scrollTop + nh + 6 > root.scrollHeight) root.scrollTop += -height + nh;
					else root.scrollTop += height - nh;
					console.log(root.scrollTop + height + 6 - root.scrollHeight);
				}
				height = nh;
			}).observe(root);
		}
		const heights = new WeakMap<Element, number>();
		const re =
			"ResizeObserver" in globalThis
				? new ResizeObserver((e) => {
						for (const elm of e) {
							const nh = elm.target.getBoundingClientRect().height;
							const height = heights.get(elm.target);
							if (height && nh) {
								if (!this.atBottom()) root.scrollTop -= height - nh;
							}
							heights.set(elm.target, nh);
						}
					})
				: undefined;
		//TODO maybe a workarround?
		const visable = new Set<Element>();
		this.observer = new IntersectionObserver(
			(obvs) => {
				for (const obv of obvs) {
					if (obv.target instanceof HTMLElement) {
						if (obv.isIntersecting) {
							visable.add(obv.target);
							re?.observe(obv.target);
						} else {
							visable.delete(obv.target);
							re?.unobserve(obv.target);
						}

						this.heightMap.set(obv.target, obv.boundingClientRect.height);
					}
				}
				for (const obv of obvs) {
					if (obv.target instanceof HTMLElement) {
						const id = this.weakElmId.get(obv.target);
						if (id && !obv.isIntersecting && id === this.curFocID) {
							const elms = sorted();

							const middle = elms[(elms.length / 2) | 0];
							const id = this.weakElmId.get(middle);
							if (!id) continue;
							this.curFocID = id;
							this.fillIn(true);
						} else if (!id) console.log("uh...");
					}
				}
			},
			{root, threshold: 0.1},
		);
		let time = Date.now();
		const handleScroll = async () => {
			await new Promise((res) => requestAnimationFrame(res));
			if (this.scrollBottom < 5) {
				const scroll = this.scroller;
				if (!scroll) return;
				const last = this.weakElmId.get(Array.from(scroll.children).at(-1) as HTMLElement);
				if (!last) return;
				if (this.backElm.get(last) || !this.backElm.has(last)) return;
				this.reachesBottom();
			}
		};
		let last = 0;
		root.addEventListener("scroll", async () => {
			const now = Date.now();
			const thisid = ++last;
			if (now - time < 500) {
				await new Promise((res) => setTimeout(res, 500));
				if (thisid !== last) return;
			}
			time = now;
			handleScroll();
		});
	}

	async getDiv(initialId: string, flash = false): Promise<HTMLDivElement> {
		const div = document.createElement("div");
		div.classList.add("scroller");
		this.div = div;

		const scroll = document.createElement("div");
		div.append(scroll);

		this.createObserver(div);

		await this.focus(initialId, flash, true);
		return div;
	}
	private get scrollBottom() {
		if (this.div) {
			return this.div.scrollHeight - this.div.scrollTop - this.div.clientHeight;
		} else {
			return 0;
		}
	}

	async addedBottom(): Promise<void> {
		const snap = this.snapBottom();
		const scroll = this.scroller;
		if (!scroll) return;
		const last = this.weakElmId.get(Array.from(scroll.children).at(-1) as HTMLElement);
		if (!last) return;
		this.backElm.delete(last);
		await this.fillIn();
		snap();
	}

	atBottom() {
		const scroll = this.scroller;
		if (!scroll) return false;
		const last = this.weakElmId.get(Array.from(scroll.children).at(-1) as HTMLElement);
		if (!last) return false;
		if (this.backElm.get(last) || !this.backElm.has(last)) return false;
		return this.scrollBottom < 4;
	}
	toBottom() {
		if (this.div) this.div.scrollTop = this.div.scrollHeight;
	}

	snapBottom(): () => void {
		if (this.div && this.atBottom()) {
			const trigger = this.scrollBottom < 4;
			return () => {
				if (this.div && trigger) this.toBottom();
			};
		} else {
			return () => {};
		}
	}

	async deleteId(id: string) {
		const prev = this.backElm.get(id) || (this.backElm.has(id) ? null : undefined);
		const next = this.forElm.get(id) || (this.forElm.has(id) ? null : undefined);
		await this.removeElm(id);
		if (prev && next !== null) this.forElm.set(prev, next);
		if (next && prev !== null) this.backElm.set(next, prev);
	}

	private async clearElms() {
		await Promise.all(this.curElms.keys().map((id) => this.destroyFromID(id)));
		this.curElms.clear();
		this.backElm.clear();
		this.forElm.clear();
		const scroller = this.scroller;
		if (!scroller) return;
		scroller.innerHTML = "";
	}

	private async removeElm(id: string) {
		const back = this.backElm.get(id);
		if (back) this.forElm.delete(back);
		this.backElm.delete(id);

		const forward = this.forElm.get(id);
		if (forward) this.backElm.delete(forward);
		this.forElm.delete(id);

		const elm = this.curElms.get(id);
		this.curElms.delete(id);
		await this.destroyFromID(id);
		elm?.remove();
	}
	private getFromID(id: string) {
		if (this.curElms.has(id)) {
			return this.curElms.get(id) as HTMLElement;
		}
		const elm = this.getHTMLFromID(id);
		this.curElms.set(id, elm);
		this.weakElmId.set(elm, id);
		this.observer.observe(elm);
		return elm;
	}
	//@ts-ignore-error
	private checkIDs() {
		const scroll = this.scroller;
		if (!scroll) return;
		const kids = Array.from(scroll.children)
			.map((_) => this.weakElmId.get(_ as HTMLElement))
			.filter((_) => _ !== undefined);
		let last = null;
		for (const kid of kids) {
			if (last === null) {
				last = kid;
			} else {
				if (this.backElm.get(last) !== kid)
					console.log("back is wrong", kid, this.backElm.get(kid));
				if (this.forElm.get(kid) !== last)
					console.log("for is wrong", last, this.backElm.get(last));
				last = kid;
			}
		}
		const e = new Set(this.curElms.keys());
		if (e.symmetricDifference(new Set(kids)).size)
			console.log("cur elms is wrong", e.symmetricDifference(new Set(kids)));
	}
	private addLink(prev: string | undefined, next: string | undefined) {
		if (prev) this.forElm.set(prev, next);
		if (next) this.backElm.set(next, prev);
	}
	private async fillInTop() {
		const scroll = this.scroller;
		if (!scroll) return;
		let top = this.curFocID;
		let count = 0;
		let limit = 50;
		const app = fragAppend(scroll, true);
		const proms: Promise<void>[] = [];

		while (top) {
			count++;
			if (count > 100) {
				const list: string[] = [];
				while (top) {
					list.push(top);
					top = this.forElm.get(top);
				}
				if (!supports) {
					const heights = list
						.map((_) => this.curElms.get(_))
						.map((_) => this.heightMap.get(_ as HTMLElement))
						.filter((_) => _ !== undefined)
						.reduce((a, b) => a + b, 0);
					this.div!.scrollTop -= heights;
				}
				list.forEach((_) => this.removeElm(_));
				break;
			}
			if (this.forElm.has(top) && this.curElms.has(top)) {
				top = this.forElm.get(top);
			} else if (count > limit) {
				break;
			} else {
				limit = 75;
				const id = await this.getIDFromOffset(top, 1);
				this.addLink(top, id);

				if (id) {
					proms.push(app(this.getFromID(id)));
				}
				top = id;
			}
		}

		await Promise.all(proms);
	}
	private async fillInBottom() {
		const scroll = this.scroller;
		if (!scroll) return;
		let bottom = this.curFocID;
		let count = 0;
		let limit = 50;
		const app = fragAppend(scroll);
		const proms: Promise<void>[] = [];
		while (bottom) {
			count++;
			if (count > 100) {
				const list: string[] = [];
				while (bottom) {
					list.push(bottom);
					bottom = this.backElm.get(bottom);
				}
				list.forEach((_) => this.removeElm(_));
				break;
			}
			if (this.backElm.has(bottom) && this.curElms.has(bottom)) {
				if (limit === 75) console.error("patchy?");
				bottom = this.backElm.get(bottom);
			} else if (count > limit) {
				break;
			} else {
				limit = 75;
				const id = await this.getIDFromOffset(bottom, -1);
				this.addLink(id, bottom);

				if (id) {
					proms.push(app(this.getFromID(id)));
				}
				bottom = id;
			}
		}

		await Promise.all(proms);
	}

	private filling?: Promise<void>;
	private async fillIn(refill = false) {
		if (this.filling && !refill) {
			return this.filling;
		}

		await this.filling;
		if (this.filling) return;

		const fill = new Promise<void>(async (res) => {
			await Promise.all([this.fillInTop(), this.fillInBottom()]);
			if (this.filling === fill) {
				this.filling = undefined;
			}
			res();
		});
		this.filling = fill;
		await fill;

		(async () => {
			while (true) {
				if (this.div && this.div.parentElement) {
					if (this.div.parentElement.clientHeight !== this.div.clientHeight) this.reachesBottom();
					break;
				}
				await new Promise((res) => setTimeout(res, 100));
			}
		})();

		return;
	}

	async focus(id: string, flash = true, sec = false): Promise<void> {
		// debugger;
		const scroller = this.scroller;
		if (!scroller) return;

		let div = this.curElms.get(id);
		if (div && !document.contains(div)) div = undefined;
		let had = true;
		this.curFocID = id;

		if (!div) {
			await this.clearElms();
			had = false;
			const obj = this.getFromID(id);
			scroller.append(obj);
			div = obj;
		}
		await this.fillIn(true);
		if (had && !sec) {
			div.scrollIntoView({
				behavior: "smooth",
				inline: "center",
				block: "center",
			});
		} else {
			div.scrollIntoView({
				block: "center",
			});
		}

		if (flash) {
			await new Promise((resolve) => {
				setTimeout(resolve, 1000);
			});
			div.classList.remove("jumped");
			await new Promise((resolve) => {
				setTimeout(resolve, 100);
			});
			div.classList.add("jumped");
		}
	}

	async delete(): Promise<void> {
		if (this.div) {
			this.div.remove();
		}
		this.clearElms();
	}
}

export {InfiniteScroller};
