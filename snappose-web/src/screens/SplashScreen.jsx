import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => onDone(), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      height: '100%',
      background: 'linear-gradient(160deg, #c9e9f8 0%, #a8d5ed 35%, #b0c8e8 70%, #d4b8d8 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.45s ease',
      opacity: phase >= 2 ? 0 : 1,
    }}>
      <div style={{
        transform: phase >= 1 ? 'scale(1) translateY(0)' : 'scale(0.72) translateY(24px)',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'all 0.55s cubic-bezier(0.2, 0.8, 0.3, 1)',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>
        {/* App logo */}
        <img
          src="/logo.png"
          alt="SnapPose"
          style={{
            width: 110,
            height: 110,
            borderRadius: 28,
            boxShadow: '0 16px 48px rgba(100,140,200,0.35), 0 4px 16px rgba(0,0,0,0.12)',
            display: 'block',
          }}
        />

        {/* App name */}
        <div>
          <div style={{
            fontSize: 30, fontWeight: 900,
            letterSpacing: '-0.5px', lineHeight: 1,
            color: '#1a2e4a',
          }}>
            Snap<span style={{ color: '#0EA5E9' }}>Pose</span>
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(30,60,100,0.55)',
            marginTop: 6, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            AI Pose Guide
          </div>
        </div>
      </div>
    </div>
  );
}
