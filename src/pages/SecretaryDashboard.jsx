import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import CameraCapture from '../components/CameraCapture';
import { processOCR, calculatePercentage, formatCurrency } from '../utils/ocr';

export default function SecretaryDashboard() {
  const { logout, user } = useAuth();
  const { classes, saveReport, getAllReports } = useData();
  const [showCamera, setShowCamera] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id);
  const [ocrData, setOcrData] = useState(null);
  const [formData, setFormData] = useState({
    matriculated: 0,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  });

  const handleCameraCapture = async (imageData) => {
    setShowCamera(false);
    
    // Processar OCR
    const result = await processOCR(imageData);
    if (result.success) {
      setOcrData(result.data);
      setFormData(result.data);
      setShowReview(true);
    }
  };

  const handleFormChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSaveReport = () => {
    if (!selectedClass) {
      alert('Selecione uma classe');
      return;
    }

    saveReport(selectedClass, formData);
    alert('Relatório salvo com sucesso!');
    
    // Resetar formulário
    setFormData({
      matriculated: 0,
      absent: 0,
      present: 0,
      visitor: 0,
      bibles: 0,
      magazines: 0,
      offering: 0,
    });
    setShowReview(false);
    setOcrData(null);
  };

  const percentage = calculatePercentage(formData.present, formData.matriculated);

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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total de Relatórios</p>
            <p className="text-3xl font-bold text-primary">{getAllReports().length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Classes</p>
            <p className="text-3xl font-bold text-primary">{classes.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Data</p>
            <p className="text-3xl font-bold text-primary">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Main Content */}
        {!showReview ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Novo Relatório</h2>

            {/* Class Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione a Classe
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Camera Button */}
            <button
              onClick={() => setShowCamera(true)}
              className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center text-2xl font-bold z-40"
              title="Novo Relatório"
            >
              +
            </button>

            {/* Recent Reports */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Relatórios Recentes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Classe</th>
                      <th className="px-4 py-2 text-center">Mat</th>
                      <th className="px-4 py-2 text-center">Pres</th>
                      <th className="px-4 py-2 text-center">%</th>
                      <th className="px-4 py-2 text-center">Oferta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAllReports().slice(-5).reverse().map(report => (
                      <tr key={report.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{new Date(report.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">{report.className}</td>
                        <td className="px-4 py-2 text-center">{report.matriculated}</td>
                        <td className="px-4 py-2 text-center">{report.present}</td>
                        <td className="px-4 py-2 text-center font-semibold text-primary">{report.percentage}%</td>
                        <td className="px-4 py-2 text-center">{formatCurrency(report.offering)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Review Form */
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">Revisar Dados OCR</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matriculados</label>
                <input
                  type="number"
                  value={formData.matriculated}
                  onChange={(e) => handleFormChange('matriculated', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ausentes</label>
                <input
                  type="number"
                  value={formData.absent}
                  onChange={(e) => handleFormChange('absent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presentes</label>
                <input
                  type="number"
                  value={formData.present}
                  onChange={(e) => handleFormChange('present', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitantes</label>
                <input
                  type="number"
                  value={formData.visitor}
                  onChange={(e) => handleFormChange('visitor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bíblias</label>
                <input
                  type="number"
                  value={formData.bibles}
                  onChange={(e) => handleFormChange('bibles', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revistas</label>
                <input
                  type="number"
                  value={formData.magazines}
                  onChange={(e) => handleFormChange('magazines', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ofertas (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.offering}
                  onChange={(e) => handleFormChange('offering', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequência (%)</label>
                <input
                  type="text"
                  value={`${percentage}%`}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✓ Salvar Relatório
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
