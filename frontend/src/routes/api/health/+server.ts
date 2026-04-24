import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { sql } from 'drizzle-orm';

const startTime = Date.now();

export const GET: RequestHandler = async () => {
  try {
    // Quick DB check
    const result = db.select({ count: sql<number>`count(*)` }).from(users).get();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return json({
      status: 'ok',
      uptime: uptimeSeconds,
      database: 'connected',
      users: result?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return json({
      status: 'error',
      database: 'disconnected',
      error: e.message,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
};
