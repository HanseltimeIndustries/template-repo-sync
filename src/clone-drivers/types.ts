/**
 * @deprecated - return the remote name in the CloneReturn
 */
type CloneDir = string;

export interface CloneReturn {
  /** The directory where the clone occurred - absolute path to avoid working dir issues */
  dir: string;
  /** The name of the remote for the particular technology that you used - passed to checkout drivers */
  remoteName: string;
}

/**
 * A function that clones the template repo into the provided tmpDir
 * and then returns the relative path within that directory to the template root
 */
export type TemplateCloneDriverFn = (
  tmpDir: string,
  repoUrl: string,
) => Promise<CloneReturn | CloneDir>;
