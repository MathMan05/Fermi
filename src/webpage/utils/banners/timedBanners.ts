import {I18n} from "../../i18n";
import {SnowFlake} from "../../snowflake";
import {submitBanner} from "../bannerController";
import {getBulkUsers, Specialuser} from "../utils";
await I18n.done;
const oldest = (Object.values(getBulkUsers().users) as Specialuser[]).reduce((prev, cur) => {
	console.log(cur.id);
	if (!cur.id) return prev;
	const t = SnowFlake.stringToUnixTime(cur.id);
	if (t < prev) return t;
	return prev;
}, Infinity);
//Only show in December and if the account is over a month old
if (new Date().getMonth() === 11 && Date.now() - oldest > 1000 * 60 * 60 * 24 * 30)
	submitBanner({
		text: I18n.donateMessage,
		url: "/donate",
		priority: 100,
		id: "winter" + new Date().getFullYear(),
	});
