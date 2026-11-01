// Latin WOFF2 subsets from Fontsource packages; versions and hashes in fonts/provenance.json.
// esbuild's .woff2 base64 loader keeps the final HTML completely offline.
// Original OFL licenses and exact source hashes live in ./fonts/.
import spaceGrotesk from './fonts/space-grotesk-latin-wght-normal.woff2';
import manrope from './fonts/manrope-latin-wght-normal.woff2';
import plexMono from './fonts/ibm-plex-mono-latin-400-normal.woff2';

export const FONT_FAMILIES = Object.freeze({
  display: 'Space Grotesk',
  text: 'Manrope',
  mono: 'IBM Plex Mono',
});

const faces = [
  ['Space Grotesk', '300 700', 'normal', spaceGrotesk],
  ['Manrope', '200 800', 'normal', manrope],
  ['IBM Plex Mono', '400', 'normal', plexMono],
];

export function installFonts(targetDocument = document) {
  const existing = targetDocument.getElementById('atlas-font-faces');
  if (existing) return existing;
  const style = targetDocument.createElement('style');
  style.id = 'atlas-font-faces';
  style.textContent = faces.map(([family, weight, fontStyle, data]) =>
    `@font-face{font-family:'${family}';font-style:${fontStyle};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');}`
  ).join('\n');
  targetDocument.head.appendChild(style);
  return style;
}

installFonts();
