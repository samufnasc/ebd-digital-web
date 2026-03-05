import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { performOCR } from '../utils/ocr';
import { studentFunctions } from '../lib/supabase';

export default function SecretaryDashboard() {
  const { logout, user } = useAuth();
  const { classes, saveReport, getReportsByDate } = useData();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    matriculated: 0,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  });
  const [students, setStudents] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cropperRef = useRef(null);
  const fileInputRef = useRef(null);

  // Carregar alunos da classe selecionada
  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass]);

  const loadStudents = async () => {
    try {
      const result = await studentFunctions.getAllStudents();
      if (result.success && Array.isArray(result.data)) {
        const classStudents = result.data.filter(s => s.classe === selectedClass);
        setStudents(classStudents);
        // Atualizar matriculados com o count real
        setFormData(prev => ({
          ...prev,
          matriculated: classStudents.length,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'offering' ? parseFloat(value) || 0 : parseInt(value) || 0,
    }));
  };

  // Atualizar Total de Assistência
  const totalAssistance = Number(formData.present) + Number(formData.visitor);

  // Abrir câmera
  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao abrir câmera:', error);
      alert('Não foi possível acessar a câmera. Tente novamente.');
    }
  };

  // Capturar foto
  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageData = canvasRef.current.toDataURL('image/png');
      setCapturedImage(imageData);
      
      // Parar stream
      const stream = videoRef.current.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Abrir modal de recorte
      setShowCropperModal(true);
    }
  };

  // Inicializar Cropper.js
  useEffect(() => {
    if (showCropperModal && capturedImage && cropperRef.current) {
      // Carregar Cropper.js dinamicamente
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/cropperjs@1.5.13/dist/cropper.min.js';
      script.onload = () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/cropperjs@1.5.13/dist/cropper.min.css';
        document.head.appendChild(link);

        // Inicializar Cropper
        const image = cropperRef.current;
        if (window.Cropper) {
          new window.Cropper(image, {
            aspectRatio: 4 / 3,
            autoCropArea: 0.8,
            responsive: true,
            guides: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
          });
        }
      };
      document.body.appendChild(script);
    }
  }, [showCropperModal, capturedImage]);

  // Confirmar recorte
  const handleConfirmCrop = async () => {
    if (cropperRef.current && window.Cropper) {
      const cropper = window.Cropper.instances[0];
      if (cropper) {
        const canvas = cropper.getCroppedCanvas();
        const croppedImageData = canvas.toDataURL('image/png');
        setCroppedImage(croppedImageData);
        
        // Processar OCR com imagem recortada
        try {
          const ocrResult = await performOCR(croppedImageData);
          if (ocrResult.success) {
            setFormData(prev => ({
              ...prev,
              present: ocrResult.present || prev.present,
              visitor: ocrResult.visitor || prev.visitor,
              bibles: ocrResult.bibles || prev.bibles,
              magazines: ocrResult.magazines || prev.magazines,
              offering: ocrResult.offering || prev.offering,
            }));
          }
        } catch (error) {
          console.error('Erro no OCR:', error);
        }
        
        setShowCropperModal(false);
        setShowReviewModal(true);
      }
    }
  };

  // Salvar relatório
  const handleSaveReport = async () => {
    if (!selectedClass) {
      alert('Por favor, selecione uma classe');
      return;
    }

    const result = await saveReport(
      classes.find(c => c.name === selectedClass)?.id || '1',
      formData
    );

    if (result.success) {
      alert('Relatório salvo com sucesso!');
      setShowReviewModal(false);
      setFormData({
        matriculated: students.length,
        absent: 0,
        present: 0,
        visitor: 0,
        bibles: 0,
        magazines: 0,
        offering: 0,
      });
    } else {
      alert('Erro ao salvar relatório: ' + result.error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel do Secretário</h1>
            <p className="text-gray-600 text-sm">Bem-vindo, {user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Class Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Selecione a Classe</h2>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="">-- Selecione uma classe --</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>

        {selectedClass && (
          <>
            {/* Buttons Section */}
            <div className="flex gap-2 mb-6 fixed bottom-8 right-8">
              <button
                onClick={handleOpenCamera}
                className="px-6 py-3 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition font-semibold"
              >
                📸 Câmera
              </button>
              <button
                onClick={() => setShowStudentList(true)}
                className="px-6 py-3 bg-secondary text-white rounded-full shadow-lg hover:bg-yellow-600 transition font-semibold"
              >
                👨‍🎓 Alunos
              </button>
            </div>

            {/* Camera Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Leitura de Caderneta (OCR)</h2>
              <div className="space-y-4">
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto"
                    style={{ display: videoRef.current?.srcObject ? 'block' : 'none' }}
                  />
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    style={{ display: 'none' }}
                  />
                  {!videoRef.current?.srcObject && (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      Clique em "Câmera" para iniciar
                    </div>
                  )}
                </div>
                {videoRef.current?.srcObject && (
                  <button
                    onClick={handleCapturePhoto}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    ✓ Capturar Foto
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Cropper Modal */}
      {showCropperModal && capturedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Recorte a Área da Tabela</h2>
            <p className="text-gray-600 mb-4">Selecione apenas a área com os números da caderneta</p>
            
            <div className="mb-4 max-h-96 overflow-auto">
              <img
                ref={cropperRef}
                src={capturedImage}
                alt="Imagem para recorte"
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConfirmCrop}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✓ Confirmar Recorte
              </button>
              <button
                onClick={() => setShowCropperModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Revisar Dados</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matriculados (READ-ONLY)</label>
                <input
                  type="number"
                  value={formData.matriculated}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ausentes</label>
                  <input
                    type="number"
                    name="absent"
                    value={formData.absent}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presentes</label>
                  <input
                    type="number"
                    name="present"
                    value={formData.present}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visitantes</label>
                  <input
                    type="number"
                    name="visitor"
                    value={formData.visitor}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Assistência</label>
                  <input
                    type="number"
                    value={totalAssistance}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-600 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bíblias</label>
                  <input
                    type="number"
                    name="bibles"
                    value={formData.bibles}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revistas</label>
                  <input
                    type="number"
                    name="magazines"
                    value={formData.magazines}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ofertas (R$)</label>
                  <input
                    type="number"
                    name="offering"
                    value={formData.offering}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveReport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✓ Salvar Relatório
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student List Modal */}
      {showStudentList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Alunos de {selectedClass}</h2>
            <p className="text-gray-600 mb-4">Total: {students.length}</p>

            <div className="space-y-2 mb-6">
              {students.map((student, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {student.nome}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowStudentList(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
