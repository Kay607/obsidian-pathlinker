<!--
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22{{ pluginID }}%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
-->

# Path Linker
Allows you to link to external files in obsidian to embed them

This plugin uses the usual syntax of `![[filepath]]` to link to files. 

eg. `![[external:filepath]] `

By default, the working directory will be the vault folder the path is relative. This allows you to use `../` to access the folder directly outside of the vault with `![[external:../filename]]`

Absolute file paths can also be used such as `![[external:C:/file.md]]`

This plugin can link to any file type which obsidian can handle including md, pdf, png, jpg, mp3, and mp4

![image](https://github.com/user-attachments/assets/3ef987ad-25c7-4c3c-9b7c-6591bac62b40)

![image](https://github.com/user-attachments/assets/8373a3da-2eb8-4ffb-9755-de177990481a)

![image](https://github.com/user-attachments/assets/6091a0c1-f598-43aa-b637-93164de3a8b0)

## Groups
A group is a single folder which contains files and subfolders

This is used if you have a single folder with the same files on multiple devices such as Windows and Android or having a Dropbox folder in multiple locations on different devices

The groups system will check which device you are using and choose the correct base path for this

This allows you to link to external files without worrying about which device you are on as the links will always work

![image](https://github.com/user-attachments/assets/55ed7be4-99bb-4636-8a99-d7523d924346)

The group name, `Test` in the example above, will be used in all links which use the group (these will not be updated if you change the group name)

Each device has a name, uuid and base path.

The name is not required and is only there to help the user

The uuid is used to check which device is active and find the correct path for it (this will be automatically filled in when a new device is added)

The base path is where all links will be relative (eg. if the base path is `D:/Test` and the group name is `Example`, `Example/file.md` will link to `D:/Test/file.md`)

The syntax for group links is `![[group:GROUP_NAME/PATH]]` eg. `![group:Group1/Directory/AnotherDirectory/file.md`

The group name must come directly after `group:` with a `/` after it

![image](https://github.com/user-attachments/assets/2780a476-a4d0-4a59-997f-34b6410be9d5)

## Installation

You can manually install by adding `Kay607/obsidian-pathlinker` to [BRAT](https://github.com/TfTHacker/obsidian42-brat)

## Contribution

Feel free to create an [issue](https://github.com/Kay607/obsidian-pathlinker/issues) or [pull request](https://github.com/Kay607/obsidian-pathlinker/pulls)

### Building

Requires npm to be installed

- `git clone https://github.com/Kay607/obsidian-pathlinker --recursive` Clone the repository into the `.obsidian/plugins` folder
- `npm i` Install modules
- `npm run dev` Builds the plugin when a change is made
