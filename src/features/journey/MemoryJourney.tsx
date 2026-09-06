import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Images,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import type { Memory } from '../../types'
import { createJourneyIcon } from './markers'

interface MemoryJourneyProps {
  memories: Memory[]
}

interface ClusterPoint {
  id: string
  kind: 'country' | 'area'
  label: string
  count: number
  lat: number
  lng: number
  countryCode: string
  areaKey?: string
  memories: Memory[]
}

interface MemoryPoint {
  id: string
  kind: 'memory'
  label: string
  count: number
  lat: number
  lng: number
  memory: Memory
}

type JourneyPoint = ClusterPoint | MemoryPoint

const countryNames: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AE: 'United Arab Emirates',
  PK: 'Pakistan',
}

function inferredCountry(memory: Memory) {
  if (memory.countryCode) return memory.countryCode.toUpperCase()
  const { latitude: lat, longitude: lng } = memory
  if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) return 'IN'
  if (lat >= 24 && lat <= 50 && lng >= -126 && lng <= -66) return 'US'
  if (lat >= 49 && lat <= 61 && lng >= -9 && lng <= 3) return 'GB'
  return memory.locationName.split(',').at(-1)?.trim() || 'Somewhere beautiful'
}

function average(memories: Memory[]) {
  return {
    lat: memories.reduce((sum, item) => sum + item.latitude, 0) / memories.length,
    lng: memories.reduce((sum, item) => sum + item.longitude, 0) / memories.length,
  }
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>()
  items.forEach((item) => {
    const groupKey = key(item)
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), item])
  })
  return grouped
}

function areaName(memory: Memory, countryCode: string) {
  if (countryCode === 'US') {
    return memory.regionName || memory.city || memory.locationName.split(',')[0]
  }
  return memory.city || memory.regionName || memory.locationName.split(',')[0]
}

function memoryPoints(memories: Memory[]): MemoryPoint[] {
  const seen = new Map<string, number>()
  return memories.map((memory) => {
    const coordinateKey = `${memory.latitude.toFixed(3)}:${memory.longitude.toFixed(3)}`
    const index = seen.get(coordinateKey) ?? 0
    seen.set(coordinateKey, index + 1)
    const angle = index * 2.35
    const radius = index === 0 ? 0 : 0.19 + index * 0.07
    return {
      id: memory.id,
      kind: 'memory',
      label: memory.title,
      count: 1,
      lat: memory.latitude + Math.sin(angle) * radius,
      lng: memory.longitude + Math.cos(angle) * radius,
      memory,
    }
  })
}

function MapCamera({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.55,
      easeLinearity: 0.16,
      noMoveStart: false,
    })
  }, [center, map, zoom])
  return null
}

function MapControls() {
  const map = useMap()
  return (
    <div className="journey-map-controls">
      <button onClick={() => map.zoomIn(0.75)} aria-label="Zoom in">
        <Plus size={16} />
      </button>
      <button onClick={() => map.zoomOut(0.75)} aria-label="Zoom out">
        <Minus size={16} />
      </button>
    </div>
  )
}

function RailCard({
  point,
  index,
  seen,
  onClick,
}: {
  point: JourneyPoint
  index: number
  seen: boolean
  onClick: () => void
}) {
  const sourceMemories =
    point.kind === 'memory' ? [point.memory] : point.memories
  const thumbnails = sourceMemories
    .map((memory) => memory.thumbnailUrl ?? memory.imageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 2)
  const detail =
    point.kind === 'memory'
      ? `By ${point.memory.contributorName} · ${point.memory.city || point.memory.locationName.split(',')[0]}`
      : `${point.count} ${point.count === 1 ? 'moment' : 'moments'}`

  return (
    <button
      className={seen ? 'is-seen' : ''}
      onClick={onClick}
      aria-label={`${String(index + 1).padStart(2, '0')}. ${point.label}. ${detail}`}
    >
      <span className="rail-number">{String(index + 1).padStart(2, '0')}</span>
      <span className={`rail-visual ${thumbnails.length > 1 ? 'is-stack' : ''}`}>
        {thumbnails.length ? (
          thumbnails.map((thumbnail, thumbnailIndex) => (
            <img
              key={thumbnail}
              src={thumbnail}
              alt=""
              style={{ zIndex: thumbnails.length - thumbnailIndex }}
            />
          ))
        ) : (
          <Images size={16} />
        )}
      </span>
      <span className="rail-card-copy">
        <strong>{point.label}</strong>
        <small>
          {point.kind !== 'memory' && <MapPin size={9} />}
          {detail}
        </small>
      </span>
      <span className="rail-card-action">
        {seen ? <Check size={13} /> : <ChevronRight size={14} />}
      </span>
    </button>
  )
}

function StoryView({
  memory,
  index,
  total,
  onClose,
  onPrevious,
  onNext,
  onContinue,
}: {
  memory: Memory
  index: number
  total: number
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  onContinue: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const close = dialog?.querySelector<HTMLButtonElement>('[data-story-close]')
    close?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrevious()
      if (event.key === 'ArrowRight') onNext()
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNext, onPrevious])

  return createPortal(
    <motion.div
      ref={dialogRef}
      className="story-stage"
      role="dialog"
      aria-modal="true"
      aria-label={memory.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      <button
        data-story-close
        className="story-close"
        onClick={onClose}
        aria-label="Close memory"
      >
        <X size={18} />
      </button>

      <motion.div
        className="story-photo"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        {memory.imageUrl ? (
          <img
            key={memory.imageUrl}
            src={memory.imageUrl}
            alt={`Memory shared by ${memory.contributorName}`}
          />
        ) : (
          <div className="story-photo-fallback">
            <Sparkles />
            <span>A moment in Afia’s world</span>
          </div>
        )}
        <div className="story-photo-shade" />
        <div className="story-place">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <p>{memory.locationName}</p>
        </div>
      </motion.div>

      <motion.div
        className="story-copy"
        key={memory.id}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.65 }}
      >
        <p className="story-kicker">A memory from {memory.contributorName}</p>
        <h2>{memory.title}</h2>
        <p className="story-body">{memory.story}</p>
        <p className="story-signature">
          {memory.contributorName}
          {memory.relationship ? <span>{memory.relationship}</span> : null}
        </p>
        <div className="story-actions">
          <div className="story-pager">
            <button onClick={onPrevious} aria-label="Previous memory">
              <ArrowLeft size={16} />
            </button>
            <span>{index + 1} of {total}</span>
            <button onClick={onNext} aria-label="Next memory">
              <ArrowRight size={16} />
            </button>
          </div>
          <button className="story-continue" onClick={onContinue}>
            Continue the journey <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

export function MemoryJourney({ memories }: MemoryJourneyProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<Memory | null>(null)
  const [activeCountry, setActiveCountry] = useState<string | null>(null)
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [isTravelling, setIsTravelling] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set())
  const [showFirstHint, setShowFirstHint] = useState(false)
  const hasShownHint = useRef(false)
  const travelTimers = useRef<number[]>([])

  const countryClusters = useMemo(() => {
    const groups = groupBy(memories, inferredCountry)
    return [...groups.entries()]
      .map(([countryCode, items]): ClusterPoint => ({
        id: `country-${countryCode}`,
        kind: 'country',
        label: countryNames[countryCode] ?? countryCode,
        count: items.length,
        countryCode,
        memories: items,
        ...average(items),
      }))
      .sort((a, b) => b.count - a.count)
  }, [memories])

  const activeCountryCluster = countryClusters.find(
    (cluster) => cluster.countryCode === activeCountry,
  )

  const areaClusters = useMemo(() => {
    if (!activeCountryCluster) return []
    const groups = groupBy(activeCountryCluster.memories, (memory) =>
      areaName(memory, activeCountryCluster.countryCode),
    )
    return [...groups.entries()]
      .map(([areaKey, items]): ClusterPoint => ({
        id: `area-${activeCountryCluster.countryCode}-${areaKey}`,
        kind: 'area',
        label: areaKey,
        count: items.length,
        countryCode: activeCountryCluster.countryCode,
        areaKey,
        memories: items,
        ...average(items),
      }))
      .sort((a, b) => b.count - a.count)
  }, [activeCountryCluster])

  const activeAreaCluster = areaClusters.find(
    (cluster) => cluster.areaKey === activeArea,
  )

  const cityCount = useMemo(
    () =>
      new Set(
        memories.map(
          (memory) =>
            `${inferredCountry(memory)}:${memory.city || memory.locationName.split(',')[0]}`,
        ),
      ).size,
    [memories],
  )

  const points = useMemo<JourneyPoint[]>(() => {
    if (activeAreaCluster) return memoryPoints(activeAreaCluster.memories)
    if (activeCountryCluster) return areaClusters
    return countryClusters
  }, [activeAreaCluster, activeCountryCluster, areaClusters, countryClusters])

  const visibleMemories = activeAreaCluster?.memories ?? []
  const cameraCenter: [number, number] = activeAreaCluster
    ? [activeAreaCluster.lat, activeAreaCluster.lng]
    : activeCountryCluster
      ? [activeCountryCluster.lat, activeCountryCluster.lng]
      : [24, 24]
  const cameraZoom = activeAreaCluster
    ? 9
    : activeCountryCluster?.countryCode === 'US'
      ? 4
      : activeCountryCluster?.countryCode === 'GB'
        ? 6
        : activeCountryCluster
          ? 5
          : 2

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || hasShownHint.current) return
    hasShownHint.current = true
    const revealTimer = window.setTimeout(() => setShowFirstHint(true), 650)
    const hideTimer = window.setTimeout(() => setShowFirstHint(false), 4800)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!activeAreaCluster) return
    activeAreaCluster.memories.forEach((memory) => {
      if (!memory.imageUrl) return
      const image = new Image()
      image.src = memory.imageUrl
    })
  }, [activeAreaCluster])

  useEffect(
    () => () => travelTimers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  )

  const travel = (action: () => void) => {
    setIsTravelling(true)
    travelTimers.current.push(
      window.setTimeout(action, 180),
      window.setTimeout(() => setIsTravelling(false), 1180),
    )
  }

  const activatePoint = (point: JourneyPoint) => {
    setShowFirstHint(false)
    if (point.kind === 'memory') {
      setSelected(point.memory)
      setSeenIds((current) => new Set(current).add(point.memory.id))
      return
    }
    travel(() => {
      if (point.kind === 'country') {
        setActiveCountry(point.countryCode)
        setActiveArea(null)
      } else {
        setActiveArea(point.areaKey ?? null)
      }
    })
  }

  const goBack = () => {
    travel(() => {
      if (activeArea) setActiveArea(null)
      else setActiveCountry(null)
    })
  }

  const stepMemory = (direction: number) => {
    if (!selected || !visibleMemories.length) return
    const current = visibleMemories.findIndex((memory) => memory.id === selected.id)
    const next =
      visibleMemories[
        (current + direction + visibleMemories.length) % visibleMemories.length
      ]
    setSelected(next)
    setSeenIds((currentIds) => new Set(currentIds).add(next.id))
  }

  const continueJourney = () => {
    if (!selected) return
    const memoryIndex = visibleMemories.findIndex(
      (memory) => memory.id === selected.id,
    )
    if (memoryIndex < visibleMemories.length - 1) {
      const next = visibleMemories[memoryIndex + 1]
      setSelected(next)
      setSeenIds((current) => new Set(current).add(next.id))
      return
    }
    setSelected(null)
    const areaIndex = areaClusters.findIndex(
      (cluster) => cluster.areaKey === activeArea,
    )
    if (areaIndex < areaClusters.length - 1) {
      travel(() => setActiveArea(areaClusters[areaIndex + 1].areaKey ?? null))
      return
    }
    const countryIndex = countryClusters.findIndex(
      (cluster) => cluster.countryCode === activeCountry,
    )
    if (countryIndex < countryClusters.length - 1) {
      travel(() => {
        setActiveCountry(countryClusters[countryIndex + 1].countryCode)
        setActiveArea(null)
      })
      return
    }
    setIsOpen(false)
    window.setTimeout(
      () =>
        document
          .querySelector('.dedication-section')
          ?.scrollIntoView({ behavior: 'smooth' }),
      250,
    )
  }

  const closeJourney = () => {
    setSelected(null)
    setIsOpen(false)
  }

  const finishJourney = () => {
    closeJourney()
    window.setTimeout(
      () =>
        document
          .querySelector('.dedication-section')
          ?.scrollIntoView({ behavior: 'smooth' }),
      250,
    )
  }

  const countryAreaLabel =
    activeCountryCluster?.countryCode === 'US'
      ? areaClusters.length === 1
        ? 'state'
        : 'states'
      : areaClusters.length === 1
        ? 'city'
        : 'cities'
  const contextTitle = activeAreaCluster
    ? `${activeAreaCluster.label} · ${activeAreaCluster.count} ${activeAreaCluster.count === 1 ? 'moment' : 'moments'} · tap one to read`
    : activeCountryCluster
      ? `${activeCountryCluster.label} · ${activeCountryCluster.count} ${activeCountryCluster.count === 1 ? 'moment' : 'moments'} in ${areaClusters.length} ${countryAreaLabel}`
      : `Her world · ${memories.length} moments across ${countryClusters.length} countries`
  const seenProgress = memories.length
    ? Math.round((seenIds.size / memories.length) * 100)
    : 0

  return (
    <>
      <div className="journey-poster">
        <div className="journey-poster-map" aria-hidden="true">
          <MapContainer
            center={[24, 24]}
            zoom={2}
            zoomSnap={0}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            scrollWheelZoom={false}
            boxZoom={false}
            keyboard={false}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            {countryClusters.map((cluster, index) => (
              <Marker
                key={cluster.id}
                position={[cluster.lat, cluster.lng]}
                icon={createJourneyIcon({
                  kind: 'country',
                  label: cluster.label,
                  count: cluster.count,
                  delay: index * 110,
                })}
                interactive={false}
              />
            ))}
          </MapContainer>
        </div>
        <div className="journey-poster-shade" />
        <motion.div
          className="journey-poster-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
        >
          <p className="eyebrow">A world made brighter by you</p>
          <h3>{memories.length} moments. One extraordinary life.</h3>
          <p>
            Travel through the places, people, and stories that became more
            beautiful because Afia was there.
          </p>
          <button className="journey-enter" onClick={() => setIsOpen(true)}>
            <span>Step into her world</span>
            <ArrowRight size={17} />
          </button>
        </motion.div>
        <div className="journey-poster-foot">
          <span>{memories.length} moments</span><i />
          <span>{cityCount} cities</span><i />
          <span>{countryClusters.length} countries</span>
        </div>
      </div>

      {isOpen &&
        createPortal(
          <motion.div
            className="journey-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <header className="journey-header">
              <div className="journey-brand">
                <Sparkles size={14} />
                <span>Afia · Thirty</span>
              </div>
              <div className="journey-breadcrumb">
                {activeCountry && (
                  <button onClick={goBack}>
                    <ArrowLeft size={14} />
                    {activeArea ? activeCountryCluster?.label : 'The world'}
                  </button>
                )}
                <span>{contextTitle}</span>
              </div>
              <button className="journey-exit" onClick={closeJourney}>
                Exit <X size={15} />
              </button>
            </header>

            <div className="journey-map">
              <MapContainer
                center={[24, 24]}
                zoom={2}
                minZoom={2}
                maxZoom={13}
                zoomSnap={0.25}
                zoomDelta={0.75}
                zoomControl={false}
                scrollWheelZoom
                worldCopyJump
              >
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
                <MapCamera center={cameraCenter} zoom={cameraZoom} />
                <MapControls />
                {!activeArea &&
                  points.slice(1).map((point, index) => (
                    <Polyline
                      key={`line-${point.id}`}
                      positions={[
                        [points[index].lat, points[index].lng],
                        [point.lat, point.lng],
                      ]}
                      pathOptions={{
                        color: '#d7b978',
                        opacity: 0.2,
                        weight: 1,
                        dashArray: '2 12',
                      }}
                    />
                  ))}
                {points.map((point, index) => (
                  <Marker
                    key={point.id}
                    position={[point.lat, point.lng]}
                    icon={createJourneyIcon({
                      kind: point.kind,
                      label: point.label,
                      count: point.kind === 'memory' ? undefined : point.count,
                      imageUrl:
                        point.kind === 'memory'
                          ? point.memory.thumbnailUrl ?? point.memory.imageUrl
                          : undefined,
                      delay: index * 90,
                    })}
                    eventHandlers={{ click: () => activatePoint(point) }}
                    keyboard
                    title={
                      point.kind === 'memory'
                        ? `Open ${point.label}`
                        : `Explore ${point.label}, ${point.count} memories`
                    }
                  />
                ))}
              </MapContainer>
              <div className="journey-vignette" aria-hidden="true" />
              <motion.div
                className="journey-veil"
                animate={{ opacity: isTravelling ? 1 : 0 }}
                transition={{ duration: isTravelling ? 0.22 : 0.65 }}
              >
                <Sparkles size={18} />
              </motion.div>
              <AnimatePresence>
                {showFirstHint && (
                  <motion.div
                    className="journey-first-hint"
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <span className="rail-light" />
                    Tap a glowing light to travel
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="journey-rail-panel">
              <div className="journey-rail-context">
                <div>
                  <strong>{contextTitle}</strong>
                  <span>{seenIds.size} of {memories.length} moments seen</span>
                </div>
                <div
                  className="journey-seen-progress"
                  role="progressbar"
                  aria-label={`${seenIds.size} of ${memories.length} moments seen`}
                  aria-valuemin={0}
                  aria-valuemax={memories.length}
                  aria-valuenow={seenIds.size}
                >
                  <i style={{ width: `${seenProgress}%` }} />
                </div>
              </div>
              <div className="journey-location-rail" aria-label="Places and memories">
                {points.map((point, index) => {
                  const pointMemories =
                    point.kind === 'memory' ? [point.memory] : point.memories
                  const seen = pointMemories.every((memory) =>
                    seenIds.has(memory.id),
                  )
                  return (
                    <RailCard
                      key={point.id}
                      point={point}
                      index={index}
                      seen={seen}
                      onClick={() => activatePoint(point)}
                    />
                  )
                })}
              </div>
            </div>

            <div className="journey-guidance">
              <span />
              {activeArea
                ? 'Choose a photograph'
                : activeCountry
                  ? 'Choose a place'
                  : 'Choose a country'}
            </div>
            <button className="journey-finish" onClick={finishJourney}>
              Finish journey <ChevronDown size={14} />
            </button>

            <AnimatePresence>
              {selected && (
                <StoryView
                  memory={selected}
                  index={Math.max(
                    0,
                    visibleMemories.findIndex(
                      (memory) => memory.id === selected.id,
                    ),
                  )}
                  total={visibleMemories.length}
                  onClose={() => setSelected(null)}
                  onPrevious={() => stepMemory(-1)}
                  onNext={() => stepMemory(1)}
                  onContinue={continueJourney}
                />
              )}
            </AnimatePresence>
          </motion.div>,
          document.body,
        )}
    </>
  )
}
