import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://swfwfpjjwtfpbfxbwkgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3ZndmcGpqd3RmcGJmeGJ3a2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjI0MTUsImV4cCI6MjA4NzUzODQxNX0.onkTWs4LHq8kxY7r_qhX1_eRNtnh8h47J8_ckLgmaEc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Funcoes para relatorios
export const reportFunctions = {
  // Salvar relatorio
  async saveReport(data) {
    try {
      const { data: result, error } = await supabase
        .from('relatorios_ebd')
        .insert([{
          data_aula: data.date,
          classe: data.className,
          matriculados: data.matriculated,
          ausentes: data.absent,
          presentes: data.present,
          visitantes: data.visitor,
          biblias: data.bibles,
          revistas: data.magazines,
          ofertas: data.offering,
        }]);
      
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao salvar relatorio:', error);
      return { success: false, error: error.message };
    }
  },

  // Buscar relatorios por data
  async getReportsByDate(date) {
    try {
      const { data, error } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .eq('data_aula', date);
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar relatorios:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  // Buscar todos os relatorios
  async getAllReports() {
    try {
      const { data, error } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .order('data_aula', { ascending: false });
      
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Erro ao buscar todos os relatorios:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  // Atualizar relatorio
  async updateReport(id, data) {
    try {
      const { data: result, error } = await supabase
        .from('relatorios_ebd')
        .update({
          matriculados: data.matriculated,
          ausentes: data.absent,
          presentes: data.present,
          visitantes: data.visitor,
          biblias: data.bibles,
          revistas: data.magazines,
          ofertas: data.offering,
        })
        .eq('id', id);
      
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao atualizar relatorio:', error);
      return { success: false, error: error.message };
    }
  },

  // Deletar relatorio
  async deleteReport(id) {
    try {
      const { error } = await supabase
        .from('relatorios_ebd')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar relatorio:', error);
      return { success: false, error: error.message };
    }
  },
};
