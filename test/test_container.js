const amqplib = require('./mock_amqplib');
const { assert } = require('chai');

const ServiceContainer = require('../src/container');
const { getConfig } = require('../src/nameko');


describe('Service container', () => {
    afterEach(async () => {
        await amqplib.clearConnections();
    });

    it('should start with valid rpc config', async () => {
        const container = new ServiceContainer({
            name: 'my_service',
            rpc: {
                my_rpc_1: () => {},
                my_rpc_2: () => {},
            },
        }, getConfig());
        container.setup();
        await container.start(amqplib);
        assert.isNotNull(container._rpc);
        assert.includeMembers(
            Object.keys(amqplib.EXCHANGES),
            ['nameko-rpc', 'my_service.events'],
        );
    });

    it('should start with valid events config', async () => {
        const container = new ServiceContainer({
            name: 'my_service',
            events: {
                'service_1.action_1': async () => {},
                'service_2.action_2': async () => {},
            },
        }, getConfig());
        container.setup();
        await container.start(amqplib);
        assert.isNotNull(container._events);
        assert.includeMembers(
            Object.keys(amqplib.EXCHANGES),
            ['service_1.events', 'service_2.events', 'my_service.events'],
        );
    });

    it('should start with valid proxies config', async () => {
        const container = new ServiceContainer({
            name: 'my_service',
            proxies: [
                'service_a',
                'service_b',
            ],
        }, getConfig());
        container.setup();
        await container.start(amqplib);
        assert.isNotNull(container._proxies);
        assert.includeMembers(
            Object.keys(amqplib.EXCHANGES),
            ['nameko-rpc', 'my_service.events'],
        );
        assert.isFunction(container.rpc.service_a.action_a1);
    });
});
