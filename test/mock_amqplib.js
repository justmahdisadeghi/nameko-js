const uuid = require('uuid');
const minimatch = require('minimatch');
const logger = require('loglevel').getLogger('mock-amqp');


const QUEUES = {};
const EXCHANGES = {};


function _removeConsumer(consumerTag) {
    Object.keys(QUEUES).forEach((queueName) => {
        const queue = QUEUES[queueName];
        queue.consumers = queue.consumers.filter(consumer =>
            consumer.consumerTag !== consumerTag);
    });
}


class MockChannel {
    constructor(connection) {
        this.id = uuid.v4();
        this.consumers = {};
        this.connection = connection;
        this.pendingMessages = {};
    }

    async assertExchange(name, type, options = {}) { // eslint-disable-line
        if (EXCHANGES[name]) {
            return EXCHANGES[name];
        }
        const exchange = {
            name,
            type,
            options,
            binds: {},
        };
        EXCHANGES[name] = exchange;
        return exchange;
    }

    async assertQueue(name, options = {}) { // eslint-disable-line
        if (QUEUES[name]) {
            return QUEUES[name];
        }
        const queue = {
            name,
            options,
            exchanges: [],
            consumers: [],
        };
        QUEUES[name] = queue;
        return queue;
    }

    async bindQueue(name, exchange, pattern) { // eslint-disable-line
        QUEUES[name].exchanges.push(exchange);
        EXCHANGES[exchange].binds[name] = pattern;
    }

    async consume(queueName, handler) {
        if (!QUEUES[queueName]) {
            throw new Error(`Unknown queue '${queueName}'`);
        }
        const consumer = {
            consumerTag: `consumer-${uuid.v4()}`,
            handler: async (...args) => {
                try {
                    logger.debug(`Consume message='${queueName}'`);
                    await handler(...args);
                } catch (ex) {
                    logger.error(`Error while consuming message error='${ex.message}'`);
                }
            },
        };
        this.consumers[consumer.consumerTag] = consumer;
        QUEUES[queueName].consumers.push(consumer);
        return consumer;
    }

    async publish(exchangeName, routingKey, content, properties) {
        const exchange = EXCHANGES[exchangeName];
        if (!exchange) {
            throw new Error(`Unknown exchange '${exchangeName}'`);
        }
        logger.debug(`Publish on exchange='${exchangeName}' routingKey='${routingKey}'`);
        Object.keys(exchange.binds).forEach((queueName) => {
            const bindPattern = exchange.binds[queueName];
            if (minimatch(routingKey, bindPattern)) {
                logger.debug(`Route to queue='${queueName}' pattern='${bindPattern}'`);
                QUEUES[queueName].consumers.forEach((consumer) => {
                    const message = {
                        content,
                        properties,
                        fields: {
                            routingKey,
                        },
                    };
                    this.pendingMessages[message.id] = message;
                    setTimeout(() => {
                        consumer.handler(message);
                    }, 1);
                });
            }
        });
    }

    async cancel(consumerId) {
        _removeConsumer(consumerId);
        delete this.consumers[consumerId];
    }

    async close() {
        // clean QUEUE of consumers
        const consumerKeys = Object.keys(this.consumers);
        consumerKeys.forEach(k => _removeConsumer(k));
        this.consumers = {};
        this.connection.removeChannel(this.id);
    }

    ack(message) {
        if (!this.pendingMessages[message.id]) {
            throw new Error(`No message with ID '${message.id}' waiting for ack`);
        }
        delete this.pendingMessages[message.id];
    }
}


class MockConnection {
    constructor() {
        this.id = uuid.v4();
        this.channels = {};
        MockConnection._connections[this.id] = this;
    }

    async createChannel() {
        const channel = new MockChannel(this);
        this.channels[channel.id] = channel;
        return channel;
    }

    async removeChannel(channelId) {
        delete this.channels[channelId];
    }
    async close() {
        delete MockConnection._connections[this.id];
    }
}

MockConnection._connections = {};


function connect() {
    return new MockConnection();
}

const EXPORT = {
    getConnections: () => Object.values(MockConnection._connections),
    clearConnections: () => {
        MockConnection._connections = {};
        Object.keys(EXCHANGES).forEach(prop => delete EXCHANGES[prop]);
        Object.keys(QUEUES).forEach(prop => delete QUEUES[prop]);
    },
    connect,
    EXCHANGES,
    QUEUES,
};

module.exports = EXPORT;
