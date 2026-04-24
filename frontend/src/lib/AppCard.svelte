<script lang="ts">
  interface App {
    id: number;
    name: string;
    slug: string;
    description: string;
    url: string;
    icon: string;
    card_color: string;
    launch_mode: string;
    status: string;
    category_name?: string;
  }

  let { app, isFavorite = false, onToggleFav = () => {}, onLaunch = () => {} }: {
    app: App;
    isFavorite?: boolean;
    onToggleFav?: () => void;
    onLaunch?: () => void;
  } = $props();

  function handleLaunch() {
    onLaunch();
    if (app.launch_mode === 'embed') {
      window.location.href = `/embed/${app.slug}`;
    } else {
      window.open(app.url, '_blank');
    }
  }

  function getDomain(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
  }
</script>

<div class="app-card animate-fade-up" style="border-left: 4px solid {app.card_color || '#007518'};">
  <!-- Header: Icon + Name + Mode Tag -->
  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 32px; line-height: 1;">{app.icon || '📦'}</span>
      <div>
        <div class="app-card-name">{app.name}</div>
        <div style="font-size: 9px; color: var(--color-on-surface-dim); letter-spacing: 0.04em; margin-top: 2px;">
          {getDomain(app.url)}
        </div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
      <span class="tag-label" class:tag-label-secondary={app.launch_mode === 'embed'}>
        {app.launch_mode === 'embed' ? 'EMBED' : 'REDIRECT'}
      </span>
      {#if app.category_name}
        <span style="font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-on-surface-dim);">
          {app.category_name}
        </span>
      {/if}
    </div>
  </div>

  <!-- Description -->
  <div class="app-card-desc" style="margin-top: 8px; min-height: 32px;">
    {app.description || 'No description available'}
  </div>

  <!-- Footer: Launch + Favorite -->
  <div class="app-card-footer" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--color-on-surface); opacity: 0.15;"></div>
  <div class="app-card-footer">
    <button onclick={handleLaunch} class="btn-primary">
      {app.launch_mode === 'embed' ? 'OPEN' : 'LAUNCH'} &gt;
    </button>
    <button onclick={onToggleFav} class="fav-btn" title={isFavorite ? 'Remove favorite' : 'Add favorite'}>
      {isFavorite ? '★' : '☆'}
    </button>
  </div>
</div>
