import { Platform } from "obsidian";
import * as path from "path";

export function isLocalFile(filePath: string) : boolean
{
    return !(filePath.startsWith("http://") || filePath.startsWith("https://"));
}

export function joinPaths(paths: string[]) {
    if (Platform.isMobile) {
        return paths.join('/').replace(/\/+/g, '/'); // Remove any extra slashes
    } else {
        return path.join(...paths).replace(/\\/g, '/');
    }
}

export function isAbsolutePath(filePath: string) {
    if (Platform.isMobile) {
        return filePath.startsWith('/');
    } else {
        return path.isAbsolute(filePath);
    }
}

export function basename(filePath: string) : string {
    if (Platform.isMobile) {
        const segments = filePath.split('/');
        return segments[segments.length - 1];
    } else {
        return path.basename(filePath, path.extname(filePath));
    }
}

export function extname(filePath: string) : string
{
    if (Platform.isMobile)
    {
        const lastDotIndex = filePath.lastIndexOf('.');
        return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
    }
    else
    {
        return path.extname(filePath);
    }
}
