import {Channel} from "./channel.js";
import {I18n} from "./i18n.js";
import {Message} from "./message.js";

declare global {
	interface NotificationOptions {
		image?: string | null | undefined;
	}
}
export class NotificationHandler {
	static makeIcon(message: Message) {
		return message.author.getpfpsrc(message.guild);
	}
	static channelMap = new Map<Channel, Set<Notification>>();
	static async sendMessageNotification(message: Message) {
		const html = message.content.makeHTML();
		await new Promise<void>((res) => res());
		let noticontent: string | undefined | null = html.textContent;
		if (message.embeds[0]) {
			noticontent ||= message.embeds[0]?.json.title;
			noticontent ||= message.content.textContent;
		}
		if (message.attachments.length > 0) {
			noticontent ||= I18n.sentAttachment();
		}
		if (message.poll) {
			noticontent ||= I18n.sentPoll();
		}
		if (message.stickers.length > 0) {
			noticontent ||= I18n.sentSticker();
		}
		// exhausted all options, sorry, we just send the raw thing!
		noticontent ||= message.content.rawString;
		noticontent ||= I18n.blankMessage();

		const image = message.getimages()[0];
		const imgurl = image?.proxy_url || image?.url || undefined;
		if (this.groupNotifs(message)) return;
		const notification = new Notification(message.channel.notititle(message), {
			body: noticontent,
			icon: this.makeIcon(message),
			image: imgurl,
			silent: true,
		});

		notification.addEventListener("click", (_) => {
			window.focus();
			message.channel.getHTML(true, true);
		});

		const channelSet = this.channelMap.get(message.channel) || new Set();
		this.channelMap.set(message.channel, channelSet);
		channelSet.add(notification);

		notification.addEventListener("show", () => {
			setTimeout(() => {
				channelSet.delete(notification);
			}, 4000);
		});
	}
	static channelSuperMap = new Map<Channel, [number, NodeJS.Timeout, number]>();
	static groupNotifs(message: Message): boolean {
		let sup = this.channelSuperMap.get(message.channel);

		const notiSet = this.channelMap.get(message.channel);
		if (!notiSet) return false;
		if (!sup) {
			if (notiSet.size < 4) return false;
			sup = [notiSet.size - 1, 0 as any, Math.random()];
			this.channelSuperMap.set(message.channel, sup);
		}

		[...notiSet].forEach((_) => _.close());

		let [count, cancel, rand] = sup;
		sup[0]++;
		clearInterval(cancel);
		new Notification(message.channel.notititle(message), {
			body: I18n.notiClump(count + "", message.channel.name),
			icon: this.makeIcon(message),
			silent: true,
			tag: message.channel.id + rand,
		}).addEventListener("click", (_) => {
			window.focus();
			message.channel.getHTML(true, true);
			this.channelSuperMap.delete(message.channel);
		});
		setTimeout(() => {
			this.channelSuperMap.delete(message.channel);
		}, 3000);
		return true;
	}
}
