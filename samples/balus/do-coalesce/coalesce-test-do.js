export class CoalesceTestDO {
  constructor(state, env) {
    this.storage = state.storage;
    this.sql = state.storage.sql;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Add CORS headers for browser testing
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let result;

      switch (path) {
        case '/test-coalescing':
          result = await this.testCoalescing();
          break;

        case '/test-non-coalescing':
          result = await this.testNonCoalescing();
          break;

        case '/test-storage-await-coalescing':
          result = await this.testStorageAwaitCoalescing();
          break;

        case '/test-real-async-breaks-coalescing':
          result = await this.testRealAsyncBreaksCoalescing();
          break;

        case '/test-all-coalescing-scenarios':
          result = await this.testAllCoalescingScenarios();
          break;

        case '/clear-all':
          await this.storage.deleteAll();
          result = { message: "All data cleared" };
          break;

        default:
          result = {
            error: "Unknown endpoint",
            availableEndpoints: [
              '/test-coalescing',
              '/test-non-coalescing',
              '/test-storage-await',
              '/test-real-async-breaks-coalescing',
              '/test-all-coalescing-scenarios',
              '/clear-all'
            ]
          };
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  async testCoalescing() {
    await this.storage.deleteAll();

    try {
      // These writes should be coalesced into one transaction
      this.storage.put("coalesced-1", "value1");
      this.storage.put("coalesced-2", "value2");
      this.storage.put("coalesced-3", "value3");

      // Throw an error before the transaction can commit
      throw new Error("Intentional error to test rollback");

    } catch (error) {
      // Now check if ANY of the writes persisted
      const results = await Promise.all([
        this.storage.get("coalesced-1"),
        this.storage.get("coalesced-2"),
        this.storage.get("coalesced-3")
      ]);

      const anyPersisted = results.some(v => v !== undefined);

      return {
        test: "coalescing-via-error",
        error: error.message,
        results: results.map(v => v !== undefined),
        anyPersisted: anyPersisted,
        // If coalesced: none should persist (transaction rolled back)
        // If not coalesced: some might persist (partial commits before error)
        coalesced: !anyPersisted,
        interpretation: anyPersisted ?
          "Some writes persisted - likely NOT coalesced" :
          "No writes persisted - likely coalesced and rolled back"
      };
    }
  }

  async testNonCoalescing() {
    await this.storage.deleteAll();
    console.log("storage cleared");

    try {
      // These writes should NOT be coalesced (async breaks batching)
      this.storage.put("separated-1", "value1");
      await new Promise(resolve => setTimeout(resolve, 10)); // Force transaction commit

      this.storage.put("separated-2", "value2");
      await new Promise(resolve => setTimeout(resolve, 10)); // Force transaction commit

      this.storage.put("separated-3", "value3");

      // Throw error - should only affect the last uncommitted write
      throw new Error("Intentional error to test separation");

    } catch (error) {
      const results = await Promise.all([
        this.storage.get("separated-1"),
        this.storage.get("separated-2"),
        this.storage.get("separated-3")
      ]);

      const persistedCount = results.filter(v => v !== undefined).length;

      return {
        test: "separation-via-error",
        error: error.message,
        results: results.map(v => v !== undefined),
        persistedCount: persistedCount,
        // If separated: first two should persist, last should not
        separated: persistedCount === 2,
        interpretation: persistedCount === 2 ?
          "First 2 writes persisted - likely separated transactions" :
          persistedCount === 0 ?
            "No writes persisted - unexpectedly coalesced" :
            `${persistedCount} writes persisted - unclear pattern`
      };
    }
  }

  async testStorageAwaitCoalescing() {
    await this.storage.deleteAll();
    console.log("storage cleared");

    try {
      // Our hypothesis: these should STILL be coalesced despite await
      this.storage.put("storage-await-1", "value1");
      await this.storage.put("storage-await-2", "value2"); // Synchronous operation
      this.storage.put("storage-await-3", "value3");

      throw new Error("Testing storage await coalescing");

    } catch (error) {
      const results = await Promise.all([
        this.storage.get("storage-await-1"),
        this.storage.get("storage-await-2"),
        this.storage.get("storage-await-3")
      ]);

      const anyPersisted = results.some(v => v !== undefined);

      return {
        test: "storage-await-coalescing",
        error: error.message,
        results: results.map(v => v !== undefined),
        anyPersisted: anyPersisted,
        // Our hypothesis: should still be coalesced (none persist)
        storageAwaitCoalesced: !anyPersisted,
        interpretation: anyPersisted ?
          "HYPOTHESIS WRONG: Storage await breaks coalescing" :
          "HYPOTHESIS CORRECT: Storage await preserves coalescing"
      };
    }
  }

  async testRealAsyncBreaksCoalescing() {
    await this.storage.deleteAll();
    console.log("storage cleared");

    try {
      this.storage.put("real-async-1", "value1");

      // Real async operation that should break coalescing
      await new Promise(resolve => setTimeout(resolve, 5));
      // OR: await fetch("https://httpbin.org/delay/0.001");

      this.storage.put("real-async-2", "value2");

      throw new Error("Testing real async breaks coalescing");

    } catch (error) {
      const results = await Promise.all([
        this.storage.get("real-async-1"),
        this.storage.get("real-async-2")
      ]);

      const persistedCount = results.filter(v => v !== undefined).length;

      return {
        test: "real-async-breaks-coalescing",
        error: error.message,
        results: results.map(v => v !== undefined),
        persistedCount: persistedCount,
        // Should have partial persistence (first write committed)
        asyncBrokeCoalescing: persistedCount === 1,
        interpretation: persistedCount === 1 ?
          "CONFIRMED: Real async breaks coalescing" :
          persistedCount === 0 ?
            "UNEXPECTED: No writes persisted" :
            "UNEXPECTED: All writes persisted"
      };
    }
  }

  async testAllCoalescingScenarios() {
    const results = {};

    // Test 1: Pure sync writes (should be coalesced)
    results.syncCoalescing = await this.testCoalescing();

    // Test 2: Writes separated by real async (should not be coalesced)
    results.asyncSeparation = await this.testNonCoalescing();

    // Test 3: Storage await (our hypothesis - should still be coalesced)
    results.storageAwait = await this.testStorageAwaitCoalescing();

    // Test 4: Real async operations (should break coalescing)
    results.realAsync = await this.testRealAsyncBreaksCoalescing();

    // Summary
    results.summary = {
      syncCoalesced: !results.syncCoalescing.anyPersisted,
      asyncSeparated: results.asyncSeparation.persistedCount === 2,
      storageAwaitStillCoalesced: !results.storageAwait.anyPersisted,
      realAsyncBrokeCoalescing: results.realAsync.persistedCount === 1,

      hypothesisValidated:
        !results.syncCoalescing.anyPersisted && // Sync should coalesce
        !results.storageAwait.anyPersisted &&   // Storage await should coalesce
        results.realAsync.persistedCount === 1   // Real async should break
    };

    return results;
  }
}
