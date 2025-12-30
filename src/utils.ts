import {instace} from "./index.js";

interface ApiUrls {
	api: string;
	gateway: string;
	cdn: string;
	wellknown: string;
}

export async function getApiUrls(
	url: string,
	instances: instace[],
	check = true,
): Promise<ApiUrls | null> {
	if (!url.endsWith("/")) {
		url += "/";
	}

	if (check) {
		let valid = false;
		for (const instance of instances) {
			const urlstr = instance.url || instance.urls?.api;
			if (!urlstr) {
				continue;
			}
			try {
				if (new URL(urlstr).host === new URL(url).host) {
					valid = true;
					break;
				}
			} catch (e) {
				//console.log(e);
			}
		}
		if (!valid) {
			throw new Error("Invalid instance");
		}
	}

	const hostName = new URL(url).hostname;
	try {
		return await getApiUrlsV2(url);
	} catch (e) {
		console.warn(
			`[WARN] Failed to get V2 API URLs for ${hostName}, trying V1...`,
			(e as Error).message,
		);
		try {
			return await getApiUrlsV1(url);
		} catch (e) {
			console.error(`[ERROR] Failed to get V1 API URLs for ${hostName}:`, (e as Error).message);
			throw e;
		}
	}
}

//region Well-Known V1 Interfaces

interface WellKnownV1 {
	api: string;
}

export async function getApiUrlsV1(url: string): Promise<ApiUrls | null> {
	const info: WellKnownV1 = await fetch(`${url}.well-known/spacebar`).then((res) => res.json());
	const api = info.api;
	const apiUrl = new URL(api);
	const policies: any = await fetch(
		`${api}${apiUrl.pathname.includes("api") ? "" : "api"}/policies/instance/domains`,
	).then((res) => res.json());
	return {
		api: policies.apiEndpoint,
		gateway: policies.gateway,
		cdn: policies.cdn,
		wellknown: url,
	};
}
//endregion

//region Well-Known V2 Interfaces
interface WellKnownV2BasicEndpoint {
	baseUrl: string;
}

interface WellKnownV2ApiVersions {
	default: string;
	active: string[];
}

interface WellKnownV2GatewayOptions {
	encoding: ("json" | "etf")[];
	compression: ("zlib-stream" | "zstd-stream" | null)[];
}

interface WellKnownV2 {
	admin?: WellKnownV2BasicEndpoint;
	api: WellKnownV2BasicEndpoint & {apiVersions: WellKnownV2ApiVersions};
	cdn: WellKnownV2BasicEndpoint;
	gateway: WellKnownV2BasicEndpoint & WellKnownV2GatewayOptions;
}

export async function getApiUrlsV2(url: string): Promise<ApiUrls | null> {
	const info: WellKnownV2 = await fetch(`${url}.well-known/spacebar/client`).then((res) =>
		res.json(),
	);
	return {
		api: info.api.baseUrl + "/api/v" + info.api.apiVersions.default,
		gateway: info.gateway.baseUrl,
		cdn: info.cdn.baseUrl,
		wellknown: url,
	};
}
//endregion