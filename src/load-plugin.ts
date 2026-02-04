import { defaultExtensionMap } from "./plugins";
import { MergeConfig, MergePlugin } from "./types";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Loads the plugin associated with the merge config
 * @param mergeConfig
 * @param forExt
 * @param configDir
 * @returns
 */
export async function loadPlugin<T>(
  mergeConfig: MergeConfig<T>,
  configDir: string,
): Promise<MergePlugin<T>> {
  if (mergeConfig.plugin.startsWith("_")) {
    const defaultHandler = Object.values(defaultExtensionMap).find(
      (el) => el.builtinName === mergeConfig.plugin,
    );
    if (!defaultHandler) {
      throw new Error(
        `No builtin merge function supplied for ${mergeConfig.plugin}.  Cannot have merge config without custom plugin supplied.`,
      );
    }
    return defaultHandler as MergePlugin<T>;
  }

  let handler: MergePlugin<unknown>;
  // First check if this is a local .js file
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

  return handler as MergePlugin<T>;
}
