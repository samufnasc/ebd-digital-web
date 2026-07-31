import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserManagement({ onClose }) {
  const { addUser, deleteUser, users: allUsers } = useAuth();
  const [users, setUsers] = useState(Object.keys(allUsers).map(username => ({
    username,
    role: allUsers[username].role
  })));
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'secretary',
  });
  const [message, setMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setMessage('Preencha todos os campos');
      return;
    }

    const result = await addUser(formData.username, formData.password, formData.role);
    
    if (result.success) {
      setMessage(result.message);
      // Atualizar lista de usuarios
      setFormData({ username: '', password: '', role: 'secretary' });
      setShowForm(false);
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage(result.message);
    }
  };

  const handleDeleteUser = (username) => {
    setUserToDelete(username);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const username = userToDelete;
    setUserToDelete(null);
    const result = await deleteUser(username);
    if (result.success) {
      setMessage(result.message);
      setUsers(prev => prev.filter(u => u.username !== username));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.includes('sucesso') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        {!showForm ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              + Novo Usuário
            </button>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Usuários Cadastrados</h3>
              {users.length === 0 ? (
                <p className="text-gray-600">Nenhum usuário cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.username} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{u.username}</p>
                        <p className="text-sm text-gray-600">{u.role === 'admin' ? 'Administrador' : 'Secretário'}</p>
                      </div>
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u.username)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                        >
                          Deletar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuário
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Digite o nome de usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Digite a senha"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perfil
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="secretary">Secretário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Criar Usuário
              </button>
            </div>
          </form>
        )}
        {/* Modal de confirmação de exclusão */}
        {userToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Você tem certeza dessa ação?</h3>
              <p className="text-gray-600 text-sm mb-6">
                Deseja realmente excluir o usuário <strong>"{userToDelete}"</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm shadow-sm"
                >
                  Deletar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
