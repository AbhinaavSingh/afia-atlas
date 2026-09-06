import { motion } from 'framer-motion'
import { ArrowLeft, Camera, Check, ImagePlus, LoaderCircle, MapPin, Navigation, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { submitMemory } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { contributionSchema } from '../../lib/validation'
import { createJourneyIcon } from '../journey/markers'

const contributionPin = createJourneyIcon({
  kind: 'pin',
  label: 'Memory location',
})

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; theme: string },
      ) => string
      reset: (id?: string) => void
    }
  }
}

function PinController({
  position,
  onChange,
}: {
  position: [number, number]
  onChange: (position: [number, number]) => void
}) {
  const map = useMap()
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng])
    },
  })
  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 5), { duration: 1.1 })
  }, [map, position])
  return <Marker position={position} icon={contributionPin} />
}

export function ContributePage() {
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [position, setPosition] = useState<[number, number]>([25, 10])
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftStory, setDraftStory] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftWhen, setDraftWhen] = useState('')
  const [locationMeta, setLocationMeta] = useState({
    city: '',
    regionName: '',
    countryCode: '',
  })
  const [findingPlace, setFindingPlace] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
    if (!sitekey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      if (turnstileRef.current && window.turnstile) {
        window.turnstile.render(turnstileRef.current, {
          sitekey,
          callback: setTurnstileToken,
          theme: 'dark',
        })
      }
    }
    document.head.appendChild(script)
    return () => script.remove()
  }, [])

  const selectPhoto = (file?: File) => {
    if (!file) return
    setPhoto(file)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
  }

  const findPlace = async () => {
    if (placeQuery.trim().length < 2) return
    setFindingPlace(true)
    setError('')
    try {
      const params = new URLSearchParams({
        q: placeQuery,
        format: 'jsonv2',
        limit: '1',
        addressdetails: '1',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      const [place] = (await response.json()) as Array<{
        lat: string
        lon: string
        display_name: string
        address?: {
          city?: string
          town?: string
          village?: string
          municipality?: string
          state?: string
          country_code?: string
        }
      }>
      if (!place) throw new Error('We could not find that place.')
      setPosition([Number(place.lat), Number(place.lon)])
      setPlaceName(place.display_name)
      setLocationMeta({
        city:
          place.address?.city ??
          place.address?.town ??
          place.address?.village ??
          place.address?.municipality ??
          '',
        regionName: place.address?.state ?? '',
        countryCode: place.address?.country_code?.toUpperCase() ?? '',
      })
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Place search failed.')
    } finally {
      setFindingPlace(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!photo) {
      setError('Please choose one photograph for your memory.')
      return
    }

    const raw = Object.fromEntries(new FormData(event.currentTarget))
    const parsed = contributionSchema.safeParse({
      ...raw,
      locationName: placeName || placeQuery,
      ...locationMeta,
      latitude: position[0],
      longitude: position[1],
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.')
      return
    }

    setStatus('submitting')
    try {
      const images = await prepareImage(photo)
      const payload = new FormData()
      Object.entries(parsed.data).forEach(([key, value]) =>
        payload.set(key, String(value)),
      )
      payload.set('image', images.full)
      payload.set('thumbnail', images.thumbnail)
      await submitMemory(payload, turnstileToken)
      setStatus('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'We could not send your memory.',
      )
      setStatus('idle')
      window.turnstile?.reset()
    }
  }

  if (status === 'success') {
    return (
      <main className="contribute-page success-page">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="success-mark"><Check /></div>
          <p className="eyebrow">Your page is in the atlas</p>
          <h1>This moment now has a place in her world.</h1>
          <p>
            Thank you for giving Afia a photograph she can travel back to. It
            will join her private geographic photo album after review.
          </p>
          <button className="secondary-button" onClick={() => window.location.reload()}>
            Place another moment
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="contribute-page">
      <header className="page-nav">
        <Link to="/"><ArrowLeft size={16} /> Back</Link>
        <span>AFIA’S ATLAS · 30</span>
      </header>
      <section className="contribute-intro">
        <p className="eyebrow">A geographic photo album</p>
        <h1>Place one moment on her map.</h1>
        <p>
          This is not a birthday questionnaire. Choose one photograph that
          takes you back to a real place, then tell Afia what was happening
          just beyond the frame.
        </p>
      </section>

      <form ref={formRef} className="contribution-form atlas-form" onSubmit={handleSubmit}>
        <aside className="atlas-preview" aria-label="Preview of your atlas page">
          <div className="atlas-preview-label">
            <span>Live page preview</span>
            <small>Afia’s Atlas · 30</small>
          </div>
          <div className="atlas-preview-photo">
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <div><Camera size={28} /><span>Your photograph</span></div>
            )}
          </div>
          <div className="atlas-preview-copy">
            <p><MapPin size={12} /> {placeName || placeQuery || 'Somewhere in your shared world'}</p>
            <h2>{draftTitle || 'The title of your moment'}</h2>
            <blockquote>
              {draftStory
                ? `${draftStory.slice(0, 150)}${draftStory.length > 150 ? '…' : ''}`
                : 'The story inside this photograph will appear here.'}
            </blockquote>
            <span>
              {draftName ? `From ${draftName}` : 'From someone who was there'}
              {draftWhen ? ` · ${draftWhen}` : ''}
            </span>
          </div>
        </aside>

        <div className="atlas-fields">
          <section className="form-section">
            <div className="form-number">01</div>
            <div className="form-content">
              <p className="atlas-step-kicker">Begin with the evidence</p>
              <h2>Choose the frame.</h2>
              <p className="atlas-step-intro">
                Pick one photograph that instantly returns you to a moment with Afia.
              </p>
              <label className={`photo-drop atlas-photo-drop ${preview ? 'has-photo' : ''}`}>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={(event) => selectPhoto(event.target.files?.[0])}
                />
                {preview ? (
                  <img src={preview} alt="Selected moment preview" />
                ) : (
                  <>
                    <ImagePlus size={28} />
                    <strong>Choose your photograph</strong>
                    <span>One image · JPEG, PNG, WebP or HEIC · up to 15 MB</span>
                  </>
                )}
              </label>
              {preview && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(preview)
                    setPhoto(null)
                    setPreview('')
                  }}
                >
                  Choose a different photograph
                </button>
              )}
            </div>
          </section>

          <section className="form-section">
            <div className="form-number">02</div>
            <div className="form-content">
              <p className="atlas-step-kicker">Give it coordinates</p>
              <h2>Put it back on the map.</h2>
              <p className="atlas-step-intro">
                Where would this photograph live in Afia’s atlas?
              </p>
              <div className="place-search">
                <label>
                  City, landmark, café, home, or place
                  <div className="input-action">
                    <input
                      value={placeQuery}
                      onChange={(event) => setPlaceQuery(event.target.value)}
                      placeholder="Search for the place in the photograph"
                      required
                    />
                    <button type="button" onClick={findPlace} aria-label="Find place">
                      {findingPlace ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
                    </button>
                  </div>
                </label>
              </div>
              <div className="location-map">
                <MapContainer center={position} zoom={2} scrollWheelZoom={false}>
                  <TileLayer
                    attribution="Tiles &copy; Esri"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  />
                  <PinController position={position} onChange={setPosition} />
                </MapContainer>
                <p><Navigation size={14} /> Search, then tap to place this moment.</p>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-number">03</div>
            <div className="form-content">
              <p className="atlas-step-kicker">Open the photograph</p>
              <h2>What lives inside this frame?</h2>
              <p className="atlas-step-intro">
                Tell her what the camera caught—and what it could not.
              </p>
              <label>
                Give this moment a title
                <input
                  name="title"
                  required
                  maxLength={120}
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="The rooftop where five minutes became five hours"
                />
              </label>
              <label>
                What was happening here?
                <textarea
                  name="story"
                  required
                  minLength={20}
                  maxLength={1800}
                  rows={8}
                  value={draftStory}
                  onChange={(event) => setDraftStory(event.target.value)}
                  placeholder="What happened just before this photo? What can you still hear, feel, or laugh about? Why does this moment stay with you?"
                />
              </label>
              <label>
                When was this? <span className="optional">Approximate is perfect</span>
                <input
                  name="happenedAt"
                  maxLength={40}
                  value={draftWhen}
                  onChange={(event) => setDraftWhen(event.target.value)}
                  placeholder="Summer 2019, university, one rainy Tuesday…"
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-number">04</div>
            <div className="form-content">
              <p className="atlas-step-kicker">Sign the page</p>
              <h2>Who was there?</h2>
              <div className="form-grid two">
                <label>
                  Your name
                  <input
                    name="contributorName"
                    required
                    maxLength={80}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Your connection to Afia
                  <input name="relationship" maxLength={80} placeholder="Friend, cousin, co-adventurer…" />
                </label>
              </div>
            </div>
          </section>

          <div ref={turnstileRef} className="turnstile" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button submit-button atlas-submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? (
              <><LoaderCircle className="spin" size={18} /> Placing your moment…</>
            ) : (
              <><MapPin size={17} /> Place this moment in Afia’s atlas</>
            )}
          </button>
          <p className="privacy-note">
            This photograph and story are used only for Afia’s private birthday atlas.
          </p>
        </div>
      </form>
    </main>
  )
}
