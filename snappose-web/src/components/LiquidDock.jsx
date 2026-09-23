import { COLORS } from '../constants/colors';

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const MatchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);
const DatasetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);

export default function LiquidDock({ currentScreen, onSelectScreen }) {
  const tabs = [
    { id: 'camera',  label: 'Camera',    Icon: CameraIcon },
    { id: 'gallery', label: 'Gallery',   Icon: GalleryIcon },
    { id: 'matcher', label: 'AI Match',  Icon: MatchIcon },
    { id: 'dataset', label: 'Dataset',   Icon: DatasetIcon },
  ];

  return (
    <nav className="liquid-dock" aria-label="Main navigation">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = currentScreen === id;
        return (
          <button
            key={id}
            onClick={() => onSelectScreen(id)}
            className={`liquid-dock-item ${isActive ? 'active' : ''}`}
            aria-label={label}
          >
            <div style={{
              transform: isActive ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              color: isActive ? COLORS.primary : undefined,
            }}>
              <Icon />
            </div>
            <span style={{
              color: isActive ? COLORS.primary : undefined,
              fontWeight: isActive ? 700 : 600,
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
