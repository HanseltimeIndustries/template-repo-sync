/**
 * A function that clones the template repo into the provided tmpDir
 * and then returns the relative path within that directory to the template root
 */
export type TemplateCloneDriverFn = (tmpDir: string, repoUrl: string) => Promise<string>