import { serve } from '@hono/node-server';
import { createApp } from '../api/app.mjs';

const app = createApp();
const port = Number(process.env.API_PORT) || 8787;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`[API] http://localhost:${info.port} (base /api)`);
});
