import { resolve } from "path";
import { getAllFilesInDir } from "./match";
import { TEST_FIXTURES_DIR } from "./test-utils";

const TEST_GLOB_DIR = resolve(TEST_FIXTURES_DIR, "glob-test");

describe("getAllFilesInDir", () => {
  it("gets all files in the directory with no ignores", () => {
    const files = getAllFilesInDir(TEST_GLOB_DIR, []);
    expect(files).toEqual(
      expect.arrayContaining([
        "folder1/something.js",
        "folder1/something.ts",
        "toplevel.js",
        "toplevel.txt",
      ]),
    );
    try {
      expect(files.length).toBe(4);
    } catch (err) {
      console.error("All found files: " + files);
      throw err;
    }
  });
  it("gets all files in the directory that do not match the ignore (single)", () => {
    const files = getAllFilesInDir(TEST_GLOB_DIR, ["**/*.ts"]);
    expect(files).toEqual(
      expect.arrayContaining([
        "folder1/something.js",
        "toplevel.js",
        "toplevel.txt",
      ]),
    );
    try {
      expect(files.length).toBe(3);
    } catch (err) {
      console.error("All found files: " + files);
      throw err;
    }
  });
  it("gets all files in the directory that do not match the ignore (multiple)", () => {
    const files = getAllFilesInDir(TEST_GLOB_DIR, ["**/*.ts", "**/*.txt"]);
    expect(files).toEqual(
      expect.arrayContaining(["folder1/something.js", "toplevel.js"]),
    );
    try {
      expect(files.length).toBe(2);
    } catch (err) {
      console.error("All found files: " + files);
      throw err;
    }
  });

  it("gets all files in the directory that do not match the ignore with a folder level directive (multiple)", () => {
    const files = getAllFilesInDir(TEST_GLOB_DIR, [
      "**/*.ts",
      "**/*.txt",
      "folder1",
    ]);
    expect(files).toEqual(expect.arrayContaining(["toplevel.js"]));
    try {
      expect(files.length).toBe(1);
    } catch (err) {
      console.error("All found files: " + files);
      throw err;
    }
  });
});
