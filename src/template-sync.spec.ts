import { copy } from "fs-extra";
import { mkdtemp, readFile, rm } from "fs/promises";
import { templateSync } from "./template-sync";
import { tempDir, TEST_FIXTURES_DIR } from "./test-utils";
import { join, resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

// Just return the test-fixture directory
const dummyCloneDriver = async () => {
  return {
    dir: resolve(TEST_FIXTURES_DIR, "template"),
    remoteName: "ourRemote",
  };
};

const dummyCheckoutDriver = jest.fn();

const downstreamDir = resolve(TEST_FIXTURES_DIR, "downstream");

describe("templateSync", () => {
  let tmpDir: string;
  beforeEach(async () => {
    jest.resetAllMocks();
    tmpDir = await mkdtemp(tempDir());
    await copy(downstreamDir, tmpDir);
  });
  afterEach(async () => {
    await rm(tmpDir, {
      force: true,
      recursive: true,
    });
  });
  it("appropriately merges according to just the templatesync config file into an empty dir", async () => {
    const emptyTmpDir = await mkdtemp(tempDir());
    expect(
      await templateSync({
        tmpCloneDir: "stubbed-by-driver",
        cloneDriver: dummyCloneDriver,
        repoUrl: "not-important",
        repoDir: emptyTmpDir,
        checkoutDriver: dummyCheckoutDriver,
      }),
    ).toEqual({
      // Expect no changes since there was no local sync file
      localSkipFiles: [],
      localFileChanges: {},
    });

    // Verify the files
    await fileMatchTemplate(emptyTmpDir, "templatesync.json");
    await fileMatchTemplate(emptyTmpDir, "package.json");
    await fileMatchTemplate(emptyTmpDir, "src/templated.ts");

    // Expect the ignores to not be a problem
    expect(existsSync(resolve(emptyTmpDir, "src/index.ts"))).toBeFalsy();
    expect(existsSync(resolve(emptyTmpDir, "src/custom-bin"))).toBeFalsy();

    expect(dummyCheckoutDriver).not.toHaveBeenCalled();
  });
  it("Checks out the branch and then appropriately merges", async () => {
    const emptyTmpDir = await mkdtemp(tempDir());
    expect(
      await templateSync({
        tmpCloneDir: "stubbed-by-driver",
        cloneDriver: dummyCloneDriver,
        repoUrl: "not-important",
        repoDir: emptyTmpDir,
        branch: "new-template-test",
        checkoutDriver: dummyCheckoutDriver,
      }),
    ).toEqual({
      // Expect no changes since there was no local sync file
      localSkipFiles: [],
      localFileChanges: {},
    });

    // Verify the files
    await fileMatchTemplate(emptyTmpDir, "templatesync.json");
    await fileMatchTemplate(emptyTmpDir, "package.json");
    await fileMatchTemplate(emptyTmpDir, "src/templated.ts");

    // Expect the ignores to not be a problem
    expect(existsSync(resolve(emptyTmpDir, "src/index.ts"))).toBeFalsy();
    expect(existsSync(resolve(emptyTmpDir, "src/custom-bin"))).toBeFalsy();
    const cloneInfo = await dummyCloneDriver();
    expect(dummyCheckoutDriver).toHaveBeenCalledWith({
      tmpDir: cloneInfo.dir,
      remoteName: cloneInfo.remoteName,
      branch: "new-template-test",
    });
  });
  it("appropriately merges according to just the templatesync config file in an existing repo", async () => {
    // Remove the local sync overrides
    await rm(join(tmpDir, "templatesync.local.json"));

    const result = await templateSync({
      tmpCloneDir: "stubbed-by-driver",
      cloneDriver: dummyCloneDriver,
      repoUrl: "not-important",
      repoDir: tmpDir,
      checkoutDriver: dummyCheckoutDriver,
    });

    expect(result.localSkipFiles).toEqual([]);
    expect(result.localFileChanges).toEqual({});

    // Verify the files
    await fileMatchTemplate(tmpDir, "templatesync.json");
    await fileMatchTemplate(tmpDir, "src/templated.ts");
    const packageJson = JSON.parse(
      readFileSync(resolve(tmpDir, "package.json")).toString(),
    );

    expect(packageJson).toEqual({
      name: "mypkg",
      description: "my description",
      dependencies: {
        mypackage: "^1.2.0",
        newpacakge: "^22.2.2",
        package2: "3.22.1",
        huh: "~1.0.0",
      },
      engines: {
        node: ">=15",
      },
      scripts: {
        build: "build",
        test: "jest",
        myscript: "somescript",
      },
      // By default we add new top-level fields
      version: "new-version",
    });

    // Expect the ignores to not be a problem
    await fileMatchDownstream(tmpDir, "src/index.ts");
    await fileMatchDownstream(tmpDir, "plugins/custom-plugin.js");
    expect(dummyCheckoutDriver).not.toHaveBeenCalled();
  });
  it("appropriately merges according to the templatesync config file and the local config in an existing repo", async () => {
    // Remove the local sync overrides
    await rm(join(tmpDir, "templatesync.local.json"));

    writeFileSync(
      join(tmpDir, "templatesync.local.json"),
      JSON.stringify({
        ignore: [
          // Ignores the templated.ts
          "**/*.ts",
          // We don't have a need for this in here, but it's an example of keeping things cleaner for our custom plugins
          "plugins/**",
        ],
        merge: [
          {
            glob: "package.json",
            plugin: "plugins/custom-plugin.js",
            options: {},
          },
        ],
      }),
    );

    const result = await templateSync({
      tmpCloneDir: "stubbed-by-driver",
      cloneDriver: dummyCloneDriver,
      repoUrl: "not-important",
      repoDir: tmpDir,
      checkoutDriver: dummyCheckoutDriver,
    });

    expect(result.localSkipFiles).toEqual(["src/templated.ts"]);
    // TODO: more rigorous testing around diff changes
    expect(result.localFileChanges).toEqual(
      expect.objectContaining({
        "package.json": expect.arrayContaining([]),
      }),
    );

    // Verify the files
    await fileMatchTemplate(tmpDir, "templatesync.json");
    await fileMatchDownstream(tmpDir, "src/templated.ts");
    const packageJson = JSON.parse(
      readFileSync(resolve(tmpDir, "package.json")).toString(),
    );

    // The plugin nuked this
    expect(packageJson).toEqual({
      downstream: true,
    });

    // Expect the ignores to not be a problem
    await fileMatchDownstream(tmpDir, "src/index.ts");
    await fileMatchDownstream(tmpDir, "plugins/custom-plugin.js");
    expect(dummyCheckoutDriver).not.toHaveBeenCalled();
  });
  it("appropriately merges according to the templatesync config file and the local config in an existing repo with afterRef", async () => {
    // Remove the local sync overrides
    await rm(join(tmpDir, "templatesync.local.json"));

    writeFileSync(
      join(tmpDir, "templatesync.local.json"),
      JSON.stringify({
        afterRef: "dummySha",
        ignore: [
          // We don't have a need for this in here, but it's an example of keeping things cleaner for our custom plugins
          "plugins/**",
        ],
      }),
    );

    // We will only update the templated.ts
    const mockDiffDriver = jest.fn().mockImplementation(async () => ({
      added: ["src/templated.ts"],
      modified: [],
      deleted: [],
    }));
    const result = await templateSync({
      tmpCloneDir: "stubbed-by-driver",
      cloneDriver: dummyCloneDriver,
      repoUrl: "not-important",
      repoDir: tmpDir,
      diffDriver: mockDiffDriver,
      checkoutDriver: dummyCheckoutDriver,
    });

    // since there was no override for this file, not changes from the local file
    expect(result.localFileChanges).toEqual(expect.objectContaining({}));

    // Verify the files
    await fileMatchTemplate(tmpDir, "templatesync.json");
    await fileMatchTemplate(tmpDir, "src/templated.ts");

    // Expect the none of the diff files to work
    await fileMatchDownstream(tmpDir, "src/index.ts");
    await fileMatchDownstream(tmpDir, "plugins/custom-plugin.js");
    await fileMatchDownstream(tmpDir, "package.json");
    expect(dummyCheckoutDriver).not.toHaveBeenCalled();
  });
  it("updates the local templatesync with the current ref if updateAfterRef is true", async () => {
    // Remove the local sync overrides
    await rm(join(tmpDir, "templatesync.local.json"));

    const mockLocalConfig = {
      afterRef: "dummySha",
      ignore: [
        // We don't have a need for this in here, but it's an example of keeping things cleaner for our custom plugins
        "plugins/**",
      ],
    };

    writeFileSync(
      join(tmpDir, "templatesync.local.json"),
      JSON.stringify(mockLocalConfig),
    );

    // We will only update the templated.ts
    const mockDiffDriver = jest.fn().mockImplementation(async () => ({
      added: ["src/templated.ts"],
      modified: [],
      deleted: [],
    }));
    const mockCurrentRefDriver = jest
      .fn()
      .mockImplementation(async () => "newestSha");
    const result = await templateSync({
      tmpCloneDir: "stubbed-by-driver",
      cloneDriver: dummyCloneDriver,
      repoUrl: "not-important",
      repoDir: tmpDir,
      updateAfterRef: true,
      diffDriver: mockDiffDriver,
      currentRefDriver: mockCurrentRefDriver,
      checkoutDriver: dummyCheckoutDriver,
    });

    // since there was no override for this file, not changes from the local file
    expect(result.localFileChanges).toEqual(expect.objectContaining({}));

    // Verify the files
    await fileMatchTemplate(tmpDir, "templatesync.json");
    await fileMatchTemplate(tmpDir, "src/templated.ts");

    // Expect the none of the diff files to work
    await fileMatchDownstream(tmpDir, "src/index.ts");
    await fileMatchDownstream(tmpDir, "plugins/custom-plugin.js");
    await fileMatchDownstream(tmpDir, "package.json");

    // Ensure we have updated the local template field
    expect(
      JSON.parse(
        (await readFile(join(tmpDir, "templatesync.local.json"))).toString(),
      ),
    ).toEqual({
      ...mockLocalConfig,
      afterRef: "newestSha",
    });
    expect(dummyCheckoutDriver).not.toHaveBeenCalled();
  });
  it("creates the local templatesync with the current ref if updateAfterRef is true and no local template exists", async () => {
    // Remove the local sync overrides
    await rm(join(tmpDir, "templatesync.local.json"));

    // We will only update the templated.ts
    const mockDiffDriver = jest.fn().mockImplementation(async () => ({
      added: ["src/templated.ts"],
    }));
    const mockCurrentRefDriver = jest
      .fn()
      .mockImplementation(async () => "newestSha");
    const result = await templateSync({
      tmpCloneDir: "stubbed-by-driver",
      cloneDriver: dummyCloneDriver,
      repoUrl: "not-important",
      repoDir: tmpDir,
      updateAfterRef: true,
      diffDriver: mockDiffDriver,
      currentRefDriver: mockCurrentRefDriver,
      checkoutDriver: dummyCheckoutDriver,
    });

    // since there was no override for this file, not changes from the local file
    expect(result.localFileChanges).toEqual(expect.objectContaining({}));

    // Verify the files
    await fileMatchTemplate(tmpDir, "templatesync.json");
    await fileMatchTemplate(tmpDir, "src/templated.ts");
    const packageJson = JSON.parse(
      readFileSync(resolve(tmpDir, "package.json")).toString(),
    );

    expect(packageJson).toEqual({
      name: "mypkg",
      description: "my description",
      dependencies: {
        mypackage: "^1.2.0",
        newpacakge: "^22.2.2",
        package2: "3.22.1",
        huh: "~1.0.0",
      },
      engines: {
        node: ">=15",
      },
      scripts: {
        build: "build",
        test: "jest",
        myscript: "somescript",
      },
      // By default we add new top-level fields
      version: "new-version",
    });

    // Expect the none of the diff files to work
    await fileMatchDownstream(tmpDir, "src/index.ts");
    await fileMatchDownstream(tmpDir, "plugins/custom-plugin.js");

    // Ensure we have updated the local template field
    expect(
      JSON.parse(
        (await readFile(join(tmpDir, "templatesync.local.json"))).toString(),
      ),
    ).toEqual({
      afterRef: "newestSha",
    });
  });
  expect(dummyCheckoutDriver).not.toHaveBeenCalled();
});

// helper
async function fileMatchTemplate(tmpDir: string, relPath: string) {
  return fileMatch(tmpDir, relPath, "template");
}

async function fileMatchDownstream(tmpDir: string, relPath: string) {
  return fileMatch(tmpDir, relPath, "downstream");
}

async function fileMatch(
  tmpDir: string,
  relPath: string,
  source: "downstream" | "template",
) {
  const dir =
    source === "downstream" ? downstreamDir : (await dummyCloneDriver()).dir;
  expect((await readFile(resolve(tmpDir, relPath))).toString()).toEqual(
    (await readFile(resolve(dir, relPath))).toString(),
  );
}
