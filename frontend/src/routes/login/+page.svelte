<script lang="ts">
  import { onMount } from 'svelte';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let showPassword = $state(false);
  let rememberMe = $state(false);
  let authMethod = $state<'local' | 'ldap' | 'sso'>('local');
  let registerMode = $state(false);
  let ssoEnabled = $state(false);
  let ssoProviders = $state<{ id: number; name: string; type: string; realm: string }[]>([]);
  let selectedSsoProvider = $state(0);
  // Auth method visibility — start hidden until config loads
  let authConfigLoaded = $state(false);
  let authLocalEnabled = $state(false);
  let authLdapEnabled = $state(false);
  let authSsoEnabled = $state(false);

  // Terminal animation state
  let terminalLines = $state<{ text: string; class: string }[]>([]);
  let terminalDone = $state(false);
  let showTransition = $state(false);
  let transitionProgress = $state(0);
  let transLines = $state<{text: string; class: string}[]>([]);
  let loggedInUser = $state('')
  let loggedInRole = $state('');

  // Boot messages for SuperApp
  const bootMessages = [
    { text: '[HUB] Waking up...', class: 'terminal-dim', delay: 400 },
    { text: '\u{1F916} Hey! I\'m City AI Hub.', class: 'terminal-ok', delay: 600 },
    { text: '   Your unified AI command center.', class: 'terminal-dim', delay: 300 },
    { text: '   Let me get everything ready...', class: 'terminal-dim', delay: 400 },
    { text: '   \u25C6 Agents \u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7 10 FOUND', class: 'terminal-ok', delay: 250 },
    { text: '   \u25C6 Authentication \u00B7\u00B7\u00B7 LDAP READY', class: 'terminal-ok', delay: 250 },
    { text: '   \u25C6 Portal \u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7 ONLINE', class: 'terminal-ok', delay: 250 },
    { text: '   \u25C6 Security \u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7 ACTIVE', class: 'terminal-ok', delay: 250 },
    { text: '   \u25C6 Embeddings \u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7 ENABLED', class: 'terminal-ok', delay: 250 },
    { text: '   All systems go.', class: 'terminal-ok', delay: 400 },
    { text: 'CITY', class: 'terminal-big', delay: 200 },
    { text: 'AI', class: 'terminal-big', delay: 200 },
    { text: 'HUB', class: 'terminal-big', delay: 200 },
    { text: '   Ready when you are, operator.', class: 'terminal-dim', delay: 400 },
    { text: '   Login to start \u2192', class: 'terminal-blink', delay: 0 },
  ];

  onMount(async () => {
    // Check auth config (which methods are enabled + SSO providers)
    try {
      const res = await fetch('/api/auth/oidc/config');
      const data = await res.json();
      ssoEnabled = data.enabled;
      ssoProviders = data.providers || [];
      if (ssoProviders.length > 0) selectedSsoProvider = ssoProviders[0].id;
      // Auth method toggles
      if (data.authMethods) {
        authLocalEnabled = data.authMethods.local !== false;
        authLdapEnabled = data.authMethods.ldap !== false;
        authSsoEnabled = data.authMethods.sso !== false;
      }
      // Default to first enabled method
      if (authLdapEnabled) authMethod = 'ldap';
      else if (authLocalEnabled) authMethod = 'local';
      else if (authSsoEnabled) authMethod = 'sso';
    } catch {
      // Fallback: at least show LOCAL
      authLocalEnabled = true;
    }
    authConfigLoaded = true;

    // Check for error in URL params
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      error = urlError.replace(/_/g, ' ').toUpperCase();
    }

    // Start terminal typing animation
    for (let i = 0; i < bootMessages.length; i++) {
      const msg = bootMessages[i];
      // Type each character
      if (msg.text.length > 0) {
        let currentText = '';
        const charDelay = Math.max(8, Math.min(25, msg.delay / msg.text.length));
        for (let c = 0; c < msg.text.length; c++) {
          currentText += msg.text[c];
          if (terminalLines.length > i) {
            terminalLines[i] = { text: currentText, class: msg.class };
          } else {
            terminalLines = [...terminalLines, { text: currentText, class: msg.class }];
          }
          await new Promise(r => setTimeout(r, charDelay));
        }
      } else {
        terminalLines = [...terminalLines, { text: '', class: '' }];
      }
      if (msg.delay > 0) {
        await new Promise(r => setTimeout(r, Math.max(50, msg.delay - (msg.text.length * 15))));
      }
    }
    terminalDone = true;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }

  async function handleLogin() {
    if (authMethod === 'sso') {
      handleSSOLogin();
      return;
    }
    if (!username || !password) {
      error = 'All fields required';
      return;
    }
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          authMethod,
          register: registerMode,
          rememberMe,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Login failed';
        loading = false;
        return;
      }
      // Show CLI transition screen
      loggedInUser = data.user?.username || username;
      loggedInRole = data.user?.role || 'user';
      showTransition = true;
      await runTransition();
    } catch {
      error = 'Connection failed';
      loading = false;
    }
  }

  function timeNow(): string {
    const d = new Date();
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} \u00B7 ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
  }

  function padDots(name: string, maxLen: number = 38): string {
    const dots = '\u00B7'.repeat(Math.max(2, maxLen - name.length));
    return `${name} ${dots}`;
  }

  async function runTransition() {
    // Fetch real apps from DB
    let appList: any[] = [];
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const appsRes = await fetch('/home', { headers: { 'Accept': 'application/json' } });
        // Fallback: fetch via the apps endpoint
      }
    } catch {}

    // Try direct API call to get apps (we're now authenticated via cookie)
    try {
      const res = await fetch('/api/apps');
      if (res.ok) {
        const data = await res.json();
        appList = data.apps || [];
      }
    } catch {}

    // Build dynamic lines
    const lines: { text: string; class: string; delay: number }[] = [
      { text: '[HUB] Authentication successful.', class: 'trans-green', delay: 300 },
      { text: `> Operator: ${loggedInUser} (${loggedInRole})`, class: 'trans-bright', delay: 250 },
      { text: `> Session: ${timeNow()}`, class: 'trans-bright', delay: 250 },
      { text: `> Auth method: ${authMethod.toUpperCase()}`, class: 'trans-bright', delay: 200 },
      { text: '', class: '', delay: 150 },
      { text: 'Initializing workspace...', class: 'trans-dim', delay: 350 },
      { text: '', class: '', delay: 100 },
    ];

    if (appList.length > 0) {
      lines.push({ text: `\u25C6 ${padDots('Agent registry')} ${appList.length} FOUND`, class: 'trans-status', delay: 200 });

      // Show each app loading
      for (const app of appList) {
        const icon = app.icon || '\u25C6';
        const mode = app.launch_mode === 'embed' ? 'EMBEDDED' : 'ONLINE';
        lines.push({ text: `  ${icon} ${padDots(app.name, 34)} ${mode}`, class: 'trans-status', delay: 120 });
      }
    } else {
      lines.push({ text: `\u25C6 ${padDots('Agent registry')} LOADING`, class: 'trans-status', delay: 200 });
    }

    lines.push(
      { text: '', class: '', delay: 100 },
      { text: `\u25C6 ${padDots('Permissions')} ${loggedInRole === 'super_admin' ? 'FULL ACCESS' : 'GRANTED'}`, class: 'trans-status', delay: 180 },
      { text: `\u25C6 ${padDots('Favorites')} SYNCED`, class: 'trans-status', delay: 150 },
      { text: `\u25C6 ${padDots('Dashboard')} READY`, class: 'trans-status', delay: 150 },
      { text: `\u25C6 ${padDots('Usage analytics')} TRACKING`, class: 'trans-status', delay: 150 },
      { text: `\u25C6 ${padDots('Embed proxy')} ACTIVE`, class: 'trans-status', delay: 150 },
      { text: '', class: '', delay: 150 },
      { text: `All systems operational. ${appList.length} agents ready.`, class: 'trans-green', delay: 350 },
      { text: '', class: '', delay: 200 },
      { text: '> Entering CITY AI HUB...', class: 'trans-enter', delay: 400 },
    );

    for (const line of lines) {
      transLines = [...transLines, { text: line.text, class: line.class }];
      transitionProgress = Math.min(100, Math.round((transLines.length / lines.length) * 100));
      await new Promise(r => setTimeout(r, line.delay));
    }

    await new Promise(r => setTimeout(r, 400));
    window.location.href = '/home';
  }

  async function handleSSOLogin() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/auth/oidc/login?provider_id=${selectedSsoProvider}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        error = data.error || 'SSO not configured';
        loading = false;
      }
    } catch {
      error = 'SSO connection failed';
      loading = false;
    }
  }
</script>

{#if showTransition}
  <!-- Transition Screen — Full CLI Boot -->
  <div class="login-page" style="align-items: center; justify-content: center;">
    <div class="transition-terminal">
      <div class="terminal-titlebar">
        <span class="terminal-dot" style="background:#ff5f56"></span>
        <span class="terminal-dot" style="background:#ffbd2e"></span>
        <span class="terminal-dot" style="background:#27c93f"></span>
        <span style="margin-left: 8px; font-size: 10px; color: rgba(255,255,255,0.3);">hub@workspace — initializing</span>
      </div>
      <div class="terminal-body" style="padding: 20px 24px; min-height: 380px;">
        <!-- Robot icon -->
        <div style="margin-bottom: 12px;">
          <svg width="36" height="40" viewBox="0 0 80 90" fill="none" style="animation: robotFloat 3s ease-in-out infinite;">
            <line x1="40" y1="0" x2="40" y2="18" stroke="#00fc40" stroke-width="2"/>
            <circle cx="40" cy="4" r="4" fill="#00fc40" style="animation: antennaPulse 2s ease-in-out infinite;"/>
            <rect x="16" y="18" width="48" height="36" stroke="#00fc40" stroke-width="2.5" fill="none"/>
            <circle cx="30" cy="36" r="5" fill="#00fc40"/><circle cx="50" cy="36" r="5" fill="#00fc40"/>
            <line x1="28" y1="46" x2="52" y2="46" stroke="#00fc40" stroke-width="2"/>
            <rect x="24" y="58" width="32" height="20" stroke="#00fc40" stroke-width="2" fill="none"/>
          </svg>
        </div>

        {#each transLines as line}
          {#if line.text === ''}
            <div style="height: 6px;"></div>
          {:else if line.class === 'trans-green'}
            <div style="color: #00fc40; font-weight: 700; font-size: 13px;">{line.text}</div>
          {:else if line.class === 'trans-bright'}
            <div style="color: rgba(255,255,255,0.85); font-weight: 700;">{line.text}</div>
          {:else if line.class === 'trans-dim'}
            <div style="color: rgba(255,255,255,0.4);">{line.text}</div>
          {:else if line.class === 'trans-status'}
            <div style="color: rgba(255,255,255,0.5);">
              {line.text.slice(0, line.text.lastIndexOf(' ') + 1)}<span style="color: #00fc40; font-weight: 700;">{line.text.split(' ').pop()}</span>
            </div>
          {:else if line.class === 'trans-enter'}
            <div style="color: #00fc40; font-weight: 900; font-size: 14px;">{line.text}</div>
          {:else}
            <div style="color: rgba(255,255,255,0.5);">{line.text}</div>
          {/if}
        {/each}

        {#if transLines.length > 0 && transitionProgress < 100}
          <span style="color: #00fc40; animation: termBlink 0.7s step-end infinite;">_</span>
        {/if}
      </div>
      <!-- Progress bar -->
      <div style="height: 3px; background: rgba(255,255,255,0.05);">
        <div style="background: #00fc40; height: 100%; width: {transitionProgress}%; transition: width 0.15s ease-out;"></div>
      </div>
      <!-- Footer under terminal -->
      <div style="display: flex; justify-content: space-between; padding: 8px 12px; font-size: 9px; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.1em;">
        <span>CITY AI HUB v1.0</span>
        <span>SECURE SESSION</span>
        <span>ENCRYPTED</span>
      </div>
    </div>
  </div>
{:else}
  <!-- Login Page -->
  <div class="login-page">
    <!-- Header -->
    <header class="login-header">
      <div class="login-header-left">
        <svg class="header-robot-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="8" width="16" height="12" rx="0" stroke="#00fc40" stroke-width="2" fill="none"/>
          <rect x="9" y="2" width="6" height="6" rx="0" stroke="#00fc40" stroke-width="2" fill="none"/>
          <circle cx="9" cy="14" r="1.5" fill="#00fc40"/>
          <circle cx="15" cy="14" r="1.5" fill="#00fc40"/>
          <line x1="2" y1="14" x2="4" y2="14" stroke="#00fc40" stroke-width="2"/>
          <line x1="20" y1="14" x2="22" y2="14" stroke="#00fc40" stroke-width="2"/>
        </svg>
        <span class="header-badge">CITY AI</span>
      </div>
      <div class="login-header-right">SECURE_TERMINAL</div>
    </header>

    <!-- Main -->
    <main class="login-main">
      <div class="login-container">
        <!-- LEFT: Terminal -->
        <div class="login-branding">
          <div class="terminal-window">
            <div class="terminal-titlebar">
              <span class="terminal-dot" style="background:#ff5f56"></span>
              <span class="terminal-dot" style="background:#ffbd2e"></span>
              <span class="terminal-dot" style="background:#27c93f"></span>
            </div>
            <div class="terminal-body">
              <!-- Robot Icon -->
              <div class="robot-icon-container">
                <svg class="robot-icon" viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Antenna -->
                  <line x1="40" y1="0" x2="40" y2="18" stroke="#00fc40" stroke-width="2" class="antenna-line"/>
                  <circle cx="40" cy="4" r="4" fill="#00fc40" class="antenna-tip"/>
                  <!-- Head -->
                  <rect x="16" y="18" width="48" height="36" stroke="#00fc40" stroke-width="2.5" fill="none"/>
                  <!-- Eyes -->
                  <rect x="26" y="30" width="10" height="10" fill="#00fc40" class="robot-eye robot-eye-left"/>
                  <rect x="44" y="30" width="10" height="10" fill="#00fc40" class="robot-eye robot-eye-right"/>
                  <!-- Mouth -->
                  <line x1="30" y1="46" x2="50" y2="46" stroke="#00fc40" stroke-width="2"/>
                  <!-- Body -->
                  <rect x="20" y="58" width="40" height="24" stroke="#00fc40" stroke-width="2.5" fill="none"/>
                  <!-- Arms -->
                  <line x1="8" y1="62" x2="20" y2="62" stroke="#00fc40" stroke-width="2.5"/>
                  <line x1="60" y1="62" x2="72" y2="62" stroke="#00fc40" stroke-width="2.5"/>
                  <!-- Body details -->
                  <rect x="32" y="64" width="16" height="4" fill="#00fc40" opacity="0.5"/>
                  <rect x="32" y="72" width="16" height="4" fill="#00fc40" opacity="0.3"/>
                </svg>
              </div>

              <!-- Terminal Lines -->
              {#each terminalLines as line}
                <div class="terminal-line {line.class}">{line.text}</div>
              {/each}
              {#if !terminalDone}
                <span class="cursor-blink">_</span>
              {/if}
            </div>
          </div>
        </div>

        <!-- RIGHT: Login Form -->
        <div class="login-form-card">
          <div class="login-title">ACCESS_PORTAL</div>
          <div class="login-subtitle">AUTHORIZED ACCESS ONLY. LOGGING ACTIVE.</div>

          <!-- Auth Method Tabs -->
          {#if authConfigLoaded}
          <div class="auth-tabs">
            {#if authLocalEnabled}
              <button
                class="auth-tab"
                class:auth-tab-active={authMethod === 'local'}
                onclick={() => { authMethod = 'local'; error = ''; registerMode = false; }}
              >LOCAL</button>
            {/if}
            {#if authLdapEnabled}
              <button
                class="auth-tab"
                class:auth-tab-active={authMethod === 'ldap'}
                onclick={() => { authMethod = 'ldap'; error = ''; registerMode = false; }}
              >LDAP</button>
            {/if}
            {#if authSsoEnabled}
              <button
                class="auth-tab"
                class:auth-tab-active={authMethod === 'sso'}
                onclick={() => { authMethod = 'sso'; error = ''; registerMode = false; }}
              >SSO</button>
            {/if}
          </div>
          {/if}

          {#if error}
            <div class="login-error">&gt; ERROR: {error}</div>
          {/if}

          {#if authMethod === 'sso'}
            <!-- SSO Mode -->
            <div class="sso-section">
              {#if ssoProviders.length === 0}
                <div class="sso-info">No SSO providers configured</div>
                <div class="sso-disabled-note">Configure SSO providers via Settings &gt; AUTH tab</div>
              {:else}
                <div class="sso-info">Select your identity provider</div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  {#each ssoProviders as p}
                    <button
                      class="login-btn sso-provider-btn"
                      style={p.type === 'google' ? 'border-left: 4px solid #4285f4;' : p.type === 'microsoft' ? 'border-left: 4px solid #00a4ef;' : 'border-left: 4px solid #007518;'}
                      onclick={() => { selectedSsoProvider = p.id; handleSSOLogin(); }}
                      disabled={loading}
                    >
                      <span class="sso-provider-icon">
                        {#if p.type === 'google'}
                          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        {:else if p.type === 'microsoft'}
                          <svg viewBox="0 0 24 24" width="18" height="18"><rect fill="#F25022" x="1" y="1" width="10" height="10"/><rect fill="#7FBA00" x="13" y="1" width="10" height="10"/><rect fill="#00A4EF" x="1" y="13" width="10" height="10"/><rect fill="#FFB900" x="13" y="13" width="10" height="10"/></svg>
                        {:else}
                          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#007518" d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7.17 3.58L12 11.34 4.83 7.76 12 4.18z"/></svg>
                        {/if}
                      </span>
                      <span>
                        {#if loading && selectedSsoProvider === p.id}
                          REDIRECTING...
                        {:else}
                          LOGIN WITH {p.name.toUpperCase()}
                        {/if}
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <!-- Local / LDAP Mode -->
            <div class="form-group">
              <label class="tag-label" for="login-username">OPERATOR_ID</label>
              <input
                id="login-username"
                type="text"
                bind:value={username}
                onkeydown={handleKeydown}
                class="login-input"
                placeholder={authMethod === 'ldap' ? 'Enter LDAP username' : 'Enter username'}
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label class="tag-label" for="login-password">ACCESS_KEY</label>
              <div class="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  bind:value={password}
                  onkeydown={handleKeydown}
                  class="login-input"
                  placeholder="Enter password"
                  autocomplete="current-password"
                />
                <button
                  class="password-toggle"
                  onclick={() => showPassword = !showPassword}
                  type="button"
                >{showPassword ? 'HIDE' : 'SHOW'}</button>
              </div>
            </div>

            {#if authMethod === 'ldap'}
              <div class="auth-method-note">(Authenticating via LDAP)</div>
            {/if}

            <label class="remember-me">
              <input type="checkbox" bind:checked={rememberMe} />
              <span>REMEMBER ME (30 DAYS)</span>
            </label>

            <button
              class="login-btn"
              onclick={handleLogin}
              disabled={loading}
            >
              {loading ? 'AUTHENTICATING...' : 'INITIATE_AUTHENTICATION'}
            </button>

          {/if}
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="login-footer">
      <span>&copy; 2026 CITY AI</span>
      <span>SECURE_TERMINAL</span>
    </footer>
  </div>
{/if}

<style>
  /* ===== Login Page Layout ===== */
  .login-page {
    background: #1a1a1e;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: 'Space Grotesk', monospace;
    color: #e0e0e0;
  }

  /* ===== Header ===== */
  .login-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 32px;
    border-bottom: 1px solid #2a2a2e;
  }

  .login-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-robot-icon {
    width: 24px;
    height: 24px;
  }

  .header-badge {
    background: #00fc40;
    color: #1a1a1e;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 8px;
    letter-spacing: 0.1em;
  }

  .login-header-right {
    font-size: 10px;
    color: #555;
    letter-spacing: 0.15em;
    font-weight: 700;
  }

  /* ===== Main ===== */
  .login-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
  }

  .login-container {
    display: flex;
    gap: 60px;
    max-width: 1100px;
    width: 100%;
    align-items: center;
  }

  /* ===== Terminal Window (Left) ===== */
  .login-branding {
    flex: 1;
    min-width: 0;
  }

  .terminal-window {
    background: #0d0d0f;
    border: 2px solid #2a2a2e;
    border-right-width: 4px;
    border-bottom-width: 4px;
    overflow: hidden;
  }

  .terminal-titlebar {
    background: #2a2a2e;
    padding: 10px 14px;
    display: flex;
    gap: 7px;
    align-items: center;
  }

  .terminal-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }

  .terminal-body {
    padding: 20px 24px;
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
  }

  .terminal-line {
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 1.4em;
  }

  .terminal-ok {
    color: #00fc40;
  }

  .terminal-dim {
    color: #8a8a9a;
  }

  .terminal-big {
    color: #00fc40;
    font-size: 40px;
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: 0.12em;
  }

  .terminal-blink {
    color: #00fc40;
    animation: termBlink 1.2s step-end infinite;
  }

  .cursor-blink {
    color: #00fc40;
    font-weight: 900;
    animation: termBlink 0.7s step-end infinite;
  }

  @keyframes termBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* ===== Robot Icon ===== */
  .robot-icon-container {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }

  .robot-icon {
    width: 56px;
    height: 64px;
    animation: robotFloat 3s ease-in-out infinite;
  }

  .antenna-tip {
    animation: antennaPulse 2s ease-in-out infinite;
  }

  .robot-eye {
    animation: eyeBlink 4s step-end infinite;
  }

  .robot-eye-left {
    animation-delay: 0s;
  }

  .robot-eye-right {
    animation-delay: 0.1s;
  }

  @keyframes robotFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes antennaPulse {
    0%, 100% { opacity: 1; r: 4; }
    50% { opacity: 0.5; r: 6; }
  }

  @keyframes eyeBlink {
    0%, 100% { transform: scaleY(1); }
    48% { transform: scaleY(1); }
    50% { transform: scaleY(0.1); }
    52% { transform: scaleY(1); }
  }

  /* ===== Login Form Card (Right) ===== */
  .login-form-card {
    flex: 1;
    background: #feffd6;
    padding: 36px 32px;
    border: 2px solid #1a1a1e;
    border-right-width: 4px;
    border-bottom-width: 4px;
    min-width: 340px;
    max-width: 400px;
  }

  .login-title {
    font-size: 28px;
    font-weight: 900;
    color: #1a1a1e;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  .login-subtitle {
    font-size: 9px;
    font-weight: 700;
    color: #888;
    letter-spacing: 0.12em;
    margin-bottom: 24px;
  }

  /* ===== Auth Tabs ===== */
  .auth-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 20px;
    border: 2px solid #1a1a1e;
  }

  .auth-tab {
    flex: 1;
    padding: 8px 0;
    background: #fff;
    color: #1a1a1e;
    border: none;
    border-right: 1px solid #1a1a1e;
    font-family: 'Space Grotesk', monospace;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .auth-tab:last-child {
    border-right: none;
  }

  .auth-tab:hover {
    background: #e8e8d0;
  }

  .auth-tab-active {
    background: #1a1a1e;
    color: #00fc40;
  }

  .auth-tab-active:hover {
    background: #1a1a1e;
  }

  /* ===== Form Elements ===== */
  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: inline-block;
    background: #383832;
    color: #feffd6;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.12em;
    padding: 2px 8px;
    margin-bottom: 6px;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .login-input {
    width: 100%;
    background: #fff;
    border: 2px solid #1a1a1e;
    border-right-width: 3px;
    border-bottom-width: 3px;
    padding: 10px 12px;
    font-family: 'Space Grotesk', monospace;
    font-size: 13px;
    color: #1a1a1e;
    outline: none;
    box-sizing: border-box;
  }

  .login-input:focus {
    border-color: #00fc40;
    box-shadow: 0 0 0 1px #00fc40;
  }

  .login-input::placeholder {
    color: #aaa;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-wrapper .login-input {
    padding-right: 60px;
  }

  .password-toggle {
    position: absolute;
    right: 8px;
    background: none;
    border: 1px solid #ccc;
    padding: 2px 8px;
    font-family: 'Space Grotesk', monospace;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #888;
    cursor: pointer;
  }

  .password-toggle:hover {
    border-color: #1a1a1e;
    color: #1a1a1e;
  }

  .auth-method-note {
    font-size: 10px;
    color: #888;
    margin-bottom: 12px;
    letter-spacing: 0.04em;
  }

  .remember-me {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #888;
    cursor: pointer;
    letter-spacing: 0.04em;
    margin-bottom: 12px;
    user-select: none;
  }

  .remember-me input[type="checkbox"] {
    cursor: pointer;
  }

  /* ===== Buttons ===== */
  .login-btn {
    width: 100%;
    background: #00fc40;
    color: #1a1a1e;
    border: 2px solid #1a1a1e;
    border-right-width: 4px;
    border-bottom-width: 4px;
    padding: 12px 16px;
    font-family: 'Space Grotesk', monospace;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .login-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0px 0px #1a1a1e;
  }

  .login-btn:active:not(:disabled) {
    transform: translate(0, 0);
    box-shadow: none;
  }

  .login-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sso-btn {
    margin-top: 20px;
    background: #1a1a1e;
    color: #00fc40;
    border-color: #00fc40;
  }

  .sso-btn:hover:not(:disabled) {
    box-shadow: 4px 4px 0px 0px #00fc40;
  }

  /* ===== SSO Section ===== */
  .sso-section {
    text-align: center;
    padding: 20px 0;
  }

  .sso-info {
    font-size: 11px;
    color: #888;
    letter-spacing: 0.04em;
    margin-bottom: 12px;
  }

  .sso-disabled-note {
    font-size: 9px;
    color: #c0392b;
    margin-top: 12px;
    letter-spacing: 0.02em;
  }

  .sso-provider-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #feffd6;
    color: #1a1a1e;
    text-align: left;
    padding: 12px 16px;
  }

  .sso-provider-btn:hover:not(:disabled) {
    box-shadow: 4px 4px 0px 0px #1a1a1e;
  }

  .sso-provider-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  /* ===== Error ===== */
  .login-error {
    color: #c0392b;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 14px;
    padding: 8px 10px;
    background: #fff0f0;
    border: 1px solid #c0392b;
  }

  /* ===== Register Toggle ===== */
  .register-toggle {
    display: block;
    width: 100%;
    background: none;
    border: none;
    font-family: 'Space Grotesk', monospace;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: #888;
    cursor: pointer;
    margin-top: 14px;
    text-align: center;
    padding: 6px 0;
  }

  .register-toggle:hover {
    color: #1a1a1e;
    text-decoration: underline;
  }

  /* ===== Footer ===== */
  .login-footer {
    display: flex;
    justify-content: space-between;
    padding: 16px 32px;
    border-top: 1px solid #2a2a2e;
    font-size: 9px;
    color: #555;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  /* ===== Transition ===== */
  .transition-terminal {
    width: 100%;
    max-width: 640px;
    background: #0d0d0f;
    border: 1px solid rgba(255,255,255,0.15);
    overflow: hidden;
    font-size: 12px;
    line-height: 1.7;
    font-family: 'Space Grotesk', monospace;
  }

  /* ===== Responsive ===== */
  @media (max-width: 768px) {
    .login-branding {
      display: none;
    }

    .login-container {
      justify-content: center;
    }

    .login-form-card {
      min-width: unset;
      max-width: 100%;
      width: 100%;
    }

    .login-main {
      padding: 20px 16px;
    }

    .login-header {
      padding: 12px 16px;
    }

    .login-footer {
      padding: 12px 16px;
    }
  }
</style>
