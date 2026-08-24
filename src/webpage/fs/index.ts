import {FSFile} from "./fsFile";

export class FS {
	handle?: FileSystemDirectoryHandle;
	constructor() {}
	async getFile(pathstr: string, create = false) {
		try {
			const path = pathstr.split("/").filter((_) => _);
			let dir = await this.init();
			for (const part of path.slice(0, -1)) {
				dir = await dir.getDirectoryHandle(part, {create});
			}
			return new FSFile(await dir.getFileHandle(path.at(-1) as string, {create}), pathstr);
		} catch (e) {
			console.log(e);
			return undefined;
		}
	}
	private initting?: Promise<FileSystemDirectoryHandle>;
	async init(): Promise<FileSystemDirectoryHandle> {
		if (this.initting) return this.initting;
		return (this.initting = new Promise(async (res) => {
			const d = await navigator.storage.getDirectory();
			res(d);
		}));
	}
}
