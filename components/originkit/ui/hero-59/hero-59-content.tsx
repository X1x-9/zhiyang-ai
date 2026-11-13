// Delivered by Originkit · stack: nextjs · styling: tailwind
/* eslint-disable */
// @ts-nocheck
"use client";
import GlimmerVale from "@/components/originkit/ui/hero-59/glimmer-vale"

// Lavender palette for the Glimmer Vale scene
const LAVENDER_SCENE = {
  speed: 120,
  sparkle: 60,
  background: '#110E1F',
  skyTop: '#2B2560',
  skyHorizon: '#9A8FD4',
  style: { minWidth: 0, minHeight: 0 },
  advanced: {
    skyMid: '#4F4592',
    horizonGlow: '#F3ECFF',
    horizonGlowStrength: 40,
    crestColor: '#F6F2FF',
    slopeColor: '#A99BE6',
    slopeDeep: '#6A5CAE',
    hillShadow: '#241D3D',
    glowColor: '#ECE4FF',
    glowStrength: 65,
    petalColor: '#F5F1FF',
    petalTip: '#C3B6F5',
    flowerCore: '#C95A9A',
    hotspotX: 50,
  },
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="13" r="5.5" fill="currentColor" />
      <path
        d="M2 26c4.5-5 8.5-7 14-7s9.5 2 14 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M16 3v2.5M6.5 7l1.7 1.7M25.5 7l-1.7 1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  return (
    <section className="hero" aria-label="Aurelle">
      <div className="hero__scene" aria-hidden="true">
        <GlimmerVale {...LAVENDER_SCENE} />
      </div>
      <div className="hero__scrim" />

      <div className="hero__inner">
        <header className="nav">
          <a className="logo" href="#" aria-label="Aurelle home">
            <Logo />
            Aurelle
          </a>
          <nav aria-label="Main">
            <ul className="nav__links">
              <li><a href="#stays">Stays</a></li>
              <li><a href="#walks">Evening walks</a></li>
              <li><a href="#dining">Dining</a></li>
              <li><a href="#journal">Journal</a></li>
            </ul>
          </nav>
          <a className="nav__book" href="#book">Book a stay</a>
        </header>

        <div className="hero__copy">
          <div className="hero__title-wrap">
            <h1 className="hero__title">Where the hills keep the last of the light</h1>
          </div>
          <div className="hero__aside">
            <p className="hero__desc">
              Twelve cottages on a quiet ridge, a supper table under the open sky, and
              meadow paths that glow long after sundown. Stay a night or a season.
            </p>
            <a className="cta" href="#book">Reserve your evening</a>
          </div>
        </div>
      </div>
    </section>
  )
}
