import * as Obsidian from 'obsidian';

declare module 'obsidian' {
	interface App {
		isMobile: boolean
		embedRegistry: EmbedRegistry
		viewRegistry: ViewRegistry
	}

	interface DataAdapter {
		basePath: string
	}

	interface TFile {
		cache?: (() => {})
	}

	interface ViewRegistry {
		getTypeByExtension: (ext: string) => string;
	}

	interface EmbedRegistry {
		getEmbedCreator: (embedData: any) => any
	}
}


