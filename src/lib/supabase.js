import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://swfwfpjjwtfpbfxbwkgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3ZndmcGpqd3RmcGJmeGJ3a2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjI0MTUsImV4cCI6MjA4NzUzODQxNX0.onkTWs4LHq8kxY7r_qhX1_eRNtnh8h47J8_ckLgmaEc';

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

// ============ RELATÓRIOS ============
export const reportFunctions = {
  saveReport: async (data) => {
    try {
      const { data: result, error } = await supabase
        .from('relatorios_ebd')
        .insert([{
          data_aula: data.date,
          classe: data.className,
          matriculados: Number(data.matriculated),
          ausentes: Number(data.absent),
          presentes: Number(data.present),
          visitantes: Number(data.visitor),
          biblias: Number(data.bibles),
          revistas: Number(data.magazines),
          ofertas: Number(data.offering),
        }]);
      
      if (error) throw error;
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

// ============ ALUNOS ============
export const studentFunctions = {
  // Obter alunos por classe
  async getStudentsByClass(className) {
    try {
      const { data, error } = await supabase
        .from('alunos')
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

  // Contar alunos por classe
  async countStudentsByClass(className) {
    try {
      const { data, error, count } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true })
        .eq('classe', className);
      
      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Erro ao contar alunos:', error);
      return { success: false, error: error.message, count: 0 };
    }
  },

  // Obter todos os alunos
  async getAllStudents() {
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .order('classe', { ascending: true })
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar todos os alunos:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  // Adicionar aluno
  async addStudent(nome, classe) {
    try {
      const { data, error } = await supabase
        .from('alunos')
        .insert([{ nome, classe }])
        .select();
      
      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  // Atualizar aluno
  async updateStudent(id, nome, classe) {
    try {
      const { data, error } = await supabase
        .from('alunos')
        .update({ nome, classe })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  // Deletar aluno
  async deleteStudent(id) {
    try {
      const { error } = await supabase
        .from('alunos')
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


