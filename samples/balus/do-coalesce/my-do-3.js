export class MyDurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/test-atomicity") {
      await this.storage.deleteAll();

      // Test: Coalesced writes should be atomic
      this.storage.put("counter", "0");
      this.storage.put("counter", "1");
      this.storage.put("counter", "2");
      this.storage.put("counter", "3");

      // Force a read from storage to ensure consistency
      const value = await this.storage.get("counter");

      return new Response(JSON.stringify({
        finalValue: value,
        atomic: value === "3" // Should see final value, not intermediate
      }));
    }

    if (url.pathname === "/test-non-atomic") {
      await this.storage.deleteAll();

      // Test: Non-coalesced writes might show intermediate states
      this.storage.put("counter", "0");
      await new Promise(resolve => setTimeout(resolve, 1)); // Break batching
      this.storage.put("counter", "1");
      await new Promise(resolve => setTimeout(resolve, 1)); // Break batching
      this.storage.put("counter", "2");

      const value = await this.storage.get("counter");

      return new Response(JSON.stringify({
        finalValue: value,
        separated: value === "2"
      }));
    }
  }
}
