const uuid = require('uuid');
const logger = require('loglevel').getLogger('nameko-js');

const { ValueError, InvalidStateError } = require('./errors');
const { asyncMap } = require('./utils');


// defines service types
const SERVICE_POOL = 'SERVICE_POOL';
const SINGLETON = 'SINGLETON';
const BROADCAST = 'BROADCAST';


function buildQueueName(eventType, sourceServiceName, eventName, serviceName, methodName) {
    if (eventType === SERVICE_POOL) {
        return `evt-${sourceServiceName}-${eventName}--${serviceName}.${methodName}`;
    } else if (eventType === SINGLETON) {
        return `evt-${sourceServiceName}-${eventName}`;
    } else if (eventType === BROADCAST) {
        const broadcastId = uuid.v4();
        return `evt-${sourceServiceName}-${eventName}--${serviceName}.${methodName}-${broadcastId}`;
    }
    throw Error(`Unknown event type '${eventType}'`);
}


class EventEntypoint {
    constructor(serviceName, sourceServiceName, eventName, handler, config) {
        this.serviceName = serviceName;
        this.eventName = eventName;
        this.sourceServiceName = sourceServiceName;
        this.config = config;
        this.container = null;
        if (typeof handler === 'function') {
            this.handler = handler;
            this.eventType = BROADCAST;
        } else if (Array.isArray(handler)) {
            [this.handler, this.eventType] = handler;
        } else {
            throw new ValueError('Handler is not a function nor an array');
        }
    }

    setup(container) {
        this.container = container;
    }

    async start(channel) {
        this._channel = channel;
        const { eventName, eventType, sourceServiceName } = this;

        const methodName = `node_${eventName}`;
        const exchangeName = `${sourceServiceName}.events`;

        await this._channel.assertExchange(exchangeName, 'topic', {
            durable: true,
            autoDelete: true,
        });

        // check : https://github.com/nameko/nameko/blob/master/nameko/events.py#L224
        const eventQueue = buildQueueName(
            eventType,
            sourceServiceName,
            eventName,
            this.serviceName,
            methodName,
        );
        await this._channel.assertQueue(eventQueue, {
            durable: true,
            autoDelete: true,
        });
        await this._channel.bindQueue(eventQueue, exchangeName, eventName);

        this._consumer = await this._channel.consume(eventQueue, async (msg) => {
            if (msg !== null) {
                logger.debug(`Event listener message '${sourceServiceName}':'${eventName}' -> ${this.serviceName}`);
                try {
                    const payload = JSON.parse(msg.content.toString());
                    await this.handler.apply(this.container, [payload]);
                } catch (ex) {
                    logger.error(`Error while handling event '${this.serviceName}:${eventName}'`, ex);
                }
                await this._channel.ack(msg);
            }
        });
    }

    async stop() {
        if (this._consumer) {
            await this._channel.cancel(this._consumer.consumerTag);
            this._consumer = null;
            this._channel = null;
        }
    }
}


class EventHandler {
    constructor(serviceName, eventsInfo, config) {
        this.serviceName = serviceName;
        this.config = config;
        this.eventsInfo = eventsInfo;
        this._channel = null;
        this.container = null;
        this.entryPoints = [];
    }

    setup(container) {
        this.container = container;
        Object.keys(this.eventsInfo).forEach(async (k) => {
            const eventInfo = this.eventsInfo[k];
            const [sourceServiceName, eventName] = k.split('.');
            const entryPoint = new EventEntypoint(
                this.serviceName,
                sourceServiceName,
                eventName,
                eventInfo,
                this.config,
            );
            entryPoint.setup(container);
            this.entryPoints.push(entryPoint);
        });
    }


    async start(channel) {
        if (this._channel) {
            throw new InvalidStateError('Event consumer already set');
        }
        this._channel = channel;
        asyncMap(this.entryPoints, async (ep) => {
            await ep.start(this._channel);
        });
    }

    async stop() {
        if (this._channel) {
            asyncMap(this.entryPoints, async ep => ep.stop());
            this._channel = null;
        }
    }
}

EventHandler.SERVICE_POOL = SERVICE_POOL;
EventHandler.BROADCAST = BROADCAST;
EventHandler.SINGLETON = SINGLETON;


module.exports = EventHandler;
