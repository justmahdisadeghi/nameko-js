const amqplib = require("amqplib");
const uuid = require("uuid");

const {AMQP_URL} = require("./config");


const dispatchServiceEvent = async (serviceName, eventName, arg) => {
    const connection = await amqplib.connect(AMQP_URL);
    const channel = await connection.createChannel();

    const exchangeName = `${serviceName}.events`;
    console.log("Send to exchange ", exchangeName);
    await channel.assertExchange(exchangeName, "topic", {
        durable: true,
        autoDelete: true,
    });

    const content = new Buffer(arg);
    await channel.publish(exchangeName, eventName, content, {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        deliveryMode: 2,  // persistent
    });

    console.log("Message sent");
    setTimeout(() => {
        connection.close()
    }, 1000);
    //await connection.close()
};


(async function() {
    await dispatchServiceEvent("service_y", "ping", "hello-from-node.js");
})();