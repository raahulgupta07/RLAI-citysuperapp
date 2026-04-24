<script lang="ts">
  import { page } from '$app/state';
</script>

<div style="display: flex; align-items: center; justify-content: center; height: calc(100vh - 48px); font-family: 'Space Grotesk', monospace;">
  <div style="text-align: center;">
    <div style="font-size: 48px; font-weight: 900; color: var(--color-error);">{page.status}</div>
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim); margin-top: 8px;">
      {page.error?.message || 'Page not found'}
    </div>
    <a href="/home" class="btn-primary" style="display: inline-block; margin-top: 16px; text-decoration: none;">
      > BACK TO HOME
    </a>
  </div>
</div>
