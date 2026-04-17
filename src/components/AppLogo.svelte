<script lang="ts">
  import logo from '../assets/logo.svg?raw'

  let { label = 'GigBPM', size = '36px' }: { label?: string; size?: string } = $props()
</script>

<span class="logo" role="img" aria-label={label} style={`--logo-height: ${size};`}>{@html logo}</span>

<style>
  .logo {
    display: flex;
    align-items: center;
    color: inherit;
    line-height: 0;
  }

  .logo :global(svg) {
    display: block;
    width: auto;
    height: var(--logo-height);
  }
</style>
