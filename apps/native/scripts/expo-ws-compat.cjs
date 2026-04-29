const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const exported = originalLoad.call(this, request, parent, isMain);

  if (
    request === "ws" &&
    exported &&
    typeof exported === "function" &&
    typeof exported.Server === "function" &&
    typeof exported.WebSocketServer !== "function"
  ) {
    exported.WebSocketServer = exported.Server;
  }

  return exported;
};
