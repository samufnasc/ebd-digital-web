# 🚀 Guia de Instalação e Uso - EBD Digital Web

## 📋 Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🛠️ Instalação Local

### 1. Extrair o arquivo
```bash
tar -xzf ebd-digital-web.tar.gz
cd ebd-digital-web
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Iniciar servidor de desenvolvimento
```bash
npm run dev
```

O app abrirá automaticamente em `http://localhost:5173`

## 🔐 Fazer Login

### Admin
- **Usuário:** admin
- **Senha:** admin123

### Secretário
- **Usuário:** secretario
- **Senha:** secr123

## 📱 Funcionalidades

### Painel do Secretário
1. **Novo Relatório**: Clique no botão "+" para abrir a câmera
2. **Capturar Caderneta**: Tire uma foto da caderneta com a câmera do seu dispositivo
3. **Revisar Dados**: O sistema extrai os dados (simulado) e permite edição
4. **Salvar**: Clique em "Salvar Relatório" para armazenar os dados

### Painel do Admin
1. **Filtrar por Data**: Selecione a data desejada
2. **Visualizar Relatório**: Veja o consolidado de todas as classes
3. **Exportar PDF**: Clique em "Exportar PDF" para baixar o relatório em PDF

## 📦 Build para Produção

```bash
npm run build
```

Isso gera uma pasta `dist/` pronta para deploy.

## 🌐 Deploy na Vercel

### Opção 1: Via CLI
```bash
npm install -g vercel
vercel
```

### Opção 2: Via GitHub
1. Faça push do código para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "New Project"
4. Selecione seu repositório
5. Clique em "Deploy"

## 📁 Estrutura de Arquivos

```
ebd-digital-web/
├── src/
│   ├── components/        # Componentes React
│   ├── context/          # Contextos (Auth, Data)
│   ├── pages/            # Páginas (Login, Dashboards)
│   ├── utils/            # Utilitários (OCR, PDF)
│   ├── hooks/            # Custom hooks
│   ├── App.jsx           # Componente principal
│   ├── main.jsx          # Ponto de entrada
│   └── index.css         # Estilos globais
├── dist/                 # Build para produção
├── package.json          # Dependências
├── vite.config.js        # Configuração Vite
├── tailwind.config.js    # Configuração Tailwind
└── index.html            # HTML principal
```

## 🔧 Configurações Importantes

### Tailwind CSS
Edite `tailwind.config.js` para customizar cores e temas.

### Vite
Edite `vite.config.js` para mudar porta ou outras configurações.

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Câmera não funciona
- Verificar permissões do navegador
- Usar HTTPS em produção
- Testar em localhost durante desenvolvimento

### Dados não salvam
- Verificar se localStorage está habilitado
- Limpar cache do navegador
- Testar em modo anônimo

### Build falha
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📊 Dados Simulados

O sistema usa dados simulados para OCR. Para integrar com OCR real:

1. Instalar Tesseract.js:
```bash
npm install tesseract.js
```

2. Modificar `src/utils/ocr.js` para usar Tesseract

## 📝 Notas

- **localStorage**: Dados são salvos localmente no navegador
- **Credenciais**: Hardcoded para teste; em produção, usar backend
- **OCR**: Simulado; em produção, integrar com API de visão
- **PDF**: Usa jsPDF; pode ser customizado com logos/cores

## 🎨 Customização

### Mudar cores
Edite `tailwind.config.js`:
```js
colors: {
  primary: '#0a7ea4',      // Azul
  secondary: '#f59e0b',    // Amarelo
  success: '#22c55e',      // Verde
  error: '#ef4444',        // Vermelho
}
```

### Mudar logo
Substitua o logo em `src/App.jsx` e `src/pages/Login.jsx`

### Adicionar classes
Edite `src/context/DataContext.jsx`:
```js
const INITIAL_CLASSES = [
  { id: '1', name: 'Sua Classe' },
  // ...
];
```

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar este guia
2. Consultar README.md
3. Abrir issue no repositório

## 🎓 Próximos Passos

1. **Integrar Backend**: Conectar com API Node.js/Express
2. **Autenticação Real**: Usar JWT ou OAuth
3. **OCR Inteligente**: Integrar Tesseract.js ou Google Vision
4. **Banco de Dados**: PostgreSQL ou MongoDB
5. **Notificações**: Adicionar push notifications
6. **Relatórios Avançados**: Gráficos e análises

---

**Versão:** 1.0.0  
**Última atualização:** Fevereiro 2026
