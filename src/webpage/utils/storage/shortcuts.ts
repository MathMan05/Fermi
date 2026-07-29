const props = ["gifSearch"] as const;
export class Shortcuts {
	gifSearch = "ctrl+g";

	constructor(data: Partial<Shortcuts> = {}) {
		Object.assign(this, data);
	}
	*[Symbol.iterator]() {
		for (const thing of props) {
			yield [thing, this[thing]] as const;
		}
		return;
	}
}

export function getShortcuts(): Shortcuts {
	return new Shortcuts(JSON.parse(localStorage.getItem("shortCuts") ?? "{}"));
}

export function setShortcuts(settings: Shortcuts): void {
	localStorage.setItem("shortCuts", JSON.stringify(settings));
}
