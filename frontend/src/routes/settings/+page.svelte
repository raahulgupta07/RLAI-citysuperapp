<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import IconPicker from '$lib/IconPicker.svelte';

  let { data } = $props();

  let activeTab = $state('APPS');

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab')?.toUpperCase();
    if (tab && ['APPS', 'CATEGORIES', 'USERS', 'LOGS', 'ANALYTICS', 'AUTH'].includes(tab)) {
      activeTab = tab;
    }
    loadAuthProviders();
    loadAuthSettings();
  });
  let showModal = $state(false);
  let editingApp = $state<any>(null);
  let showDeleteModal = $state(false);
  let deletingApp = $state<any>(null);
  let deleteConfirmName = $state('');
  let toast = $state('');

  // Password reset modal
  let showPasswordModal = $state(false);
  let passwordUserId = $state(0);
  let passwordUsername = $state('');
  let newPassword = $state('');

  // Auth method toggles
  let authLocalEnabled = $state(true);
  let authLdapEnabled = $state(false);
  let authSsoEnabled = $state(false);

  // Auth providers
  let authProviders = $state<any[]>([]);
  let showAuthModal = $state(false);
  let editingProvider = $state<any>(null);
  let providerType = $state('ldap');
  let providerName = $state('');
  let providerStatus = $state('active');
  // LDAP fields
  let ldapHost = $state('');
  let ldapPort = $state('389');
  let ldapAppDn = $state('');
  let ldapAppDnPassword = $state('');
  let ldapMailAttr = $state('mail');
  let ldapUsernameAttr = $state('sAMAccountName');
  let ldapSearchBase = $state('');
  let ldapSearchFilter = $state('(&(objectClass=user)(sAMAccountName={username}))');
  let ldapGroupAttr = $state('memberOf');
  let ldapTls = $state(false);
  // Keycloak fields
  let kcUrl = $state('');
  let kcRealm = $state('master');
  let kcClientId = $state('');
  let kcClientSecret = $state('');
  // Google fields
  let googleClientId = $state('');
  let googleClientSecret = $state('');
  // Microsoft fields
  let msClientId = $state('');
  let msClientSecret = $state('');
  let msTenantId = $state('common');
  let testResult = $state('');
  let testLoading = $state(false);

  // Create user modal
  let showCreateUserModal = $state(false);
  let newUserUsername = $state('');
  let newUserDisplayName = $state('');
  let newUserEmail = $state('');
  let newUserPassword = $state('');
  let newUserRole = $state('user');
  let newUserSaving = $state(false);

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

  const tabs = ['APPS', 'CATEGORIES', 'USERS', 'LOGS', 'ANALYTICS', 'AUTH'];
  const colors = ['#007518', '#006f7c', '#be2d06', '#ff9d00', '#383832', '#0f3460', '#6b21a8', '#dc2626'];
  const ldapGroups = ['all', 'admin', 'pg-team', 'ch-team', 'cmhl-team', 'dev-only'];

  // Search & filter state
  let appsSearch = $state('');
  let appsFilterStatus = $state('all');
  let appsFilterMode = $state('all');

  let usersSearch = $state('');
  let usersFilterRole = $state('all');
  let usersFilterAuth = $state('all');
  let usersFilterStatus = $state('all');

  let logsSearch = $state('');
  let logsFilterAction = $state('all');

  // Filtered data
  const filteredApps = $derived(() => {
    let result = data.apps || [];
    if (appsSearch) {
      const q = appsSearch.toLowerCase();
      result = result.filter((a: any) => a.name.toLowerCase().includes(q) || (a.url || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
    }
    if (appsFilterStatus !== 'all') result = result.filter((a: any) => a.status === appsFilterStatus);
    if (appsFilterMode !== 'all') result = result.filter((a: any) => a.launch_mode === appsFilterMode);
    return result;
  });

  const filteredUsers = $derived(() => {
    let result = data.users || [];
    if (usersSearch) {
      const q = usersSearch.toLowerCase();
      result = result.filter((u: any) => u.username.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    }
    if (usersFilterRole !== 'all') result = result.filter((u: any) => u.role === usersFilterRole);
    if (usersFilterAuth !== 'all') result = result.filter((u: any) => (u.auth_source || 'local') === usersFilterAuth);
    if (usersFilterStatus !== 'all') result = result.filter((u: any) => (u.status || 'active') === usersFilterStatus);
    return result;
  });

  const filteredLogs = $derived(() => {
    let result = data.analytics?.recentActivity || [];
    if (logsSearch) {
      const q = logsSearch.toLowerCase();
      result = result.filter((l: any) => (l.username || '').toLowerCase().includes(q) || (l.detail || '').toLowerCase().includes(q));
    }
    if (logsFilterAction !== 'all') result = result.filter((l: any) => l.action === logsFilterAction);
    return result;
  });

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
        invalidateAll();
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
        invalidateAll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Failed to delete app');
      }
    } catch {
      showToast('Failed to delete app');
    }
  }

  async function saveCat() {
    if (!catName) return;
    const url = editingCat ? `/api/admin/categories/${editingCat.id}` : '/api/admin/categories';
    const method = editingCat ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: catName }) });
    showCatModal = false;
    invalidateAll();
  }

  async function deleteCat(id: number) {
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    invalidateAll();
  }

  async function toggleRole(userId: number, currentRole: string) {
    const newRole = currentRole === 'super_admin' ? 'user' : 'super_admin';
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    invalidateAll();
  }

  async function toggleAppStatus(app: any) {
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    await fetch(`/api/admin/apps/${app.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...app, status: newStatus, roles: app.roles }),
    });
    showToast(`${app.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    invalidateAll();
  }

  async function changeUserRole(userId: number, newRole: string) {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    showToast(`User role updated to ${newRole}`);
    invalidateAll();
  }

  async function toggleUserStatus(userId: number, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(`User ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    invalidateAll();
  }

  function openPasswordModal(userId: number, username: string) {
    passwordUserId = userId;
    passwordUsername = username;
    newPassword = '';
    showPasswordModal = true;
  }

  async function submitPasswordReset() {
    if (!newPassword || newPassword.length < 4) return;
    await fetch(`/api/admin/users/${passwordUserId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    showPasswordModal = false;
    showToast('Password reset successfully');
  }

  function openCreateUser() {
    newUserUsername = ''; newUserDisplayName = ''; newUserEmail = '';
    newUserPassword = ''; newUserRole = 'user'; newUserSaving = false;
    showCreateUserModal = true;
  }

  async function createUser() {
    if (!newUserUsername || !newUserPassword) return;
    newUserSaving = true;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserUsername,
          display_name: newUserDisplayName || newUserUsername,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      if (res.ok) {
        showCreateUserModal = false;
        showToast('User created');
        invalidateAll();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to create user');
      }
    } catch { showToast('Failed to create user'); }
    newUserSaving = false;
  }

  function asciiBar(value: number, max: number, len: number = 20): string {
    const filled = Math.max(1, Math.min(len, Math.round((value / Math.max(max, 1)) * len)));
    return '\u2588'.repeat(filled) + '\u2591'.repeat(len - filled);
  }

  function toggleFormRole(group: string) {
    if (formRoles.includes(group)) {
      formRoles = formRoles.filter(r => r !== group);
    } else {
      formRoles = [...formRoles, group];
    }
  }

  async function loadAuthProviders() {
    try {
      const res = await fetch('/api/admin/auth-providers');
      if (res.ok) { const d = await res.json(); authProviders = d.providers || []; }
    } catch {}
  }

  async function loadAuthSettings() {
    try {
      const res = await fetch('/api/admin/auth-settings');
      if (res.ok) {
        const d = await res.json();
        authLocalEnabled = d.auth_local_enabled !== false;
        authLdapEnabled = d.auth_ldap_enabled !== false;
        authSsoEnabled = d.auth_sso_enabled !== false;
      }
    } catch {}
  }

  async function toggleAuthSetting(key: string, value: boolean) {
    await fetch('/api/admin/auth-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    showToast(`${key.replace('auth_', '').replace('_enabled', '').toUpperCase()} ${value ? 'enabled' : 'disabled'}`);
  }

  function openAddProvider() {
    editingProvider = null;
    providerType = 'ldap'; providerName = ''; providerStatus = 'active';
    ldapHost = ''; ldapPort = '389'; ldapAppDn = ''; ldapAppDnPassword = '';
    ldapMailAttr = 'mail'; ldapUsernameAttr = 'sAMAccountName';
    ldapSearchBase = ''; ldapSearchFilter = '(&(objectClass=user)(sAMAccountName={username}))';
    ldapGroupAttr = 'memberOf'; ldapTls = false;
    kcUrl = ''; kcRealm = 'master'; kcClientId = ''; kcClientSecret = '';
    googleClientId = ''; googleClientSecret = '';
    msClientId = ''; msClientSecret = ''; msTenantId = 'common';
    testResult = '';
    showAuthModal = true;
  }

  function openEditProvider(p: any) {
    editingProvider = p;
    providerType = p.type; providerName = p.name; providerStatus = p.status;
    const c = p.config || {};
    if (p.type === 'ldap') {
      ldapHost = c.host || ''; ldapPort = c.port || '389';
      ldapAppDn = c.app_dn || ''; ldapAppDnPassword = c.app_dn_password || '';
      ldapMailAttr = c.mail_attr || 'mail'; ldapUsernameAttr = c.username_attr || 'sAMAccountName';
      ldapSearchBase = c.search_base || '';
      ldapSearchFilter = c.search_filter || '(&(objectClass=user)(sAMAccountName={username}))';
      ldapGroupAttr = c.group_attr || 'memberOf'; ldapTls = c.tls || false;
    } else if (p.type === 'keycloak') {
      kcUrl = c.url || ''; kcRealm = c.realm || 'master'; kcClientId = c.client_id || ''; kcClientSecret = c.client_secret || '';
    } else if (p.type === 'google') {
      googleClientId = c.client_id || ''; googleClientSecret = c.client_secret || '';
    } else if (p.type === 'microsoft') {
      msClientId = c.client_id || ''; msClientSecret = c.client_secret || ''; msTenantId = c.tenant_id || 'common';
    }
    testResult = '';
    showAuthModal = true;
  }

  async function saveProvider() {
    const config = providerType === 'ldap'
      ? { host: ldapHost, port: ldapPort, app_dn: ldapAppDn, app_dn_password: ldapAppDnPassword, mail_attr: ldapMailAttr, username_attr: ldapUsernameAttr, search_base: ldapSearchBase, search_filter: ldapSearchFilter, group_attr: ldapGroupAttr, tls: ldapTls }
      : providerType === 'keycloak'
      ? { url: kcUrl, realm: kcRealm, client_id: kcClientId, client_secret: kcClientSecret }
      : providerType === 'google'
      ? { client_id: googleClientId, client_secret: googleClientSecret }
      : providerType === 'microsoft'
      ? { client_id: msClientId, client_secret: msClientSecret, tenant_id: msTenantId }
      : {};
    const body = { name: providerName, type: providerType, config, status: providerStatus };
    const url = editingProvider ? `/api/admin/auth-providers/${editingProvider.id}` : '/api/admin/auth-providers';
    const method = editingProvider ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    showAuthModal = false;
    showToast(editingProvider ? 'Provider updated' : 'Provider added');
    await loadAuthProviders();
  }

  async function deleteProvider(id: number) {
    await fetch(`/api/admin/auth-providers/${id}`, { method: 'DELETE' });
    showToast('Provider deleted');
    await loadAuthProviders();
  }

  async function testProvider(id: number) {
    testLoading = true; testResult = '';
    try {
      const res = await fetch(`/api/admin/auth-providers/${id}/test`, { method: 'POST' });
      const d = await res.json();
      testResult = d.success ? `\u2713 ${d.message}` : `\u2717 ${d.message}`;
    } catch { testResult = '\u2717 Test failed'; }
    testLoading = false;
  }
</script>

<div style="padding: 20px 24px; max-width: 1200px; margin: 0 auto;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
    <button class="btn-ghost" onclick={() => window.location.href = '/home'} style="padding: 4px 10px; font-size: 11px;">&lt; BACK</button>
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

      <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap;">
        <input class="form-input" style="max-width: 240px; padding: 6px 10px; font-size: 11px;" bind:value={appsSearch} placeholder="Search apps..." />
        <select class="form-select" style="max-width: 130px; padding: 6px 8px; font-size: 10px;" bind:value={appsFilterStatus}>
          <option value="all">ALL STATUS</option>
          <option value="active">ACTIVE</option>
          <option value="disabled">DISABLED</option>
          <option value="draft">DRAFT</option>
        </select>
        <select class="form-select" style="max-width: 130px; padding: 6px 8px; font-size: 10px;" bind:value={appsFilterMode}>
          <option value="all">ALL MODES</option>
          <option value="redirect">REDIRECT</option>
          <option value="embed">EMBED</option>
        </select>
        <span style="font-size: 10px; color: var(--color-on-surface-dim); margin-left: auto;">{filteredApps().length} of {data.apps.length}</span>
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
          {#each filteredApps() as app, i}
            <tr style="{app.status !== 'active' ? 'opacity: 0.5;' : ''}">
              <td>{i + 1}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 18px;">{app.icon || '📦'}</span>
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
        <button class="btn-green" onclick={openCreateUser}>+ CREATE USER</button>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap;">
        <input class="form-input" style="max-width: 240px; padding: 6px 10px; font-size: 11px;" bind:value={usersSearch} placeholder="Search users..." />
        <select class="form-select" style="max-width: 130px; padding: 6px 8px; font-size: 10px;" bind:value={usersFilterRole}>
          <option value="all">ALL ROLES</option>
          <option value="super_admin">SUPER_ADMIN</option>
          <option value="admin">ADMIN</option>
          <option value="user">USER</option>
          <option value="viewer">VIEWER</option>
        </select>
        <select class="form-select" style="max-width: 130px; padding: 6px 8px; font-size: 10px;" bind:value={usersFilterAuth}>
          <option value="all">ALL AUTH</option>
          <option value="local">LOCAL</option>
          <option value="ldap">LDAP</option>
          <option value="sso">SSO</option>
        </select>
        <select class="form-select" style="max-width: 130px; padding: 6px 8px; font-size: 10px;" bind:value={usersFilterStatus}>
          <option value="all">ALL STATUS</option>
          <option value="active">ACTIVE</option>
          <option value="disabled">DISABLED</option>
        </select>
        <span style="font-size: 10px; color: var(--color-on-surface-dim); margin-left: auto;">{filteredUsers().length} of {data.users.length}</span>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>USERNAME</th>
            <th>DISPLAY NAME</th>
            <th>AUTH</th>
            <th>ROLE</th>
            <th>STATUS</th>
            <th>LOGINS</th>
            <th>FIRST LOGIN</th>
            <th>LAST LOGIN</th>
            <th style="width: 240px;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredUsers() as u}
            <tr style="{(u.status || 'active') !== 'active' ? 'opacity: 0.5;' : ''}">
              <td style="font-weight: 700;">{u.username}</td>
              <td>{u.display_name}</td>
              <td>
                <span class="tag-label"
                  class:tag-label-green={u.auth_source === 'local'}
                  class:tag-label-secondary={u.auth_source === 'sso'}
                  class:tag-label-warning={u.auth_source === 'ldap'}>
                  {u.auth_source || 'local'}
                </span>
              </td>
              <td>
                <select
                  class="form-select"
                  style="padding: 4px 8px; font-size: 10px; min-width: 100px;"
                  value={u.role}
                  onchange={(e) => changeUserRole(u.id, (e.target as HTMLSelectElement).value)}
                >
                  <option value="super_admin">SUPER_ADMIN</option>
                  <option value="admin">ADMIN</option>
                  <option value="user">USER</option>
                  <option value="viewer">VIEWER</option>
                </select>
              </td>
              <td>
                <button
                  onclick={() => toggleUserStatus(u.id, u.status || 'active')}
                  class="tag-label"
                  class:tag-label-green={(u.status || 'active') === 'active'}
                  class:tag-label-error={(u.status || 'active') === 'disabled'}
                  style="cursor: pointer; border: none;"
                >
                  {(u.status || 'active') === 'active' ? 'ACTIVE' : 'DISABLED'}
                </button>
              </td>
              <td style="text-align: center; font-weight: 700;">
                {data.analytics.userStats?.find((s: any) => s.username === u.username)?.logins || 0}
              </td>
              <td style="font-size: 10px; color: var(--color-on-surface-dim);">
                {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
              </td>
              <td style="font-size: 10px; color: var(--color-on-surface-dim);">
                {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
              </td>
              <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <button class="btn-ghost" onclick={() => toggleUserStatus(u.id, u.status || 'active')}>
                    {(u.status || 'active') === 'active' ? 'DISABLE' : 'ENABLE'}
                  </button>
                  {#if (u.auth_source || 'local') === 'local'}
                    <button class="btn-primary" onclick={() => openPasswordModal(u.id, u.username)}>RESET PWD</button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- LOGS TAB -->
    {:else if activeTab === 'LOGS'}
      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>ACTIVITY LOGS ({data.analytics.recentActivity?.length || 0})</span>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap;">
        <input class="form-input" style="max-width: 240px; padding: 6px 10px; font-size: 11px;" bind:value={logsSearch} placeholder="Search by user or detail..." />
        <select class="form-select" style="max-width: 140px; padding: 6px 8px; font-size: 10px;" bind:value={logsFilterAction}>
          <option value="all">ALL ACTIONS</option>
          <option value="login">LOGIN</option>
          <option value="logout">LOGOUT</option>
          <option value="app_launch">APP LAUNCH</option>
        </select>
        <span style="font-size: 10px; color: var(--color-on-surface-dim); margin-left: auto;">{filteredLogs().length} results</span>
      </div>

      {#if filteredLogs().length > 0}
        <table class="admin-table">
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>USER</th>
              <th>ACTION</th>
              <th>DETAIL</th>
              <th>IP ADDRESS</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredLogs() as log}
              <tr>
                <td style="font-size: 10px; white-space: nowrap; color: var(--color-on-surface-dim);">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                </td>
                <td style="font-weight: 700;">{log.username || 'unknown'}</td>
                <td>
                  <span class="tag-label"
                    class:tag-label-green={log.action === 'login'}
                    class:tag-label-error={log.action === 'logout'}
                    class:tag-label-secondary={log.action === 'app_launch' || log.action === 'app_embed'}>
                    {log.action}
                  </span>
                </td>
                <td style="font-size: 11px; color: var(--color-on-surface-dim);">{log.detail || ''}</td>
                <td style="font-size: 10px; color: var(--color-on-surface-dim);">{log.ip_address || ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div style="padding: 20px; text-align: center; color: var(--color-on-surface-dim); font-size: 11px; text-transform: uppercase;">
          No activity logged yet
        </div>
      {/if}

    <!-- ANALYTICS TAB -->
    {:else if activeTab === 'ANALYTICS'}

      <!-- ROW 1: Key Metrics (8 cards) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.apps.length}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Apps</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.users.length}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Users</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.analytics.totalLaunches}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Launches</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.analytics.totalActivities}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Total Activities</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900; color: var(--color-primary);">{data.analytics.activeUsers7d}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Active (7 days)</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.analytics.activeUsers30d}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Active (30 days)</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900;">{data.analytics.retainedUsers}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Retained Users</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 26px; font-weight: 900; color: var(--color-error);">{data.analytics.usersNoLaunches}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Never Launched</div>
        </div>
      </div>

      <!-- ROW 2: Activity Today/Week/Month -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.actionsToday}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Actions Today</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.actionsThisWeek}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">This Week</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.actionsThisMonth}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">This Month</div>
        </div>
      </div>

      <!-- Averages -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.avgLogins}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Avg Logins/User</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.avgLaunches}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Avg Launches/User</div>
        </div>
        <div class="ink-border" style="padding: 14px; text-align: center;">
          <div style="font-size: 22px; font-weight: 900;">{data.analytics.appsZeroLaunches}</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-on-surface-dim);">Apps: Zero Launches</div>
        </div>
      </div>

      <!-- 2-COLUMN LAYOUT for bar charts -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">

        <!-- TOP APPS -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">TOP APPS BY LAUNCHES</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.topApps || []) as app}
              {@const maxVal = data.analytics.topApps?.[0]?.launches || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="width: 16px;">{app.icon}</span>
                <span style="width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700;">{app.name}</span>
                <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(app.launches, maxVal, 15)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{app.launches}</span>
              </div>
            {/each}
            {#if !data.analytics.topApps?.length}
              <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No data yet</div>
            {/if}
          </div>
        </div>

        <!-- LEAST USED APPS -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">LEAST USED APPS</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.leastUsedApps || []) as app}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="width: 16px;">{app.icon}</span>
                <span style="width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700;">{app.name}</span>
                <span style="color: var(--color-error); font-size: 9px; flex: 1;">{asciiBar(app.launches, Math.max(...(data.analytics.leastUsedApps || []).map((a: any) => a.launches), 1), 15)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{app.launches}</span>
              </div>
            {/each}
            {#if !data.analytics.leastUsedApps?.length}
              <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No data yet</div>
            {/if}
          </div>
        </div>

        <!-- LAUNCHES BY CATEGORY -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">LAUNCHES BY CATEGORY</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.launchesByCategory || []) as cat}
              {@const maxVal = data.analytics.launchesByCategory?.[0]?.count || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="width: 100px; font-weight: 700;">{cat.category || 'Other'}</span>
                <span style="color: var(--color-secondary); font-size: 9px; flex: 1;">{asciiBar(cat.count, maxVal, 18)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{cat.count}</span>
              </div>
            {/each}
            {#if !data.analytics.launchesByCategory?.length}
              <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No data yet</div>
            {/if}
          </div>
        </div>

        <!-- EMBED VS REDIRECT -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">LAUNCH MODE USAGE</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.modeUsage || []) as mode}
              {@const total = (data.analytics.modeUsage || []).reduce((s: number, m: any) => s + m.count, 0) || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="tag-label" class:tag-label-secondary={mode.launch_mode === 'embed'} style="width: 70px; text-align: center;">{mode.launch_mode}</span>
                <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(mode.count, total, 18)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{mode.count}</span>
                <span style="font-size: 9px; color: var(--color-on-surface-dim); width: 35px; text-align: right;">{Math.round((mode.count / total) * 100)}%</span>
              </div>
            {/each}
            {#if !data.analytics.modeUsage?.length}
              <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No data yet</div>
            {/if}
          </div>
        </div>

        <!-- USERS BY AUTH -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">USERS BY AUTH METHOD</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.usersByAuth || []) as auth}
              {@const total = (data.analytics.usersByAuth || []).reduce((s: number, a: any) => s + a.count, 0) || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="tag-label"
                  class:tag-label-green={auth.auth === 'local'}
                  class:tag-label-secondary={auth.auth === 'sso'}
                  class:tag-label-warning={auth.auth === 'ldap'}
                  style="width: 60px; text-align: center;">{auth.auth}</span>
                <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(auth.count, total, 18)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{auth.count}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- USERS BY ROLE -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">USERS BY ROLE</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.usersByRole || []) as role}
              {@const total = (data.analytics.usersByRole || []).reduce((s: number, r: any) => s + r.count, 0) || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="tag-label" class:tag-label-warning={role.role === 'super_admin'} class:tag-label-green={role.role === 'admin'} style="width: 90px; text-align: center;">{role.role}</span>
                <span style="color: var(--color-warning); font-size: 9px; flex: 1;">{asciiBar(role.count, total, 18)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{role.count}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- ACTIVITY BREAKDOWN -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">ACTIVITY BREAKDOWN</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.activityBreakdown || []) as act}
              {@const total = (data.analytics.activityBreakdown || []).reduce((s: number, a: any) => s + a.count, 0) || 1}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="tag-label"
                  class:tag-label-green={act.action === 'login'}
                  class:tag-label-error={act.action === 'logout'}
                  class:tag-label-secondary={act.action === 'app_launch'}
                  style="width: 90px; text-align: center;">{act.action}</span>
                <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(act.count, total, 18)}</span>
                <span style="width: 30px; text-align: right; font-weight: 700;">{act.count}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- PEAK HOURS -->
        <div>
          <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px;">PEAK USAGE HOURS</div>
          <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
            {#each (data.analytics.launchesByHour || []) as h}
              {@const maxVal = Math.max(...(data.analytics.launchesByHour || []).map((x: any) => x.count), 1)}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="width: 35px; text-align: right; color: var(--color-on-surface-dim);">{String(h.hour).padStart(2, '0')}:00</span>
                <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(h.count, maxVal, 18)}</span>
                <span style="width: 25px; text-align: right; font-weight: 700;">{h.count}</span>
              </div>
            {/each}
            {#if !data.analytics.launchesByHour?.length}
              <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No data yet</div>
            {/if}
          </div>
        </div>

      </div>

      <!-- LOGINS PER DAY TREND (full width) -->
      <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px; margin-bottom: 0;">LOGINS PER DAY (LAST 30 DAYS)</div>
      <div class="ink-border" style="padding: 12px; font-size: 10px; font-family: 'Space Grotesk', monospace; margin-bottom: 16px; overflow-x: auto;">
        {#if data.analytics.loginsPerDay?.length}
          {#each data.analytics.loginsPerDay as d}
            {@const maxVal = Math.max(...(data.analytics.loginsPerDay || []).map((x: any) => x.count), 1)}
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1px;">
              <span style="width: 70px; color: var(--color-on-surface-dim);">{d.day}</span>
              <span style="color: var(--color-primary); font-size: 9px; flex: 1;">{asciiBar(d.count, maxVal, 30)}</span>
              <span style="width: 25px; text-align: right; font-weight: 700;">{d.count}</span>
            </div>
          {/each}
        {:else}
          <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No login data yet</div>
        {/if}
      </div>

      <!-- LAUNCHES PER DAY (full width) -->
      <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px; margin-bottom: 0;">APP LAUNCHES PER DAY (LAST 30 DAYS)</div>
      <div class="ink-border" style="padding: 12px; font-size: 10px; font-family: 'Space Grotesk', monospace; margin-bottom: 16px; overflow-x: auto;">
        {#if data.analytics.launchesPerDay?.length}
          {#each data.analytics.launchesPerDay as d}
            {@const maxVal = Math.max(...(data.analytics.launchesPerDay || []).map((x: any) => x.count), 1)}
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1px;">
              <span style="width: 70px; color: var(--color-on-surface-dim);">{d.day}</span>
              <span style="color: var(--color-secondary); font-size: 9px; flex: 1;">{asciiBar(d.count, maxVal, 30)}</span>
              <span style="width: 25px; text-align: right; font-weight: 700;">{d.count}</span>
            </div>
          {/each}
        {:else}
          <div style="color: var(--color-on-surface-dim); text-align: center; padding: 10px;">No launch data yet</div>
        {/if}
      </div>

      <!-- PEAK WEEKDAYS (full width) -->
      <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px; margin-bottom: 0;">LOGINS BY WEEKDAY</div>
      <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace; margin-bottom: 16px;">
        {#each (data.analytics.loginsByWeekday || []) as wd}
          {@const maxVal = Math.max(...(data.analytics.loginsByWeekday || []).map((x: any) => x.count), 1)}
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
            <span style="width: 35px; font-weight: 700;">{wd.weekday}</span>
            <span style="color: var(--color-warning); font-size: 9px; flex: 1;">{asciiBar(wd.count, maxVal, 30)}</span>
            <span style="width: 25px; text-align: right; font-weight: 700;">{wd.count}</span>
          </div>
        {/each}
      </div>

      <!-- PER-USER TABLE (full width) -->
      <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px; margin-bottom: 0;">TOP USERS BY ACTIVITY</div>
      {#if data.analytics.userStats?.length}
        <table class="admin-table">
          <thead><tr><th>USER</th><th>LOGINS</th><th>LAUNCHES</th><th>TOTAL ACTIONS</th><th>LAST ACTIVE</th></tr></thead>
          <tbody>
            {#each data.analytics.userStats.slice(0, 15) as stat}
              <tr>
                <td style="font-weight: 700;">{stat.username}</td>
                <td style="text-align: center;">{stat.logins}</td>
                <td style="text-align: center;">{stat.launches}</td>
                <td style="text-align: center; font-weight: 700;">{stat.total_actions}</td>
                <td style="font-size: 10px; color: var(--color-on-surface-dim);">{stat.last_active ? new Date(stat.last_active).toLocaleString() : 'Never'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}

      <!-- SYSTEM HEALTH (full width) -->
      <div class="dark-title-bar" style="font-size: 11px; padding: 8px 14px; margin-top: 16px; margin-bottom: 0;">SYSTEM HEALTH</div>
      <div class="ink-border" style="padding: 12px; font-size: 11px; font-family: 'Space Grotesk', monospace;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          {#each Object.entries(data.analytics.tableCounts || {}) as [table, count]}
            <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: var(--color-surface-dim);">
              <span style="color: var(--color-on-surface-dim); text-transform: uppercase; font-size: 9px;">{table}</span>
              <span style="font-weight: 900;">{count}</span>
            </div>
          {/each}
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px;">
          {#each (data.analytics.appStatusCounts || []) as s}
            <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: var(--color-surface-dim);">
              <span style="text-transform: uppercase; font-size: 9px;">Apps: {s.status}</span>
              <span style="font-weight: 900;">{s.count}</span>
            </div>
          {/each}
          {#each (data.analytics.userStatusCounts || []) as s}
            <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: var(--color-surface-dim);">
              <span style="text-transform: uppercase; font-size: 9px;">Users: {s.status}</span>
              <span style="font-weight: 900;">{s.count}</span>
            </div>
          {/each}
        </div>
      </div>

    <!-- AUTH TAB -->
    {:else if activeTab === 'AUTH'}

      <!-- Auth Method Toggles -->
      <div class="dark-title-bar" style="margin-bottom: 8px;">
        <span>AUTH METHODS</span>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <label class="ink-border stamp-shadow" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; font-size: 11px; font-weight: 700; min-width: 140px;"
          style:background={authLocalEnabled ? '#e8f5e9' : '#ffeaea'}>
          <input type="checkbox" bind:checked={authLocalEnabled} onchange={() => toggleAuthSetting('auth_local_enabled', authLocalEnabled)} />
          LOCAL
          <span class="tag-label" class:tag-label-green={authLocalEnabled} class:tag-label-error={!authLocalEnabled} style="margin-left: auto;">
            {authLocalEnabled ? 'ON' : 'OFF'}
          </span>
        </label>
        <label class="ink-border stamp-shadow" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; font-size: 11px; font-weight: 700; min-width: 140px;"
          style:background={authLdapEnabled ? '#e8f5e9' : '#ffeaea'}>
          <input type="checkbox" bind:checked={authLdapEnabled} onchange={() => toggleAuthSetting('auth_ldap_enabled', authLdapEnabled)} />
          LDAP
          <span class="tag-label" class:tag-label-green={authLdapEnabled} class:tag-label-error={!authLdapEnabled} style="margin-left: auto;">
            {authLdapEnabled ? 'ON' : 'OFF'}
          </span>
        </label>
        <label class="ink-border stamp-shadow" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; font-size: 11px; font-weight: 700; min-width: 140px;"
          style:background={authSsoEnabled ? '#e8f5e9' : '#ffeaea'}>
          <input type="checkbox" bind:checked={authSsoEnabled} onchange={() => toggleAuthSetting('auth_sso_enabled', authSsoEnabled)} />
          SSO
          <span class="tag-label" class:tag-label-green={authSsoEnabled} class:tag-label-error={!authSsoEnabled} style="margin-left: auto;">
            {authSsoEnabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      <div class="dark-title-bar" style="margin-bottom: 12px;">
        <span>AUTH PROVIDERS ({authProviders.length})</span>
        <button class="btn-green" onclick={openAddProvider}>+ ADD PROVIDER</button>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>NAME</th>
            <th>TYPE</th>
            <th>SERVER</th>
            <th>STATUS</th>
            <th style="width: 220px;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {#each authProviders as p, i}
            <tr style="{p.status !== 'active' ? 'opacity: 0.5;' : ''}">
              <td>{i + 1}</td>
              <td style="font-weight: 700;">{p.name}</td>
              <td>
                <span class="tag-label"
                  class:tag-label-green={p.type === 'local'}
                  class:tag-label-secondary={p.type === 'keycloak'}
                  class:tag-label-warning={p.type === 'ldap'}
                  style={p.type === 'google' ? 'background: #4285f4; color: white;' : p.type === 'microsoft' ? 'background: #00a4ef; color: white;' : ''}>
                  {p.type.toUpperCase()}
                </span>
              </td>
              <td style="font-size: 10px; color: var(--color-on-surface-dim);">
                {#if p.type === 'ldap'}{p.config?.host || '\u2014'}:{p.config?.port || '389'}
                {:else if p.type === 'keycloak'}{p.config?.url || '\u2014'} / {p.config?.realm || 'master'}
                {:else if p.type === 'google'}accounts.google.com
                {:else if p.type === 'microsoft'}{p.config?.tenant_id || 'common'}.microsoft.com
                {:else}(built-in){/if}
              </td>
              <td>
                <span class="tag-label" class:tag-label-green={p.status === 'active'} class:tag-label-error={p.status === 'disabled'}>
                  {p.status}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 4px;">
                  {#if p.type !== 'local'}
                    <button class="btn-primary" onclick={() => openEditProvider(p)}>EDIT</button>
                    <button class="btn-ghost" onclick={() => testProvider(p.id)}>TEST</button>
                    <button class="btn-error" onclick={() => deleteProvider(p.id)}>DEL</button>
                  {:else}
                    <span style="font-size: 10px; color: var(--color-on-surface-dim); padding: 6px;">DEFAULT</span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if testResult}
        <div style="margin-top: 8px; padding: 8px 12px; font-size: 11px; font-weight: 700; border: 2px solid var(--color-on-surface);"
          class:tag-label-green={testResult.startsWith('\u2713')}
          style:background={testResult.startsWith('\u2713') ? '#e8f5e9' : '#ffeaea'}
          style:color={testResult.startsWith('\u2713') ? 'var(--color-primary)' : 'var(--color-error)'}>
          {testResult}
        </div>
      {/if}

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
              <IconPicker value={formIcon} onSelect={(v) => formIcon = v} />
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

<!-- AUTH PROVIDER MODAL -->
{#if showAuthModal}
  <div class="modal-overlay" onclick={() => showAuthModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()} style="max-width: 500px;">
      <div class="modal-header">
        {editingProvider ? 'EDIT PROVIDER' : 'ADD AUTH PROVIDER'}
        <button onclick={() => showAuthModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <div style="display: flex; flex-direction: column; gap: 10px;">

          {#if !editingProvider}
            <div>
              <label class="form-label">PROVIDER TYPE</label>
              <div style="display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" bind:group={providerType} value="ldap" /> LDAP
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" bind:group={providerType} value="keycloak" /> KEYCLOAK
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" bind:group={providerType} value="google" /> GOOGLE
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="radio" bind:group={providerType} value="microsoft" /> MICROSOFT
                </label>
              </div>
            </div>
          {/if}

          <div>
            <label class="form-label">NAME *</label>
            <input class="form-input" bind:value={providerName} placeholder={providerType === 'ldap' ? 'Corp LDAP' : providerType === 'google' ? 'Google Workspace' : providerType === 'microsoft' ? 'Microsoft Entra' : 'Corp SSO'} />
          </div>

          {#if providerType === 'ldap'}
            <div style="display: flex; gap: 10px;">
              <div style="flex: 1;">
                <label class="form-label">HOST *</label>
                <input class="form-input" bind:value={ldapHost} placeholder="10.16.73.150" />
              </div>
              <div style="width: 80px;">
                <label class="form-label">PORT</label>
                <input class="form-input" bind:value={ldapPort} placeholder="389" />
              </div>
            </div>
            <div>
              <label class="form-label">APPLICATION DN</label>
              <input class="form-input" bind:value={ldapAppDn} placeholder="CN=Administrator,CN=Users,DC=chl,DC=local" />
            </div>
            <div>
              <label class="form-label">APPLICATION DN PASSWORD</label>
              <input class="form-input" type="password" bind:value={ldapAppDnPassword} placeholder="••••••••" />
            </div>
            <div>
              <label class="form-label">ATTRIBUTE FOR MAIL</label>
              <input class="form-input" bind:value={ldapMailAttr} placeholder="userPrincipalName" />
            </div>
            <div>
              <label class="form-label">ATTRIBUTE FOR USERNAME</label>
              <input class="form-input" bind:value={ldapUsernameAttr} placeholder="sAMAccountName" />
            </div>
            <div>
              <label class="form-label">SEARCH BASE</label>
              <input class="form-input" bind:value={ldapSearchBase} placeholder="DC=chl,DC=local" />
            </div>
            <div>
              <label class="form-label">SEARCH FILTER</label>
              <input class="form-input" bind:value={ldapSearchFilter} placeholder="(&(objectClass=user)(sAMAccountName={'{username}'}))" />
            </div>
            <div>
              <label class="form-label">GROUP ATTRIBUTE</label>
              <input class="form-input" bind:value={ldapGroupAttr} placeholder="memberOf" />
            </div>
            <div>
              <label class="form-label">TLS</label>
              <div style="display: flex; gap: 12px; margin-top: 4px;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                  <input type="checkbox" bind:checked={ldapTls} /> ENABLE TLS
                </label>
              </div>
            </div>
          {:else if providerType === 'keycloak'}
            <div>
              <label class="form-label">KEYCLOAK URL *</label>
              <input class="form-input" bind:value={kcUrl} placeholder="https://sso.company.com" />
            </div>
            <div>
              <label class="form-label">REALM</label>
              <input class="form-input" bind:value={kcRealm} placeholder="master" />
            </div>
            <div>
              <label class="form-label">CLIENT ID *</label>
              <input class="form-input" bind:value={kcClientId} placeholder="city-ai-hub" />
            </div>
            <div>
              <label class="form-label">CLIENT SECRET</label>
              <input class="form-input" type="password" bind:value={kcClientSecret} placeholder="secret" />
            </div>
          {:else if providerType === 'google'}
            <div style="padding: 6px 10px; background: #e3f2fd; font-size: 10px; border-left: 3px solid #4285f4;">
              Create OAuth 2.0 credentials at <strong>console.cloud.google.com</strong> &gt; APIs &amp; Services &gt; Credentials.
              Set redirect URI to: <code>/api/auth/oidc/callback</code>
            </div>
            <div>
              <label class="form-label">CLIENT ID *</label>
              <input class="form-input" bind:value={googleClientId} placeholder="xxxx.apps.googleusercontent.com" />
            </div>
            <div>
              <label class="form-label">CLIENT SECRET *</label>
              <input class="form-input" type="password" bind:value={googleClientSecret} placeholder="GOCSPX-..." />
            </div>
          {:else if providerType === 'microsoft'}
            <div style="padding: 6px 10px; background: #e3f2fd; font-size: 10px; border-left: 3px solid #00a4ef;">
              Register app at <strong>portal.azure.com</strong> &gt; App registrations.
              Set redirect URI to: <code>/api/auth/oidc/callback</code>
            </div>
            <div>
              <label class="form-label">TENANT ID</label>
              <input class="form-input" bind:value={msTenantId} placeholder="common" />
              <span style="font-size: 9px; color: var(--color-on-surface-dim);">Use "common" for multi-tenant, or your Azure AD tenant ID</span>
            </div>
            <div>
              <label class="form-label">CLIENT ID *</label>
              <input class="form-input" bind:value={msClientId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div>
              <label class="form-label">CLIENT SECRET *</label>
              <input class="form-input" type="password" bind:value={msClientSecret} placeholder="secret" />
            </div>
          {/if}

          <div>
            <label class="form-label">STATUS</label>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={providerStatus} value="active" /> ACTIVE
              </label>
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                <input type="radio" bind:group={providerStatus} value="disabled" /> DISABLED
              </label>
            </div>
          </div>

        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showAuthModal = false}>CANCEL</button>
        <button class="btn-green" onclick={saveProvider}
          disabled={!providerName || (providerType === 'ldap' && !ldapHost) || (providerType === 'keycloak' && (!kcUrl || !kcClientId)) || (providerType === 'google' && !googleClientId) || (providerType === 'microsoft' && !msClientId)}>
          {editingProvider ? 'UPDATE' : 'SAVE PROVIDER'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- RESET PASSWORD MODAL -->
{#if showPasswordModal}
  <div class="modal-overlay" onclick={() => showPasswordModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()} style="max-width: 400px;">
      <div class="modal-header">
        RESET PASSWORD
        <button onclick={() => showPasswordModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <p style="font-size: 12px; margin: 0 0 12px 0;">Set new password for <strong>{passwordUsername}</strong></p>
        <label class="form-label">NEW PASSWORD</label>
        <input class="form-input" type="password" bind:value={newPassword} placeholder="Minimum 4 characters" />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showPasswordModal = false}>CANCEL</button>
        <button class="btn-green" onclick={submitPasswordReset} disabled={!newPassword || newPassword.length < 4}>RESET PASSWORD</button>
      </div>
    </div>
  </div>
{/if}

<!-- CREATE USER MODAL -->
{#if showCreateUserModal}
  <div class="modal-overlay" onclick={() => showCreateUserModal = false}>
    <div class="modal-body" onclick={(e) => e.stopPropagation()} style="max-width: 450px;">
      <div class="modal-header">
        CREATE LOCAL USER
        <button onclick={() => showCreateUserModal = false} style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer;">x</button>
      </div>
      <div class="modal-content">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label class="form-label">USERNAME *</label>
            <input class="form-input" bind:value={newUserUsername} placeholder="johndoe" />
          </div>
          <div>
            <label class="form-label">DISPLAY NAME</label>
            <input class="form-input" bind:value={newUserDisplayName} placeholder="John Doe" />
          </div>
          <div>
            <label class="form-label">EMAIL</label>
            <input class="form-input" type="email" bind:value={newUserEmail} placeholder="john@company.com" />
          </div>
          <div>
            <label class="form-label">PASSWORD *</label>
            <input class="form-input" type="password" bind:value={newUserPassword} placeholder="Minimum 4 characters" />
          </div>
          <div>
            <label class="form-label">ROLE</label>
            <select class="form-select" bind:value={newUserRole}>
              <option value="user">USER</option>
              <option value="viewer">VIEWER</option>
              <option value="admin">ADMIN</option>
              <option value="super_admin">SUPER_ADMIN</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => showCreateUserModal = false}>CANCEL</button>
        <button class="btn-green" onclick={createUser} disabled={newUserSaving || !newUserUsername || !newUserPassword || newUserPassword.length < 4}>
          {newUserSaving ? 'CREATING...' : 'CREATE USER'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- TOAST -->
{#if toast}
  <div class="toast">{toast}</div>
{/if}
