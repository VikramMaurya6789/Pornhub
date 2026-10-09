import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Default config is fine for this app.
  // D1 binding "DB" is declared in wrangler.jsonc and accessed at runtime
  // via getCloudflareContext().env.DB (see lib/d1.js).
});
