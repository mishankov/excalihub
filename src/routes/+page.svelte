<script lang="ts">
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { api } from '$lib/api';
  import Icon from '$lib/components/Icon.svelte';
  let error = $state(''),
    busy = $state(false);
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    const form = new FormData(event.currentTarget as HTMLFormElement);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });
      await invalidateAll();
      await goto('/diagrams');
    } catch (e) {
      error = (e as Error).message;
      busy = false;
    }
  }
</script>

<main class="login-page">
  <div class="login-theme"><ThemeSwitch /></div>
  <div class="login-brand">
    <Icon name="pen" size={24} /><span>excalihub</span>
  </div>
  <section class="login-card">
    <h1>Sign in</h1>
    <form onsubmit={submit}>
      <label
        >Username<input
          autocomplete="username"
          name="username"
          required
          maxlength="40"
        /></label
      ><label
        >Password<input
          autocomplete="current-password"
          name="password"
          type="password"
          required
          maxlength="256"
        /></label
      >{#if error}<p role="alert" class="error">{error}</p>{/if}<button
        class="primary"
        disabled={busy}
        type="submit">{busy ? 'Signing in…' : 'Sign in'}</button
      >
    </form>
    <p class="login-note">Contact your administrator for an account.</p>
  </section>
</main>
