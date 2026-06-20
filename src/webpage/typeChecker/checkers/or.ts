import {resolveable, TypeChecker} from "../basetype";

export class OrChecker extends TypeChecker {
	arr: TypeChecker[];
	constructor(arr: resolveable[]) {
		super();
		this.arr = arr.map((_) => TypeChecker.resolve(_));
	}
	check(obj: unknown) {
		let err = new Error("or statement is missing things to or");
		for (const elm of this.arr) {
			try {
				elm.check(obj);
				return;
			} catch (e) {
				err = e as Error;
			}
		}
		throw err;
	}
}
