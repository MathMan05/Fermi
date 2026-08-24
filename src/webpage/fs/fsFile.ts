export class FSFile {
	handle: FileSystemFileHandle;
	path: string;
	constructor(handle: FileSystemFileHandle, path: string) {
		this.handle = handle;
		this.path = path;
	}
	async write(content: ArrayBuffer) {
		const w = await this.handle.createWritable();
		await w.write(content);
		await w.close();
	}
	static URLs = new Map<string, string>();
	async getURL() {
		const old = FSFile.URLs.get(this.path);
		if (old) URL.revokeObjectURL(old);
		const f = await this.handle.getFile();
		const url = URL.createObjectURL(f);
		FSFile.URLs.set(this.path, url);
		return url;
	}
	read() {}
}
