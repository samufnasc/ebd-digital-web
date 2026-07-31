import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[supabase.js] Erro: VITE_SUPABASE_URL e VITE_SUPABASE_KEY devem estar definidos no arquivo .env'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ AUTENTICAÇÃO ============
export const authFunctions = {
  login: async (username, password) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error) {
        return { success: false, message: 'Usuário ou senha inválido' };
      }

      return {
        success: true,
        data: {
          username: data.username,
          role: data.role,
        },
      };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return { success: false, message: 'Erro ao fazer login' };
    }
  },

  getAllUsers: async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('username, role');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return { success: false, data: [] };
    }
  },

  addUser: async (username, password, role) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{ username, password, role }])
        .select();

      if (error) {
        if (error.message.includes('duplicate')) {
          return { success: false, message: 'Usuário já existe' };
        }
        throw error;
      }

      return { success: true, message: 'Usuário criado com sucesso' };
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return { success: false, message: 'Erro ao criar usuário' };
    }
  },

  deleteUser: async (username) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('username', username);

      if (error) throw error;

      return { success: true, message: 'Usuário deletado com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return { success: false, message: 'Erro ao deletar usuário' };
    }
  },
};

// Helper functions para controle de vínculos mensais e exclusões de alunos
export function getExclusoesMensais() {
  try {
    const data = localStorage.getItem('ebd_exclusoes_mensais');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function registrarExclusaoMensal(alunoId, month, year) {
  try {
    const exclusoes = getExclusoesMensais();
    exclusoes[`${alunoId}_${Number(month)}_${Number(year)}`] = true;
    localStorage.setItem('ebd_exclusoes_mensais', JSON.stringify(exclusoes));
  } catch (err) {
    console.error('Erro ao registrar exclusão mensal:', err);
  }
}

export function isAlunoExcluidoNoMes(alunoId, month, year) {
  if (!month || !year) return false;
  const exclusoes = getExclusoesMensais();
  return temExclusaoAte(alunoId, month, year, exclusoes);
}

export function temExclusaoAte(alunoId, month, year, exclusoesMap) {
  const m = Number(month);
  const y = Number(year);
  for (const key of Object.keys(exclusoesMap)) {
    if (!exclusoesMap[key]) continue;
    const parts = key.split('_');
    const exclAno = parseInt(parts[parts.length - 1], 10);
    const exclMes = parseInt(parts[parts.length - 2], 10);
    if (isNaN(exclMes) || isNaN(exclAno)) continue;
    const exclAlunoId = parts.slice(0, -2).join('_');
    if (exclAlunoId !== alunoId) continue;
    if (exclAno < y || (exclAno === y && exclMes <= m)) return true;
  }
  return false;
}

export function getVinculosMensaisMap() {
  try {
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem('ebd_student_monthly_bindings') : null;
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function registrarVinculoMensal(alunoId, month, year) {
  try {
    if (typeof localStorage === 'undefined') return;
    const map = getVinculosMensaisMap();
    if (!map[alunoId]) {
      map[alunoId] = [];
    }
    const key = `${Number(month)}_${Number(year)}`;
    if (!map[alunoId].includes(key)) {
      map[alunoId].push(key);
    }
    localStorage.setItem('ebd_student_monthly_bindings', JSON.stringify(map));
  } catch (err) {
    console.error('Erro ao registrar vínculo mensal local:', err);
  }
}

// ============ NOVAS FUNÇÕES ASSÍNCRONAS (Supabase + localStorage fallback) ============

export async function getVinculosMensaisSupabase() {
  try {
    const { data, error } = await supabase
      .from('vinculos_mensais')
      .select('aluno_id, mes, ano');
    if (!error && data) {
      const map = {};
      (data || []).forEach(v => {
        if (!map[v.aluno_id]) map[v.aluno_id] = [];
        map[v.aluno_id].push(`${Number(v.mes)}_${Number(v.ano)}`);
      });
      return map;
    }
  } catch (err) {
    console.warn('[supabase.js] getVinculosMensaisSupabase - erro:', err.message);
  }
  return getVinculosMensaisMap();
}

export async function registrarVinculoMensalSupabase(alunoId, month, year) {
  registrarVinculoMensal(alunoId, month, year);
  try {
    const { error } = await supabase
      .from('vinculos_mensais')
      .upsert(
        { aluno_id: alunoId, mes: Number(month), ano: Number(year) },
        { onConflict: 'aluno_id, mes, ano' }
      );
    if (error) throw error;
  } catch (err) {
    console.warn('[supabase.js] registrarVinculoMensalSupabase - erro no Supabase:', err.message);
  }
}

export async function getExclusoesMensaisSupabase() {
  try {
    const { data, error } = await supabase
      .from('exclusoes_mensais')
      .select('aluno_id, mes, ano');
    if (!error && data) {
      const map = {};
      (data || []).forEach(e => {
        map[`${e.aluno_id}_${Number(e.mes)}_${Number(e.ano)}`] = true;
      });
      return map;
    }
  } catch (err) {
    console.warn('[supabase.js] getExclusoesMensaisSupabase - erro:', err.message);
  }
  return getExclusoesMensais();
}

export async function registrarExclusaoMensalSupabase(alunoId, month, year) {
  registrarExclusaoMensal(alunoId, month, year);
  try {
    const { error } = await supabase
      .from('exclusoes_mensais')
      .upsert(
        { aluno_id: alunoId, mes: Number(month), ano: Number(year) },
        { onConflict: 'aluno_id, mes, ano' }
      );
    if (error) throw error;
  } catch (err) {
    console.warn('[supabase.js] registrarExclusaoMensalSupabase - erro no Supabase:', err.message);
  }
}

export async function isAlunoExcluidoNoMesSupabase(alunoId, month, year) {
  if (!month || !year) return false;
  try {
    const { data, error } = await supabase
      .from('exclusoes_mensais')
      .select('mes, ano')
      .eq('aluno_id', alunoId);
    if (error) throw error;
    if (!data || data.length === 0) return false;
    const m = Number(month);
    const y = Number(year);
    return data.some(e => e.ano < y || (e.ano === y && e.mes <= m));
  } catch (err) {
    console.warn('[supabase.js] isAlunoExcluidoNoMesSupabase - fallback localStorage:', err.message);
    return isAlunoExcluidoNoMes(alunoId, month, year);
  }
}

/**
 * Filtra a lista de alunos para um determinado mês e ano:
 * - Usa Supabase como fonte primária, com fallback para localStorage.
 * - Alunos base (sem vínculo) aparecem em todos os meses.
 * - Novos alunos com vínculo aparecem EXCLUSIVAMENTE no mês/ano vinculado.
 * - Exclusão é cumulativa: deletado no mês M/ano A → some de M em diante,
 *   mas permanece visível nos meses anteriores a M.
 */
export async function filterAlunosByMonthYear(alunosList, month, year) {
  if (!month || !year || !Array.isArray(alunosList) || alunosList.length === 0) {
    return alunosList || [];
  }

  const m = Number(month);
  const y = Number(year);
  const currentKey = `${m}_${y}`;

  const [vinculosMap, exclusoesMap] = await Promise.all([
    getVinculosMensaisSupabase(),
    getExclusoesMensaisSupabase()
  ]);

  return alunosList.filter(aluno => {
    if (temExclusaoAte(aluno.id, m, y, exclusoesMap)) return false;

    const studentBindings = vinculosMap[aluno.id];
    if (Array.isArray(studentBindings) && studentBindings.length > 0) {
      return studentBindings.includes(currentKey);
    }

    return true;
  });
}

/**
 * Migra os dados de vínculos e exclusões do localStorage para o Supabase.
 * Deve ser chamada uma vez após criar as tabelas no banco.
 */
export async function migrarVinculosParaSupabase() {
  console.log('[supabase.js] Iniciando migracao localStorage -> Supabase...');

  const vinculosLocal = getVinculosMensaisMap();
  const exclusoesLocal = getExclusoesMensais();

  let vinculosOK = 0;
  let exclusoesOK = 0;

  for (const [alunoId, meses] of Object.entries(vinculosLocal)) {
    if (!Array.isArray(meses)) continue;
    for (const key of meses) {
      const [mes, ano] = key.split('_').map(Number);
      if (!mes || !ano) continue;
      try {
        const { error } = await supabase
          .from('vinculos_mensais')
          .upsert({ aluno_id: alunoId, mes, ano }, { onConflict: 'aluno_id, mes, ano' });
        if (!error) vinculosOK++;
      } catch (e) {
        console.warn('Erro ao migrar vinculo', alunoId, key, e.message);
      }
    }
  }

  for (const [key, value] of Object.entries(exclusoesLocal)) {
    if (!value) continue;
    const parts = key.split('_');
    const alunoId = parts.slice(0, -2).join('_');
    const mes = Number(parts[parts.length - 2]);
    const ano = Number(parts[parts.length - 1]);
    if (!alunoId || !mes || !ano) continue;
    try {
      const { error } = await supabase
        .from('exclusoes_mensais')
        .upsert({ aluno_id: alunoId, mes, ano }, { onConflict: 'aluno_id, mes, ano' });
      if (!error) exclusoesOK++;
    } catch (e) {
      console.warn('Erro ao migrar exclusao', key, e.message);
    }
  }

  const result = { vinculosMigrados: vinculosOK, exclusoesMigradas: exclusoesOK };
  console.log('[supabase.js] Migracao concluida:', result);
  return result;
}

/**
 * Retorna informações de debug sobre vínculos e exclusões atuais.
 * Chame no console do navegador: await getDebugInfo()
 */
export async function getDebugInfo() {
  const [vinculos, exclusoes] = await Promise.all([
    getVinculosMensaisSupabase(),
    getExclusoesMensaisSupabase()
  ]);

  const totalAlunosComVinculo = Object.keys(vinculos).length;
  const totalVinculos = Object.values(vinculos).reduce((acc, v) => acc + v.length, 0);
  const totalExclusoes = Object.keys(exclusoes).length;

  return {
    alunosComVinculo: totalAlunosComVinculo,
    totalVinculos,
    totalExclusoes,
    source: 'supabase (fallback localStorage)',
    vinculos,
    exclusoes
  };
}

// ============ ALUNOS ============
export const studentFunctions = {
  // Obter alunos por classe (com filtragem por mês de referência)
  async getStudentsByClass(className, month = null, year = null) {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .eq('classe', className)
        .order('nome', { ascending: true });
      
      if (error) throw error;

      const alunosFiltrados = await filterAlunosByMonthYear(data || [], month, year);
      return { success: true, data: alunosFiltrados };
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  // Contar alunos por classe (com filtragem por mês de referência)
  async countStudentsByClass(className, month = null, year = null) {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .eq('classe', className);
      
      if (error) throw error;

      const alunosFiltrados = await filterAlunosByMonthYear(data || [], month, year);
      return { success: true, count: alunosFiltrados.length };
    } catch (error) {
      console.error('Erro ao contar alunos:', error);
      return { success: false, error: error.message, count: 0 };
    }
  },

  // Obter todos os alunos (com filtragem por mês de referência)
  async getAllStudents(month = null, year = null) {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .order('classe', { ascending: true })
        .order('nome', { ascending: true });
      
      if (error) throw error;

      const alunosFiltrados = await filterAlunosByMonthYear(data || [], month, year);
      return { success: true, data: alunosFiltrados };
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  // Adicionar aluno com vínculo estrito ao mês/ano selecionado
  async addStudent(nome, classe, month = null, year = null) {
    try {
      const cleanName = (nome || '').trim();
      if (!cleanName) {
        return { success: false, error: 'Nome do aluno não pode ser vazio.' };
      }

      const m = Number(month) || (new Date().getMonth() + 1);
      const y = Number(year) || new Date().getFullYear();

      // Formatar a data de matrícula com o mês e ano do cadastro
      const dataMatriculaISO = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0)).toISOString();

      // 1. Verificar se o aluno já existe na tabela principal
      const { data: existing } = await supabase
        .from('alunos_ebd')
        .select('*')
        .eq('nome', cleanName)
        .maybeSingle();

      let aluno = existing;

      if (!aluno) {
        // Criar aluno novo no Supabase com a data do mês selecionado
        const { data: newAluno, error: insertError } = await supabase
          .from('alunos_ebd')
          .insert([{
            nome: cleanName,
            classe,
            data_matricula: dataMatriculaISO
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        aluno = newAluno;
      } else {
        // Atualizar classe e/ou data se necessário
        const { data: updatedAluno, error: updateError } = await supabase
          .from('alunos_ebd')
          .update({
            classe,
            data_matricula: dataMatriculaISO
          })
          .eq('id', aluno.id)
          .select()
          .single();

        if (!updateError && updatedAluno) {
          aluno = updatedAluno;
        }
      }

      // 2. Registrar vínculo (Supabase + localStorage)
      if (aluno?.id) {
        await registrarVinculoMensalSupabase(aluno.id, m, y);
      }

      return { success: true, data: aluno };
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  // Atualizar aluno
  async updateStudent(id, nome, classe, month = null, year = null) {
    try {
      const cleanName = (nome || '').trim();
      const m = month ? Number(month) : null;
      const y = year ? Number(year) : null;

      const updatePayload = { nome: cleanName, classe };
      if (m && y) {
        updatePayload.data_matricula = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0)).toISOString();
      }

      const { data, error } = await supabase
        .from('alunos_ebd')
        .update(updatePayload)
        .eq('id', id)
        .select();

      if (error) throw error;

      if (m && y && id) {
        await registrarVinculoMensalSupabase(id, m, y);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  // Deletar aluno (se mês e ano informados, remove apenas a associação daquele mês)
  async deleteStudent(id, month = null, year = null) {
    try {
      if (month && year) {
        await registrarExclusaoMensalSupabase(id, month, year);
        return { success: true };
      }

      // Exclusão global de todas as listas
      const { error } = await supabase
        .from('alunos_ebd')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar aluno:', error);
      return { success: false, error: error.message };
    }
  },
};


// ============ RELATÓRIOS ============
export const reportFunctions = {
  // ✅ FASE 7.0: LÓGICA DE UPSERT (Atualizar se existe, Criar se não)
  saveReport: async (data) => {
    try {
      console.log('saveReport - Iniciando lógica de Upsert para:', data.className, 'em', data.date);
      
      // ✅ PASSO 1: Verificar se já existe relatório para esta classe + data
      const { data: existingReports, error: checkError } = await supabase
        .from('relatorios_ebd')
        .select('id')
        .eq('data_aula', data.date)
        .eq('classe', data.className);
      
      if (checkError) throw checkError;
      
      const reportData = {
        data_aula: data.date,
        classe: data.className,
        matriculados: Number(data.matriculated),
        ausentes: Number(data.absent),
        presentes: Number(data.present),
        visitantes: Number(data.visitor),
        biblias: Number(data.bibles),
        revistas: Number(data.magazines),
        ofertas: Number(data.offering),
      };
      
      let result;
      
      if (existingReports && existingReports.length > 0) {
        // ✅ ATUALIZAR: Já existe relatório para esta classe + data
        console.log('saveReport - Atualizando relatório existente (ID:', existingReports[0].id, ')');
        const { data: updateResult, error: updateError } = await supabase
          .from('relatorios_ebd')
          .update(reportData)
          .eq('id', existingReports[0].id)
          .select();
        
        if (updateError) throw updateError;
        result = updateResult;
        console.log('saveReport - Relatório atualizado com sucesso');
      } else {
        // ✅ CRIAR: Não existe relatório para esta classe + data
        console.log('saveReport - Criando novo relatório');
        const { data: insertResult, error: insertError } = await supabase
          .from('relatorios_ebd')
          .insert([reportData])
          .select();
        
        if (insertError) throw insertError;
        result = insertResult;
        console.log('saveReport - Novo relatório criado com sucesso');
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      return { success: false, error: error.message };
    }
  },

  getReportsByDate: async (date) => {
    try {
      const { data, error } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .eq('data_aula', date);
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  getAllReports: async () => {
    try {
      const { data, error } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .order('data_aula', { ascending: false })
        .order('classe', { ascending: true });
      
      if (error) throw error;
      
      console.log('getAllReports - Total de relatórios:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar todos os relatórios:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  deleteReportsByDate: async (date) => {
    try {
      const { error } = await supabase
        .from('relatorios_ebd')
        .delete()
        .eq('data_aula', date);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar relatórios:', error);
      return { success: false, error: error.message };
    }
  },
};
