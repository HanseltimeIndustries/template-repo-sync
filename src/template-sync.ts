import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAllFilesInDir } from "./match";
import { Config, FileOperation, LocalConfig } from "./types";
import { mergeFile } from "./merge-file";
import { gitClone } from "./clone-drivers/git-clone";
import { Change } from "diff";
import { TemplateCloneDriverFn } from "./clone-drivers";
import { DiffResult, TemplateDiffDriverFn, gitDiff } from "./diff-drivers";
import { gitCurrentRef } from "./ref-drivers";
import { TemplateRefDriverFn } from "./ref-drivers/types";
import { inferJSONIndent } from "./formatting";
import * as commentJSON from "comment-json";
import { TemplateCheckoutDriverFn, gitCheckout } from "./checkout-drivers";
import { some } from "micromatch";

export interface TemplateSyncOptions {
  /**
   * This is the url of the template repo
   */
  repoUrl: string;

  /**
   * Optional Branch to check out - if not specified, this checks out the
   * default branch of the template repo
   */
  branch?: string;

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

  /**
   * Defaults to using git checkout driver
   */
  checkoutDriver?: TemplateCheckoutDriverFn;
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
  /**
   * A list of all files that are modified by this operation.  You can use total to quickly check if
   * there was an actual meaningful change.
   *
   * Please note, ther may be localSkipfiles and total: 0, which indicates there were changes BUT the local template
   * sync file rendered them meaningless.
   */
  modifiedFiles: DiffResult & {
    total: number;
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
  const checkoutDriver = options.checkoutDriver ?? gitCheckout;
  const cloneReturn = await cloneDriver(options.tmpCloneDir, options.repoUrl);

  const { dir: tempCloneDir, remoteName } =
    typeof cloneReturn === "string"
      ? {
          dir: cloneReturn,
          remoteName: "origin", // Default to this
        }
      : cloneReturn;

  if (options.branch) {
    await checkoutDriver({
      tmpDir: tempCloneDir,
      remoteName,
      branch: options.branch,
    });
  }

  // Get the clone Config
  const cloneConfigPath = join(tempCloneDir, `${TEMPLATE_SYNC_CONFIG}.json`);
  const templateSyncConfig: Config = existsSync(cloneConfigPath)
    ? (commentJSON.parse(
        readFileSync(cloneConfigPath).toString(),
      ) as unknown as Config)
    : { ignore: [] };

  const localConfigFile = `${TEMPLATE_SYNC_LOCAL_CONFIG}.json`;
  const localConfigPath = join(options.repoDir, localConfigFile);
  const localTemplateSyncConfig: LocalConfig = existsSync(localConfigPath)
    ? (commentJSON.parse(
        readFileSync(localConfigPath).toString(),
      ) as unknown as LocalConfig)
    : { ignore: [] };

  let filesToSync: DiffResult;
  const ref = await currentRefDriver({
    rootDir: tempCloneDir,
  });
  if (localTemplateSyncConfig.afterRef) {
    if (ref === localTemplateSyncConfig.afterRef) {
      // short circuit if the refs match
      return {
        localSkipFiles: [],
        localFileChanges: {},
        modifiedFiles: {
          added: [],
          modified: [],
          deleted: [],
          total: 0,
        },
      };
    }
    filesToSync = await diffDriver(
      tempCloneDir,
      localTemplateSyncConfig.afterRef,
    );
  } else {
    filesToSync = {
      added: getAllFilesInDir(tempCloneDir, [
        ...templateSyncConfig.ignore,
        ".git/**",
      ]),
      deleted: [],
      modified: [],
    };
  }

  // Apply ignore filters
  filesToSync.added = filesToSync.added.filter(
    (f) => !some(f, templateSyncConfig.ignore),
  );
  filesToSync.modified = filesToSync.modified.filter(
    (f) => !some(f, templateSyncConfig.ignore),
  );
  filesToSync.deleted = filesToSync.deleted.filter(
    (f) => !some(f, templateSyncConfig.ignore),
  );

  const localSkipFiles: Set<string> = new Set();
  const localFileChanges: {
    [filePath: string]: Change[];
  } = {};

  const fileSyncFactory = (op: FileOperation) => {
    return async (f: string) => {
      const result = await mergeFile(f, {
        localTemplateSyncConfig,
        templateSyncConfig,
        tempCloneDir,
        cwd: options.repoDir,
        fileOperation: op,
      });
      if (result.ignoredDueToLocal) {
        localSkipFiles.add(f);
      } else if (result?.localChanges && result.localChanges.length > 0) {
        localFileChanges[f] = result.localChanges;
      }
    };
  };

  // Added and modified have the same setup for now
  await Promise.all(filesToSync.added.map(fileSyncFactory("added")));
  await Promise.all(filesToSync.modified.map(fileSyncFactory("modified")));
  await Promise.all(filesToSync.deleted.map(fileSyncFactory("deleted")));

  // Report the files that changed in general
  const actualAdded = filesToSync.added.filter((f) => !localSkipFiles.has(f));
  const actualModified = filesToSync.modified.filter(
    (f) => !localSkipFiles.has(f),
  );
  const actualDeleted = filesToSync.deleted.filter(
    (f) => !localSkipFiles.has(f),
  );
  const modifiedFiles = {
    added: actualAdded,
    modified: actualModified,
    deleted: actualDeleted,
  };

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
      modifiedFiles.modified.push(localConfigFile);
    } else {
      writeFileSync(
        localConfigPath,
        commentJSON.stringify({ afterRef: ref }, null, 4),
      );
      modifiedFiles.added.push(localConfigFile);
    }
  }

  return {
    localSkipFiles: Array.from(localSkipFiles),
    localFileChanges,
    modifiedFiles: {
      ...modifiedFiles,
      total:
        modifiedFiles.added.length +
        modifiedFiles.deleted.length +
        modifiedFiles.modified.length,
    },
  };
}
