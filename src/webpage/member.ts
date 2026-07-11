import {User} from "./user.js";
import {Role} from "./role.js";
import {Guild} from "./guild.js";
import {SnowFlake} from "./snowflake.js";
import {highMemberJSON, memberjson, presencejson} from "./jsontypes.js";
import {I18n} from "./i18n.js";
import {Dialog, Options, Settings} from "./settings.js";
import {CDNParams} from "./utils/cdnParams.js";

class Member extends SnowFlake {
	static already = {};
	owner: Guild;
	user: User;
	roleIds = new Set<string>();
	nick!: string;
	avatar?: string;
	banner?: string;
	communication_disabled_until?: Date;
	get roles() {
		return this.guild.roles.filter((_) => this.roleIds.has(_.id));
	}
	private constructor(memberjson: memberjson, owner: Guild) {
		super(memberjson.id);
		this.owner = owner;
		if (this.localuser.userMap.has(memberjson.id)) {
			this.user = this.localuser.userMap.get(memberjson.id) as User;
		} else if (memberjson.user) {
			this.user = new User(memberjson.user, owner.localuser);
		} else {
			throw new Error("Missing user object of this member");
		}
		if (this.localuser.userMap.has(this?.id)) {
			this.user = this.localuser.userMap.get(this?.id) as User;
		}
		this.update(memberjson);
	}
	elms = new Set<WeakRef<HTMLElement>>();
	subName(elm: HTMLElement) {
		this.elms.add(new WeakRef(elm));
	}
	nameChange() {
		for (const ref of this.elms) {
			const elm = ref.deref();
			if (!elm || !document.contains(elm)) {
				this.elms.delete(ref);
				continue;
			}
			elm.textContent = this.name;
		}
	}
	commuicationDisabledLeft() {
		return this.communication_disabled_until
			? Math.max(+this.communication_disabled_until - Date.now(), 0)
			: 0;
	}
	remove() {
		this.user.members.delete(this.guild);
		this.guild.members.delete(this);
	}
	getpfpsrc(): string {
		if (this.hypotheticalpfp && this.avatar) {
			return this.avatar;
		}
		if (this.avatar !== undefined && this.avatar !== null) {
			return (
				`${this.info.cdn}/guilds/${this.guild.id}/users/${this.id}/avatars/${
					this.avatar
				}.${this.avatar.startsWith("a_") ? "gif" : "png"}` +
				new CDNParams({expectedSize: 96, animated: this.avatar.startsWith("a_")})
			);
		}
		return this.user.getpfpsrc();
	}
	getBannerUrl(): string | undefined {
		if (this.hypotheticalbanner && this.banner) {
			return this.banner;
		}
		if (this.banner) {
			return (
				`${this.info.cdn}/guilds/${this.guild.id}/users/${this.id}/banners/${
					this.banner
				}.${this.banner.startsWith("a_") ? "gif" : "png"}` +
				new CDNParams({expectedSize: 96, animated: this.banner.startsWith("a_")})
			);
		} else {
			return undefined;
		}
	}
	joined_at!: string;
	premium_since!: string;
	deaf!: boolean;
	mute!: boolean;
	pending!: boolean;
	clone() {
		return new Member(
			{
				id: this.id + "#clone",
				user: this.user.tojson(),
				guild_id: this.guild.id,
				guild: {id: this.guild.id},
				avatar: this.avatar as string | undefined,
				banner: this.banner as string | undefined,
				//TODO presence
				nick: this.nick,
				roles: [...this.roleIds],
				joined_at: this.joined_at,
				premium_since: this.premium_since,
				deaf: this.deaf,
				mute: this.mute,
				pending: this.pending,
			},
			this.owner,
		);
	}
	pronouns?: string;
	bio?: string;
	hypotheticalpfp = false;
	hypotheticalbanner = false;
	accent_color?: number;
	get headers() {
		return this.owner.headers;
	}

	updatepfp(file: Blob | null): void {
		const reader = new FileReader();
		if (file) {
			reader.readAsDataURL(file);
			reader.onload = () => {
				fetch(this.info.api + `/guilds/${this.guild.id}/members/${this.id}/`, {
					method: "PATCH",
					headers: this.headers,
					body: JSON.stringify({
						avatar: reader.result,
					}),
				});
			};
		} else {
			fetch(this.info.api + `/guilds/${this.guild.id}/members/${this.id}/`, {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					avatar: null,
				}),
			});
		}
	}
	updatebanner(file: Blob | null): void {
		if (file) {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				fetch(this.info.api + `/guilds/${this.guild.id}/profile/${this.id}`, {
					method: "PATCH",
					headers: this.headers,
					body: JSON.stringify({
						banner: reader.result,
					}),
				});
			};
		} else {
			fetch(this.info.api + `/guilds/${this.guild.id}/profile/${this.id}`, {
				method: "PATCH",
				headers: this.headers,
				body: JSON.stringify({
					banner: null,
				}),
			});
		}
	}

	updateProfile(json: {bio?: string | null; pronouns?: string | null; nick?: string | null}) {
		console.log(JSON.stringify(json));
		/*
		if(json.bio===""){
			json.bio=null;
		}
		if(json.pronouns===""){
			json.pronouns=null;
		}
		if(json.nick===""){
			json.nick=null;
		}
		*/
		fetch(this.info.api + `/guilds/${this.guild.id}/profile/${this.id}`, {
			method: "PATCH",
			headers: this.headers,
			body: JSON.stringify(json),
		});
	}
	showEditProfile() {
		const settings = new Settings("", true);
		this.editProfile(settings.addButton(I18n.user.editServerProfile(), {ltr: true}));
		settings.show();
	}

	showEditNick() {
		const dio = new Dialog("");
		const form = dio.options.addForm(
			"",
			() => {
				dio.hide();
			},
			{
				fetchURL: this.info.api + `/guilds/${this.guild.id}/members/${this.id}`,
				method: "PATCH",
				headers: this.headers,
			},
		);
		form.addTextInput(I18n.member["nick:"](), "nick", {
			initText: this.nick,
		});
		dio.show();
	}
	editProfile(options: Options) {
		if (this.hasPermission("CHANGE_NICKNAME")) {
			const hypotheticalProfile = document.createElement("div");
			let file: undefined | File | null = undefined;
			let newpronouns: string | undefined;
			let newbio: string | undefined;
			let nick: string | undefined;
			const hypomember = this.clone();

			let color: string;
			async function regen() {
				hypotheticalProfile.textContent = "";
				const hypoprofile = await hypomember.user.buildprofile(-1, -1, hypomember);

				hypotheticalProfile.appendChild(hypoprofile);
			}
			regen();
			const settingsLeft = options.addOptions("");
			const settingsRight = options.addOptions("");
			settingsRight.addHTMLArea(hypotheticalProfile);

			const nicky = settingsLeft.addTextInput(I18n.member["nick:"](), () => {}, {
				initText: this.nick || "",
			});
			nicky.watchForChange((_) => {
				hypomember.nick = _;
				nick = _;
				regen();
			});

			const finput = settingsLeft.addImageInput(
				I18n.uploadPfp(),
				(_) => {
					if (file !== undefined) {
						this.updatepfp(file);
					}
				},
				{clear: true, initImg: this.avatar ? this.getpfpsrc() : undefined},
			);
			finput.watchForChange((_) => {
				if (!_) {
					file = null;
					hypomember.avatar = undefined;
					hypomember.hypotheticalpfp = true;
					regen();
					return;
				}
				if (_.length) {
					file = _[0];
					const blob = URL.createObjectURL(file);
					hypomember.avatar = blob;
					hypomember.hypotheticalpfp = true;
					console.log(hypomember.getpfpsrc());
					regen();
				}
			});
			let bfile: undefined | File | null;
			const binput = settingsLeft.addImageInput(
				I18n.uploadBanner(),
				(_) => {
					if (bfile !== undefined) {
						this.updatebanner(bfile);
					}
				},
				{
					clear: true,
					width: 96 * 3,
					initImg: this.banner ? this.getBannerUrl() : "",
					objectFit: "cover",
				},
			);
			binput.watchForChange((_) => {
				if (!_) {
					bfile = null;
					hypomember.banner = undefined;
					hypomember.hypotheticalbanner = true;
					regen();
					return;
				}
				if (_.length) {
					bfile = _[0];
					const blob = URL.createObjectURL(bfile);
					hypomember.banner = blob;
					hypomember.hypotheticalbanner = true;
					regen();
				}
			});
			let changed = false;
			const pronounbox = settingsLeft.addTextInput(
				I18n.pronouns(),
				(_) => {
					if (newpronouns !== undefined || newbio !== undefined || changed !== undefined) {
						this.updateProfile({
							pronouns: newpronouns,
							bio: newbio,
							//accent_color: Number.parseInt("0x" + color.substr(1), 16),
							nick,
						});
					}
				},
				{initText: this.pronouns},
			);
			pronounbox.watchForChange((_) => {
				hypomember.pronouns = _;
				newpronouns = _;
				regen();
			});
			const bioBox = settingsLeft.addMDInput(I18n.bio(), (_) => {}, {
				initText: this.bio,
			});
			bioBox.watchForChange((_) => {
				newbio = _;
				hypomember.bio = _;
				regen();
			});
			color = (this.accent_color ? "#" + this.accent_color.toString(16) : "transparent") as string;

			const colorPicker = settingsLeft.addColorInput(I18n.profileColor(), (_) => {}, {
				initColor: color,
			});
			colorPicker.watchForChange((_) => {
				console.log();
				color = _;
				hypomember.accent_color = Number.parseInt("0x" + _.substring(1));
				changed = true;
				regen();
			});
		}
	}
	update(memberjson: memberjson) {
		const changeNick = this.nick !== memberjson.nick;
		for (const key of Object.keys(memberjson)) {
			if (key === "guild" || key === "owner" || key === "user") {
				continue;
			}
			if (key === "communication_disabled_until") {
				this.communication_disabled_until = new Date(
					memberjson.communication_disabled_until as string,
				);
				if (this.id === this.localuser.user.id) {
					this.guild.recalcPrivate();
				}
				continue;
			}

			if (key === "roles") {
				if ((memberjson.roles[0] as unknown) instanceof Object) {
					memberjson.roles = (memberjson.roles as any[]).map((_) => _.id);
					console.error("Member role is incorrectly sent as role object instead of role ID");
				}
				this.roleIds.clear();
				for (const strrole of memberjson.roles) {
					this.roleIds.add(strrole);
				}

				continue;
			}
			if (key === "presence") {
				this.getPresence(memberjson.presence);
				continue;
			}
			(this as any)[key] = (memberjson as any)[key];
		}

		this.roleIds.add(this.guild.id);

		if (changeNick) {
			this.nameChange();
		}
	}
	get guild() {
		return this.owner;
	}
	get localuser() {
		return this.guild.localuser;
	}
	get info() {
		return this.owner.info;
	}
	static newUnsafe(memberjson: memberjson, owner: Guild): Member {
		let user: User;
		if (owner.localuser.userMap.has(memberjson.id)) {
			if (memberjson.user) {
				new User(memberjson.user, owner.localuser);
			}
			user = owner.localuser.userMap.get(memberjson.id) as User;
		} else if (memberjson.user) {
			user = new User(memberjson.user, owner.localuser);
		} else {
			throw new Error("missing user object of this member");
		}
		if (user.members.has(owner)) {
			let memb = user.members.get(owner);
			if (memb instanceof Promise) {
				console.error("uh oh, that was a bad call!");
				//Welp, this is ignored in sync unsafe
			} else if (memb === undefined || memb instanceof Promise) {
				memb = new Member(memberjson, owner);
				user.members.set(owner, memb);
				owner.members.add(memb);
				user.localuser.memberListUpdate();
				return memb;
			} else {
				if (memberjson.presence) {
					memb.getPresence(memberjson.presence);
				}
				memb.update(memberjson);
				return memb;
			}
		}

		const memb = new Member(memberjson, owner);
		user.members.set(owner, memb);
		owner.members.add(memb);
		memb.localuser.memberListUpdate();
		return memb;
	}
	static async new(memberjson: memberjson, owner: Guild): Promise<Member> {
		let user: User;
		if (owner.localuser.userMap.has(memberjson.id)) {
			if (memberjson.user) {
				new User(memberjson.user, owner.localuser);
			}
			user = owner.localuser.userMap.get(memberjson.id) as User;
		} else if (memberjson.user) {
			user = new User(memberjson.user, owner.localuser);
		} else {
			throw new Error("missing user object of this member");
		}
		if (user.members.has(owner)) {
			let memb = user.members.get(owner);
			if (memb instanceof Promise) {
				const member = await memb; //I should do something else, though for now this is "good enough";
				if (member) {
					member.update(memberjson);
					return member;
				}
			}
			if (memb === undefined || memb instanceof Promise) {
				memb = new Member(memberjson, owner);
				user.members.set(owner, memb);
				owner.members.add(memb);
				user.localuser.memberListUpdate();
				return memb;
			} else {
				if (memberjson.presence) {
					memb.getPresence(memberjson.presence);
				}
				memb.update(memberjson);
				return memb;
			}
		} else {
			const memb = new Member(memberjson, owner);
			user.members.set(owner, memb);
			owner.members.add(memb);
			memb.localuser.memberListUpdate();
			return memb;
		}
	}
	compare(str: string) {
		function similar(str2: string | null | undefined) {
			if (!str2) return 0;
			const strl = Math.max(str.length, 1);
			if (str2.includes(str)) {
				return strl / str2.length;
			} else if (str2.toLowerCase().includes(str.toLowerCase())) {
				return strl / str2.length / 1.2;
			}
			return 0;
		}
		return Math.max(
			similar(this.user.name),
			similar(this.user.nickname),
			similar(this.nick),
			similar(this.user.username),
			similar(this.id) / 1.5,
		);
	}
	static async resolveMember(user: User, guild: Guild): Promise<Member | undefined> {
		if (guild.id === "@me") return;
		if (user.webhook) return undefined;
		const maybe = user.members.get(guild);
		if (!user.members.has(guild)) {
			const membpromise = guild.localuser.resolvemember(user.id, guild.id);
			const promise = new Promise<Member | undefined>(async (res) => {
				const membjson = await membpromise;
				if (membjson === undefined) {
					return res(undefined);
				} else {
					const member = new Member(membjson, guild);
					const map = guild.localuser.presences;
					member.getPresence(map.get(member.id));
					map.delete(member.id);
					res(member);
					guild.localuser.memberListQue();
					return member;
				}
			});
			user.members.set(guild, promise);
			const member = await promise;
			if (member) {
				guild.members.add(member);
			}
			user.members.set(guild, member);
			return member;
		}
		if (maybe instanceof Promise) {
			return await maybe;
		} else {
			return maybe;
		}
	}
	getRoleIcon() {
		for (const role of this.roles) {
			const icon = role.getIcon();
			if (icon) {
				return icon;
			}
		}
		return;
	}
	public getPresence(presence: presencejson | undefined) {
		this.user.getPresence(presence);
	}
	/**
	 * @todo
	 */
	async highInfo() {
		return (await (
			await fetch(
				this.info.api +
					"/users/" +
					this.id +
					"/profile?with_mutual_guilds=true&with_mutual_friends=true&guild_id=" +
					this.guild.id,
				{headers: this.guild.headers},
			)
		).json()) as highMemberJSON;
	}
	hasRole(ID: string) {
		return this.roleIds.has(ID);
	}
	getTopColor() {
		if (!this.localuser.perminfo.user.disableColors) {
			return "";
		}
		for (const thing of this.roles) {
			const color = thing.getColor();
			if (color) {
				return thing.id;
			}
		}
		return "";
	}
	getColor() {
		if (!this.localuser.perminfo.user.disableColors) {
			return "";
		}
		for (const thing of this.roles) {
			const color = thing.getColor();
			if (color) {
				return color;
			}
		}
		return "";
	}
	getColorStyle() {
		if (!this.localuser.perminfo.user.disableColors) {
			return undefined;
		}
		for (const thing of this.roles) {
			const color = thing.getColor();
			if (color) {
				return `var(--role-${thing.id})`;
			}
		}
		return undefined;
	}
	isAdmin() {
		for (const role of this.roles) {
			if (role.permissions.getPermission("ADMINISTRATOR")) {
				return true;
			}
		}
		return this.guild.properties.owner_id === this.user.id;
	}
	bind(html: HTMLElement) {
		if (html.tagName === "SPAN") {
			if (!this) {
				return;
			}
			/*
				if(this.error){

				}
				*/
			const id = this.getTopColor();
			if (id) html.style.setProperty("--userbg", `var(--role-${id})`);
		}

		//this.profileclick(html);
	}
	profileclick(/* html: HTMLElement */) {
		//to be implemented
	}
	get name() {
		return this.nick || this.user.name;
	}
	kick() {
		const menu = new Dialog("");
		const form = menu.options.addForm("", (e: any) => {
			this.kickAPI(e.reason);
			menu.hide();
		});
		form.addTitle(I18n.member.kick(this.name, this.guild.properties.name));
		form.addTextInput(I18n.member["reason:"](), "reason");
		menu.show();
	}
	timeout() {
		const menu = new Dialog("");
		const form = menu.options.addForm("", (e: any) => {
			this.timeoutAPI(e.reason, e.time);
			menu.hide();
		});
		form.addTitle(I18n.member.timeout(this.name));
		form.addTextInput(I18n.member["reason:"](), "reason");
		//TODO make this custom :3
		form.addSelect(
			I18n.member.timeoutTime(),
			"time",
			["60s", "5m", "10m", "1h", "1d", "1w"],
			{},
			[60, 300, 600, 60 * 60, 60 * 60 * 24, 60 * 60 * 24 * 7].map((_) => _ * 1000),
		);
		menu.show();
	}
	removeTimeout() {
		const headers = structuredClone(this.guild.headers);
		fetch(`${this.info.api}/guilds/${this.guild.id}/members/${this.id}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify({
				communication_disabled_until: null,
			}),
		});
	}
	timeoutAPI(reason: string, length: number) {
		const headers = structuredClone(this.guild.headers);
		(headers as any)["x-audit-log-reason"] = reason;
		fetch(`${this.info.api}/guilds/${this.guild.id}/members/${this.id}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify({
				communication_disabled_until: new Date(length + Date.now()) + "",
			}),
		});
	}
	kickAPI(reason: string) {
		const headers = structuredClone(this.guild.headers);
		(headers as any)["x-audit-log-reason"] = reason;
		fetch(`${this.info.api}/guilds/${this.guild.id}/members/${this.id}`, {
			method: "DELETE",
			headers,
		});
	}
	ban() {
		const menu = new Dialog("");
		const form = menu.options.addForm("", (e: any) => {
			this.banAPI(e.reason);
			menu.hide();
		});
		form.addTitle(I18n.member.ban(this.name, this.guild.properties.name));
		form.addTextInput(I18n.member["reason:"](), "reason");
		menu.show();
	}
	addRole(role: Role) {
		const roles = [...this.roleIds];
		roles.push(role.id);
		fetch(this.info.api + "/guilds/" + this.guild.id + "/members/" + this.id, {
			method: "PATCH",
			headers: this.guild.headers,
			body: JSON.stringify({roles}),
		});
	}
	removeRole(role: Role) {
		let roles = [...this.roleIds];
		roles = roles.filter((_) => _ !== role.id);
		fetch(this.info.api + "/guilds/" + this.guild.id + "/members/" + this.id, {
			method: "PATCH",
			headers: this.guild.headers,
			body: JSON.stringify({roles}),
		});
	}
	banAPI(reason: string) {
		const headers = structuredClone(this.guild.headers);
		(headers as any)["x-audit-log-reason"] = reason;
		fetch(`${this.info.api}/guilds/${this.guild.id}/bans/${this.id}`, {
			method: "PUT",
			headers,
		});
	}
	hasPermission(name: string, adminOver = true): boolean {
		if (this.isAdmin() && adminOver) {
			return true;
		}
		if (this.guild.member.commuicationDisabledLeft()) {
			const allowSet = new Set(["READ_MESSAGE_HISTORY", "VIEW_CHANNEL"]);
			if (!allowSet.has(name)) {
				return false;
			}
		}
		for (const thing of this.roles) {
			if (thing.permissions.getPermission(name)) {
				return true;
			}
		}
		return false;
	}
}
export {Member};
