import { z } from "zod";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import { isHalfScreenLayout } from "@/lib/recipes/layout";
import type { RecipeDefinition } from "@/lib/recipes/types";
import { PreSatori } from "@/utils/pre-satori";
import getSolarData from "./getData";

export const paramsSchema = z.object({
	apiEndpoint: z
		.string()
		.default("http://envoy.local/ivp/meters/readings")
		.describe("The API endpoint returning Enphase meters JSON data")
		.meta({
			title: "API Endpoint URL",
			placeholder: "http://envoy.local/ivp/meters/readings",
		}),
	apiToken: z
		.string()
		.default("auth_token")
		.describe("Bearer authorization token for the Enphase local API")
		.meta({
			title: "Authorization Token",
			placeholder: "Bearer XYZ",
		}),
	title: z
		.string()
		.default("Solar Status")
		.describe("Title displayed at the top of the dashboard")
		.meta({ title: "Dashboard Title", placeholder: "Solar Status" }),
});

export const dataSchema = z.object({
	title: z.string().default("Solar Status"),
	currentProduction: z.string().default("0 W"),
	currentConsumption: z.string().default("0 W"),
	currentNetGrid: z.string().default("0 W Import"),
	lifetimeProduction: z.string().default("0 Wh"),
	lifetimeConsumption: z.string().default("0 Wh"),
	lifetimeNetGrid: z.string().default("0 Wh Net Import"),
	lastUpdated: z.string().default("Loading..."),
});

interface SolarProps {
	title?: string;
	currentProduction?: string;
	currentConsumption?: string;
	currentNetGrid?: string;
	lifetimeProduction?: string;
	lifetimeConsumption?: string;
	lifetimeNetGrid?: string;
	lastUpdated?: string;
	width?: number;
	height?: number;
}

export default function Solar({
	title = "Solar Status",
	currentProduction = "0 W",
	currentConsumption = "0 W",
	currentNetGrid = "0 W Import",
	lifetimeProduction = "0 Wh",
	lifetimeConsumption = "0 Wh",
	lifetimeNetGrid = "0 Wh Net Import",
	lastUpdated = "Loading...",
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
}: SolarProps) {
	const isHalfScreen = isHalfScreenLayout(width, height);

	// Determine styling for Grid Flow depending on Import vs Export status
	const isExporting = currentNetGrid.toLowerCase().includes("export");
	const isNetExporting = lifetimeNetGrid.toLowerCase().includes("net export");

	const stats = [
		{ label: "Current Solar", value: currentProduction, highlight: true },
		{ label: "Current Usage", value: currentConsumption, highlight: false },
		{
			label: "Net Grid Flow",
			value: currentNetGrid,
			highlight: true,
			customStyle: isExporting ? "bg-black text-white" : "bg-white text-black",
		},
		{ label: "Total Solar Gen", value: lifetimeProduction, highlight: false },
		{ label: "Total Home Use", value: lifetimeConsumption, highlight: false },
		{
			label: "Net Grid Total",
			value: lifetimeNetGrid,
			highlight: false,
			customStyle: isNetExporting ? "border-dashed" : "",
		},
	];

	return (
		<PreSatori width={width} height={height}>
			<div className="flex flex-col w-full h-full bg-white text-black p-6 font-sans justify-between">
				{/* Top Header */}
				<div className="flex flex-row items-center justify-between border-b-4 border-black pb-3 mb-4">
					<div className="flex flex-row items-center gap-3">
						<div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
							<div className="w-4 h-4 rounded-full bg-white" />
						</div>
						<h1 className="text-3xl font-blockkie tracking-wide uppercase leading-none">
							{title}
						</h1>
					</div>
					<div className="text-right flex flex-col justify-center">
						<div className="text-xs uppercase font-geneva9 text-gray-500 tracking-wider">
							System Dashboard
						</div>
						<div className="text-sm font-inter text-gray-700 leading-none mt-1">
							{lastUpdated}
						</div>
					</div>
				</div>

				{/* 6 Grid items */}
				<div
					className={`grid gap-4 flex-1 ${isHalfScreen ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}
				>
					{stats.map((stat, idx) => (
						<div
							key={idx}
							className={`border-2 border-black rounded-xl ${
								isHalfScreen ? "p-2" : "p-4"
							} flex flex-col justify-between ${
								stat.customStyle || "bg-white text-black"
							} ${stat.highlight && !stat.customStyle ? "bg-gray-100" : ""}`}
						>
							<div className="text-sm font-geneva9 uppercase tracking-wider opacity-80 leading-none">
								{stat.label}
							</div>
							<div
								className={`font-blockkie mt-2 leading-none truncate ${
									isHalfScreen ? "text-xl" : "text-2xl sm:text-3xl"
								}`}
							>
								{stat.value}
							</div>
						</div>
					))}
				</div>

				{/* Footer Bar */}
				<div className="w-full flex flex-row justify-between items-center text-xs text-white px-3 py-2 mt-4 rounded-lg bg-black font-geneva9">
					<div>LOCAL ENPHASE GATEWAY INTEGRATION</div>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-white" />
						ACTIVE
					</div>
				</div>
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "solar",
		title: "Solar System Status",
		description:
			"Displays production, consumption, and net grid export details from a local Enphase gateway.",
		published: true,
		tags: ["tailwind", "solar", "api", "live-data", "configurable"],
		author: { name: "Antigravity", github: "" },
		category: "display-components",
		version: "0.1.0",
		createdAt: "2026-06-22T00:00:00Z",
		updatedAt: "2026-06-22T00:00:00Z",
	},
	paramsSchema,
	dataSchema,
	getData: async (params) => {
		const data = await getSolarData({
			apiEndpoint: params.apiEndpoint,
			apiToken: params.apiToken,
			title: params.title,
		});
		return data as z.infer<typeof dataSchema>;
	},
	Component: ({ width, height, data }) => (
		<Solar {...data} width={width} height={height} />
	),
};
