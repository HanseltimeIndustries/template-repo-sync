import { existsSync, readFileSync, writeFileSync } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
import { copy } from "fs-extra";
import { join, resolve } from "path";
import { templateSync } from "./template-sync";
import { TEST_FIXTURES_DIR, tempDir } from "./test-utils";

const dummyCheckoutDriver = jest.fn();
const dummyCurrentRefDriver = jest.fn();

const downstreamDir = resolve(TEST_FIXTURES_DIR, "downstream");

describe("templateSync", () => {
	let tmpDir: string;
	let templateDir: string;
	let dummyCloneDriver: () => Promise<{ dir: string; remoteName: string }>;
	beforeEach(async () => {
		jest.resetAllMocks();
		tmpDir = await mkdtemp(tempDir());
		templateDir = await mkdtemp(tempDir());
		await copy(resolve(TEST_FIXTURES_DIR, "template"), templateDir);
		await copy(downstreamDir, tmpDir);
		dummyCloneDriver = async () => {
			return {
				dir: templateDir,
				remoteName: "ourRemote",
			};
		};
	});
	afterEach(async () => {
		await rm(tmpDir, {
			force: true,
			recursive: true,
		});
	});
	// Note: for this test, we expect actions and users to handle misconfigured template syncs
	it.each([
		[
			"local",
			`templatesync.local.json plugin option errors:
\tPlugin (plugins/fail-validate-plugin.js):
\t\toh no!
\t\tnot this one too!
`,
		],
		[
			"template",
			`templatesync.json plugin option errors:
\tPlugin (dummy-fail-plugin.js):
\t\tshucks
\t\tno good
`,
		],
		[
			"both",
			`templatesync.json plugin option errors:
\tPlugin (dummy-fail-plugin.js):
\t\tshucks
\t\tno good
templatesync.local.json plugin option errors:
\tPlugin (plugins/fail-validate-plugin.js):
\t\toh no!
\t\tnot this one too!
`,
		],
	])("throws errors from plugin validation", async (mode, expected) => {
		// Remove the local sync overrides
		await rm(join(tmpDir, "templatesync.local.json"));

		if (mode === "local" || mode == "both") {
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
							plugin: "plugins/fail-validate-plugin.js",
							options: {},
						},
					],
				}),
			);
		}
		if (mode === "template" || mode === "both") {
			writeFileSync(
				join(templateDir, "templatesync.json"),
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
							plugin: "dummy-fail-plugin.js",
							options: {},
						},
					],
				}),
			);
		}

		await expect(
			async () =>
				await templateSync({
					tmpCloneDir: "stubbed-by-driver",
					cloneDriver: dummyCloneDriver,
					repoUrl: "not-important",
					repoDir: tmpDir,
					checkoutDriver: dummyCheckoutDriver,
					currentRefDriver: dummyCurrentRefDriver,
				}),
		).rejects.toThrow(expected);
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
				currentRefDriver: dummyCurrentRefDriver,
			}),
		).toEqual({
			// Expect no changes since there was no local sync file
			localSkipFiles: [],
			localFileChanges: {},
			modifiedFiles: {
				added: [
					"package.json",
					"src/index.js",
					"src/templated.js",
					"src/templated.ts",
					"templatesync.json",
				],
				deleted: [],
				modified: [],
				total: 5,
			},
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
				currentRefDriver: dummyCurrentRefDriver,
			}),
		).toEqual({
			// Expect no changes since there was no local sync file
			localSkipFiles: [],
			localFileChanges: {},
			modifiedFiles: {
				added: [
					"package.json",
					"src/index.js",
					"src/templated.js",
					"src/templated.ts",
					"templatesync.json",
				],
				deleted: [],
				modified: [],
				total: 5,
			},
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
			currentRefDriver: dummyCurrentRefDriver,
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
			currentRefDriver: dummyCurrentRefDriver,
		});

		expect(result.localSkipFiles).toEqual(["src/templated.ts"]);
		// TODO: more rigorous testing around diff changes
		expect(result.localFileChanges).toEqual(
			expect.objectContaining({
				"package.json": expect.arrayContaining([]),
			}),
		);
		// Make sure the result captures the changes
		expect(result.modifiedFiles).toEqual({
			added: [
				"package.json",
				"src/index.js",
				"src/templated.js",
				"templatesync.json",
			],
			deleted: [],
			modified: [],
			total: 4,
		});

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
			currentRefDriver: dummyCurrentRefDriver,
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
			modified: ["src/index.ts"], // Add index.ts so we make sure it is still ignored - see test-fixtures/template/templatesync.json ignores
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

		// since there was no override for this file, no changes from the local file
		expect(result.localFileChanges).toEqual(expect.objectContaining({}));
		expect(result.modifiedFiles).toEqual({
			added: ["src/templated.ts"],
			modified: ["templatesync.local.json"], // Add index.ts so we make sure it is still ignored - due to a bug
			deleted: [],
			total: 2,
		});

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
	it("Does not update the local templatesync if updateAfterRef is true and the ref is the same", async () => {
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
			modified: ["src/index.ts"], // Add index.ts so we make sure it is still ignored - see test-fixtures/template/templatesync.json ignores
			deleted: [],
		}));
		const mockCurrentRefDriver = jest
			.fn()
			.mockImplementation(async () => "dummySha");
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

		// Nothing shoudl be reported as changing
		expect(result).toEqual({
			localFileChanges: {},
			localSkipFiles: [],
			modifiedFiles: {
				added: [],
				modified: [],
				deleted: [],
				total: 0,
			},
		});
		// Verify the files
		await fileMatchDownstream(tmpDir, "templatesync.json");
		await fileMatchDownstream(tmpDir, "src/templated.ts");

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

		// since there was no override for this file, no changes from the local file
		expect(result.localFileChanges).toEqual(expect.objectContaining({}));
		expect(result.modifiedFiles).toEqual({
			added: [
				"package.json",
				"src/index.js",
				"src/templated.js",
				"src/templated.ts",
				"templatesync.json",
				"templatesync.local.json",
			],
			deleted: [],
			modified: [],
			total: 6,
		});

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
	// helper
	async function fileMatchTemplate(_tmpDir: string, relPath: string) {
		return fileMatch(_tmpDir, relPath, "template");
	}

	async function fileMatchDownstream(_tmpDir: string, relPath: string) {
		return fileMatch(_tmpDir, relPath, "downstream");
	}

	async function fileMatch(
		_tmpDir: string,
		relPath: string,
		source: "downstream" | "template",
	) {
		const dir =
			source === "downstream" ? downstreamDir : (await dummyCloneDriver()).dir;
		expect((await readFile(resolve(_tmpDir, relPath))).toString()).toEqual(
			(await readFile(resolve(dir, relPath))).toString(),
		);
	}
});
