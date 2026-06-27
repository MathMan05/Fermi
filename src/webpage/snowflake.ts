abstract class SnowFlake {
	public readonly id: string;
	constructor(id: string) {
		this.id = id;
	}
	getUnixTime(): number {
		return SnowFlake.stringToUnixTime(this.id);
	}
	static stringToUnixTime(str: string) {
		try {
			return Number((BigInt(str) >> 22n) + 1420070400000n);
		} catch {
			throw new Error(
				`The ID is corrupted, it's ${JSON.stringify(str)} when it should be some number.`,
			);
		}
	}
	static DateToID(date: Date) {
		return ((BigInt(+date) - 1420070400000n) << 22n).toString();
	}
}
export {SnowFlake};
