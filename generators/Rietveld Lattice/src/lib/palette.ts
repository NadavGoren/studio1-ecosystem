import type { PenColor } from '../types'

// De Stijl ink set. Each colour is one physical pen / one SVG layer.
export const PEN_HEX: Record<PenColor, string> = {
  black: '#1a1a1a',
  red: '#d4202a',
  blue: '#1d3fb0',
  yellow: '#f4c20d',
}

// Brighter on-screen variants so the dark-UI preview stays legible.
export const PEN_SCREEN: Record<PenColor, string> = {
  black: '#e6e8ee',
  red: '#ff4d54',
  blue: '#5b78ff',
  yellow: '#ffd83a',
}

export const PEN_ORDER: PenColor[] = ['black', 'red', 'blue', 'yellow']

export const PEN_LABEL: Record<PenColor, string> = {
  black: 'Black — structure',
  red: 'Red — boards',
  blue: 'Blue — boards',
  yellow: 'Yellow — end-caps',
}
