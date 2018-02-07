import os
from nameko.rpc import rpc, RpcProxy
from nameko.events import SERVICE_POOL, BROADCAST, event_handler, EventDispatcher


class ServiceX:
    name = "python_service_x"
    dispatch = EventDispatcher()
    service_a = RpcProxy("service_a")

    @rpc
    def action_x(self, name, other):
        dispatcher.dispatch_event("ping", ["test"]);
        return "ok"

    @rpc
    def looping(self, arg):
        result = arg + self.service_a.action_a(["B"])
        return result + ["python_service_x.looping"]

    @event_handler("service_a", "ping", handler_type=BROADCAST, reliable_delivery=False)
    def a_ping(self, payload):
        result = self.service_a.action_a(payload)
        self.dispatch("ping", payload);
