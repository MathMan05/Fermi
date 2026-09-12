import "./banners/index.js";
export interface banner {
	text: string | (() => string);
	url?: string;
	id?: string;
	priority: number;
}
let winner = null as null | banner;
const seen = new Set(JSON.parse(localStorage.getItem("seenBanners") || "[]") as string[]);
export function submitBanner(banner: banner) {
	if (banner.id && seen.has(banner.id)) return;
	if (!winner) winner = banner;
	if (winner.priority < banner.priority) winner = banner;
}
//Only show one banner per session
let shown = false;
export function showBanner() {
	if (shown || !winner) return;
	if (winner.id) {
		seen.add(winner.id);
		localStorage.setItem("seenBanners", JSON.stringify([...seen]));
	}
	shown = true;
	const noti = document.getElementById("noti")!;
	noti.textContent = "";
	noti.classList.remove("clear");
	let elm: HTMLElement;
	let text = winner.text;
	if (text instanceof Function) text = text();
	if (winner.url) {
		const a = document.createElement("a");
		a.href = winner.url;
		a.textContent = text;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		elm = a;
	} else {
		const span = document.createElement("span");
		span.textContent = text;
		elm = span;
	}
	noti.append(elm);
	const exit = document.createElement("span");
	exit.classList.add("svg-x", "svgicon", "margin-left", "close-noti");
	noti.append(exit);
	exit.onclick = () => {
		noti.classList.add("clear");
	};
}
