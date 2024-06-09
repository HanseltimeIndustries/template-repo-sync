import { join, resolve } from "path";
import { TEST_FIXTURES_DIR, tempDir } from "../test-utils";
import { copy, mkdtemp, moveSync } from "fs-extra";
import { execSync } from "child_process";
import { gitCheckout } from "./git-checkout";
import { readFileSync } from "fs";

const gitRemoteDir = resolve(TEST_FIXTURES_DIR, "testGitRepo");

describe("gitCheckout", () => {
  let tmpRemoteDir: string;
  let tmpRepoDir: string;
  beforeEach(async () => {
    const baseTmpDir = await mkdtemp(tempDir());
    // Make the remote dir
    tmpRemoteDir = join(baseTmpDir, "remote");
    await copy(gitRemoteDir, tmpRemoteDir);
    // rehydrate the git repo
    moveSync(join(tmpRemoteDir, "gitDir"), join(tmpRemoteDir, ".git"));

    // Perform the clone we expect
    execSync(`git clone ${tmpRemoteDir} testGitRepo`, {
      cwd: baseTmpDir,
    });
    tmpRepoDir = join(baseTmpDir, "testGitRepo");
  });
  it("checks out the appropriate branch", async () => {
    await gitCheckout({
      tmpDir: tmpRepoDir,
      remoteName: "origin",
      branch: "test-branch", // We set this in the gitDir
    });

    expect(readFileSync(join(tmpRepoDir, "README.md")).toString()).toContain(
      "# This is the test-branch",
    );
  });
  it("throws an error if the branch is not found", async () => {
    await expect(
      async () =>
        await gitCheckout({
          tmpDir: tmpRepoDir,
          remoteName: "origin",
          branch: "test-branch-not-there", // This is not set in gitDir
        }),
    ).rejects.toThrow();
  });
  it("throws an error if the origin is not found", async () => {
    await expect(
      async () =>
        await gitCheckout({
          tmpDir: tmpRepoDir,
          remoteName: "originNA",
          branch: "test-branch", // This is not set in gitDir
        }),
    ).rejects.toThrow();
  });
  it("does not throw if the branch was the default", async () => {
    await gitCheckout({
      tmpDir: tmpRepoDir,
      remoteName: "origin",
      branch: "master", // We set this in the gitDir
    });

    expect(readFileSync(join(tmpRepoDir, "README.md")).toString()).toContain(
      "# This is the master branch",
    );
  });
});
