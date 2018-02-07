const nameko = require("./src/nameko");


const service = {
    name: "spam_service",
    proxies: ["service_x"],
    rpc: {
        "call_me": async function (name){
            console.log(`service '${this.serviceName}' rpc call_me called with parameters: ${name}`);
            await this.dispatchEvent("spam", ["sausage"]);
            return name + " + from node";
        }
    },
    events: {
        "other_service.ping": [
            async function (payload) {
                console.log(`service '${this.serviceName}' event called with payload: ${payload}`);
                this.rpc.service_x.do_something("my-data");
            }, "BROADCAST"]
    }
};


async function main() {
    const serviceRunner = await nameko.createServiceRunner({
        services: [service],
    });
    serviceRunner.setup();
    await serviceRunner.start();
    console.log("CTRL-C to exit");
    process.on('SIGINT', async function() {
        console.log("Interrupted by user");
        await serviceRunner.stop();
    });
};


(async function() {
    try {
        await main();
    } catch (ex) {
        console.log("Error", ex);
    }
})();