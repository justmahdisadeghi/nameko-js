const amqplib = require('./mock_amqplib');
const { assert } = require('chai');
const log = require('loglevel');

const ServiceContainer = require('../src/container');
const { getConfig } = require('../src/nameko');


log.getLogger('nameko-js').setLevel('SILENT');


describe('Service Proxies + RPC', () => {
    afterEach(async () => {
        await amqplib.clearConnections();
    });

    it('should handle cross services rpc call', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');
        const containerA = new ServiceContainer({
            name: 'service_a',
            proxies: ['service_b'],
            rpc: {
                action_a: (name, other) => `testing-A-with-${name}+${other}`,
            },
        }, getConfig());
        const containerB = new ServiceContainer({
            name: 'service_b',
            proxies: ['service_a'],
            rpc: {
                action_b: (name, other) => `testing-B-with-${name}+${other}`,
            },
        }, getConfig());
        containerA.setup();
        containerB.setup();
        await containerA.start(amqplib);
        await containerB.start(amqplib);

        const resultA = await containerA.rpc.service_b.action_b('my-data', 'A');
        assert.equal(resultA, 'testing-B-with-my-data+A');

        const resultB = await containerB.rpc.service_a.action_a('my-data', 'B');
        assert.equal(resultB, 'testing-A-with-my-data+B');

        await Promise.all([containerA.stop(), containerB.stop()]);
    });

    it('should raise timeout if rpc proxy is not started', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');
        const containerA = new ServiceContainer({
            name: 'service_a',
            proxies: ['service_b'],
        }, { ...getConfig(), RPC_TIMEOUT: 500 });
        const containerB = new ServiceContainer({
            name: 'service_b',
        }, { ...getConfig(), RPC_TIMEOUT: 500 });
        containerA.setup();
        containerB.setup();
        await containerA.start(amqplib);
        await containerB.start(amqplib);
        try {
            await containerA.rpc.service_b.not_exists();
            assert(false, 'Should not send this rpc');
        } catch (ex) {
            assert.equal(ex.message, 'service_b.not_exists call timeout');
        }
    });

    it('should raise on unknown rpc proxy', async () => {
        const containerA = new ServiceContainer({
            name: 'service_a',
            proxies: ['service_b'],

        }, getConfig());
        const containerB = new ServiceContainer({
            name: 'service_b',
            rpc: {
                action_a: (name, other) => `testing-A-with-${name}+${other}`,
            },
        }, getConfig());
        containerA.setup();
        containerB.setup();
        await containerA.start(amqplib);
        await containerB.start(amqplib);
        try {
            await containerA.rpc.service_b.not_exists();
            assert(false, 'Should not send this rpc');
        } catch (ex) {
            assert.equal(ex.message, "Unknown rpc 'service_b.not_exists'");
        }
    });
});
