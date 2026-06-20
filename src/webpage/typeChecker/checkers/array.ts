import {resolveable, TypeChecker} from "../basetype";

export class ArrayChecker extends TypeChecker {
	arr: TypeChecker | TypeChecker[];
	constructor(arr: resolveable | resolveable[]) {
		super();
		if (arr instanceof Array) {
			this.arr = arr.map((_) => TypeChecker.resolve(_));
		} else {
			this.arr = TypeChecker.resolve(arr);
		}
	}
	check(obj: unknown) {
		if (!(obj instanceof Array)) throw new Error(`${obj} is not of type array`);
		if (this.arr instanceof Array) {
			if (this.arr.length !== obj.length) throw new Error(`${obj} does not match array schema`);
			for (let i = 0; i < obj.length; i++) {
				this.arr[i].check(obj[i]);
			}
		} else {
			for (const elm of obj) {
				this.arr.check(elm);
			}
		}
	}
}
