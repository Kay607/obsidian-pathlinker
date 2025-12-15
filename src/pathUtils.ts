import { Platform } from "obsidian";
import * as path from "path";

export function isLocalFile(filePath: string) : boolean
{
    return !(filePath.startsWith("http://") || filePath.startsWith("https://"));
}



// Remove redundant .. and . in paths
/*
Examples:
/usr/bin -> /usr/bin
/usr/../usr/bin -> /usr/bin
../a/b/../c -> ../a/c
../test -> ../test
./../ -> ../
.././ -> ../

./test -> ./test (test on iOS)
*/
export function resolvePathSegments(filePath: string): string {
    const parts = filePath.split('/');
    const result: string[] = [];

    for (let i = 0; i < parts.length; i++)
    {
        const part = parts[i];
        if (i == 0)
        {
            result.push(part);
            continue;
        }

        if (part === '..' && result.length > 0 && result[result.length - 1] !== '..')
        {
            result.pop();

            if (result.length === 0)
            {
                result.push(part);
            }
        }
        else if (part !== '.' && part !== '')
        {
            result.push(part);
        }
    }

    if (Platform.isIosApp && result.length > 0 && result[0] == '.')
    {
        result.shift();
    }

    return (filePath.startsWith('/') ? '/' : '') + result.join('/');
}

export function joinPaths(...paths: string[]) {
    let newPath;
    if (Platform.isMobile) {
        newPath = paths
            .join('/')
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');
    } else {
        newPath = path.join(...paths).replace(/\\/g, '/');
    }

    newPath = resolvePathSegments(newPath);

    return newPath;
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
