import React, { useRef, useState, useEffect } from 'react';

/**
 * Componente ImageProcessor
 * Permite capturar foto ou carregar da galeria, com crop inteligente
 * Retorna apenas a área cortada para OCR
 */
export default function ImageProcessor({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropContainerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [image, setImage] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState('camera'); // 'camera' ou 'gallery'
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef(null); // ✅ Para requestAnimationFrame

  // Iniciar câmera
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  // Inicializar área de crop quando imagem for carregada (centralizada e 80% do tamanho)
  useEffect(() => {
    if (image && isCropping && cropContainerRef.current) {
      const img = new Image();
      img.onload = () => {
        const containerWidth = cropContainerRef.current?.offsetWidth || img.width;
        const containerHeight = cropContainerRef.current?.offsetHeight || img.height;
        
        // Calcular dimensões: 80% da imagem
        const width = img.width * 0.8;
        const height = img.height * 0.6;
        
        // Centralizar
        const x = (img.width - width) / 2;
        const y = (img.height - height) / 2;
        
        setImageSize({ width: img.width, height: img.height });
        setCropArea({ x, y, width, height });
      };
      img.src = image;
    }
  }, [image, isCropping]);

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
      setImage(imageData);
      setIsCropping(true);
      // Parar câmera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e) => {
    if (!isCropping) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isCropping) return;

    // ✅ OTIMIZAÇÃO: Usar requestAnimationFrame para evitar lag
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setCropArea(prev => {
        let newX = prev.x + deltaX;
        let newY = prev.y + deltaY;

        // Limitar aos limites da imagem
        newX = Math.max(0, Math.min(newX, imageSize.width - prev.width));
        newY = Math.max(0, Math.min(newY, imageSize.height - prev.height));

        return {
          ...prev,
          x: newX,
          y: newY,
        };
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // ✅ TOUCH EVENTS: Suporte para dispositivos móveis
  const handleTouchStart = (e) => {
    if (!isCropping) return;
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const container = cropContainerRef.current;
    
    if (container) {
      const rect = container.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;
      const relativeY = touch.clientY - rect.top;
      
      setIsDragging(true);
      setDragStart({ x: relativeX, y: relativeY });
      console.log('ImageProcessor - Touch Start (relativo):', { relativeX, relativeY });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isCropping) return;
    e.preventDefault();
    e.stopPropagation();

    // ✅ OTIMIZAÇÃO: Usar requestAnimationFrame para evitar lag em touch
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const touch = e.touches[0];
      const container = cropContainerRef.current;
      
      if (container) {
        // ✅ SINCRONIZAÇÃO: Coordenadas relativas ao container
        const rect = container.getBoundingClientRect();
        const relativeX = touch.clientX - rect.left;
        const relativeY = touch.clientY - rect.top;
        
        const deltaX = relativeX - dragStart.x;
        const deltaY = relativeY - dragStart.y;

        setCropArea(prev => {
          let newX = prev.x + deltaX;
          let newY = prev.y + deltaY;

          // Limitar aos limites da imagem
          newX = Math.max(0, Math.min(newX, imageSize.width - prev.width));
          newY = Math.max(0, Math.min(newY, imageSize.height - prev.height));

          return {
            ...prev,
            x: newX,
            y: newY,
          };
        });

        setDragStart({ x: relativeX, y: relativeY });
      }
    });
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    console.log('ImageProcessor - Touch End');
  };

  // ✅ HANDLES EM 8 PONTOS (4 cantos + 4 laterais)
  const handleResize = (direction, e) => {
    if (!isCropping) return;
    e.preventDefault();
    e.stopPropagation();
    
    const container = cropContainerRef.current;
    let startX, startY;
    
    if (container && e.touches) {
      // ✅ SINCRONIZAÇÃO: Touch event - coordenadas relativas
      const rect = container.getBoundingClientRect();
      const touch = e.touches[0];
      startX = touch.clientX - rect.left;
      startY = touch.clientY - rect.top;
    } else {
      // Mouse event
      startX = e.clientX;
      startY = e.clientY;
    }
    
    const startCropArea = { ...cropArea };

    const handleResizeMove = (moveEvent) => {
      // ✅ OTIMIZAÇÃO: Usar requestAnimationFrame para redimensionamento
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        let deltaX, deltaY;
        
        if (container && moveEvent.touches) {
          // ✅ SINCRONIZAÇÃO: Touch event - coordenadas relativas
          const rect = container.getBoundingClientRect();
          const touch = moveEvent.touches[0];
          deltaX = (touch.clientX - rect.left) - startX;
          deltaY = (touch.clientY - rect.top) - startY;
        } else {
          // Mouse event
          deltaX = moveEvent.clientX - startX;
          deltaY = moveEvent.clientY - startY;
        }

      let newCropArea = { ...startCropArea };

      // Redimensionar baseado na direção
      if (direction.includes('right')) {
        newCropArea.width = Math.max(50, Math.min(startCropArea.width + deltaX, imageSize.width - startCropArea.x));
      }
      if (direction.includes('bottom')) {
        newCropArea.height = Math.max(50, Math.min(startCropArea.height + deltaY, imageSize.height - startCropArea.y));
      }
      if (direction.includes('left')) {
        const newWidth = startCropArea.width - deltaX;
        if (newWidth > 50) {
          newCropArea.x = Math.max(0, startCropArea.x + deltaX);
          newCropArea.width = newWidth;
        }
      }
      if (direction.includes('top')) {
        const newHeight = startCropArea.height - deltaY;
        if (newHeight > 50) {
          newCropArea.y = Math.max(0, startCropArea.y + deltaY);
          newCropArea.height = newHeight;
        }
      }

        setCropArea(newCropArea);
      });
    };

    const handleResizeEnd = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    // ✅ Adicionar suporte a touch events para redimensionamento
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      handleResizeMove({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });
    document.addEventListener('touchend', handleResizeEnd);
  };

  const confirmCrop = () => {
    if (image && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;
        const ctx = canvas.getContext('2d');
        
        // Desenhar apenas a área cortada
        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          0,
          0,
          cropArea.width,
          cropArea.height
        );

        const croppedImage = canvas.toDataURL('image/jpeg');
        onCapture(croppedImage);
      };
      img.src = image;
    }
  };

  const retake = () => {
    setImage(null);
    setIsCropping(false);
    if (mode === 'camera') {
      startCamera();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Capturar Caderneta</h2>

        {!isCropping ? (
          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setMode('camera')}
                className={`flex-1 px-4 py-2 rounded-lg transition font-semibold ${
                  mode === 'camera'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📷 Tirar Foto
              </button>
              <button
                onClick={() => setMode('gallery')}
                className={`flex-1 px-4 py-2 rounded-lg transition font-semibold ${
                  mode === 'gallery'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🖼️ Galeria
              </button>
            </div>

            {mode === 'camera' ? (
              <>
                {/* Camera View */}
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', maxWidth: '100%' }}>
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
              </>
            ) : (
              <>
                {/* Gallery View */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleGallerySelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Selecionar Imagem
                  </button>
                  <p className="text-gray-600 text-sm mt-3">Clique para selecionar uma imagem da galeria</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Crop View */}
            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-semibold">
                Ajuste o retângulo para selecionar apenas a área dos números
              </p>

              {/* Crop Container - ✅ COM MAX-WIDTH PARA EVITAR OVERFLOW + TOUCH EVENTS */}
              <div
                ref={cropContainerRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ aspectRatio: '4/3', maxWidth: '100%', width: '100%' }}
              >
                <img
                  src={image}
                  alt="Para cortar"
                  className="w-full h-full object-cover"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                />

                {/* Overlay escuro */}
                <div
                  className="absolute inset-0 bg-black opacity-50 pointer-events-none"
                  style={{
                    clipPath: `polygon(
                      0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                      ${(cropArea.x / imageSize.width) * 100}% ${(cropArea.y / imageSize.height) * 100}%,
                      ${((cropArea.x + cropArea.width) / imageSize.width) * 100}% ${(cropArea.y / imageSize.height) * 100}%,
                      ${((cropArea.x + cropArea.width) / imageSize.width) * 100}% ${((cropArea.y + cropArea.height) / imageSize.height) * 100}%,
                      ${(cropArea.x / imageSize.width) * 100}% ${((cropArea.y + cropArea.height) / imageSize.height) * 100}%
                    )`
                  }}
                />

                {/* Crop Area Border e Handles */}
                {imageSize.width > 0 && (
                  <div
                    className="absolute border-2 border-green-400 cursor-move group"
                    style={{
                      left: `${(cropArea.x / imageSize.width) * 100}%`,
                      top: `${(cropArea.y / imageSize.height) * 100}%`,
                      width: `${(cropArea.width / imageSize.width) * 100}%`,
                      height: `${(cropArea.height / imageSize.height) * 100}%`,
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                  >
                    {/* ✅ 8 HANDLES: 4 CANTOS + 4 LATERAIS */}
                    {/* ✅ Top-Left Corner */}
                    <div
                      className="absolute -left-2 -top-2 w-4 h-4 bg-green-400 rounded-full cursor-nwse-resize"
                      onMouseDown={(e) => handleResize('left-top', e)}
                      onTouchStart={(e) => handleResize('left-top', e)}
                    />
                    {/* ✅ Top-Right Corner */}
                    <div
                      className="absolute -right-2 -top-2 w-4 h-4 bg-green-400 rounded-full cursor-nesw-resize"
                      onMouseDown={(e) => handleResize('right-top', e)}
                      onTouchStart={(e) => handleResize('right-top', e)}
                    />
                    {/* ✅ Bottom-Left Corner */}
                    <div
                      className="absolute -left-2 -bottom-2 w-4 h-4 bg-green-400 rounded-full cursor-nesw-resize"
                      onMouseDown={(e) => handleResize('left-bottom', e)}
                      onTouchStart={(e) => handleResize('left-bottom', e)}
                    />
                    {/* ✅ Bottom-Right Corner */}
                    <div
                      className="absolute -right-2 -bottom-2 w-4 h-4 bg-green-400 rounded-full cursor-se-resize"
                      onMouseDown={(e) => handleResize('right-bottom', e)}
                      onTouchStart={(e) => handleResize('right-bottom', e)}
                    />

                    {/* ✅ Top Edge */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -top-2 w-6 h-4 bg-green-400 rounded-full cursor-ns-resize"
                      onMouseDown={(e) => handleResize('top', e)}
                      onTouchStart={(e) => handleResize('top', e)}
                    />
                    {/* ✅ Bottom Edge */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-6 h-4 bg-green-400 rounded-full cursor-ns-resize"
                      onMouseDown={(e) => handleResize('bottom', e)}
                      onTouchStart={(e) => handleResize('bottom', e)}
                    />
                    {/* ✅ Left Edge */}
                    <div
                      className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-6 bg-green-400 rounded-full cursor-ew-resize"
                      onMouseDown={(e) => handleResize('left', e)}
                      onTouchStart={(e) => handleResize('left', e)}
                    />
                    {/* ✅ Right Edge */}
                    <div
                      className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-6 bg-green-400 rounded-full cursor-ew-resize"
                      onMouseDown={(e) => handleResize('right', e)}
                      onTouchStart={(e) => handleResize('right', e)}
                    />
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-gray-700">
                <p className="font-semibold mb-1">📌 Instruções:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Arraste para mover o retângulo</li>
                  <li>Use os 8 pontos verdes para redimensionar</li>
                  <li>Selecione apenas a área dos números</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Tirar Outra
                </button>
                <button
                  onClick={confirmCrop}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  ✓ Confirmar Corte
                </button>
              </div>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
