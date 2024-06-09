import { execSync } from "child_process";
import { resolve } from "path";
import { CloneReturn } from "./types";

const CLONE_DIR = "cloned_repo";

export async function gitClone(
  tmpDir: string,
  repoUrl: string,
): Promise<CloneReturn> {
  execSync(`git clone ${repoUrl} ${CLONE_DIR}`, {
    cwd: tmpDir,
    env: process.env,
  });

  return {
    dir: resolve(tmpDir, CLONE_DIR),
    remoteName: 'origin',
  };
}
