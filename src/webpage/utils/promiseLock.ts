export class PromiseLock {
	lastLock = Promise.resolve();
	private unlockedLock = this.lastLock;
	async acquireLock() {
		const {promise, resolve: res} = Promise.withResolvers<void>();
		const last = this.lastLock;
		this.lastLock = promise;
		await last;
		return () => {
			this.unlockedLock = promise;
			res();
		};
	}
	get locked() {
		return this.lastLock !== this.unlockedLock;
	}
}
