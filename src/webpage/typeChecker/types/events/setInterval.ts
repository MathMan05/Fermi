import {Nullish} from "../../checkers/nullish";
import {ObjectChecker} from "../../checkers/object";
import {Optional} from "../../checkers/optional";

export const initHeart = new ObjectChecker({
	op: Number,
	d: {
		heartbeat_interval: Number,
	},
	s: new Nullish(new Optional(Number)),
	t: new Nullish(new Optional(String)),
});
