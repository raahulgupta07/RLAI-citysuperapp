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
    ldap_groups: users.ldap_groups,
    last_login: users.last_login,
    created_at: users.created_at,
    is_active: users.is_active,
  }).from(users).orderBy(desc(users.last_login)).all();

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

  // ===== ANALYTICS =====
  const totalLaunches = db.select({ count: sql<number>`count(*)` }).from(appUsage).get();
  const totalActivities = db.select({ count: sql<number>`count(*)` }).from(activityLog).get();

  // Recent activity (last 100)
  const recentActivity = db.all(sql`
    SELECT a.*, u.username FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 100
  `);

  // Per-user stats
  const userStats = db.all(sql`
    SELECT u.username,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND action = 'login') as logins,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id AND action = 'app_launch') as launches,
      (SELECT COUNT(*) FROM activity_log WHERE user_id = u.id) as total_actions,
      (SELECT MAX(created_at) FROM activity_log WHERE user_id = u.id) as last_active
    FROM users u ORDER BY total_actions DESC
  `);

  // 1. Top 10 most launched apps
  const topApps = db.all(sql`
    SELECT a.name, a.icon, COUNT(au.id) as launches
    FROM app_usage au JOIN apps a ON au.app_id = a.id
    GROUP BY au.app_id ORDER BY launches DESC LIMIT 10
  `);

  // 2. App launches per day (last 30 days)
  const launchesPerDay = db.all(sql`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM app_usage WHERE created_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `);

  // 3. App launches per week (last 12 weeks)
  const launchesPerWeek = db.all(sql`
    SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
    FROM app_usage WHERE created_at >= datetime('now', '-84 days')
    GROUP BY week ORDER BY week
  `);

  // 4. Least used apps
  const leastUsedApps = db.all(sql`
    SELECT a.name, a.icon, COALESCE(c.launches, 0) as launches
    FROM apps a LEFT JOIN (SELECT app_id, COUNT(*) as launches FROM app_usage GROUP BY app_id) c ON a.id = c.app_id
    WHERE a.status = 'active' ORDER BY launches ASC LIMIT 10
  `);

  // 5. Embed vs Redirect usage
  const modeUsage = db.all(sql`
    SELECT a.launch_mode, COUNT(au.id) as count
    FROM app_usage au JOIN apps a ON au.app_id = a.id
    GROUP BY a.launch_mode
  `);

  // 6. Launches by category
  const launchesByCategory = db.all(sql`
    SELECT c.name as category, COUNT(au.id) as count
    FROM app_usage au JOIN apps a ON au.app_id = a.id
    LEFT JOIN categories c ON a.category_id = c.id
    GROUP BY c.name ORDER BY count DESC
  `);

  // 7. Launch heatmap by hour
  const launchesByHour = db.all(sql`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM app_usage GROUP BY hour ORDER BY hour
  `);

  // 8. New apps added over time
  const appsOverTime = db.all(sql`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM apps GROUP BY day ORDER BY day
  `);

  // 9. Disabled vs active apps
  const appStatusCounts = db.all(sql`
    SELECT status, COUNT(*) as count FROM apps GROUP BY status
  `);

  // 10-11. Active users (7d, 30d)
  const activeUsers7d = db.get(sql`
    SELECT COUNT(DISTINCT user_id) as count FROM activity_log
    WHERE action = 'login' AND created_at >= datetime('now', '-7 days')
  `);
  const activeUsers30d = db.get(sql`
    SELECT COUNT(DISTINCT user_id) as count FROM activity_log
    WHERE action = 'login' AND created_at >= datetime('now', '-30 days')
  `);

  // 12. New users per week
  const newUsersPerWeek = db.all(sql`
    SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
    FROM users GROUP BY week ORDER BY week
  `);

  // 13. Users by auth method
  const usersByAuth = db.all(sql`
    SELECT COALESCE(auth_source, 'local') as auth, COUNT(*) as count
    FROM users GROUP BY auth
  `);

  // 14. Users by role
  const usersByRole = db.all(sql`
    SELECT role, COUNT(*) as count FROM users GROUP BY role
  `);

  // 15. Top 10 most active users (already in userStats, just take top 10)

  // 16. Users who never launched an app
  const usersNoLaunches = db.get(sql`
    SELECT COUNT(*) as count FROM users
    WHERE id NOT IN (SELECT DISTINCT user_id FROM app_usage WHERE user_id IS NOT NULL)
  `);

  // 17-18. Averages
  const avgLogins = db.get(sql`
    SELECT ROUND(AVG(cnt), 1) as avg FROM (
      SELECT COUNT(*) as cnt FROM activity_log WHERE action = 'login' GROUP BY user_id
    )
  `);
  const avgLaunches = db.get(sql`
    SELECT ROUND(AVG(cnt), 1) as avg FROM (
      SELECT COUNT(*) as cnt FROM app_usage GROUP BY user_id
    )
  `);

  // 19. User retention (logged in more than once)
  const retainedUsers = db.get(sql`
    SELECT COUNT(*) as count FROM (
      SELECT user_id FROM activity_log WHERE action = 'login' GROUP BY user_id HAVING COUNT(*) > 1
    )
  `);

  // 20. Disabled vs active users
  const userStatusCounts = db.all(sql`
    SELECT COALESCE(status, 'active') as status, COUNT(*) as count FROM users GROUP BY status
  `);

  // 21. Logins per day (last 30 days)
  const loginsPerDay = db.all(sql`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM activity_log WHERE action = 'login' AND created_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `);

  // 24. Peak usage days (by weekday)
  const loginsByWeekday = db.all(sql`
    SELECT CASE CAST(strftime('%w', created_at) AS INTEGER)
      WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
      WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat' END as weekday,
      CAST(strftime('%w', created_at) AS INTEGER) as day_num,
      COUNT(*) as count
    FROM activity_log WHERE action = 'login'
    GROUP BY day_num ORDER BY day_num
  `);

  // 27. Activity breakdown
  const activityBreakdown = db.all(sql`
    SELECT action, COUNT(*) as count FROM activity_log GROUP BY action ORDER BY count DESC
  `);

  // 26. Actions today / this week / this month
  const actionsToday = db.get(sql`
    SELECT COUNT(*) as count FROM activity_log WHERE DATE(created_at) = DATE('now')
  `);
  const actionsThisWeek = db.get(sql`
    SELECT COUNT(*) as count FROM activity_log WHERE created_at >= datetime('now', '-7 days')
  `);
  const actionsThisMonth = db.get(sql`
    SELECT COUNT(*) as count FROM activity_log WHERE created_at >= datetime('now', '-30 days')
  `);

  // 35. Table record counts
  const tableCounts = {
    users: db.get(sql`SELECT COUNT(*) as c FROM users`)?.c || 0,
    apps: db.get(sql`SELECT COUNT(*) as c FROM apps`)?.c || 0,
    categories: db.get(sql`SELECT COUNT(*) as c FROM categories`)?.c || 0,
    app_usage: db.get(sql`SELECT COUNT(*) as c FROM app_usage`)?.c || 0,
    activity_log: db.get(sql`SELECT COUNT(*) as c FROM activity_log`)?.c || 0,
    favorites: db.get(sql`SELECT COUNT(*) as c FROM favorites`)?.c || 0,
    sso_users: db.get(sql`SELECT COUNT(*) as c FROM sso_users`)?.c || 0,
  };

  // 36. Apps with zero launches
  const appsZeroLaunches = db.get(sql`
    SELECT COUNT(*) as count FROM apps
    WHERE status = 'active' AND id NOT IN (SELECT DISTINCT app_id FROM app_usage WHERE app_id IS NOT NULL)
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
      topApps: topApps || [],
      leastUsedApps: leastUsedApps || [],
      launchesPerDay: launchesPerDay || [],
      launchesPerWeek: launchesPerWeek || [],
      modeUsage: modeUsage || [],
      launchesByCategory: launchesByCategory || [],
      launchesByHour: launchesByHour || [],
      appsOverTime: appsOverTime || [],
      appStatusCounts: appStatusCounts || [],
      activeUsers7d: (activeUsers7d as any)?.count || 0,
      activeUsers30d: (activeUsers30d as any)?.count || 0,
      newUsersPerWeek: newUsersPerWeek || [],
      usersByAuth: usersByAuth || [],
      usersByRole: usersByRole || [],
      usersNoLaunches: (usersNoLaunches as any)?.count || 0,
      avgLogins: (avgLogins as any)?.avg || 0,
      avgLaunches: (avgLaunches as any)?.avg || 0,
      retainedUsers: (retainedUsers as any)?.count || 0,
      userStatusCounts: userStatusCounts || [],
      loginsPerDay: loginsPerDay || [],
      loginsByWeekday: loginsByWeekday || [],
      activityBreakdown: activityBreakdown || [],
      actionsToday: (actionsToday as any)?.count || 0,
      actionsThisWeek: (actionsThisWeek as any)?.count || 0,
      actionsThisMonth: (actionsThisMonth as any)?.count || 0,
      tableCounts,
      appsZeroLaunches: (appsZeroLaunches as any)?.count || 0,
    },
    securityWarnings: {
      defaultPassword: (process.env.SUPER_ADMIN_PASS || 'admin') === 'admin',
      defaultJwt: (process.env.JWT_SECRET || '') === 'superapp-secret-change-me-in-prod',
    },
  };
};
