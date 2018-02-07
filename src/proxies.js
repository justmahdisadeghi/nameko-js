const uuid = require('uuid');
const logger = require('loglevel').getLogger('nameko-js');
const {
    TimeoutError,
    InvalidStateError,
    ValueError,
    RpcError,
} = require('./errors');


class ServiceProxies {
    constructor(serviceName, proxiesInfo, config) {
        this.config = config;
        this.proxiesInfo = proxiesInfo;
        this.serviceName = serviceName;
        this._channel = null;
        this._consumer = null;
        this._routingKey = null;
        this._waitingResponses = {};
        if (this.proxiesInfo && !this.proxiesInfo.forEach) {
            throw new ValueError('Proxies should be a list');
        }
    }

    setup(container) {
        this.container = container;
    }

    async start(channel) {
        if (this._channel) {
            throw new InvalidStateError('Proxies consumer already set');
        }
        this._channel = channel;

        await this._channel.assertExchange(this.config.RPC_EXCHANGE, 'topic', { durable: true });
        // create response queue
        this._routingKey = uuid.v4();
        const responseQueue = `rpc.reply-node-${this.serviceName}-${this._routingKey}`;
        await this._channel.assertQueue(responseQueue, {
            durable: false,
            autoDelete: true,
            exclusive: true,
        });

        await this._channel.bindQueue(responseQueue, this.config.RPC_EXCHANGE, this._routingKey);
        this._consumer = await this._channel.consume(responseQueue, async (msg) => {
            if (msg !== null) {
                const response = JSON.parse(msg.content.toString());
                const { correlationId } = msg.properties;
                await this._handleResponse(correlationId, response.error, response.result);
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

    buildRpcProxies() {
        const result = {};
        const that = this;
        this.proxiesInfo.forEach((service) => {
            if (service === this.serviceName) {
                logger.warn('Create proxy on itself');
            }
            const proxy = new Proxy(this, {
                get(target, name) {
                    // do something here
                    return async (...args) => that.call(service, name, args, null);
                },
            });
            result[service] = proxy;
        });
        return result;
    }

    async _handleResponse(correlationId, error, result) {
        const responseHandler = this._waitingResponses[correlationId];
        if (!responseHandler) {
            logger.info('correlationId does not exists, action result sent twice or timed out');
            return;
        }
        let jsError = null;
        if (error) {
            // convert nameko error object in a node.js error
            jsError = new RpcError(error);
        }
        responseHandler(jsError, result);
    }

    async call(service, rpc, args, kwargs) {
        const payload = {
            args,
        };
        if (kwargs) {
            payload.kwargs = kwargs;
        } else {
            payload.kwargs = {};
        }

        const content = Buffer.from(JSON.stringify(payload));
        const correlationId = uuid.v4();
        logger.debug(`Call rpc '${service}.${rpc}' with payload: ${JSON.stringify(payload)}`);

        await this._channel.publish(this.config.RPC_EXCHANGE, `${service}.${rpc}`, content, {
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            replyTo: this._routingKey,
            headers: {
                'nameko.call_id_stack': [`node_proxy.call.${service}.${rpc}`],
            },
            correlationId,
        });

        const timeout = this.config.RPC_TIMEOUT;
        return new Promise((resolve, reject) => {
            const _completed = (error, result) => {
                delete this._waitingResponses[correlationId];
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            };
            let hasTimeout = false;
            const timer = setTimeout(() => {
                hasTimeout = true;
                _completed(new TimeoutError(`${service}.${rpc} call timeout`));
            }, timeout);
            this._waitingResponses[correlationId] = (error, result) => {
                if (timer) {
                    clearTimeout(timer);
                }
                if (!hasTimeout) {
                    _completed(error, result);
                }
            };
        });
    }
}

module.exports = ServiceProxies;
