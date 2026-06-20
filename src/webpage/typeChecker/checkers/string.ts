import {TypeChecker} from "../basetype";

export class StringChecker extends TypeChecker {
	str?: string | RegExp;
	constructor(str?: string | RegExp) {
		super();
		this.str = str;
	}
	check(obj: unknown): void {
		if (this.str === undefined) {
			if (typeof obj !== "string") throw new Error(`${obj} is not a string`);
		} else if (this.str instanceof RegExp) {
			if (typeof obj !== "string") throw new Error(`${obj} is not a string`);
			if (!obj.match(this.str)) throw new Error(`${obj} does not match ${this.str}`);
		} else if (this.str !== obj) throw new Error(`${obj} does not match ${this.str}`);
	}
}
