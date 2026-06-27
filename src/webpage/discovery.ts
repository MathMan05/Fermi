import {Contextmenu} from "./contextmenu.js";
import {Direct} from "./direct.js";
import {I18n} from "./i18n.js";
import {guildjson} from "./jsontypes.js";
import {ReportMenu} from "./reporting/report.js";
import {Dialog} from "./settings.js";
import {CDNParams} from "./utils/cdnParams.js";
import {getDeveloperSettings} from "./utils/storage/devSettings.js";
import {createImg} from "./utils/utils.js";

export class Discovery {
	owner: Direct;
	get info() {
		return this.owner.info;
	}
	get headers() {
		return this.owner.headers;
	}
	get localuser() {
		return this.owner.localuser;
	}
	constructor(owner: Direct) {
		this.owner = owner;
		this.context = this.makeContextMenu();
	}
	context: Contextmenu<string, () => HTMLElement>;
	makeContextMenu() {
		const menu = new Contextmenu<string, () => HTMLElement>("discovery");
		const local = this.localuser;
		menu.addButton(
			() => I18n.guild.report(),
			async function (elm) {
				const menu = await ReportMenu.makeReport("guild_discovery", local, {
					guild_id: this,
					dyn_preview: elm,
				});
				menu?.spawnMenu();
			},
			{
				visible: function () {
					const settings = getDeveloperSettings();
					return settings.reportSystem;
				},
				color: "red",
			},
		);
		return menu;
	}
	async makeMenu() {
		if (this.owner instanceof Direct) {
			this.owner.freindDiv?.classList.remove("viewChannel");
		}
		if (this.localuser.focusChannel) {
			this.localuser.focusChannel.collectBox();
		}
		history.pushState(["@me", "discover"], "", "/channels/@me/discover");
		this.localuser.pageTitle(I18n.discovery());

		const channelTopic = document.getElementById("channelTopic") as HTMLSpanElement;
		channelTopic.removeAttribute("hidden");
		channelTopic.textContent = "";
		channelTopic.onclick = () => {};
		if (this.localuser.focusGuild) {
			this.localuser.focusGuild.html.classList.remove("serveropen");
		}

		this.localuser.focusGuild = undefined;
		this.localuser.focusChannel = undefined;

		const loading = document.getElementById("loadingdiv") as HTMLDivElement;
		loading.classList.remove("loading");
		this.localuser.getSidePannel();

		const messages = document.getElementById("scrollWrap") as HTMLDivElement;
		for (const thing of Array.from(messages.getElementsByClassName("messagecontainer"))) {
			thing.remove();
		}

		const channels = document.getElementById("channels") as HTMLDivElement;
		channels.innerHTML = "";

		const banner = document.getElementById("servertd") as HTMLDivElement;
		banner.style.removeProperty("background-image");
		banner.classList.remove("Banner");
		banner.style.removeProperty("cursor");
		banner.onclick = () => {};

		(document.getElementById("serverName") as HTMLElement).textContent = I18n.discovery();

		const scrollWrap = document.getElementById("scrollWrap") as HTMLDivElement;
		scrollWrap.innerHTML = "";

		const content = document.createElement("div");
		content.classList.add("flexttb", "guildy", "messagecontainer");

		scrollWrap.append(content);

		const guildsButton = document.createElement("button");
		guildsButton.textContent = I18n.guild.guilds();
		guildsButton.classList.add("discoverButton", "selected");
		channels.append(guildsButton);
		const guilds = document.createElement("div");
		guilds.classList.add("discovery-guild-content");

		const title = document.createElement("h2");
		content.appendChild(title);

		const buttonRow = document.createElement("div");
		buttonRow.classList.add("flexltr");

		const render = async (offset = 0) => {
			guilds.textContent = I18n.guild.loadingDiscovery();
			const limit = 50;
			const res = await fetch(
				`${this.info.api}/discoverable-guilds?limit=${limit}&offset=${offset}`,
				{
					headers: this.headers,
				},
			);

			const json = (await res.json()) as {guilds: guildjson["properties"][]; total: number};
			console.log([...json.guilds], json.guilds);
			guilds.textContent = "";

			title.textContent = I18n.guild.disoveryTitle(json.total + "");

			content.appendChild(guilds);

			json.guilds.forEach((guild) => {
				const content = document.createElement("div");

				this.context.bindContextmenu(content, guild.id, () => {
					const div = document.createElement("div");
					div.classList.add("flexltr");
					const img = this.getIconURL(guild);
					img.classList.add("icon");
					img.crossOrigin = "anonymous";

					img.alt = "";
					div.appendChild(img);

					const name = document.createElement("h3");
					name.textContent = guild.name;
					div.appendChild(name);
					return div;
				});
				content.classList.add("discovery-guild");
				const banner = this.getBannerURL(guild);
				if (banner) {
					banner.classList.add("banner");
					banner.crossOrigin = "anonymous";
					banner.alt = "";
					content.appendChild(banner);
				}

				const nameContainer = document.createElement("div");
				nameContainer.classList.add("flex");
				const img = this.getIconURL(guild);
				img.classList.add("icon");
				img.crossOrigin = "anonymous";

				img.alt = "";
				nameContainer.appendChild(img);

				const name = document.createElement("h3");
				name.textContent = guild.name;
				nameContainer.appendChild(name);
				content.appendChild(nameContainer);
				const desc = document.createElement("p");
				desc.textContent = guild.description;
				content.appendChild(desc);

				content.addEventListener("click", async () => {
					let guildObj = this.localuser.guilds.get(guild.id);
					if (guildObj) {
						guildObj.loadGuild();
						guildObj.loadChannel();
						return;
					}
					if (await this.confirmJoin(guild)) {
						await this.join(guild);
					}
				});
				guilds.appendChild(content);
			});

			let switching = false;

			buttonRow.textContent = "";

			if (offset !== 0) {
				const back = document.createElement("button");
				back.textContent = I18n.search.back();
				buttonRow.append(back);
				back.onclick = () => {
					if (switching) return;
					switching = true;
					render(offset - limit);
				};
			}
			//TODO once https://codeberg.org/MelodyChat/Harmony/pulls/77 is merged this should be reverted to a < only, the === case means there is no more, though right now server side logic is incorrect.
			if (offset + json.guilds.length <= json.total) {
				const next = document.createElement("button");
				next.textContent = I18n.search.next();
				buttonRow.append(next);
				next.onclick = () => {
					if (switching) return;
					switching = true;
					render(offset + limit);
				};
			}
			content.append(buttonRow);
		};

		render();
	}
	getIconURL(guild: guildjson["properties"]) {
		return createImg(
			this.info.cdn +
				(guild.icon
					? "/icons/" + guild.id + "/" + guild.icon + ".png" + new CDNParams({expectedSize: 48})
					: "/embed/avatars/3.png"),
		);
	}
	getBannerURL(guild: guildjson["properties"]) {
		return (
			guild.banner &&
			createImg(this.info.cdn + "/banners/" + guild.id + "/" + guild.banner + ".png?size=256")
		);
	}
	async confirmJoin(guild: guildjson["properties"]) {
		return new Promise<boolean>((res) => {
			const dio = new Dialog(I18n.guild.joinConfirm(guild.name));
			const opt = dio.options;

			const div = document.createElement("div");
			div.classList.add("flexltr", "guildPreview");
			const img = this.getIconURL(guild);
			img.classList.add("icon");
			img.crossOrigin = "anonymous";
			img.alt = "";
			div.append(img);
			const banner = this.getBannerURL(guild);
			if (banner) {
				banner.classList.add("banner");
				banner.crossOrigin = "anonymous";
				banner.alt = "";
				div.append(banner);
			}

			opt.addHTMLArea(div);
			opt.addText(I18n.guild.memberCount(guild.member_count + ""));

			if (guild.description) opt.addText(I18n.guild["description:"]() + "\n" + guild.description);

			const buttons = opt.addOptions("", {ltr: true});
			buttons.addButtonInput("", I18n.yes(), () => {
				dio.hide();
				res(true);
			});
			buttons.addButtonInput("", I18n.no(), () => {
				dio.hide();
				res(false);
			});
			dio.show();
		});
	}
	async join(guild: guildjson["properties"]) {
		await fetch(this.info.api + "/guilds/" + guild.id + "/members/@me", {
			method: "PUT",
			headers: this.headers,
		});
		let guildObj = this.localuser.guilds.get(guild.id);
		while (!guildObj) {
			guildObj = this.localuser.guilds.get(guild.id);
			await new Promise((res) => setTimeout(res, 100));
		}
		guildObj.loadGuild();
		guildObj.loadChannel();
	}
}
