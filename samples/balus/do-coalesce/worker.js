// worker.js - The main worker that receives requests
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Get or create a Durable Object instance
    const id = env.COALESCE_TEST_DO.idFromName("test-instance");
    const stub = env.COALESCE_TEST_DO.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  }
};

// Export the Durable Object class
export { CoalesceTestDO } from './coalesce-test-do.js';
