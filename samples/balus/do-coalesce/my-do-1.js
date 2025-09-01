export class MyDurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/test-lock-contention") {
      // Start a transaction that should block other operations
      const txn = await this.storage.transaction(async (txn) => {
        txn.put("test-key", "initial-value");

        // In a separate promise, try to access storage
        // This should be blocked if writes are in same transaction
        const concurrentAccess = this.testConcurrentAccess();

        // Wait a bit to let concurrent access attempt
        await new Promise(resolve => setTimeout(resolve, 10));

        txn.put("test-key", "final-value");

        return await concurrentAccess;
      });

      return new Response(JSON.stringify({ result: txn }));
    }
  }

  async testConcurrentAccess() {
    try {
      // If previous writes are coalesced, this might be blocked
      const value = await this.storage.get("test-key");
      return { accessed: true, value };
    } catch (error) {
      return { accessed: false, error: error.message };
    }
  }
}
