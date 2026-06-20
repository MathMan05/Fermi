import {TypeChecker} from "../basetype";

export class Never extends TypeChecker {
	constructor() {
		super();
	}
	check(): void {
		throw new Error(`never`);
	}
}
