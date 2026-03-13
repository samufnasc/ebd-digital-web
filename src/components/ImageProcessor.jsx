import React, { useState, useRef, useEffect } from 'react';

/**
 * Componente ImageProcessor
 * Permite capturar foto ou carregar da galeria, com crop inteligente
 * Retorna apenas a área cortada para OCR
 * 
 * Evolução Mobile:
 * - Container retangular (melhor aproveitamento de tela)
 * - Rotação de imagem (não crop)
 * - 6 pontos de ajuste (4 cantos + 2 pontos centrais nas laterais maiores)
 * - requestAnimationFrame para performance
 * - preventDefault em todos os eventos de toque
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
  const [rotation, setRotation] = useState(0); // ✅ NOVO: Rotação da imagem (0, 90, 180, 270)
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
        // ✅ NOVO: Considerar rotação ao calcular dimensões
        let imgWidth = img.width;
        let imgHeight = img.height;
        
        // Se rotação é 90 ou 270, inverter dimensões
        if (rotation === 90 || rotation === 270) {
          [imgWidth, imgHeight] = [imgHeight, imgWidth];
        }
        
        // Calcular dimensões do crop (80% da imagem)
        const width = imgWidth * 0.8;
        const height = imgHeight * 0.6;
        
        // Centralizar
        const x = (imgWidth - width) / 2;
        const y = (imgHeight - height) / 2;
        
        setImageSize({ width: imgWidth, height: imgHeight });
        setCropArea({ x, y, width, height });
        
        console.log('ImageProcessor - Crop inicializado:', { x, y, width, height, rotation });
      };
      img.src = image;
    }
  }, [image, isCropping, rotation]);

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
      setRotation(0); // ✅ NOVO: Resetar rotação ao capturar
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
        setRotation(0); // ✅ NOVO: Resetar rotação ao carregar
      };
      reader.readAsDataURL(file);
    }
  };

  // ✅ NOVO: Função para girar a imagem
  const rotateImage = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    console.log('ImageProcessor - Imagem rotacionada para:', newRotation, 'graus');
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
    e.preventDefault();      // ✅ Bloqueia scroll
    e.stopPropagation();     // ✅ Impede propagação
    
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
    e.preventDefault();      // ✅ Bloqueia scroll
    e.stopPropagation();     // ✅ Impede propagação

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
    e.preventDefault();      // ✅ Bloqueia scroll
    e.stopPropagation();     // ✅ Impede propagação
    
    setIsDragging(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    console.log('ImageProcessor - Touch End');
  };

  // ✅ HANDLES EM 6 PONTOS (4 cantos + 2 pontos centrais nas laterais maiores)
  const handleResize = (direction, e) => {
    if (!isCropping) return;
    e.preventDefault();      // ✅ Bloqueia scroll
    e.stopPropagation();     // ✅ Impede propagação
    
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
        
        if (moveEvent.touches) {
          const rect = container.getBoundingClientRect();
          const touch = moveEvent.touches[0];
          const currentX = touch.clientX - rect.left;
          const currentY = touch.clientY - rect.top;
          deltaX = currentX - startX;
          deltaY = currentY - startY;
        } else {
          deltaX = moveEvent.clientX - startX;
          deltaY = moveEvent.clientY - startY;
        }

        let newCropArea = { ...startCropArea };

        switch (direction) {
          case 'left-top':
            newCropArea.x = Math.max(0, startCropArea.x + deltaX);
            newCropArea.y = Math.max(0, startCropArea.y + deltaY);
            newCropArea.width = startCropArea.width - deltaX;
            newCropArea.height = startCropArea.height - deltaY;
            break;
          case 'right-top':
            newCropArea.y = Math.max(0, startCropArea.y + deltaY);
            newCropArea.width = startCropArea.width + deltaX;
            newCropArea.height = startCropArea.height - deltaY;
            break;
          case 'left-bottom':
            newCropArea.x = Math.max(0, startCropArea.x + deltaX);
            newCropArea.width = startCropArea.width - deltaX;
            newCropArea.height = startCropArea.height + deltaY;
            break;
          case 'right-bottom':
            newCropArea.width = startCropArea.width + deltaX;
            newCropArea.height = startCropArea.height + deltaY;
            break;
          // ✅ NOVO: Pontos centrais nas laterais maiores
          case 'top-center':
            newCropArea.y = Math.max(0, startCropArea.y + deltaY);
            newCropArea.height = startCropArea.height - deltaY;
            break;
          case 'bottom-center':
            newCropArea.height = startCropArea.height + deltaY;
            break;
          default:
            break;
        }

        // Limitar tamanho mínimo
        if (newCropArea.width > 50 && newCropArea.height > 50) {
          setCropArea(newCropArea);
        }
      });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResizeMove);
      document.removeEventListener('touchend', handleResizeEnd);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleResizeMove, { passive: false });
    document.addEventListener('touchend', handleResizeEnd);
  };

  const retake = () => {
    setImage(null);
    setIsCropping(false);
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setRotation(0); // ✅ NOVO: Resetar rotação
    if (mode === 'camera') {
      startCamera();
    }
  };

  const extractCroppedImage = () => {
    if (!image || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      
      // ✅ NOVO: Considerar rotação ao extrair
      let drawWidth = img.width;
      let drawHeight = img.height;
      
      // Se rotação é 90 ou 270, inverter dimensões
      if (rotation === 90 || rotation === 270) {
        [drawWidth, drawHeight] = [drawHeight, drawWidth];
      }
      
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      const ctx = canvas.getContext('2d');
      
      // ✅ NOVO: Aplicar rotação antes de desenhar
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
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
      
      ctx.restore();
      
      const croppedImage = canvas.toDataURL('image/jpeg');
      console.log('ImageProcessor - Imagem cortada extraída com rotação:', rotation);
      onCapture(croppedImage);
    };
    img.src = image;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Capturar/Carregar Imagem</h2>

        {!image ? (
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
                {/* Camera View - ✅ RETANGULAR */}
                <div className="relative bg-black rounded-lg overflow-hidden border-2 border-gray-300" style={{ aspectRatio: '16/9', maxWidth: '100%' }}>
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

              {/* ✅ NOVO: Botão de Rotação (em vez de toggle portrait/landscape) */}
              <div className="flex gap-3">
                <button
                  onClick={rotateImage}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
                >
                  🔄 Girar {rotation}°
                </button>
              </div>

              {/* Crop Container - ✅ RETANGULAR COM MAX-WIDTH PARA EVITAR OVERFLOW + TOUCH EVENTS */}
              <div
                ref={cropContainerRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ aspectRatio: '16/9', maxWidth: '100%', width: '100%' }}
              >
                <img
                  src={image}
                  alt="Para cortar"
                  className="w-full h-full object-cover"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                  }}
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
                    {/* ✅ 6 HANDLES: 4 CANTOS + 2 PONTOS CENTRAIS NAS LATERAIS MAIORES */}
                    
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

                    {/* ✅ NOVO: Top-Center Point (para laterais maiores em paisagem) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 bg-green-300 rounded-full cursor-ns-resize"
                      onMouseDown={(e) => handleResize('top-center', e)}
                      onTouchStart={(e) => handleResize('top-center', e)}
                    />

                    {/* ✅ NOVO: Bottom-Center Point (para laterais maiores em paisagem) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-3 h-3 bg-green-300 rounded-full cursor-ns-resize"
                      onMouseDown={(e) => handleResize('bottom-center', e)}
                      onTouchStart={(e) => handleResize('bottom-center', e)}
                    />
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-gray-700">
                <p className="font-semibold mb-1">📌 Instruções:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use o botão 🔄 para girar a imagem</li>
                  <li>Arraste para mover o retângulo</li>
                  <li>Use os 6 pontos verdes para redimensionar</li>
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
                  onClick={extractCroppedImage}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  ✓ Usar Esta Imagem
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
