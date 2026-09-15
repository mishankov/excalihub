<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  let dark = $state(true);
  onMount(() => {
    const update = () =>
      (dark = document.documentElement.dataset.theme !== 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  });
  function toggle() {
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('excalihub-theme', theme);
    } catch {
      /* Theme remains usable when storage is unavailable. */
    }
  }
</script>

<button
  class="theme-switch icon-button"
  onclick={toggle}
  aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
  title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
  ><Icon name={dark ? 'sun' : 'moon'} size={19} /></button
>
