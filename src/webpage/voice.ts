import {
	memberjson,
	sdpback,
	streamCreate,
	streamServerUpdate,
	voiceserverupdate,
	voiceStatus,
	webRTCSocket,
} from "./jsontypes.js";
function forceVideo(video: HTMLVideoElement) {
	video.controls = false;
	//TODO loading?
	video.classList.add("media-engine-video");
	video.addEventListener("pause", () => {
		video.play();
	});
}
class VoiceFactory {
	settings: {id: string};
	handleGateway: (obj: Object) => void;
	secure: boolean;
	constructor(
		usersettings: VoiceFactory["settings"],
		handleGateway: VoiceFactory["handleGateway"],
		secure: boolean,
	) {
		this.secure = secure;
		this.settings = usersettings;
		this.handleGateway = handleGateway;
	}
	voices = new Map<string, Map<string, Voice>>();
	voiceChannels = new Map<string, Voice>();
	currentVoice?: Voice;
	guildUrlMap = new Map<
		string,
		{url?: string; token?: string; geturl: Promise<void>; gotUrl: () => void}
	>();
	makeVoice(guildid: string, channelId: string, settings: Voice["settings"]) {
		let guild = this.voices.get(guildid);
		if (!guild) {
			this.setUpGuild(guildid);
			guild = new Map();
			this.voices.set(guildid, guild);
		}
		const urlobj = this.guildUrlMap.get(guildid);
		if (!urlobj) throw new Error("url Object doesn't exist (InternalError)");
		const voice = new Voice(this.settings.id, settings, urlobj, this);
		this.voiceChannels.set(channelId, voice);
		guild.set(channelId, voice);
		return voice;
	}
	onJoin = (_voice: Voice) => {};
	onLeave = (_voice: Voice) => {};
	private imute = false;
	video = false;
	stream = false;
	get mute() {
		return this.imute;
	}
	set mute(s) {
		const changed = this.imute !== s;
		this.imute = s;
		this.sendVoiceStateIfNeeded();
		if (this.currentVoice && changed) {
			this.currentVoice.updateMute();
		}
	}
	disconect() {
		if (!this.curChan) return;
		this.curChan = null;
		this.curGuild = null;
		this.sendVoiceState();
	}

	updateSelf() {
		if (this.currentVoice && this.currentVoice.open) {
			this.sendVoiceState();
		}
	}
	curGuild: string | null = null;
	curChan: string | null = null;
	lastSentState = "";
	sendVoiceStateIfNeeded() {
		const state = this.calcState;
		if (JSON.stringify(state) !== this.lastSentState) this.sendVoiceState();
	}
	get calcState() {
		return {
			op: 4,
			d: {
				guild_id: this.curGuild,
				channel_id: this.curChan,
				self_mute: this.imute,
				self_deaf: false,
				self_video: (this.curGuild ?? false) && this.video,
				flags: 3,
			},
		} as const;
	}
	sendVoiceState() {
		const send = this.calcState;
		this.lastSentState = JSON.stringify(send);
		this.handleGateway(send);
	}
	joinVoice(channelId: string, guildId: string, self_mute = false) {
		const voice = this.voiceChannels.get(channelId);
		this.mute = self_mute;
		if (this.currentVoice && this.currentVoice.ws) {
			this.currentVoice.leave();
		}
		this.curChan = channelId;
		this.curGuild = guildId;
		if (!voice) throw new Error(`Voice ${channelId} does not exist`);
		voice.join();
		this.currentVoice = voice;
		this.onJoin(voice);
		this.sendVoiceState();
		return voice;
	}
	leaveLive() {
		const userid = this.settings.id;
		const stream_key = `${this.curGuild === "@me" ? "call" : `guild:${this.curGuild}`}:${this.curChan}:${userid}`;
		this.handleGateway({
			op: 19,
			d: {
				stream_key,
			},
		});
	}
	live = new Map<string, (res: Voice) => void>();
	steamTokens = new Map<string, Promise<[string, string]>>();
	steamTokensRes = new Map<string, (res: [string, string]) => void>();
	async joinLive(userid: string) {
		const stream_key = `${this.curGuild === "@me" ? "call" : `guild:${this.curGuild}`}:${this.curChan}:${userid}`;
		this.handleGateway({
			op: 20,
			d: {
				stream_key,
			},
		});
		return new Promise<Voice>(async (res) => {
			this.live.set(stream_key, res);
			this.steamTokens.set(
				stream_key,
				new Promise<[string, string]>((res) => {
					this.steamTokensRes.set(stream_key, res);
				}),
			);
		});
	}
	islive = false;
	liveStream?: MediaStream;
	async createLive(stream: MediaStream) {
		const userid = this.settings.id;
		this.islive = true;
		this.liveStream = stream;
		const stream_key = `${this.curGuild === "@me" ? "call" : `guild:${this.curGuild}`}:${this.curChan}:${userid}`;
		this.handleGateway({
			op: 18,
			d: {
				type: this.curGuild === "@me" ? "call" : "guild",
				guild_id: this.curGuild === "@me" ? null : this.curGuild,
				channel_id: this.curChan,
				preferred_region: null,
			},
		});
		this.handleGateway({
			op: 22,
			d: {
				paused: false,
				stream_key,
			},
		});

		const voice = await new Promise<Voice>(async (res) => {
			this.live.set(stream_key, res);
			this.steamTokens.set(
				stream_key,
				new Promise<[string, string]>((res) => {
					this.steamTokensRes.set(stream_key, res);
				}),
			);
		});
		stream.getTracks().forEach((track) =>
			track.addEventListener("ended", () => {
				this.leaveLive();
			}),
		);
		return voice;
	}
	async streamCreate(create: streamCreate) {
		const prom1 = this.steamTokens.get(create.d.stream_key);
		if (!prom1) throw new Error("oops");
		const [token, endpoint] = await prom1;
		if (create.d.stream_key.startsWith("guild")) {
			const [_, _guild, chan, user] = create.d.stream_key.split(":");
			const voice2 = this.voiceChannels.get(chan);

			if (!voice2 || !voice2.session_id) throw new Error("oops");
			if (voice2.voiceMap.has(user)) {
				voice2.makeOp12();
				return;
			}
			let stream: undefined | MediaStream = undefined;
			console.error(user, this.settings.id);
			if (user === this.settings.id) {
				stream = this.liveStream;
			}
			const voice = new Voice(
				this.settings.id,
				{
					bitrate: 10000,
					stream: true,
				},
				{
					url: endpoint,
					token,
				},
				this,
			);
			voice.join();
			voice.startWS(voice2.session_id, create.d.rtc_server_id);
			let video = false;
			voice.onSatusChange = (e) => {
				console.warn(e);
				if (e === "done" && stream && !video) {
					console.error("starting to stream");
					voice.startVideo(stream);
					video = true;
				}
			};

			voice2.gotStream(voice, user);
			console.warn(voice2);
			const res = this.live.get(create.d.stream_key);
			if (res) res(voice);
		}
	}
	streamServerUpdate(update: streamServerUpdate) {
		const res = this.steamTokensRes.get(update.d.stream_key);
		if (res) res([update.d.token, update.d.endpoint]);
	}
	userMap = new Map<string, Voice>();
	voiceStateUpdate(update: voiceStatus) {
		const prev = this.userMap.get(update.user_id);
		console.log(prev, this.userMap);
		if (update.user_id === this.settings.id && this.liveStream && !update.self_stream) {
			const stream_key = `${this.curGuild === "@me" ? "call" : `guild:${this.curGuild}`}:${this.curChan}:${this.settings.id}`;
			this.handleGateway({
				op: 22,
				d: {
					paused: false,
					stream_key,
				},
			});
		}
		if (prev && prev !== this.voiceChannels.get(update.channel_id)) {
			prev.disconnect(update.user_id);
			this.onLeave(prev);
		}
		const voice = this.voiceChannels.get(update.channel_id);
		if (voice) {
			this.userMap.set(update.user_id, voice);
			voice.voiceupdate(update);
		}
	}
	private setUpGuild(id: string) {
		const obj: {url?: string; geturl?: Promise<void>; gotUrl?: () => void} = {};
		obj.geturl = new Promise<void>((res) => {
			obj.gotUrl = res;
		});
		this.guildUrlMap.set(id, obj as {geturl: Promise<void>; gotUrl: () => void});
	}
	voiceServerUpdate(update: voiceserverupdate) {
		const obj = this.guildUrlMap.get(update.d.guild_id);
		if (!obj) return;
		obj.url = update.d.endpoint;
		obj.token = update.d.token;
		obj.gotUrl();
	}
}
export type voiceStatusStr =
	| "done"
	| "notconnected"
	| "sendingStreams"
	| "conectionFailed"
	| "makingOffer"
	| "startingRTC"
	| "noSDP"
	| "waitingMainWS"
	| "waitingURL"
	| "badWS"
	| "wsOpen"
	| "wsAuth"
	| "left";
class UserVolume {
	gain!: GainNode;
	id: string;
	set volume(vol: number) {
		this.gain.gain.value = vol;
	}
	constructor(media: MediaStream, id: string) {
		this.startAudio(media);
		this.id = id;
	}
	async startAudio(media: MediaStream) {
		const context = new AudioContext();
		this.gain = context.createGain();
		console.log(context);
		await context.resume();
		const ss = context.createMediaStreamSource(media);
		console.log(media, ss);
		new Audio().srcObject = media; //weird I know, but it's for chromium/webkit bug
		ss.connect(this.gain);
		this.gain.connect(context.destination);
	}
}
class Voice {
	private pstatus: voiceStatusStr = "notconnected";
	public onSatusChange: (e: voiceStatusStr) => unknown = () => {};
	set status(e: voiceStatusStr) {
		console.log("state changed: " + e);
		this.pstatus = e;
		this.onSatusChange(e);
	}
	get status() {
		return this.pstatus;
	}
	readonly userid: string;
	settings: {bitrate: number; stream?: boolean; live?: MediaStream};
	urlobj: {url?: string; token?: string; geturl?: Promise<void>; gotUrl?: () => void};
	owner: VoiceFactory;
	constructor(
		userid: string,
		settings: Voice["settings"],
		urlobj: Voice["urlobj"],
		owner: VoiceFactory,
	) {
		this.userid = userid;
		this.settings = settings;
		this.urlobj = urlobj;
		this.owner = owner;
	}
	pc?: RTCPeerConnection;
	ws?: WebSocket;
	timeout: number = 30000;
	interval: NodeJS.Timeout = 0 as unknown as NodeJS.Timeout;
	time: number = 0;
	seq: number = 0;
	sendAlive() {
		if (this.ws) {
			this.ws.send(JSON.stringify({op: 3, d: 10}));
		}
	}
	users = new Map<number, string>();
	vidusers = new Map<number, string>();
	readonly speakingMap = new Map<string, number>();
	onSpeakingChange = (_userid: string, _speaking: number) => {};
	disconnect(userid: string) {
		console.warn(userid);
		if (userid === this.userid) {
			this.leave();
		}
		const ssrc = this.speakingMap.get(userid);

		if (ssrc) {
			this.users.set(ssrc, "");
			for (const thing of this.ssrcMap) {
				if (thing[1] === ssrc) {
					this.ssrcMap.delete(thing[0]);
				}
			}
		}
		this.speakingMap.delete(userid);
		this.userids.delete(userid);
		console.log(this.userids, userid);
		//there's more for sure, but this is "good enough" for now
		this.onMemberChange(userid, false);
	}

	async packet(message: MessageEvent) {
		const data = message.data;
		if (typeof data === "string") {
			const json: webRTCSocket = JSON.parse(data);
			switch (json.op) {
				case 2:
					this.startWebRTC();
					break;
				case 4:
					this.continueWebRTC(json);
					break;
				case 5:
					this.speakingMap.set(json.d.user_id, json.d.speaking);
					this.onSpeakingChange(json.d.user_id, json.d.speaking);
					break;
				case 6:
					this.time = json.d.t;
					setTimeout(this.sendAlive.bind(this), this.timeout);
					break;
				case 8:
					this.timeout = json.d.heartbeat_interval;
					setTimeout(this.sendAlive.bind(this), 1000);
					break;
				case 12:
					await this.figureRecivers();
					if (
						(!this.users.has(json.d.audio_ssrc) && json.d.audio_ssrc !== 0) ||
						(!this.vidusers.has(json.d.video_ssrc) && json.d.video_ssrc !== 0)
					) {
						console.log("redo 12!");
						this.makeOp12();
					}
					if (this.pc && json.d.audio_ssrc) {
						this.pc.addTransceiver("audio", {
							direction: "recvonly",
							sendEncodings: [{active: true}],
						});
						this.getAudioTrans(this.users.size + 1).direction = "recvonly";
						this.users.set(json.d.audio_ssrc, json.d.user_id);
					}
					if (this.pc && json.d.video_ssrc) {
						this.pc.addTransceiver("video", {
							direction: "recvonly",
							sendEncodings: [{active: true}],
						});
						this.getVideoTrans(this.vidusers.size + 1).direction = "recvonly";
						this.vidusers.set(json.d.video_ssrc, json.d.user_id);
					}

					break;
			}
		}
	}
	getVideoTrans(id: number) {
		if (!this.pc) throw new Error("no pc");
		let i = 0;
		for (const thing of this.pc.getTransceivers()) {
			if (thing.receiver.track.kind === "video") {
				if (id === i) {
					return thing;
				}
				i++;
			}
		}
		throw new Error("none by that id");
	}
	getAudioTrans(id: number) {
		if (!this.pc) throw new Error("no pc");
		let i = 0;
		for (const thing of this.pc.getTransceivers()) {
			if (thing.receiver.track.kind === "audio") {
				if (id === i) {
					return thing;
				}
				i++;
			}
		}
		throw new Error("none by that id");
	}
	hoffer?: string;
	get offer() {
		return this.hoffer;
	}
	set offer(e: string | undefined) {
		this.hoffer = e;
	}
	fingerprint?: string;
	async cleanServerSDP(sdp: string): Promise<string> {
		const out = await this.getCamInfo();
		if (out.rtx_ssrc) {
			this.vidusers.set(out.rtx_ssrc, this.userid);
			console.log(out);
		} else {
			const i = [...this.vidusers].findIndex((_) => _[1] === this.userid);
			this.vidusers.delete(i);
		}
		const pc = this.pc;
		if (!pc) throw new Error("pc isn't defined");
		const ld = pc.localDescription;
		if (!ld) throw new Error("localDescription isn't defined");
		const parsed = Voice.parsesdp(ld.sdp);
		const group = parsed.atr.get("group");
		console.warn(parsed);
		if (!group) throw new Error("group isn't in sdp");
		const [_, ...bundles] = (group.entries().next().value as [string, string])[0].split(" ");
		bundles[bundles.length - 1] = bundles[bundles.length - 1].replace("\r", "");
		console.log(bundles);

		if (!this.offer) throw new Error("Offer is missing :P");
		let cline = sdp.split("\n").find((line) => line.startsWith("c="));
		if (!cline) throw new Error("c line wasn't found");
		const parsed1 = Voice.parsesdp(sdp).medias[0];
		//const parsed2=Voice.parsesdp(this.offer);
		const rtcport = (parsed1.atr.get("rtcp") as Set<string>).values().next().value as string;
		const ICE_UFRAG = (parsed1.atr.get("ice-ufrag") as Set<string>).values().next().value as string;
		const ICE_PWD = (parsed1.atr.get("ice-pwd") as Set<string>).values().next().value as string;
		const FINGERPRINT =
			this.fingerprint ||
			((parsed1.atr.get("fingerprint") as Set<string>).values().next().value as string);
		this.fingerprint = FINGERPRINT;
		const candidate = (parsed1.atr.get("candidate") as Set<string>).values().next().value as string;

		const audioUsers = [...this.users];
		const videoUsers = [...this.vidusers];
		console.warn(audioUsers);

		let build = `v=0\r
o=- 1420070400000 0 IN IP4 ${this.urlobj.url}\r
s=-\r
t=0 0\r
a=msid-semantic: WMS *\r
a=group:BUNDLE ${bundles.join(" ")}\r`;
		let ai = -1;
		let vi = -1;
		let i = 0;
		for (const grouping of parsed.medias) {
			const cur =
				([...grouping.atr]
					.map((_) => _[0].trim())
					.find((_) =>
						new Set(["inactive", "recvonly", "sendonly", "sendrecv"]).has(_),
					) as "inactive") ||
				"recvonly" ||
				"sendonly" ||
				"sendrecv";
			const mode = {
				inactive: "inactive",
				recvonly: "sendonly",
				sendonly: "recvonly",
				sendrecv: "sendrecv",
			}[cur];
			if (grouping.media === "audio") {
				const port = [...grouping.ports][0];
				build += `
m=audio ${parsed1.port} UDP/TLS/RTP/SAVPF ${port}\r
${cline}\r
a=rtpmap:${port} opus/48000/2\r
a=fmtp:${port} minptime=10;useinbandfec=1;usedtx=1\r
a=rtcp:${rtcport}\r
a=rtcp-fb:${port} transport-cc\r
a=setup:passive\r
a=mid:${bundles[i]}${audioUsers[ai] && audioUsers[ai][1] ? `\r\na=msid:${audioUsers[ai][1]}-${audioUsers[ai][0]} a${audioUsers[ai][1]}-${audioUsers[ai][0]}\r` : "\r"}
a=maxptime:60\r
a=${audioUsers[ai] && audioUsers[ai][1] ? "sendonly" : mode}\r
a=ice-ufrag:${ICE_UFRAG}\r
a=ice-pwd:${ICE_PWD}\r
a=fingerprint:${FINGERPRINT}\r
a=candidate:${candidate}${audioUsers[ai] && audioUsers[ai][1] ? `\r\na=ssrc:${audioUsers[ai][0]} cname:${audioUsers[ai][1]}-${audioUsers[ai][0]}\r` : "\r"}
a=rtcp-mux\r`;
				console.log(audioUsers[ai], "audio user");
				ai++;
			} else {
				const set = grouping.atr.get("rtpmap") || new Set();
				let port1 = "";
				let port2 = "";
				for (const thing of set) {
					if (thing.includes("H264/90000") && !port1) {
						port1 = thing.split(" ")[0];
					} else if (thing.includes("rtx/90000") && !port2) {
						port2 = thing.split(" ")[0];
					}
				}

				build += `
m=video ${parsed1.port} UDP/TLS/RTP/SAVPF ${port1} ${port2}\r
${cline}\r
a=rtpmap:${port1} H264/90000\r
a=rtpmap:${port2} rtx/90000\r
a=fmtp:${port1} level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=fmtp:${port2} apt=${port1}\r
a=rtcp:${rtcport}\r
a=rtcp-fb:${port1} ccm fir\r
a=rtcp-fb:${port1} nack\r
a=rtcp-fb:${port1} nack pli\r
a=rtcp-fb:${port1} goog-remb\r
a=rtcp-fb:${port1} transport-cc\r
a=setup:passive\r
a=mid:${bundles[i]}${videoUsers[vi] && videoUsers[vi][1] ? `\r\na=msid:${videoUsers[vi][1]}-${videoUsers[vi][0]} v${videoUsers[vi][1]}-${videoUsers[vi][0]}\r` : "\r"}
a=${videoUsers[vi] && videoUsers[vi][1] ? "sendonly" : mode}\r
a=ice-ufrag:${ICE_UFRAG}\r
a=ice-pwd:${ICE_PWD}\r
a=fingerprint:${FINGERPRINT}\r
a=candidate:${candidate}${videoUsers[vi] && videoUsers[vi][1] ? `\r\na=ssrc:${videoUsers[vi][0]} cname:${videoUsers[vi][1]}-${videoUsers[vi][0]}\r` : "\r"}
a=rtcp-mux\r`;
				vi++;
				console.log(mode, "fine me :3");
			}
			i++;
		}
		build += "\n";
		console.log(ld.sdp, "fime :3", build, this.pc?.remoteDescription?.sdp);
		return build;
	}
	counter?: string;
	forceNext: boolean = false;
	async updateRemote() {
		const counter = this.counter;
		if (!counter || !this.pc) return;
		const remote: {sdp: string; type: RTCSdpType} = {
			sdp: await this.cleanServerSDP(counter),
			type: "answer",
		};
		console.log([remote.sdp, this.pc.localDescription?.sdp]);
		await this.pc.setRemoteDescription(remote);
	}
	negotationneeded() {
		if (this.pc) {
			const pc = this.pc;
			let setting = false;
			const setLocal = async (forced: boolean = this.forceNext) => {
				if (setting) return;
				const val = (Math.random() * 1000) ^ 0;

				setting = true;
				const offer = await pc.createOffer();
				if (offer.sdp === pc.localDescription?.sdp || forced) {
					if (forced) console.log("foced :3");
					logState("update", "will Sent offer " + val);
					await pc.setLocalDescription();
					logState("update", "Sent offer " + val);
				}
				setting = false;
				this.forceNext = false;
			};
			const sendOffer = async (forced = this.forceNext) => {
				if (!setting) {
					setLocal(forced);
					console.log("set local");
				}

				const senders = this.senders.difference(this.ssrcMap);
				console.log(senders, this.ssrcMap);
				let made12 = false;
				this.pc
					?.getStats()
					.then((_) => _.forEach((_) => _.type === "local-candidate" || console.error(_)));
				console.log(pc.localDescription?.sdp);
				for (const sender of senders) {
					const d = await sender.getStats();
					let found = false;
					d.forEach((thing) => {
						if (thing.ssrc) {
							made12 = true;
							found = true;
							this.ssrcMap.set(sender, thing.ssrc);
							this.makeOp12(sender);
							console.warn("ssrc");
						}
					});
					//TODO Firefox made me do this, if I can figure out how to not do this, that'd be great
					if (!found && pc.localDescription?.sdp) {
						const sdp = Voice.parsesdp(pc.localDescription.sdp);

						const index = pc.getTransceivers().findIndex((_) => _.sender === sender);
						const temp = sdp.medias[index].atr.get("ssrc");
						if (temp) {
							const ssrc = +[...temp][0].split(" ")[0];
							this.ssrcMap.set(sender, ssrc);
							this.makeOp12(sender);
							console.warn("ssrc");
							made12 = true;
						}
					}
				}
				if (!made12) {
					console.warn("this was ran :3");
					this.makeOp12();
				}
			};
			const detectDone = () => {
				if (
					pc.signalingState === "stable" &&
					pc.iceConnectionState === "connected" &&
					pc.connectionState === "connected"
				) {
					this.status = "done";
				}
				console.log(pc.signalingState, pc.iceConnectionState, pc.connectionState);
			};
			function logState(thing: string, message = "") {
				console.log("log state: " + thing + (message ? ":" + message : ""));
			}
			pc.addEventListener("negotiationneeded", async () => {
				logState("negotiationneeded");
				await sendOffer(true);
				console.log(this.ssrcMap);
			});
			pc.onicecandidate = (e) => {
				console.warn(e.candidate);
			};

			pc.addEventListener("signalingstatechange", async () => {
				logState("signalingstatechange", pc.signalingState);
				detectDone();
				while (!this.counter) await new Promise((res) => setTimeout(res, 100));
				if (this.pc && this.counter) {
					console.warn("in here :3");
					if (pc.signalingState === "have-local-offer") {
						const val = (Math.random() * 1000) ^ 0;
						logState("update", "start sent remote " + val);
						await this.updateRemote();
						logState("update", "end sent remote " + val);
					}
				} else {
					console.warn("uh oh!");
				}
			});
			pc.addEventListener("connectionstatechange", async () => {
				logState("connectionstatechange", pc.connectionState);
				detectDone();
				if (pc.connectionState === "connecting") {
					//logState("update2", "start Set local desc");
					//await pc.setLocalDescription();
					//logState("update2", "Set local desc");
				}
			});
			pc.addEventListener("icegatheringstatechange", async () => {
				logState("icegatheringstatechange", pc.iceGatheringState);
				detectDone();
				console.log(this.counter, this.pc);
				if (pc.iceGatheringState === "complete") {
					if (setting) return;
					if (this.pc && this.counter) {
						setLocal();
					}
				}
			});
			pc.addEventListener("iceconnectionstatechange", async () => {
				logState("iceconnectionstatechange", pc.iceConnectionState);

				detectDone();
				if (pc.iceConnectionState === "checking") {
					await sendOffer();
				}
			});
		}
	}
	async getCamInfo() {
		let video_ssrc = 0;
		let rtx_ssrc = 0;
		const cammera = this.cammera;
		const cam = this.cam;
		let attemps = 0;
		if (cam && cammera) {
			do {
				if (attemps > 10) {
					return {video_ssrc, rtx_ssrc};
				}
				const stats = (await cam.sender.getStats()) as Map<string, any>;
				Array.from(stats).forEach((_) => {
					if (_[1].ssrc) {
						video_ssrc = _[1].ssrc;
						console.warn(_);
					}
					if (_[1].rtxSsrc) {
						rtx_ssrc = _[1].rtxSsrc;
					}
				});
				const settings = cammera.getSettings();
				console.error(settings);
				attemps++;
				await new Promise((res) => setTimeout(res, 100));
			} while (!video_ssrc || !rtx_ssrc);
		}
		return {video_ssrc, rtx_ssrc};
	}
	async makeOp12(sender: RTCRtpSender | undefined | [RTCRtpSender, number] = this.mic?.sender) {
		//debugger;
		//await new Promise((res) => setTimeout(res, 500));
		this.owner.sendVoiceStateIfNeeded();
		console.warn("making 12?");
		if (!this.ws) return;
		if (sender instanceof Array) {
			sender = sender[0];
		}
		//console.trace(sender === this.mic?.sender);

		let max_framerate = 20;
		let width = 1280;
		let height = 720;
		const {rtx_ssrc, video_ssrc} = await this.getCamInfo();
		if (this.cam && this.cammera) {
		} else if (!sender) {
			return;
		}

		console.log(this.ssrcMap);
		try {
			console.error("start 12");
			if (!video_ssrc)
				this.ws.send(
					JSON.stringify({
						op: 12,
						d: {
							audio_ssrc: 0,
							video_ssrc: 0,
							rtx_ssrc: 0,
							streams: [
								{
									type: "video",
									rid: "100",
									ssrc: video_ssrc,
									active: !!video_ssrc,
									quality: 100,
									rtx_ssrc: rtx_ssrc,
									max_bitrate: 2500000, //TODO
									max_framerate, //TODO
									max_resolution: {type: "fixed", width, height},
								},
							],
						},
					}),
				);
			this.ws.send(
				JSON.stringify({
					op: 12,
					d: {
						audio_ssrc:
							sender?.track?.kind === "audio"
								? this.owner.mute
									? 0
									: this.ssrcMap.get(sender as RTCRtpSender)
								: 0,
						video_ssrc,
						rtx_ssrc,
						streams: [
							{
								type: "video",
								rid: "100",
								ssrc: video_ssrc,
								active: !!video_ssrc,
								quality: 100,
								rtx_ssrc: rtx_ssrc,
								max_bitrate: 2500000, //TODO
								max_framerate, //TODO
								max_resolution: {type: "fixed", width, height},
							},
						],
					},
				}),
			);
			this.status = "sendingStreams";
			console.error("made 12");
		} catch (e) {
			console.error(e);
		}
	}
	micContext = new AudioContext();
	streamDest?: MediaStreamAudioDestinationNode;
	micNode = this.micContext.createGain();
	makeMicOuts() {
		//if (this.streamDest) this.streamDest.disconnect(this.micNode);
		this.streamDest = this.micContext.createMediaStreamDestination();
		this.micNode.gain.setValueAtTime(1, this.micContext.currentTime);

		if (!this.owner.mute) this.micNode.connect(this.streamDest);

		return this.streamDest.stream;
	}
	async giveMicTrack(stream: MediaStream) {
		/*
		const audioStream = await ;

		*/
		if (this.micTrack) this.micTrack.stop();
		this.micContext.resume();
		const microphone = this.micContext.createMediaStreamSource(stream);
		microphone.connect(this.micNode);
		const [track] = stream.getAudioTracks();
		this.micTrack = track;
		track.enabled = true;
	}
	senders: Set<RTCRtpSender> = new Set();
	recivers = new Set<RTCRtpReceiver>();
	ssrcMap: Map<RTCRtpSender, number> = new Map();
	speaking = false;
	async setupMic() {
		const analyser = this.micContext.createAnalyser();
		analyser.smoothingTimeConstant = 0;
		analyser.fftSize = 32;

		this.micNode.connect(analyser);
		const array = new Float32Array(1);
		const interval = setInterval(() => {
			if (!this.ws) {
				clearInterval(interval);
			}
			if (!this.owner.mute) analyser.getFloatFrequencyData(array);
			const value = this.owner.mute ? -Infinity : array[0] + 65;
			if (value < 0) {
				if (this.speaking) {
					this.speaking = false;
					this.sendSpeaking();
					console.log("not speaking");
				}
			} else if (!this.speaking) {
				console.log("speaking");
				this.speaking = true;
				this.sendSpeaking();
			}
		}, 500);
	}
	async sendSpeaking() {
		if (!this.ws) return;
		const pair = this.ssrcMap.entries().next().value;
		if (!pair) return;
		this.onSpeakingChange(this.userid, +this.speaking);
		this.ws.send(
			JSON.stringify({
				op: 5,
				d: {
					speaking: this.speaking,
					delay: 5, //not sure
					ssrc: pair[1],
				},
			}),
		);
	}
	async continueWebRTC(data: sdpback) {
		if (this.pc && this.offer) {
			this.counter = data.d.sdp;
		} else {
			this.status = "conectionFailed";
		}
	}
	reciverMap = new Map<number, RTCRtpReceiver>();
	off?: Promise<RTCSessionDescriptionInit>;
	async makeOffer() {
		if (this.off) {
			if (this.pc?.localDescription?.sdp) return {sdp: this.pc?.localDescription?.sdp};
			return this.off;
		}
		return (this.off = new Promise<RTCSessionDescriptionInit>(async (res) => {
			if (!this.pc) throw new Error("stupid");
			console.error("stupid!");
			const offer = await this.pc.createOffer({
				offerToReceiveAudio: true,
				offerToReceiveVideo: true,
			});
			res(offer);
		}));
	}
	async figureRecivers() {
		await new Promise((res) => setTimeout(res, 500));
		for (const reciver of this.recivers) {
			const stats = (await reciver.getStats()) as Map<string, any>;
			for (const thing of stats) {
				if (thing[1].ssrc) {
					this.reciverMap.set(thing[1].ssrc, reciver);
				}
			}
		}
		console.log(this.reciverMap);
	}
	updateMute() {
		if (this.owner.mute) {
			if (this.streamDest) this.micNode.disconnect(this.streamDest);
		} else {
			if (this.streamDest) this.micNode.connect(this.streamDest);
		}
		//this.pc?.setLocalDescription();
		this.makeOp12();
	}
	mic?: RTCRtpTransceiver;
	micTrack?: MediaStreamTrack;
	onVideo = (_video: HTMLVideoElement, _id: string) => {};
	videos = new Map<string, HTMLVideoElement>();
	cam?: RTCRtpTransceiver;
	cammera?: MediaStreamTrack;
	async stopVideo() {
		if (!this.cam) return;
		this.owner.video = false;
		if (!this.cammera || !this.pc) return;
		this.cammera.stop();
		this.cammera = undefined;

		this.cam.sender.replaceTrack(null);
		this.cam.direction = "inactive";

		this.pc.setLocalDescription(await this.pc.createOffer());

		this.owner.updateSelf();

		this.videos.delete(this.userid);
		this.onUserChange(this.userid, {
			deaf: false,
			muted: this.owner.mute,
			video: false,
			live: this.owner.stream,
		});
	}
	liveMap = new Map<string, HTMLVideoElement>();
	voiceMap = new Map<string, Voice>();
	isLive() {
		return !!this.voiceMap.get(this.userid);
	}
	getLive(id: string) {
		return this.liveMap.get(id);
	}
	joinLive(id: string) {
		return this.owner.joinLive(id);
	}
	createLive(stream: MediaStream) {
		return this.owner.createLive(stream);
	}
	leaveLive(id: string) {
		const v = this.voiceMap.get(id);
		if (!v) return;
		v.leave();
		this.voiceMap.delete(id);
		this.liveMap.delete(id);
		this.onLeaveStream(id);
	}
	stopStream() {
		this.leaveLive(this.userid);
		this.owner.leaveLive();
	}
	onLeaveStream = (_user: string) => {};
	onGotStream = (_v: HTMLVideoElement, _user: string) => {};
	gotStream(voice: Voice, user: string) {
		voice.onVideo = (video) => {
			this.liveMap.set(user, video);
			this.onGotStream(video, user);
		};
		this.voiceMap.set(user, voice);
	}
	videoStarted = false;
	async startVideo(caml: MediaStream) {
		while (!this.cam) {
			await new Promise((res) => setTimeout(res, 100));
		}
		console.warn("test test test test video sent!");
		const tracks = caml.getVideoTracks();
		const [cam] = tracks;

		if (!this.settings.stream) this.owner.video = true;

		this.cammera = cam;

		const video = document.createElement("video");
		forceVideo(video);
		this.onVideo(video, this.userid);
		this.videos.set(this.userid, video);
		video.srcObject = caml;
		video.autoplay = true;
		this.cam.direction = "sendonly";
		const sender = this.cam.sender;
		this.senders.add(sender);

		await sender.replaceTrack(cam);
		sender.setStreams(caml);

		this.forceNext = true;

		console.warn("replaced track", cam);
		this.pc?.setLocalDescription((await this.pc?.createOffer()) || {});
		this.owner.updateSelf();
		if (this.settings.stream) {
			this.makeOp12();
		}
	}
	onconnect = () => {};
	streams = new Set<MediaStreamTrack>();
	uVolMap = new Map<string, UserVolume>();
	onUserVol: (uv: UserVolume) => unknown = () => {};
	async startWebRTC() {
		this.status = "makingOffer";
		const pc = new RTCPeerConnection({
			bundlePolicy: "max-bundle",
		});
		pc.ontrack = async (e) => {
			this.status = "done";
			this.onconnect();
			const media = e.streams[0];
			if (!media) {
				console.log(e);
				return;
			}
			const userId = media.id.split("-")[0];
			if (e.track.kind === "video") {
				//TODO I don't know why but without this firefox bugs out on streams
				if (media.id.match("{")) return;
				if (this.owner.currentVoice?.voiceMap.get(this.userid) === this) {
					return;
				}

				this.streams.add(e.track);
				const video = document.createElement("video");
				forceVideo(video);
				this.onVideo(video, userId);
				this.videos.set(userId, video);
				video.srcObject = media;
				console.log(video);

				video.autoplay = true;
				const settings = e.track.getConstraints();

				console.log("gotVideo?", media, settings);
				//settings.height = 300;
				//settings.width = 300;
				e.track.applyConstraints(settings);
				//e.track

				//if ("resizeMode" in settings)
				return;
			}

			console.log("got audio:", e);
			for (const track of media.getTracks()) {
				console.log(track);
			}
			const a = new UserVolume(media, userId);
			this.uVolMap.set(userId, a);
			this.onUserVol(a);

			this.recivers.add(e.receiver);
			console.log(this.recivers);
		};
		if (!this.settings.stream) {
			const outStream = this.makeMicOuts();
			/*

			*/
			const sender = pc.addTransceiver(outStream.getTracks()[0]);
			this.mic = sender;
			this.senders.add(sender.sender);
			console.log(sender);
		} else {
			pc.addTransceiver("audio", {
				direction: "inactive",
				streams: [],
				sendEncodings: [{active: true, maxBitrate: this.settings.bitrate}],
			});
		}
		this.cam = pc.addTransceiver("video", {
			direction: "sendonly",
			streams: [],
			sendEncodings: [
				{active: true, maxBitrate: 2500000, scaleResolutionDownBy: 1, maxFramerate: 20},
			],
		});
		const count = this.settings.stream ? 1 : 10;
		for (let i = 0; i < count; i++) {
			pc.addTransceiver("audio", {
				direction: "inactive",
				streams: [],
				sendEncodings: [{active: true, maxBitrate: this.settings.bitrate}],
			});
		}
		if (this.settings.live) {
			this.cam = pc.addTransceiver("video", {
				direction: "sendonly",
				streams: [],
				sendEncodings: [
					{active: true, maxBitrate: 2500000, scaleResolutionDownBy: 1, maxFramerate: 20},
				],
			});
			await this.startVideo(this.settings.live);
		} else {
			for (let i = 0; i < count; i++) {
				pc.addTransceiver("video", {
					direction: "inactive",
					streams: [],
					sendEncodings: [{active: true, maxBitrate: this.settings.bitrate}],
				});
			}
		}
		//this.makeOp12();

		this.pc = pc;
		await this.makeOp12(this.mic?.sender);
		this.negotationneeded();
		await new Promise((res) => setTimeout(res, 100));
		let sdp = this.offer;
		if (!sdp) {
			const offer = await this.makeOffer();
			this.status = "startingRTC";
			sdp = offer.sdp;
			this.offer = sdp;
		}

		await pc.setLocalDescription();
		if (!sdp) {
			this.status = "noSDP";
			this.ws?.close();
			return;
		}
		const parsed = Voice.parsesdp(sdp);
		const video = new Map<string, [number, number]>();
		const audio = new Map<string, number>();
		let cur: [number, number] | undefined;
		let i = 0;
		for (const thing of parsed.medias) {
			try {
				if (thing.media === "video") {
					const rtpmap = thing.atr.get("rtpmap");
					if (!rtpmap) continue;
					for (const codecpair of rtpmap) {
						const [port, codec] = codecpair.split(" ");
						if (cur && codec.split("/")[0] === "rtx") {
							cur[1] = Number(port);
							cur = undefined;
							continue;
						}
						if (video.has(codec.split("/")[0])) continue;
						cur = [Number(port), -1];
						video.set(codec.split("/")[0], cur);
					}
				} else if (thing.media === "audio") {
					const rtpmap = thing.atr.get("rtpmap");
					if (!rtpmap) continue;
					for (const codecpair of rtpmap) {
						const [port, codec] = codecpair.split(" ");
						if (audio.has(codec.split("/")[0])) {
							continue;
						}
						audio.set(codec.split("/")[0], Number(port));
					}
				}
			} finally {
				i++;
			}
		}

		const codecs: {
			name: string;
			type: "video" | "audio";
			priority: number;
			payload_type: number;
			rtx_payload_type: number | null;
		}[] = [];
		const include = new Set<string>();
		const audioAlloweds = new Map([["opus", {priority: 1000}]]);
		for (const thing of audio) {
			if (audioAlloweds.has(thing[0])) {
				include.add(thing[0]);
				codecs.push({
					name: thing[0],
					type: "audio",
					priority: audioAlloweds.get(thing[0])?.priority as number,
					payload_type: thing[1],
					rtx_payload_type: null,
				});
			}
		}
		const videoAlloweds = new Map([
			["H264", {priority: 1000}],
			["VP8", {priority: 2000}],
			["VP9", {priority: 3000}],
		]);
		for (const thing of video) {
			if (videoAlloweds.has(thing[0])) {
				include.add(thing[0]);
				codecs.push({
					name: thing[0],
					type: "video",
					priority: videoAlloweds.get(thing[0])?.priority as number,
					payload_type: thing[1][0],
					rtx_payload_type: thing[1][1],
				});
			}
		}
		let sendsdp = "a=extmap-allow-mixed";
		let first = true;

		for (const media of parsed.medias) {
			for (const thing of first
				? (["ice-ufrag", "ice-pwd", "ice-options", "fingerprint", "extmap", "rtpmap"] as const)
				: (["extmap", "rtpmap"] as const)) {
				let thing2 = media.atr.get(thing);
				if (!thing2) {
					thing2 = parsed.atr.get(thing);
					if (!thing2) {
						console.error("couldn't find " + thing);
						continue;
					}
				}
				for (const thing3 of thing2) {
					if (thing === "rtpmap") {
						const name = thing3.split(" ")[1].split("/")[0];
						if (include.has(name)) {
							include.delete(name);
						} else {
							continue;
						}
					}
					sendsdp += `\na=${thing}:${thing3}`;
				}
			}
			first = false;
		}
		console.log(sendsdp);
		if (this.ws) {
			this.ws.send(
				JSON.stringify({
					d: {
						codecs,
						protocol: "webrtc",
						data: sendsdp,
						sdp: sendsdp,
					},
					op: 1,
				}),
			);
		}
		console.warn("done with this!");
	}
	static parsesdp(sdp: string) {
		let currentA = new Map<string, Set<string>>();
		const out: {
			version?: number;
			medias: {
				media: string;
				port: number;
				proto: string;
				ports: number[];
				atr: Map<string, Set<string>>;
			}[];
			atr: Map<string, Set<string>>;
		} = {medias: [], atr: currentA};
		for (const line of sdp.split("\n")) {
			const [code, setinfo] = line.split("=");
			switch (code) {
				case "v":
					out.version = Number(setinfo);
					break;
				case "o":
				case "s":
				case "t":
					break;
				case "m":
					currentA = new Map();
					const [media, port, proto, ...ports] = setinfo.split(" ");
					const portnums = ports.map(Number);
					out.medias.push({media, port: Number(port), proto, ports: portnums, atr: currentA});
					break;
				case "a":
					const [key, ...value] = setinfo.split(":");
					if (!currentA.has(key)) {
						currentA.set(key, new Set());
					}
					currentA.get(key)?.add(value.join(":"));
					break;
			}
		}
		return out;
	}
	open = false;
	async join() {
		console.warn("Joining");
		this.open = true;
		this.status = "waitingMainWS";
	}
	onMemberChange = (_member: memberjson | string, _joined: boolean) => {};
	userids = new Map<string, {deaf: boolean; muted: boolean; video: boolean; live: boolean}>();
	onUserChange = (
		_user: string,
		_change: {deaf: boolean; muted: boolean; video: boolean; live: boolean},
	) => {};
	async voiceupdate(update: voiceStatus) {
		console.log("Update!");
		if (!this.userids.has(update.user_id)) {
			this.onMemberChange(update?.member || update.user_id, true);
		}
		const vals = {
			deaf: update.deaf,
			muted: update.mute || update.self_mute,
			video: update.self_video,
			live: update.self_stream,
		};
		this.onUserChange(update.user_id, vals);
		this.userids.set(update.user_id, vals);
		if (update.user_id === this.userid && this.videoStarted !== update.self_video) {
			this.makeOp12();
			this.videoStarted = update.self_video;
		}
		if (update.user_id === this.userid && this.open && !this.ws) {
			if (!update) {
				this.status = "badWS";
				return;
			}
			this.session_id = update.session_id;
			await this.startWS(update.session_id, update.guild_id);
		}
	}
	session_id?: string;
	async startWS(session_id: string, server_id: string) {
		if (!this.urlobj.url) {
			this.status = "waitingURL";
			await this.urlobj.geturl;
			if (!this.open) {
				this.leave();
				return;
			}
		}

		const ws = new WebSocket(
			((this.owner.secure ? "wss://" : "ws://") + this.urlobj.url) as string,
		);
		this.ws = ws;
		this.setupMic();
		ws.onclose = () => {
			this.leave();
		};
		this.status = "wsOpen";
		ws.addEventListener("message", (m) => {
			this.packet(m);
		});
		await new Promise<void>((res) => {
			ws.addEventListener("open", () => {
				res();
			});
		});
		if (!this.ws) {
			this.leave();
			return;
		}
		this.status = "wsAuth";
		ws.send(
			JSON.stringify({
				op: 0,
				d: {
					server_id,
					user_id: this.userid,
					session_id,
					token: this.urlobj.token,
					max_secure_frames_version: 0,
					video: !!this.settings.live,
					streams: [
						{
							type: this.settings.live ? "screen" : "video",
							rid: "100",
							quality: 100,
						},
					],
				},
			}),
		);
	}
	onLeave = () => {};
	async leave() {
		console.warn("leave");
		this.open = false;
		this.status = "left";
		if (!this.settings.stream) this.owner.video = false;
		this.onLeave();

		for (const thing of this.liveMap) {
			this.leaveLive(thing[0]);
		}
		if (!this.settings.stream) {
			this.onMemberChange(this.userid, false);
		}
		this.userids.delete(this.userid);
		if (this.ws) {
			this.ws.close();
			this.ws = undefined;
		}
		if (this.pc) {
			this.pc.close();
			this.pc = undefined;
		}
		this.micTrack?.stop();
		this.micTrack = undefined;
		this.mic = undefined;
		this.off = undefined;
		this.counter = undefined;
		this.offer = undefined;
		this.senders = new Set();
		this.recivers = new Set();
		this.ssrcMap = new Map();
		this.fingerprint = undefined;
		this.users = new Map();
		if (!this.settings.stream) this.owner.disconect();
		this.vidusers = new Map();
		this.videos = new Map();
		if (this.cammera) this.cammera.stop();
		this.cammera = undefined;
		this.cam = undefined;
		console.log(this);
	}
}
export {Voice, VoiceFactory};
