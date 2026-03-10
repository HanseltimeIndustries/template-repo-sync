import { tmpdir } from "os";
import { resolve } from "path";

export const TEST_FIXTURES_DIR = resolve(
	__dirname,
	"..",
	"..",
	"test-fixtures",
);

export function tempDir(): string {
	return process.env.RUNNER_TEMP ?? tmpdir();
}
