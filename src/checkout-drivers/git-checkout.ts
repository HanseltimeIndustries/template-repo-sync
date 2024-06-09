import { execSync } from "child_process";

export async function gitCheckout(options: {
  /** The directory where we cloned to */
  tmpDir: string;
  /** The name of the remote that git checks out against */
  remoteName: string;
  /** The branch to checkout against */
  branch: string;
}): Promise<boolean> {
  const { branch, remoteName, tmpDir } = options;

  const remoteInfo = execSync(`git remote show ${remoteName}`, {
    cwd: tmpDir,
    env: process.env,
  }).toString();
  const defaultMatch = /HEAD branch:\s*([a-zA-Z0-9_-]+)/.exec(remoteInfo);
  if (!defaultMatch || !defaultMatch[1]) {
    throw new Error(
      `Could not determine default branch of cloned repo.\nAttempted to find in remote info:\n${remoteInfo} `,
    );
  }

  const defaultBranch = defaultMatch[1];
  // Skip this if the default branch is already pulled
  if (defaultBranch !== branch) {
    execSync(`git fetch ${remoteName} ${branch}`, {
      cwd: tmpDir,
      env: process.env,
    });
    execSync(`git checkout -b ${branch} --track ${remoteName}/${branch}`, {
      cwd: tmpDir,
      env: process.env,
    });
  }

  return true;
}
