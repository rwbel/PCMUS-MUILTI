/**
 * Resolves static image assets inside /src/assets/images/ through Vite's asset bundler
 * so they are included in production `dist/` builds (e.g. on Vercel).
 */
const IMAGE_MODULES = import.meta.glob<string>(
  [
    '/src/assets/images/pcmus_char_*.jpg',
    '/src/assets/images/pcmus_sprite_*.png',
    '/src/assets/images/pcmus_table_four_char_*.jpg',
    '/src/assets/images/pcmus_tavern_backdrop_single_chairs.jpg',
    '/src/assets/images/tavern_bar_overlay.png',
    '/src/assets/images/tavern_table_overlay.png',
  ],
  {
    eager: true,
    import: 'default',
  }
);

export function resolveImageAsset(assetPath: string): string {
  return IMAGE_MODULES[assetPath] || assetPath;
}
