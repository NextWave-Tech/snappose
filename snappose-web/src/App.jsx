import { useState } from 'react';
import SplashScreen from './screens/SplashScreen';
import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
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

  const handleCaptured = (dataUrl) => {
    setPhotoDataUrl(dataUrl);
    setScreen('result');
  };

  const handleRetake = () => {
    setScreen('camera');
  };

  return (
    <div className="app-shell">
      {screen === 'splash' && <SplashScreen onDone={() => setScreen('camera')} />}
      {screen === 'camera' && (
        <CameraScreen
          onCaptured={handleCaptured}
          lastPhotoUrl={photoDataUrl}
          onViewLastPhoto={() => setScreen('result')}
        />
      )}
      {screen === 'result' && <ResultScreen photoDataUrl={photoDataUrl} onRetake={handleRetake} />}
    </div>
  );
}
