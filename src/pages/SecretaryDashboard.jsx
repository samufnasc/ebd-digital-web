import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import CameraCapture from '../components/CameraCapture';
import { processOCR, calculatePercentage, formatCurrency } from '../utils/ocr';
import { studentFunctions } from '../lib/supabase';

export default function SecretaryDashboard() {
  const { logout, user } = useAuth();
  const { classes, saveReport, getAllReports } = useData();
  const [showCamera, setShowCamera] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showGeneralReport, setShowGeneralReport] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id);
  const [ocrData, setOcrData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [formData, setFormData] = useState({
    matriculated: 0,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  });

  // Carregar alunos quando classe mudar
  useEffect(() => {
    loadStudentsForClass();
  }, [selectedClass]);

  const loadStudentsForClass = async () => {
    if (!selectedClass) return;
    
    setLoadingStudents(true);
    try {
      const selectedClassName = classes.find(c => c.id === selectedClass)?.name;
      if (selectedClassName) {
        const result = await studentFunctions.getStudentsByClass(selectedClassName);
        if (result.success) {
          setStudents(result.data);
          // Atualizar matriculados automaticamente com valor oficial do banco
          const matriculatedCount = result.data.length;
          setFormData(prev => ({
            ...prev,
            matriculated: matriculatedCount
          }));
          console.log(`Carregados ${matriculatedCount} alunos da classe ${selectedClassName}`);
        } else {
          console.error('Erro ao carregar alunos:', result.error);
          setStudents([]);
          setFormData(prev => ({
            ...prev,
            matriculated: 0
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      setStudents([]);
      setFormData(prev => ({
        ...prev,
        matriculated: 0
      }));
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleCameraCapture = async (imageData) => {
    setShowCamera(false);
    
    // Processar OCR
    const result = await processOCR(imageData);
    if (result.success) {
      setOcrData(result.data);
      // IMPORTANTE: Nunca sobrescrever o campo matriculated com dados da camera
      // Sempre usar o valor oficial do banco de dados
      setFormData(prev => ({
        ...result.data,
        matriculated: prev.matriculated
      }));
      setShowReview(true);
    }
  };

  const handleFormChange = (field, value) => {
    // BLOQUEADO: Campo matriculated eh READ-ONLY e vem do banco de dados
    if (field === 'matriculated') {
      console.warn('Campo Matriculados eh bloqueado. Use o valor do banco de dados.');
      return;
    }
    
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSaveReport = async () => {
    if (!selectedClass) {
      alert('Selecione uma classe');
      return;
    }

    // Garantir que o valor de matriculados seja sempre o oficial do banco
    const selectedClassName = classes.find(c => c.id === selectedClass)?.name;
    const result = await studentFunctions.getStudentsByClass(selectedClassName);
    const officialMatriculatedCount = result.success ? result.data.length : formData.matriculated;

    // Salvar com o valor oficial
    const reportData = {
      ...formData,
      matriculated: officialMatriculatedCount
    };

    saveReport(selectedClass, reportData);
    alert('Relatório salvo com sucesso!');
    
    // Resetar formulário
    setFormData({
      matriculated: officialMatriculatedCount,
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
              className="fixed right-8 top-1/2 transform -translate-y-1/2 w-16 h-16 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center text-2xl font-bold z-40"
              title="Novo Relatório"
            >
              +
            </button>

            {/* Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setShowStudentList(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                👨‍🎓 Alunos da Classe
              </button>
              <button
                onClick={() => setShowGeneralReport(true)}
                className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold"
              >
                📄 Relatório Geral
              </button>
            </div>

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
        ) : showGeneralReport ? (
          /* General Report View */
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Relatório Geral Consolidado</h2>
              <button
                onClick={() => setShowGeneralReport(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Voltar
              </button>
            </div>

            {/* Consolidated Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Classe</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Mat</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Aus</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Pres</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Vis</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">%</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Bibl</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Rev</th>
                    <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Oferta</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(cls => {
                    const classReports = getAllReports().filter(r => r.classId === cls.id);
                    const classData = {
                      matriculated: classReports.reduce((sum, r) => sum + r.matriculated, 0),
                      absent: classReports.reduce((sum, r) => sum + r.absent, 0),
                      present: classReports.reduce((sum, r) => sum + r.present, 0),
                      visitor: classReports.reduce((sum, r) => sum + r.visitor, 0),
                      bibles: classReports.reduce((sum, r) => sum + r.bibles, 0),
                      magazines: classReports.reduce((sum, r) => sum + r.magazines, 0),
                      offering: classReports.reduce((sum, r) => sum + r.offering, 0),
                    };
                    const classPercentage = classData.matriculated > 0
                      ? Math.round((classData.present / classData.matriculated) * 100)
                      : 0;
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 font-medium">{cls.name}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{classData.matriculated}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center text-red-600">{classData.absent}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center text-green-600 font-semibold">{classData.present}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{classData.visitor}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center font-semibold text-primary">{classPercentage}%</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{classData.bibles}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{classData.magazines}</td>
                        <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{formatCurrency(classData.offering)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Review Form */
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">Revisar Dados OCR</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matriculados (Automático)</label>
                <input
                  type="number"
                  value={formData.matriculated}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50"
              disabled={loadingStudents}
            >
              {loadingStudents ? 'Salvando...' : '✓ Salvar Relatório'}
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

      {/* Student List Modal */}
      {showStudentList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Alunos da Classe</h2>
              <button
                onClick={() => setShowStudentList(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {loadingStudents ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhum aluno nesta classe</div>
            ) : (
              <div className="space-y-2">
                {students.map((student, index) => (
                  <div key={student.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 font-medium mr-3">{index + 1}.</span>
                    <span className="font-medium text-gray-900">{student.nome}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
