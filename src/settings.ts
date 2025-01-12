import PathLinkerPlugin from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

interface Device {
	name: string;
	id: string;
	basePath: string;
  }
  
  interface Group {
	name: string;
	devices: Device[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PathLinkerSettings {
	groups: Group[];
}

export const DEFAULT_SETTINGS: PathLinkerSettings = {
	groups: [],
};

export class PathLinkerPluginSettingTab extends PluginSettingTab {
	plugin: PathLinkerPlugin;

	private openedGroups: { [key: number]: boolean } = {};

	constructor(app: App, plugin: PathLinkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();
		
		containerEl.createEl('h2', { text: 'Group & Device Management' });


		// Button to add a new group
		new Setting(containerEl)
		.addButton((button) =>
			button
			.setButtonText('Add New Group')
			.onClick(() => this.addNewGroup())
		);

		// Display each group with devices
		this.plugin.settings.groups.forEach((group, groupIndex) => {
			const groupContainer = containerEl.createDiv({ cls: 'group-container' });
	  
			const rightArrowSymbol = '⏵';
			const downArrowSymbol = '⏷';
			// Create a collapsible header with an arrow
			const groupHeader = groupContainer.createDiv({ cls: 'group-header' });

			const groupTitle = groupHeader.createEl('span', { text: (this.openedGroups[groupIndex] ? downArrowSymbol : rightArrowSymbol) + group.name });
	  
			// Add a delete button for the group
			new Setting(groupHeader)
			  .addButton((button) =>
				button
				  .setButtonText('Delete Group')
				  .onClick(() => this.deleteGroup(groupIndex))
			  );
	  
			// Initially hide the devices list
			const devicesList = groupContainer.createDiv({ cls: 'devices-list'});
			devicesList.style.display = this.openedGroups[groupIndex] ? 'block' : 'none';
	  
			// Toggle the visibility of the devices list when the arrow is clicked
			groupTitle.addEventListener('click', () => {

				let isVisible = devicesList.style.display === 'block';
				isVisible = !isVisible;
				this.openedGroups[groupIndex] = isVisible;

				devicesList.style.display = isVisible ? 'block' : 'none';
				groupTitle.textContent = (isVisible ? downArrowSymbol : rightArrowSymbol) + group.name;  // Toggle arrow direction
			})

			// Add an option to change the group name from the device list section
			const groupNameSetting = new Setting(devicesList)   
			.addText((text) =>
				text
				.setPlaceholder('Group Name')
				.setValue(group.name)
				.onChange(async (value) => {
					group.name = value;
					await this.plugin.saveSettings();
					groupTitle.textContent = (this.openedGroups[groupIndex] ? downArrowSymbol : rightArrowSymbol) + group.name;
				})
			);

			// List devices under the group
			group.devices.forEach((device, deviceIndex) => {
			  const deviceEl = devicesList.createDiv({ cls: 'device' });
	  
			  
			  new Setting(deviceEl)
				.addText((text) =>
				  text
					.setPlaceholder('Device Name')
					.setValue(device.name)
					.onChange(async (value) => {
					  device.name = value;
					  await this.plugin.saveSettings();
					})
				)
				.addText((text) =>
				  text
					.setPlaceholder('Device ID')
					.setValue(device.id)
					.onChange(async (value) => {
					  device.id = value;
					  await this.plugin.saveSettings();
					})
				)
				.addText((text) =>
					text    
					.setPlaceholder('Device Base Path')
					.setValue(device.basePath)
					.onChange(async (value) => {
					device.basePath = value;
					await this.plugin.saveSettings();
					})
				)

				.addButton((button) =>
				  button
					.setButtonText('Delete Device')
					.onClick(() => this.deleteDevice(groupIndex, deviceIndex))
				)
			});
	  
			// Add device button inside the collapsible section
			new Setting(devicesList)
			  .addButton((button) =>
				button
				  .setButtonText('Add Device')
				  .onClick(() => this.addDeviceToGroup(groupIndex))
			  );
		});
	}

	// Add a new group
	async addNewGroup() {
		const newGroup: Group = {
			name: "New Group",
			devices: [],
		};

		this.plugin.settings.groups.push(newGroup);
		this.openedGroups[this.plugin.settings.groups.length - 1] = true;

		await this.plugin.saveSettings();
		this.display();  // Refresh the settings UI
	}

	// Delete a group
	async deleteGroup(groupIndex: number) {
		this.plugin.settings.groups.splice(groupIndex, 1);
		await this.plugin.saveSettings();
		this.display();  // Refresh the settings UI
	}

	// Add a new device to a group
	async addDeviceToGroup(groupIndex: number) {
		const group = this.plugin.settings.groups[groupIndex];
		const deviceName = "";
		const deviceBasePath = "";
		
		const newDevice: Device = {
			name: deviceName,
			id: this.plugin.uuid,
			basePath: deviceBasePath,
		};
		group.devices.push(newDevice);
		await this.plugin.saveSettings();
		this.display();  // Refresh the settings UI
	}

	// Delete a device from a group
	async deleteDevice(groupIndex: number, deviceIndex: number) {
		this.plugin.settings.groups[groupIndex].devices.splice(deviceIndex, 1);
		await this.plugin.saveSettings();
		this.display();  // Refresh the settings UI
	}
}