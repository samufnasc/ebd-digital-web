import { createContext, useState, useEffect, useContext } from 'react';
import { supabase, professorFunctions } from '../lib/supabase';
import { hashPassword, verificarSenha, isHashed } from '../lib/passwords';

const AuthContext = createContext();

const DEFAULT_USERS = {
  admin: { password: 'bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d', role: 'admin' },
  secretario: { password: '04c0a9d381b47431f7bebe46ab139128084f773109ebe53bfcf12851122f8ae8', role: 'secretary' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [professores, setProfessores] = useState({});

  const refreshProfessores = async () => {
    const result = await professorFunctions.getProfessores();
    if (result.success && result.data) {
      setProfessores(result.data);
    }
  };

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
          const precisaMigrar = [];
          data.forEach(user => {
            usersMap[user.username] = {
              password: user.password,
              role: user.role
            };
            if (user.password && !isHashed(user.password)) {
              precisaMigrar.push(user);
            }
          });

          // Migracao: converter senhas em texto puro para hash (SHA-256 com salt = username)
          for (const user of precisaMigrar) {
            const hash = await hashPassword(user.password, user.username);
            usersMap[user.username] = { ...usersMap[user.username], password: hash };
            try {
              await supabase
                .from('usuarios')
                .update({ password: hash })
                .eq('username', user.username);
            } catch (migErr) {
              console.warn('AuthContext - erro ao migrar senha do usuario', user.username, migErr.message);
            }
          }

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
    refreshProfessores();
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const usuario = users[username];
    if (usuario && await verificarSenha(password, username, usuario.password)) {
      const userData = {
        username,
        role: usuario.role,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }

    // Login de professor: primeiro nome (case-insensitive) + senha definida pelo admin
    const profKey = (username || '').trim().toLowerCase();
    const professor = professores[profKey];
    if (professor && professor.enabled && await verificarSenha(password, profKey, professor.password)) {
      const userData = {
        username: professor.primeiroNome || professor.nomeCompleto,
        role: 'teacher',
        classe: professor.classe,
        nomeCompleto: professor.nomeCompleto,
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
      const hashedPassword = await hashPassword(password, username);

      // Salvar no Supabase
      const { error } = await supabase
        .from('usuarios')
        .insert([{
          username,
          password: hashedPassword,
          role
        }]);

      if (error) throw error;

      // Atualizar estado local
      setUsers(prev => ({
        ...prev,
        [username]: { password: hashedPassword, role }
      }));

      // Salvar no localStorage como fallback
      localStorage.setItem('users', JSON.stringify({
        ...users,
        [username]: { password: hashedPassword, role }
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
      const hashedPassword = await hashPassword(newPassword, username);

      // Atualizar no Supabase
      const { error } = await supabase
        .from('usuarios')
        .update({ password: hashedPassword })
        .eq('username', username);

      if (error) throw error;

      // Atualizar estado local
      setUsers(prev => ({
        ...prev,
        [username]: { ...prev[username], password: hashedPassword }
      }));

      // Salvar no localStorage como fallback
      localStorage.setItem('users', JSON.stringify({
        ...users,
        [username]: { ...users[username], password: hashedPassword }
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
