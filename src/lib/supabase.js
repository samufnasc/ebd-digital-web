import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://swfwfpjjwtfpbfxbwkgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3ZndmcGpqd3RmcGJmeGJ3a2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjI0MTUsImV4cCI6MjA4NzUzODQxNX0.onkTWs4LHq8kxY7r_qhX1_eRNtnh8h47J8_ckLgmaEc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ AUTENTICAÇÃO ============
export const authFunctions = {
  login: async (username, password) => {
    try {
      const cleanUser = (username || '').trim();
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('username', cleanUser)
        .eq('password', password)
        .single();

      if (error || !data) {
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

// ============ PROFESSORES ============
export const professorFunctions = {
  getProfessoresLocal() {
    try {
      const raw = localStorage.getItem('ebd_professores');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  salvarProfessoresLocal(map) {
    try {
      localStorage.setItem('ebd_professores', JSON.stringify(map || {}));
    } catch (err) {
      console.warn('[supabase.js] salvarProfessoresLocal - erro:', err.message);
    }
  },

  async getProfessores() {
    let local = this.getProfessoresLocal();
    try {
      const { data, error } = await supabase
        .from('professores')
        .select('*');

      if (error) throw error;

      const map = { ...local };
      (data || []).forEach(p => {
        const key = (p.username || '').toLowerCase();
        map[key] = {
          username: p.username,
          nomeCompleto: p.nome_completo,
          primeiroNome: p.primeiro_nome,
          classe: p.classe,
          password: p.password,
          enabled: !!p.enabled,
        };
      });
      this.limparProfessores(map);
      this.salvarProfessoresLocal(map);
      return { success: true, data: map };
    } catch (err) {
      console.warn('[supabase.js] getProfessores - fallback localStorage:', err.message);
      local = this.limparProfessores(local);
      this.salvarProfessoresLocal(local);
      return { success: true, data: local };
    }
  },

  limparProfessores(map) {
    Object.keys(map || {}).forEach(key => {
      const p = map[key];
      if (!p || (!p.primeiroNome && !p.nomeCompleto)) {
        delete map[key];
      }
    });
    return map;
  },

  async upsertProfessor(prof) {
    const key = (prof.username || '').toLowerCase();
    const local = this.getProfessoresLocal();
    local[key] = {
      username: prof.username,
      nomeCompleto: prof.nomeCompleto,
      primeiroNome: prof.primeiroNome,
      classe: prof.classe,
      password: prof.password,
      enabled: !!prof.enabled,
    };
    this.salvarProfessoresLocal(local);

    try {
      const { error } = await supabase
        .from('professores')
        .upsert({
          username: prof.username,
          nome_completo: prof.nomeCompleto,
          primeiro_nome: prof.primeiroNome,
          classe: prof.classe,
          password: prof.password,
          enabled: !!prof.enabled,
        });
      if (error) throw error;
    } catch (err) {
      console.warn('[supabase.js] upsertProfessor erro no Supabase:', err.message);
      return { success: false, error: err.message };
    }

    return { success: true };
  },

  async deleteProfessor(username) {
    const key = (username || '').toLowerCase();
    const local = this.getProfessoresLocal();
    delete local[key];
    this.salvarProfessoresLocal(local);

    try {
      const { error } = await supabase
        .from('professores')
        .delete()
        .eq('username', username);
      if (error) throw error;
    } catch (err) {
      console.warn('[supabase.js] deleteProfessor erro:', err.message);
    }

    return { success: true };
  },
};

// ============ CHAMADAS & FREQUÊNCIA DE ALUNOS ============
export const chamadaFunctions = {
  async getChamada(classe, dataAula) {
    try {
      const { data, error } = await supabase
        .from('chamadas_alunos')
        .select('*')
        .eq('classe', classe)
        .eq('data_aula', dataAula);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('[supabase.js] getChamada erro:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  async salvarChamada(registros) {
    if (!registros || registros.length === 0) return { success: true };
    try {
      const payload = registros.map(r => ({
        data_aula: r.data_aula,
        classe: r.classe,
        aluno_id: r.aluno_id,
        aluno_nome: r.aluno_nome,
        status: r.status,
        trouxe_biblia: !!r.trouxe_biblia,
        trouxe_revista: !!r.trouxe_revista,
        registrado_por: r.registrado_por || null,
      }));

      const { data, error } = await supabase
        .from('chamadas_alunos')
        .upsert(payload, { onConflict: 'data_aula,aluno_id' })
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('[supabase.js] salvarChamada erro:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteChamadaByDate(date, classe = null) {
    try {
      let query = supabase.from('chamadas_alunos').delete().eq('data_aula', date);
      if (classe) {
        query = query.eq('classe', classe);
      }
      const { error } = await query;
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[supabase.js] deleteChamadaByDate erro:', error);
      return { success: false, error: error.message };
    }
  },

  async getChamadasPeriodo(classe, mes, ano) {
    try {
      const padM = String(mes).padStart(2, '0');
      const dataInicio = `${ano}-${padM}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const padD = String(ultimoDia).padStart(2, '0');
      const dataFim = `${ano}-${padM}-${padD}`;

      const { data, error } = await supabase
        .from('chamadas_alunos')
        .select('*')
        .eq('classe', classe)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .order('data_aula', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('[supabase.js] getChamadasPeriodo erro:', error);
      return { success: false, data: [], error: error.message };
    }
  }
};

// ============ ALUNOS ============
export const studentFunctions = {
  async getStudentsByClass(className) {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .eq('classe', className)
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getStudentsByClassAndPeriod(className, month, year) {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .eq('classe', className)
        .order('nome', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getAllStudents() {
    try {
      const { data, error } = await supabase
        .from('alunos_ebd')
        .select('*')
        .order('classe', { ascending: true })
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async addStudent(nome, classe, month = null, year = null) {
    try {
      const cleanName = (nome || '').trim();
      if (!cleanName) {
        return { success: false, error: 'Nome do aluno não pode ser vazio.' };
      }

      const { data, error } = await supabase
        .from('alunos_ebd')
        .insert([{ nome: cleanName, classe }])
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  async updateStudent(id, nome, classe) {
    try {
      const cleanName = (nome || '').trim();
      const { data, error } = await supabase
        .from('alunos_ebd')
        .update({ nome: cleanName, classe })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteStudent(id) {
    try {
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
  saveReport: async (data) => {
    try {
      const { data: existingReports, error: checkError } = await supabase
        .from('relatorios_ebd')
        .select('id')
        .eq('data_aula', data.date)
        .eq('classe', data.className);
      
      if (checkError) throw checkError;
      
      const reportData = {
        data_aula: data.date,
        classe: data.className,
        matriculados: Number(data.matriculated) || 0,
        ausentes: Number(data.absent) || 0,
        presentes: Number(data.present) || 0,
        visitantes: Number(data.visitor) || 0,
        biblias: Number(data.bibles) || 0,
        revistas: Number(data.magazines) || 0,
        ofertas: Number(data.offering) || 0,
      };
      
      let result;
      if (existingReports && existingReports.length > 0) {
        const { data: updateResult, error: updateError } = await supabase
          .from('relatorios_ebd')
          .update(reportData)
          .eq('id', existingReports[0].id)
          .select();
        
        if (updateError) throw updateError;
        result = updateResult;
      } else {
        const { data: insertResult, error: insertError } = await supabase
          .from('relatorios_ebd')
          .insert([reportData])
          .select();
        
        if (insertError) throw insertError;
        result = insertResult;
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
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar todos os relatórios:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  deleteReportsByDate: async (date) => {
    try {
      // 1. Deletar os relatórios consolidados do dia
      const { error: errorRel } = await supabase
        .from('relatorios_ebd')
        .delete()
        .eq('data_aula', date);
      
      if (errorRel) throw errorRel;

      // 2. Deletar também os registros individuais de chamadas do dia (para sincronizar com o professor)
      await chamadaFunctions.deleteChamadaByDate(date);

      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar relatórios:', error);
      return { success: false, error: error.message };
    }
  },
};
