import {I18n} from "../i18n";

export class Shortcut {
	private shortcuts = new Map<string, () => void>();
	private keycombos = new Map<string, string>();
	private nameToCombo = new Map<string, Set<string>>();
	registerShortcut(name: string, callback: () => void) {
		this.shortcuts.set(name, callback);
	}
	unregisterKeycombo(combo: string) {
		const name = this.keycombos.get(combo);
		this.keycombos.delete(Shortcut.normalize(combo));
		if (!name) return;
		let nset = this.nameToCombo.get(name);
		if (nset) nset.delete(combo);
	}
	registerKeycombo(combo: string, name: string) {
		combo = Shortcut.normalize(combo);
		this.keycombos.set(combo, name);
		let nset = this.nameToCombo.get(name);
		if (!nset) {
			nset = new Set();
			this.nameToCombo.set(name, nset);
		}
		nset.add(combo);
	}
	clear() {
		this.keycombos.clear();
		this.shortcuts.clear();
		this.nameToCombo.clear();
	}
	private static normalize(e: string): string {
		const code = new Set(e.toLowerCase().split("-"));
		const build = [] as string[];
		if (code.has("meta")) build.push("meta");
		if (code.has("ctrl")) build.push("ctrl");
		if (code.has("alt")) build.push("alt");
		if (code.has("shift")) build.push("shift");
		build.push(...[...code].filter((_) => _.length === 1).map((_) => _.toLowerCase()));
		return build.join("-");
	}
	private static eventToCombo(e: KeyboardEvent, down = true): string {
		const build = [] as string[];
		if (e.metaKey || (e.key === "Meta" && down)) {
			if (e.key !== "Meta" || down) build.push("meta");
		}
		if (e.ctrlKey) build.push("ctrl");
		if (e.altKey) build.push("alt");
		if (e.shiftKey) build.push("shift");
		if (e.key.length === 1) build.push(e.key.toLowerCase());
		return build.join("-");
	}
	shortCutbutton(name: string | null, callback: (combo: string) => void, updateCombo: boolean) {
		let cur = (name && [...(this.nameToCombo.get(name) ?? [])].at(0)) ?? "";
		const button = document.createElement("button");
		function updateButton(combo?: string) {
			button.textContent = combo || cur || I18n.keyboard.empty();
		}
		const register = () => {
			button.onkeyup = (event) => {
				const combo = Shortcut.eventToCombo(event, false);
				updateButton(combo);
			};
			button.onkeydown = (event) => {
				const combo = Shortcut.eventToCombo(event);
				updateButton(combo);
				if (event.key.length === 1) {
					callback(combo);
					button.onkeyup = () => {};
					button.onkeydown = () => {};
					if (updateCombo && name) {
						this.unregisterKeycombo(cur);
						this.registerKeycombo(combo, name);
					}
					cur = combo;
					updateButton();
				}
				event.preventDefault();
			};
			button.onblur = () => {
				button.onkeyup = () => {};
				button.onkeydown = () => {};
				updateButton();
			};
		};
		button.onclick = register;
		updateButton();
		const div = document.createElement("div");
		div.classList.add("flexltr", "shortCutSetting");

		const clear = document.createElement("button");
		clear.textContent = I18n.settings.clear();
		div.append(button, clear);
		clear.onclick = () => {
			callback("");
			if (updateCombo && name) {
				this.unregisterKeycombo(cur);
			}
			cur = "";
			updateButton();
		};
		return div;
	}
	listen(elm: HTMLElement) {
		elm.addEventListener("keydown", (event) => {
			if (event.key.length !== 1) return;
			const combo = Shortcut.eventToCombo(event);
			const name = this.keycombos.get(combo);
			if (!name) return;
			const func = this.shortcuts.get(name);
			if (!func) return;
			event.stopImmediatePropagation();
			event.preventDefault();
			func();
		});
	}
}
