import { resolve } from 'path'
import { tmpdir } from 'os'

export const TEST_FIXTURES_DIR = resolve(__dirname, '..', '..', 'test-fixtures')

export function tempDir(): string {
    return process.env.RUNNER_TEMP ?? tmpdir()
}