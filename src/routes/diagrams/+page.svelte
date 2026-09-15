<script lang="ts">
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { api } from '$lib/api';
  import type { Diagram, DiagramSummary, Folder } from '$lib/types';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let busy = $state(false),
    error = $state(''),
    query = $state(''),
    remove = $state<DiagramSummary | null>(null),
    dialog: HTMLDialogElement;
  let folderDialog: HTMLDialogElement;
  let folderMode = $state<'create' | 'rename' | 'delete'>('create'),
    folderName = $state(''),
    folderError = $state('');
  let selectedFolder = $derived(
    data.folders.find((f) => f.id === data.selected),
  );
  let folderDiagrams = $derived(
    data.diagrams.filter(
      (d) =>
        data.selected === 'all' ||
        (data.selected === 'unfiled'
          ? d.folder_id === null
          : d.folder_id === data.selected),
    ),
  );
  let filtered = $derived(
    folderDiagrams.filter((d) =>
      d.title.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  async function create() {
    busy = true;
    error = '';
    try {
      const { diagram } = await api<{ diagram: Diagram }>('/api/diagrams', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Untitled diagram',
          folder_id: selectedFolder?.id ?? null,
        }),
      });
      await goto(`/diagrams/${diagram.id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function signOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      await invalidateAll();
      await goto('/');
    } catch (e) {
      error = (e as Error).message;
    }
  }
  function askDelete(diagram: DiagramSummary) {
    closeMenus();
    remove = diagram;
    dialog.showModal();
  }
  async function deleteSelected() {
    if (!remove) return;
    busy = true;
    try {
      await api(`/api/diagrams/${remove.id}`, { method: 'DELETE' });
      dialog.close();
      remove = null;
      await invalidateAll();
    } catch (e) {
      error = (e as Error).message;
      dialog.close();
    } finally {
      busy = false;
    }
  }

  function openFolder(mode: 'create' | 'rename' | 'delete') {
    closeMenus();
    folderMode = mode;
    folderName = mode === 'create' ? '' : selectedFolder?.name || '';
    folderError = '';
    folderDialog.showModal();
  }
  async function submitFolder(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    folderError = '';
    try {
      if (folderMode === 'delete') {
        await api(`/api/folders/${selectedFolder!.id}`, { method: 'DELETE' });
        folderDialog.close();
        await goto('/diagrams?folder=unfiled', { invalidateAll: true });
      } else {
        const { folder } = await api<{ folder: Folder }>(
          folderMode === 'create'
            ? '/api/folders'
            : `/api/folders/${selectedFolder!.id}`,
          {
            method: folderMode === 'create' ? 'POST' : 'PATCH',
            body: JSON.stringify({ name: folderName }),
          },
        );
        folderDialog.close();
        await goto(`/diagrams?folder=${folder.id}`, { invalidateAll: true });
      }
    } catch (e) {
      folderError = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  let actionDialog: HTMLDialogElement;
  let actionMode = $state<'move' | 'rename'>('move'),
    actionDiagram = $state<DiagramSummary | null>(null),
    actionValue = $state(''),
    actionError = $state('');
  function closeMenus() {
    document
      .querySelectorAll<HTMLDetailsElement>('.fm-menu[open]')
      .forEach((menu) => (menu.open = false));
  }
  function openAction(diagram: DiagramSummary, mode: 'move' | 'rename') {
    closeMenus();
    actionDiagram = diagram;
    actionMode = mode;
    actionValue = mode === 'move' ? diagram.folder_id || '' : diagram.title;
    actionError = '';
    actionDialog.showModal();
  }
  async function submitAction(event: SubmitEvent) {
    event.preventDefault();
    if (!actionDiagram) return;
    busy = true;
    actionError = '';
    try {
      await api(`/api/diagrams/${actionDiagram.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          actionMode === 'move'
            ? { folder_id: actionValue || null }
            : { title: actionValue, version: actionDiagram.version },
        ),
      });
      actionDialog.close();
      await invalidateAll();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window
  onclick={(event) => {
    if (!(event.target as Element).closest('.fm-menu')) closeMenus();
  }}
  onkeydown={(event) => {
    if (event.key === 'Escape') closeMenus();
  }}
/>
<div class="file-manager">
  <aside class="fm-sidebar">
    <a href="/diagrams" class="fm-brand">Excalihub</a>
    <nav aria-label="Diagram folders" class="fm-nav">
      <a
        href="/diagrams"
        aria-current={data.selected === 'all' ? 'page' : undefined}
        ><Icon name="grid" size={18} /><span>All diagrams</span><small
          >{data.diagrams.length}</small
        ></a
      >
      <a
        href="/diagrams?folder=unfiled"
        aria-current={data.selected === 'unfiled' ? 'page' : undefined}
        ><Icon name="file" size={18} /><span>Unfiled</span><small
          >{data.diagrams.filter((d) => d.folder_id === null).length}</small
        ></a
      >
      <div class="fm-nav-heading">
        <span>Folders</span><button
          class="icon-button"
          title="New folder"
          aria-label="New folder"
          disabled={busy}
          onclick={() => openFolder('create')}
          ><Icon name="plus" size={17} /></button
        >
      </div>
      {#each data.folders as folder (folder.id)}<a
          href={`/diagrams?folder=${folder.id}`}
          aria-current={data.selected === folder.id ? 'page' : undefined}
          ><Icon name="folder" size={18} /><span>{folder.name}</span><small
            >{data.diagrams.filter((d) => d.folder_id === folder.id)
              .length}</small
          ></a
        >{/each}
      {#if !data.folders.length}<button
          class="fm-add-folder"
          onclick={() => openFolder('create')}>New folder</button
        >{/if}
    </nav>
    <div class="fm-theme"><span>Appearance</span><ThemeSwitch /></div>
    <div class="fm-account">
      <span class="avatar">{data.user.username[0].toUpperCase()}</span><span
        >{data.user.username}</span
      ><button
        class="icon-button"
        title="Sign out"
        aria-label="Sign out"
        onclick={signOut}><Icon name="logout" size={18} /></button
      >
    </div>
  </aside>
  <main class="fm-main">
    <header class="fm-toolbar">
      <div class="fm-location">
        <h1>
          {selectedFolder?.name ||
            (data.selected === 'unfiled' ? 'Unfiled' : 'All diagrams')}
        </h1>
        {#if selectedFolder}<details class="fm-menu">
            <summary aria-label="Folder actions"><Icon name="more" /></summary>
            <div class="fm-menu-panel">
              <button onclick={() => openFolder('rename')}>Rename folder</button
              ><button onclick={() => openFolder('delete')}
                >Delete folder</button
              >
            </div>
          </details>{/if}
      </div>
      <label class="fm-search"
        ><Icon name="search" size={16} /><input
          aria-label="Search diagrams"
          placeholder="Search"
          bind:value={query}
        /></label
      >
      <button class="primary" onclick={create} disabled={busy}
        ><Icon name="plus" size={16} />New diagram</button
      >
    </header>
    <section class="fm-content" aria-label="Diagrams">
      <div class="fm-meta">
        <span
          >{filtered.length}
          {filtered.length === 1 ? 'diagram' : 'diagrams'}</span
        >
      </div>
      {#if error}<div class="error-banner" role="alert">
          {error}<button
            onclick={() => {
              error = '';
              void invalidateAll();
            }}>Try again</button
          >
        </div>{/if}
      {#if filtered.length}<div class="fm-grid">
          {#each filtered as diagram (diagram.id)}<article class="fm-card">
              <a
                href={`/diagrams/${diagram.id}`}
                class="fm-preview"
                aria-label={`Open ${diagram.title}`}
                >{#if diagram.thumbnail}<img
                    src={diagram.thumbnail}
                    alt=""
                    loading="lazy"
                  />{:else}<Icon name="file" size={32} />{/if}</a
              >
              <div class="fm-card-bottom">
                <a href={`/diagrams/${diagram.id}`} class="fm-card-title"
                  ><h2>{diagram.title}</h2>
                  <time datetime={diagram.updated_at}
                    >{new Date(diagram.updated_at).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}</time
                  ></a
                >
                <details class="fm-menu">
                  <summary aria-label={`Actions for ${diagram.title}`}
                    ><Icon name="more" size={20} /></summary
                  >
                  <div class="fm-menu-panel">
                    <button
                      disabled={busy}
                      onclick={() => openAction(diagram, 'move')}
                      ><Icon name="folder" size={16} />Move to folder</button
                    ><button
                      disabled={busy}
                      onclick={() => openAction(diagram, 'rename')}
                      ><Icon name="pen" size={16} />Rename</button
                    ><button
                      class="fm-delete"
                      disabled={busy}
                      onclick={() => askDelete(diagram)}
                      ><Icon name="trash" size={16} />Delete</button
                    >
                  </div>
                </details>
              </div>
            </article>{/each}
        </div>{:else}<div class="fm-empty">
          <Icon name="folder" size={36} />
          <h2>{query ? 'No matching diagrams' : 'No diagrams yet'}</h2>
          {#if query}<button onclick={() => (query = '')}>Clear search</button
            >{:else}<button class="primary" onclick={create} disabled={busy}
              ><Icon name="plus" size={18} />New diagram</button
            >{/if}
        </div>{/if}
    </section>
  </main>
</div>
<dialog
  bind:this={dialog}
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
  aria-labelledby="delete-title"
  aria-describedby="delete-description"
>
  <h2 id="delete-title">Delete diagram?</h2>
  <p id="delete-description">“{remove?.title}” will be permanently deleted.</p>
  <div class="dialog-actions">
    <button disabled={busy} onclick={() => dialog.close()}>Cancel</button
    ><button class="danger" disabled={busy} onclick={deleteSelected}
      >{busy ? 'Deleting…' : 'Delete'}</button
    >
  </div>
</dialog>

<dialog
  bind:this={folderDialog}
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
  aria-labelledby="folder-dialog-title"
>
  <h2 id="folder-dialog-title">
    {folderMode === 'create'
      ? 'New folder'
      : folderMode === 'rename'
        ? 'Rename folder'
        : 'Delete folder?'}
  </h2>
  <form onsubmit={submitFolder}>
    {#if folderMode === 'delete'}<p>
        Delete “{selectedFolder?.name}”? Its diagrams will move to Unfiled.
      </p>{:else}<label
        >Folder name<input
          bind:value={folderName}
          required
          maxlength="80"
        /></label
      >{/if}
    {#if folderError}<p class="error" role="alert">{folderError}</p>{/if}
    <div class="dialog-actions">
      <button type="button" disabled={busy} onclick={() => folderDialog.close()}
        >Cancel</button
      ><button
        type="submit"
        class={folderMode === 'delete' ? 'danger' : 'primary'}
        disabled={busy}
        >{busy
          ? 'Saving…'
          : folderMode === 'delete'
            ? 'Delete folder'
            : folderMode === 'create'
              ? 'Create folder'
              : 'Save'}</button
      >
    </div>
  </form>
</dialog>

<dialog
  bind:this={actionDialog}
  aria-labelledby="action-title"
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
>
  <h2 id="action-title">
    {actionMode === 'move' ? 'Move diagram' : 'Rename diagram'}
  </h2>
  <form onsubmit={submitAction}>
    {#if actionMode === 'move'}<label
        >Folder<select class="fm-select" bind:value={actionValue}
          ><option value="">Unfiled</option
          >{#each data.folders as folder}<option value={folder.id}
              >{folder.name}</option
            >{/each}</select
        ></label
      >{:else}<label
        >Diagram name<input
          bind:value={actionValue}
          required
          maxlength="120"
        /></label
      >{/if}
    {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
    <div class="dialog-actions">
      <button type="button" disabled={busy} onclick={() => actionDialog.close()}
        >Cancel</button
      ><button class="primary" disabled={busy}
        >{busy ? 'Saving…' : actionMode === 'move' ? 'Move' : 'Save'}</button
      >
    </div>
  </form>
</dialog>
