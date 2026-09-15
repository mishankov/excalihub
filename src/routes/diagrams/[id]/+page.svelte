<script lang="ts">
  import Editor from '$lib/components/Editor.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.diagram.title} · Excalihub</title></svelte:head>
{#key data.diagram.id}<Editor diagram={data.diagram} />{/key}
