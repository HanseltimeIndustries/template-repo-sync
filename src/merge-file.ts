import { isMatch, some } from "micromatch"
import { Config, MergeContext, MergePlugin } from "./types"
import { extname, join } from "path"
import { existsSync } from "fs"
import { readFile, writeFile } from "fs/promises"
import { loadPlugin } from "./load-plugin"
import { Change, diffLines } from "diff"
import { outputFile } from "fs-extra"

interface MergeFileOptions {
    localTemplateSyncConfig: Config
    templateSyncConfig: Config
    tempCloneDir: string
    cwd: string
}

interface MergeFileReturn {
    /**
     * If the file was ignored due to the local config
     */
    ignoredDueToLocal: boolean
    /**
     * Only available if the file wasn't ignored, this is a list of lineDiffs
     * from the the diff library that were applied to what would've been removed
     */
    localChanges?: Change[]
}

/**
 * Applies the merge to a file according to the context information.
 * 
 * Returns true if merged and false if skipped
 * @param relPath 
 * @param context 
 * @returns 
 */
export async function mergeFile(relPath: string, context: MergeFileOptions): Promise<MergeFileReturn> {
    const { localTemplateSyncConfig, templateSyncConfig, tempCloneDir, cwd } = context
    
    if (some(relPath, localTemplateSyncConfig.ignore)) {
        return {
            ignoredDueToLocal: true
        }
    }

    const ext = extname(relPath)
    const filePath = join(cwd, relPath)
    const templatePath = join(tempCloneDir, relPath)

    const mergeConfig = templateSyncConfig.merge?.[ext]
    const localMergeConfig = localTemplateSyncConfig.merge?.[ext]

    // Either write the merge or write
    let fileContents: string
    let localChanges = []
    if (existsSync(filePath) && (mergeConfig || localMergeConfig)) {
        const originalCurrentFile = (await readFile(filePath)).toString()
        if (mergeConfig) {
            // Apply the template's most recent merges
            const handler = await loadPlugin(mergeConfig, ext, tempCloneDir)

            const mergeOptions = mergeConfig.rules.find((rule) => {
                return isMatch(relPath, rule.glob)
            })
    
            if (mergeOptions) {
                fileContents = await safeMerge(handler, mergeConfig.plugin ?? `default for ${ext}`, originalCurrentFile, (await readFile(templatePath)).toString(), {
                    relFilePath: relPath,
                    mergeArguments: mergeOptions.options,
                    isLocalOptions: true,
                })
            } else {
                // Apply overwrite if we didn't set up merge
                fileContents = (await readFile(templatePath)).toString()
            }
        } else {
            // Apply overwrite if we didn't set up merge
            fileContents = (await readFile(templatePath)).toString()
        }

        // We apply the localMerge Config to the fileContent output by the template merge
        if (localMergeConfig) {
            const handler = await loadPlugin(localMergeConfig, ext, cwd)

            const mergeOptions = localMergeConfig.rules.find((rule) => {
                return isMatch(relPath, rule.glob)
            })
    
            if (mergeOptions) {
                const localContents = await safeMerge(handler, localMergeConfig.plugin ?? `default for ${ext}`, originalCurrentFile, fileContents, {
                    relFilePath: relPath,
                    mergeArguments: mergeOptions.options,
                    isLocalOptions: true,
                })
                localChanges.push(...diffLines(fileContents, localContents))
                fileContents = localContents
            }
        }
    } else {
        // Just perform simple overwrite
        fileContents = (await readFile(templatePath)).toString()
    }
    await outputFile(filePath, fileContents)
    return {
        ignoredDueToLocal: false,
        localChanges,
    }
}

/**
 * Simple helper function to ensure that we don't let bad plugins corrupt the call flow
 * @param plugin 
 */
async function safeMerge(plugin: MergePlugin<any>, pluginPath: string, current: string, fromTemplate: string, context: MergeContext) {
    const ret = await plugin.merge(current, fromTemplate, context)
    if (typeof ret !== "string") {
        throw new Error(`Plugin ${pluginPath} did not return string for merge function!  This is not allowed!`)
    }

    if (!ret) {
        throw new Error(`Plugin ${pluginPath} should not make a merge be an empty string!`)
    }
    return ret as string
}

