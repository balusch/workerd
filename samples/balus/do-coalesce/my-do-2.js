export class MyDurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/test-transaction-failure") {
      try {
        // These writes should be coalesced
        this.storage.put("key1", "value1");
        this.storage.put("key2", "value2");

        // Force an error that should rollback the transaction
        throw new Error("Intentional error");

      } catch (error) {
        // Check if BOTH writes were rolled back (indicating coalescing)
        const key1Exists = await this.storage.get("key1") !== undefined;
        const key2Exists = await this.storage.get("key2") !== undefined;

        return new Response(JSON.stringify({
          key1Exists,
          key2Exists,
          coalesced: !key1Exists && !key2Exists // Both should be rolled back
        }));
      }
    }

    if (url.pathname === "/test-async-transaction-failure") {
      try {
        this.storage.put("async1", "value1");
        await new Promise(resolve => setTimeout(resolve, 1)); // Break coalescing
        this.storage.put("async2", "value2");

        throw new Error("Intentional error");

      } catch (error) {
        const async1Exists = await this.storage.get("async1") !== undefined;
        const async2Exists = await this.storage.get("async2") !== undefined;

        return new Response(JSON.stringify({
          async1Exists, // Should be true (first transaction committed)
          async2Exists, // Should be false (second transaction rolled back)
          separated: async1Exists && !async2Exists
        }));
      }
    }
  }
}
