const logger = require('loglevel').getLogger('nameko-js');
const { UnknownRpcError, InvalidStateError } = require('./errors');


class RpcHandler {
    constructor(serviceName, rpcInfo, config) {
        this.serviceName = serviceName;
        this.config = config;
        this.rpcInfo = rpcInfo;
        this._consumer = null;
        this._channel = null;
        this.container = null;
    }

    setup(container) {
        this.container = container;
    }

    async _handleMessage(rpc, args, kwargs) {
        const rpcInfo = this.rpcInfo[rpc];
        if (!rpcInfo) {
            throw new UnknownRpcError(this.serviceName, rpc);
        }
        if (Object.keys(kwargs).length > 0) {
            // little trick to match kwargs from python, if any...
            return rpcInfo.apply(this.container, [args, kwargs]);
        }
        return rpcInfo.apply(this.container, args);
    }

    async start(channel) {
        if (this._channel) {
            throw new InvalidStateError('Rpc consumer already set');
        }
        this._channel = channel;
        const rpcExchange = this.config.RPC_EXCHANGE;
        const queueName = `rpc-${this.serviceName}`;
        await this._channel.assertQueue(queueName, {
            durable: true,
            autoDelete: true,
        });
        await this._channel.assertExchange(rpcExchange, 'topic', {
            durable: true,
        });
        await this._channel.bindQueue(queueName, rpcExchange, `${this.serviceName}.*`);
        this._consumer = await this._channel.consume(queueName, async (msg) => {
            if (msg !== null) {
                const params = JSON.parse(msg.content.toString());
                const { routingKey } = msg.fields;
                const [service, rpc] = routingKey.split('.');
                const { correlationId, replyTo } = msg.properties;

                logger.debug(`Receive rpc message ${service}.${rpc} - ${correlationId}`);

                if (service !== this.serviceName) {
                    logger.warn(`Message service name '${service}' does not match local service '${this.serviceName}'`);
                }

                let content = null;
                try {
                    const result = await this._handleMessage(
                        rpc,
                        params.args || [],
                        params.kwargs || {},
                    );
                    content = Buffer.from(JSON.stringify({
                        error: null,
                        result,
                    }));
                } catch (ex) {
                    logger.error(`Error while handling rpc '${service}.${rpc}'`, ex);
                    content = Buffer.from(JSON.stringify({
                        error: {
                            exc_type: ex.constructor.name,
                            exc_args: params,
                            value: ex.message,
                        },
                        result: null,
                    }));
                }
                // publish result
                await this._channel.publish(rpcExchange, replyTo, content, {
                    correlationId,
                    contentType: 'application/json',
                    contentEncoding: 'utf-8',
                });
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


module.exports = RpcHandler;
