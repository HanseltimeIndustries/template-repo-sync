import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { getAllFilesInDir } from './match'
import { Config } from './types'
import { mergeFile } from './merge-file'
import { gitClone } from './clone-drivers/git-clone'
import { Change } from 'diff'

/**
 * A function that clones the template repo into the provided tmpDir
 * and then returns the relative path within that directory to the template root
 */
type TemplateCloneDriverFn = (tmpDir: string, repoUrl: string) => Promise<string>

interface TemplateSyncOptions {
    repoUrl: string

    /**
     * The directory for cloning our template repo into via the cloneDriver
     */
    tmpCloneDir: string

    /**
     * The repo directory path that we are going to merge toward
     */
    repoDir: string

    /**
     * Defaults to using git clone
     */
    cloneDriver?: TemplateCloneDriverFn
}

const TEMPLATE_SYNC_CONFIG = 'templatesync'
const TEMPLATE_SYNC_LOCAL_CONFIG = 'templatesync.local'

export async function templateSync(options: TemplateSyncOptions) {
    
    const cloneDriver = options.cloneDriver ?? gitClone
    const tempCloneDir = await cloneDriver(options.tmpCloneDir, options.repoUrl)

    // Get the clone Config 
    const cloneConfigPath = join(tempCloneDir, `${TEMPLATE_SYNC_CONFIG}.json`)
    const templateSyncConfig: Config = existsSync(cloneConfigPath) ? JSON.parse(readFileSync(cloneConfigPath).toString()) : {}

    const localConfigPath = join(options.repoDir, `${TEMPLATE_SYNC_LOCAL_CONFIG}.json`)
    const localTemplateSyncConfig = existsSync(localConfigPath) ? JSON.parse(readFileSync(localConfigPath).toString()) : {} as Config

    const filesToSync = getAllFilesInDir(tempCloneDir, templateSyncConfig.ignore)
    const localSkipFiles: string[] = []
    const localFileChanges: Map<string, Change[]> = new Map()

    await Promise.all(filesToSync.map(async (f) => {
        const result = await mergeFile(f, {
            localTemplateSyncConfig,
            templateSyncConfig,
            tempCloneDir,
            cwd: options.repoDir,
        })
        if (result.ignoredDueToLocal) {
            localSkipFiles.push(f)
        } else if (result?.localChanges && result.localChanges.length > 0) {
            localFileChanges.set(f, result.localChanges)
        }
    }))

    return {
        localSkipFiles,
        localFileChanges,
    }
}
