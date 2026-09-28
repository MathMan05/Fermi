import {Hover} from "./hover";
import {I18n, langmap} from "./i18n";
import {ConnectionJson, expSessionJson} from "./jsontypes";
import {Localuser, trace, traceObj} from "./localuser";
import {MarkDown} from "./markdown";
import {buttonColor, Dialog, FormError, Settings} from "./settings";
import {CDNParams} from "./utils/cdnParams";
import {getDeveloperSettings, setDeveloperSettings} from "./utils/storage/devSettings";
import {getLocalSettings, ServiceWorkerModeValues} from "./utils/storage/localSettings";
import {getShortcuts, setShortcuts} from "./utils/storage/shortcuts";
import {
	AnimateTristateValues,
	ClockFormatOverrideValues,
	getPreferences,
	setPreferences,
	ThemeOption,
} from "./utils/storage/userPreferences";
import {createImg, getapiurls, installPGet, setTheme, SW} from "./utils/utils";

export async function showusersettings(localuser: Localuser) {
	const prefs = getPreferences();
	const localSettings = getLocalSettings();
	const settings = new Settings(I18n.localuser.settings());
	{
		const donate = settings.addButton(I18n.donate.donate(), {initable: false});
		donate.addMDText(new MarkDown(I18n.donate.mdText(window.location.origin + "/donate")));
		donate.addText(I18n.donate.desc());
	}
	settings.addButton(I18n.localuser.general(), {
		head: true,
	});
	{
		const userOptions = settings.addButton(I18n.localuser.userSettings(), {
			ltr: true,
			contained: true,
		});
		const hypotheticalProfile = document.createElement("div");
		let file: undefined | File | null;
		let newpronouns: string | undefined;
		let newbio: string | undefined;
		const hypouser = localuser.user.clone();
		let color: string;
		async function regen() {
			hypotheticalProfile.textContent = "";
			const hypoprofile = await hypouser.buildprofile(-1, -1);

			hypotheticalProfile.appendChild(hypoprofile);
		}
		regen();
		const settingsLeft = userOptions.addOptions("");
		const settingsRight = userOptions.addOptions("");
		settingsRight.addHTMLArea(hypotheticalProfile);

		const finput = settingsLeft.addImageInput(
			I18n.uploadPfp(),
			(_) => {
				if (file !== undefined) {
					localuser.updatepfp(file);
				}
			},
			{clear: true, initImg: localuser.user.getpfpsrc()},
		);
		finput.img.classList.add("pfp");
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
		const binput = settingsLeft.addImageInput(
			I18n.uploadBanner(),
			(_) => {
				if (bfile !== undefined) {
					localuser.updatebanner(bfile);
				}
			},
			{
				clear: true,
				width: 96 * 3,
				initImg: localuser.user.banner ? localuser.user.getBannerUrl() : "",
				objectFit: "cover",
			},
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
				if (newpronouns !== undefined || newbio !== undefined || changed !== undefined) {
					localuser.updateProfile({
						pronouns: newpronouns,
						bio: newbio,
						accent_color: Number.parseInt("0x" + color.substring(1), 16),
					});
				}
			},
			{initText: localuser.user.pronouns, charLimit: localuser.conf.maxPronouns},
		);
		pronounbox.watchForChange((_) => {
			hypouser.pronouns = _;
			newpronouns = _;
			regen();
		});
		const bioBox = settingsLeft.addMDInput(I18n.bio(), (_) => {}, {
			initText: localuser.user.bio.rawString,
			charLimit: localuser.conf.maxBio,
		});
		bioBox.watchForChange((_) => {
			newbio = _;
			hypouser.bio = new MarkDown(_, localuser);
			regen();
		});

		if (localuser.user.accent_color) {
			color = "#" + localuser.user.accent_color.toString(16);
		} else {
			color = "transparent";
		}
		const colorPicker = settingsLeft.addColorInput(I18n.profileColor(), (_) => {}, {
			initColor: color,
		});

		colorPicker.watchForChange((_) => {
			console.log();
			color = _;
			hypouser.accent_color = Number.parseInt("0x" + _.substring(1), 16);
			changed = true;
			regen();
		});
		settingsLeft.addButtonInput("", I18n.localuser.connections(), () => {
			const connections = userOptions.addSubOptions(I18n.localuser.connections());
			const connectionContainer = document.createElement("div");
			const actConDivCont = document.createElement("div");

			connectionContainer.classList.add("connection-container");
			localuser.conectionChange = () => {
				if (document.contains(settings.html)) {
					remake();
				} else {
					localuser.conectionChange = () => {};
				}
			};
			const remake = () => {
				connectionContainer.innerHTML = "";
				actConDivCont.innerHTML = "";
				const cons = fetch(localuser.info.api + "/users/@me/connections", {
					headers: localuser.headers,
				});

				localuser.getConnections().then(async (json) => {
					const actCons = (await (await cons).json()) as ConnectionJson[];
					const actConMap = new Map<string, ConnectionJson>(
						actCons.map((_) => [_.type, _] as const),
					);
					const serverConnections = Object.keys(json).sort((key) => (json[key].enabled ? -1 : 1));

					serverConnections
						.filter((_) => !actConMap.has(_))
						.forEach((key) => {
							if (key === "domain") return;
							const connection = json[key];

							const container = document.createElement("div");
							if (connection.icon_url) {
								const span = document.createElement("span");
								span.classList.add("conImg", "svgicon");
								span.style.setProperty("mask", `url("${connection.icon_url}")`);
								//span.alt = key;
								container.append(span);
							} else {
								container.textContent = key.charAt(0).toUpperCase() + key.slice(1);
							}

							if (connection.enabled) {
								container.addEventListener("click", async () => {
									const connectionRes = await fetch(
										localuser.info.api + "/connections/" + key + "/authorize",
										{
											headers: localuser.headers,
										},
									);
									const connectionJSON = await connectionRes.json();
									window.open(connectionJSON.url, "_blank", "noopener noreferrer");
								});
							} else {
								container.classList.add("disabled");
							}

							connectionContainer.appendChild(container);
						});

					const container = document.createElement("div");

					const span = document.createElement("span");
					span.classList.add("conImg", "svgicon");
					span.style.setProperty("mask", `url("/icons/domain.svg")`);
					container.append(span);

					container.addEventListener("click", async () => {
						localuser.domainVerification();
					});

					connectionContainer.appendChild(container);

					serverConnections
						.filter((_) => actConMap.has(_))
						.forEach((_) => {
							const con = actConMap.get(_);
							if (!con) return;
							const connectionObj = json[_];

							const actConDiv = document.createElement("div");
							actConDiv.classList.add("flexttb", "actConnectionDiv");
							const topRow = document.createElement("div");
							actConDiv.append(topRow);
							topRow.classList.add("flexltr");
							if (connectionObj.icon_url) {
								const span = document.createElement("span");
								span.classList.add("conImg", "svgicon");
								span.style.setProperty("mask", `url("${connectionObj.icon_url}")`);
								//span.alt = key;
								topRow.append(span);
							}

							const nameDiv = document.createElement("div");
							nameDiv.classList.add("flexttb");

							const name = document.createElement("span");
							name.textContent = con.name;

							const serviceName = document.createElement("span");
							serviceName.textContent = _;

							nameDiv.append(name, serviceName);

							topRow.append(nameDiv);

							const input = document.createElement("input");
							input.type = "checkbox";
							input.checked = !!con.visibility;
							input.onchange = () => {
								fetch(localuser.info.api + "/users/@me/connections/" + con.type + "/" + con.id, {
									method: "PATCH",
									body: JSON.stringify({
										visibility: input.checked,
									}),
									headers: localuser.headers,
								});
							};

							const dispRow = document.createElement("div");
							dispRow.classList.add("flexltr");
							actConDiv.append(dispRow);

							const dispText = document.createElement("span");
							dispText.textContent = I18n.connections.display();
							dispRow.append(dispText, input);

							const remove = document.createElement("button");
							remove.textContent = I18n.connections.delete();
							actConDiv.append(remove);
							remove.onclick = () => {
								const d = new Dialog(I18n.connections.sure());
								d.options.addText(I18n.connections.sureDesc());
								const row = d.options.addOptions("", {ltr: true});
								row.addButtonInput("", I18n.yes(), async () => {
									await fetch(
										localuser.info.api + "/users/@me/connections/" + con.type + "/" + con.id,
										{
											method: "DELETE",
											headers: localuser.headers,
										},
									);
									d.hide();
								});
								row.addButtonInput("", I18n.no(), () => {
									d.hide();
								});
								d.show();
							};

							actConDivCont.append(actConDiv);
						});
				});
			};
			remake();
			connections.addHTMLArea(connectionContainer);
			connections.addHR();
			connections.addHTMLArea(actConDivCont);
		});
	}
	{
		const security = settings.addButton(I18n.localuser.accountSettings(), {contained: true});

		security.addSubButtonInput(I18n.localuser.changeDiscriminator(), (sub) => {
			const form = sub.addForm(
				"",
				(_) => {
					security.returnFromSub();
				},
				{
					fetchURL: localuser.info.api + "/users/@me/",
					headers: localuser.headers,
					method: "PATCH",
				},
			);
			form.addTextInput(I18n.localuser.newDiscriminator(), "discriminator");
		});
		security.addSubButtonInput(I18n.localuser.changeEmail(), (sub) => {
			const form = sub.addForm(
				"",
				(_) => {
					security.returnFromSub();
				},
				{
					fetchURL: localuser.info.api + "/users/@me/",
					headers: localuser.headers,
					method: "PATCH",
				},
			);
			form.addTextInput(I18n.localuser["password:"](), "password", {
				password: true,
			});
			if (localuser.mfa_enabled) {
				form.addTextInput(I18n.localuser["2faCode:"](), "code");
			}
			form.addTextInput(I18n.localuser["newEmail:"](), "email");
		});
		security.addSubButtonInput(I18n.localuser.changeUsername(), (sub) => {
			const form = sub.addForm(
				"",
				(_) => {
					security.returnFromSub();
				},
				{
					fetchURL: localuser.info.api + "/users/@me/",
					headers: localuser.headers,
					method: "PATCH",
				},
			);
			form.addTextInput(I18n.localuser["password:"](), "password", {
				password: true,
			});
			if (localuser.mfa_enabled) {
				form.addTextInput(I18n.localuser["2faCode:"](), "code");
			}
			form.addTextInput(I18n.localuser.newUsername(), "username");
		});
		security.addSubButtonInput(I18n.localuser.changePassword(), (sub) => {
			const form = sub.addForm(
				"",
				(_) => {
					security.returnFromSub();
				},
				{
					fetchURL: localuser.info.api + "/users/@me/",
					headers: localuser.headers,
					method: "PATCH",
				},
			);
			form.addTextInput(I18n.localuser["oldPassword:"](), "password", {
				password: true,
			});
			if (localuser.mfa_enabled) {
				form.addTextInput(I18n.localuser["2faCode:"](), "code");
			}
			let in1 = "";
			let in2 = "";
			form
				.addTextInput(I18n.localuser["newPassword:"](), "", {password: true})
				.watchForChange((text) => {
					in1 = text;
				});
			const copy = form.addTextInput("New password again:", "", {password: true});
			copy.watchForChange((text) => {
				in2 = text;
			});
			form.setValue("new_password", () => {
				if (in1 === in2) {
					return in1;
				} else {
					throw new FormError(copy, I18n.localuser.PasswordsNoMatch());
				}
			});
		});

		{
			security.addButtonInput("", I18n.logout.logout(), async () => {
				if (await localuser.userinfo.logout()) window.location.href = "/";
			});
		}
	}
	{
		const lang = settings.addButton(I18n.localuser.language(), {contained: true});
		const div = document.createElement("div");
		div.classList.add("flexttb");
		const langBuMap = new Map<string, HTMLButtonElement>();
		let l = [...langmap];
		const langF = l.find((_) => _[0] === I18n.lang + ".json");
		l = l.filter((_) => _ !== langF);
		if (langF) l.unshift(langF);
		div.append(
			...l.map(([key, name]) => {
				const button = document.createElement("button");
				button.classList.add("langButton");
				button.textContent = name;
				langBuMap.set(key, button);
				if (key === I18n.lang + ".json") {
					button.classList.add("selected");
				}
				button.onclick = () => {
					const b = langBuMap.get(I18n.lang + ".json");
					if (b) b.classList.remove("selected");
					button.classList.add("selected");
					I18n.setLanguage(key.replace(".json", ""));
					localuser.updateTranslations();
				};
				console.log(I18n.lang, key);
				return button;
			}),
		);
		lang.addHTMLArea(div);
	}

	{
		const prefs = getPreferences();
		const tas = settings.addButton(I18n.localuser.themesAndSounds(), {contained: true});
		{
			const themes = ["Dark", "WHITE", "Light", "Dark-Accent", "NightSky", "NightSky-Accent"];
			tas.addSelect(
				I18n.localuser["theme:"](),
				async (_) => {
					prefs.theme = themes[_] as ThemeOption;

					await setTheme(prefs.theme);
				},
				themes,
				{
					defaultIndex: themes.indexOf(prefs.theme),
				},
			);
		}
		{
			const initArea = (index: number) => {
				if (index === sounds.length - 1) {
					const input = document.createElement("input");
					input.type = "file";
					input.accept = "audio/*";
					input.addEventListener("change", () => {
						if (input.files?.length === 1) {
							const file = input.files[0];

							let reader = new FileReader();
							reader.onload = async () => {
								let buffer = reader.result;
								if (!(buffer instanceof ArrayBuffer)) return;
								const sound = await localuser.fs.getFile("/customSound", true);
								if (!sound) {
									return;
								}
								sound.write(buffer);
								localuser.playSound("custom");
							};
							reader.readAsArrayBuffer(file);
						}
					});
					area.append(input);
				} else {
					area.innerHTML = "";
				}
			};
			const sounds = [...(localuser.play?.tracks || []), I18n.localuser.customSound()];
			const initIndex = sounds.indexOf(localuser.getNotificationSound());
			const select = tas.addSelect(
				I18n.localuser.notisound(),
				(index) => {
					localuser.setNotificationSound(sounds[index]);
				},
				sounds,
				{defaultIndex: initIndex},
			);
			select.watchForChange((index) => {
				initArea(index);
				localuser.playSound(sounds[index]);
			});
			const input = document.createElement("input");
			input.type = "range";
			input.value = localuser.getNotiVolume() + "";
			input.min = "0";
			input.max = "100";
			input.onchange = () => {
				localuser.setNotificationVolume(+input.value);
				localuser.playSound(sounds[select.index]);
			};

			const area = document.createElement("div");
			initArea(initIndex);
			tas.addHTMLArea(area);
			tas.addText(I18n.notiVolume());
			tas.addHTMLArea(input);
		}

		{
			tas.addColorInput(
				I18n.localuser.accentColor(),
				async (_) => {
					prefs.accentColor = _;
					await setPreferences(prefs);

					document.documentElement.style.setProperty("--accent-color", prefs.accentColor);
				},
				{initColor: prefs.accentColor},
			);
		}
		{
			const options = [[null, I18n.noEmojiFont()], ...Localuser.fonts] as const;
			const cur = prefs.emojiFont;
			let index = options.findIndex((_) => _[1] == cur);
			if (index === -1) index = 0;
			tas.addSelect(
				I18n.emojiSelect(),
				async (index) => {
					if (options[index][0]) {
						prefs.emojiFont = options[index][1];
					} else {
						prefs.emojiFont = undefined;
					}

					await setPreferences(prefs);
					Localuser.loadFont();
				},
				options.map((font) => font[1]),
				{
					defaultIndex: index,
				},
			);
		}
		{
			const ind = localuser.gifProvideors.findIndex((_) => localuser.selectedGifProfidor === _);
			console.log(prefs.gifProvidor);
			tas.addSelect(
				I18n.gifProvidor(),
				async (i) => {
					prefs.gifProvidor = localuser.gifProvideors[i].api_name;
					console.log(prefs.gifProvidor);

					await setPreferences(prefs);
					Localuser.loadFont();
					localuser.figureDefaultProvidor();
				},
				localuser.gifProvideors.map((_) => _.name),
				{defaultIndex: ind === -1 ? 0 : ind},
			);
		}
		{
			tas.addCheckboxInput(
				I18n.showTodayAt(),
				(b) => {
					prefs.showToday = b;
					setPreferences(prefs);
				},
				{
					initState: prefs.showToday,
				},
			);
		}
		{
			tas.addSelect(
				I18n.localuser.clockFormatOverride(),
				async (_) => {
					prefs.clockFormatOverride = ClockFormatOverrideValues[_];
					setPreferences(prefs);
				},
				ClockFormatOverrideValues.map((_) => I18n.localuser.clockFormatOverrideValues[_]()),
				{
					defaultIndex: ClockFormatOverrideValues.indexOf(prefs.clockFormatOverride),
				},
			);
		}
	}
	{
		const blog = settings.addButton(I18n.blog.blog(), {contained: true});
		blog.addCheckboxInput(
			I18n.blog.blogUpdates(),
			async (check) => {
				prefs.showBlogUpdates = check;
				await setPreferences(prefs);
			},
			{initState: prefs.showBlogUpdates},
		);
		(async () => {
			const posts = await localuser.getPosts();
			for (const post of posts.items) {
				const div = document.createElement("div");
				div.classList.add("flexltr", "blogDiv");
				if (post.image) {
					//TODO handle this case, no blog posts currently do this
				}
				const titleStuff = document.createElement("div");
				titleStuff.classList.add("flexttb");

				const h2 = document.createElement("h2");
				h2.textContent = post.title;

				const p = document.createElement("p");
				p.textContent = post.content_html;
				titleStuff.append(h2, p);
				div.append(titleStuff);
				blog.addHTMLArea(div);
				MarkDown.safeLink(div, post.url);
			}
		})();
	}
	{
		const shortcuts = settings.addButton(I18n.keyboard.shortcuts(), {contained: true});
		const cur = getShortcuts();
		for (const [name] of cur) {
			shortcuts.addText(I18n.keyboard.descs[name]());
			shortcuts.addHTMLArea(
				Localuser.globalShortcuts.shortCutbutton(
					name,
					(short) => {
						cur[name] = short;
						setShortcuts(cur);
						console.log(cur);
					},
					true,
				),
			);
		}
	}

	const installP = installPGet();
	if (installP) {
		const c = settings.addButton(I18n.localuser.install(), {contained: true});
		c.addText(I18n.localuser.installDesc());
		c.addButtonInput("", I18n.localuser.installJank(), async () => {
			//@ts-expect-error have to do this :3
			await installP.prompt();
		});
	}

	settings.addButton(I18n.accessibility.name(), {head: true});

	{
		const visuals = settings.addButton(I18n.accessibility.visuals(), {contained: true});
		visuals.addCheckboxInput(
			I18n.accessibility.roleColors(),
			(t) => {
				console.log(t);
				localuser.perminfo.user.disableColors = !t;
			},
			{initState: !localuser.perminfo.user.disableColors},
		);
		visuals.addCheckboxInput(
			I18n.accessibility.gradientColors(),
			(t) => {
				console.log(t);
				localuser.perminfo.user.gradientColors = t;
			},
			{initState: localuser.perminfo.user.gradientColors},
		);
		visuals.addCheckboxInput(
			I18n.channel.allowIcons(),
			(t) => {
				console.log(t);
				localuser.perminfo.user.disableIcons = !t;
			},
			{initState: !localuser.perminfo.user.disableIcons},
		);

		visuals.addCheckboxInput(
			I18n.accessibility.decorations(),
			(t) => {
				localuser.perminfo.user.decorations = t;
			},
			{initState: localuser.perminfo.user.decorations},
		);
		{
			const cur = prefs.renderJoinAvatars;
			visuals.addCheckboxInput(
				I18n.renderJoinAvatars(),
				async (v) => {
					prefs.renderJoinAvatars = v;
					await setPreferences(prefs);
				},
				{initState: cur},
			);
		}
		visuals.addCheckboxInput(
			I18n.checkBoxMemberList(),
			(c) => {
				prefs.checkMemberList = c;
				const ml = document.getElementById("memberlisttoggle")!;
				if (c) {
					ml.classList = "";
				} else {
					ml.classList = "svgicon svg-friends";
				}
				setPreferences(prefs);
			},
			{
				initState: !!prefs.checkMemberList,
			},
		);
	}
	{
		const animations = settings.addButton(I18n.accessibility.animations(), {contained: true});
		animations.addSelect(
			I18n.accessibility.playGif(),
			async (i) => {
				prefs.animateGifs = AnimateTristateValues[i];
				await setPreferences(prefs);
			},
			AnimateTristateValues.map((_) => I18n.accessibility.gifSettings[_]()),
			{defaultIndex: AnimateTristateValues.indexOf(prefs.animateGifs)},
		);
		animations.addSelect(
			I18n.accessibility.playIcon(),
			async (i) => {
				prefs.animateIcons = AnimateTristateValues[i];
				await setPreferences(prefs);
			},
			AnimateTristateValues.map((_) => I18n.accessibility.gifSettings[_]()),
			{defaultIndex: AnimateTristateValues.indexOf(prefs.animateIcons)},
		);
		animations.addSelect(
			I18n.accessibility.playEmoji(),
			async (i) => {
				prefs.animateEmoji = AnimateTristateValues[i];
				await setPreferences(prefs);
			},
			AnimateTristateValues.map((_) => I18n.accessibility.gifSettings[_]()),
			{defaultIndex: AnimateTristateValues.indexOf(prefs.animateEmoji)},
		);
		animations.addSelect(
			I18n.accessibility.playSticker(),
			async (i) => {
				prefs.animateSticker = AnimateTristateValues[i];
				await setPreferences(prefs);
			},
			AnimateTristateValues.map((_) => I18n.accessibility.gifSettings[_]()),
			{defaultIndex: AnimateTristateValues.indexOf(prefs.animateSticker)},
		);
	}
	settings.addButton(I18n.localuser.security(), {head: true});
	{
		const twofa = settings.addButton(I18n.localuser["2fa"](), {contained: true});
		const gen2FA = () => {
			twofa.removeAll();
			if (localuser.mfa_enabled) {
				twofa.addSubButtonInput(I18n.localuser["2faDisable"](), (sub) => {
					const form = sub.addForm(
						"",
						(_: any) => {
							if (_.message) {
								switch (_.code) {
									case 60008:
										form.error("code", I18n.localuser.badCode());
										break;
								}
							} else {
								localuser.mfa_enabled = false;
								twofa.returnFromSub();
								gen2FA();
							}
						},
						{
							fetchURL: localuser.info.api + "/users/@me/mfa/totp/disable",
							headers: localuser.headers,
						},
					);
					form.addTextInput(I18n.localuser["2faCode:"](), "code", {required: true});
				});
			} else {
				twofa.addSubButtonInput(I18n.localuser["2faEnable"](), async (sub) => {
					let secret = "";
					for (let i = 0; i < 18; i++) {
						secret += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)];
					}
					const form = sub.addForm(
						"",
						(_: any) => {
							if (_.message) {
								switch (_.code) {
									case 60008:
										form.error("code", I18n.localuser.badCode());
										break;
									case 400:
										form.error("password", I18n.localuser.badPassword());
										break;
								}
							} else {
								gen2FA();
								localuser.mfa_enabled = true;
								twofa.returnFromSub();
							}
						},
						{
							fetchURL: localuser.info.api + "/users/@me/mfa/totp/enable",
							headers: localuser.headers,
						},
					);
					form.addTitle(I18n.localuser.setUp2faInstruction());
					form.addText(I18n.localuser["2faCodeGive"](secret));
					form.addTextInput(I18n.localuser["password:"](), "password", {
						required: true,
						password: true,
					});
					form.addTextInput(I18n.localuser["2faCode:"](), "code", {required: true});
					form.setValue("secret", secret);
				});
			}
			{
				twofa.addSubButtonInput(I18n.webauth.manage(), (keyMenu) => {
					const addKey = (key: {name: string; id: string}) => {
						keyMenu.addButtonInput("", key.name, () => {
							const opt = keyMenu.addSubOptions(key.name);
							const button = opt.addButtonInput("", I18n.delete(), async () => {
								await fetch(localuser.info.api + "/users/@me/mfa/webauthn/credentials/" + key.id, {
									headers: localuser.headers,
									method: "DELETE",
								});
								keyMenu.returnFromSub();
								keyMenu.deleteElm(button);
							});
						});
					};
					keyMenu.addButtonInput("", I18n.webauth.addKey(), () => {
						const form = keyMenu.addSubForm(
							I18n.webauth.addKey(),
							async (obj) => {
								const body = obj as {ticket: string; challenge: string};
								const challenge = JSON.parse(body.challenge)
									.publicKey as PublicKeyCredentialCreationOptionsJSON;
								console.log(challenge.challenge);
								challenge.challenge = challenge.challenge
									.split("=")[0]
									.replaceAll("+", "-")
									.replaceAll("/", "_");
								console.log(challenge.challenge);
								const options = PublicKeyCredential.parseCreationOptionsFromJSON(challenge);
								const credential = (await navigator.credentials.create({
									publicKey: options,
								})) as unknown as {
									rawId: ArrayBuffer;
									response: {
										attestationObject: ArrayBuffer;
										clientDataJSON: ArrayBuffer;
									};
								};
								if (!credential) return;
								function toBase64(buf: ArrayBuffer) {
									return btoa(String.fromCharCode(...new Uint8Array(buf)));
								}
								const res = {
									rawId: toBase64(credential.rawId),
									response: {
										clientDataJSON: toBase64(credential.response.clientDataJSON),
										attestationObject: toBase64(credential.response.attestationObject),
									},
								};
								const key = await (
									await fetch(localuser.info.api + "/users/@me/mfa/webauthn/credentials", {
										headers: localuser.headers,
										method: "POST",
										body: JSON.stringify({
											ticket: body.ticket,
											credential: JSON.stringify(res),
											name: name.value,
										}),
									})
								).json();
								addKey(key);
								keyMenu.returnFromSub();
							},
							{
								fetchURL: localuser.info.api + "/users/@me/mfa/webauthn/credentials",
								method: "POST",
								headers: localuser.headers,
								tfaCheck: false,
							},
						);
						form.addTextInput(I18n.htmlPages.pwField(), "password", {
							password: true,
						});
						const name = form.options.addTextInput(I18n.webauth.keyname(), () => {}, {
							initText: "Key",
						});
					});
					fetch(localuser.info.api + "/users/@me/mfa/webauthn/credentials", {
						headers: localuser.headers,
					})
						.then((_) => _.json())
						.then((keys: {id: string; name: string}[]) => {
							for (const key of keys) {
								addKey(key);
							}
						});
				});
			}
		};
		gen2FA();
	}
	{
		const manageSessions = settings.addButton(I18n.deviceManage.title(), {contained: true});
		(async () => {
			const json = (await (
				await fetch(localuser.info.api + "/auth/sessions?extended=true", {
					headers: localuser.headers,
				})
			).json()) as {user_sessions: expSessionJson[]};
			for (const session of json.user_sessions.sort(
				(a, b) => +new Date(a.last_seen) - +new Date(b.last_seen),
			)) {
				const div = document.createElement("div");
				div.classList.add("flexltr", "sessionDiv");

				const info = document.createElement("div");
				info.classList.add("flexttb");
				div.append(info);

				let line2 = "";
				const last = session.last_seen_location_info;
				if (last) {
					line2 += last.country_name;
					if (last.region) line2 += ", " + last.region;
					if (last.city) line2 += ", " + last.city;
				}
				if (line2) {
					line2 += " • ";
				}
				const format = new Intl.RelativeTimeFormat(I18n.lang, {style: "short"});
				const time = (Date.now() - +new Date(session.last_seen)) / 1000;
				if (time < 60) {
					line2 += format.format(-Math.floor(time), "seconds");
				} else if (time < 60 * 60) {
					line2 += format.format(-Math.floor(time / 60), "minutes");
				} else if (time < 60 * 60 * 24) {
					line2 += format.format(-Math.floor(time / 60 / 60), "hours");
				} else if (time < 60 * 60 * 24 * 7) {
					line2 += format.format(-Math.floor(time / 60 / 60 / 24), "days");
				} else if (time < 60 * 60 * 24 * 365) {
					line2 += format.format(-Math.floor(time / 60 / 60 / 24 / 7), "weeks");
				} else {
					line2 += format.format(-Math.floor(time / 60 / 60 / 24 / 365), "years");
				}
				const loc = document.createElement("span");
				loc.textContent = line2;
				info.append(loc);
				const r = manageSessions.addHTMLArea(div);
				div.onclick = () => {
					const sub = manageSessions.addSubOptions(I18n.deviceManage.manageDev());
					sub.addText(I18n.deviceManage.ip(session.last_seen_ip));
					sub.addText(I18n.deviceManage.last(session.approx_last_used_time));
					if (last) {
						sub.addText(I18n.deviceManage.estimateWarn());
						sub.addText(I18n.deviceManage.continent(last.continent_name));
						sub.addText(I18n.deviceManage.country(last.country_name));
						if (last.region) sub.addText(I18n.deviceManage.region(last.region));
						if (last.city) sub.addText(I18n.deviceManage.city(last.city));
						if (last.postal) sub.addText(I18n.deviceManage.postal(last.postal));
						sub.addText(I18n.deviceManage.longitude(last.longitude + ""));
						sub.addText(I18n.deviceManage.latitude(last.latitude + ""));
					}
					if (session.id !== localuser.session_id) {
						sub.addButtonInput("", I18n.deviceManage.logout(), () => {
							div.remove();
							r.html = document.createElement("div");
							manageSessions.returnFromSub();
							fetch(localuser.info.api + "/auth/sessions/logout", {
								method: "POST",
								headers: localuser.headers,
								body: JSON.stringify({
									session_id_hashes: [session.id_hash],
								}),
							});
						});
					} else sub.addText(I18n.deviceManage.curSes());
				};
			}
		})();
	}
	{
		const trusted = settings.addButton(I18n.localuser.trusted(), {contained: true});
		trusted.addMDText(new MarkDown(I18n.localuser.trustedDesc()));
		for (const thing of MarkDown.trustedDomains) {
			const div = document.createElement("div");
			div.classList.add("flexltr", "trustedDomain");

			const name = document.createElement("span");
			name.textContent = thing;

			const remove = document.createElement("button");
			remove.textContent = I18n.remove();
			remove.onclick = () => {
				MarkDown.saveTrusted();
				MarkDown.trustedDomains.delete(thing);
				MarkDown.saveTrusted(true);
				div.remove();
			};

			div.append(name, remove);
			trusted.addHTMLArea(div);
		}
	}
	settings.addButton(I18n.localuser.advanced(), {head: true});

	{
		const devPortal = settings.addButton(I18n.localuser.devPortal(), {contained: true});

		fetch(localuser.info.api + "/teams", {
			headers: localuser.headers,
		}).then(async (teamsRes) => {
			const teams = await teamsRes.json();

			const button = devPortal.addSubButtonInput(I18n.localuser.createApp(), (sub) => {
				const form = sub.addForm(
					"",
					(json: any) => {
						if (json.message) form.error("name", json.message);
						else {
							devPortal.returnFromSub();
							localuser.manageApplication(json.id, devPortal, () => {
								form.options.deleteElm(button);
							});
						}
					},
					{
						fetchURL: localuser.info.api + "/applications",
						headers: localuser.headers,
						method: "POST",
					},
				);

				form.addTextInput("Name:", "name", {required: true});
				form.addSelect(
					I18n.localuser["team:"](),
					"team_id",
					["Personal", ...teams.map((team: {name: string}) => team.name)],
					{defaultIndex: 0},
				);
			});

			const appListContainer = document.createElement("div");
			appListContainer.id = "app-list-container";
			fetch(localuser.info.api + "/applications", {
				headers: localuser.headers,
			})
				.then((r) => r.json())
				.then((json) => {
					json.forEach(
						(application: {
							cover_image: any;
							icon: any;
							id: string | undefined;
							name: string | number;
							bot: any;
						}) => {
							const container = document.createElement("div");

							if (application.cover_image || application.icon) {
								const cover = createImg(
									localuser.info.cdn +
										"/app-icons/" +
										application.id +
										"/" +
										(application.cover_image || application.icon) +
										".png" +
										new CDNParams({expectedSize: 256}),
								);
								cover.alt = "";
								cover.loading = "lazy";
								container.appendChild(cover);
							}

							const name = document.createElement("h2");
							name.textContent = application.name + (application.bot ? " (Bot)" : "");
							container.appendChild(name);

							container.addEventListener("click", async () => {
								localuser.manageApplication(application.id, devPortal, () => {
									appListContainer.remove();
								});
							});
							appListContainer.appendChild(container);
						},
					);
				});
			devPortal.addHTMLArea(appListContainer);
		});
	}

	if (
		localuser.rights.hasPermission("OPERATOR") ||
		localuser.rights.hasPermission("CREATE_REGISTRATION_TOKENS")
	) {
		const manageInstance = settings.addButton(I18n.localuser.manageInstance(), {contained: true});
		if (localuser.rights.hasPermission("OPERATOR")) {
			manageInstance.addButtonInput("", I18n.manageInstance.stop(), () => {
				const menu = new Dialog("");
				const options = menu.float.options;
				options.addTitle(I18n.manageInstance.AreYouSureStop());
				const yesno = options.addOptions("", {ltr: true});
				yesno.addButtonInput("", I18n.yes(), () => {
					fetch(localuser.info.api + "/stop", {headers: localuser.headers, method: "POST"});
					menu.hide();
				});
				yesno.addButtonInput("", I18n.no(), () => {
					menu.hide();
				});
				menu.show();
			});
		}
		if (localuser.rights.hasPermission("CREATE_REGISTRATION_TOKENS")) {
			manageInstance.addSubButtonInput(
				I18n.manageInstance.createTokens(),
				(tokens) => {
					const count = tokens.addTextInput(I18n.manageInstance.count(), () => {}, {
						initText: "1",
					});
					const length = tokens.addTextInput(I18n.manageInstance.length(), () => {}, {
						initText: "32",
					});
					const format = tokens.addSelect(
						I18n.manageInstance.format(),
						() => {},
						[
							I18n.manageInstance.TokenFormats.JSON(),
							I18n.manageInstance.TokenFormats.plain(),
							I18n.manageInstance.TokenFormats.URLs(),
						],
						{
							defaultIndex: 2,
						},
					);
					format.watchForChange((e) => {
						if (e !== 2) {
							urlOption.removeAll();
						} else {
							makeURLMenu();
						}
					});
					const urlOption = tokens.addOptions("");
					const urlOptionsJSON = {
						url: window.location.origin,
						type: "Fermi",
					};
					function makeURLMenu() {
						urlOption
							.addTextInput(I18n.manageInstance.clientURL(), () => {}, {
								initText: urlOptionsJSON.url,
							})
							.watchForChange((str) => {
								urlOptionsJSON.url = str;
							});
						urlOption
							.addSelect(
								I18n.manageInstance.regType(),
								() => {},
								["Fermi", I18n.manageInstance.genericType()],
								{
									defaultIndex: ["Fermi", "generic"].indexOf(urlOptionsJSON.type),
								},
							)
							.watchForChange((i) => {
								urlOptionsJSON.type = ["Fermi", "generic"][i];
							});
					}
					makeURLMenu();
					tokens.addButtonInput("", I18n.manageInstance.create(), async () => {
						const params = new URLSearchParams();
						params.set("count", count.value);
						params.set("length", length.value);
						const json = (await (
							await fetch(
								localuser.info.api + "/auth/generate-registration-tokens?" + params.toString(),
								{
									headers: localuser.headers,
								},
							)
						).json()) as {tokens: string[]};
						if (format.index === 0) {
							pre.textContent = JSON.stringify(json.tokens);
						} else if (format.index === 1) {
							pre.textContent = json.tokens.join("\n");
						} else if (format.index === 2) {
							if (urlOptionsJSON.type === "Fermi") {
								const options = new URLSearchParams();
								options.set("instance", localuser.instanceString());
								pre.textContent = json.tokens
									.map((token) => {
										options.set("token", token);
										return `${urlOptionsJSON.url}/register?` + options.toString();
									})
									.join("\n");
							} else {
								const options = new URLSearchParams();
								pre.textContent = json.tokens
									.map((token) => {
										options.set("token", token);
										return `${urlOptionsJSON.url}/register?` + options.toString();
									})
									.join("\n");
							}
						}
					});
					tokens.addButtonInput("", I18n.manageInstance.copy(), async () => {
						try {
							if (pre.textContent) {
								await navigator.clipboard.writeText(pre.textContent);
							}
						} catch (err) {
							console.error(err);
						}
					});
					const pre = document.createElement("pre");
					tokens.addHTMLArea(pre);
				},
				{
					noSubmit: true,
				},
			);
		}
	}
	(async () => {
		const jankInfo = settings.addButton(I18n.jankInfo(), {contained: true});
		const img = document.createElement("img");
		img.src = "/logo.svg";
		jankInfo.addHTMLArea(img);
		img.width = 128;
		img.height = 128;
		const ver = await (await fetch("/getupdates")).text();
		jankInfo.addMDText(
			new MarkDown(
				I18n.clientDesc(ver, window.location.origin, localuser.rights.allow + ""),
				undefined,
			),
		);
	})();

	{
		const devSettings = settings.addButton(I18n.devSettings.name(), {
			noSubmit: true,
			contained: true,
		});
		devSettings.addText(I18n.devSettings.description());
		devSettings.addHR();
		const box1 = devSettings.addCheckboxInput(I18n.devSettings.logGateway(), () => {}, {
			initState: getDeveloperSettings().gatewayLogging,
		});
		box1.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.gatewayLogging = e;
			setDeveloperSettings(settings);
		};

		const box2 = devSettings.addCheckboxInput(I18n.devSettings.badUser(), () => {}, {
			initState: getDeveloperSettings().logBannedFields,
		});
		box2.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.logBannedFields = e;
			setDeveloperSettings(settings);
		};

		const box3 = devSettings.addCheckboxInput(I18n.devSettings.traces(), () => {}, {
			initState: getDeveloperSettings().showTraces,
		});
		box3.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.showTraces = e;
			setDeveloperSettings(settings);
		};

		const box4 = devSettings.addCheckboxInput(I18n.devSettings.cache(), () => {}, {
			initState: getDeveloperSettings().cacheSourceMaps,
		});
		box4.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.cacheSourceMaps = e;
			setDeveloperSettings(settings);
			SW.postMessage({code: "isDev", dev: e});
		};
		devSettings.addText(I18n.devSettings.cacheDesc());

		const box5 = devSettings.addCheckboxInput(I18n.devSettings.captureTrace(), () => {}, {
			initState: getDeveloperSettings().interceptApiTraces,
		});
		box5.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.interceptApiTraces = e;
			setDeveloperSettings(settings);
			SW.traceInit();
		};

		const box6 = devSettings.addCheckboxInput(I18n.devSettings.gatewayComp(), () => {}, {
			initState: getDeveloperSettings().gatewayCompression,
		});
		box6.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.gatewayCompression = e;
			setDeveloperSettings(settings);
			SW.traceInit();
		};

		const box7 = devSettings.addCheckboxInput(I18n.devSettings.reportSystem(), () => {}, {
			initState: getDeveloperSettings().reportSystem,
		});
		box7.onchange = (e) => {
			const settings = getDeveloperSettings();
			settings.reportSystem = e;
			setDeveloperSettings(settings);
			SW.traceInit();
		};

		devSettings.addButtonInput("", I18n.devSettings.clearWellKnowns(), async () => {
			const currentUserInfos = JSON.parse(localStorage.getItem("userinfos")!);
			await Promise.all(
				Object.keys(currentUserInfos.users).map(async (user) => {
					const key =
						currentUserInfos.users[user].serverurls.value ??
						currentUserInfos.users[user].serverurls.wellknown ??
						currentUserInfos.users[user].serverurls.api;
					currentUserInfos.users[user].serverurls = await getapiurls(key);
					console.log(key, currentUserInfos.users[user].serverurls);
					localStorage.setItem("userinfos", JSON.stringify(currentUserInfos));
				}),
			);

			localStorage.removeItem("instanceinfo");
			await SW.postMessage({
				code: "clearCdnCache",
			});

			// @ts-ignore - chromium is smelly for not supporting the `forceGet` option (aka skip cache)
			window.location.reload(true);
		});
	}
	if (localuser.trace.length && getDeveloperSettings().showTraces) {
		const traces = settings.addButton(I18n.localuser.trace(), {
			noSubmit: true,
			contained: true,
		});
		const traceArr = localuser.trace;

		const sel = traces.addSelect(
			"",
			() => {},
			localuser.trace.map((_) =>
				I18n.trace.traces(
					_.trace[0],
					_.trace[1].micros / 1000 + "",
					_.time.getHours() + ":" + _.time.getMinutes(),
				),
			),
		);
		function generateTraceHTML(trace: trace, indent: number): HTMLElement {
			const div = document.createElement("div");
			div.classList.add("traceDiv", "flexttb");

			const head = document.createElement("div");
			div.append(head);

			const title = document.createElement("h3");
			title.textContent = I18n.trace.totalTime(trace[1].micros / 1000 + "", trace[0]);
			const indents = document.createElement("span");
			indents.classList.add("visually-hidden");
			indents.textContent = "  ".repeat(indent);
			title.prepend(indents);
			head.append(title);

			if (!trace[1].calls) return div;

			let objs: {name: string; val: traceObj}[] = [];
			{
				const names = trace[1].calls.filter((_) => typeof _ === "string");
				const vals = trace[1].calls.filter((_) => _ instanceof Object);
				let i = 0;
				for (const name of names) {
					const val = vals[i];
					objs.push({name, val});
					i++;
				}
			}

			const bars = document.createElement("div");
			bars.classList.add("flexltr", "traceBars");

			const colors = ["red", "orange", "yellow", "lime", "blue", "indigo", "violet"];
			let i = 0;
			for (const thing of objs) {
				const bar = document.createElement("div");
				bar.style.setProperty(
					"flex-grow",
					Math.ceil((thing.val.micros / trace[1].micros) * 1000) + "",
				);
				bar.style.setProperty("background", colors[i % colors.length]);
				bars.append(bar);
				new Hover(I18n.trace.totalTime(thing.val.micros / 1000 + "", thing.name)).addEvent(bar);
				i++;
			}
			const body = document.createElement("div");
			div.append(body);
			head.append(bars);
			let dropped = false;
			head.onclick = () => {
				if (!trace[1].calls) return;
				if (dropped) {
					dropped = false;
					body.innerHTML = "";
					return;
				}

				let i = 0;
				for (const obj of objs) {
					body.append(generateTraceHTML([obj.name, obj.val], indent + 1));
					i++;
				}
				dropped = true;
			};

			div.classList.add("dropDownTrace");
			head.classList.add("traceHead");
			return div;
		}
		const blank = document.createElement("div");
		traces.addHTMLArea(blank);
		const updateInfo = () => {
			const trace = traceArr[sel.index];
			blank.innerHTML = "";
			blank.append(generateTraceHTML(trace.trace, 0));
		};
		sel.onchange = () => {
			updateInfo();
		};
		updateInfo();
	}
	{
		const update = settings.addButton(I18n.localuser.updateSettings(), {contained: true});
		let index = ServiceWorkerModeValues.indexOf(localSettings.serviceWorkerMode);
		if (index === -1) {
			index = 2;
		}
		const sw = update.addSelect(
			I18n.settings.updates.serviceWorkerMode.title(),
			() => {},
			ServiceWorkerModeValues.map((e) => I18n.settings.updates.serviceWorkerMode[e]()),
			{
				defaultIndex: index,
			},
		);
		sw.onchange = (e) => {
			SW.setMode(ServiceWorkerModeValues[e]);
		};
		update.addButtonInput("", I18n.localuser.CheckUpdate(), async () => {
			const update = await SW.checkUpdates();
			const text = update ? I18n.localuser.updatesYay() : I18n.localuser.noUpdates();
			const d = new Dialog("");
			d.options.addTitle(text);
			if (update) {
				d.options.addButtonInput("", I18n.localuser.refreshPage(), () => {
					window.location.reload();
				});
			}
			d.show();
		});
		update.addButtonInput("", I18n.localuser.clearCache(), () => {
			SW.forceClear();
		});
	}
	{
		const instanceInfo = settings.addButton(I18n.instanceInfo.name(), {contained: true});
		fetch(localuser.info.api + "/policies/instance", {
			headers: localuser.headers,
		})
			.then((_) => _.json())
			.then((body) => {
				const json = body as {
					instanceName: string;
					instanceDescription: string | null;
					frontPage: string | null;
					tosPage: string | null;
					correspondenceEmail: string | null;
					correspondenceUserID: string | null;
					image: string | null;
					instanceId: string;
					autoCreateBotUsers: false;
					publicUrl: string | null;
				};
				instanceInfo.addTitle(json.instanceName);
				if (json.correspondenceEmail) {
					const a = document.createElement("a");
					a.target = "_blank";
					a.rel = "noreferrer";
					a.href = "mailto:" + json.correspondenceEmail;
					a.textContent = I18n.instanceInfo.contact();
					instanceInfo.addHTMLArea(a);
				}
				if (json.tosPage)
					instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.tosPage(json.tosPage)));
				if (json.publicUrl)
					instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.publicUrl(json.publicUrl)));
				if (json.frontPage)
					instanceInfo.addMDText(new MarkDown(I18n.instanceInfo.frontPage(json.frontPage)));
				instanceInfo.addButtonInput("", I18n.instInfo(), () => {
					localuser.instanceStats();
				});
			});
	}
	settings.addButton(I18n.localuser.danger(), {head: true});
	{
		const deleteAccount = settings
			.addButton(I18n.localuser.deleteAccount(), {contained: true, color: buttonColor.RED})
			.addForm(
				"",
				(e) => {
					if ("message" in e) {
						if (typeof e.message === "string") {
							throw new FormError(password, e.message);
						}
					} else {
						localuser.userinfo.remove();
						window.location.href = "/";
					}
				},
				{
					headers: localuser.headers,
					method: "POST",
					fetchURL: localuser.info.api + "/users/@me/delete/",
					traditionalSubmit: false,
					submitText: I18n.localuser.deleteAccountButton(),
				},
			);
		const shrek = deleteAccount.addTextInput(
			I18n.localuser.areYouSureDelete(I18n.localuser.sillyDeleteConfirmPhrase()),
			"shrek",
		);
		const password = deleteAccount.addTextInput(I18n.localuser["password:"](), "password", {
			password: true,
		});
		deleteAccount.addPreprocessor((obj) => {
			if ("shrek" in obj) {
				if (obj.shrek !== I18n.localuser.sillyDeleteConfirmPhrase()) {
					throw new FormError(shrek, I18n.localuser.mustTypePhrase());
				}
				delete obj.shrek;
			} else {
				throw new FormError(shrek, I18n.localuser.mustTypePhrase());
			}
		});
	}

	settings.show();
}
