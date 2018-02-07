const amqplib = require('amqplib');
const { spawn } = require('child_process');
const path = require('path');
const { assert } = require('chai');

const ServiceContainer = require('../src/container');
const { getConfig } = require('../src/nameko');
const { waitFor } = require('./utils');


const SPAWNED = [];
const CONTAINERS = [];


function spawnProcess(name, args, options) {
    const result = spawn(name, args, options);
    SPAWNED.push(result);
    return result;
}


async function createContainer(data, config) {
    const result = new ServiceContainer(data, config);
    await result.setup().start(amqplib);
    CONTAINERS.push(result);
    return result;
}


describe('Python interoperability', () => {
    after(async () => {
        SPAWNED.forEach(s => s.kill('SIGKILL'));
        await Promise.all(CONTAINERS.map(async (c) => {
            if (c.status === 'running') {
                return c.stop();
            }
            return null;
        }));
    });

    it('should handle cross language services rpc call', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');
        const containerA = await createContainer({
            name: 'service_a',
            proxies: ['python_service_x'],
            rpc: {
                action_a: (arg) => {
                    arg.push('service_a.action_a');
                    return arg;
                },
            },
        }, getConfig());

        const pythonService = spawnProcess('nameko', ['run', 'service'], {
            cwd: path.join(__dirname, 'python'),
        });

        const started = new Promise((resolve) => {
            pythonService.stderr.on('data', (data) => {
                if (data.indexOf('Connected to amqp') !== -1) {
                    resolve();
                }
            });
        });
        await started;
        try {
            const resultA = await containerA.rpc.python_service_x.looping(['BEGIN']);
            assert.deepEqual(resultA, ['BEGIN', 'B', 'service_a.action_a', 'python_service_x.looping']);
        } finally {
            await pythonService.kill();
            await containerA.stop();
        }
    });

    it('should handle cross language event handling call', async () => {
        // const log = require('loglevel');
        // log.getLogger('nameko-js').setLevel('TRACE');
        const traces = [];
        const containerA = await createContainer({
            name: 'service_a',
            proxies: ['python_service_x'],
            rpc: {
                action_a: function actionA(arg) {
                    traces.push(`rpc.action_a-${arg}`);
                    return arg;
                },
            },
            events: {
                'python_service_x.ping': [
                    async function pythonServiceXPing(payload) {
                        traces.push(`event.ping-${payload}`);
                    }, 'BROADCAST'],
            },
        }, getConfig());

        const pythonService = spawnProcess('nameko', ['run', 'service'], {
            cwd: path.join(__dirname, 'python'),
        });
        const started = new Promise((resolve) => {
            pythonService.stderr.on('data', (data) => {
                if (data.indexOf('Connected to amqp') !== -1) {
                    resolve();
                }
            });
        });
        await started;
        try {
            await containerA.dispatchEvent('ping', 'service-A-payload');
            await waitFor(() => traces.length > 1);
            assert.includeMembers(traces, ['rpc.action_a-service-A-payload', 'event.ping-service-A-payload']);
        } finally {
            await pythonService.kill();
            await containerA.stop();
        }
    });
});
