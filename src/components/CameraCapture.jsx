import React, { useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      alert('Não foi possível acessar a câmera');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const imageData = canvasRef.current.toDataURL('image/jpeg');
      setCaptured(imageData);
    }
  };

  const confirmCapture = () => {
    if (captured) {
      onCapture(captured);
    }
  };

  const retake = () => {
    setCaptured(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-4">Capturar Caderneta</h2>

        {!captured ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Grid Guide */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-green-400 opacity-50"></div>
                <div className="absolute top-1/3 left-0 right-0 border-t border-green-400 opacity-30"></div>
                <div className="absolute top-2/3 left-0 right-0 border-t border-green-400 opacity-30"></div>
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-green-400 opacity-30"></div>
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-green-400 opacity-30"></div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
              <p className="font-semibold mb-1">💡 Dicas:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Boa iluminação</li>
                <li>Câmera perpendicular à caderneta</li>
                <li>Toda a caderneta visível</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={capturePhoto}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                📷 Capturar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <img src={captured} alt="Capturada" className="w-full rounded-lg" />

            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Tirar Outra
              </button>
              <button
                onClick={confirmCapture}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✓ Confirmar
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
