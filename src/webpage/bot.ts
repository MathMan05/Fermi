import {mainuserjson} from "./jsontypes.js";
import {Localuser} from "./localuser.js";
import {MarkDown} from "./markdown.js";
import {Form, Settings} from "./settings.js";
import {User} from "./user.js";
import {guildjson} from "./jsontypes.js";
import {PermissionToggle} from "./role.js";
import {Permissions} from "./permissions.js";
import {I18n} from "./i18n.js";
import {CDNParams} from "./utils/cdnParams.js";
class Bot {
	readonly owner: Localuser;
	readonly token: string;
	readonly json: mainuserjson;
	headers: {"Content-type": string; Authorization: string};
	get localuser() {
		return this.owner;
	}
	get info() {
		return this.localuser.info;
	}
	constructor(json: mainuserjson, token: string, owner: Localuser) {
		this.owner = owner;
		this.token = token;
		this.json = json;
		this.headers = {
			"Content-type": "application/json; charset=UTF-8",
			Authorization: token,
		};
	}
	settings() {
		const settings = new Settings(I18n.botSettings());
		const botOptions = settings.addButton("Profile", {ltr: true});
		const bot = new User(this.json, this.localuser);
		{
			const hypotheticalProfile = document.createElement("div");

			let file: undefined | File | null;
			let newpronouns: string | undefined;
			let newbio: string | undefined;
			const hypouser = bot.clone();
			let color: string;
			async function regen() {
				hypotheticalProfile.textContent = "";
				const hypoprofile = await hypouser.buildprofile(-1, -1);

				hypotheticalProfile.appendChild(hypoprofile);
			}
			regen();
			const settingsLeft = botOptions.addOptions("");
			const settingsRight = botOptions.addOptions("");
			settingsRight.addHTMLArea(hypotheticalProfile);

			const finput = settingsLeft.addFileInput(
				I18n.uploadPfp(),
				(_) => {
					if (file) {
						this.updatepfp(file);
					}
				},
				{clear: true},
			);
			finput.watchForChange((_) => {
				if (!_) {
					file = null;
					hypouser.avatar = null;
					hypouser.hypotheticalpfp = true;
					regen();
					return;
				}
				if (_.length) {
					file = _[0];
					const blob = URL.createObjectURL(file);
					hypouser.avatar = blob;
					hypouser.hypotheticalpfp = true;
					regen();
				}
			});
			let bfile: undefined | File | null;
			const binput = settingsLeft.addFileInput(
				I18n.uploadBanner(),
				(_) => {
					if (bfile !== undefined) {
						this.updatebanner(bfile);
					}
				},
				{clear: true},
			);
			binput.watchForChange((_) => {
				if (!_) {
					bfile = null;
					hypouser.banner = undefined;
					hypouser.hypotheticalbanner = true;
					regen();
					return;
				}
				if (_.length) {
					bfile = _[0];
					const blob = URL.createObjectURL(bfile);
					hypouser.banner = blob;
					hypouser.hypotheticalbanner = true;
					regen();
				}
			});
			let changed = false;
			const pronounbox = settingsLeft.addTextInput(
				I18n.pronouns(),
				(_) => {
					if (newpronouns || newbio || changed) {
						this.updateProfile({
							pronouns: newpronouns,
							bio: newbio,
							accent_color: Number.parseInt("0x" + color.substr(1), 16),
						});
					}
				},
				{initText: bot.pronouns},
			);
			pronounbox.watchForChange((_) => {
				hypouser.pronouns = _;
				newpronouns = _;
				regen();
			});
			const bioBox = settingsLeft.addMDInput(I18n.bio(), (_) => {}, {
				initText: bot.bio.rawString,
				maxLength: this.localuser.instanceLimits.user?.maxBio ?? 9999
			});
			bioBox.watchForChange((_) => {
				newbio = _;
				hypouser.bio = new MarkDown(_, this.owner);
				regen();
			});

			if (bot.accent_color) {
				color = "#" + bot.accent_color.toString(16);
			} else {
				color = "transparent";
			}
			const colorPicker = settingsLeft.addColorInput(I18n.profileColor(), (_) => {}, {
				initColor: color,
			});
			colorPicker.watchForChange((_) => {
				console.log();
				color = _;
				hypouser.accent_color = Number.parseInt("0x" + _.substr(1), 16);
				changed = true;
				regen();
			});
		}
		{
			const guildsettings = settings.addButton("Guilds");
			guildsettings.addTitle(I18n.botGuilds());
			fetch(this.info.api + "/users/@me/guilds/", {
				headers: this.headers,
			})
				.then((_) => _.json())
				.then((json: guildjson["properties"][]) => {
					for (const guild of json) {
						const content = document.createElement("div");
						content.classList.add("discovery-guild");

						if (guild.banner) {
							const banner = document.createElement("img");
							banner.classList.add("banner");
							banner.crossOrigin = "anonymous";
							banner.src =
								this.info.cdn +
								"/banners/" +
								guild.id +
								"/" +
								guild.banner +
								".png" +
								new CDNParams({expectedSize: 256});
							banner.alt = "";
							content.appendChild(banner);
						}

						const nameContainer = document.createElement("div");
						nameContainer.classList.add("flex");
						const img = document.createElement("img");
						img.classList.add("icon");
						img.crossOrigin = "anonymous";
						img.src =
							this.info.cdn +
							(guild.icon
								? "/icons/" +
									guild.id +
									"/" +
									guild.icon +
									".png" +
									new CDNParams({expectedSize: 96})
								: "/embed/avatars/3.png");
						img.alt = "";
						nameContainer.appendChild(img);

						const name = document.createElement("h3");
						name.textContent = guild.name;
						nameContainer.appendChild(name);
						content.appendChild(nameContainer);
						const desc = document.createElement("p");
						desc.textContent = guild.description;
						content.appendChild(desc);

						guildsettings.addHTMLArea(content);
						content.onclick = () => {
							const guildsetting = guildsettings.addSubOptions(guild.name);
							guildsetting.addHTMLArea(content);
							guildsetting.addButtonInput("", I18n.leaveGuild(), () => {
								if (confirm(I18n.confirmGuildLeave(guild.name))) {
									fetch(this.info.api + "/users/@me/guilds/" + guild.id, {
										method: "DELETE",
										headers: this.headers,
									});
								}
							});
						};
					}
				});
		}
		settings.show();
	}

	updatepfp(file: Blob): void {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			fetch(this.info.api + "/users/@me", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					avatar: reader.result,
				}),
			});
		};
	}
	updatebanner(file: Blob | null): void {
		if (file) {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				fetch(this.info.api + "/users/@me", {
					method: "PATCH",
					headers: this.headers,
					body: JSON.stringify({
						banner: reader.result,
					}),
				});
			};
		} else {
			fetch(this.info.api + "/users/@me", {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					banner: null,
				}),
			});
		}
	}
	updateProfile(json: {bio?: string; pronouns?: string; accent_color?: number}) {
		fetch(this.info.api + "/users/@me/profile", {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify(json),
		});
	}
	static InviteMaker(id: string, container: Form, info: Localuser["info"]) {
		const gen = container.addSubOptions(I18n.UrlGen(), {
			noSubmit: true,
		});
		const params = new URLSearchParams("");
		params.set("instance", info.wellknown);
		params.set("client_id", id);
		params.set("scope", "bot");
		const url = gen.addText("");
		const perms = new Permissions("0");
		for (const perm of Permissions.info()) {
			const permsisions = new PermissionToggle(perm, perms, gen);
			gen.options.push(permsisions);
			gen.generate(permsisions);
		}
		const cancel = setInterval(() => {
			if (!gen.container.deref()) {
				clearInterval(cancel);
			}
			params.set("permissions", perms.allow.toString());
			const encoded = params.toString();
			const urlStr = `${location.origin}/oauth2/authorize?${encoded}`;
			if (urlStr == url.elm.deref()?.textContent) return;
			console.log(urlStr, url.text);
			url.setText(urlStr);
		}, 100);
	}
}
export {Bot};
