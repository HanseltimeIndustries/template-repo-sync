import { JsonFileMergeOptions, MergePlugin } from '../types'
import { merge as jsonMerge, validate as jsonValidate } from './json-merge'

export const defaultExtensionMap = {
    '.json': {
        merge: jsonMerge,
        validate: jsonValidate,
    }
} as {
    [ext: string]: MergePlugin<JsonFileMergeOptions>
}