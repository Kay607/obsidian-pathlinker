import { DataAdapter, FileStats, Platform, Plugin, TFile, TFolder } from "obsidian";

import { PathLinkerSettings, PathLinkerPluginSettingTab, DEFAULT_SETTINGS } from "./settings";

import { platform }  from 'os';


import * as path from "path";
import * as fs from "fs";

// This 
const externalPrefix = "external:";
const externalGroupPrefix = "group:";

// This should not be modified
// This is never used by users and is only ever used internally in the plugin
const _externalPrefix = "PathLinker:";

export default class PathLinkerPlugin extends Plugin {
	settings: PathLinkerSettings;

	uuid: string;

	originalGetFirstLinkpathDest: (linkpath: string, sourcePath: string) => TFile | null;
	oldCachedRead: (file: TFile) => Promise<string>;
	originalGetResourcePath: (file: TFile) => string;


	getUUID() : string
	{
		if (!(this.app as any).isMobile) {
			// Desktop: Use machine ID
			try {
				const { machineIdSync } = require('node-machine-id');
				return machineIdSync(); // Return machine ID if available
			} catch (error) {
				console.error('Failed to load node-machine-id', error);
				return "ERROR";
			}
		}

		// Mobile: Try to get UUID from local storage, or generate a new one if it doesn't exist
		let deviceId = localStorage.getItem('device-id');
		if (!deviceId) {
			// Generate a new UUID
			deviceId = [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
			localStorage.setItem('device-id', deviceId);
		}
		return deviceId;
	}

	isLocalFile(filePath: string) : boolean
	{
		return !(filePath.startsWith("http://") || filePath.startsWith("https://"));
	}

	joinPaths(paths: string[]) {
		if ((this.app as any).isMobile) {
			return paths.join('/').replace(/\/+/g, '/'); // Remove any extra slashes
		} else {
			return path.join(...paths);
		}
	}

	isAbsolutePath(filePath: string) {
		if ((this.app as any).isMobile) {
			return filePath.startsWith('/');
		} else {
			return path.isAbsolute(filePath);
		}
	}

	// If the path is relative, use the vault as the working directory
	// Otherwise, use the path without modification
	useVaultAsWorkingDirectory(filePath: string) : string
	{ 
		if (this.isAbsolutePath(filePath) || !this.isLocalFile(filePath))
		{
			return filePath;
		}
		else
		{
			return this.joinPaths([(this.app.vault.adapter as any).basePath, filePath]);
		}
	}

	basename(filePath: string) : string {
		if ((this.app as any).isMobile) {
			const segments = filePath.split('/');
			return segments[segments.length - 1];
		} else {
			return path.basename(filePath, path.extname(filePath));
		}
	}

	extname(filePath: string) : string
	{
		if ((this.app as any).isMobile)
		{
			const lastDotIndex = filePath.lastIndexOf('.');
        	return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
		}
		else
		{
			return path.extname(filePath);
		}
	}

	// Creates a TFile object for a file that doesn't exist
	// This is used for external links so that obisidan will try to read the file
	createFakeFile(linkpath: string): TFile | null {

		let fileName;
		if (linkpath.startsWith(externalPrefix))
		{
			fileName = linkpath.replace(externalPrefix, "");
		}
		else
		{
			const fileData = linkpath.replace(externalGroupPrefix, "");

			// The group name will be before the first / and the remainder of the path will be after it
			const splitIndex = fileData.indexOf("/");

			const groupName = fileData.slice(0, splitIndex);
			fileName = fileData.slice(splitIndex + 1);

			const [newName, newPath, isValid] = this.processLink(groupName, fileName);

			if (!isValid)
				return null;

			fileName = newPath;

		}


		if (this.isLocalFile(fileName) && !fs.existsSync(this.useVaultAsWorkingDirectory(fileName)))
			return null;

		//const fileName = linkpath.replace("external://", "");
		const basename = this.basename(fileName);
		const extension = this.extname(fileName).slice(1);


		// None of the following is used so all values are set to 0
        const fileStats: FileStats = {
            ctime: 0, 
            mtime: 0,
            size: 0,
        };


        const file: TFile = {
            path: _externalPrefix + fileName,	// Path to the file (test.md)
            name: fileName,       				// File name with extension (test.md)
            extension: extension,     			// File extension (md)
            basename: basename,      			// Base name of the file (test)
            parent: null, 						// Root of the vault (not relevant here)
            stat: fileStats,     				// File stats (unused but required)
            vault: this.app.vault, 				// Reference to the vault object
        };


		// This prevent errors from the function being called
		// The file will not be cached
		(file as any).cache = function() {
			return {};
		};

        return file;
    }


	async onload() {
		await this.loadSettings();
		await this.saveSettings();

		this.addSettingTab(new PathLinkerPluginSettingTab(this.app, this));

		// Get a UUID for the device
		// This is used to identify the device to get the path from the group
		this.uuid = this.getUUID();
		
		// Text files such as .md and .canvas use a different system to reading files than binary (pdf, mp3)
		// Binary files work automatically without editing the reading methods
		// The cachedRead method is overridden for text files as these don't work otherwise
		this.oldCachedRead = this.app.vault.cachedRead;
		this.app.vault.cachedRead = async (file: TFile): Promise<string> => {

			// If the path starts with _externalPrefix, it's an external file
			// This prefix is prepended by the plugin
			if (file.path.startsWith(_externalPrefix)) {
				// Return a custom file object for external files
				return fs.readFileSync(this.useVaultAsWorkingDirectory(file.path.replace(_externalPrefix, "")), "utf-8");
			}
			return this.oldCachedRead.call(this.app.vault, file);
		};
		


		this.originalGetResourcePath = this.app.vault.getResourcePath; // Save the original function
		// Override the getResourcePath method
		this.app.vault.getResourcePath = (file: TFile): string => {
			// If the path contains _externalPrefix, it's an external file
			// Remove this prefix and anything before it (the vault root path)
			if (file.path.startsWith(_externalPrefix)) {

				let stripped = file.path.replace(_externalPrefix, "");

				const isTextFile = file.extension === "md" || file.extension === "canvas" || file.extension === "json" || file.extension === "txt";
				if (!isTextFile)
				{
					// Remove "./" from the start of the path
					stripped = this.useVaultAsWorkingDirectory(stripped.replace("./", ""));
				}

				const prefix = this.isLocalFile(stripped) ? Platform.resourcePathPrefix : "";

				return prefix + stripped;
			}

			// For other files, allow the original method to handle them
			return this.originalGetResourcePath.call(this.app.vault, file);
		};


		// Intercept getFirstLinkpathDest to handle external links
        this.originalGetFirstLinkpathDest = this.app.metadataCache.getFirstLinkpathDest;
        this.app.metadataCache.getFirstLinkpathDest = (linkpath: string, sourcePath: string): TFile | null => {
            if (linkpath.startsWith(externalPrefix) || linkpath.startsWith(externalGroupPrefix)) {
                // Return a custom file object for external links
				// This creates a TFile object to a file that doesn't exist so that obisidan will try to read it
				// This read will later be intercepted so that the correct file is read
                return this.createFakeFile(linkpath);
            }

            // Call the original method for internal links
            return this.originalGetFirstLinkpathDest.call(this.app.metadataCache, linkpath, sourcePath);
        };

    }


	onunload() {
		
		this.app.vault.cachedRead = this.oldCachedRead;
		this.app.vault.getResourcePath = this.originalGetResourcePath;
		this.app.metadataCache.getFirstLinkpathDest = this.originalGetFirstLinkpathDest;

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
}
