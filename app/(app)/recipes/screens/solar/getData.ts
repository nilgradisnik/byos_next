import { unstable_cache } from "next/cache";

// Export config to mark this component as dynamic
export const dynamic = "force-dynamic";

interface SolarData {
	title: string;
	currentProduction: string;
	currentConsumption: string;
	currentNetGrid: string;
	lifetimeProduction: string;
	lifetimeConsumption: string;
	lifetimeNetGrid: string;
	lastUpdated: string;
}

type SolarParams = {
	apiEndpoint?: string;
	apiToken?: string;
	title?: string;
};

/**
 * Utility to format watts into W or kW format
 */
function formatPower(watts: number): string {
	const absWatts = Math.abs(watts);
	if (absWatts >= 1000000) {
		return `${(watts / 1000000).toFixed(1)} MW`;
	}
	if (absWatts >= 1000) {
		return `${(watts / 1000).toFixed(1)} kW`;
	}
	return `${watts.toFixed(0)} W`;
}

/**
 * Utility to format Wh into Wh, kWh or MWh format
 */
function formatEnergy(wh: number): string {
	const absWh = Math.abs(wh);
	if (absWh >= 1000000) {
		return `${(wh / 1000000).toFixed(2)} MWh`;
	}
	if (absWh >= 1000) {
		return `${(wh / 1000).toFixed(1)} kWh`;
	}
	return `${wh.toFixed(0)} Wh`;
}

/**
 * Fetches current and lifetime solar meters data from a local API endpoint
 */
async function fetchSolarData(params?: SolarParams): Promise<SolarData | null> {
	const url =
		params?.apiEndpoint ||
		process.env.SOLAR_API_ENDPOINT ||
		"http://envoy.local/ivp/meters/readings";
	const title = params?.title || "Solar Status";
	const token = params?.apiToken || process.env.SOLAR_AUTH_TOKEN;

	try {
		// Use a abort signal/timeout to ensure prerendering or offline endpoints don't block
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);

		const headers: HeadersInit = {
			Accept: "application/json",
		};

		if (token) {
			headers.Authorization = token.startsWith("Bearer ")
				? token
				: `Bearer ${token}`;
		}

		const response = await fetch(url, {
			headers,
			signal: controller.signal,
			next: { revalidate: 0 },
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`Local API responded with status: ${response.status}`);
		}

		const data = await response.json();

		if (!Array.isArray(data) || data.length < 2) {
			throw new Error("Invalid API data format: expected at least two meters");
		}

		// Meter 0: Production, Meter 1: Grid Net
		const prodPower = data[0].activePower || 0;
		const gridPower = data[1].activePower || 0;
		const consPower = prodPower + gridPower;

		const lifetimeProd = data[0].actEnergyDlvd || 0;
		const lifetimeImport = data[1].actEnergyDlvd || 0;
		const lifetimeExport = data[1].actEnergyRcvd || 0;
		const lifetimeCons = lifetimeProd - lifetimeExport + lifetimeImport;
		const netGridLifetime = lifetimeImport - lifetimeExport;

		return {
			title,
			currentProduction: formatPower(prodPower),
			currentConsumption: formatPower(consPower),
			currentNetGrid:
				gridPower < 0
					? `+${formatPower(Math.abs(gridPower))} Export`
					: gridPower > 0
						? `-${formatPower(gridPower)}`
						: formatPower(gridPower),
			lifetimeProduction: formatEnergy(lifetimeProd),
			lifetimeConsumption: formatEnergy(lifetimeCons),
			lifetimeNetGrid:
				netGridLifetime < 0
					? `+${formatEnergy(Math.abs(netGridLifetime))} Net Export`
					: netGridLifetime > 0
						? `-${formatEnergy(netGridLifetime)}`
						: formatEnergy(netGridLifetime),
			lastUpdated: new Date().toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				timeZone: "America/New_York",
			}),
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			errorMessage.includes("prerender") ||
			errorMessage.includes("HANGING_PROMISE_REJECTION") ||
			errorMessage.includes("prerender is complete")
		) {
			return null;
		}
		console.error("Error fetching solar data:", error);
		return null;
	}
}

/**
 * Generates high-quality mock data when the local endpoint is offline
 */
function getMockData(title: string): SolarData {
	return {
		title,
		currentProduction: "4.8 kW",
		currentConsumption: "1.2 kW",
		currentNetGrid: "+3.6 kW Export",
		lifetimeProduction: "18.42 MWh",
		lifetimeConsumption: "14.15 MWh",
		lifetimeNetGrid: "+4.27 MWh Net Export",
		lastUpdated: new Date().toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZone: "America/New_York",
		}),
	};
}

/**
 * Cache wrap to prevent overloading the local API
 */
const getCachedSolarData = unstable_cache(
	async (params?: SolarParams): Promise<SolarData> => {
		const data = await fetchSolarData(params);
		if (!data) {
			throw new Error("Failed to fetch fresh solar data - skip caching");
		}
		return data;
	},
	["solar-data"],
	{
		tags: ["solar"],
		revalidate: 5, // Cache for 5 seconds for fast updates
	},
);

/**
 * Main export to resolve solar statistics
 */
export default async function getData(
	params?: SolarParams,
): Promise<SolarData> {
	const title = params?.title || "Solar Status";
	try {
		return await getCachedSolarData(params);
	} catch {
		// Fallback to fresh un-cached attempt, and finally mock data
		const fresh = await fetchSolarData(params);
		if (fresh) return fresh;
		return getMockData(title);
	}
}
