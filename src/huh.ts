import { diffLines } from 'diff'
import 'colors'

async function main() {
    const foo = `
This is my line
   and this is another

and here
    `

    const bar = `
This is my line
and this is new


here we are
    `

    const diff = diffLines(foo, bar)

    diff.forEach((part) => {
        // green for additions, red for deletions
        // grey for common parts
        const color = part.added ? 'green' :
          part.removed ? 'red' : 'grey';
        process.stderr.write(part.value[color as any]);
      });
}

void main()
