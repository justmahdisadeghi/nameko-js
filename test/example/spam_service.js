const logger = require('loglevel').getLogger('nameko-tests');


module.exports = {
    name: 'spam_service',
    proxies: ['service_x'],
    rpc: {
        call_me: async (...args) => {
            logger.info(`service '${this.serviceName}' rpc call_me called with parameters: ${args}`);
            await this.disaptchEvent('spam', ['sausage']);
        },
    },
    events: {
        'other_service.ping': [
            async (payload) => {
                logger.info(`service '${this.serviceName}' event called with payload: ${payload}`);
                this.proxies.service_x.doSomething('my-data');
            }, 'BROADCAST'],
    },
};
