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
</script>

<div class="app-card animate-fade-up">
  <div style="display: flex; align-items: flex-start; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span class="app-card-icon">{app.icon || '📦'}</span>
      <div>
        <div class="app-card-name">{app.name}</div>
      </div>
    </div>
    <span class="tag-label" class:tag-label-secondary={app.launch_mode === 'embed'}>
      {app.launch_mode === 'embed' ? 'EMBED' : 'REDIRECT'}
    </span>
  </div>

  <div class="app-card-desc">{app.description || 'No description'}</div>

  <div class="app-card-footer">
    <button onclick={handleLaunch} class="btn-primary">
      {app.launch_mode === 'embed' ? 'OPEN' : 'LAUNCH'} >
    </button>
    <button onclick={onToggleFav} class="fav-btn" title={isFavorite ? 'Remove favorite' : 'Add favorite'}>
      {isFavorite ? '★' : '☆'}
    </button>
  </div>
</div>
