
async function asyncMap(array, fun) {
    if (!array) {
        return array;
    }
    return Promise.all(array.map(async x => fun(x)));
}


module.exports = {
    asyncMap,
};
