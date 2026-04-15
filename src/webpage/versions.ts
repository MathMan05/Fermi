import {I18n} from "./i18n";
import {Dialog} from "./settings";

export class Versions {
	private ver: number;
	constructor(ver?: number) {
		this.ver = ver ?? -1;
	}
	private static warned = false;
	private showWarn(text: string) {
		//TODO enable this once the version endpoint is up and running
		return;
		if (Versions.warned) return;
		Versions.warned = true;
		const d = new Dialog("");
		d.options.addText(text);
		d.options.addButtonInput("", I18n.yes(), () => {
			d.hide();
		});
		d.show();
		d.background.deref()!.style.zIndex = "10000";
	}
	private onRegi() {
		if (this.ver === -1) {
			this.showWarn(I18n.sbWarns.regi());
		}
	}
	private onStart() {
		if (this.ver === -1) {
			this.showWarn(I18n.sbWarns.in());
		}
	}
	static async makeVersion(api: string, place: "regi" | "start"): Promise<Versions> {
		const p = await fetch(api + "/harmony/version");
		if (!p.ok) {
			const v = new Versions();
			if (place === "regi") {
				v.onRegi();
			} else if (place === "start") {
				v.onStart();
			}
			return v;
		}
		const v = await p.json();
		return new Versions(v.version);
	}
}
