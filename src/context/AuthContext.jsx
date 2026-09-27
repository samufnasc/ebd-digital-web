import { createContext, useState, useEffect, useContext } from 'react';
import { supabase, professorFunctions } from '../lib/supabase';

const AuthContext = createContext();

// Usuários padrão locais (em produção, vem do Supabase)
const DEFAULT_USERS = {
  admin: { password: 'admin123', role: 'admin' },
  secretario: { password: 'secr123', role: 'secretary' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [professores, setProfessores] = useState({});

  const refreshProfessores = async () => {
    try {
      const result = await professorFunctions.getProfessores();
      if (result.success && result.data) {
        setProfessores(result.data);
      }
    } catch (err) {
      console.warn('Erro ao atualizar professores:', err);
    }
  };

  // Carregar usuários e professores do Supabase ao iniciar
  useEffect(() => {
    const loadAll = async () => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*');
        
        if (!error && data && data.length > 0) {
          const usersMap = {};
          data.forEach(u => {
            // Indexa tanto em minúsculas quanto no case original para evitar falhas no mobile
            const keyLower = (u.username || '').trim().toLowerCase();
            const original = (u.username || '').trim();
            const payload = {
              password: u.password,
              role: u.role,
              username: original,
            };
            usersMap[keyLower] = payload;
            usersMap[original] = payload;
          });
          setUsers(usersMap);
        } else {
          const saved = localStorage.getItem('users');
          if (saved) setUsers(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('Erro ao carregar usuarios do Supabase:', error);
        const saved = localStorage.getItem('users');
        if (saved) setUsers(JSON.parse(saved));
      }

      await refreshProfessores();
      setLoading(false);
    };

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }

    loadAll();
  }, []);

  // Login assíncrono e direto no Supabase para garantir funcionamento em celulares
  const login = async (usernameInput, passwordInput) => {
    const rawUser = (usernameInput || '').trim();
    const rawPass = (passwordInput || '').trim();
    if (!rawUser || !rawPass) return false;

    const lowerKey = rawUser.toLowerCase();

    // 1. Tentar login direto nos professores carregados
    const prof = professores[lowerKey];
    if (prof && prof.enabled && String(prof.password).trim() === rawPass) {
      const userData = {
        username: prof.primeiroNome || prof.nomeCompleto || rawUser,
        role: 'teacher',
        classe: prof.classe,
        nomeCompleto: prof.nomeCompleto,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }

    // 2. Tentar buscar o professor direto no Supabase (se o app acabou de abrir no celular)
    try {
      const { data: profDb } = await supabase
        .from('professores')
        .select('*')
        .ilike('username', rawUser)
        .eq('password', rawPass)
        .eq('enabled', true)
        .maybeSingle();

      if (profDb) {
        const userData = {
          username: profDb.primeiro_nome || profDb.nome_completo || profDb.username,
          role: 'teacher',
          classe: profDb.classe,
          nomeCompleto: profDb.nome_completo,
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return true;
      }
    } catch (err) {
      console.warn('Busca direta professor erro:', err);
    }

    // 3. Tentar login de Administrador / Secretário (usuários do sistema)
    if (users[lowerKey] && users[lowerKey].password === rawPass) {
      const userData = {
        username: users[lowerKey].username || rawUser,
        role: users[lowerKey].role,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }

    // 4. Fallback de consulta direta na tabela usuarios do Supabase
    try {
      const { data: userDb } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('username', rawUser)
        .eq('password', rawPass)
        .maybeSingle();

      if (userDb) {
        const userData = {
          username: userDb.username,
          role: userDb.role,
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return true;
      }
    } catch (err) {
      console.warn('Busca direta usuario erro:', err);
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const addUser = async (username, password, role) => {
    const cleanUser = (username || '').trim();
    try {
      const { error } = await supabase
        .from('usuarios')
        .insert([{ username: cleanUser, password, role }]);

      if (error) throw error;

      setUsers(prev => ({
        ...prev,
        [cleanUser.toLowerCase()]: { username: cleanUser, password, role },
        [cleanUser]: { username: cleanUser, password, role },
      }));

      return { success: true, message: 'Usuário criado com sucesso' };
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return { success: false, message: 'Erro ao criar usuário: ' + error.message };
    }
  };

  const updateUser = async (username, newPassword) => {
    const cleanUser = (username || '').trim();
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ password: newPassword })
        .ilike('username', cleanUser);

      if (error) throw error;

      setUsers(prev => ({
        ...prev,
        [cleanUser.toLowerCase()]: { ...(prev[cleanUser.toLowerCase()] || {}), password: newPassword },
      }));

      return { success: true, message: 'Senha atualizada com sucesso' };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return { success: false, message: 'Erro ao atualizar usuário: ' + error.message };
    }
  };

  const deleteUser = async (username) => {
    const cleanUser = (username || '').trim();
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .ilike('username', cleanUser);

      if (error) throw error;

      const newUsers = { ...users };
      delete newUsers[cleanUser.toLowerCase()];
      delete newUsers[cleanUser];
      setUsers(newUsers);

      return { success: true, message: 'Usuário deletado com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return { success: false, message: 'Erro ao deletar usuário: ' + error.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        users,
        professores,
        refreshProfessores,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
