const { InvalidStateError, ValueError } = require('./errors');
const logger = require('loglevel').getLogger('nameko-js');
const ServiceContainer = require('./container');
const { asyncMap } = require('./utils');


const STOPPED = 'stopped';
const STARTING = 'starting';
const RUNNING = 'running';
const STOPPING = 'stopping';
const ERROR = 'error';


class ServiceRunner {
    constructor(config) {
        this.config = config;
        this.status = STOPPED;
        this.services = {};
        this.containers = {};
    }

    addService(service) {
        if (this.status !== STOPPED) {
            throw new InvalidStateError('Cannot add service on a non stopped runner');
        }
        if (!service.name) {
            throw new ValueError("Service has no property 'name'");
        }
        if (this.services[service.name]) {
            throw new ValueError(`Service '${service.name}' already registered`);
        }
        this.services[service.name] = service;
    }

    getServiceNames() {
        return Object.keys(this.services);
    }

    getServiceContainer(serviceName) {
        return this.containers[serviceName];
    }

    getServiceInfo(serviceName) {
        return this.services[serviceName];
    }

    setup() {
        Object.keys(this.services).forEach((k) => {
            const service = this.services[k];
            const container = new ServiceContainer(service, this.config);
            container.setup();
            this.containers[k] = container;
        });
    }

    async start(amqplib) {
        if (this.status !== STOPPED) {
            throw new InvalidStateError('Service is not stopped');
        }
        logger.debug('Starting service runner');
        try {
            this.status = STARTING;
            this.setup();
            await asyncMap(Object.keys(this.containers), async (k) => {
                const container = this.containers[k];
                try {
                    await container.start(amqplib);
                    logger.info(`Service '${k}' started`);
                } catch (ex) {
                    logger.error(`Unable to start service '${k}'`, ex);
                }
            });
            this.status = RUNNING;
        } catch (ex) {
            logger.error('Error while starting service runner', ex);
            this.status = ERROR;
        }
        logger.debug('Service runner started');
    }

    async stop() {
        if (this.status !== RUNNING) {
            throw new InvalidStateError('Service is not running');
        }
        logger.debug('Stopping service runner');
        this.status = STOPPING;
        await asyncMap(Object.keys(this.containers), async (k) => {
            const container = this.containers[k];
            try {
                await container.stop();
                logger.info(`Service '${k}' stopped`);
            } catch (ex) {
                logger.error(`Unable to stop service '${k}'`, ex);
            }
        });
        this.status = STOPPED;
        logger.debug('Service runner stopped');
    }
}

module.exports = ServiceRunner;
