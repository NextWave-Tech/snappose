import { useState } from 'react';
import SplashScreen from './screens/SplashScreen';
import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
import ArtGalleryScreen from './screens/ArtGalleryScreen';
import ImageMatcherScreen from './screens/ImageMatcherScreen';
import DatasetImportScreen from './screens/DatasetImportScreen';
import LiquidDock from './components/LiquidDock';
import AdminApp from './admin/AdminApp';

export default function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return (
      <div className="app-shell">
        <AdminApp />
      </div>
    );
  }
  return <EndUserApp />;
}

function EndUserApp() {
  const [screen, setScreen] = useState('splash');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [selectedPose, setSelectedPose] = useState(null);

  const handleCaptured = (dataUrl) => {
    setPhotoDataUrl(dataUrl);
    // Stay on camera screen for seamless continuous shooting!
  };

  const handleRetake = () => {
    setScreen('camera');
  };

  const handleApplyPose = (pose) => {
    setSelectedPose(pose);
    setScreen('camera');
  };

  return (
    <div className="app-shell">
      {screen === 'splash' && (
        <SplashScreen onDone={() => setScreen('camera')} />
      )}

      {screen === 'camera' && (
        <CameraScreen
          onCaptured={handleCaptured}
          lastPhotoUrl={photoDataUrl}
          onViewLastPhoto={() => setScreen('result')}
          initialPose={selectedPose}
        />
      )}

      {screen === 'gallery' && (
        <ArtGalleryScreen
          onApplyPose={handleApplyPose}
          onBackToCamera={() => setScreen('camera')}
        />
      )}

      {screen === 'matcher' && (
        <ImageMatcherScreen
          onApplyPose={handleApplyPose}
          onBackToCamera={() => setScreen('camera')}
        />
      )}

      {screen === 'dataset' && (
        <DatasetImportScreen
          onBackToCamera={() => setScreen('camera')}
        />
      )}

      {screen === 'result' && (
        <ResultScreen
          photoDataUrl={photoDataUrl}
          onRetake={handleRetake}
          onGoToGallery={() => setScreen('gallery')}
        />
      )}

      {/* Persistent Liquid Glass Floating Dock for iPhone (except splash & result screens) */}
      {screen !== 'splash' && screen !== 'result' && (
        <LiquidDock
          currentScreen={screen}
          onSelectScreen={(tabId) => setScreen(tabId)}
        />
      )}
    </div>
  );
}
