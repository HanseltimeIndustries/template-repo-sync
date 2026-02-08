import { execSync } from "child_process";

/**
 * For a given directory with a git configuration, this will return the modified, added, and
 * deleted files since the last afterRef
 * @param gitDir The git directory folder
 * @param afterRef The git ref to look for diffs after
 * @returns
 */
export async function gitDiff(gitDir: string, afterRef: string) {
  const baseCommand = `git diff ${afterRef}.. --no-renames --name-only`;
  const modifiedFiles = execSync(`${baseCommand} --diff-filter=M`, {
    cwd: gitDir,
  })
    .toString()
    .trim()
    .split("\n")
    .filter((s) => s !== "");
  const addedFiles = execSync(`${baseCommand} --diff-filter=A`, {
    cwd: gitDir,
  })
    .toString()
    .trim()
    .split("\n")
    .filter((s) => s !== "");
  const deletedFiles = execSync(`${baseCommand} --diff-filter=D`, {
    cwd: gitDir,
  })
    .toString()
    .trim()
    .split("\n")
    .filter((s) => s !== "");

  return {
    modified: modifiedFiles,
    added: addedFiles,
    deleted: deletedFiles,
  };
}
