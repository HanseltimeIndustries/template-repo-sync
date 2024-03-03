import { execSync } from "child_process"

export async function gitDiff(gitDir: string, afterRef: string) {
    const diffFilesStr = execSync(`git diff ${afterRef}.. --name-only`, {
        cwd: gitDir,
    }).toString().trim()
    return diffFilesStr.split('\n')
}