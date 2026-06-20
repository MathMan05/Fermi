import {ArrayChecker} from "./checkers/array";
import {BoolChecker} from "./checkers/bool";
import {Never} from "./checkers/never";
import {NumberChecker} from "./checkers/number";
import {ObjectChecker} from "./checkers/object";
import {StringChecker} from "./checkers/string";

export abstract class TypeChecker {
	abstract check(obj: unknown): void;
	static resolve(r: resolveable): TypeChecker {
		if (r instanceof TypeChecker) return r;
		if (typeof r === "string" || r instanceof RegExp) {
			return new StringChecker(r);
		} else if (r === String) {
			return new StringChecker();
		} else if (r === Boolean) {
			return new BoolChecker();
		} else if (r === Number) {
			return new NumberChecker();
		} else if (typeof r === "number") {
			return new NumberChecker(r);
		} else if (r instanceof Array) {
			return new ArrayChecker(r);
		} else if (r instanceof Object) {
			return new ObjectChecker(r as {[key: string]: resolveable});
		} else {
			return new Never();
		}
	}
}

export type resolveable =
	| typeof String
	| string
	| number
	| typeof Number
	| RegExp
	| resolveable[]
	| {[key: string]: resolveable}
	| TypeChecker
	| typeof Boolean;
