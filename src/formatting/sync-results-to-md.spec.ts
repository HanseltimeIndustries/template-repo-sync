import { syncResultsToMd } from "./sync-results-to-md"


describe('syncResultsToMd', () => {
    it('snapshots', () => {
        expect(syncResultsToMd({
            localSkipFiles: ['src/file1.ts'],
            localFileChanges: {
                'package.json': [
                    {
                        count: 8,
                        value: 'my thing',
                        added: true
                    },
                    {
                        count: 10,
                        value: 'your thang',
                        removed: true
                    }
                ]
            }
        })).toMatchSnapshot()
    })
})