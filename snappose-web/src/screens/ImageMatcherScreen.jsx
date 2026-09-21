import { useState, useRef } from 'react';
import { matchImageFile, matchImage } from '../api/poses';
import { resolveImageUrl } from '../api/client';
import { COLORS } from '../constants/colors';

export default function ImageMatcherScreen({ onApplyPose, onBackToCamera }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
      runAnalysis(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async (file, dataUrl) => {
    setAnalyzing(true);
    setError(null);
    try {
      const data = file ? await matchImageFile(file, 10) : await matchImage(dataUrl, 10);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Phân tích ảnh thất bại');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0a0a0f 70%, #000000 100%)',
      color: '#fff',
      overflowY: 'auto',
      padding: 'max(16px, env(safe-area-inset-top)) 16px calc(90px + env(safe-area-inset-bottom))',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
            CLIP Vision Intelligence
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 0', letterSpacing: -0.5 }}>
            🔍 AI Matcher
          </h1>
        </div>

        <button
          onClick={onBackToCamera}
          className="liquid-btn"
          style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: 20,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ← Camera
        </button>
      </div>

      {/* Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="liquid-glass-card liquid-btn"
        style={{
          border: '2px dashed rgba(255,255,255,0.22)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 18,
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {previewUrl ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxHeight: 220,
                maxWidth: '100%',
                borderRadius: 14,
                objectFit: 'contain',
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              }}
            />
            {analyzing && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(8px)',
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36,
                  border: '3px solid rgba(255,255,255,0.2)',
                  borderTopColor: COLORS.accent,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
                  Đang nhận diện môi trường & so khớp...
                </span>
              </div>
            )}
            <p style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Chạm để đổi ảnh khác
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🖼️</div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16 }}>Tải ảnh lên để phân tích</p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', maxWidth: 300, marginInline: 'auto' }}>
              CLIP sẽ trích xuất vector 512 chiều, phát hiện môi trường & đề xuất tư thế chuẩn nhất
            </p>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(220,50,50,0.25)',
          border: '1px solid rgba(220,50,50,0.4)',
          color: '#ff8888',
          padding: '12px 16px',
          borderRadius: 14,
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Environment Detection Badge */}
          {result.detected_environment && (
            <div
              className="liquid-glass-card"
              style={{
                background: 'linear-gradient(135deg, rgba(30,58,138,0.6), rgba(88,28,135,0.6))',
                border: '1px solid rgba(147,197,253,0.3)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  Môi trường phát hiện
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                  📍 {result.detected_environment.name}
                </h3>
              </div>
              <div
                className="liquid-glass-pill"
                style={{
                  padding: '6px 14px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#93c5fd',
                }}
              >
                {result.detected_environment.confidence_percent}% khớp
              </div>
            </div>
          )}

          {/* Breakdown */}
          {result.environments?.length > 1 && (
            <div
              className="liquid-glass-card"
              style={{ padding: '16px' }}
            >
              <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                Độ tương quan theo môi trường
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.environments.map((env) => (
                  <div key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ width: 90, flexShrink: 0, fontWeight: 600 }}>{env.name}</span>
                    <div style={{
                      flex: 1,
                      height: 8,
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${env.confidence_percent}%`,
                        height: '100%',
                        background: env.id === result.detected_environment?.id
                          ? 'linear-gradient(90deg, #3b82f6, #a855f7)'
                          : 'rgba(255,255,255,0.3)',
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ width: 45, textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      {env.confidence_percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Poses */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>
              Các tư thế gợi ý hàng đầu ({result.matches?.length || 0})
            </h4>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {result.matches?.map((pose) => (
                <div
                  key={pose.id}
                  className="liquid-glass-card"
                  style={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', height: 180, background: '#000' }}>
                    <img
                      src={resolveImageUrl(pose.photo_url)}
                      alt={pose.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {pose.skeleton_url && (
                      <img
                        src={resolveImageUrl(pose.skeleton_url)}
                        alt="Skeleton"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          opacity: 0.65,
                        }}
                      />
                    )}
                    {pose.similarity != null && (
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(6px)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#60a5fa',
                      }}>
                        {Math.round(pose.similarity * 100)}% khớp
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{pose.name}</span>
                      <span style={{
                        fontSize: 10,
                        background: 'rgba(255,255,255,0.12)',
                        padding: '2px 6px',
                        borderRadius: 6,
                        color: '#ddd',
                      }}>
                        {pose.category_name || 'Pose'}
                      </span>
                    </div>

                    <button
                      onClick={() => onApplyPose(pose)}
                      className="liquid-btn"
                      style={{
                        marginTop: 'auto',
                        width: '100%',
                        padding: '8px 0',
                        borderRadius: 10,
                        background: COLORS.accent,
                        border: 'none',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      📸 Dùng pose này
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
