import {resolveable, TypeChecker} from "../basetype";

export class ObjectChecker extends TypeChecker {
	obj: {[key: string]: TypeChecker} | [TypeChecker, TypeChecker] | [TypeChecker];
	constructor(obj: {[key: string]: resolveable} | [resolveable] | [resolveable, resolveable]) {
		super();
		if (obj instanceof Array) {
			this.obj = obj.map((_) => TypeChecker.resolve(_)) as
				| [TypeChecker, TypeChecker]
				| [TypeChecker];
		} else {
			this.obj = Object.fromEntries(
				Object.entries(obj).map(([key, value]) => [key, TypeChecker.resolve(value)]),
			);
		}
	}
	check(obj: unknown) {
		if (!(obj instanceof Object)) throw new Error(`${obj} is not of type object`);
		if (this.obj instanceof Array) {
			const valueCheck = this.obj[this.obj.length - 1];
			const keyCheck = this.obj.at(-2);
			for (const [key, value] of Object.entries(obj)) {
				keyCheck?.check(key);
				valueCheck.check(value);
			}
		} else {
			const thiskeys = Object.keys(this.obj);
			for (const key of thiskeys) {
				this.obj[key].check((obj as Record<string, unknown>)[key]);
			}
			const objKeys = Object.keys(obj);
			const extra = new Set(objKeys).difference(new Set(thiskeys));
			if (extra.size) {
				throw new Error(`Object has extra keys ${[...extra]}`);
			}
		}
	}
}
