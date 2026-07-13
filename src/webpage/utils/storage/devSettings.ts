export class DeveloperSettings {
	gatewayLogging: boolean = false;
	gatewayCompression: boolean = true;
	showTraces: boolean = false;
	interceptApiTraces: boolean = false;
	cacheSourceMaps: boolean = false;
	logBannedFields: boolean = false;
	reportSystem = false;

	constructor(data: Partial<DeveloperSettings> = {}) {
		Object.assign(this, data);
	}
}

export function getDeveloperSettings(): DeveloperSettings {
	return new DeveloperSettings(JSON.parse(localStorage.getItem("developerSettings") ?? "{}"));
}

export function setDeveloperSettings(settings: DeveloperSettings): void {
	localStorage.setItem("developerSettings", JSON.stringify(settings));
}

//region Migration from untyped storage
async function migrateOldDeveloperSettings(): Promise<void> {
	const devSettings = getDeveloperSettings();

	const oldGatewayLogging = localStorage.getItem("logGateway");
	if (oldGatewayLogging !== null) {
		devSettings.gatewayLogging = oldGatewayLogging === "true";
		localStorage.removeItem("logGateway");
	}

	const oldGatewayCompression = localStorage.getItem("gateWayComp");
	if (oldGatewayCompression !== null) {
		devSettings.gatewayCompression = oldGatewayCompression === "true";
		localStorage.removeItem("gateWayComp");
	}

	const oldShowTraces = localStorage.getItem("traces");
	if (oldShowTraces !== null) {
		devSettings.showTraces = oldShowTraces === "true";
		localStorage.removeItem("traces");
	}

	const oldInterceptApiTraces = localStorage.getItem("capTrace");
	if (oldInterceptApiTraces !== null) {
		devSettings.interceptApiTraces = oldInterceptApiTraces === "true";
		localStorage.removeItem("capTrace");
	}

	const oldCacheSourceMaps = localStorage.getItem("isDev");
	if (oldCacheSourceMaps !== null) {
		devSettings.cacheSourceMaps = oldCacheSourceMaps === "true";
		localStorage.removeItem("isDev");
	}

	const oldLogBannedFields = localStorage.getItem("logbad");
	if (oldLogBannedFields !== null) {
		devSettings.logBannedFields = oldLogBannedFields === "true";
		localStorage.removeItem("logbad");
	}

	setDeveloperSettings(devSettings);
}
await migrateOldDeveloperSettings();
//endregion
