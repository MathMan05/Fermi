import {I18n} from "./i18n.js";
import {adduser, Specialuser} from "./utils/utils.js";
import {makeLogin} from "./login.js";
import {MarkDown} from "./markdown.js";
import {Dialog, FormError} from "./settings.js";
import {trimTrailingSlashes} from "./utils/netUtils";
export async function makeRegister(
	trasparentBg = false,
	instance = "",
	handle?: (user: Specialuser) => void,
) {
	const dialog = new Dialog("");
	const opt = dialog.options;
	opt.addTitle(I18n.htmlPages.createAccount());
	const picker = opt.addInstancePicker(
		(info) => {
			form.fetchURL = trimTrailingSlashes(info.api) + "/auth/register";
			tosLogic(md);
		},
		{instance},
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
				u.username = user.value;
				if (handle) {
					dialog.hide();
					handle(u);
					return;
				}
				const redir = new URLSearchParams(window.location.search).get("goback");
				if (redir && (!URL.canParse(redir) || new URL(redir).host === window.location.host)) {
					window.location.href = redir;
				} else {
					window.location.href = "/channels/@me";
				}
			}
		},
		{
			submitText: I18n.htmlPages.createAccount(),
			method: "POST",
			headers: {
				"Content-type": "application/json; charset=UTF-8",
				Referrer: window.location.href,
			},
			vsmaller: true,
		},
	);
	const button = form.button.deref();
	picker.giveButton(button);
	button?.classList.add("createAccount");

	const email = form.addTextInput(I18n.htmlPages.emailField(), "email");
	const user = form.addTextInput(I18n.htmlPages.userField(), "username");
	const p1 = form.addTextInput(I18n.htmlPages.pwField(), "password", {password: true});
	const p2 = form.addTextInput(I18n.htmlPages.pw2Field(), "password2", {password: true});
	form.addDateInput(I18n.htmlPages.dobField(), "date_of_birth");
	form.addPreprocessor((e) => {
		if (p1.value !== p2.value) {
			throw new FormError(p2, I18n.localuser.PasswordsNoMatch());
		}
		//@ts-expect-error it's there
		delete e.password2;
		if (!check.checked) throw new FormError(checkbox, I18n.register.tos());
		//@ts-expect-error it's there
		e.consent = check.checked;
	});
	const toshtml = document.createElement("div");
	const md = document.createElement("span");
	const check = document.createElement("input");
	check.type = "checkbox";

	toshtml.append(md, check);
	const checkbox = form.addHTMLArea(toshtml);
	form.addCaptcha();
	const a = document.createElement("a");
	a.onclick = () => {
		dialog.hide();
		makeLogin(trasparentBg);
	};
	a.textContent = I18n.htmlPages.alreadyHave();
	form.addHTMLArea(a);
}
async function tosLogic(box: HTMLElement) {
	const instanceInfo = JSON.parse(localStorage.getItem("instanceinfo") ?? "{}");
	const apiurl = new URL(instanceInfo.api);
	const urlstr = apiurl.toString();
	const response = await fetch(urlstr + (urlstr.endsWith("/") ? "" : "/") + "ping");
	const data = await response.json();
	const tosPage = data.instance.tosPage;
	if (!box) return;
	if (tosPage) {
		box.innerHTML = "";
		box.append(new MarkDown(I18n.register.agreeTOS(tosPage)).makeHTML());
	} else {
		box.textContent = I18n.register.noTOS();
	}
	console.log(tosPage);
}
if (window.location.pathname.startsWith("/register")) {
	await I18n.done;
	makeRegister();
}
