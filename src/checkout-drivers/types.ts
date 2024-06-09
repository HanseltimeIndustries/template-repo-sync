/**
 * A function that will checkout a given "branch" after the repo has been
 * "cloned" by a clone drvier.
 * 
 * @returns true if the checkout succeeded
 */
export type TemplateCheckoutDriverFn = (options: {
  /** The directory where we cloned to */
  tmpDir: string,
  /** The name of the remote that git checks out against */
  remoteName: string,
  /** The branch to checkout against */
  branch: string
}) => Promise<boolean>