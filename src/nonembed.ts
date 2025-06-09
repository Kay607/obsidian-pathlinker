import { ViewPlugin, DecorationSet, EditorView, ViewUpdate, Decoration, WidgetType } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import PathLinkerPlugin, { externalPrefix, externalGroupPrefix } from "./main";
import { Filesystem } from "@capacitor/filesystem";
import { Platform } from "obsidian";
import * as fs from "fs";



class HideTestWidget extends WidgetType {
	constructor(private plugin: PathLinkerPlugin, private display: string, private link: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.textContent = this.display;
		span.className = "cm-link nonembed";

		isNonExistent(this.plugin, this.link).then(notExists => {
			if (notExists) {
				span.classList.add("is-unresolved");
			}
		});


		span.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
		
			// Remove the [[ ]] brackets from the wikilink
			generateOnClick(this.plugin, this.link)();

		};

		return span;
	}
}


export function getHideTestPlugin(plugin: PathLinkerPlugin): Extension
{
	return ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		buildDecorations(view: EditorView): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			const regex = /\[\[([^\]]+?)\]\]/g;

			for (let { from, to } of view.visibleRanges) {
				const text = view.state.doc.sliceString(from, to);

				let match;
				while ((match = regex.exec(text)) !== null) {
				const full = match[0];
				const target = match[1];

				const trimmedTarget = target.trim();

				const hasExternalPrefix = trimmedTarget.startsWith(externalPrefix);
				const hasGroupPrefix = trimmedTarget.startsWith(externalGroupPrefix);

				if (!hasExternalPrefix && !hasGroupPrefix) continue;

				// Remove the prefixes if present
				const displayText = getLinkDisplay(trimmedTarget);
				const link = getLinkPath(trimmedTarget);

				// Calculate positions
				const start = from + match.index;
				const end = start + full.length;

				// Cursor near logic
				const cursorPos = view.state.selection.main.head;
				const cursorLine = view.state.doc.lineAt(cursorPos).number;
				const linkLine = view.state.doc.lineAt(start).number;

				// Only change the display if the cursor is within or directly next to the link on the same line
				const cursorNear =
					cursorLine === linkLine &&
					cursorPos >= start - 1 &&
					cursorPos <= end + 1;

				if (!cursorNear) {
					builder.add(
						start,
						end,
						Decoration.replace({ widget: new HideTestWidget(plugin, displayText, link) })
					);
				}
			}
			}

			return builder.finish();
		}
	},
	{
		decorations: (v) => v.decorations,
	}
	);
}

export function getNonEmbedReadModeHandler(plugin: PathLinkerPlugin) {
	return (el: HTMLElement) =>
	{
		el.querySelectorAll('a.internal-link').forEach(link => {
			const anchor = link as HTMLAnchorElement;

			const dataHref = anchor.getAttribute('data-href') || '';
			const fileLink = getLinkPath(dataHref);
			let fileDisplay = getLinkDisplay(dataHref);

			if (dataHref !== anchor.innerText)
				fileDisplay = anchor.innerText;

			// Check if it is an external link
			// If not, ignore
			const isExternal = fileLink.startsWith(externalPrefix);
			const isGroup = fileLink.startsWith(externalGroupPrefix);

			if (isExternal || isGroup) {

				anchor.removeAttribute('data-href');
				anchor.removeAttribute('href');

				// Update display text
				anchor.textContent = fileDisplay;

				// Remove hover styling by resetting relevant styles
				anchor.classList.remove('is-unresolved');

				isNonExistent(plugin, fileLink).then(notExists => {
					if (notExists) {
						anchor.classList.add('is-unresolved');
					}
				})

				// Override click
				anchor.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					generateOnClick(plugin, fileLink)();
				});

				anchor.classList.add('nonembed');

			}
		});
	}
}



function generateOnClick(plugin: PathLinkerPlugin, linkpath: string) {
	return () => {
		
		const filePath = getFilePathFromLinkPath(plugin, linkpath);

		// Open the file with its native app rather than obisidan
		this.app.openWithDefaultApp(filePath);
	};
}


async function isNonExistent(plugin: PathLinkerPlugin, linkPath: string): Promise<boolean> {

	const externalStripped = linkPath.replace(externalPrefix, "")
	if (!plugin.isLocalFile(externalStripped)) {
		return false;
	}

	const filePath = getFilePathFromLinkPath(plugin, linkPath);
	if (filePath === null) {
		return true;
	}
	const fullPath = plugin.useVaultAsWorkingDirectory(filePath);

	// Mobile
	if (Platform.isMobile)
	{
		const stat = await Filesystem.stat({ path: fullPath });

		return stat === null;
	}

	// Desktop
	return !fs.existsSync(fullPath);
}



function getLinkDisplay(linkText: string): string {

	// If it has an alias, use the alias
	if (linkText.includes("|")) {
		return linkText.split("|")[1];
	}


	// Otherwise, use the link text with the prefix removed and trim
	const filePath = linkText.replace(externalPrefix, "").replace(externalGroupPrefix, "").trim();

	// Get the file name
	const fileName = filePath.split("/").pop();
	return fileName || filePath;
	
}

function getLinkPath(linkText: string): string {

	// Remove the alias if present
	linkText = linkText.split("|")[0];

	return linkText;
}


function getFilePathFromLinkPath(plugin: PathLinkerPlugin, linkpath: string): string|null {
	if (linkpath.startsWith(externalPrefix))
	{
		return linkpath.replace(externalPrefix, "");
	}


	// Handle if it is a group link
	const fileData = linkpath.replace(externalGroupPrefix, "");

	// The group name will be before the first / and the remainder of the path will be after it
	const splitIndex = fileData.indexOf("/");

	// Get the group name and the file name
	const groupName = fileData.slice(0, splitIndex);
	let fileName = fileData.slice(splitIndex + 1);

	// Process the link to get the full path to the file
	const [newName, newPath, isValid] = plugin.processLink(groupName, fileName);

	// This happens if there is no group with this name or no matching device
	if (!isValid)
		return null;

	fileName = newPath;
	return fileName;
}

