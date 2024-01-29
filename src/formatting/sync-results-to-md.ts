import { Change } from "diff"
import { TEMPLATE_SYNC_LOCAL_CONFIG, TemplateSyncReturn } from "../template-sync"

export function syncResultsToMd(result: TemplateSyncReturn) {

    return `# ${TEMPLATE_SYNC_LOCAL_CONFIG} 

## Stopped the following files from syncing:

${result.localSkipFiles.reduce((s, file) => {
    return `${s}* ${file}\n`
}, '')}

## Changed the following files from what they would have synced:

${Object.keys(result.localFileChanges).reduce((s, file) => {
    return `${s}${file}
\`\`\`diff
${result.localFileChanges[file].reduce((diffS, change) => {
    return `${diffS}\n${makeChangeIntoDiffLines(change)}`
}, '')}
\`\`\``
}, '')}
`
}

function makeChangeIntoDiffLines(change: Change, nonchangeMax = 3) {
    const operator = change.added ? '+' : change.removed ? '-' : ''

    if (!operator && nonchangeMax > 0 && change.count && change.count > nonchangeMax) {
        const lines = change.value.split('\n')
        const partial = lines.slice(lines.length - nonchangeMax)
        return `...\n${partial.join('\n')}\n`
    }

    return change.value.split('\n').reduce((s, line) => {
        return `${s}${operator}${line}\n`
    }, '')
}