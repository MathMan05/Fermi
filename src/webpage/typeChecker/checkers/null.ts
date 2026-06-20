import {TypeChecker} from "../basetype";

export class NullChecker extends TypeChecker {
	constructor() {
		super();
	}
	check(obj: unknown): void {
		if (obj !== null) throw new Error(`${obj} is not null`);
	}
}
