module.exports = {
    merge: () => {
        return JSON.stringify({
            downstream: true,
        }, null, 4)
    }
}