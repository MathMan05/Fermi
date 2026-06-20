import {TypeChecker} from "../basetype";

export class BoolChecker extends TypeChecker {
	constructor() {
		super();
	}
	check(obj: unknown): void {
		if (typeof obj !== "boolean") throw new Error(`${obj} is not a bool`);
	}
}
