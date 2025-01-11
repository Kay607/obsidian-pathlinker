import { Plugin } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PathLinkerSettings {}

const DEFAULT_SETTINGS: PathLinkerSettings = {};

export default class PathLinkerPlugin extends Plugin {
	settings: PathLinkerSettings;

	async onload() {
		await this.loadSettings();

		console.log("PathLinker loaded");
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
