import * as github from '@actions/github'
import * as core from '@actions/core'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { mkdtemp } from 'fs/promises'
import { TEMPLATE_SYNC_LOCAL_CONFIG, templateSync } from '../template-sync'
import { gitClone } from '../clone-drivers/git-clone'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { syncResultsToMd } from '../formatting/sync-results-to-md'

interface GithubOptions {
    /**
     * The owner/repo path of the repo on github
     */
    repoPath: string

    // A github token with access to write pull requests
    githubToken: string
    // Normally, this should be the working directory of a github action, but this
    // could also be an internal file depending on things like monorepo structures
    repoRoot?: string

    /**
     * The branch on the template that we want to sync to
     */
    templateBranch: string

    // A short branch prefix for the branch that will be created in order to store the changes
    branchPrefix?: string

    /**
     * The commit message to supply when making the merge commits
     */
    commitMsg?: string

    /**
     * The title of the pull request
     */
    titleMsg?: string

    /**
     * This is the branch to open the pull request to.  If not set, we will use the
     * repo's default branch.
     */
    prToBranch?: string
}

function getTempDir() {
    return process.env['RUNNER_TEMP'] || tmpdir()
}

const DEFAULT_BRANCH_PREFIX = 'chore/template_sync/'
const DEFAULT_COMMIT_MSG = 'chore(template): synchronizing template to repo'
const DEFAULT_TITLE_MSG = DEFAULT_COMMIT_MSG


// TODO: break this out into a separate package
export async function syncGithubRepo(options: GithubOptions) {

    const octokit = github.getOctokit(options.githubToken)

    const repoRoot = options.repoRoot ?? process.cwd()
    const branchPrefix = options.branchPrefix ?? DEFAULT_BRANCH_PREFIX
    const commitMsg = options.commitMsg ? options.commitMsg : DEFAULT_COMMIT_MSG


    // Note, we use git here so that we can change this around for other git providers more easily
    const repoUrl = `https://github.com/${options.repoPath}`
    const shaLine = execSync(`git ls-remote "${repoUrl}" "${options.templateBranch}"`).toString().split(' ')[0]
    const match = /^(?<hash>[^\s]+)\s/.exec(shaLine)
    const templateSha = match?.groups?.hash
    if (!templateSha) {
        throw new Error(`Could not get the current sha of ${repoUrl} for ${options.templateBranch}`)
    }

    let configHash: string
    if (existsSync(resolve(repoRoot, TEMPLATE_SYNC_LOCAL_CONFIG))) {
        configHash = createHash('sha256').update(readFileSync(resolve(repoRoot, TEMPLATE_SYNC_LOCAL_CONFIG))).digest('hex').slice(0, 8)
    } else {
        configHash = 'noLocalConfig'
    }

    const branchName = `${branchPrefix}${templateSha.slice(0, 8)}-${configHash}`

    // Check if the branch exists already and skip
    const output = execSync(`git ls-remote --heads origin "${branchName}"`).toString().trim()
    // Non-empty output means the branch exists
    if (output) {
        core.warning(`The exact same combination of ${TEMPLATE_SYNC_LOCAL_CONFIG} and remote ${options.templateBranch} has been run before`)
        core.warning(`If you would like to re-run due to plugins, etc.  Please delete branch: ${branchName}`)
        // Error this
        process.exit(1)
    }

    // Checkout the branch
    execSync(`git checkout -b ${branchName}`)


    // Clone and merge on this branch
    const tempAppDir = await mkdtemp(join(getTempDir(), 'template_sync_'))

    const result = await templateSync({
        cloneDriver: gitClone,
        tmpCloneDir: tempAppDir,
        repoDir: options.repoRoot ?? process.cwd(),
        repoUrl,
    })

    // commit everything
    execSync('git add .')
    execSync(`git commit -m "${DEFAULT_COMMIT_MSG}"`)
    execSync(`git push --set-upstream origin "${branchName}"`)

    let prToBranch = options.prToBranch
    if (!prToBranch) {
        const resp = await octokit.rest.repos.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        })
        prToBranch = resp.data.default_branch
    }



    await octokit.rest.pulls.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head: branchName,
        base: prToBranch,
        title: DEFAULT_TITLE_MSG,
        body: `
Template Synchronization Operation of ${repoUrl} ${options.templateBranch}

${syncResultsToMd(result)}
`
    })

    // TODO: we will add label prs

    // TODO: clean up the old prs 

}
