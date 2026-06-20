import {resolveable, TypeChecker} from "../basetype";

export class Nullish extends TypeChecker {
	checker: TypeChecker;
	constructor(check: resolveable) {
		super();
		this.checker = TypeChecker.resolve(check);
	}
	check(obj: unknown) {
		if (obj === null) return;
		this.checker.check(obj);
	}
}
