import {
	RouteBases,
	Routes,
	type APIApplication,
	type RESTGetAPIOAuth2CurrentApplicationResult,
} from "discord-api-types/v10";
import { readFile, writeFile } from "node:fs/promises";
import { stdin } from "node:process";
import { ask } from "./utils/ask.ts";
import { createEnum } from "./utils/enum.ts";
import { getUserChoice } from "./utils/getUserChoice.ts";

const PresentationType = createEnum({ text: 1, number: 2, image: 3 });
let response: Response | undefined,
	botToken!: string,
	headers = {},
	application!: APIApplication,
	widgetConfig!: WidgetConfig;

const initialize = async () => {
	botToken = await ask("Bot token: ");
	headers = { authorization: `Bot ${botToken}` };
	response = await fetch(RouteBases.api + Routes.oauth2CurrentApplication(), {
		headers,
	});
	if (!response.ok) return;
	application =
		(await response.json()) as RESTGetAPIOAuth2CurrentApplicationResult;
	response = await fetch(
		`${RouteBases.api}/applications/${application.id}/widget-configs`,
		{ headers },
	);
	if (!response.ok) return;
	[widgetConfig] = (await response.json()) as WidgetConfig[];
	if (!widgetConfig) {
		console.log(
			"No widget configured! First create a widget in the developer portal",
		);
		response = undefined;
	}
};

const updateWidgetConfig = async () => {
	const file = await ask("Widget config file: ");
	const data = JSON.parse(await readFile(file, "utf-8"));

	if (!("surfaces" in data)) {
		console.log("Widget configuration is not valid!");
		return;
	}
	response = await fetch(
		`${RouteBases.api}/applications/${application.id}/widget-configs/${widgetConfig.config_id}`,
		{ headers, method: "PATCH", body: JSON.stringify(data) },
	);
};

const exportWidgetConfig = async () => {
	await writeFile(
		await ask("Widget config export path: "),
		JSON.stringify(widgetConfig, null, "\t"),
	);
};

const createIdentity = async () => {
	const userData = Array.from(
		new Set(
			Object.values(widgetConfig.surfaces)
				.flatMap(
					(s) => Object.values(s.components) as WidgetComponent<string>[],
				)
				.flatMap((c) => Object.values(c.fields))
				.filter((f) => f.value_type === "data")
				.map((f) => `${f.value}\n${PresentationType[f.presentation_type]}`),
		),
		(v) =>
			(([name, type]) => ({
				name,
				type: +type,
			}))(v.split("\n")),
	);
	const dynamic: {
		name: string;
		type: number;
		value: string | number | { url: string };
	}[] = [];
	if (userData.length) {
		console.log(
			"Insert the data for the following dynamic fields.\nLeaving them empty will use the fallback value if available.",
		);
		for (const field of userData) {
			const value = await ask(
				`${field.name} (${PresentationType[field.type]}): `,
			);

			if (value)
				dynamic.push({
					name: field.name,
					type: field.type,
					value:
						field.type === PresentationType.text
							? value
							: field.type === PresentationType.number
								? +value
								: { url: value },
				});
		}
	}
	response = await fetch(
		`${RouteBases.api}/applications/${application.id}/users/${
			application.owner?.id ?? application.team?.owner_user_id
		}/identities/0/profile`,
		{
			method: "PATCH",
			body: JSON.stringify({ data: { dynamic } }),
			headers: {
				...headers,
				"content-type": "application/json",
			},
		},
	);
	if (!response.ok) return;
	if (
		widgetConfig.status !== "published" &&
		(await ask("Publish the widget? (y/N) ")).toLowerCase() === "y"
	) {
		response = await fetch(
			`${RouteBases.api}/applications/${application.id}/widget-configs/${widgetConfig.config_id}/publish`,
			{ method: "POST", headers },
		);
		if (!response.ok) return;
	}
	console.log("Ok!");
};

await initialize();
if (response?.ok === false)
	console.log(response.url, response.status, await response.json());
const action = await getUserChoice("What do you want to do?", [
	{ label: "Update my widget configuration", value: 1 },
	{ label: "Update my identity profile", value: 2 },
	{ label: "Export my widget configuration", value: 3 },
]);
if (action == 1) await updateWidgetConfig();
else if (action == 2) await createIdentity();
else if (action == 3) await exportWidgetConfig();
stdin.unref();
