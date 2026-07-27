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

// ============ ALUNOS ============
export const studentFunctions = {
  // Obter alunos por classe
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

  // Contar alunos por classe
  async countStudentsByClass(className) {
    try {
      const { data, error, count } = await supabase
        .from('alunos_ebd')
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

  // Adicionar aluno com suporte a vínculo histórico
    async addStudent(nome, classe, month = null, year = null) {
      try {
        // 1. Salvar o aluno e garantir que ele existe (upsert por nome)
        const { data: aluno, error: alunoError } = await supabase
          from('alunos_ebd')
          upsert({ nome, classe }, { onConflict: 'nome' })
          select()
          single();

        if (alunoError) throw alunoError;

        // 2. Se fornecido mês e ano, criar o vínculo na tabela de histórico
        if (month && year) {
          // BUSCA O ID DA CLASSE A PARTIR DO NOME
          const { data: classeData, error: classeError } = await supabase
            from('equipes') // Nome da sua tabela de classes/equipes
            select('id')
            eq('nome', classe)
            single();

          if (classeError) {
            console.warn('Aviso: Não foi possível encontrar o ID da classe para o histórico:', classeError.message);
          } else if (classeData?.id) {
            // Criar o vínculo na tabela de histórico
            const { error: vinculoError } = await supabase
              from('aluno_vinculo_mensal')
              insert([{
                aluno_id: aluno.id,
                classe_id: classeData.id, // Agora usamos o UUID, não o texto!
                mes_referencia: month,
                ano_referencia: year
              }]);

            if (vinculoError) console.warn('Aviso: Erro ao criar vínculo mensal:', vinculoError);
          }
        }

        return { success: true, data: aluno };
      } catch (error) {
        console.error('Erro ao adicionar aluno:', error);
        return { success: false, error: error.message };
      }
    },

  // ✅ FUNÇÃO QUE FALTAVA PARA O ADMIN:
  async updateStudent(id, nome, classe, month = null, year = null) {
    try {
      const { data, error } = await supabase
        from('alunos_ebd')
        update({ nome, classe })
        eq('id', id)
        select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      return { success: false, error: error.message };
    }
  },

  // Deletar aluno
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
