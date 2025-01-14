import * as Obsidian from 'obsidian';

declare module 'obsidian' {
	interface App {
		isMobile: boolean
		embedRegistry: EmbedRegistry
	}

	interface DataAdapter {
		basePath: string
	}

	interface TFile {
		cache?: (() => {})
	}

	interface EmbedRegistry {
		getEmbedCreator: (embedData: any) => any
	}
}


