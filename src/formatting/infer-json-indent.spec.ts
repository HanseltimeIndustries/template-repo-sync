import { inferJSONIndent } from './infer-json-indent'

const withNewLine = `{

    "whoa": true,
    "thing": here,
    "something": {
        "nested": false
    }
}`

const fourSpaces = `{
    "whoa": true,
    "thing": here,
    "something": {
        "nested": false
    }
}`

const tabSpaces = `{
	"whoa": true,
	"thing": here,
	"something": {
		"nested": false
	}
}`

const twoSpaces = `{
  "whoa": true,
  "thing": here,
  "something": {
    "nested": false
  }
}`

describe('inferJSONIndent', () => {
  it('returns spaces when the first indent is spaces with a new line', () => {
    expect(inferJSONIndent(withNewLine)).toBe('    ')
  })
  it('returns spaces when the first indent is spaces', () => {
    expect(inferJSONIndent(fourSpaces)).toBe('    ')
  })
  it('returns spaces when the first indent is spaces', () => {
    expect(inferJSONIndent(twoSpaces)).toBe('  ')
  })
  it('returns tabs when the first indent is a tab', () => {
    expect(inferJSONIndent(tabSpaces)).toBe('\t')
  })
})
