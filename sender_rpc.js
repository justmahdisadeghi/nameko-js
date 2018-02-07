const amqplib = require("amqplib");
const uuid = require("uuid");

const {AMQP_URL, RPC_EXCHANGE} = require("./config");


const callServiceRpc = async (service, rpc, args=[], kwargs={}) => {
    const connection = await amqplib.connect(AMQP_URL);
    const channel = await connection.createChannel();


    await channel.assertExchange(RPC_EXCHANGE, "topic", {durable: true});
    // create response queue
    const routingKey = uuid.v4();
    const responseQueue = `rpc.reply-node_rpc_proxy-${routingKey}`;
    await channel.assertQueue(responseQueue, {
        durable: false,
        autoDelete: true,
        exclusive: true,
    });
    await channel.bindQueue(responseQueue, RPC_EXCHANGE, routingKey);
    const consumer = await channel.consume(responseQueue, async (msg) => {
        if (msg !== null) {
            console.log("Result Message.properties :", msg.properties);
            console.log("Result Message.fields :", msg.fields);

            const params = JSON.parse(msg.content.toString());
            console.log("Result Message.content :", params);
            channel.ack(msg);
            setTimeout(() => {
                connection.close()
            }, 1000);
        }
    });
    console.log("consumer", consumer);
    const content = new Buffer(JSON.stringify({
        args,
        kwargs,
    }));
    const correlationId = uuid.v4();
    await channel.publish(RPC_EXCHANGE, `${service}.${rpc}`, content, {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        replyTo: routingKey,
        headers: {
            'nameko.call_id_stack': [`standalone_rpc_proxy.call.${service}.${rpc}`]
        },
        correlationId,
    });

    console.log("Message sent");

};


(async function() {
    await callServiceRpc("service_x", "do_something", ["sausage"], {});
})();