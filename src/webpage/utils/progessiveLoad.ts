export class ProgressiveArray {
	read?: ReadableStreamDefaultReader<Uint8Array>;
	controller: AbortController;
	cbuff?: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
	index = 0;
	sizeLeft = 0;
	ready: Promise<void>;
	constructor(url: string, req: RequestInit = {}) {
		this.controller = new AbortController();
		this.ready = fetch(url, {
			...req,
			signal: this.controller.signal,
		}).then(async (f) => {
			if (!f.ok || !f.body) {
				throw new Error("request not ok");
			}
			const read = f.body.getReader();
			this.cbuff = (await read.read()).value;
			this.read = read;
		});
	}
	async next() {
		return (await this.get8BitArray(1))[0];
	}
	async get8BitArray(size: number) {
		if (!this.read) throw new Error("not ready to read");
		this.sizeLeft -= size;
		const arr = new Uint8Array(size);
		let arri = 0;
		while (size > 0) {
			if (!this.cbuff) throw Error("ran out of file to read");
			let itter = Math.min(size, this.cbuff.length - this.index);
			size -= itter;
			for (let i = 0; i < itter; i++, arri++, this.index++) {
				arr[arri] = this.cbuff[this.index];
			}

			if (size !== 0) {
				this.cbuff = (await this.read.read()).value;
				this.index = 0;
			}
		}
		return arr;
	}
	decoder = new TextDecoder();
	backChar?: string;
	chars = "";
	curchar = 0;
	async getChar() {
		if (this.backChar) {
			const temp = this.backChar;
			delete this.backChar;
			return temp;
		}
		let char: string;
		if ((char = this.chars[this.curchar])) {
			this.curchar++;
			return char;
		}
		let chars = "";
		while (!chars) {
			const buflen = (this.cbuff?.length || 0) - this.index;
			chars = this.decoder.decode((await this.get8BitArray(buflen <= 0 ? 1 : buflen)).buffer, {
				stream: true,
			});
		}
		this.chars = chars;
		this.curchar = 1;
		return chars[0];
	}
	putBackChar(char: string) {
		this.backChar = char;
	}
	close() {
		try {
			this.controller.abort();
		} catch {
			//Ignore error when trying to close after it was closed
		}
	}
}

async function getNextNonWhiteSpace(prog: ProgressiveArray) {
	let char = " ";
	const whiteSpace = new Set("\n\t \r");
	while (whiteSpace.has(char)) {
		char = await prog.getChar();
	}
	return char;
}
async function identifyType(prog: ProgressiveArray) {
	let char = await getNextNonWhiteSpace(prog);
	switch (char) {
		case "-":
		case "0":
		case "1":
		case "2":
		case "3":
		case "4":
		case "5":
		case "6":
		case "7":
		case "8":
		case "9": {
			const validNumber = new Set("0123456789eE.+-");
			let build = "";
			do {
				build += char;
				char = await prog.getChar();
			} while (validNumber.has(char));
			prog.putBackChar(char);
			return Number(build);
		}
		case '"':
			let build = "";
			do {
				build += char;
				if (char == "\\") {
					char = await prog.getChar();
					build += char;
				}
				char = await prog.getChar();
			} while (char !== '"');
			build += char;
			return JSON.parse(build) as string;
		case "t":
		case "f":
		case "n": {
			let build = char;
			while (build.match(/(^tr?u?$)|(^fa?l?s?$)|(^nu?l?$)/)) {
				char = await prog.getChar();
				build += char;
			}
			return JSON.parse(build) as boolean | null;
		}
		case "[":
			return await ArrayProgressive.make(prog);
		case "{":
			return await ObjectProgressive.make(prog);
		default:
			throw new Error("bad JSON");
	}
}
class ArrayProgressive<T, X extends Array<T>> {
	ondone = async () => {};
	prog: ProgressiveArray;
	done = false;
	private constructor(prog: ProgressiveArray) {
		this.prog = prog;
	}
	static async make(prog: ProgressiveArray) {
		const o = new ArrayProgressive(prog);
		await o.check();
		return o;
	}
	async check() {
		const lastChar = await getNextNonWhiteSpace(this.prog);
		if (lastChar === "]") {
			this.done = true;
			await this.ondone();
			return;
		} else {
			this.prog.putBackChar(lastChar);
		}
	}
	awaiting = new Promise<void>((_) => _());

	async doChecks(): Promise<() => void> {
		let res1: () => void;
		let cur = new Promise<void>((res) => {
			res1 = res;
		});
		[cur, this.awaiting] = [this.awaiting, cur];
		await cur;

		return () => res1();
	}
	async getNext(): Promise<Progressive<T>> {
		const checks = await this.doChecks();
		if (this.done) throw new Error("no more array");
		const ret = (await identifyType(this.prog)) as Progressive<T>;
		const check = async () => {
			const lastChar = await getNextNonWhiteSpace(this.prog);
			if (lastChar === "]") {
				this.done = true;
				await this.ondone();
			} else if (lastChar !== ",") throw Error("Bad JSON Object:" + lastChar);
			checks();
		};
		if ((ret instanceof ArrayProgressive || ret instanceof ObjectProgressive) && !ret.done) {
			ret.ondone = check;
		} else {
			await check();
		}

		return ret;
	}
	async *[Symbol.asyncIterator]() {
		while (!this.done) {
			yield await this.getNext();
		}
	}
	/**
	 * this only gets what's left, not everything
	 */
	async getWhole(): Promise<X> {
		const arr: T[] = [];
		while (!this.done) {
			let t = await this.getNext();
			if (t instanceof ArrayProgressive) {
				t = await t.getWhole();
			}
			if (t instanceof ObjectProgressive) {
				t = await t.getWhole();
			}
			arr.push(t as T);
		}

		return arr as X;
	}
}
class ObjectProgressive<X extends Object> {
	ondone = async () => {};
	prog: ProgressiveArray;
	done = false;
	private constructor(prog: ProgressiveArray) {
		this.prog = prog;
	}
	static async make(prog: ProgressiveArray) {
		const o = new ObjectProgressive(prog);
		await o.check();
		return o;
	}
	async check() {
		const lastChar = await getNextNonWhiteSpace(this.prog);
		if (lastChar === "}") {
			this.done = true;
			await this.ondone();
			return;
		} else {
			this.prog.putBackChar(lastChar);
		}
	}
	awaiting = new Promise<void>((_) => _());

	async doChecks(): Promise<() => void> {
		let res1: () => void;
		let cur = new Promise<void>((res) => {
			res1 = res;
		});
		[cur, this.awaiting] = [this.awaiting, cur];
		await cur;
		return () => res1();
	}
	async getNextPair(): Promise<{[K in keyof X]: {key: K; value: Progressive<X[K]>}}[keyof X]> {
		const checks = await this.doChecks();
		if (this.done) throw new Error("no more object");
		const key = (await identifyType(this.prog)) as unknown;
		if (typeof key !== "string") {
			throw Error("Bad key:" + key);
		}
		const nextChar = await getNextNonWhiteSpace(this.prog);
		if (nextChar !== ":") throw Error("Bad JSON");
		const value = (await identifyType(this.prog)) as unknown;
		const check = async () => {
			const lastChar = await getNextNonWhiteSpace(this.prog);
			if (lastChar === "}") {
				this.done = true;
				await this.ondone();
			} else if (lastChar !== ",") throw Error("Bad JSON Object:" + lastChar);
			checks();
		};
		if ((value instanceof ArrayProgressive || value instanceof ObjectProgressive) && !value.done) {
			value.ondone = check;
		} else {
			await check();
		}
		return {key, value} as any;
	}
	/**
	 * this only gets what's left, not everything
	 */
	async getWhole(): Promise<X> {
		const obj: Partial<X> = {};
		while (!this.done) {
			let {key, value} = await this.getNextPair();
			if (value instanceof ArrayProgressive) {
				value = await value.getWhole();
			}
			if (value instanceof ObjectProgressive) {
				value = await value.getWhole();
			}
			obj[key] = value as any;
		}
		return obj as X;
	}
}
Object.entries;
type Progressive<T> =
	T extends Array<any>
		? ArrayProgressive<T extends Array<infer X> ? X : never, T>
		: T extends string | boolean | null | number
			? T
			: T extends Object
				? ObjectProgressive<T>
				: T;
/*
 * this will progressively load a JSON object, you must read everything you get to get the next thing in line.
 */
export async function ProgessiveDecodeJSON<X>(
	url: string,
	req: RequestInit = {},
): Promise<Progressive<X>> {
	const prog = new ProgressiveArray(url, req);
	await prog.ready;
	return identifyType(prog) as Promise<Progressive<X>>;
}
