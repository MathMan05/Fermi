import {I18n} from "./i18n.js";
import "./utils/pollyfills.js";
import "./templatePage.js";
import "./more.js";
import "./recover.js";
import "./home.js";
import "./invite.js";
import "./oauth2/auth.js";
import "./audio/page.js";
import "./404.js";
import type * as C from "./typeChecker/chekerIndex.js";
import {SuperUser} from "./superuser.js";

if (window.location.pathname === "/app") {
	window.location.pathname = "/channels/@me";
}
declare global {
	interface Window {
		checker?: typeof C.Check;
	}
}
if (localStorage.getItem("checkTypes")) {
	const i = (await import(
		"/typeChecker/chekerIndex.js" as "./typeChecker/chekerIndex.js"
	)) as typeof C;
	window.checker = i.Check;
}
if (window.location.pathname.startsWith("/donate")) {
	await I18n.done;
	I18n.translatePage();
	const desc = document.getElementById("hostDesc")!;
	desc.innerHTML = "";
	desc.append(
		...I18n.donate.host
			.desc("$NotAlisa")
			.split("\n")
			.flatMap((_, i) => (i ? [document.createElement("br"), _] : _)),
	);
}
if (window.location.pathname.startsWith("/channels")) {
	await I18n.done;
	SuperUser.loadFont();
	I18n.translatePage();
	const su = new SuperUser();
	await su.init();
}
