import {Direct} from "./direct.js";
import {I18n} from "./i18n.js";
import {guildjson} from "./jsontypes.js";
import {Dialog} from "./settings.js";
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
	}
	async makeMenu() {
		if (this.owner instanceof Direct) {
			this.owner.freindDiv?.classList.remove("viewChannel");
		}
		if (this.localuser.channelfocus) {
			this.localuser.channelfocus.collectBox();
		}
		history.pushState(["@me", "discover"], "", "/channels/@me/discover");
		this.localuser.pageTitle(I18n.discovery());

		const channelTopic = document.getElementById("channelTopic") as HTMLSpanElement;
		channelTopic.removeAttribute("hidden");
		channelTopic.textContent = "";
		channelTopic.onclick = () => {};
		if (this.localuser.lookingguild) {
			this.localuser.lookingguild.html.classList.remove("serveropen");
		}

		this.localuser.lookingguild = undefined;
		this.localuser.channelfocus = undefined;

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
		content.textContent = I18n.guild.loadingDiscovery();

		scrollWrap.append(content);

		const guildsButton = document.createElement("button");
		guildsButton.textContent = I18n.guild.guilds();
		guildsButton.classList.add("discoverButton", "selected");
		channels.append(guildsButton);

		const res = await fetch(this.info.api + "/discoverable-guilds?limit=50", {
			headers: this.headers,
		});
		const json = await res.json();
		console.log([...json.guilds], json.guilds);
		//@ts-ignore
		json.guilds = json.guilds.sort((a, b) => {
			return b.member_count - a.member_count;
		});
		content.innerHTML = "";
		const title = document.createElement("h2");
		title.textContent = I18n.guild.disoveryTitle(json.guilds.length + "");
		content.appendChild(title);

		const guilds = document.createElement("div");
		guilds.id = "discovery-guild-content";

		json.guilds.forEach((guild: guildjson["properties"]) => {
			const content = document.createElement("div");
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
				let guildObj = this.localuser.guildids.get(guild.id);
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
		content.appendChild(guilds);
	}
	getIconURL(guild: guildjson["properties"]) {
		return createImg(
			this.info.cdn +
				(guild.icon
					? "/icons/" + guild.id + "/" + guild.icon + ".png?size=48"
					: "/embed/avatars/3.png"),
		);
	}
	getBannerURL(guild: guildjson["properties"]) {
		return (
			guild.banner &&
			createImg(this.info.cdn + "/icons/" + guild.id + "/" + guild.banner + ".png?size=256")
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
		let guildObj = this.localuser.guildids.get(guild.id);
		while (!guildObj) {
			guildObj = this.localuser.guildids.get(guild.id);
			await new Promise((res) => setTimeout(res, 100));
		}
		guildObj.loadGuild();
		guildObj.loadChannel();
	}
}
