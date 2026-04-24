<script lang="ts">
  import { onMount } from 'svelte';

  let { data } = $props();

  let activeTab = $state('APPS');

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab')?.toUpperCase();
    if (tab && ['APPS', 'CATEGORIES', 'USERS', 'ANALYTICS'].includes(tab)) {
      activeTab = tab;
    }
  });
  let showModal = $state(false);
  let editingApp = $state<any>(null);
  let showDeleteModal = $state(false);
  let deletingApp = $state<any>(null);
  let deleteConfirmName = $state('');
  let toast = $state('');

  // Form state
  let formName = $state('');
  let formSlug = $state('');
  let formUrl = $state('');
  let formDescription = $state('');
  let formCategoryId = $state<number>(1);
  let formLaunchMode = $state('redirect');
  let formIcon = $state('');
  let formCardColor = $state('#007518');
  let formStatus = $state('active');
  let formRoles = $state<string[]>(['all']);
  let formSaving = $state(false);

  // Category form
  let showCatModal = $state(false);
  let catName = $state('');
  let editingCat = $state<any>(null);

  const tabs = ['APPS', 'CATEGORIES', 'USERS', 'ANALYTICS'];
  const colors = ['#007518', '#006f7c', '#be2d06', '#ff9d00', '#383832', '#0f3460', '#6b21a8', '#dc2626'];
  const ldapGroups = ['all', 'admin', 'pg-team', 'ch-team', 'cmhl-team', 'dev-only'];

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function openAddModal() {
    editingApp = null;
    formName = ''; formSlug = ''; formUrl = 'https://'; formDescription = '';
    formCategoryId = data.categories[0]?.id || 1; formLaunchMode = 'redirect';
    formIcon = '🤖'; formCardColor = '#007518'; formStatus = 'active'; formRoles = ['all'];
    showModal = true;
  }

  function openEditModal(app: any) {
    editingApp = app;
    formName = app.name; formSlug = app.slug; formUrl = app.url; formDescription = app.description || '';
    formCategoryId = app.category_id || 1; formLaunchMode = app.launch_mode;
    formIcon = app.icon || '🤖'; formCardColor = app.card_color || '#007518';
    formStatus = app.status; formRoles = app.roles || ['all'];
    showModal = true;
  }

  function openDeleteModal(app: any) {
    deletingApp = app;
    deleteConfirmName = '';
    showDeleteModal = true;
  }

  $effect(() => {
    if (!editingApp && formName) {
      formSlug = slugify(formName);
    }
  });

  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => toast = '', 3000);
  }

  async function saveApp() {
    if (!formName || !formUrl) return;
    formSaving = true;
    const body = {
      name: formName, slug: formSlug || slugify(formName), url: formUrl,
      description: formDescription, category_id: formCategoryId,
      launch_mode: formLaunchMode, icon: formIcon, card_color: formCardColor,
      status: formStatus, roles: formRoles,
    };

    try {
      const url = editingApp ? `/api/admin/apps/${editingApp.id}` : '/api/admin/apps';
      const method = editingApp ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        showModal = false;
        showToast(editingApp ? 'App updated' : 'App created');
        window.location.reload();
      }
    } catch {}
    formSaving = false;
  }

  async function deleteApp() {
    if (!deletingApp) return;
    try {
      const res = await fetch(`/api/admin/apps/${deletingApp.id}`, { method: 'DELETE' });
      if (res.ok) {
        showDeleteModal = false;
        showToast('App deleted');
        window.location.reload();
      }
    } catch {}
  }

  async function saveCat() {
    if (!catName) return;
    const url = editingCat ? `/api/admin/categories/${editingCat.id}` : '/api/admin/categories';
    const method = editingCat ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: catName }) });
    showCatModal = false;
    window.location.reload();
  }

  async function deleteCat(id: number) {
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    window.location.reload();
  }

  async function toggleRole(userId: number, currentRole: string) {
    const newRole = currentRole === 'super_admin' ? 'user' : 'super_admin';
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    window.location.reload();
  }

  async function toggleAppStatus(app: any) {
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    await fetch(`/api/admin/apps/${app.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...app, status: newStatus, roles: app.roles }),
    });
    showToast(`${app.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    window.location.reload();
  }

  function toggleFormRole(group: string) {
    if (formRoles.includes(group)) {
      formRoles = formRoles.filter(r => r !== group);
    } else {
      formRoles = [...formRoles, group];
    }
  }
</script>

<div style="padding: 20px 24px; max-width: 1200px; margin: 0 auto;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
    <span class="tag-label-warning" style="display:inline-block; background: var(--color-warning); color: #1a1a1a; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px;">ADMIN</span>
    <span style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em;">Super Admin Panel</span>
  </div>

  <!-- Tabs -->
  <div class="dash-tabs">
    {#each tabs as tab}
      <button class="dash-tab" class:dash-tab-active={activeTab === tab} onclick={() => activeTab = tab}>{tab}</button>
    {/each}
  </div>

  <div class="dash-panel">

    <!-- APPS TAB -->
    {#if activeTab === 'APPS'}
      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>REGISTERED APPS ({data.apps.length})</span>
        <button class="btn-green" onclick={openAddModal}>+ ADD APP</button>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>NAME</th>
            <th>URL</th>
            <th>CATEGORY</th>
            <th>MODE</th>
            <th>STATUS</th>
            <th style="width: 200px;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {#each data.apps as app, i}
            <tr style="{app.status !== 'active' ? 'opacity: 0.5;' : ''}">
              <td>{i + 1}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 16px;">{app.icon}</span>
                  <div>
                    <div style="font-weight: 700;">{app.name}</div>
                    {#if app.description}
                      <div style="font-size: 9px; color: var(--color-on-surface-dim); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{app.description}</div>
                    {/if}
                  </div>
                </div>
              </td>
              <td>
                <div style="font-size: 10px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-on-surface-dim);">{app.url}</div>
              </td>
              <td>{app.category_name}</td>
              <td>
                <span class="tag-label" class:tag-label-secondary={app.launch_mode === 'embed'}>
                  {app.launch_mode}
                </span>
              </td>
              <td>
                <button
                  onclick={() => toggleAppStatus(app)}
                  class="tag-label"
                  class:tag-label-green={app.status === 'active'}
                  class:tag-label-warning={app.status === 'draft'}
                  class:tag-label-error={app.status === 'disabled'}
                  style="cursor: pointer; border: none;"
                  title="Click to toggle active/inactive"
                >
                  {app.status === 'active' ? 'ACTIVE' : app.status === 'draft' ? 'DRAFT' : 'DISABLED'}
                </button>
              </td>
              <td>
                <div style="display: flex; gap: 4px;">
                  <button class="btn-primary" onclick={() => openEditModal(app)}>EDIT</button>
                  <button class="btn-ghost" onclick={() => toggleAppStatus(app)}>
                    {app.status === 'active' ? 'DISABLE' : 'ENABLE'}
                  </button>
                  <button class="btn-error" onclick={() => openDeleteModal(app)}>DEL</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- CATEGORIES TAB -->
    {:else if activeTab === 'CATEGORIES'}
      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>CATEGORIES ({data.categories.length})</span>
        <button class="btn-green" onclick={() => { editingCat = null; catName = ''; showCatModal = true; }}>+ ADD</button>
      </div>

      <table class="admin-table">
        <thead><tr><th>#</th><th>NAME</th><th>SORT</th><th>ACTIONS</th></tr></thead>
        <tbody>
          {#each data.categories as cat, i}
            <tr>
              <td>{i + 1}</td>
              <td style="font-weight: 700;">{cat.name}</td>
              <td>{cat.sort_order}</td>
              <td>
                <div style="display: flex; gap: 4px;">
                  <button class="btn-primary" onclick={() => { editingCat = cat; catName = cat.name; showCatModal = true; }}>EDIT</button>
                  <button class="btn-error" onclick={() => deleteCat(cat.id)}>DEL</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- USERS TAB -->
    {:else if activeTab === 'USERS'}
      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>USERS ({data.users.length})</span>
      </div>

      <table class="admin-table">
        <thead><tr><th>USERNAME</th><th>DISPLAY NAME</th><th>ROLE</th><th>LAST LOGIN</th><th>ACTIONS</th></tr></thead>
        <tbody>
          {#each data.users as u}
            <tr>
              <td style="font-weight: 700;">{u.username}</td>
              <td>{u.display_name}</td>
              <td>
                <span class="tag-label" class:tag-label-warning={u.role === 'super_admin'} class:tag-label-green={u.role === 'admin'}>
                  {u.role}
                </span>
              </td>
              <td style="font-size: 10px; color: var(--color-on-surface-dim);">{u.last_login || 'Never'}</td>
              <td>
                <button class="btn-primary" onclick={() => toggleRole(u.id, u.role || 'user')}>
                  {u.role === 'super_admin' ? 'DEMOTE' : 'PROMOTE'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- ANALYTICS TAB -->
    {:else if activeTab === 'ANALYTICS'}
      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>USAGE ANALYTICS</span>
      </div>
      <div style="padding: 20px; font-size: 13px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div class="ink-border" style="padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 900;">{data.apps.length}</div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Apps</div>
          </div>
          <div class="ink-border" style="padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 900;">{data.users.length}</div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Users</div>
          </div>
          <div class="ink-border" style="padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: 900;">{data.analytics.totalLaunches}</div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Launches</div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- ADD/EDIT APP MODAL -->
{#if showModal}
  <div class="modal-overlay" onclick={() => showModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        {editingApp ? 'EDIT APP' : 'ADD NEW APP'}
        <button onclick={() => showModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label class="form-label">APP NAME *</label>
            <input class="form-input" bind:value={formName} placeholder="My Agent" />
          </div>
          <div>
            <label class="form-label">SLUG</label>
            <input class="form-input" bind:value={formSlug} placeholder="my-agent" />
          </div>
          <div>
            <label class="form-label">APP URL *</label>
            <input class="form-input" bind:value={formUrl} placeholder="https://myagent.citygpt.xyz" />
          </div>
          <div>
            <label class="form-label">DESCRIPTION</label>
            <input class="form-input" bind:value={formDescription} placeholder="Short description" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="form-label">CATEGORY</label>
              <select class="form-select" bind:value={formCategoryId}>
                {#each data.categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
            </div>
            <div>
              <label class="form-label">ICON</label>
              <input class="form-input" bind:value={formIcon} placeholder="emoji" />
            </div>
          </div>
          <div>
            <label class="form-label">LAUNCH MODE</label>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={formLaunchMode} value="redirect" /> REDIRECT (new tab)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={formLaunchMode} value="embed" /> EMBED (inside portal)
              </label>
            </div>
          </div>
          <div>
            <label class="form-label">CARD COLOR</label>
            <div style="display: flex; gap: 6px; margin-top: 4px;">
              {#each colors as color}
                <button
                  class="color-swatch"
                  class:color-swatch-active={formCardColor === color}
                  style="background: {color};"
                  onclick={() => formCardColor = color}
                ></button>
              {/each}
            </div>
          </div>
          <div>
            <label class="form-label">ACCESS (LDAP GROUPS)</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
              {#each ldapGroups as group}
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="checkbox" checked={formRoles.includes(group)} onchange={() => toggleFormRole(group)} />
                  {group}
                </label>
              {/each}
            </div>
          </div>
          <div>
            <label class="form-label">STATUS</label>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={formStatus} value="active" /> ACTIVE
              </label>
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={formStatus} value="draft" /> DRAFT
              </label>
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={formStatus} value="disabled" /> DISABLED
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showModal = false}>CANCEL</button>
        <button class="btn-green" onclick={saveApp} disabled={formSaving || !formName || !formUrl}>
          {formSaving ? 'SAVING...' : 'SAVE APP'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- DELETE CONFIRMATION MODAL -->
{#if showDeleteModal && deletingApp}
  <div class="modal-overlay" onclick={() => showDeleteModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()} style="max-width: 400px;">
      <div class="modal-header modal-header-error">
        DELETE APP
        <button onclick={() => showDeleteModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <p style="font-size: 12px; margin: 0 0 12px 0;">Type <strong>{deletingApp.name}</strong> to confirm deletion:</p>
        <input class="form-input" bind:value={deleteConfirmName} placeholder="Type app name" />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showDeleteModal = false}>CANCEL</button>
        <button class="btn-error" onclick={deleteApp} disabled={deleteConfirmName !== deletingApp.name}>
          DELETE PERMANENTLY
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- CATEGORY MODAL -->
{#if showCatModal}
  <div class="modal-overlay" onclick={() => showCatModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()} style="max-width: 400px;">
      <div class="modal-header">
        {editingCat ? 'EDIT CATEGORY' : 'ADD CATEGORY'}
        <button onclick={() => showCatModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <label class="form-label">CATEGORY NAME</label>
        <input class="form-input" bind:value={catName} placeholder="Category name" />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showCatModal = false}>CANCEL</button>
        <button class="btn-green" onclick={saveCat} disabled={!catName}>SAVE</button>
      </div>
    </div>
  </div>
{/if}

<!-- TOAST -->
{#if toast}
  <div class="toast">{toast}</div>
{/if}
