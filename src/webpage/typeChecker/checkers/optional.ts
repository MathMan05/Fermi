import {resolveable, TypeChecker} from "../basetype";

export class Optional extends TypeChecker {
	checker: TypeChecker;
	constructor(check: resolveable) {
		super();
		this.checker = TypeChecker.resolve(check);
	}
	check(obj: unknown) {
		if (obj === undefined) return;
		this.checker.check(obj);
	}
}
