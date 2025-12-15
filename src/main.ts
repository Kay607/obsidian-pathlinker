import { FileStats, FuzzySuggestModal, Notice, Platform, Plugin, TFile } from "obsidian";
import { OpenPDFData } from 'path-linker';

import { PathLinkerSettings, PathLinkerPluginSettingTab, DEFAULT_SETTINGS } from "./settings";

import * as fs from "fs";

import { getHideTestPlugin, getNonEmbedReadModeHandler } from './nonembed';

import { Filesystem } from "@capacitor/filesystem";
import { basename, extname, isAbsolutePath, isLocalFile, joinPaths, resolvePathSegments } from "./pathUtils";

export const externalPrefix = "external:";
export const externalGroupPrefix = "group:";

// This should not be modified
// This is never used by users and is only ever used internally in the plugin
const _externalPrefix = "PathLinker:";


class FuzzyGroupFileSuggester extends FuzzySuggestModal<string>
{
	private plugin: PathLinkerPlugin;

    group: string|null = null;
    path: string = "";
    items: string[] = [];
    callback: (group: string, item: string) => void;

    async getItemsAsync(fullPath: string): Promise<string[]> {

        // Get all files in the folder and add a '/' if it's a directory

        if (Platform.isMobile)
        {
            const result = await Filesystem.readdir({ path: fullPath });
            return result.files.map((file) => file.type === "directory" ? file.name + "/" : file.name); 
        }

        // Desktop
        const files = fs.readdirSync(fullPath, { withFileTypes: true });
        return files.map((file) => file.isDirectory() ? file.name + "/" : file.name);
    }

	constructor(plugin: PathLinkerPlugin, callback: (group: string, item: string) => void, group: string|null = null, path: string = "", items: string[] = [])
	{
		super(plugin.app);
		this.plugin = plugin;
        this.callback = callback;

        this.group = group;

        this.path = path;

        this.items = items;

        if (group === null)
		    this.setPlaceholder("Select a group");
        else
            this.setPlaceholder("Select a path");
	}

	getItems(): string[] {

        if (this.group === null)
        {
            // Get all groups
            return this.plugin.settings.groups.map((group) => group.name);
        }

        // Sort directories before files
        this.items.sort((a, b) => {
            if (a == '..') return -1;
            if (b == '..') return 1;

            const aIsDir = a.endsWith("/");
            const bIsDir = b.endsWith("/");
        
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
            return a.localeCompare(b);
        }); 

        // Return the items previously read
		return this.items;
	}

	getItemText(item: string): string {
		return item;
	}
	async onChooseItem(item: string): Promise<void> {

        if (this.group !== null && !item.endsWith("/") && item !== "..")
        {
            // A group and file have been selected, return this by callback
            this.callback(this.group, joinPaths(this.path, item));
            return;
        }



        const groupName = this.group === null ? item : this.group;
        
        const group = this.plugin.settings.groups.find((group) => group.name === groupName);
        const devicePath = group?.devices.find((device) => device.id === this.plugin.uuid)?.basePath;
        if (devicePath === undefined)
        {
            // Display error with toast
            new Notice(`You cannot use the group ${groupName} as this device does not have a base path selected.`,3000);
            return;
        }

        let newPath = "";
        if (this.group !== null)
            newPath = joinPaths(this.path, item);

        // This is the absolute path used only for finding files
        // This will not be passed on, as it's better to keep a relative path for device compatibility
        const fullPath = joinPaths(devicePath, newPath);

        // If the path starts with /, remove it (this occurs on mobile)
        if (newPath.startsWith("/"))
            newPath = newPath.slice(1);

        const newItems = await this.getItemsAsync(fullPath);
        newItems.unshift('..');

        if (this.group === null)
        {
            new FuzzyGroupFileSuggester(this.plugin, this.callback, item, "", newItems).open();
            return;
        }


        // Join the current path with the item
        new FuzzyGroupFileSuggester(this.plugin, this.callback, this.group, newPath, newItems).open();
        return;


        
	}
	
}


export default class PathLinkerPlugin extends Plugin {
    settings: PathLinkerSettings;

    uuid: string;

    originalGetFirstLinkpathDest: (linkpath: string, sourcePath: string) => TFile | null;
    oldCachedRead: (file: TFile) => Promise<string>;
    originalGetResourcePath: (file: TFile) => string;

    originalGetEmbedCreater: (embedFile: TFile) => (...embedData: any[]) => any;


    waitUntilPopulated(obj: Object, property: string, callback: (value: any) => void) {
        
        const internalProperty = `_${property}`; // Hidden property name
      
        Object.defineProperty(obj, property, {
            get() {
                return this[internalProperty]; // Return the stored value
            },
            set(value) {
                this[internalProperty] = value; // Update the stored value

                if (value) {
                    callback(value); // Trigger the callback when set
                }
            },
        });
    }

    getUUID() : string
    {
        if (!Platform.isMobile) {
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

    


    // If the path is relative, use the vault as the working directory
    // Otherwise, use the path without modification
    useVaultAsWorkingDirectory(filePath: string) : string
    {
        if (isAbsolutePath(filePath) || !isLocalFile(filePath))
        {
            return filePath;
        }
        else
        {
            return joinPaths(this.app.vault.adapter.basePath, filePath);
        }
    }

    // Creates a TFile object for a file that doesn't exist
    // This is used for external links so that obisidan will try to read the file
    createFakeFile(linkpath: string): TFile | null {

        let fileName;
        // Handle if it is an external link
        if (linkpath.startsWith(externalPrefix))
        {
            fileName = linkpath.replace(externalPrefix, "");
        }
        // Handle if it is a group link
        else
        {
            const fileData = linkpath.replace(externalGroupPrefix, "");

            // The group name will be before the first / and the remainder of the path will be after it
            const splitIndex = fileData.indexOf("/");

            // Get the group name and the file name
            const groupName = fileData.slice(0, splitIndex);
            fileName = fileData.slice(splitIndex + 1);

            // Process the link to get the full path to the file
            const [newName, newPath, isValid] = this.processLink(groupName, fileName);

            // This happens if there is no group with this name or no matching device
            if (!isValid)
                return null;

            fileName = newPath;

        }

        // Only do the check on desktop as there is no synchronous file system on mobile
        if (!Platform.isMobile)
        {
            if (isLocalFile(fileName) && !fs.existsSync(this.useVaultAsWorkingDirectory(fileName)))
                return null;
        }

        const fileBaseName = basename(fileName);
        const extension = extname(fileName).slice(1);

        // None of the following is used so all values are set to 0
        const fileStats: FileStats = {
            ctime: 0, 
            mtime: 0,
            size: 0,
        };


        const file: TFile = {
            path: _externalPrefix + fileName,	// Path to the file (test.md)
            name: fileName,       				// File name with extension (test.md)
            extension: extension.toLowerCase(),     			// File extension (md)
            basename: fileBaseName,      			// Base name of the file (test)
            parent: null, 						// Root of the vault (not relevant here)
            stat: fileStats,     				// File stats (unused but required)
            vault: this.app.vault, 				// Reference to the vault object
        };


        // This prevent errors from the function being called
        // The file will not be cached
        file.cache = function() {
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


        this.addCommand({
			id: "select-group-file",
			name: "Select group file",
			callback: () => {
				new FuzzyGroupFileSuggester(this, (group, path) => {
                    // Insert a link to the selected file
                    const editor = this.app.workspace.activeEditor?.editor;
                    if (editor) {
                        editor.replaceSelection("![[group:" + group + "/" + path + "]]");
                    }
                }).open();
			},
		})


        // Handle non embedding wikilinks
        this.registerMarkdownPostProcessor(getNonEmbedReadModeHandler(this));
        this.registerEditorExtension(getHideTestPlugin(this));


        
        // Text files such as .md and .canvas use a different system to reading files than binary (pdf, mp3)
        // Binary files work automatically without editing the reading methods
        // The cachedRead method is overridden for text files as these don't work otherwise
        this.oldCachedRead = this.app.vault.cachedRead;
        this.app.vault.cachedRead = async (file: TFile): Promise<string> => {

            // If the path starts with _externalPrefix, it's an external file
            // This prefix is prepended by the plugin

            // For normal embedded files, allow the original method to handle them
            if (!file.path.startsWith(_externalPrefix))
                return this.oldCachedRead.call(this.app.vault, file);


            // Return a custom file object for external files

            const filePath = this.useVaultAsWorkingDirectory(file.path.replace(_externalPrefix, ""));

            if (Platform.isMobile)
            {
                
                // Read the file with Capacitor
                const result = await Filesystem.readFile({ path: filePath });

                if (result.data instanceof Blob) {
                    const base64Data = await result.data.text();
        
                    return base64Data;
                } else {
                    const decodedContent = atob(result.data);
                    return decodedContent;
                }
            }
            else
            {	
                return fs.readFileSync(filePath, 'utf8');
            }
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

                // Only add the prefix for local files, http/https files should not have it
                const isLocal = isLocalFile(stripped);
                const prefix = isLocal ? Platform.resourcePathPrefix : "";

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


        this.originalGetEmbedCreater = this.app.embedRegistry.getEmbedCreator;

        if(Platform.isMobile)
        this.app.embedRegistry.getEmbedCreator = (embedFile: TFile) => {
            const embedCreator = this.originalGetEmbedCreater.call(this.app.embedRegistry, embedFile);

            if(!embedCreator)
                return embedCreator;

            // Replace the normal embed creator with a wrapper
            // This gives the plugin access to the embed object after it's created
            return (...embedData: any[]): any => {

                const embed = embedCreator(...embedData);

                // PDFs are handled separately since they use pdf.js
                if (embedFile.extension != "pdf") {

                    // Text files are handled in the cachedRead method and do not need any further processing
                    if (embedFile.extension == "md" || embedFile.extension == "canvas" || embedFile.extension == "json" || embedFile.extension == "txt") {
                        return embed;
                    }

                    // Wait until the display element (img, audio, etc) is added to the embed container
                    const observer = new MutationObserver(async () => {

                        // Check if the element has been added
                        if (embed.containerEl.children[0]) {
    
                            // Check if the file is a local file
                            if (embed.containerEl.children[0].src.startsWith("file://")) {

                                // Get file data as base64 string
                                let filePath = embed.containerEl.children[0].src;

                                // Remove file:// from the start
                                filePath = filePath.replace(Platform.resourcePathPrefix, "");
                                
                                // Remove # and everything after it
                                filePath = filePath.split("#")[0];

                                filePath = decodeURIComponent(filePath);

                                // Read the file as a base64 string with Capacitor
                                const fileBase64 = (await Filesystem.readFile({ path: filePath })).data;

                                // Get the data type for the file (image, audio)
                                const dataType = this.app.viewRegistry.getTypeByExtension(embedFile.extension);

                                // Return the file bytes as a base64 url
                                embed.containerEl.children[0].src = "data:" + dataType + "/" + embedFile.extension + ";base64," + fileBase64;

                            }
                      
                            // Stop observing once the src has been replaced
                            observer.disconnect();
                        }
                    });
                    observer.observe(embed.containerEl, { childList: true });

                    return embed;
                }

                // PDFs are handled here

                // Wait until the viewer is added to the embed container
                this.waitUntilPopulated(embed.viewer, "child", (child) => {
                    // Wait until the pdfViewer is added to the viewer
                    this.waitUntilPopulated(child, "pdfViewer", (pdfViewer) => {

                        // Override the open function to handle local files
                        const originalOpen = pdfViewer.open;
                        pdfViewer.open = async (openData: OpenPDFData) => {

                            // Check if the file is a local file
                            const isLocal = isLocalFile(openData.url);
                            if (isLocal)
                            {
                                // Get the file as a base64 string with Capacitor
                                const fileBase64 = await Filesystem.readFile({ path: openData.url });

                                // Return the file bytes as a base64 url
                                openData.url = "data:application/pdf;base64," + fileBase64.data;
                            }

                            // Call the original open function with the modified url
                            originalOpen.call(pdfViewer, openData);
                        }
                    });
                });


                return embed;

            };
        }

    
    }


    onunload() {
        
        // Restore the original methods
        this.app.vault.cachedRead = this.oldCachedRead;
        this.app.vault.getResourcePath = this.originalGetResourcePath;
        this.app.metadataCache.getFirstLinkpathDest = this.originalGetFirstLinkpathDest;
        this.app.embedRegistry.getEmbedCreator = this.originalGetEmbedCreater;

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
        // Try to find the group in the settings
        const devices = this.settings.groups.find((g) => g.name === group);
        if (!devices) {
            return ["(Invalid group)", "#", false];
        }

        // Try to find a device in the group with this device's UUID
        const basePath = devices.devices.find((d) => d.id === this.uuid)?.basePath;
        if (!basePath) {
            return ["(Invalid device)", "#", false];
        }
    
        // Return the resolved path
        const resolvedPath = `${basePath}/${relativePath}`;
        return ["", resolvedPath, true];
    }
}
