import {TypeChecker} from "./basetype";
import {basicEvent} from "./types/basicEvent";
import {heartbeat} from "./types/events/hearbeat";
import {ready} from "./types/events/ready";
import {initHeart} from "./types/events/setInterval";
type basicgw = {
	op: number;
	d?: unknown;
	s?: number;
	t?: string;
};
export class Check {
	static apiMatch = [] as [RegExp, TypeChecker][];
	static checkAPI(path: string, obj: unknown) {
		for (const [match, check] of this.apiMatch) {
			if (path.match(match)) {
				check.check(obj);
				return;
			}
		}
		console.warn(`could not check API path: ${path}`);
	}
	static checkDispatch(dis: basicgw) {
		switch (dis.t) {
			case "READY":
				return ready.check(dis);
			default:
				console.warn(`could not check gateway dispatch: ${dis.t}`);
		}
	}
	static checkEvent(obj: unknown) {
		basicEvent.check(obj);
		const o = obj as basicgw;
		switch (o.op) {
			case 0:
				return this.checkDispatch(o);
			case 10:
				return initHeart.check(o);
			case 11:
				return heartbeat.check(o);
			default:
				console.warn(`could not check gateway: ${o.op}`);
		}
	}
}
