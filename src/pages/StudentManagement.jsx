  import React, { useState, useEffect } from 'react';
  import { studentFunctions } from '../lib/supabase';
  import { useData } from '../context/DataContext';

  export default function StudentManagement({ onClose, initialClass, initialMonth, initialYear }) {
    const { classes } = useData();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedClass, setSelectedClass] = useState(initialClass || classes[0]?.name || '');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ nome: '', classe: initialClass || classes[0]?.name || '' });
    const [studentToDelete, setStudentToDelete] = useState(null);

    // --- NOVOS ESTADOS PARA O PERÍODO ---
    const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear());

    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }

    const showToast = (message, type = 'info') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    };

    // Logger frontend para rastreamento no console e toast
    const logEvent = (level, action, details, err = null) => {
      const timestamp = new Date().toLocaleTimeString();
      const formattedLog = `[LOG ${level.toUpperCase()} ${timestamp}] [${action}]: ${details}`;
      
      if (level === 'error') {
        console.error(formattedLog, err || '');
        showToast(details, 'error');
      } else {
        console.log(formattedLog);
        showToast(details, 'success');
      }
    };

    // Carregar alunos da classe selecionada
    useEffect(() => {
      loadStudents();
    }, [selectedClass, selectedMonth, selectedYear]);

    const loadStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        logEvent('info', 'LOAD_STUDENTS', `Carregando alunos da classe "${selectedClass}" para ${selectedMonth}/${selectedYear}`);
        const result = await studentFunctions.getStudentsByClass(selectedClass, selectedMonth, selectedYear);
        if (result.success) {
          setStudents(result.data);
          setToast(null); // Limpar toast após carregar com sucesso
        } else {
          setError(result.error);
          logEvent('error', 'LOAD_STUDENTS', `Erro ao carregar alunos: ${result.error}`);
        }
      } catch (err) {
        console.error('StudentManagement - Erro ao carregar alunos:', err);
        setError(err.message);
        logEvent('error', 'LOAD_STUDENTS', `Exceção ao carregar alunos: ${err.message}`, err);
      } finally {
        setLoading(false);
      }
    };

    const handleAddStudent = () => {
      setFormData({ nome: '', classe: selectedClass });
      setEditingId(null);
      setShowForm(true);
    };

    const handleEditStudent = (student) => {
      setFormData({ nome: student.nome, classe: student.classe });
      setEditingId(student.id);
      setShowForm(true);
    };

    const handleSaveStudent = async () => {
      if (!formData.nome.trim()) {
        setError('Nome do aluno é obrigatório');
        return;
      }

      setLoading(true);
      try {
        let result;
        if (editingId) {
          logEvent('info', 'UPDATE_STUDENT', `Atualizando aluno ID ${editingId} -> ${formData.nome}`);
          result = await studentFunctions.updateStudent(
            editingId,
            formData.nome,
            formData.classe,
            selectedMonth,
            selectedYear
          );
        } else {
          logEvent('info', 'ADD_STUDENT', `Adicionando novo aluno ${formData.nome} na classe ${formData.classe}`);
          result = await studentFunctions.addStudent(
            formData.nome,
            formData.classe,
            selectedMonth,
            selectedYear
          );
        }

        if (result.success) {
          logEvent('info', editingId ? 'UPDATE_STUDENT' : 'ADD_STUDENT', `Aluno "${formData.nome}" salvo com sucesso!`);
          await loadStudents();
          setShowForm(false);
          setFormData({ nome: '', classe: '' });
        } else {
          setError(result.error);
          logEvent('error', 'SAVE_STUDENT', `Erro ao salvar aluno: ${result.error}`);
        }
      } catch (err) {
        setError(err.message);
        logEvent('error', 'SAVE_STUDENT', `Exceção ao salvar aluno: ${err.message}`, err);
      } finally {
        setLoading(false);
      }
    };

    const handleDeleteStudent = (student) => {
      const studentObj = typeof student === 'object' ? student : students.find(s => s.id === student) || { id: student, nome: 'Aluno' };
      setStudentToDelete(studentObj);
    };

    const confirmDeleteStudent = async () => {
      if (!studentToDelete) return;
      const studentId = studentToDelete.id;
      const studentName = studentToDelete.nome;

      logEvent('info', 'DELETE_STUDENT_START', `Iniciando exclusão do aluno "${studentName}" (ID: ${studentId})`);

      // Atualização otimista na interface para resposta imediata
      const previousStudents = [...students];
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setStudentToDelete(null);

      setLoading(true);
      setError(null);

      try {
        const result = await studentFunctions.deleteStudent(studentId, selectedMonth, selectedYear);
        if (result.success) {
          logEvent('info', 'DELETE_STUDENT_SUCCESS', `Aluno "${studentName}" excluído com sucesso!`);
          await loadStudents();
        } else {
          const errMsg = result.error || 'Não foi possível deletar o aluno no banco de dados.';
          setError(errMsg);
          logEvent('error', 'DELETE_STUDENT_FAIL', `Falha ao deletar "${studentName}": ${errMsg}`);
          // Reverter lista se falhar
          setStudents(previousStudents);
        }
      } catch (err) {
        const errMsg = err.message || 'Erro inesperado na exclusão do aluno.';
        setError(errMsg);
        logEvent('error', 'DELETE_STUDENT_EXCEPTION', `Exceção na exclusão de "${studentName}": ${errMsg}`, err);
        // Reverter lista se houver erro inesperado
        setStudents(previousStudents);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
  justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh]
  overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Gestão de Alunos</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          {/* --- SELETOR DE PERÍODO (MÊS/ANO) --- */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-100 p-4
  rounded-lg">
            <div>
              <label className="block text-xs font-semibold text-gray-500
  uppercase tracking-wider mb-1">Mês de Referência</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
  focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                {months.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500
  uppercase tracking-wider mb-1">Ano de Referência</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
  focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                {[2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Seletor de Classe */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700
  mb-2">Classe</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg
  focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Botão Adicionar */}
          <button
            onClick={handleAddStudent}
            className="mb-6 px-4 py-2 bg-green-600 text-white rounded-lg
  hover:bg-green-700 transition font-semibold"
          >
            + Adicionar Aluno
          </button>

          {/* Toast / Log Notification System */}
          {toast && (
            <div
              className={`mb-4 p-3.5 rounded-xl border flex items-center justify-between text-sm shadow-sm transition-all animate-fadeIn ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-xs font-bold opacity-60 hover:opacity-100 ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* Mensagens de Erro Legadas */}
          {error && !toast && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Lista de Alunos */}
          {loading && students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhum aluno nesta classe</div>
          ) : (
            <div className="space-y-2">
              {students.map(student => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{student.nome}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStudent(student)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium shadow-sm"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de Formulário */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex
  items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">
                  {editingId? 'Editar Aluno' : 'Adicionar Aluno'}
                </h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700
  mb-2">Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome:
  e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300
  rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nome do aluno"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700
  mb-2">Classe</label>
                  <select
                    value={formData.classe}
                    onChange={(e) => setFormData({...formData, classe:
  e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300
  rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.name}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300
  rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveStudent()}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white
  rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                  >
                    {loading? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Modal de Confirmação de Exclusão */}
          {studentToDelete && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 text-center">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Você tem certeza dessa ação?</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Deseja realmente excluir o aluno <strong className="text-gray-900 font-semibold">"{studentToDelete.nome}"</strong>? Esta ação removerá o aluno da base de dados e de seus históricos.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      logEvent('info', 'DELETE_STUDENT_CANCEL', `Exclusão cancelada pelo usuário para: ${studentToDelete.nome}`);
                      setStudentToDelete(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteStudent}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Sim, Deletar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }