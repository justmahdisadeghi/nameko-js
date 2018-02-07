const defaultConfig = require('./default_config');
const ServiceRunner = require('./service_runner');

function getConfig(config = {}) {
    return Object.assign({}, config, defaultConfig);
}

async function createServiceRunner(config) {
    const { services, ...rest } = config;
    const serviceConfig = getConfig(rest);
    const serviceRunner = new ServiceRunner(serviceConfig);
    services.forEach(s => serviceRunner.addService(s));
    return serviceRunner;
}

module.exports = {
    createServiceRunner,
    getConfig,
};
