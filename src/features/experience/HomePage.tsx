import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, Heart, LockKeyhole, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { siteContent } from '../../content/site'
import { getPublicExperience } from '../../lib/api'
import type { Memory, SiteSettings } from '../../types'
import { MemoryJourney } from '../journey/MemoryJourney'

function useCountdown(target: string) {
  const [now, setNow] = useState(() => new Date(target).getTime())
  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(timer)
    }
  }, [target])
  return useMemo(() => {
    const distance = Math.max(0, new Date(target).getTime() - now)
    return {
      days: Math.floor(distance / 86_400_000),
      hours: Math.floor((distance / 3_600_000) % 24),
      minutes: Math.floor((distance / 60_000) % 60),
      seconds: Math.floor((distance / 1000) % 60),
    }
  }, [now, target])
}

function LockedPage({ settings }: { settings: SiteSettings }) {
  const countdown = useCountdown(settings.revealAt)
  return (
    <main className="locked-page">
      <div className="noise" />
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <motion.div
        className="locked-content"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
      >
        <div className="lock-mark">
          <LockKeyhole size={18} />
        </div>
        <p className="eyebrow">For {siteContent.name} · 30</p>
        <h1>{siteContent.lockedHeading}</h1>
        <p className="locked-copy">{siteContent.lockedCopy}</p>
        <div className="countdown" aria-label="Countdown until the reveal">
          {Object.entries(countdown).map(([label, value]) => (
            <div key={label}>
              <strong>{String(value).padStart(2, '0')}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <Link className="text-link" to="/contribute">
          Know Afia? Add a memory <span>↗</span>
        </Link>
      </motion.div>
    </main>
  )
}

function RevealedPage({ memories, demo }: { memories: Memory[]; demo: boolean }) {
  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, 120])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0])

  return (
    <main className="experience">
      <section className="hero-section">
        <div className="noise" />
        <div className="star-field" aria-hidden="true" />
        <motion.div
          className="hero-content"
          style={{ y: heroY, opacity: heroOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <p className="eyebrow">{siteContent.eyebrow}</p>
          <h1>
            Thirty years
            <span>of Afia.</span>
          </h1>
          <p className="hero-intro">{siteContent.intro}</p>
        </motion.div>
        <a className="scroll-cue" href="#letter" aria-label="Continue">
          <span>Begin</span>
          <ArrowDown size={15} />
        </a>
      </section>

      <section className="letter-section" id="letter">
        <motion.div
          className="chapter-number"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          30
        </motion.div>
        <motion.div
          className="letter-copy"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9 }}
        >
          <Sparkles size={20} />
          <p>{siteContent.invitation}</p>
          <div className="fine-line" />
          <span>Made from the memories of people who love you</span>
        </motion.div>
      </section>

      <section className="globe-section" id="memories">
        <div className="section-heading">
          <p className="eyebrow">The constellation</p>
          <h2>{siteContent.globeHeading}</h2>
          <p>{siteContent.globeSubheading}</p>
          {demo && (
            <span className="demo-pill">
              Preview mode · sample memories
            </span>
          )}
        </div>
        {memories.length ? (
          <MemoryJourney memories={memories} />
        ) : (
          <div className="empty-globe">
            <Heart />
            <p>The first lights are waiting to be approved.</p>
          </div>
        )}
      </section>

      <section className="dedication-section">
        <div className="dedication-orbit" aria-hidden="true">
          <span />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <p>{siteContent.dedication}</p>
          <span>{siteContent.signature}</span>
        </motion.div>
      </section>
    </main>
  )
}

export function HomePage() {
  const [state, setState] = useState<{
    settings: SiteSettings
    memories: Memory[]
    demo: boolean
    canPreview: boolean
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicExperience().then(setState).catch(() => {
      setError('This little universe is having trouble loading. Please try again.')
    })
  }, [])

  if (error) {
    return (
      <main className="center-state">
        <Sparkles />
        <h1>Almost there.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    )
  }
  if (!state) {
    return (
      <main className="center-state loading-state">
        <div className="loader-orbit" />
        <p>Gathering the stars…</p>
      </main>
    )
  }
  const previewRequested = new URLSearchParams(window.location.search).has('preview')
  if (!state.settings.revealed && !(state.canPreview && previewRequested)) {
    return <LockedPage settings={state.settings} />
  }
  return <RevealedPage memories={state.memories} demo={state.demo} />
}
