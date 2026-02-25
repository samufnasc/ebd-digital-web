import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/ocr';
import { generatePDF } from '../utils/pdf';
import UserManagement from './UserManagement';
import StudentManagement from './StudentManagement';

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { classes, getAllReports } = useData();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showStudentManagement, setShowStudentManagement] = useState(false);
  const [showPDFOptions, setShowPDFOptions] = useState(false);

  const reports = getAllReports();

  // Consolidar dados
  const consolidatedData = {
    matriculated: 0,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  };

  const reportsByClass = {};
  classes.forEach(cls => {
    reportsByClass[cls.id] = { ...consolidatedData, className: cls.name };
  });

  reports.forEach(report => {
    if (report.date === selectedDate) {
      consolidatedData.matriculated += report.matriculated;
      consolidatedData.absent += report.absent;
      consolidatedData.present += report.present;
      consolidatedData.visitor += report.visitor;
      consolidatedData.bibles += report.bibles;
      consolidatedData.magazines += report.magazines;
      consolidatedData.offering += report.offering;

      if (reportsByClass[report.classId]) {
        reportsByClass[report.classId].matriculated += report.matriculated;
        reportsByClass[report.classId].absent += report.absent;
        reportsByClass[report.classId].present += report.present;
        reportsByClass[report.classId].visitor += report.visitor;
        reportsByClass[report.classId].bibles += report.bibles;
        reportsByClass[report.classId].magazines += report.magazines;
        reportsByClass[report.classId].offering += report.offering;
      }
    }
  });

  const percentage = consolidatedData.matriculated > 0
    ? Math.round((consolidatedData.present / consolidatedData.matriculated) * 100)
    : 0;

  const handleExportPDF = (type = 'general') => {
    generatePDF(consolidatedData, reportsByClass, selectedDate, type);
    setShowPDFOptions(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel do Admin</h1>
            <p className="text-gray-600 text-sm">Bem-vindo, {user?.username}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStudentManagement(true)}
              className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition"
            >
              👨‍🎓 Alunos
            </button>
            <button
              onClick={() => setShowUserManagement(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition"
            >
              👥 Usuários
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione a Data
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Matriculados</p>
            <p className="text-2xl font-bold text-primary">{consolidatedData.matriculated}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Presentes</p>
            <p className="text-2xl font-bold text-green-600">{consolidatedData.present}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Ausentes</p>
            <p className="text-2xl font-bold text-red-600">{consolidatedData.absent}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Frequência</p>
            <p className="text-2xl font-bold text-primary">{percentage}%</p>
          </div>
        </div>

        {/* Main Report */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Relatorio Geral</h2>
            <button
              onClick={() => setShowPDFOptions(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              📄 Exportar PDF
            </button>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Classe</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Mat</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Aus</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Pres</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Vis</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">%</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Bíbl</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Rev</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Oferta</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(cls => {
                  const classData = reportsByClass[cls.id];
                  const classPercentage = classData.matriculated > 0
                    ? Math.round((classData.present / classData.matriculated) * 100)
                    : 0;
                  return (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium">{classData.className}</td>
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

          {/* Totals Row */}
          <div className="bg-primary/10 rounded-lg p-4 border border-primary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Matriculados</p>
                <p className="text-2xl font-bold text-primary">{consolidatedData.matriculated}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Presentes</p>
                <p className="text-2xl font-bold text-green-600">{consolidatedData.present}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bíblias</p>
                <p className="text-2xl font-bold text-primary">{consolidatedData.bibles}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Ofertas</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(consolidatedData.offering)}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Student Management Modal */}
      {showStudentManagement && (
        <StudentManagement onClose={() => setShowStudentManagement(false)} />
      )}

      {/* User Management Modal */}
      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}

      {/* PDF Options Modal */}
      {showPDFOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Selecione o Tipo de Relatorio</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleExportPDF('general')}
                className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold text-left"
              >
                📊 Relatorio Geral (Consolidado)
              </button>
              <button
                onClick={() => handleExportPDF('byClass')}
                className="w-full px-4 py-3 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold text-left"
              >
                📑 Relatorios por Classe (Paginas Individuais)
              </button>
              <button
                onClick={() => setShowPDFOptions(false)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
