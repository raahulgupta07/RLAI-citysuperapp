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

  let showInfo = $state(false);

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

<div class="app-card animate-fade-up" style="border-left: 4px solid {app.card_color || '#007518'}; position: relative;">
  <!-- Info button -->
  <button
    class="info-btn"
    onclick={(e) => { e.stopPropagation(); showInfo = !showInfo; }}
    title="Show full description"
  >i</button>

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
    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-right: 20px;">
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

  <!-- Description (max 2 lines, truncated) -->
  <div class="app-card-desc" style="margin-top: 8px; min-height: 32px; max-height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
    {app.description || 'No description available'}
  </div>

  <!-- Info popup (full description) -->
  {#if showInfo}
    <div class="info-popup" onclick={() => showInfo = false}>
      <div class="info-popup-header">
        <span>{app.icon} {app.name}</span>
        <button onclick={() => showInfo = false} style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px;">x</button>
      </div>
      <div class="info-popup-body">
        <div style="margin-bottom: 8px;">{app.description || 'No description available'}</div>
        <div class="info-row"><span class="info-label">URL</span> <span>{app.url}</span></div>
        <div class="info-row"><span class="info-label">MODE</span> <span>{app.launch_mode}</span></div>
        {#if app.category_name}
          <div class="info-row"><span class="info-label">CATEGORY</span> <span>{app.category_name}</span></div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Footer: Launch + Favorite -->
  <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--color-on-surface); opacity: 0.15;"></div>
  <div class="app-card-footer">
    <button onclick={handleLaunch} class="btn-primary">
      {app.launch_mode === 'embed' ? 'OPEN' : 'LAUNCH'} &gt;
    </button>
    <button onclick={onToggleFav} class="fav-btn" title={isFavorite ? 'Remove favorite' : 'Add favorite'}>
      {isFavorite ? '★' : '☆'}
    </button>
  </div>
</div>

<style>
  .info-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 18px;
    height: 18px;
    background: var(--color-on-surface);
    color: var(--color-surface);
    border: none;
    font-family: 'Space Grotesk', monospace;
    font-size: 11px;
    font-weight: 900;
    font-style: italic;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.4;
    transition: opacity 0.1s;
  }

  .info-btn:hover {
    opacity: 1;
  }

  .info-popup {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 2px solid var(--color-on-surface);
    border-right-width: 4px;
    border-bottom-width: 4px;
    box-shadow: 4px 4px 0px 0px var(--color-on-surface);
    z-index: 10;
    animation: fadeUp 0.15s ease-out;
  }

  .info-popup-header {
    background: var(--color-on-surface);
    color: var(--color-surface);
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .info-popup-body {
    padding: 12px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--color-on-surface);
  }

  .info-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
    font-size: 10px;
  }

  .info-label {
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-on-surface-dim);
    min-width: 65px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
