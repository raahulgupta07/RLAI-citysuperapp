import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { apps, categories, appRoles } from '$lib/server/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ apps: [] });

  const userGroups: string[] = locals.user.ldap_groups || ['all'];
  const isAdmin = locals.user.role === 'super_admin';

  const allCategories = db.select().from(categories).orderBy(categories.sort_order).all();
  const catMap = new Map(allCategories.map(c => [c.id, c.name]));

  let result;
  if (isAdmin) {
    result = db.select().from(apps).where(eq(apps.status, 'active')).orderBy(apps.sort_order).all();
  } else {
    const roleMatches = db.select({ app_id: appRoles.app_id })
      .from(appRoles)
      .where(inArray(appRoles.ldap_group, [...userGroups, 'all']))
      .all();
    const appIds = [...new Set(roleMatches.map(r => r.app_id))].filter(Boolean) as number[];
    if (appIds.length === 0) {
      result = [];
    } else {
      result = db.select().from(apps)
        .where(and(eq(apps.status, 'active'), inArray(apps.id, appIds)))
        .orderBy(apps.sort_order).all();
    }
  }

  const appsWithCat = result.map(a => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    url: a.url,
    icon: a.icon,
    card_color: a.card_color,
    launch_mode: a.launch_mode,
    status: a.status,
    category_name: catMap.get(a.category_id!) || 'Other',
  }));

  return json({ apps: appsWithCat });
};
