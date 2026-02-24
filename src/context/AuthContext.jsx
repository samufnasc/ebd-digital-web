import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

// Usuarios padrao (em producao, vir do banco de dados)
const DEFAULT_USERS = {
  admin: { password: 'admin123', role: 'admin' },
  secretario: { password: 'secr123', role: 'secretary' },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  useEffect(() => {
    // Restaurar usuario do localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Salvar usuarios no localStorage
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

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

  const addUser = (username, password, role) => {
    if (users[username]) {
      return { success: false, message: 'Usuario ja existe' };
    }
    setUsers(prev => ({
      ...prev,
      [username]: { password, role }
    }));
    return { success: true, message: 'Usuario criado com sucesso' };
  };

  const updateUser = (username, newPassword) => {
    if (!users[username]) {
      return { success: false, message: 'Usuario nao encontrado' };
    }
    setUsers(prev => ({
      ...prev,
      [username]: { ...prev[username], password: newPassword }
    }));
    return { success: true, message: 'Senha atualizada com sucesso' };
  };

  const deleteUser = (username) => {
    if (!users[username]) {
      return { success: false, message: 'Usuario nao encontrado' };
    }
    const newUsers = { ...users };
    delete newUsers[username];
    setUsers(newUsers);
    return { success: true, message: 'Usuario deletado com sucesso' };
  };

  const getAllUsers = () => Object.entries(users).map(([username, data]) => ({
    username,
    role: data.role
  }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, addUser, updateUser, deleteUser, getAllUsers }}>
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

// Hook para usar apenas funcoes de gestao de usuarios
export const useUserManagement = () => {
  const { addUser, updateUser, deleteUser, getAllUsers } = useAuth();
  return { addUser, updateUser, deleteUser, getAllUsers };
};
