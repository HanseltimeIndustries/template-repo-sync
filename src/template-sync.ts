import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAllFilesInDir } from "./match";
import { Config, LocalConfig } from "./types";
import { mergeFile } from "./merge-file";
import { gitClone } from "./clone-drivers/git-clone";
import { Change } from "diff";
import { TemplateCloneDriverFn } from "./clone-drivers";
import { TemplateDiffDriverFn, gitDiff } from "./diff-drivers";
import { gitCurrentRef } from "./ref-drivers";
import { TemplateRefDriverFn } from "./ref-drivers/types";
import { inferJSONIndent } from "./formatting";
import * as commentJSON from 'comment-json'

export interface TemplateSyncOptions {
  repoUrl: string;

  /**
   * The directory for cloning our template repo into via the cloneDriver
   */
  tmpCloneDir: string;

  /**
   * The repo directory path that we are going to merge toward
   */
  repoDir: string;

  /**
   * If set to true, template sync will apply the current ref
   * of the template repo to afterRef
   */
  updateAfterRef?: boolean;

  /**
   * Defaults to using git clone
   */
  cloneDriver?: TemplateCloneDriverFn;

  /**
   * Defaults to using git diff
   */
  diffDriver?: TemplateDiffDriverFn;

  /**
   * Defaults to using git current ref
   */
  currentRefDriver?: TemplateRefDriverFn;
}

export interface TemplateSyncReturn {
  /**
   * An array of files that were skipped outright due to a templatesync.local ignore glob
   */
  localSkipFiles: string[];
  /**
   * An object mapping all file paths to any merge rules that would've overridden the merge rules
   * of the template sync file.
   *
   * Note: right now, this shows non-changed diffs as well so you have to look for added or removed
   */
  localFileChanges: {
    [filePath: string]: Change[];
  };
}

export const TEMPLATE_SYNC_CONFIG = "templatesync";
export const TEMPLATE_SYNC_LOCAL_CONFIG = "templatesync.local";

export async function templateSync(
  options: TemplateSyncOptions,
): Promise<TemplateSyncReturn> {
  const cloneDriver = options.cloneDriver ?? gitClone;
  const diffDriver = options.diffDriver ?? gitDiff;
  const currentRefDriver = options.currentRefDriver ?? gitCurrentRef;
  const tempCloneDir = await cloneDriver(options.tmpCloneDir, options.repoUrl);

  // Get the clone Config
  const cloneConfigPath = join(tempCloneDir, `${TEMPLATE_SYNC_CONFIG}.json`);
  const templateSyncConfig: Config = existsSync(cloneConfigPath)
    ? commentJSON.parse(readFileSync(cloneConfigPath).toString()) as unknown as Config
    : { ignore: [] };

  const localConfigPath = join(
    options.repoDir,
    `${TEMPLATE_SYNC_LOCAL_CONFIG}.json`,
  );
  const localTemplateSyncConfig: LocalConfig = existsSync(localConfigPath)
    ? commentJSON.parse(readFileSync(localConfigPath).toString()) as unknown as LocalConfig
    : { ignore: [] };

  let filesToSync: string[];
  if (localTemplateSyncConfig.afterRef) {
    filesToSync = await diffDriver(
      tempCloneDir,
      localTemplateSyncConfig.afterRef,
    );
  } else {
    filesToSync = getAllFilesInDir(tempCloneDir, [
      ...templateSyncConfig.ignore,
      ".git/**",
    ]);
  }

  const localSkipFiles: string[] = [];
  const localFileChanges: {
    [filePath: string]: Change[];
  } = {};

  await Promise.all(
    filesToSync.map(async (f) => {
      const result = await mergeFile(f, {
        localTemplateSyncConfig,
        templateSyncConfig,
        tempCloneDir,
        cwd: options.repoDir,
      });
      if (result.ignoredDueToLocal) {
        localSkipFiles.push(f);
      } else if (result?.localChanges && result.localChanges.length > 0) {
        localFileChanges[f] = result.localChanges;
      }
    }),
  );

  // apply after ref
  if (options.updateAfterRef) {
    const ref = await currentRefDriver({
      rootDir: tempCloneDir,
    });

    if (existsSync(localConfigPath)) {
      const configStr = readFileSync(localConfigPath).toString();
      const config = commentJSON.parse(configStr) as unknown as LocalConfig;
      config.afterRef = ref;
      writeFileSync(
        localConfigPath,
        commentJSON.stringify(config, null, inferJSONIndent(configStr)),
      );
    } else {
      writeFileSync(
        localConfigPath,
        commentJSON.stringify({ afterRef: ref }, null, 4),
      );
    }
  }

  return {
    localSkipFiles,
    localFileChanges,
  };
}
