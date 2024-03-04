import { execSync } from "child_process";
import { gitCurrentRef } from "./git-current-ref";

describe("getCurrentRef", () => {
  it("gets the current sha", async () => {
    expect(
      await gitCurrentRef({
        rootDir: process.cwd(),
      }),
    ).toEqual(execSync("git rev-parse HEAD").toString().trim());
  });
});
