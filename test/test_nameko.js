const amqplib = require('./mock_amqplib');
const { assert } = require('chai');

const nameko = require('../src/nameko');

const serviceTestModule = require('./example/spam_service');


describe('Nameko service runner', () => {
    afterEach(async () => {
        await amqplib.clearConnections();
    });

    it('should register service', async () => {
        const serviceRunner = await nameko.createServiceRunner({
            services: [serviceTestModule],
        });
        assert.isArray(serviceRunner.getServiceNames());
        assert.include(serviceRunner.getServiceNames(), 'spam_service');
        assert.equal(serviceRunner.status, 'stopped');
    });

    it('should start / stop services', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');

        const serviceRunner = await nameko.createServiceRunner({
            services: [serviceTestModule],
        });
        await serviceRunner.start(amqplib);
        assert.isArray(amqplib.getConnections());
        assert.lengthOf(amqplib.getConnections(), 1, 'Connection not created');
        await serviceRunner.stop();
        assert.lengthOf(amqplib.getConnections(), 0, 'Connection not closed');
    });
});
