<script lang="ts">
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import { onMount, untrack } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import Icon from './Icon.svelte';
  import { api, ApiError } from '$lib/api';
  import type { Diagram } from '$lib/types';
  import type { Snapshot } from '$lib/excalidraw';
  let { diagram }: { diagram: Diagram } = $props();
  let title = $state(untrack(() => diagram.title)),
    status = $state('Saved'),
    error = $state(''),
    ready = $state(false),
    conflict = $state(false),
    canvas: HTMLDivElement;
  let version = untrack(() => diagram.version),
    revision = 0,
    savedRevision = 0,
    lastSignature = '',
    snapshot: Snapshot | null = null,
    timer: ReturnType<typeof setTimeout> | undefined,
    inFlight: Promise<boolean> | null = null;
  let engine:
      ReturnType<typeof import('$lib/excalidraw').mountCanvas> | undefined,
    renderThumbnail: typeof import('$lib/excalidraw').thumbnail | undefined;
  let disposed = false;
  function schedule() {
    revision++;
    status = 'Unsaved changes';
    clearTimeout(timer);
    timer = setTimeout(() => void save(), 1200);
  }
  function changed(value: Snapshot) {
    snapshot = value;
    const signature = JSON.stringify(value);
    if (!lastSignature) {
      lastSignature = signature;
      return;
    }
    if (signature === lastSignature) return;
    lastSignature = signature;
    schedule();
  }
  async function save(): Promise<boolean> {
    clearTimeout(timer);
    if (inFlight) return inFlight;
    if (conflict) return false;
    if (!snapshot || revision === savedRevision) return true;
    inFlight = Promise.resolve().then(async () => {
      try {
        while (revision !== savedRevision && !disposed) {
          const currentRevision = revision,
            current = snapshot!,
            currentTitle = title.trim();
          if (!currentTitle) throw new Error('Enter a title before saving.');
          status = 'Saving…';
          error = '';
          let preview = diagram.thumbnail,
            darkPreview = diagram.thumbnail_dark;
          const [lightResult, darkResult] = await Promise.allSettled([
            renderThumbnail!(current, 'light'),
            renderThumbnail!(current, 'dark'),
          ]);
          // Saving must still work if either preview cannot render.
          if (lightResult.status === 'fulfilled') preview = lightResult.value;
          if (darkResult.status === 'fulfilled') darkPreview = darkResult.value;
          const { diagram: updated } = await api<{ diagram: Diagram }>(
            `/api/diagrams/${diagram.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                title: currentTitle,
                scene: current,
                thumbnail: preview,
                thumbnail_dark: darkPreview,
                version,
              }),
            },
          );
          version = updated.version;
          savedRevision = currentRevision;
        }
        status = 'Saved';
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) conflict = true;
        error = (e as Error).message;
        status = 'Not saved';
        return false;
      } finally {
        inFlight = null;
      }
    });
    return inFlight;
  }
  async function back() {
    if (await save()) await goto('/diagrams');
  }
  beforeNavigate((navigation) => {
    if (revision !== savedRevision) navigation.cancel();
  });
  onMount(() => {
    window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
    import('$lib/excalidraw')
      .then((module) => {
        if (disposed) return;
        renderThumbnail = module.thumbnail;
        engine = module.mountCanvas(canvas, diagram.scene, changed);
        ready = true;
      })
      .catch((e) => {
        error = 'Unable to load the drawing editor. Reload to try again.';
        console.error(e);
      });
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        void save();
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (revision !== savedRevision) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('beforeunload', unload);
    return () => {
      disposed = true;
      clearTimeout(timer);
      engine?.destroy();
      window.removeEventListener('keydown', key);
      window.removeEventListener('beforeunload', unload);
    };
  });
</script>

<main class="editor-page">
  <header class="editor-bar">
    <button
      class="icon-button"
      aria-label="Save and return to diagrams"
      onclick={back}><Icon name="back" /></button
    ><span class="editor-divider"></span><input
      class="diagram-title"
      aria-label="Diagram title"
      bind:value={title}
      maxlength="120"
      disabled={!ready}
      oninput={schedule}
    /><span class="save-status" role="status"
      >{#if status === 'Saved'}<Icon
          name="check"
          size={15}
        />{/if}{status}</span
    ><ThemeSwitch /><button
      class="download-action"
      disabled={!ready}
      onclick={() => engine?.download(title)}
      ><Icon name="download" size={17} /><span>Download</span></button
    ><button
      class="primary"
      onclick={() => void save()}
      disabled={!ready || status === 'Saving…' || conflict}
      ><Icon name="save" size={17} /><span>Save</span></button
    >
  </header>
  {#if error}<div class="error-banner" role="alert">
      {error}{#if ready}<button onclick={() => engine?.download(title)}
          >Download a copy</button
        >{/if}
    </div>{/if}{#if !ready && !error}<div class="canvas-loading" role="status">
      Loading editor…
    </div>{/if}
  <div class="canvas" bind:this={canvas}></div>
</main>
