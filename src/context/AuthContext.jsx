import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

// Usuarios padrao (em producao, vir do banco de dados)
const DEFAULT_USERS = {
  admin: { password: 'admin123', role: 'admin' },
  secretario: { password: 'secr123', role: 'secretary' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(DEFAULT_USERS);

  // Carregar usuarios do Supabase ao iniciar
  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Tentar carregar usuarios do Supabase
        const { data, error } = await supabase
          .from('usuarios')
          .select('*');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Converter dados do Supabase para formato local
          const usersMap = {};
          data.forEach(user => {
            usersMap[user.username] = {
              password: user.password,
              role: user.role
            };
          });
          setUsers(usersMap);
        } else {
          // Se tabela vazia, salvar usuarios padrao
          for (const [username, userData] of Object.entries(DEFAULT_USERS)) {
            await supabase.from('usuarios').insert([{
              username,
              password: userData.password,
              role: userData.role
            }]);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar usuarios do Supabase:', error);
        // Fallback para localStorage
        const saved = localStorage.getItem('users');
        if (saved) {
          setUsers(JSON.parse(saved));
        }
      }
    };

    // Restaurar usuario do localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    loadUsers();
    setLoading(false);
  }, []);

  const login = (username, password) => {
    if (users[username] && users[username].password === password) {
      const userData = {
        username,
        role: users[username].role,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const addUser = async (username, password, role) => {
    if (users[username]) {
      return { success: false, message: 'Usuario ja existe' };
    }

    try {
      // Salvar no Supabase
      const { error } = await supabase
        .from('usuarios')
        .insert([{
          username,
          password,
          role
        }]);

      if (error) throw error;

      // Atualizar estado local
      setUsers(prev => ({
        ...prev,
        [username]: { password, role }
      }));

      // Salvar no localStorage como fallback
      localStorage.setItem('users', JSON.stringify({
        ...users,
        [username]: { password, role }
      }));

      return { success: true, message: 'Usuario criado com sucesso' };
    } catch (error) {
      console.error('Erro ao criar usuario:', error);
      return { success: false, message: 'Erro ao criar usuario: ' + error.message };
    }
  };

  const updateUser = async (username, newPassword) => {
    if (!users[username]) {
      return { success: false, message: 'Usuario nao encontrado' };
    }

    try {
      // Atualizar no Supabase
      const { error } = await supabase
        .from('usuarios')
        .update({ password: newPassword })
        .eq('username', username);

      if (error) throw error;

      // Atualizar estado local
      setUsers(prev => ({
        ...prev,
        [username]: { ...prev[username], password: newPassword }
      }));

      // Salvar no localStorage como fallback
      localStorage.setItem('users', JSON.stringify({
        ...users,
        [username]: { ...users[username], password: newPassword }
      }));

      return { success: true, message: 'Senha atualizada com sucesso' };
    } catch (error) {
      console.error('Erro ao atualizar usuario:', error);
      return { success: false, message: 'Erro ao atualizar usuario: ' + error.message };
    }
  };

  const deleteUser = async (username) => {
    if (!users[username]) {
      return { success: false, message: 'Usuario nao encontrado' };
    }

    try {
      // Deletar do Supabase
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('username', username);

      if (error) throw error;

      // Atualizar estado local
      const newUsers = { ...users };
      delete newUsers[username];
      setUsers(newUsers);

      // Salvar no localStorage como fallback
      localStorage.setItem('users', JSON.stringify(newUsers));

      return { success: true, message: 'Usuario deletado com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar usuario:', error);
      return { success: false, message: 'Erro ao deletar usuario: ' + error.message };
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
