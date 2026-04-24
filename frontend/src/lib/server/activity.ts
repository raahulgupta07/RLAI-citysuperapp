import { db } from './db.js';
import { activityLog } from './schema.js';

export function logActivity(params: {
  user_id: number;
  action: string; // login, logout, app_launch, app_embed, page_view
  detail?: string;
  app_id?: number;
  ip_address?: string;
  user_agent?: string;
}) {
  try {
    db.insert(activityLog).values({
      user_id: params.user_id,
      action: params.action,
      detail: params.detail || '',
      app_id: params.app_id || null,
      ip_address: params.ip_address || '',
      user_agent: params.user_agent || '',
    }).run();
  } catch {
    // Don't fail if logging fails
  }
}
