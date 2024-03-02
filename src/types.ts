/**
 * How we want to merge json
 * 
 * overwrite - the template sync overwrites completely
 * merge-template - we merge template into the current json with overrides on matching values happening from the template
 * merge-current - we merge the current json into the template json with overrides on matching values happening from the current json 
 */
export type BaseJsonMergeOptions = 'overwrite' | 'merge-template' | 'merge-current'
export interface JsonPathOverrides {
    /**
     * If set to true, this means we won't add new properties from the template
     */
    ignoreNewProperties?: boolean
    /**
     * If set to true, overwrite will apply undefined values as deleted for the jsonpaths
     * or for values that are supposed to be merged on top of other values
     */
    missingIsDelete?: boolean
    /**
     * Note, if multiple json paths match a rule, we pick the first one in the list that matches
     */
    paths: 
        /**
         * We only override jsonpaths.  Anything not specified is kept the same.
         */
        [jsonPath: `$.${string}`, options: BaseJsonMergeOptions][]
}
export type JsonFileMergeOptions = BaseJsonMergeOptions | JsonPathOverrides

// Sum of all basic file merge options
type MergePluginOptions = JsonFileMergeOptions

/**
 * Configuration object for a given file type merge configuration
 */
export interface MergeConfig<T> {
    /**
     * The node module, available on the calling node context, that you want to run.
     * If not provided, we try to use any built-in merge plugins.
     */
    plugin?: string,
    /**
     * An array of first match file globs that will 
     */
    rules: {glob: string, options: MergePluginOptions | T}[]
}


/**
 * The base shape of a template sync config file
 */
export interface Config<T = any> {
    ignore: string[],
    /**
     * If there is no merge config, then we will always just overwrite the file for the diff
     */
    merge?: {
        [fileExt: string]: MergeConfig<T>
    }
}

/**
 * Information around the file we are trying to merge and that arguments for that merge
 * from matching a merge configuration
 */
export interface MergeContext<PluginOptions = any> {
    relFilePath: string,
    /**
     * If you have provided a custom merge plugin, this will be the "options" section of 
     * the matching glob
     */
    mergeArguments: PluginOptions
    /**
     * If this run is for the local config.  Keep in mind that any local config overrides will 
     * be run after the template sync options and we would like to report any changes that
     * are done
     */
    isLocalOptions?: boolean
}

export interface MergePlugin<PluginOptions> {
    /**
     * This method will be called when a file from the template and it's analog in the downstream repo
     * have some differences.  The plugin must perform the merge and return the appropriate file contents
     * as a string
     * 
     * TODO: we may create a V2 plugin that could deal with large files and not pass around strings in memory,
     * but for now, this is the current implementation
     * 
     * @param current - The downstream repos current file contents
     * @param fromTemplateRepo - the current
     * @param context - an object defining the context around the file and the specific options 
     */
    merge(current: string, fromTemplateRepo: string, context: MergeContext<PluginOptions>): Promise<string>
    /**
     * Given an options object for the merge, this validates the options object and returns error messages if there is anything wrong.
     * @param options 
     */
    validate(options: PluginOptions): string[] | undefined
}