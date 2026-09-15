<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  onMount(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'excalihub-theme')
        document.documentElement.dataset.theme =
          event.newValue === 'light' ? 'light' : 'dark';
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  });
  let { children } = $props();
</script>

<svelte:head
  ><title>Excalihub</title><meta
    name="description"
    content="Your private Excalidraw diagram workspace."
  /></svelte:head
>
{@render children()}
