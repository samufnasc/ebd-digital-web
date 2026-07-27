  import React, { useState, useEffect } from 'eact';
  import { studentFunctions } from '../lib/supabase';
  import { useData } from '../context/DataContext';

  export default function StudentManagement({ onClose }) {
    const { classes } = useData();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedClass, setSelectedClass] = useState(classes[0]?.name || '');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // --- NOVOS ESTADOS PARA O PERÍODO ---
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() +
  1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

    // Carregar alunos da classe selecionada
    useEffect(() => {
      loadStudents();
    }, [selectedClass]);

    const loadStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await
  studentFunctions.getStudentsByClass(selectedClass);
        if (result.success) {
          setStudents(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('StudentManagement - Erro:', err);
        setError(err.message);
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
        // Agora enviamos o mês e ano para o backend
        result = await studentFunctions.updateStudent(
          editingId,
          formData.nome,
          formData.classe,
          selectedMonth,
          selectedYear
        );
      } else {
        // Agora enviamos o mês e ano para o backend
        result = await studentFunctions.addStudent(
          formData.nome,
          formData.classe,
          selectedMonth,
          selectedYear
        );
      }

      if (result.success) {
        await loadStudents();
        setShowForm(false);
        setFormData({ nome: '', classe: '' });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

    const handleDeleteStudent = async (id) => {
      if (!window.confirm('Tem certeza que deseja deletar este aluno?'))
  return;

      setLoading(true);
      try {
        const result = await studentFunctions.deleteStudent(id);
        if (result.success) {
          await loadStudents();
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
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

          {/* Mensagens de Erro */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Lista de Alunos */}
          {loading && students.length === 0? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : students.length === 0? (
            <div className="text-center py-8 text-gray-500">Nenhum aluno nesta
  classe</div>
          ) : (
            <div className="space-y-2">
              {students.map(student => (
                <div key={student.id} className="flex items-center
  justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{student.nome}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStudent(student)}
                      className="px-3 py-1 bg-blue-600 text-white rounded
  hover:bg-blue-700 transition text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded
  hover:bg-red-700 transition text-sm"
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
        </div>
      </div>
    );
  }