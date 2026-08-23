/**
 * Design tokens ported from the web app's src/app/globals.css ("Georgian
 * travel journal" system). Dark mode has no web equivalent to port from —
 * these are a first-pass derivation keeping the same warm wine/stone
 * identity rather than falling back to generic grays; refine visually
 * once real screens exist.
 */

export const Palette = {
  stone: '#F5F0EB',
  stoneLight: '#FAF8F5',
  stoneMid: '#E8E0D8',
  stoneDark: '#D4C9BC',

  wine: '#8B2252',
  wineLight: '#A8345F',
  wineDark: '#6B1A3F',
  wineGlow: 'rgba(139, 34, 82, 0.12)',

  terra: '#C4704B',
  terraLight: '#D4885F',
  terraDark: '#A85A38',

  mountain: '#4A7C8F',
  mountainLight: '#5D97AC',
  mountainDark: '#3A6170',

  charcoal: '#2C2C2C',
  charcoalMid: '#4A4A4A',
  charcoalLight: '#6B6B6B',

  gold: '#D4A853',
  goldLight: '#E4C170',

  go: '#4CAF50',
  goBg: 'rgba(76, 175, 80, 0.1)',
  goBorder: 'rgba(76, 175, 80, 0.3)',
  maybe: '#FF9800',
  maybeBg: 'rgba(255, 152, 0, 0.1)',
  maybeBorder: 'rgba(255, 152, 0, 0.3)',
  skip: '#E53935',
  skipBg: 'rgba(229, 57, 53, 0.1)',
  skipBorder: 'rgba(229, 57, 53, 0.3)',
} as const;

export const Colors = {
  light: {
    background: Palette.stone,
    backgroundElement: Palette.stoneLight,
    backgroundSelected: Palette.stoneMid,
    border: Palette.stoneMid,
    text: Palette.charcoal,
    textSecondary: Palette.charcoalMid,
    textMuted: Palette.charcoalLight,
    accent: Palette.wine,
    accentGlow: Palette.wineGlow,
  },
  dark: {
    background: '#201A1C',
    backgroundElement: '#2C2427',
    backgroundSelected: '#3B2A31',
    border: '#4A3A40',
    text: Palette.stoneLight,
    textSecondary: '#CBBFB8',
    textMuted: '#9C8F89',
    accent: Palette.wineLight,
    accentGlow: 'rgba(168, 52, 95, 0.22)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Family names must match the keys passed to useFonts() in app/_layout.tsx —
// see @expo-google-fonts/outfit and @expo-google-fonts/source-serif-4.
export const Fonts = {
  heading: 'Outfit_600SemiBold',
  headingBold: 'Outfit_700Bold',
  headingMedium: 'Outfit_500Medium',
  body: 'SourceSerif4_400Regular',
  bodyMedium: 'SourceSerif4_500Medium',
  bodySemiBold: 'SourceSerif4_600SemiBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const MaxContentWidth = 800;
