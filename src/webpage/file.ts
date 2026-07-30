import {Message} from "./message.js";
import {filejson} from "./jsontypes.js";
import {ImagesDisplay} from "./disimg.js";
import {makePlayBox, MediaPlayer} from "./media.js";
import {I18n} from "./i18n.js";
import {createImg} from "./utils/utils.js";
import {Contextmenu} from "./contextmenu.js";
class File {
	readonly owner: Message | null;
	id: string;
	filename: string;
	content_type: string;
	width: number | undefined;
	height: number | undefined;
	proxy_url: string | undefined;
	url: string;
	size: number;
	files?: File[];
	static menu = this.makeMenu();
	static makeMenu() {
		const menu = new Contextmenu<File, void>("", true);
		I18n.done.then(() => {
			menu.addButton(
				I18n.copyMedia(),
				function () {
					navigator.clipboard.writeText(this.url);
				},
				{
					group: "copyLink",
				},
			);
		});
		return menu;
	}
	constructor(fileJSON: filejson, owner: Message | null) {
		this.owner = owner;
		this.id = fileJSON.id;
		this.filename = fileJSON.filename;
		this.content_type = fileJSON.content_type;
		this.width = fileJSON.width;
		this.height = fileJSON.height;
		this.url = fileJSON.url;
		this.proxy_url = fileJSON.proxy_url;
		this.content_type = fileJSON.content_type;
		this.size = fileJSON.size;
	}
	getHTML(temp: boolean = false, fullScreen = false, OSpoiler = false, max = 96 * 3): HTMLElement {
		function makeSpoilerHTML(): HTMLElement {
			const spoil = document.createElement("div");
			spoil.classList.add("fSpoil");
			const stext = document.createElement("span");
			stext.textContent = I18n.spoiler();
			spoil.append(stext);
			spoil.onclick = () => spoil.remove();
			return spoil;
		}
		OSpoiler ||= this.filename.startsWith("SPOILER_");

		const src = this.proxy_url || this.url;
		const url = this.refreshURL();

		if (this.width && this.height) {
			let scale = 1;
			scale = Math.max(scale, this.width / max);
			scale = Math.max(scale, this.height / max);
			this.width /= scale;
			this.height /= scale;
			this.width ^= 0;
			this.height ^= 0;
		}
		if (this.height === null) {
			this.height = 96 * 3;
		}

		if (this.content_type.startsWith("image/")) {
			const div = document.createElement("div");
			const img = createImg(src, undefined, div);
			if (this.width && this.height) {
				img.width = this.width;
				img.height = this.height;
			}
			if (!fullScreen) {
				img.classList.add("messageimg");
				div.classList.add("messageimgdiv");
				img.onclick = () => {
					if (this.owner) {
						const full = new ImagesDisplay(
							this.files || this.owner.attachments,
							(this.files || this.owner.attachments).indexOf(this),
						);
						full.show();
					} else {
						const full = new ImagesDisplay([this]);
						full.show();
					}
				};
			} else {
				img.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
				};
			}

			if (url)
				url.then((src) => {
					img.setSrcs(src);
				});
			div.append(img);
			if (this.width && !fullScreen) {
				img.style.width = div.style.width = this.width + "px";
				img.style.height = div.style.height = this.height + "px";
			} else if (!fullScreen) {
				img.style.maxWidth = div.style.maxWidth = 96 * 3 + "px";
				img.style.maxHeight = div.style.maxHeight = 96 * 3 + "px";
			}
			img.isAnimated().then((animated) => {
				if (!animated || !this.owner || fullScreen) return;
				const url = new URL(this.url).origin + new URL(this.url).pathname;
				const span = document.createElement("span");
				span.classList.add("svg-gifstar");
				if (this.owner.localuser.favorites.hasGif(url)) {
					span.classList.add("favorited");
				}
				div.append(span);

				span.onclick = () => {
					if (!this.owner || !this.width || !this.height) return;
					const fav = this.owner.localuser.favorites;

					if (fav.hasGif(url)) {
						span.classList.remove("favorited");
						fav.unfavoriteGif(url);
					} else {
						span.classList.add("favorited");
						fav.favoriteGif(url, {
							src: url,
							width: this.width,
							height: this.height,
						});
					}
				};
			});
			if (!fullScreen) {
				if (OSpoiler) {
					div.append(makeSpoilerHTML());
				}
			}
			File.menu.bindContextmenu(div, this);
			return div;
		} else if (this.content_type.startsWith("video/")) {
			const video = document.createElement("video");
			const source = document.createElement("source");
			source.src = src;
			if (url)
				url.then((src) => {
					source.src = src;
				});
			video.append(source);
			//source.type = this.content_type;
			video.controls = !temp;

			if (this.width) video.width = this.width;
			if (this.height) video.height = this.height;

			if (OSpoiler) {
				const div = document.createElement("div");
				div.style.setProperty("position", "relative");
				div.append(video, makeSpoilerHTML());
				return div;
			}
			File.menu.bindContextmenu(video, this);
			return video;
		} else if (this.content_type.startsWith("audio/") || this.content_type === "application/ogg") {
			const a = this.getAudioHTML(url);
			if (OSpoiler) {
				a.append(makeSpoilerHTML());
			}
			File.menu.bindContextmenu(a, this);
			return a;
		} else {
			const uk = this.createunknown(url);
			if (OSpoiler) {
				uk.append(makeSpoilerHTML());
			}
			File.menu.bindContextmenu(uk, this);
			return uk;
		}
	}
	refreshURL(url = this.proxy_url || this.url): Promise<string> | void {
		if (!this.owner) return;
		const urlObj = new URL(url);
		if (urlObj.host === new URL(this.owner.info.cdn).host) {
			if (Number.parseInt(urlObj.searchParams.get("ex") || "", 16) >= Date.now() - 5000) {
				return;
			}
			const newUrl = this.owner.localuser.refreshURL(url);
			newUrl.then((_) => (this.proxy_url = _));
			return newUrl;
		}
	}
	private getAudioHTML(url: Promise<string> | void) {
		const src = this.proxy_url || this.url;
		return makePlayBox(src, player, 0, url);
	}
	upHTML(
		files: Blob[],
		map: WeakMap<Blob, HTMLElement>,
		file: globalThis.File,
		onremove: () => void,
	): HTMLElement {
		const div = document.createElement("div");
		let contained = this.getHTML(true, false, file.name.startsWith("SPOILER_"));
		div.classList.add("containedFile");
		div.append(contained);
		const controls = document.createElement("div");
		controls.classList.add("controls");

		const garbage = document.createElement("button");
		const icon = document.createElement("span");
		icon.classList.add("svgicon", "svg-delete");
		garbage.append(icon);
		garbage.onclick = (_) => {
			div.remove();
			files.splice(files.indexOf(file), 1);
			onremove();
		};

		const spoiler = document.createElement("button");
		const sicon = document.createElement("span");
		sicon.classList.add(
			"svgicon",
			file.name.startsWith("SPOILER_") ? "svg-unspoiler" : "svg-spoiler",
		);
		spoiler.append(sicon);
		spoiler.onclick = (_) => {
			if (file.name.startsWith("SPOILER_")) {
				const name = file.name.split("SPOILER_");
				name.shift();
				file = files[files.indexOf(file)] = new globalThis.File([file], name.join("SPOILER_"), {
					type: file.type,
				});
				sicon.classList.add("svg-spoiler");
				sicon.classList.remove("svg-unspoiler");
			} else {
				file = files[files.indexOf(file)] = new globalThis.File([file], "SPOILER_" + file.name, {
					type: file.type,
				});
				sicon.classList.add("svg-unspoiler");
				sicon.classList.remove("svg-spoiler");
			}
			map.set(file, div);
			contained.remove();
			contained = this.getHTML(true, false, file.name.startsWith("SPOILER_"));
			div.append(contained);
		};

		div.append(controls);
		controls.append(spoiler, garbage);
		return div;
	}
	static initFromBlob(file: globalThis.File) {
		return new File(
			{
				filename: file.name,
				size: file.size,
				id: "null",
				content_type: file.type,
				width: undefined,
				height: undefined,
				url: URL.createObjectURL(file),
				proxy_url: undefined,
			},
			null,
		);
	}
	createunknown(url: Promise<string> | void): HTMLElement {
		console.log("🗎");
		const src = this.proxy_url || this.url;
		const div = document.createElement("div");
		div.classList.add("unknownfile", "flexltr");
		const fileicon = document.createElement("td");
		div.append(fileicon);
		fileicon.append("🗎");
		fileicon.classList.add("fileicon");
		fileicon.rowSpan = 2;
		const nametd = document.createElement("div");
		nametd.classList.add("flexttb");
		if (src) {
			const a = document.createElement("a");
			a.href = src;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			if (url)
				url.then((_) => {
					a.href = _;
				});
			a.textContent = this.filename;
			nametd.append(a);
		} else {
			nametd.textContent = this.filename;
		}

		nametd.classList.add("filename");
		div.append(nametd);
		const sizetr = document.createElement("tr");
		const size = document.createElement("td");
		sizetr.append(size);
		size.textContent = "Size:" + File.filesizehuman(this.size);
		size.classList.add("filesize");
		div.appendChild(sizetr);
		return div;
	}
	static filesizehuman(fsize: number) {
		// These DO change between languages, for example in russian it uses cyrillic script
		// also NOBODY is uploading TBs of files... seriously no
		// And finally we are using SI units, so we go in thousands :)
		const i = fsize == 0 ? 0 : Math.floor(Math.log(fsize) / Math.log(1000));
		return (
			Number((fsize / Math.pow(1000, i)).toFixed(2)) * 1 +
			" " +
			[I18n.filesize.B(), I18n.filesize.KB(), I18n.filesize.MB(), I18n.filesize.GB()][i]
		);
	}
}

const player = new MediaPlayer();
export {File};
