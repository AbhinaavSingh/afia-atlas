import { divIcon, type DivIcon } from 'leaflet'

export interface JourneyMarkerOptions {
  label: string
  count?: number
  imageUrl?: string
  kind: 'country' | 'area' | 'memory' | 'pin'
  delay?: number
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  )
}

export function createJourneyIcon({
  label,
  count,
  imageUrl,
  kind,
  delay = 0,
}: JourneyMarkerOptions): DivIcon {
  const safeLabel = escapeHtml(label)
  const safeImage = imageUrl
    ? escapeHtml(encodeURI(imageUrl).replace(/"/g, '%22'))
    : ''
  const isMemory = kind === 'memory'
  const size = isMemory ? 70 : kind === 'pin' ? 34 : 58

  const visual = isMemory
    ? `<span class="journey-photo-orb">${
        safeImage
          ? `<img src="${safeImage}" alt="" />`
          : `<span class="journey-photo-fallback">✦</span>`
      }</span>`
    : `<span class="journey-light-core"><span></span></span>`

  const caption =
    kind === 'pin' || kind === 'memory'
      ? ''
      : `<span class="journey-marker-caption"><strong>${safeLabel}</strong>${
          count == null ? '' : `<small>${count} ${count === 1 ? 'memory' : 'memories'}</small>`
        }</span>`

  return divIcon({
    className: `journey-marker journey-marker--${kind}`,
    html: `<span class="journey-marker-enter" style="--marker-delay:${delay}ms">${visual}${caption}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  })
}
