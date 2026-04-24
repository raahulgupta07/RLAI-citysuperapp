<script lang="ts">
  let { data } = $props();
  let loaded = $state(false);
  let loadStep = $state(0);

  import { onMount } from 'svelte';

  onMount(async () => {
    for (let i = 1; i <= 3; i++) {
      loadStep = i;
      await new Promise(r => setTimeout(r, 200));
    }
  });

  function onIframeLoad() {
    loaded = true;
  }
</script>

<div style="position: relative; height: calc(100vh - 48px);">
  <!-- Embed Header Bar -->
  <div style="display: flex; align-items: center; gap: 10px; padding: 6px 16px; background: var(--color-surface-dim); border-bottom: 2px solid var(--color-on-surface); font-size: 11px;">
    <a href="/home" class="btn-ghost" style="text-decoration: none; padding: 3px 10px; font-size: 10px;">
      &lt; BACK
    </a>
    <span style="font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em;">
      {data.app.icon} {data.app.name}
    </span>
    <span class="tag-label tag-label-secondary" style="margin-left: auto;">EMBEDDED</span>
  </div>

  <!-- Loading State -->
  {#if !loaded}
    <div class="embed-loading">
      <div style="font-family: 'Space Grotesk', monospace; font-size: 12px; text-align: center;">
        {#if loadStep >= 1}<div style="color: var(--color-on-surface-dim);">{loadStep > 1 ? '✓' : '>'} Connecting to {data.app.name}...</div>{/if}
        {#if loadStep >= 2}<div style="color: var(--color-on-surface-dim);">{loadStep > 2 ? '✓' : '>'} Loading interface...</div>{/if}
        {#if loadStep >= 3}<div style="color: var(--color-primary-container); font-weight: 700;">✓ Ready. Rendering...</div>{/if}
      </div>
      <div style="background: var(--color-surface-dim); height: 3px; width: 200px; margin-top: 8px;">
        <div style="background: var(--color-primary-container); height: 100%; width: {Math.round((loadStep / 3) * 100)}%; transition: width 0.2s;"></div>
      </div>
    </div>
  {/if}

  <!-- Iframe -->
  <iframe
    src={data.app.url}
    title={data.app.name}
    class="embed-container"
    style="height: calc(100vh - 48px - 36px); {loaded ? '' : 'opacity: 0; position: absolute; top: 36px;'}"
    onload={onIframeLoad}
    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
  ></iframe>
</div>
