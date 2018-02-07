const amqplib = require("amqplib");
const uuid = require("uuid");

const {AMQP_URL} = require("./config");


// defines service types
const SERVICE_POOL = "service_pool";
const SINGLETON = "singleton";
const BROADCAST = "broadcast";


function buildQueueName(eventType, sourceServiceName, eventName, serviceName, methodName) {
    if (eventType === SERVICE_POOL) {
        return `evt-${sourceServiceName}-${eventName}--${serviceName}.${methodName}`;
    } else if (eventType === SINGLETON) {
        return `evt-${sourceServiceName}-${eventName}`;
    } else if (eventType === BROADCAST) {
        const broadcastId = uuid.v4();
        return `evt-${sourceServiceName}-${eventName}--${serviceName}.${methodName}-${broadcastId}`;
    } else {
        throw Error(`Unknown event type '${eventType}'`);
    }
}


const run = async () => {
    const connection = await amqplib.connect(AMQP_URL);
    const channel = await connection.createChannel();

    const eventName = "spam";
    const methodName = "node_spam";
    const sourceServiceName = "service_x";
    const serviceName = "service_node";
    const exchangeName = `${sourceServiceName}.events`;
    const eventType = BROADCAST;

    await channel.assertExchange(exchangeName, "topic", {
        durable: true,
        autoDelete: true,
    });

    // check : https://github.com/nameko/nameko/blob/master/nameko/events.py#L224
    const eventQueue = buildQueueName(eventType, sourceServiceName, eventName, serviceName, methodName);
    await channel.assertQueue(eventQueue, {
        durable: true,
        autoDelete: true,
    });
    await channel.bindQueue(eventQueue, exchangeName, eventName);

    console.log("Waiting on exchange:", exchangeName);

    const consumer = await channel.consume(eventQueue, async (msg) => {
        if (msg !== null) {
            console.log("Message.properties :", msg.properties);
            console.log("Message.fields :", msg.fields);

            const params = msg.content.toString();
            console.log("Message.content :", params);
            await channel.ack(msg);
        }
    });
    console.log("consumer", consumer);
    console.log("CTRL-C to exit");
    process.on('SIGINT', function() {
        console.log("Interrupted by user");
        connection.close();
    });
};


(async function() {
    await run();
})();