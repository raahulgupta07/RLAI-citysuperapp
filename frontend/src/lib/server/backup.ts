import { mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', '..', '..', 'data', 'superapp.db');
const BACKUP_DIR = join(__dirname, '..', '..', '..', 'data', 'backups');
const MAX_BACKUPS = 10; // Keep last 10 backups

export function createBackup(reason: string = 'manual'): string | null {
  try {
    if (!existsSync(DB_PATH)) return null;

    mkdirSync(BACKUP_DIR, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `superapp_${timestamp}_${reason}.db`;
    const backupPath = join(BACKUP_DIR, filename);

    copyFileSync(DB_PATH, backupPath);

    // Cleanup old backups (keep last MAX_BACKUPS)
    cleanupOldBackups();

    return filename;
  } catch (e) {
    console.error('Backup failed:', e);
    return null;
  }
}

export function cleanupOldBackups() {
  try {
    if (!existsSync(BACKUP_DIR)) return;
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('superapp_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: statSync(join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    // Delete all beyond MAX_BACKUPS
    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUP_DIR, file.name));
    }
  } catch {}
}

export function listBackups(): { name: string; size: number; created: string }[] {
  try {
    if (!existsSync(BACKUP_DIR)) return [];
    return readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('superapp_') && f.endsWith('.db'))
      .map(f => {
        const stat = statSync(join(BACKUP_DIR, f));
        return { name: f, size: stat.size, created: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created.localeCompare(a.created));
  } catch { return []; }
}

export function restoreBackup(filename: string): boolean {
  try {
    const backupPath = join(BACKUP_DIR, filename);
    if (!existsSync(backupPath)) return false;

    // First backup current DB before restoring
    createBackup('pre-restore');

    copyFileSync(backupPath, DB_PATH);
    return true;
  } catch {
    return false;
  }
}
