import { handle } from 'hono/vercel';
import { createApp } from './app.mjs';

export const config = {
  runtime: 'nodejs',
};

export default handle(createApp());
