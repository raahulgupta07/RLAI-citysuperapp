<script lang="ts">
  let { value = '', onSelect = (v: string) => {} }: { value?: string; onSelect?: (v: string) => void } = $props();

  let showPicker = $state(false);
  let search = $state('');

  const icons = [
    { emoji: '🤖', label: 'Robot' },
    { emoji: '🧠', label: 'Brain' },
    { emoji: '⚡', label: 'Zap' },
    { emoji: '🔍', label: 'Search' },
    { emoji: '📊', label: 'Chart' },
    { emoji: '📈', label: 'Trending' },
    { emoji: '🛡️', label: 'Shield' },
    { emoji: '🔒', label: 'Lock' },
    { emoji: '🔑', label: 'Key' },
    { emoji: '💬', label: 'Chat' },
    { emoji: '📝', label: 'Notes' },
    { emoji: '📄', label: 'Document' },
    { emoji: '📁', label: 'Folder' },
    { emoji: '📋', label: 'Clipboard' },
    { emoji: '🗄️', label: 'Database' },
    { emoji: '💾', label: 'Save' },
    { emoji: '🖥️', label: 'Desktop' },
    { emoji: '💻', label: 'Laptop' },
    { emoji: '⚙️', label: 'Settings' },
    { emoji: '🔧', label: 'Wrench' },
    { emoji: '🛠️', label: 'Tools' },
    { emoji: '🔨', label: 'Hammer' },
    { emoji: '🌐', label: 'Globe' },
    { emoji: '☁️', label: 'Cloud' },
    { emoji: '🏢', label: 'Building' },
    { emoji: '🏥', label: 'Hospital' },
    { emoji: '🏭', label: 'Factory' },
    { emoji: '🏪', label: 'Store' },
    { emoji: '💼', label: 'Briefcase' },
    { emoji: '📦', label: 'Package' },
    { emoji: '🚀', label: 'Rocket' },
    { emoji: '🎯', label: 'Target' },
    { emoji: '✨', label: 'Sparkles' },
    { emoji: '🪄', label: 'Wand' },
    { emoji: '⚛️', label: 'Atom' },
    { emoji: '🔬', label: 'Microscope' },
    { emoji: '🧪', label: 'Flask' },
    { emoji: '📡', label: 'Satellite' },
    { emoji: '🎓', label: 'Education' },
    { emoji: '📚', label: 'Books' },
    { emoji: '📖', label: 'Book' },
    { emoji: '🗂️', label: 'Files' },
    { emoji: '🏷️', label: 'Tag' },
    { emoji: '⭐', label: 'Star' },
    { emoji: '🔥', label: 'Fire' },
    { emoji: '💡', label: 'Idea' },
    { emoji: '🔔', label: 'Bell' },
    { emoji: '📧', label: 'Email' },
    { emoji: '📱', label: 'Phone' },
    { emoji: '🗺️', label: 'Map' },
    { emoji: '📍', label: 'Pin' },
    { emoji: '🧭', label: 'Compass' },
    { emoji: '🔗', label: 'Link' },
    { emoji: '📐', label: 'Design' },
    { emoji: '🎨', label: 'Art' },
    { emoji: '🖼️', label: 'Image' },
    { emoji: '📷', label: 'Camera' },
    { emoji: '🎬', label: 'Video' },
    { emoji: '🎤', label: 'Mic' },
    { emoji: '👁️', label: 'Eye' },
    { emoji: '👥', label: 'Users' },
    { emoji: '👤', label: 'User' },
    { emoji: '🤝', label: 'Handshake' },
    { emoji: '💰', label: 'Money' },
    { emoji: '🛒', label: 'Cart' },
    { emoji: '🚚', label: 'Truck' },
    { emoji: '⏰', label: 'Clock' },
    { emoji: '📅', label: 'Calendar' },
    { emoji: '✅', label: 'Check' },
    { emoji: '❤️', label: 'Heart' },
    { emoji: '🏆', label: 'Trophy' },
    { emoji: '👑', label: 'Crown' },
    { emoji: '💎', label: 'Gem' },
    { emoji: '🎮', label: 'Game' },
    { emoji: '🧩', label: 'Puzzle' },
    { emoji: '📊', label: 'Analytics' },
    { emoji: '🔄', label: 'Sync' },
    { emoji: '⬆️', label: 'Upload' },
    { emoji: '⬇️', label: 'Download' },
    { emoji: '🔀', label: 'Merge' },
  ];

  const filtered = $derived(() => {
    if (!search) return icons;
    const q = search.toLowerCase();
    return icons.filter(i => i.label.toLowerCase().includes(q));
  });

  function select(emoji: string) {
    onSelect(emoji);
    showPicker = false;
    search = '';
  }
</script>

<div style="position: relative;">
  <button
    type="button"
    class="icon-trigger"
    onclick={() => showPicker = !showPicker}
  >
    <span style="font-size: 20px;">{value || '📦'}</span>
    <span style="font-size: 10px; color: var(--color-on-surface-dim); text-transform: uppercase; margin-left: 6px;">Change</span>
  </button>

  {#if showPicker}
    <div class="icon-dropdown">
      <div style="padding: 8px; border-bottom: 2px solid var(--color-on-surface);">
        <input
          class="form-input"
          style="padding: 6px 10px; font-size: 11px;"
          bind:value={search}
          placeholder="Search icons..."
        />
      </div>
      <div class="icon-grid">
        {#each filtered() as icon}
          <button
            type="button"
            class="icon-item"
            class:icon-item-active={value === icon.emoji}
            onclick={() => select(icon.emoji)}
            title={icon.label}
          >
            {icon.emoji}
          </button>
        {/each}
        {#if filtered().length === 0}
          <div style="grid-column: 1/-1; text-align: center; padding: 12px; font-size: 10px; color: var(--color-on-surface-dim); text-transform: uppercase;">No match</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .icon-trigger {
    display: flex;
    align-items: center;
    width: 100%;
    background: var(--color-surface-bright);
    border: 2px solid var(--color-on-surface);
    border-right-width: 3px;
    border-bottom-width: 3px;
    padding: 6px 12px;
    cursor: pointer;
    font-family: 'Space Grotesk', monospace;
  }
  .icon-trigger:hover { background: var(--color-surface-dim); }

  .icon-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--color-surface);
    border: 2px solid var(--color-on-surface);
    border-right-width: 4px;
    border-bottom-width: 4px;
    box-shadow: 4px 4px 0px 0px var(--color-on-surface);
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
    padding: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .icon-item {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    background: none;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 20px;
    padding: 4px;
  }
  .icon-item:hover {
    background: var(--color-primary-container);
    border-color: var(--color-on-surface);
  }
  .icon-item-active {
    background: var(--color-on-surface);
    border-color: var(--color-on-surface);
  }
</style>
