import { defaultExtensionMap } from "./plugins";
import { MergeConfig, MergePlugin } from "./types";
import { existsSync } from "fs";
import { resolve } from "path";

export async function loadPlugin<T>(
  mergeConfig: MergeConfig<T>,
  forExt: string,
  configDir: string,
): Promise<MergePlugin<T>> {
  let handler: MergePlugin<unknown>;
  if (mergeConfig.plugin) {
    // First check if this is a loal .js file
    const localPath = resolve(configDir, mergeConfig.plugin);
    const importPath = existsSync(localPath) ? localPath : mergeConfig.plugin;
    try {
      // Sad workaround for testing since dynamic import segfaults
      if (process.env.JEST_WORKER_ID !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        handler = require(importPath) as MergePlugin<unknown>;
      } else {
        handler = (await import(importPath)) as MergePlugin<unknown>;
      }
      if (!handler.merge) {
        handler = (handler as unknown as { default: MergePlugin<unknown> })
          .default;
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else {
    if (!defaultExtensionMap[forExt]) {
      throw new Error(
        `No default merge function supplied for ${forExt}.  Cannot have mere config without custom plugin supplied.`,
      );
    }
    handler = defaultExtensionMap[forExt];
  }

  return handler as MergePlugin<T>;
}
