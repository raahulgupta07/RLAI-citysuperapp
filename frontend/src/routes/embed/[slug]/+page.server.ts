import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { apps } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
  const app = db.select().from(apps).where(eq(apps.slug, params.slug)).get();
  if (!app) throw error(404, 'App not found');
  return { app };
};
