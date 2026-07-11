const DEFAULT_AVATAR_SEED = "notelab"
const MIN_HUE_DISTANCE = 72
const AVATAR_LIGHTNESS = 42

export function stringToColour(value: string): string {
  const hash = hashString(value || DEFAULT_AVATAR_SEED)
  const hue = Math.abs(hash) % 360

  return hslToHex(hue, 100, AVATAR_LIGHTNESS)
}

export function generateColours(value: string): [string, string] {
  const seed = value || DEFAULT_AVATAR_SEED
  const firstHue = hashToHue(seed)
  const rawSecondHue = hashToHue(reverse(seed))
  const secondHue = ensureHueDistance(firstHue, rawSecondHue)

  return [
    hslToHex(firstHue, 100, AVATAR_LIGHTNESS),
    hslToHex(secondHue, 100, AVATAR_LIGHTNESS),
  ]
}

export function generateAvatarGradient(value: string): string {
  const [first, second] = generateColours(value)

  return `linear-gradient(135deg, ${first}, ${second})`
}

export function generateAvatarSVG(value: string, size = 256): string {
  const [first, second] = generateColours(value)

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#gradient)" />
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${first}" />
      <stop offset="1" stop-color="${second}" />
    </linearGradient>
  </defs>
</svg>
  `.trim()
}

export function generateAvatarDataUri(value: string, size = 256): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    generateAvatarSVG(value, size)
  )}`
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return hash
}

function hashToHue(value: string) {
  return Math.abs(hashString(value || DEFAULT_AVATAR_SEED)) % 360
}

function reverse(value: string) {
  return [...value].reverse().join("")
}

function ensureHueDistance(firstHue: number, secondHue: number) {
  const distance = hueDistance(firstHue, secondHue)

  if (distance >= MIN_HUE_DISTANCE) {
    return secondHue
  }

  const adjustment = MIN_HUE_DISTANCE - distance
  const direction = secondHue >= firstHue ? 1 : -1

  return normalizeHue(secondHue + adjustment * direction)
}

function hueDistance(firstHue: number, secondHue: number) {
  const distance = Math.abs(firstHue - secondHue)

  return Math.min(distance, 360 - distance)
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100)
  const huePrime = hue / 60
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1))
  const match = lightness / 100 - chroma / 2
  const [red, green, blue] =
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]

  return `#${toHex(red + match)}${toHex(green + match)}${toHex(blue + match)}`
}

function toHex(value: number) {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0")
}
