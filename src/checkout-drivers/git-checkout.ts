import { execSync } from "child_process";

export async function gitCheckout(options: {
  /** The directory where we cloned to */
  tmpDir: string,
  /** The name of the remote that git checks out against */
  remoteName: string,
  /** The branch to checkout against */
  branch: string
}): Promise<boolean> {
    const { branch, remoteName, tmpDir } = options
  execSync(`git fetch ${remoteName} ${branch}`, {
    cwd: tmpDir,
    env: process.env,
  });
  execSync(`git checkout -b ${branch} --track ${remoteName}/${branch}`, {
    cwd: tmpDir,
    env: process.env,
  });

  return true;
}
