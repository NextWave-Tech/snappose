import { useEffect, useState } from 'react';
import { COLORS } from '../constants/colors';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 250);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => onDone(), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.4s ease', opacity: phase >= 2 ? 0 : 1,
    }}>
      <div style={{
        transform: phase >= 1 ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px',
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 32px ${COLORS.accent}40`,
        }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="8" r="5" stroke="white" strokeWidth="2" fill="none" />
            <path d="M18 14 C18 14 12 16 9 20 C6 24 6 30 6 36 L12 36 C12 30 14 24 18 22 C22 24 24 30 24 36 L30 36 C30 30 30 24 27 20 C24 16 18 14 18 14 Z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.5px', lineHeight: 1 }}>
          Snap<span style={{ color: COLORS.accent }}>Pose</span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 6, fontWeight: 500 }}>
          AI Pose Guide
        </div>
      </div>
    </div>
  );
}
