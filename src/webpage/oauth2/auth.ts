import {I18n} from "../i18n.js";
import {getapiurls} from "../utils/utils.js";
import {getBulkUsers, Specialuser} from "../utils/utils.js";
import {Permissions} from "../permissions.js";
type botjsonfetch = {
	guilds: {
		id: string;
		name: string;
		icon: string;
		mfa_level: number;
		permissions: string;
	}[];
	user: {
		id: string;
		username: string;
		avatar: string;
		avatar_decoration?: string;
		discriminator: string;
		public_flags: number;
	};
	application: {
		id: string;
		name: string;
		icon: string | null;
		description: string;
		summary: string;
		type: null; //not sure what this means :P
		hook: boolean;
		guild_id: null | string;
		bot_public: boolean;
		bot_require_code_grant: boolean;
		verify_key: "IMPLEMENTME"; //no clue what this is meant to be :P
		flags: number;
	};
	bot: {
		id: string;
		username: string;
		avatar: string | null;
		avatar_decoration: null | string;
		discriminator: string;
		public_flags: number;
		bot: boolean;
		approximated_guild_count: number;
	};
	authorized: boolean;
};
if (window.location.pathname.startsWith("/oauth2")) {
	const users = getBulkUsers();
	const params = new URLSearchParams(window.location.search);
	//TODO replace me
	const well = params.get("instance") || "https://spacebar.chat";
	const permstr = params.get("permissions");
	const joinable: Specialuser[] = [];

	for (const key in users.users) {
		if (Object.prototype.hasOwnProperty.call(users.users, key)) {
			const user: Specialuser = users.users[key];
			if (well && user.serverurls.wellknown.includes(well)) {
				joinable.push(user);
			}
			console.log(user);
		}
	}

	let urls: {api: string; cdn: string} | undefined;

	if (!joinable.length && well) {
		const out = await getapiurls(well);
		if (out) {
			urls = out;
			for (const key in users.users) {
				if (Object.prototype.hasOwnProperty.call(users.users, key)) {
					const user: Specialuser = users.users[key];
					if (user.serverurls.api.includes(out.api)) {
						joinable.push(user);
					}
					console.log(user);
				}
			}
		} else {
			throw new Error("Someone needs to handle the case where the servers don't exist");
		}
	} else {
		urls = joinable[0].serverurls;
	}

	if (!joinable.length) {
		document.getElementById("AcceptInvite")!.textContent = "Create an account to invite the bot";
	}
	await I18n.done;
	function showGuilds(user: Specialuser) {
		if (!urls) return;
		fetch(urls.api + "/oauth2/authorize/" + window.location.search, {
			headers: {
				Authorization: user.token,
			},
		})
			.then((_) => _.json())
			.then((json: botjsonfetch) => {
				const guilds: botjsonfetch["guilds"] = [];
				for (const guild of json.guilds) {
					const permisions = new Permissions(guild.permissions);
					if (permisions.hasPermission("MANAGE_GUILD")) {
						guilds.push(guild);
					}
				}
				const dialog = document.createElement("dialog");
				dialog.classList.add("flexttb", "accountSwitcher");
				const h1 = document.createElement("h1");
				dialog.append(h1);
				h1.textContent = "Invite to server:";
				const select = document.createElement("select");
				const selectSpan = document.createElement("span");
				selectSpan.classList.add("selectspan");
				const selectArrow = document.createElement("span");
				selectArrow.classList.add("svgicon", "svg-category", "selectarrow");
				for (const guild of guilds) {
					const option = document.createElement("option");
					option.textContent = guild.name;
					option.value = guild.id;
					select.append(option);
				}
				selectSpan.append(select);
				selectSpan.append(selectArrow);
				dialog.append(selectSpan);
				const button = document.createElement("button");
				button.textContent = "Invite";
				dialog.append(button);
				button.onclick = () => {
					const id = select.value;
					const params2 = new URLSearchParams("");
					params2.set("client_id", params.get("client_id") as string);
					fetch(urls.api + "/oauth2/authorize?" + params2.toString(), {
						method: "POST",
						body: JSON.stringify({
							authorize: true,
							guild_id: id,
							permissions: permstr,
						}),
						headers: {
							"Content-type": "application/json; charset=UTF-8",
							Authorization: user.token,
						},
					}).then((req) => {
						if (req.ok) {
							alert("Bot added successfully");
						}
					});
				};
				document.body.append(dialog);
			});
	}
	function showAccounts(): void {
		const table = document.createElement("dialog");
		for (const user of joinable) {
			console.log(user.pfpsrc);

			const userinfo = document.createElement("div");
			userinfo.classList.add("flexltr", "switchtable");

			const pfp = document.createElement("img");
			pfp.src = user.pfpsrc;
			pfp.classList.add("pfp");
			userinfo.append(pfp);

			const userDiv = document.createElement("div");
			userDiv.classList.add("userinfo");
			userDiv.textContent = user.username;
			userDiv.append(document.createElement("br"));

			const span = document.createElement("span");
			span.textContent = user.serverurls.wellknown.replace("https://", "").replace("http://", "");
			span.classList.add("serverURL");
			userDiv.append(span);

			userinfo.append(userDiv);
			table.append(userinfo);

			userinfo.addEventListener("click", () => {
				table.remove();
				showGuilds(user);
			});
		}

		const td = document.createElement("div");
		td.classList.add("switchtable");
		td.textContent = "Login or create an account ⇌";
		td.addEventListener("click", () => {
			const l = new URLSearchParams("?");
			l.set("goback", window.location.href);
			l.set("instance", well!);
			window.location.href = "/login?" + l.toString();
		});

		if (!joinable.length) {
			const l = new URLSearchParams("?");
			l.set("goback", window.location.href);
			l.set("instance", well!);
			window.location.href = "/login?" + l.toString();
		}

		table.append(td);
		table.classList.add("flexttb", "accountSwitcher");
		console.log(table);
		document.body.append(table);
	}
	const user = joinable[0];
	if (user) {
		fetch(urls.api + "/oauth2/authorize/" + window.location.search, {
			headers: {
				Authorization: user.token,
			},
		})
			.then((_) => _.json())
			.then((json: botjsonfetch) => {
				const title = document.getElementById("invitename");
				if (title) {
					title.textContent = `Invite ${json.bot.username} to your servers`;
				}
				const desc = document.getElementById("invitedescription");
				if (desc) {
					desc.textContent = json.application.description;
				}
				const pfp = document.getElementById("inviteimg") as HTMLImageElement;
				if (json.bot.avatar !== null) {
					pfp.src = `${urls.cdn}/avatars/${json.bot.id}/${json.bot.avatar}.png`;
				} else {
					const int = Number((BigInt(json.bot.id) >> 22n) % 6n);
					pfp.src = `${urls.cdn}/embed/avatars/${int}.png`;
				}
				const perms = document.getElementById("permissions") as HTMLDivElement;

				if (perms && permstr) {
					perms.children[0].textContent = I18n.htmlPages.idpermissions();
					const permisions = new Permissions(permstr);
					for (const perm of Permissions.info()) {
						if (permisions.hasPermission(perm.name, false)) {
							const div = document.createElement("div");
							const h2 = document.createElement("h2");
							h2.textContent = perm.readableName;
							div.append(h2, perm.description);
							div.classList.add("flexttb");
							perms.append(div);
						}
					}
				}
			});
	}
	const AcceptInvite = document.getElementById("AcceptInvite");
	if (AcceptInvite) {
		AcceptInvite.addEventListener("click", showAccounts);
		AcceptInvite.textContent = I18n.htmlPages.addBot();
	}
}
