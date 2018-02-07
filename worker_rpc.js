const amqplib = require("amqplib");
const {AMQP_URL, RPC_EXCHANGE} = require("./config");



const handleServiceRpc = async (service, rpc, args, kwargs) => {
    return 'node-js-' + args[0];
};


const run = async () => {
    const connection = await amqplib.connect(AMQP_URL);
    const channel = await connection.createChannel();
    const serviceName = "service_y";
    const queueName = `rpc-${serviceName}`;

    await channel.assertExchange(RPC_EXCHANGE, "topic", {durable: true});

    console.log("Waiting on exchange:", RPC_EXCHANGE);
    const consumer = await channel.consume(queueName, async (msg) => {
        if (msg !== null) {
            console.log("Message.properties :", msg.properties);
            console.log("Message.fields :", msg.fields);

            const params = JSON.parse(msg.content.toString());
            console.log("Message.content :", params);

            const routingKey = msg.fields.routingKey;
            const [service, rpc] = routingKey.split(".");
            const {correlationId, replyTo} = msg.properties;
            console.log(`Action on service '${service}' and method '${rpc}'`);
            const result = await handleServiceRpc(service, rpc, params.args || [], params.kwargs || {});
            const content = new Buffer(JSON.stringify({
                'result': result,
            }));
            // publish result
            await channel.publish(RPC_EXCHANGE, replyTo, content, {
                correlationId,
                contentType: 'application/json',
                contentEncoding: 'utf-8',
            });
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