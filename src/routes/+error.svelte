<script lang="ts">
  import { page } from '$app/state';
</script>

<main class="editor-loading">
  <h1>{page.status}</h1>
  <p>{page.error?.message || 'Something went wrong.'}</p>
  <a href="/diagrams">Back to diagrams</a>
</main>
