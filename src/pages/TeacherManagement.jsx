import React, { useState, useEffect } from 'react';
import { studentFunctions, professorFunctions } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const DEFAULT_PASSWORD = '1234567';

const primeiroNome = (nome) => {
  const parts = (nome || '').trim().split(/\s+/);
  return parts.length > 0 ? parts[0] : '';
};

export default function TeacherManagement({ onClose }) {
  const { classes } = useData();
  const { professores, refreshProfessores } = useAuth();

  const [alunosAdonai, setAlunosAdonai] = useState([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    alunoNome: '',
    classe: classes[0]?.name || '',
    username: '',
    password: DEFAULT_PASSWORD,
  });
  const [editingKey, setEditingKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteKey, setDeleteKey] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carregar alunos da Classe Adonai (professores) — mês/ano atual para listar os matriculados
  useEffect(() => {
    const load = async () => {
      setLoadingAlunos(true);
      try {
        const result = await studentFunctions.getStudentsByClass(
          'Adonai',
          new Date().getMonth() + 1,
          new Date().getFullYear()
        );
        if (result.success) {
          setAlunosAdonai(result.data || []);
        }
      } catch (err) {
        console.error('TeacherManagement - erro ao carregar Adonai:', err);
      } finally {
        setLoadingAlunos(false);
      }
    };
    load();
  }, []);

  const handleAlunoChange = (nome) => {
    setForm(prev => ({
      ...prev,
      alunoNome: nome,
      username: primeiroNome(nome),
    }));
  };

  const handleEdit = (key, prof) => {
    setEditingKey(key);
    setForm({
      alunoNome: prof.nomeCompleto,
      classe: prof.classe,
      username: prof.primeiroNome,
      password: '',
    });
  };

  const handleSave = async () => {
    setError(null);

    const nomeCompleto = form.alunoNome.trim();
    const primeiroNomeVal = form.username.trim() || primeiroNome(nomeCompleto);

    if (!nomeCompleto) {
      setError('Selecione o professor (aluno da classe Adonai).');
      return;
    }
    if (!form.classe) {
      setError('Selecione a classe de atuação do professor.');
      return;
    }
    if (!primeiroNomeVal) {
      setError('Informe o nome de acesso (primeiro nome).');
      return;
    }
    if (!editingKey || form.password) {
      if (!form.password || form.password.length < 4) {
        setError('Informe uma senha com pelo menos 4 caracteres.');
        return;
      }
    }

    const key = primeiroNomeVal.toLowerCase();
    const conflito = professores[key] && key !== editingKey;
    if (conflito) {
      setError(`Já existe um professor com o nome de acesso "${primeiroNomeVal}". Use outro nome.`);
      return;
    }

    setSaving(true);
    try {
      const password = editingKey && !form.password
        ? (professores[editingKey]?.password || '')
        : form.password;
      const prof = {
        username: key,
        nomeCompleto,
        primeiroNome: primeiroNomeVal,
        classe: form.classe,
        password,
        enabled: true,
      };
      const result = await professorFunctions.upsertProfessor(prof);
      if (result.success) {
        await refreshProfessores();
        showToast(editingKey
          ? `Professor "${primeiroNomeVal}" atualizado com sucesso!`
          : `Professor "${primeiroNomeVal}" vinculado à classe ${form.classe}!`);
        setForm({ alunoNome: '', classe: classes[0]?.name || '', username: '', password: DEFAULT_PASSWORD });
        setEditingKey(null);
      } else {
        setError(result.error || 'Erro ao salvar professor.');
      }
    } catch (err) {
      console.error('TeacherManagement - erro ao salvar:', err);
      setError('Erro inesperado ao salvar professor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (key, prof) => {
    const result = await professorFunctions.upsertProfessor({
      ...prof,
      username: key,
      enabled: !prof.enabled,
    });
    if (result.success) {
      await refreshProfessores();
      showToast(`Professor "${prof.primeiroNome}" ${prof.enabled ? 'inativado' : 'ativado'}.`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteKey) return;
    const result = await professorFunctions.deleteProfessor(deleteKey);
    if (result.success) {
      await refreshProfessores();
      showToast(`Acesso do professor "${deleteKey}" removido.`);
    }
    setDeleteKey(null);
  };

  const linkedEntries = Object.entries(professores || {}).filter(
    ([, p]) => p && (p.primeiroNome || p.nomeCompleto)
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Professores</h2>
            <p className="text-xs text-gray-500 mt-1">
              Vincule professores (alunos da Classe <strong>Adonai</strong>) às suas classes de atuação. Eles entram com o primeiro nome e a senha definida abaixo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {toast && (
          <div className={`mb-4 p-3 rounded-xl border text-sm ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            ✅ {toast.message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Formulário de vínculo */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">
            {editingKey ? '✏️ Editar Professor Vinculado' : '👨‍🏫 Vincular Novo Professor'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Professor (Aluno da Classe Adonai)</label>
              <select
                value={form.alunoNome}
                onChange={(e) => handleAlunoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm bg-white"
              >
                <option value="">{loadingAlunos ? 'Carregando...' : '— Selecione o professor —'}</option>
                {alunosAdonai.map((a, idx) => (
                  <option key={a.id || idx} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
              {!loadingAlunos && alunosAdonai.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum aluno na classe Adonai (cadastre-os em Alunos).</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Classe de Atuação</label>
              <select
                value={form.classe}
                onChange={(e) => setForm(prev => ({ ...prev, classe: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm bg-white"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Acesso (primeiro nome)</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                placeholder="Ex: Maria"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                placeholder={editingKey ? 'Deixe em branco para manter a atual' : DEFAULT_PASSWORD}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition cursor-pointer disabled:opacity-50 ${
                editingKey ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {saving ? 'Salvando...' : editingKey ? 'Salvar Alterações' : 'Vincular Professor'}
            </button>
            {editingKey && (
              <button
                onClick={() => {
                  setEditingKey(null);
                  setForm({ alunoNome: '', classe: classes[0]?.name || '', username: '', password: DEFAULT_PASSWORD });
                }}
                className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold text-sm transition cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </div>

        {/* Lista de professores vinculados */}
        <h3 className="font-bold text-gray-900 mb-3">Professores Vinculados ({linkedEntries.length})</h3>

        {linkedEntries.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500 text-sm">Nenhum professor vinculado ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Use o formulário acima para vincular um professor à sua classe.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {linkedEntries.map(([key, prof]) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {prof.primeiroNome}
                    <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${prof.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {prof.enabled ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {prof.nomeCompleto} · Classe: <strong className="text-cyan-700">{prof.classe}</strong> · Login: "{prof.primeiroNome}"
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleEdit(key, prof)}
                    className="px-3 py-1 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-xs font-medium cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleEnabled(key, prof)}
                    className={`px-3 py-1 rounded-lg transition text-xs font-medium cursor-pointer ${
                      prof.enabled
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {prof.enabled ? 'Inativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setDeleteKey(key)}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-xs font-medium cursor-pointer"
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold text-sm cursor-pointer"
        >
          Fechar
        </button>
      </div>

      {/* Modal de confirmação para desvincular */}
      {deleteKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Desvincular professor?</h3>
            <p className="text-gray-600 text-sm mb-6">
              O acesso de <strong>"{deleteKey}"</strong> ao sistema será removido. Esta ação não exclui o aluno da base.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteKey(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition text-sm cursor-pointer"
              >
                Sim, Desvincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
