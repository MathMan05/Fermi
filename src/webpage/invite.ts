import {I18n} from "./i18n.js";
import {AccountSwitcher} from "./utils/switcher.js";
import {createImg, getapiurls, getInstanceInfo, getStringURLMapPair} from "./utils/utils.js";
import {getBulkUsers, Specialuser} from "./utils/utils.js";
if (window.location.pathname.startsWith("/invite"))
	(async () => {
		const users = getBulkUsers();
		let well = new URLSearchParams(window.location.search).get("instance") || "harmony";
		const m = getStringURLMapPair()[0];
		while (m.size === 0) {
			await new Promise<void>((res) => setInterval(res, 10));
		}
		console.log(m);
		well = m.get(well.toLowerCase()) || (await getInstanceInfo(well))?.api || well;
		well = well.replace(/\/*$/gm, "");
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
		await I18n.done;
		if (!joinable.length) {
			document.getElementById("AcceptInvite")!.textContent = I18n.htmlPages.noAccount();
		}

		const code = window.location.pathname.split("/")[2];
		let guildinfo: any;

		fetch(`${urls!.api}/invites/${code}`, {
			method: "GET",
		})
			.then((response) => response.json())
			.then((json) => {
				if (json.code === 404) {
					document.getElementById("AcceptInvite")?.remove();
					document.getElementById("invitename")!.textContent = I18n.invite.notFound();
					document.getElementById("invitedescription")!.textContent = "";
					return;
				}
				const guildjson = json.guild;
				guildinfo = guildjson;
				document.getElementById("invitename")!.textContent = guildjson.name;
				document.getElementById("invitedescription")!.textContent = I18n.invite.longInvitedBy(
					json.inviter.username,
					guildjson.name,
				);
				if (guildjson.discovery_splash) {
					const img = createImg(
						`${urls!.cdn}/discovery-splashes/${guildjson.id}/${guildjson.discovery_splash}.png`,
					);
					img.classList.add("inviteBG");
					document.body.prepend(img);
					document.getElementById("invitebody")?.classList.add("moreShadow");
				}
				if (guildjson.banner) {
					const img = createImg(`${urls!.cdn}/banners/${guildjson.id}/${guildjson.banner}.png`);
					document.getElementById("inviteBanner")!.append(img);
				}
				if (guildjson.icon) {
					const img = document.createElement("img");
					img.src = `${urls!.cdn}/icons/${guildjson.id}/${guildjson.icon}.png`;
					img.classList.add("inviteGuild");
					document.getElementById("inviteimg")!.append(img);
				} else {
					const txt = guildjson.name
						.replace(/'s /g, " ")
						.replace(/\w+/g, (word: any[]) => word[0])
						.replace(/\s/g, "");
					const div = document.createElement("div");
					div.textContent = txt;
					div.classList.add("inviteGuild");
					document.getElementById("inviteimg")!.append(div);
				}
			});

		async function showAccounts() {
			console.log("showing!");
			const user = await new AccountSwitcher(
				(user) => {
					return !!(well && user.serverurls.wellknown.includes(well));
				},
				{
					loginText: () => I18n.login.login(),
					createOpt: true,
					loginurl:
						"/login?" +
						new URLSearchParams([
							["goback", window.location.href],
							["instance", well],
							["invite", code],
						]),
					registerurl:
						"/register?" +
						new URLSearchParams([
							["goback", window.location.href],
							["instance", well],
							["invite", code],
						]),
				},
			).show();
			fetch(`${urls!.api}/invites/${code}`, {
				method: "POST",
				headers: {
					Authorization: user.token,
				},
			}).then(() => {
				users.currentuser = user.uid;
				sessionStorage.setItem("currentuser", user.uid);
				localStorage.setItem("userinfos", JSON.stringify(users));
				window.location.href = "/channels/" + guildinfo.id;
			});
		}

		document.getElementById("AcceptInvite")!.addEventListener("click", (e) => {
			e.stopImmediatePropagation();
			showAccounts();
		});
	})();
