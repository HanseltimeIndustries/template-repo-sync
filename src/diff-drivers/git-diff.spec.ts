import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { gitDiff } from "./git-diff";

describe("gitDiff", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync("gitdiff-test");
    // Initialize a git repo
    execSync("git init", { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, "file1.txt"), "hello");
    fs.writeFileSync(path.join(tempDir, "second.txt"), "second");
    fs.writeFileSync(path.join(tempDir, "third.txt"), "third");
    execSync("git add . && git commit -m 'initial'", { cwd: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("handles a rename as a delete and an add", async () => {
    const firstCommit = execSync("git rev-parse HEAD", { cwd: tempDir })
      .toString()
      .trim();

    // Perform a rename
    execSync("git mv file1.txt file2.txt", { cwd: tempDir });
    execSync("git commit -m 'rename'", { cwd: tempDir });

    const result = await gitDiff(tempDir, firstCommit);

    // Because of --no-renames:
    expect(result).toEqual({
      deleted: ["file1.txt"],
      added: ["file2.txt"],
      modified: [],
    });
  });
  it("handles a added, deleted, and modified appropriately across multiple commits", async () => {
    const firstCommit = execSync("git rev-parse HEAD", { cwd: tempDir })
      .toString()
      .trim();

    // Perform a rename
    execSync("git mv file1.txt file2.txt", { cwd: tempDir });
    execSync("git commit -m 'rename'", { cwd: tempDir });

    // Perform adds
    fs.writeFileSync(path.join(tempDir, "another.txt"), "another file");
    execSync("git add . && git commit -m 'adding another file'", {
      cwd: tempDir,
    });

    // Perform a modify
    fs.writeFileSync(path.join(tempDir, "third.txt"), "third+");
    execSync("git add . && git commit -m 'modifying third'", { cwd: tempDir });

    // Perform a delete
    fs.rmSync(path.join(tempDir, "second.txt"));
    execSync("git add . && git commit -m 'deleting second'", { cwd: tempDir });

    const result = await gitDiff(tempDir, firstCommit);

    // Because of --no-renames:
    expect(result).toEqual({
      deleted: expect.arrayContaining(["file1.txt", "second.txt"]),
      added: expect.arrayContaining(["file2.txt", "another.txt"]),
      modified: ["third.txt"],
    });
  });
});
