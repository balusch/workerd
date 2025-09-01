export class MyDurableObject {
  constructor(state, env) {
    this.storage = state.storage;
    this.sql = state.storage.sql;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/test-sql-transactions") {
      // Clear existing data
      await this.storage.deleteAll();

      // Method 1: Use SQLite's transaction detection
      const beforeState = this.getSQLiteState();

      // Coalesced writes
      this.storage.put("key1", "value1");
      this.storage.put("key2", "value2");
      this.storage.put("key3", "value3");

      const afterState = this.getSQLiteState();

      // Force completion of any pending transactions
      await new Promise(resolve => setTimeout(resolve, 10));

      const finalState = this.getSQLiteState();

      return new Response(JSON.stringify({
        beforeState,
        afterState,
        finalState
      }));
    }
  }

  getSQLiteState() {
    try {
      // Check if we're in a transaction
      const result = this.sql.exec("PRAGMA table_info(entries);");
      return {
        timestamp: Date.now(),
        tableExists: result.length > 0,
        canQuery: true
      };
    } catch (error) {
      return {
        timestamp: Date.now(),
        error: error.message,
        canQuery: false
      };
    }
  }
}
