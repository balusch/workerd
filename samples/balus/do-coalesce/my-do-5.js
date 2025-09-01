export class MyDurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/test-overwrite-coalescing") {
      await this.storage.deleteAll();

      // Test: Multiple puts to same key should show final value atomically
      this.storage.put("test", "value1");
      this.storage.put("test", "value2");
      this.storage.put("test", "value3");

      // Immediate read - should see final value if coalesced
      const immediateValue = await this.storage.get("test");

      return new Response(JSON.stringify({
        immediateValue,
        coalesced: immediateValue === "value3"
      }));
    }

    if (url.pathname === "/test-delete-coalescing") {
      await this.storage.deleteAll();

      // Test: put then delete should result in key not existing
      this.storage.put("test", "value");
      this.storage.delete("test");

      const exists = await this.storage.get("test") !== undefined;

      return new Response(JSON.stringify({
        keyExists: exists,
        coalesced: !exists // Should be false if coalesced
      }));
    }

    if (url.pathname === "/test-mixed-operations-coalescing") {
      await this.storage.deleteAll();

      // Test complex coalescing with puts and deletes
      this.storage.put("key1", "value1");
      this.storage.put("key2", "value2");
      this.storage.delete("key1");
      this.storage.put("key3", "value3");

      const results = await Promise.all([
        this.storage.get("key1"),
        this.storage.get("key2"),
        this.storage.get("key3")
      ]);

      return new Response(JSON.stringify({
        key1Exists: results[0] !== undefined,
        key2Exists: results[1] !== undefined,
        key3Exists: results[2] !== undefined,
        expectedPattern: !results[0] && results[1] && results[2] // key1 deleted, others exist
      }));
    }
  }
}
