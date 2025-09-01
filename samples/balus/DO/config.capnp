# This is the edge chat demo found at:
#
#     https://github.com/cloudflare/workers-chat-demo

using Workerd = import "/workerd/workerd.capnp";

# A constant of type `Workerd.Config` will be recognized as the top-level configuration.
const config :Workerd.Config = (
  # We have one nanoservice: the chat worker.
  services = [
    (name = "dev", worker = .devWorker),
    (name = "do-storage", disk = .doStorage),
  ],

  # We export it via HTTP on port 8080.
  sockets = [ ( name = "http", address = "*:8080", http = (), service = "dev" ) ],
);

const doStorage :Workerd.DiskDirectory = (
  path = "/tmp/cf-do",
  writable = true,
  allowDotfiles = true,
);

const devWorker :Workerd.Worker = (
  compatibilityDate = "2025-06-08",

  modules = [
    (name = "dev.js", esModule = embed "dev.js"),
  ],

  durableObjectNamespaces = [
    (className = "DevDO", uniqueKey = "210bd0cbd803ef7883a1ee9d86cce06e"),
  ],

  durableObjectStorage = (localDisk = "do-storage"),

  bindings = [
    (name = "do", durableObjectNamespace = "DevDO"),
  ],
);
