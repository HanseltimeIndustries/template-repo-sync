/**
 * A function that operates within the root dir and returns the
 * current ref for its state.  This abstracts the idea of getting
 * the current commit sha, so that things like other custom templating
 * frameworks can provide their own ref
 */
export type TemplateRefDriverFn = (options: {
  /** The root dir where we want to get the "current" ref */
  rootDir: string;
}) => Promise<string>;
