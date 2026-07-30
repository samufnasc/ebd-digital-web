# Relatório de Desenvolvimento: Projeto EBD Digital

  **Status Atual:** Fase de Refatoração de Arquitetura (Transição para Modelo Histórico)

  **Data do Relatório:** 27/07/2026

  ## 1. Visão Geral do Problema
  O sistema original utilizava uma estrutura de dados estática onde o vínculo entre o
  **Aluno** e a **Classe** era único e direto. Isso impedia o registro histórico, pois se
   um aluno mudasse de classe, o registro anterior era perdido ou sobrescrito. Além
  disso, a gestão de chamadas era baseada apenas em contagem numérica de presença,
  impossibilitando a análise de evolução individual por período.

  ## 2. Ações Realizadas (Concluído)

  ### 🏗️ Camada de Banco de Dados (Supabase)
  Realizamos a migração da estrutura para suportar a temporalidade. Foram criadas as
  seguintes tabelas:
  * `aluno_vinculo_mensal`: Tabela de ligação que permite que um aluno pertença a uma
  classe em um mês/ano específico.
  * `registro_presenca_detalhado`: Tabela de registro individual de presença (quem esteve
   presente).

  ### 💻 Camada de Interface (Frontend)
  O componente `StudentManagement.jsx` foi refatorado para suportar a nova lógica de
  gestão temporal:
  * **Implementação de Seletor de Período:** Adicionados seletores de **Mês** e **Ano**
  na interface de Gestão de Alunos.
  * **Preparação para Contexto Temporal:** O componente agora mantém estados de
  `selectedMonth` e `selectedYear`, preparando o sistema para enviar o contexto de tempo
  correto para o backend.

  ---

  ## 🚀 Próximos Passos (Roadmap)

  ### Etapa 1: Implementação da Lógica de Vínculo (Backend & API)
  * **Atualização do `studentFunctions`**: Modificar a função `addStudent` e
  `updateStudent` para incluir o mês e ano.
  * **Integração com o Supabase**: Configurar o cliente para realizar o `upsert` na nova
  tabela `aluno_vinculo_mensal`.

  ### Etapa 2: Refatoração do Registro de Presença
  * **Migração de Lógica de Chamada**: Transformar o método de "contagem" para "lista de
  presenças individuais".
  * **Interface de Checkbox**: Implementar a seleção individual de alunos na tela de
  chamada.

  ### Etapa 3: Recuperação de Dados Históricos (Janeiro)
  * **Importação de Dados**: Implementar a lógica para carregar os dados de Janeiro.
  * **Migração de Dados Legados**: Converter os dados atuais do banco para o novo formato
   para garantir a continuidade do histórico.

  ---