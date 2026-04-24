import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBackup, listBackups, restoreBackup } from '$lib/server/backup';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  return json({ backups: listBackups() });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') return json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  if (body.action === 'restore' && body.filename) {
    const success = restoreBackup(body.filename);
    if (success) return json({ ok: true, message: 'Database restored. Restart the server to apply.' });
    return json({ error: 'Restore failed' }, { status: 500 });
  }

  const filename = createBackup('manual');
  if (filename) return json({ ok: true, filename });
  return json({ error: 'Backup failed' }, { status: 500 });
};
