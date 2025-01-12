import { Platform, Plugin } from "obsidian";

import { PathLinkerSettings, PathLinkerPluginSettingTab, DEFAULT_SETTINGS } from "./settings";

import {machineId, machineIdSync} from 'node-machine-id';


export default class PathLinkerPlugin extends Plugin {
	settings: PathLinkerSettings;

	uuid: string;
	editorChangeHandler: (editor: any) => void;

	async onload() {
		await this.loadSettings();
		await this.saveSettings();

		this.addSettingTab(new PathLinkerPluginSettingTab(this.app, this));

		this.uuid = machineIdSync();
		console.log(`UUID: ${this.uuid}`);

		this.editorChangeHandler = (editor) => {
			//let result = this.processLinks(editor.getValue());
		};
		this.app.workspace.on('editor-change', this.editorChangeHandler);
	  
		// Register post processor for the reading view (final render)
		this.registerMarkdownPostProcessor((element) => {
			this.processLinks(element);
		});

	}

	processLink(group: string, relativePath: string) : [string, string, boolean] {
		const devices = this.settings.groups.find((g) => g.name === group);
		if (!devices) {
			return ["(Invalid group)", "#", false];
		}

		const basePath = devices.devices.find((d) => d.id === this.uuid)?.basePath;
		
		if (!basePath) {
			return ["(Invalid device)", "#", false];
		}
	
		if (basePath) {
			const resolvedPath = `${basePath}/${relativePath}`;
			return ["", resolvedPath, true];
		} else {
			return ["(Invalid group)", "#", false];
		}
	}

	processLinks(input: string | HTMLElement) {

		if (typeof input === 'string') {
			let modifiedText = input;
			
			// Capture the entire link "[name](external:///groupA/myfile.txt)"
			const regex = /\[(.*?)\]\((external:\/\/\/(\w+)\/(.+))\)/g;
			let matches = input.matchAll(regex);

			console.log(matches);
			for (const match of matches) {
				const [_, name, group, relativePath] = match;
				
				const [newName, newPath, isValid] = this.processLink(group, relativePath);

				modifiedText = modifiedText.replace(match[0], `[${isValid ? name : newName}](${newPath})`);
			}

			return "yippeee";
			//return modifiedText;
		}
		

		if (input instanceof HTMLElement) {
			console.log("here");

			const links = input.querySelectorAll('a[href^="external://"], img[src^="external://"]');
			console.log(links);
			links.forEach((link) => {
				const isImage = link.tagName === 'IMG';
				const externalLink = link.getAttribute('href') || link.getAttribute('src'); // e.g., external:///groupA/myfile.txt

				if (!externalLink) {
					return;
				}

				console.log(externalLink);
				const match = externalLink.match(/external:\/\/\/(\w+)\/(.+)/);
			
				console.log(`match: ${match}`);
				if (match) {
					const [_, group, relativePath] = match;

					const [newName, newPath, isValid] = this.processLink(group, relativePath);
					console.log(`newName: ${newName}, newPath: ${newPath}, isValid: ${isValid}`);

					if (isImage) {
						link.setAttribute('src', Platform.resourcePathPrefix + newPath);
					}
					else
					{
						link.setAttribute('href', "file:///" + newPath);
					}

					if(!isValid) {
						// Set the name to the error message
						link.textContent = newName;
					}
			  }
		});
	}

	}	

	onunload() {
		this.app.workspace.off('editor-change', this.editorChangeHandler);
	}

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
