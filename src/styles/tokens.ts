/** Alexandria dual-layer design tokens — physical materials + digital glass. */
export const AlexandriaTokens = {
  bindings: {
    oxblood: '#3A1316',
    oliveCloth: '#2B3227',
    deepUltramarine: '#121C2B',
    antiqueBlack: '#141416',
    imperialPurple: '#2A182E',
    seaSlate: '#1A242C',
  },

  foils: {
    antiqueGold: {
      base: '#D4AF37',
      specular: '#FFF3A8',
      embossShadow: '#5A4810',
    },
    polishedBrass: {
      base: '#C59B27',
      specular: '#FFE899',
      embossShadow: '#423206',
    },
    burnishedCopper: {
      base: '#B87333',
      specular: '#FFD0A8',
      embossShadow: '#4A2B10',
    },
    silverWave: {
      base: '#C0C6CE',
      specular: '#F4F7FF',
      embossShadow: '#3A4048',
    },
  },

  paper: {
    vellumLight: '#F8F5EE',
    vellumWarm: '#F2EBD9',
    monasteryDark: '#131315',
    inkPrimary: '#1C1B1A',
    inkMuted: '#6B665E',
  },

  glass: {
    surface: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
    blur: '24px',
    shadow3D: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  },

  type: {
    display: '"Cinzel Decorative", "Cormorant Garamond", Georgia, serif',
    displayAlt: '"Cinzel", "Cormorant Garamond", Georgia, serif',
    body: '"EB Garamond", "Source Serif 4", Georgia, serif',
    ui: 'system-ui, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
} as const

export type BindingKey = keyof typeof AlexandriaTokens.bindings
export type FoilKey = keyof typeof AlexandriaTokens.foils
