import { exists } from "fs-extra"
import { defaultExtensionMap } from "./plugins"
import { MergeConfig, MergePlugin } from "./types"
import { existsSync } from "fs"
import { resolve } from "path"

export async function loadPlugin<T>(mergeConfig: MergeConfig<T>, forExt: string, configDir: string): Promise<MergePlugin<T>> {
    let handler: MergePlugin<any>
    if (mergeConfig.plugin) {
        // First check if this is a loal .js file
        const localPath = resolve(configDir, mergeConfig.plugin)
        const importPath = existsSync(localPath) ? localPath : mergeConfig.plugin
        try {
            handler = await import(importPath) as MergePlugin<any>
            if (!handler.merge) {
                handler = (handler as unknown as { default: MergePlugin<any> }).default
            }
        } catch (err) {
            console.log(err)
        }
    } else {
        if (!defaultExtensionMap[forExt]) {
            throw new Error(`No default merge function supplied for ${forExt}.  Cannot have mere config without custom plugin supplied.`)
        }
        handler = defaultExtensionMap[forExt]
    }

    // @ts-ignore
    return handler
}
