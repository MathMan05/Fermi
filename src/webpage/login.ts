import {instanceinfo, adduser} from "./utils/utils.js";
import {I18n} from "./i18n.js";
import {Dialog} from "./settings.js";
import {makeRegister} from "./register.js";
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

export async function makeLogin(trasparentBg = false, instance = "") {
	const dialog = new Dialog("");
	const opt = dialog.options;
	opt.addTitle(I18n.login.login());
	const picker = opt.addInstancePicker(
		(info) => {
			const api = info.login + (info.login.startsWith("/") ? "/" : "");
			form.fetchURL = api + "/auth/login";
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
				adduser({
					serverurls: JSON.parse(localStorage.getItem("instanceinfo") as string),
					email: email.value,
					token: res.token,
				}).username = email.value;
				const redir = new URLSearchParams(window.location.search).get("goback");
				if (redir) {
					window.location.href = redir;
				} else {
					window.location.href = "/channels/@me";
				}
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
	form.addTextInput(I18n.htmlPages.pwField(), "password", {password: true});
	form.addCaptcha();
	const a = document.createElement("a");
	a.onclick = () => {
		dialog.hide();
		makeRegister(trasparentBg);
	};
	a.textContent = I18n.htmlPages.noAccount();
	const rec = document.createElement("div");
	form.addHTMLArea(rec);
	form.addHTMLArea(a);

	const forgot = document.createElement("a");
	forgot.href = "/reset";
	forgot.textContent = I18n.htmlPages.forgotPassword();
	const rec_forgot = document.createElement("div");
	form.addHTMLArea(rec_forgot);
	form.addHTMLArea(forgot);
}
await I18n.done;
if (window.location.pathname.startsWith("/login")) {
	makeLogin();
}
