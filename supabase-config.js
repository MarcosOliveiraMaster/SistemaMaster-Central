// Configuração pública do Supabase — projeto "NovaSelecao.MasterEdu".
// Mesma publishable key usada no formulário público (mastereducacao.app.br/entrevista):
// é segura para expor no client, o acesso real é controlado pelas policies de RLS.
// Usada por functions-agendamento-entrevistas.js (aba Dashboard > Professores >
// Agendamento de Entrevistas). Não tem relação com o Firebase (firebase-config.js).
const SUPABASE_URL = 'https://vsybmwxdztloqhcxxgaf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Nvxn7hOikYpvOjyNlrxwZA_gkh1PRvr';
