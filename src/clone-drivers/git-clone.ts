import { execSync } from "child_process";
import { resolve } from "path";

const CLONE_DIR = 'cloned_repo'

export async function gitClone(tmpDir: string, repoUrl: string): Promise<string> {
    execSync(`git clone ${repoUrl} ${CLONE_DIR}`, {
        cwd: tmpDir,
        env: process.env,
    })

    return resolve(tmpDir, CLONE_DIR)
}