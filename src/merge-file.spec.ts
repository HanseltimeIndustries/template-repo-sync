import { join, resolve } from "path"
import { mergeFile } from "./merge-file"
import { tempDir, TEST_FIXTURES_DIR } from "./test-utils"
import { mkdtemp, readFile, rm } from "fs/promises"
import { copySync} from 'fs-extra'
import { JsonFileMergeOptions } from "./types"

const testTemplateDir = resolve(TEST_FIXTURES_DIR, 'template')
const testDownstreamDir = resolve(TEST_FIXTURES_DIR, 'downstream')

describe('mergeFile', () => {
    let tmpDir: string
    beforeEach(async () => {
        tmpDir = await mkdtemp(tempDir())
        copySync(testDownstreamDir, tmpDir)
    })
    afterEach(async () => {
        await rm(tmpDir, {
            force: true,
            recursive: true,
        })
    })
    // Note: we use the "ignore" from the templateSync to constrain files we iterate over so it doeesn't happen here
    // it('skips the file if it is part of template config ignroe', async () => {
    //     expect(await mergeFile('package.json', {
    //         cwd: tmpDir,
    //         tempCloneDir: testTemplateDir,
    //         localTemplateSyncConfig: {
    //             ignore: [],
    //             merge: {
    //             }
    //         },
    //         templateSyncConfig: {
    //             ignore: ['**/package.json'],
    //         }
    //     })).toBe(false)
    // })
    it('skips the file if it is part of local config ignore', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: ['**/package.json'],
                merge: {
                }
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
            }
        })).toEqual({
            ignoredDueToLocal: true,
        })
    })
    it('overwrites if no merge config for files', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
            }
        })).toEqual({
            ignoredDueToLocal: false,
            localChanges: [],
        })

        // Ensure we overwrote
        expect(await readFile(join(tmpDir, 'package.json'))).toEqual(await readFile(join(testTemplateDir, 'package.json')))
    })
    // Yea... these are more integration tests but I'm kinda untrusting of mocks for this
    it('applies default [.json] merge with first rules if merge applies to file', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
                merge: {
                    '.json': {
                        // no plugins
                        rules: [
                            {
                                glob: '**/package.json',
                                options: 'merge-current',
                            },
                            {
                                glob: '**/package.json',
                                options: 'merge-template',
                            }
                        ]
                    }
                }
            }
        })).toEqual({
            ignoredDueToLocal: false,
            localChanges: []
        })

        // Ensure we overwrote
        expect(JSON.parse((await readFile(join(tmpDir, 'package.json'))).toString())).toEqual({
            "name": "mypkg",
            "description": "my description",
            "dependencies": {
                "mypackage": "^1.2.0",
                "newpacakge": "^22.2.2",
                "package2": "3.22.1",
                "huh": "^2.30.0"
            },
            "engines": {
                "node": ">=20"
            },
            "scripts": {
                "build": "build",
                "test": "jest",
                "myscript": "somescript"
            },
            version: 'new-version'
        })
    })
    it('[inverse] applies default [.json] merge with first rules if merge applies to file', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
                merge: {
                    '.json': {
                        // no plugins
                        rules: [
                            {
                                glob: '**/package.json',
                                options: 'merge-template',
                            },
                            {
                                glob: '**/package.json',
                                options: 'merge-current',
                            },
                        ]
                    }
                }
            }
        })).toEqual({
            ignoredDueToLocal: false,
            localChanges: []
        })

        // Ensure we overwrote
        expect(JSON.parse((await readFile(join(tmpDir, 'package.json'))).toString())).toEqual({
            "name": "some-stub-name",
            "description": "some-stub-description",
            "dependencies": {
                "mypackage": "^1.2.0",
                "newpacakge": "^22.2.2",
                "package2": "3.22.1",
                "huh": "~1.0.0"
            },
            "engines": {
                "node": ">=15"
            },
            "scripts": {
                "build": "build",
                "test": "fill this in yourself",
                "myscript": "somescript"
            },
            version: 'new-version'
        })
    })
    it('[inverse] applies default [.json] merge with sync and then local override', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
                merge: {
                    '.json': {
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    paths: [
                                        // Do not touch huh
                                        ['$.dependencies.huh', 'merge-current']
                                    ]
                                }
                            }
                        ]
                    }
                }
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
                merge: {
                    '.json': {
                        // no plugins
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    missingIsDelete: true,
                                    paths: [
                                        // Merge all template dependencies
                                        ['$.dependencies', 'merge-template']
                                    ]
                                } as JsonFileMergeOptions,
                            },
                            {
                                glob: '**/package.json',
                                options: 'merge-current',
                            },
                        ]
                    }
                }
            }
        })).toEqual({
            ignoredDueToLocal: false,
            localChanges: expect.arrayContaining([
                {
                    "added": undefined,
                    "count": 1,
                    "removed": true,
                    "value": "        \"huh\": \"~1.0.0\"\n",
                },
                {
                    "added": true,
                    "count": 1,
                    "removed": undefined,
                    "value": "        \"huh\": \"^2.30.0\"\n",
                }
            ])
        })

        // Ensure we overwrote
        expect(JSON.parse((await readFile(join(tmpDir, 'package.json'))).toString())).toEqual({
            "name": "mypkg",
            "description": "my description",
            "dependencies": {
                "mypackage": "^1.2.0",
                "newpacakge": "^22.2.2",
                "package2": "3.22.1",
                "huh": "^2.30.0",
            },
            "engines": {
                "node": ">=20"
            },
            "scripts": {
                "build": "build",
                "test": "jest",
                "myscript": "somescript"
            },
            version: 'new-version'
        })
    })
    it('[inverse] applies default [.json] and custom merge for local with sync and then local override', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
                merge: {
                    '.json': {
                        // simulates a "node" plugin since we're pulling from the current context
                        plugin: '../test-fixtures/dummy-plugin.js',
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    paths: [
                                        // Do not touch huh
                                        ['$.dependencies.huh', 'merge-current']
                                    ]
                                }
                            }
                        ]
                    }
                }
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
                merge: {
                    '.json': {
                        // no plugins
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    missingIsDelete: true,
                                    paths: [
                                        // Merge all template dependencies
                                        ['$.dependencies', 'merge-template']
                                    ]
                                } as JsonFileMergeOptions,
                            },
                            {
                                glob: '**/package.json',
                                options: 'merge-current',
                            },
                        ]
                    }
                }
            }
        })).toEqual({
            ignoredDueToLocal: false,
            // TODO: I don't
            localChanges: expect.arrayContaining([
                      {
                           "added": undefined,
                           "count": 17,
                           "removed": true,
                           "value": `    "name": "mypkg",
    "description": "my description",
    "dependencies": {
        "mypackage": "^1.2.0",
        "newpacakge": "^22.2.2",
        "package2": "3.22.1",
        "huh": "~1.0.0"
    },
    "engines": {
        "node": ">=20"
    },
    "scripts": {
        "build": "build",
        "test": "jest",
        "myscript": "somescript"
    },
    "version": "new-version"\n`
                         },
                         {
                           "added": true,
                           "count": 1,
                           "removed": undefined,
                           "value": `    "tested": true\n`,
                         },
            ])
        })

        // Ensure we overwrote
        expect(JSON.parse((await readFile(join(tmpDir, 'package.json'))).toString())).toEqual({
            tested: true
        })
    })
    it('[inverse] applies default [.json] and custom merge for local with sync plugin and then local override', async () => {
        expect(await mergeFile('package.json', {
            cwd: tmpDir,
            tempCloneDir: testTemplateDir,
            localTemplateSyncConfig: {
                ignore: [],
                merge: {
                    '.json': {
                        // This is a relative path to ht
                        plugin: 'plugins/custom-plugin.js',
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    paths: [
                                        // Do not touch huh
                                        ['$.dependencies.huh', 'merge-current']
                                    ]
                                }
                            }
                        ]
                    }
                }
            },
            templateSyncConfig: {
                ignore: ['**/*.txt'],
                merge: {
                    '.json': {
                        // no plugins
                        rules: [
                            {
                                glob: '**/package.json',
                                options: {
                                    missingIsDelete: true,
                                    paths: [
                                        // Merge all template dependencies
                                        ['$.dependencies', 'merge-template']
                                    ]
                                } as JsonFileMergeOptions,
                            },
                            {
                                glob: '**/package.json',
                                options: 'merge-current',
                            },
                        ]
                    }
                }
            }
        })).toEqual({
            ignoredDueToLocal: false,
            // We are just making sure plugin look up happens here
            localChanges: expect.arrayContaining([])
        })

        // Ensure we overwrote
        expect(JSON.parse((await readFile(join(tmpDir, 'package.json'))).toString())).toEqual({
            downstream: true
        })
    })
})