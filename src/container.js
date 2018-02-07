const logger = require('loglevel').getLogger('nameko-js');

const RpcHandler = require('./rpc');
const EventHandler = require('./events');
const EventDispatcher = require('./dispatcher');
const ServiceProxies = require('./proxies');


class ServiceContainer {
    constructor(service, config = {}) {
        this.service = service;
        this.config = config;
        this.serviceName = service.name;
        this._connection = null; // amqp connection
        this._channel = null; // amqp channel
        this._proxies = null; // proxies service
        this._rpc = null; // rpc service
        this._events = null; // event service
        this._eventDispatcher = null; // dispatcher service
        this.rpc = {}; // hold rpc proxies
    }

    setup() {
        if (this.service.rpc) {
            this._rpc = new RpcHandler(this.serviceName, this.service.rpc, this.config);
            this._rpc.setup(this);
        }
        if (this.service.events) {
            this._events = new EventHandler(this.serviceName, this.service.events, this.config);
            this._events.setup(this);
        }
        if (this.service.proxies) {
            this._proxies = new ServiceProxies(this.serviceName, this.service.proxies, this.config);
            this._proxies.setup(this);
            this.rpc = this._proxies.buildRpcProxies();
        }
        this._eventDispatcher = new EventDispatcher(this.serviceName);
        return this;
    }

    async start(amqplib = null) {
        logger.debug(`Starting service '${this.serviceName}'`);
        this._connection = await amqplib.connect(this.config.AMQP_URL);
        this._channel = await this._connection.createChannel();
        if (this._rpc) {
            await this._rpc.start(this._channel);
        }
        if (this._events) {
            await this._events.start(this._channel);
        }
        if (this._proxies) {
            await this._proxies.start(this._channel);
        }
        await this._eventDispatcher.start(this._channel);
        logger.debug(`Service '${this.serviceName}' started`);
        return this;
    }

    async stop() {
        logger.debug(`Stopping service '${this.serviceName}'`);
        if (this._rpc) {
            await this._rpc.stop();
        }
        if (this._events) {
            await this._events.stop();
        }
        if (this._proxies) {
            await this._proxies.stop();
        }
        await this._eventDispatcher.stop();

        // close channel and connections
        if (this._channel) {
            await this._channel.close();
            this._channel = null;
        }
        if (this._connection) {
            await this._connection.close();
            this._connection = null;
        }
        logger.debug(`Service '${this.serviceName}' stopped`);
        return this;
    }

    async dispatchEvent(eventName, payload) {
        this._eventDispatcher.dispatch(eventName, payload);
    }
}

module.exports = ServiceContainer;
