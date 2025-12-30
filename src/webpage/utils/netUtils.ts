export function trimTrailingSlashes(uri: string) {
	if (!uri) return uri;
	return uri.replace(/\/+$/, "");
}

export function isLoopback(str: string) {
	return str.includes("localhost") || str.includes("127.0.0.1");
}
