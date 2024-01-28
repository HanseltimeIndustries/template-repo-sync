import { copySync } from "fs-extra"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { templateSync } from "./template-sync"
import { TEST_FIXTURES_DIR } from "./test-utils"
import { resolve } from "path"

// Just return the test-fixture directory
const dummyCloneDriver = async () => {
    return resolve(TEST_FIXTURES_DIR, 'template')
}

describe('templateSync', () => {
    let tmpDir: string
    beforeEach(async () => {
        tmpDir = await mkdtemp(tmpdir())
    })
    afterEach(async () => {
        await rm(tmpDir, {
            force: true,
            recursive: true,
        })
    })
    it('appropriately merges according to just the templatesync config file', async () => {
        await templateSync({
            tmpCloneDir: 'stubbed-by-driver',
            cloneDriver: dummyCloneDriver,
            repoUrl: 'not-important',
            repoDir: tmpDir,
        })
    })
})