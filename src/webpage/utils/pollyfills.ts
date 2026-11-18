//So... there are polyfills for letting some older browsers to run Fermi, but it's not going to be anywhere near perfect with the CSS
Set.prototype.intersection ??= function <T>(set: Set<T>) {
	const newSet = new Set();
	for (const elm of this) {
		if (set.has(elm)) {
			newSet.add(elm);
		}
	}
	return newSet;
};
Set.prototype.difference ??= function <T>(set: Set<T>) {
	const newSet = new Set();
	for (const elm of this) {
		if (!set.has(elm)) {
			newSet.add(elm);
		}
	}
	return newSet;
};
Set.prototype.symmetricDifference ??= function <T>(set: Set<T>) {
	const newSet = new Set();
	for (const elm of this) {
		if (!set.has(elm)) {
			newSet.add(elm);
		}
	}
	for (const elm of set) {
		if (!this.has(elm)) {
			newSet.add(elm);
		}
	}
	return newSet;
};
Set.prototype.isDisjointFrom ??= function <T>(set: Set<T>) {
	return this.intersection(set).size === 0;
};
Set.prototype.union ??= function <T>(set: Set<T>) {
	return new Set([...this, ...set]);
};

function defineItter(itter: typeof Iterator) {
	itter.prototype.map ??= function* map<U>(
		callbackfn: (value: unknown, index: number) => U,
	): IteratorObject<U, undefined, unknown> {
		let i = 0;
		for (const thing of this) {
			yield callbackfn(thing, i);
			i++;
		}
	};
	itter.prototype.find ??= function find<U>(
		callbackfn: (element: U, index: number) => boolean,
	): U | undefined {
		let i = 0;
		for (const thing of this) {
			if (callbackfn(thing, i)) {
				return thing;
			}
			i++;
		}
		return undefined;
	};
}
if ("Iterator" in globalThis) {
	defineItter(globalThis.Iterator);
} else {
	defineItter("".matchAll(/6/g).constructor as typeof Iterator);
}

ReadableStream.prototype[Symbol.asyncIterator] ??= async function* () {
	const reader = this.getReader();
	while (true) {
		const {value, done} = await reader.read();
		yield value;
		if (done) return undefined;
	}
};
