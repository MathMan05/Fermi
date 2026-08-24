export function decode64(str: string): ArrayBuffer {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	const bytes = (str.length / 4) * 3;
	const buff = new ArrayBuffer(bytes);
	const uint = new Uint8Array(buff);
	for (let i = 0, j = 0; i < uint.length; i += 3, j += 4) {
		const char1 = chars.indexOf(str[j]);
		const char2 = chars.indexOf(str[j + 1]);
		const char3 = chars.indexOf(str[j + 2]);
		const char4 = chars.indexOf(str[j + 3]);

		const byte1 = (char1 << 2) | (char2 >> 4);

		uint[i] = byte1;
		if (char3 != 64) {
			uint[i + 1] = ((char2 & 15) << 4) | (char3 >> 2);
			if (char4 != 64) {
				uint[i + 2] = ((char3 & 3) << 6) | char4;
			}
		}
	}

	return buff;
}
