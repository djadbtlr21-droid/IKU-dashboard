// Light/dark color tokens for annotation palette.
// yellow updated from #E8C898 to #E0B86A to avoid clash with G.primarySoft.

const LIGHT = {
  yellow: '#E0B86A',
  red:    '#C97560',
  blue:   '#7A9AC4',
  green:  '#7AA88E',
  pink:   '#D4A0AC',
}

const DARK = {
  yellow: '#D4B080',
  red:    '#D28971',
  blue:   '#9AAEC4',
  green:  '#86B59A',
  pink:   '#E0B4BE',
}

export const ANNOTATION_COLORS = ['yellow', 'red', 'blue', 'green', 'pink']

export function getAnnotationColor(color, dark) {
  const map = dark ? DARK : LIGHT
  return map[color] || map.yellow
}
