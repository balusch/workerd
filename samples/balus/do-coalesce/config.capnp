using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .mainWorker),
    (name = "do-storage", disk = .doStorage),
  ],

  sockets = [
    (name = "http", address = "*:9877", http = (), service = "main"),
  ],
);

const doStorage :Workerd.DiskDirectory = (
  path = "/tmp/cf-do-coalesce",
  writable = true,
  allowDotfiles = true,
);

const mainWorker :Workerd.Worker = (
  compatibilityDate = "2025-08-01",
  modules = [
    (name = "worker.js", esModule = embed "worker.js"),
    (name = "coalesce-test-do.js", esModule = embed "coalesce-test-do.js"),
  ],

  durableObjectNamespaces = [
    (className = "CoalesceTestDO", uniqueKey = "210bd0cbd803ef7883a1ee9d86cce06f"),
  ],

  durableObjectStorage = (localDisk = "do-storage"),

  bindings = [
    (name = "COALESCE_TEST_DO", durableObjectNamespace = "CoalesceTestDO"),
  ],
);
