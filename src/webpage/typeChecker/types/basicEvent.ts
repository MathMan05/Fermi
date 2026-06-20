import {Any} from "../checkers/any";
import {Nullish} from "../checkers/nullish";
import {ObjectChecker} from "../checkers/object";
import {Optional} from "../checkers/optional";

export const basicEvent = new ObjectChecker({
	op: Number,
	d: new Nullish(new Optional(new Any())),
	s: new Nullish(new Optional(Number)),
	t: new Nullish(new Optional(String)),
});
