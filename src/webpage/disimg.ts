import {File} from "./file.js";
import {removeAni} from "./utils/utils.js";

class ImagesDisplay {
	files: File[];
	index = 0;
	constructor(files: File[], index = 0) {
		this.files = files;
		this.index = index;
	}
	weakbg = new WeakRef<HTMLElement>(document.createElement("div"));
	get background(): HTMLElement | undefined {
		return this.weakbg.deref();
	}
	set background(e: HTMLElement) {
		this.weakbg = new WeakRef(e);
	}
	makeHTML(): HTMLElement {
		const image = this.files[this.index].getHTML(false, true);
		image.classList.add("imgfit", "centeritem");
		return image;
	}
	show() {
		this.background = document.createElement("div");
		this.background.classList.add("background");
		let cur = this.makeHTML();
		if (this.files.length !== 1) {
			const right = document.createElement("span");
			right.classList.add("rightArrow", "svg-intoMenu");
			right.onclick = (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				this.index++;
				this.index %= this.files.length;
				cur.remove();
				cur = this.makeHTML();
				if (this.background) {
					this.background.appendChild(cur);
				}
			};

			const left = document.createElement("span");
			left.onclick = (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				this.index += this.files.length - 1;
				this.index %= this.files.length;
				cur.remove();
				cur = this.makeHTML();
				if (this.background) {
					this.background.appendChild(cur);
				}
			};
			left.classList.add("leftArrow", "svg-leftArrow");
			this.background.append(right, left);
			this.background.addEventListener("keydown", (e) => {
				if (e.key === "ArrowRight") {
					e.preventDefault();
					e.stopImmediatePropagation();
					right.click();
				}
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					e.stopImmediatePropagation();
					left.click();
				}
			});
		}

		this.background.appendChild(cur);
		this.background.onclick = (_) => {
			this.hide();
		};
		this.background.onkeydown = (e) => {
			if (e.key === "Escape") {
				this.hide();
			}
		};
		document.body.append(this.background);
		this.background.setAttribute("tabindex", "0");
		this.background.focus();
	}
	hide() {
		if (this.background) {
			removeAni(this.background);
		}
	}
}
export {ImagesDisplay};
