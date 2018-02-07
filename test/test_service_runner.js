const ServiceRunner  = require('../src/service_runner');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { expect, assert } = chai;


describe('Service runner', () => {
    it('should raise on bad config object', async () => {
        const runner = new ServiceRunner();
        expect(() => runner.addService({})).to.throw("Service has no property 'name'");
    });

    it('should raise when a service is registered twice', async () => {
        const runner = new ServiceRunner();
        runner.addService({
            name: "test_service",
        });
        expect(() => runner.addService({
            name: "test_service",
        })).to.throw("Service 'test_service' already registered");
    });

    it('should raise when a service is registered twice', async () => {
        const runner = new ServiceRunner();
        runner.addService({
            name: "test_service",
        });
        expect(() => runner.addService({
            name: "test_service",
        })).to.throw("Service 'test_service' already registered");
    });

    it('should raise when adding a service on a started runner', async () => {
        const runner = new ServiceRunner();
        await runner.start();
        expect(() => runner.addService({
            name: "test_service",
        })).to.throw('Cannot add service on a non stopped runner');
    });

    it('should raise when trying to run a runner twice', async () => {
        const runner = new ServiceRunner();
        await runner.start();
        assert.equal(runner.status, 'running');
        // (await runner.start()).should.be.rejectedWith(Error, 'Service is not stopped');
        expect((await runner.start())).to.throw('Service is not stopped');
    });
});
