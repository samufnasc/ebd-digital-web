# EBD Digital - Versão Web

Sistema de gestão de Escola Bíblica Dominical com autenticação, câmera OCR e relatórios PDF.

## 🚀 Características

- ✅ Autenticação com login (Admin e Secretário)
- ✅ Câmera OCR para captura de cadernetas
- ✅ Processamento inteligente de 5 colunas (domingos)
- ✅ Cálculos automáticos de frequência
- ✅ Relatórios consolidados por classe
- ✅ Exportação de PDF profissional
- ✅ Persistência de dados com localStorage
- ✅ Interface responsiva com Tailwind CSS

## 📋 Credenciais de Teste

### Admin
- Usuário: `admin`
- Senha: `admin123`

### Secretário
- Usuário: `secretario`
- Senha: `secr123`

## 🛠️ Instalação

```bash
# Clonar repositório
git clone <seu-repositorio>
cd ebd-digital-web

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 📁 Estrutura do Projeto

```
ebd-digital-web/
├── src/
│   ├── components/
│   │   └── CameraCapture.jsx      # Componente de câmera
│   ├── context/
│   │   ├── AuthContext.jsx        # Contexto de autenticação
│   │   └── DataContext.jsx        # Contexto de dados
│   ├── pages/
│   │   ├── Login.jsx              # Tela de login
│   │   ├── SecretaryDashboard.jsx # Painel do secretário
│   │   └── AdminDashboard.jsx     # Painel do admin
│   ├── utils/
│   │   ├── ocr.js                 # Lógica de OCR
│   │   └── pdf.js                 # Geração de PDF
│   ├── hooks/
│   │   └── useNavigate.js         # Hook de navegação
│   ├── App.jsx                    # Componente principal
│   ├── main.jsx                   # Ponto de entrada
│   └── index.css                  # Estilos globais
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🔐 Fluxo de Autenticação

1. **Login**: Usuário insere credenciais (admin ou secretario)
2. **Validação**: Sistema verifica contra credenciais hardcoded
3. **Armazenamento**: Usuário salvo em localStorage
4. **Redirecionamento**: Admin → AdminDashboard, Secretário → SecretaryDashboard

## 📸 Fluxo OCR

1. **Captura**: Secretário clica em "+" para abrir câmera
2. **Foto**: Tira foto da caderneta com frame de guia
3. **Processamento**: Sistema simula OCR (em produção, usar Tesseract.js)
4. **Última Coluna**: Detecta última coluna preenchida (C1-C5)
5. **Revisão**: Secretário valida e edita dados
6. **Salvamento**: Dados salvos em localStorage

## 📊 Relatórios

### Secretário
- Visualiza relatórios recentes
- Adiciona novos relatórios via OCR
- Edita dados antes de salvar

### Admin
- Visualiza relatório consolidado por data
- Filtra por data específica
- Exporta PDF profissional com layout oficial

## 📄 Exportação PDF

O botão "Exportar PDF" gera um documento com:
- Cabeçalho com data
- Tabela com todas as classes
- Linha de totais consolidados
- Formatação profissional com cores

## 🌐 Deploy na Vercel

### 1. Preparar repositório Git
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <seu-repositorio>
git push -u origin main
```

### 2. Deploy na Vercel
```bash
npm install -g vercel
vercel
```

Ou conecte seu repositório diretamente em [vercel.com](https://vercel.com)

### 3. Configurar variáveis de ambiente (se necessário)
- Nenhuma variável obrigatória para esta versão

## 🔧 Tecnologias

- **React 18** - Framework UI
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **jsPDF** - Geração de PDF
- **localStorage** - Persistência de dados

## 📝 Notas Importantes

- Os dados são armazenados em localStorage (perdidos ao limpar cache)
- OCR é simulado; em produção, integrar com Tesseract.js ou API de visão
- Credenciais são hardcoded; em produção, usar backend com autenticação segura
- Câmera funciona apenas em HTTPS ou localhost

## 🐛 Troubleshooting

**Câmera não funciona:**
- Verificar permissões do navegador
- Usar HTTPS em produção
- Testar em localhost durante desenvolvimento

**Dados não persistem:**
- localStorage pode estar desabilitado
- Verificar se o navegador permite armazenamento local

**PDF não exporta:**
- Verificar se jsPDF está instalado
- Tentar em outro navegador

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

## 📄 Licença

MIT
