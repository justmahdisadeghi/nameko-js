const { asyncMap } = require('../src/utils');
const { assert } = require('chai');

async function delay(x, delta = 1) {
    return new Promise(resolve => setTimeout(() => resolve(x), delta));
}


describe('utils module', () => {
    it('should handle asyncMap', async () => {
        const result = await asyncMap([10, 20], async x => delay(x));
        assert.isArray(result);
        assert.deepEqual(result, [10, 20]);
    });

    it('should handle asyncMap unordered', async () => {
        const result = [];
        await asyncMap([10, 50, 1], async (x) => {
            await delay(null, x);
            result.push(x);
        });
        assert.isArray(result);
        assert.deepEqual(result, [1, 10, 50]);
    });
});
