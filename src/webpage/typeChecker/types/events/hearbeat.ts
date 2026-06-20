import {Nullish} from "../../checkers/nullish";
import {ObjectChecker} from "../../checkers/object";
import {Optional} from "../../checkers/optional";

export const heartbeat = new ObjectChecker({
	op: Number,
	d: {},
	s: new Nullish(new Optional(Number)),
	t: new Nullish(new Optional(String)),
});
