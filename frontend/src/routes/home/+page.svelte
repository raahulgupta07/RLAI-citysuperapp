<script lang="ts">
  import AppCard from '$lib/AppCard.svelte';

  let { data } = $props();

  let activeTab = $state('ALL');
  let searchQuery = $state('');
  let favoriteIds = $state<number[]>(data.favoriteIds || []);

  // Boot animation
  let bootDone = $state(false);
  let bootStep = $state(0);

  import { onMount } from 'svelte';

  onMount(async () => {
    for (let i = 1; i <= 5; i++) {
      bootStep = i;
      await new Promise(r => setTimeout(r, 150));
    }
    bootDone = true;
  });

  const tabs = $derived(['ALL', ...data.categories.map((c: any) => c.name.toUpperCase()), 'FAVORITES']);

  const filteredApps = $derived(() => {
    let result = data.apps || [];

    // Filter by tab
    if (activeTab === 'FAVORITES') {
      result = result.filter((a: any) => favoriteIds.includes(a.id));
    } else if (activeTab !== 'ALL') {
      result = result.filter((a: any) => a.category_name?.toUpperCase() === activeTab);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a: any) =>
        a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)
      );
    }

    return result;
  });

  // Group apps by category
  const groupedApps = $derived(() => {
    const apps = filteredApps();
    if (activeTab !== 'ALL') return [{ name: activeTab, apps }];

    const groups: { name: string; apps: any[] }[] = [];
    const catOrder = data.categories.map((c: any) => c.name);

    for (const catName of catOrder) {
      const catApps = apps.filter((a: any) => a.category_name === catName);
      if (catApps.length > 0) groups.push({ name: catName, apps: catApps });
    }

    // Uncategorized
    const uncategorized = apps.filter((a: any) => !catOrder.includes(a.category_name));
    if (uncategorized.length > 0) groups.push({ name: 'Other', apps: uncategorized });

    return groups;
  });

  async function toggleFavorite(appId: number) {
    try {
      const res = await fetch(`/api/favorites/${appId}`, { method: 'POST' });
      if (res.ok) {
        if (favoriteIds.includes(appId)) {
          favoriteIds = favoriteIds.filter(id => id !== appId);
        } else {
          favoriteIds = [...favoriteIds, appId];
        }
      }
    } catch {}
  }

  async function logLaunch(appId: number) {
    try {
      await fetch(`/api/apps/${appId}/launch`, { method: 'POST' });
    } catch {}
  }
</script>

<div style="padding: 20px 24px; max-width: 1200px; margin: 0 auto;">

  {#if !bootDone}
    <div style="font-family: 'Space Grotesk', monospace; font-size: 12px; color: var(--color-on-surface-dim); padding: 20px 0;">
      {#if bootStep >= 1}<div>{bootStep > 1 ? '✓' : '>'} Loading agent registry...</div>{/if}
      {#if bootStep >= 2}<div>{bootStep > 2 ? '✓' : '>'} Checking permissions...</div>{/if}
      {#if bootStep >= 3}<div>{bootStep > 3 ? '✓' : '>'} Fetching favorites...</div>{/if}
      {#if bootStep >= 4}<div>{bootStep > 4 ? '✓' : '>'} Building dashboard...</div>{/if}
      {#if bootStep >= 5}<div style="color: var(--color-primary-container); font-weight: 700;">✓ Ready. {data.apps?.length || 0} agents loaded.</div>{/if}
    </div>
  {/if}

  {#if bootDone}
    <!-- Search -->
    <div style="margin-bottom: 16px;">
      <input
        type="text"
        bind:value={searchQuery}
        class="form-input"
        placeholder="Search agents..."
        style="max-width: 400px;"
      />
    </div>

    <!-- Tabs -->
    <div class="dash-tabs">
      {#each tabs as tab}
        <button
          class="dash-tab"
          class:dash-tab-active={activeTab === tab}
          onclick={() => activeTab = tab}
        >
          {tab === 'FAVORITES' ? '★ ' : ''}{tab}
        </button>
      {/each}
    </div>

    <!-- Card Grid -->
    <div class="dash-panel" style="border: none; background: transparent; padding: 16px 0;">
      {#each groupedApps() as group}
        <div style="margin-bottom: 24px;">
          {#if activeTab === 'ALL'}
            <div class="dark-title-bar" style="margin-bottom: 12px; font-size: 12px;">
              {group.name}
              <span style="font-size: 10px; font-weight: 400; opacity: 0.7;">{group.apps.length} apps</span>
            </div>
          {/if}

          <div class="card-grid">
            {#each group.apps as app (app.id)}
              <AppCard
                {app}
                isFavorite={favoriteIds.includes(app.id)}
                onToggleFav={() => toggleFavorite(app.id)}
                onLaunch={() => logLaunch(app.id)}
              />
            {/each}
          </div>
        </div>
      {/each}

      {#if filteredApps().length === 0}
        <div style="text-align: center; padding: 40px; color: var(--color-on-surface-dim); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
          No agents found
        </div>
      {/if}
    </div>
  {/if}
</div>
