import {I18n} from "../i18n.js";
import {getapiurls} from "../utils/utils.js";
import {getBulkUsers, Specialuser} from "../utils/utils.js";
import {Permissions} from "../permissions.js";
import {AccountSwitcher} from "../utils/switcher.js";
import {handle2fa} from "../settings.js";
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
		verify_key: string; //application client secret
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
	const well = params.get("instance") || "http://localhost:3001";
	const permstr = params.get("permissions");

	const response_type = params.get("response_type");
	const scopes = params.get("scope");

	const guildPick = scopes?.includes("bot");

	const joinable: Specialuser[] = [];

	for (const key in users.users) {
		if (Object.prototype.hasOwnProperty.call(users.users, key)) {
			const user: Specialuser = users.users[key];
			if (well && user.serverurls.wellknown.includes(well)) {
				joinable.push(user);
			}
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
	const headers = {
		"Content-type": "application/json; charset=UTF-8",
		Authorization: "",
	} as Record<string, string>;
	async function OAuth2(user: Specialuser, guild_id?: string) {
		if (!urls) return;
		headers.Authorization = user.token;
		const j = (await (
			await fetch(urls.api + "/oauth2/authorize?" + params, {
				method: "POST",
				body: JSON.stringify({
					authorize: true,
					guild_id,
					permissions: permstr,
				}),
				headers,
			})
		).json()) as {location: string};
		const b = await handle2fa(j, urls.api, headers);
		if (typeof b === "string") {
			headers["X-Discord-MFA-Authorization"] = b;
			return OAuth2(user, guild_id);
		}
		if (j.location) {
			window.location.assign(j.location);
		} else {
			window.close();
		}
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
					OAuth2(user, id);
				};
				document.body.append(dialog);
			});
	}
	async function showAccounts(e?: MouseEvent) {
		e?.preventDefault();
		e?.stopImmediatePropagation();
		const s = new AccountSwitcher((u) => {
			console.log(u, well);
			if (well && u.serverurls.wellknown.includes(well)) {
				return true;
			}
			return false;
		});
		const su = await s.show();
		if (guildPick) showGuilds(su);
		else OAuth2(su);
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
					if (guildPick) {
						title.textContent = I18n.oauth2.botGuild(json.bot.username);
					} else {
						title.textContent = I18n.oauth2.grantApp(json.application.name);
					}
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

				if (permstr) {
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
				if (response_type === "token" || response_type === "code") {
					if (scopes)
						for (const scope of scopes.split(",")) {
							const div = document.createElement("div");
							const h2 = document.createElement("h2");
							h2.textContent =
								scope in I18n.oauth2.readableNames
									? I18n.oauth2.readableNames[scope as keyof typeof I18n.oauth2.readableNames]()
									: scope;
							div.append(h2);
							div.classList.add("flexttb");
							perms.append(div);
						}
					{
						const div = document.createElement("div");
						const h2 = document.createElement("h2");
						h2.textContent = I18n.oauth2.baseScope();
						div.append(h2);
						div.classList.add("flexttb");
						perms.append(div);
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
