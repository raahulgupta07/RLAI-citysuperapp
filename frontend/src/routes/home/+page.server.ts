import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { apps, categories, appRoles, favorites } from '$lib/server/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { apps: [], categories: [], favorites: [] };

  const userGroups: string[] = locals.user.ldap_groups || ['all'];
  const isAdmin = locals.user.role === 'super_admin';

  // Get all categories
  const allCategories = db.select().from(categories).orderBy(categories.sort_order).all();

  // Get all active apps with their roles
  let allApps;
  if (isAdmin) {
    // Super admin sees all active apps
    allApps = db.select({
      id: apps.id,
      name: apps.name,
      slug: apps.slug,
      description: apps.description,
      url: apps.url,
      icon: apps.icon,
      card_color: apps.card_color,
      launch_mode: apps.launch_mode,
      status: apps.status,
      sort_order: apps.sort_order,
      category_id: apps.category_id,
    }).from(apps)
      .where(eq(apps.status, 'active'))
      .orderBy(apps.sort_order)
      .all();
  } else {
    // Regular users see apps matching their LDAP groups
    const roleMatches = db.select({ app_id: appRoles.app_id })
      .from(appRoles)
      .where(inArray(appRoles.ldap_group, [...userGroups, 'all']))
      .all();

    const appIds = [...new Set(roleMatches.map(r => r.app_id))].filter(Boolean) as number[];

    if (appIds.length === 0) {
      allApps = [];
    } else {
      allApps = db.select({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        description: apps.description,
        url: apps.url,
        icon: apps.icon,
        card_color: apps.card_color,
        launch_mode: apps.launch_mode,
        status: apps.status,
        sort_order: apps.sort_order,
        category_id: apps.category_id,
      }).from(apps)
        .where(and(eq(apps.status, 'active'), inArray(apps.id, appIds)))
        .orderBy(apps.sort_order)
        .all();
    }
  }

  // Attach category names
  const catMap = new Map(allCategories.map(c => [c.id, c.name]));
  const appsWithCat = allApps.map(a => ({
    ...a,
    category_name: catMap.get(a.category_id!) || 'Other',
  }));

  // Get user favorites
  const userFavs = locals.user.id
    ? db.select({ app_id: favorites.app_id }).from(favorites).where(eq(favorites.user_id, locals.user.id)).all()
    : [];

  return {
    apps: appsWithCat,
    categories: allCategories,
    favoriteIds: userFavs.map(f => f.app_id),
  };
};
