export function trimTrailingSlashes(uri: string) {
	if (!uri) return uri;
	return uri.replace(/\/+$/, "");
}

export function isLoopback(str: string) {
	return str.includes("localhost") || str.includes("127.0.0.1");
}

export function safeGoBackLink(uri: string | null): string {
	if (uri && URL.canParse(uri, window.location.origin)) {
		const target = new URL(uri, window.location.origin);

		if (
			target.origin === window.location.origin &&
			(target.protocol === "http:" || target.protocol === "https:")
		) {
			return target.toString();
		}
	}

	return "/channels/@me";
}
