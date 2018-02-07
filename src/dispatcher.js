const { InvalidStateError } = require('./errors');
const logger = require('loglevel').getLogger('nameko-js');


class EventDispatcher {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this._channel = null;
    }

    getExchangeName() {
        return `${this.serviceName}.events`;
    }

    async start(channel) {
        if (this._channel) {
            throw new InvalidStateError('Rpc consumer already set');
        }
        this._channel = channel;

        await this._channel.assertExchange(this.getExchangeName(), 'topic', {
            durable: true,
            autoDelete: true,
        });
    }

    async stop() {
        this._channel = null;
    }

    async dispatch(eventName, payload) {
        if (!this._channel) {
            throw new InvalidStateError('Dispatcher not started');
        }
        const exchange = this.getExchangeName();
        const content = Buffer.from(JSON.stringify(payload));
        logger.debug(`Dispatch event '${eventName}' on exchange '${exchange}'`);
        await this._channel.publish(this.getExchangeName(), eventName, content, {
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            deliveryMode: 2, // persistent
        });
    }
}


module.exports = EventDispatcher;
