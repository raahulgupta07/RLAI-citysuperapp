import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { apps, categories, users, appRoles, appUsage, activityLog } from '$lib/server/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') {
    throw redirect(302, '/home');
  }

  const allApps = db.select({
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
    created_at: apps.created_at,
  }).from(apps).orderBy(apps.sort_order).all();

  const allCategories = db.select().from(categories).orderBy(categories.sort_order).all();
  const allUsers = db.select({
    id: users.id,
    username: users.username,
    display_name: users.display_name,
    email: users.email,
    role: users.role,
    auth_source: users.auth_source,
    status: users.status,
    last_login: users.last_login,
  }).from(users).orderBy(desc(users.last_login)).all();

  // Get roles for each app
  const allRoles = db.select().from(appRoles).all();
  const roleMap = new Map<number, string[]>();
  for (const r of allRoles) {
    if (!r.app_id) continue;
    if (!roleMap.has(r.app_id)) roleMap.set(r.app_id, []);
    roleMap.get(r.app_id)!.push(r.ldap_group);
  }

  const appsWithRoles = allApps.map(a => ({
    ...a,
    category_name: allCategories.find(c => c.id === a.category_id)?.name || '',
    roles: roleMap.get(a.id) || [],
  }));

  // Basic analytics
  const totalLaunches = db.select({ count: sql<number>`count(*)` }).from(appUsage).get();

  // Total activities
  const totalActivities = db.select({ count: sql<number>`count(*)` }).from(activityLog).get();

  // Recent activity (last 50)
  const recentActivity = db.all(sql`
    SELECT a.*, u.username
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `);

  // Per-user stats
  const userStats = db.all(sql`
    SELECT
      u.username,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND action = 'login') as logins,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND action = 'app_launch') as launches,
      (SELECT MAX(created_at) FROM activity_log WHERE user_id = u.id) as last_active
    FROM users u
    ORDER BY last_active DESC
  `);

  return {
    apps: appsWithRoles,
    categories: allCategories,
    users: allUsers,
    analytics: {
      totalLaunches: totalLaunches?.count || 0,
      totalActivities: totalActivities?.count || 0,
      recentActivity: recentActivity || [],
      userStats: userStats || [],
    },
  };
};
