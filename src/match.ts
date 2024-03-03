import { readdirSync } from "fs"
import { some } from "micromatch"
import { join } from "path"

export function invertMatchPatterns(patterns: string[]) {
    return patterns.map((pattern) => {
        if (pattern.startsWith('!')) {
            return pattern.slice(1)
        }
        return `!${pattern}`
    })
}

/**
 * Gets all the files in the directory recursively while avoiding any micromatch patterns
 * that would match for ignoring
 * 
 * @param dir 
 * @param ignorePatterns 
 * @returns 
 */
export function getAllFilesInDir(dir: string, ignorePatterns: string[]): string[] {
    return recurseDirsForFiles(dir, ignorePatterns)
}

function recurseDirsForFiles(dirpath: string, ignorePatterns: string[], relativeRoot = ""): string[] {
    return readdirSync(dirpath, {
        withFileTypes: true
    }).reduce((files, f) =>{
        const relPath = join(relativeRoot, f.name)
        if (some(relPath, ignorePatterns)) {
            return files
        }

        // Ensure we aren't ignoring these folders explicitly
        if (f.isDirectory()) {
                files.push(...recurseDirsForFiles(join(dirpath, f.name), ignorePatterns, relPath))
        } else {
            files.push(relPath)
        }
        return files
    }, [] as string[])
}

