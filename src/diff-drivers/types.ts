export interface DiffResult {
  modified: string[];
  added: string[];
  deleted: string[];
}

/**
 * A function that operates within the gitDir, and returns the list of file paths
 * since the last sha
 */
export type TemplateDiffDriverFn = (
  gitDir: string,
  afterRef: string,
) => Promise<DiffResult>;
