import { execSync } from 'child_process'
import * as github from '@actions/github'
import * as core from '@actions/core'
import { extname, join, resolve } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, readFile, writeFile } from 'fs/promises'
import { existsSync, readFileSync, readdir, writeFileSync } from 'fs'
import { isMatch, some } from 'micromatch'
import { getAllFilesInDir, invertMatchPatterns } from './match'
import { Config, MergePlugin } from './types'
import { defaultExtensionMap } from './plugins'
import { mergeFile } from './merge-file'

interface TemplateSyncOptions {
    repoUrl: string

    githubToken: string
}

function getTempDir() {
    return process.env['RUNNER_TEMP'] || tmpdir()
}


const CLONE_DIR = 'cloned_repo'
const TEMPLATE_SYNC_CONFIG = 'templatesync.config'
const TEMPLATE_SYNC_LOCAL_CONFIG = 'templatesync.local.config'

export async function templateSync(options: TemplateSyncOptions) {

    // const token = core.getInput('github_token')
    const octokit = github.getOctokit(options.githubToken)

    const tempAppDir = await mkdtemp(join(getTempDir(), 'template_sync_'))
    
    // TODO: git clone the current branch to a tmp directory
    execSync(`git clone ${options.repoUrl} ${CLONE_DIR}`, {
        cwd: tempAppDir,
        env: process.env,
    })

    const tempCloneDir = join(tempAppDir, CLONE_DIR)

    // Get the clone Config 
    const cloneConfigPath = join(tempCloneDir, TEMPLATE_SYNC_CONFIG)
    const templateSyncConfig: Config = existsSync(cloneConfigPath) ? JSON.parse(readFileSync(cloneConfigPath).toString()) : {}

    const localConfigPath = join(process.cwd(), TEMPLATE_SYNC_LOCAL_CONFIG)
    const localTemplateSyncConfig = existsSync(localConfigPath) ? JSON.parse(localConfigPath) : {} as Config

    // TODO: wrap in Promise

    const filesToSync = getAllFilesInDir(tempCloneDir, templateSyncConfig.ignore)

    const localSkipFiles: string[] = [] 

    await Promise.all(filesToSync.map(async (f) => {
        mergeFile(f, {
            localTemplateSyncConfig,
            templateSyncConfig,
            tempCloneDir,
            cwd: process.cwd(),
        })
        if (some(f, localTemplateSyncConfig.ignore)) {
            localSkipFiles.push(f)
            return
        }

        const ext = extname(f)
        const filePath = join(process.cwd(), f)
        const templatePath = join(tempCloneDir, f)

        const mergeConfig = templateSyncConfig.merge[ext]

        // Either write the merge or write
        let fileContents: Buffer | string
        if (existsSync(filePath) && mergeConfig) {
            let handler: MergePlugin
            if (!mergeConfig.plugin) {
                handler = await import(mergeConfig.plugin!) as MergePlugin
            } else {
                handler = defaultExtensionMap[ext]
            }

            const mergeOptions = mergeConfig.rules.find((rule) => {
                return isMatch(f, rule.glob)
            })

            if (mergeOptions) {
                fileContents = await handler.merge((await readFile(filePath)).toString(), (await readFile(templatePath)).toString(), mergeOptions.options)
            } else {
                // Apply overwrite if we didn't set up merge
                fileContents = await readFile(templatePath)
            }
        } else {
            // Just perform simple overwrite
            fileContents = await readFile(templatePath)
        }
        await writeFile(filePath, fileContents)
    }))





    // ensure that there isn't already a PR without an override

    // Get the merge file

    // git create branch for this

    // git clone source repo

    // git copy/merge source repo to current stuff

    // git commit this

    // git clean up older prs

    // 


}

// If you would like to provide a merge method, you can do 
