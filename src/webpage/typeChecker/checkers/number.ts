import {TypeChecker} from "../basetype";

export class NumberChecker extends TypeChecker {
	num?: number;
	constructor(num?: number) {
		super();
		this.num = num;
	}
	check(obj: unknown): void {
		if (this.num === undefined) {
			if (typeof obj !== "number") throw new Error(`${obj} is not a number`);
		} else if (this.num !== obj) throw new Error(`${obj} and ${this.num} do not match`);
	}
}
