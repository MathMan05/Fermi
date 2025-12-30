import {instanceinfo, adduser, Specialuser} from "./utils/utils.js";
import {I18n} from "./i18n.js";
import {Dialog, FormError} from "./settings.js";
import {makeRegister} from "./register.js";
import {trimTrailingSlashes} from "./utils/netUtils";
function generateRecArea(recover = document.getElementById("recover")) {
	if (!recover) return;
	recover.innerHTML = "";
	const can = localStorage.getItem("canRecover");
	if (can) {
		const a = document.createElement("a");
		a.textContent = I18n.login.recover();
		a.href = "/reset" + window.location.search;
		recover.append(a);
	}
}
const recMap = new Map<string, Promise<boolean>>();
async function recover(e: instanceinfo, recover = document.getElementById("recover")) {
	const prom = new Promise<boolean>(async (res) => {
		if (!recover) {
			res(false);
			return;
		}
		recover.innerHTML = "";
		try {
			if (!(await recMap.get(e.api))) {
				if (recMap.has(e.api)) {
					throw Error("can't recover");
				}
				recMap.set(e.api, prom);
				const json = (await (await fetch(e.api + "/policies/instance/config")).json()) as {
					can_recover_account: boolean;
				};
				if (!json || !json.can_recover_account) throw Error("can't recover account");
			}
			res(true);
			localStorage.setItem("canRecover", "true");
			generateRecArea(recover);
		} catch {
			res(false);
			localStorage.removeItem("canRecover");
			generateRecArea(recover);
		} finally {
			res(false);
		}
	});
}

export async function makeLogin(
	trasparentBg = false,
	instance = "",
	handle?: (user: Specialuser) => void,
) {
	const dialog = new Dialog("");
	const opt = dialog.options;
	opt.addTitle(I18n.login.login());
	const picker = opt.addInstancePicker(
		(info) => {
			form.fetchURL = trimTrailingSlashes(info.api) + "/auth/login";
			recover(info, rec);
		},
		{
			instance,
		},
	);
	dialog.show(trasparentBg);

	const form = opt.addForm(
		"",
		(res) => {
			if ("token" in res && typeof res.token == "string") {
				const u = adduser({
					serverurls: JSON.parse(localStorage.getItem("instanceinfo") as string),
					email: email.value,
					token: res.token,
				});
				u.username = email.value;
				if (handle) {
					handle(u);
					dialog.hide();
					return;
				}
				const redir = new URLSearchParams(window.location.search).get("goback");
				if (redir && (!URL.canParse(redir) || new URL(redir).host === window.location.host)) {
					window.location.href = redir;
				} else {
					window.location.href = "/channels/@me";
				}
			} else {
				//@ts-ignore
				//TODO just type this to get rid of the ignore :P
				const message = res.errors.at(0)._errors[0].message;
				throw new FormError(password, message);
			}
		},
		{
			submitText: I18n.login.login(),
			method: "POST",
			headers: {
				"Content-type": "application/json; charset=UTF-8",
			},
			vsmaller: true,
		},
	);
	const button = form.button.deref();
	picker.giveButton(button);
	button?.classList.add("createAccount");

	const email = form.addTextInput(I18n.htmlPages.emailField(), "login");
	const password = form.addTextInput(I18n.htmlPages.pwField(), "password", {password: true});
	form.addCaptcha();
	const a = document.createElement("a");
	a.onclick = () => {
		dialog.hide();
		makeRegister(trasparentBg, "", handle);
	};
	a.textContent = I18n.htmlPages.noAccount();
	const rec = document.createElement("div");
	form.addHTMLArea(rec);
	form.addHTMLArea(a);
}
await I18n.done;
if (window.location.pathname.startsWith("/login")) {
	makeLogin();
}
