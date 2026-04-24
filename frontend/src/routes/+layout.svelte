<script lang="ts">
  import '../app.css';

  let { data, children } = $props();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const isLoginPage = $derived(!data.user);
  const isAdmin = $derived(data.user?.role === 'super_admin');
</script>

{#if isLoginPage}
  {@render children()}
{:else}
  <div style="display: flex; flex-direction: column; height: 100vh;">
    <!-- Navbar -->
    <nav class="navbar">
      <a href="/home" class="navbar-brand">CITY AI HUB</a>

      <div class="navbar-actions">
        {#if isAdmin}
          <button onclick={() => window.location.href = '/settings'} class="navbar-btn">SETTINGS</button>
        {/if}
        <span class="navbar-user">{data.user?.display_name || data.user?.username}</span>
        <button onclick={logout} class="navbar-btn">EXIT</button>
      </div>
    </nav>

    <!-- Page Content -->
    <main style="flex: 1; overflow-y: auto;">
      {@render children()}
    </main>
  </div>
{/if}
