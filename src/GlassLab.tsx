import { useRef } from 'react'
import { LiquidGlass } from 'simple-liquid-glass'
import RdevLiquidGlass from 'liquid-glass-react'

function GlassCard({ engine }: { engine: 'simple' | 'rdev' }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  return (
    <article className="glass-lab-card">
      <div className="glass-lab-scene">
        <div className="glass-lab-backdrop" ref={backdropRef} aria-hidden="true" />
        <div className="glass-lab-label" aria-hidden="true">The art of<br />arriving.</div>
        <div className="glass-lab-lens-wrap">
          {engine === 'simple' ? (
            <LiquidGlass
              backdropRef={backdropRef}
              renderer="auto"
              material="clear"
              refraction="lens"
              lensOptions={{ strength: 0.16, sheen: 2, specular: 1.35 }}
              scale={120}
              radius={42}
              quality="standard"
              maxScale={1.5}
              blur={0}
              frost={0}
              background="rgba(171, 191, 216, .11)"
              style={{ width: 300, maxWidth: '100%' }}
            >
              <div className="glass-lab-glass-content">Begin your journey →</div>
            </LiquidGlass>
          ) : (
            <RdevLiquidGlass
              displacementScale={40}
              blurAmount={0.045}
              saturation={155}
              aberrationIntensity={1.5}
              elasticity={0.13}
              cornerRadius={42}
              padding="0px"
              mode="standard"
            >
              <div className="glass-lab-glass-content">Begin your journey →</div>
            </RdevLiquidGlass>
          )}
        </div>
      </div>
      <div className="glass-lab-meta">
        <h2>{engine === 'simple' ? 'A · Simple Liquid Glass' : 'B · Liquid Glass React'}</h2>
        <p>{engine === 'simple'
          ? 'SVG lens optics on Chromium. A sibling backdrop enables WebGL refraction on iPhone Safari and Firefox.'
          : 'Animated elastic lens with SVG displacement on Chromium. Safari and Firefox have limited backdrop refraction.'}</p>
      </div>
    </article>
  )
}

export default function GlassLab() {
  return (
    <main className="glass-lab">
      <header className="glass-lab-header">
        <a href="/">← Back to CHAUFFEUR</a>
        <h1>Liquid Glass · optical comparison</h1>
        <p>Two MIT-licensed React engines against the same charcoal lighting study.
           Try them on desktop and iPhone Safari. CHAUFFEUR's live booking entry uses option A;
           this comparison does not submit reservations.</p>
      </header>
      <div className="glass-lab-grid">
        <GlassCard engine="simple" />
        <GlassCard engine="rdev" />
      </div>
    </main>
  )
}
