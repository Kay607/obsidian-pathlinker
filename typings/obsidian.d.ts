import * as Obsidian from 'obsidian';

declare module 'obsidian' {
	interface App {
		embedRegistry: EmbedRegistry
		viewRegistry: ViewRegistry
	}


	interface DataAdapter {
		basePath: string,
		fs?: any
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


