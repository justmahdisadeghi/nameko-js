async function waitFor(func, interval = 1) {
    return new Promise((resolve) => {
        const cron = setInterval(() => {
            const ret = func.apply(null);
            if (ret) {
                clearInterval(cron);
                resolve();
            }
        }, interval);
    });
}


module.exports = {
    waitFor,
};
