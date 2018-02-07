const amqplib = require('./mock_amqplib');
const { assert } = require('chai');

const ServiceContainer = require('../src/container');
const { getConfig } = require('../src/nameko');
const { waitFor } = require('./utils');


describe('Service Event Dispatching + Listening', () => {
    afterEach(async () => {
        await amqplib.clearConnections();
    });

    it('should handle cross services event handling', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');
        // log.getLogger('mock-amqp').setLevel('TRACE');
        const traces = [];
        const containerA = new ServiceContainer({
            name: 'service_a',
            events: {
                'service_b.ping': [
                    async function serviceBPing(payload) {
                        traces.push(`A-${payload}`);
                    }, 'BROADCAST'],
            },
        }, getConfig());
        const containerB = new ServiceContainer({
            name: 'service_b',
            events: {
                'service_a.ping': [
                    async function serviceAPing(payload) {
                        traces.push(`B-${payload}`);
                    }, 'BROADCAST'],
            },
        }, getConfig());
        containerA.setup();
        containerB.setup();
        await containerA.start(amqplib);
        await containerB.start(amqplib);

        await containerA.dispatchEvent('ping', '001');
        await containerB.dispatchEvent('ping', '002');
        await waitFor(() => traces.length > 1);
        assert.includeMembers(traces, ['B-001', 'A-002']);
        await Promise.all([containerA.stop(), containerB.stop()]);
    });
});
