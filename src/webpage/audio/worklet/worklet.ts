import {Audio} from "./audio";
import {mixAudio} from "./mixAudio";
import {Play} from "./play";
let plays: [[number], string, number][] = [];
class TestProcessor extends AudioWorkletProcessor implements AudioWorkletProcessorImpl {
	play?: Play;
	constructor() {
		super();
		this.port.onmessage = (e) => {
			const message = e.data as sendMessage;
			switch (message.name) {
				case "bin":
					this.play = Play.parseBin(message.bin);
					break;
				case "getTracks":
					this.postMessage({
						name: "tracks",
						tracks: this.play ? [...this.play.audios.keys()] : [],
					});
					break;
				case "start":
					plays.push([[0], message.data.name, message.data.volume]);
					break;
				case "clear":
					plays = [];
					break;
			}
		};
	}
	postMessage(message: recvMessage) {
		this.port.postMessage(message);
	}

	process(
		_inputs: Float32Array[][],
		outputs: Float32Array[][],
		_parameters: Record<string, Float32Array>,
	) {
		const output = outputs[0];
		const mplays = plays
			.map((_) => [_[0], this.play?.audios.get(_[1]), _[2]] as const)
			.filter((play) => play[1]) as [[number], Audio, number][];
		if (!mplays.length) return true;
		const channel = output[0];

		for (let i = 0; i < channel.length; i++) {
			let av = 0;
			for (const play of mplays) {
				const vol = play[1].getNumber((play[0][0] / sampleRate) * 1000) * play[2];
				if (vol !== 0) {
					av = mixAudio(av, vol);
				}

				play[0][0]++;
			}
			channel[i] = av;
		}
		plays = mplays
			.filter((play) => !play[1].isdone((play[0][0] / sampleRate) * 1000))
			.map((_) => [_[0], _[1].name, _[2]]);

		return true;
	}
}

registerProcessor("audio", TestProcessor);
