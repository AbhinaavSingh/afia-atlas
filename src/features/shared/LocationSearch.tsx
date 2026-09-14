import { LoaderCircle, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number
    name?: string
    city?: string
    district?: string
    state?: string
    country?: string
    countrycode?: string
  }
}

export interface PlaceSelection {
  label: string
  lat: number
  lon: number
  city: string
  regionName: string
  countryCode: string
}

interface PlaceSuggestion extends PlaceSelection {
  id: string
}

function toSuggestion(feature: PhotonFeature, index: number): PlaceSuggestion {
  const props = feature.properties
  const [lon, lat] = feature.geometry.coordinates
  const parts = [props.name, props.city, props.state, props.country].filter(
    (part, partIndex, all): part is string =>
      Boolean(part) && all.indexOf(part) === partIndex,
  )
  return {
    id: `${props.osm_id ?? index}:${lat}:${lon}`,
    label: parts.join(', '),
    lat,
    lon,
    city: props.city ?? (props.name && props.state ? props.name : ''),
    regionName: props.state ?? '',
    countryCode: props.countrycode?.toUpperCase() ?? '',
  }
}

export function LocationSearch({
  initialValue = '',
  placeholder = 'Start typing a place',
  required = false,
  onQueryChange,
  onSelect,
}: {
  initialValue?: string
  placeholder?: string
  required?: boolean
  onQueryChange?: (value: string) => void
  onSelect: (place: PlaceSelection) => void
}) {
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [chosenLabel, setChosenLabel] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  // Live place suggestions while typing (debounced, cancellable).
  useEffect(() => {
    const trimmed = query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (trimmed.length < 3 || query === chosenLabel) {
        setSuggestions([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: trimmed, limit: '6', lang: 'en' })
        const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
          signal: controller.signal,
        })
        const data = (await response.json()) as { features?: PhotonFeature[] }
        const seen = new Set<string>()
        const next = (data.features ?? []).map(toSuggestion).filter((place) => {
          if (!place.label || seen.has(place.label)) return false
          seen.add(place.label)
          return true
        })
        setSuggestions(next)
        setHighlighted(0)
        setLoading(false)
      } catch {
        // Aborted by a newer keystroke, or offline. Nothing to show.
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, chosenLabel])

  const choose = (place: PlaceSuggestion) => {
    setQuery(place.label)
    setChosenLabel(place.label)
    setSuggestions([])
    onQueryChange?.(place.label)
    onSelect(place)
  }

  return (
    <div className="place-search">
      <div className="input-action">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            onQueryChange?.(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (suggestions[highlighted]) choose(suggestions[highlighted])
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHighlighted((current) =>
                Math.min(current + 1, suggestions.length - 1),
              )
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlighted((current) => Math.max(current - 1, 0))
            } else if (event.key === 'Escape') {
              setSuggestions([])
            }
          }}
          onBlur={() => window.setTimeout(() => setSuggestions([]), 200)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
        />
        <span className="input-action-icon" aria-hidden="true">
          {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
        </span>
      </div>
      {suggestions.length > 0 && (
        <ul className="place-results" role="listbox" aria-label="Matching places">
          {suggestions.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                className={index === highlighted ? 'is-active' : ''}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(place)
                }}
                onMouseEnter={() => setHighlighted(index)}
              >
                <MapPin size={13} />
                <span>{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
