<script lang="ts">
  import {
    ArrowLeft,
    Check,
    Download,
    Ellipsis,
    File,
    Folder,
    LayoutGrid,
    LogOut,
    Moon,
    PenTool,
    Plus,
    Save,
    Search,
    Sun,
    Trash2,
  } from '@lucide/svelte';
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const icons = {
    back: ArrowLeft,
    check: Check,
    download: Download,
    more: Ellipsis,
    file: File,
    folder: Folder,
    grid: LayoutGrid,
    logout: LogOut,
    moon: Moon,
    pen: PenTool,
    plus: Plus,
    save: Save,
    search: Search,
    sun: Sun,
    trash: Trash2,
  };
  let Glyph = $derived(icons[name as keyof typeof icons] || File);
</script>

<Glyph {size} strokeWidth={1.75} aria-hidden="true" />
