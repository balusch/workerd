import { DurableObject } from "cloudflare:workers";

export default {
  async fetch(request, env) {
    let id = env.do.idFromName("foo");
    return await env.do.get(id).fetch(request);
  },
};

const SECONDS = 5;

export class DevDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.ctx = ctx;
    this.storage = ctx.storage;
  }
  async fetch(request) {
    // If there is no alarm currently set, set one for 10 seconds from now
    let currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      return new Response("alarm is null")
      this.storage.setAlarm(Date.now() + 10 * SECONDS);
    } else {
      return new Response("alarm is non-null")
    }
  }
  async alarm() {
    // The alarm handler will be invoked whenever an alarm fires.
    // You can use this to do work, read from the Storage API, make HTTP calls
    // and set future alarms to run using this.storage.setAlarm() from within this handler.
    console.log("alarm is called")
  }
}
