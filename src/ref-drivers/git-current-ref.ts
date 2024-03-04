import { execSync } from "child_process";

export async function gitCurrentRef(options: { rootDir: string }) {
  return execSync(`git rev-parse HEAD`, {
    cwd: options.rootDir,
  })
    .toString()
    .trim();
}
