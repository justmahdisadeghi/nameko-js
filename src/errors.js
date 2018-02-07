class InvalidStateError extends Error {}

class ValueError extends Error {}

class TimeoutError extends Error {}

class UnknownRpcError extends Error {
    constructor(service, rpc) {
        super(`Unknown rpc '${service}.${rpc}'`);
    }
}

class RpcError extends Error {
    constructor(namekoError) {
        super(namekoError.value);
        this.remoteType = namekoError.exc_type;
        this.remoteArgs = namekoError.exc_args;
    }
}

module.exports = {
    InvalidStateError,
    ValueError,
    UnknownRpcError,
    TimeoutError,
    RpcError,
};
