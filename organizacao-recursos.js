// organizacao-recursos.js — Área "Organização de recursos" (seção Planejamento)
//
// Versão em JS puro do protótipo GastoFlow (repositório prototipoAreaFinanceiro):
// simulações de caixa com saldo inicial e período, tabelas mensais de
// lançamentos, áreas de destino e análise por área. A tela ocupa a janela toda,
// com menu próprio, e o botão "Voltar à Central" devolve ao painel.
//
// Dados (Firestore):
//   organizacaoRecursos/{id}                — uma simulação por documento
//     { titulo, descricao (HTML restrito), saldoInicial, dataInicio, dataFim,
//       tabelas: [ { id, mes: 'AAAA-MM', lancamentos: [ { id, descricao, valor,
//                    data: 'AAAA-MM-DD', areaId, detalhes } ] } ],
//       criadoEm, criadoPor, atualizadoEm, atualizadoPor }
//   configuracoes/organizacaoRecursosAreas  — áreas de destino (comuns a todas)
//     { areas: [ { id, nome, icone } ], atualizadoEm, atualizadoPor }
//
// Cada edição é gravada pouco depois da última tecla (uma escrita por
// simulação); mudanças de outro administrador chegam em tempo real e só não
// sobrescrevem a simulação que está com gravação pendente aqui.
//
// Abertura: script.js chama OrganizacaoRecursos.abrir() ao entrar na seção.

(function () {
  'use strict';

  const COLECAO = 'organizacaoRecursos';
  const COLECAO_CONFIG = 'configuracoes';
  const DOC_AREAS = 'organizacaoRecursosAreas';
  const ATRASO_GRAVACAO = 800;
  const NOVO_MES = '__novo-mes__';

  // Ícones Lucide (mesmos do protótipo), embutidos para não depender de CDN
  const ICONES_SVG = {
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    'calendar-days': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'code2': '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    'circle-dollar-sign': '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
    'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    'briefcase-business': '<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'plus-circle': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    'settings2': '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    'sliders-horizontal': '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'edit3': '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    'grip-vertical': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'notebook-pen': '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'receipt-text': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'trash2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    'headphones': '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    'globe2': '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'home': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'landmark': '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    'stethoscope': '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    'coffee': '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
    'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    'menu': '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    'cloud': '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    'cloud-off': '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'calendar-plus': '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>'
  };

  // Chave guardada no banco → ícone Lucide
  const ICONE_AREA = {
    megaphone: 'megaphone', palette: 'palette', code: 'code2', briefcase: 'briefcase-business',
    users: 'users', settings: 'settings2', heart: 'heart', star: 'star', rocket: 'rocket',
    target: 'target', cart: 'shopping-cart', truck: 'truck', graduation: 'graduation-cap',
    headphones: 'headphones', camera: 'camera', globe: 'globe2', shield: 'shield-check',
    wrench: 'wrench', home: 'home', landmark: 'landmark', health: 'stethoscope', book: 'book-open',
    coffee: 'coffee', leaf: 'leaf', bulb: 'lightbulb', monitor: 'monitor'
  };
  const ICONES_AREA = Object.keys(ICONE_AREA);

  const AREAS_PADRAO = [
    { id: 'marketing', nome: 'Marketing', icone: 'megaphone' },
    { id: 'design', nome: 'Design', icone: 'palette' },
    { id: 'desenvolvimento', nome: 'Desenvolvimento', icone: 'code' },
    { id: 'operacoes', nome: 'Operações', icone: 'briefcase' }
  ];

  const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const fmtMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
  const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const NOMES_MESES = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, i, 1)));

  // ── Utilitários ──────────────────────────────────────────────────────────
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (v) => fmtMoeda.format(Number(v) || 0);
  const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

  function ic(nome, tamanho = 16, classe = '') {
    const corpo = ICONES_SVG[nome] || ICONES_SVG.settings2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${classe ? ` class="${classe}"` : ''} aria-hidden="true">${corpo}</svg>`;
  }
  const icArea = (icone, tamanho = 16) => ic(ICONE_AREA[icone] || 'settings2', tamanho);

  function uid(prefixo) { return `${prefixo}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`; }
  function parseMes(v) { const [a, m] = String(v).split('-').map(Number); return new Date(a, m - 1, 1); }
  function chaveMes(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function rotuloMes(v) { const r = fmtMes.format(parseMes(v)); return r.charAt(0).toUpperCase() + r.slice(1); }
  function rotuloMesCurto(v) { return fmtMesCurto.format(parseMes(v)).replace(' de ', '/'); }
  function hojeISO() { const d = new Date(); return `${chaveMes(d)}-${String(d.getDate()).padStart(2, '0')}`; }

  function mesesEntre(inicio, fim) {
    const a = new Date(`${inicio}T12:00:00`);
    const b = new Date(`${fim}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return [];
    const saida = [];
    const cursor = new Date(a.getFullYear(), a.getMonth(), 1);
    const limite = new Date(b.getFullYear(), b.getMonth(), 1);
    while (cursor <= limite && saida.length < 240) { saida.push(chaveMes(cursor)); cursor.setMonth(cursor.getMonth() + 1); }
    return saida;
  }

  function dataNoMes(mes, dia = 10) {
    const d = parseMes(mes);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  function moverLancamentoParaMes(l, mes) {
    const dia = Number(String(l.data || '').slice(-2)) || 10;
    const d = parseMes(mes);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { ...l, data: dataNoMes(mes, Math.min(dia, ultimo)) };
  }

  function fmtData(data) {
    if (!data) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${data}T12:00:00`));
  }

  function sanitizarDescricao(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const permitidas = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'DIV']);
    doc.body.querySelectorAll('*').forEach((no) => {
      if (!permitidas.has(no.tagName)) { no.replaceWith(...Array.from(no.childNodes)); return; }
      Array.from(no.attributes).forEach((a) => no.removeAttribute(a.name));
    });
    return doc.body.innerHTML.replace(/<p><\/p>/g, '');
  }
  function textoDescricao(html, max) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.body.querySelectorAll('p, div, li, br').forEach((n) => n.append(' '));
    return doc.body.textContent.replace(/\s+/g, ' ').trim().slice(0, max);
  }

  const somaTabela = (t) => t.lancamentos.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  function totais(sim) {
    return sim.tabelas.reduce((acc, t) => ({ gasto: acc.gasto + somaTabela(t), lancamentos: acc.lancamentos + t.lancamentos.length }), { gasto: 0, lancamentos: 0 });
  }

  function novaTabela(mes, lancamentos = []) { return { id: uid('tabela'), mes, lancamentos }; }
  function novoLancamento(mes, base = {}) {
    return {
      id: uid('lanc'),
      descricao: base.descricao ?? '',
      valor: base.valor ?? 0,
      data: base.data ?? dataNoMes(mes),
      areaId: base.areaId ?? (S.areas[0] ? S.areas[0].id : ''),
      detalhes: base.detalhes ?? ''
    };
  }

  function situacao(sim) {
    const hoje = hojeISO();
    if (sim.dataFim && hoje > sim.dataFim) return 'Encerrada';
    if (sim.dataInicio && hoje < sim.dataInicio) return 'Planejada';
    return 'Em andamento';
  }

  // Primeiro mês do período sem lançamentos; sem nenhum, o mês seguinte ao último.
  // Meses vazios ficam ocultos na tela, então é ali que um card novo deve cair.
  function mesLivre(sim, ignorarId) {
    const vazias = sim.tabelas.filter((t) => t.id !== ignorarId && t.lancamentos.length === 0).map((t) => t.mes).sort();
    if (vazias.length) return vazias[0];
    const ocupados = new Set(sim.tabelas.map((t) => t.mes));
    const ultimo = sim.tabelas.reduce((m, t) => (t.mes > m ? t.mes : m), '0000-00');
    const cursor = ultimo === '0000-00' ? new Date(`${sim.dataInicio || hojeISO()}T12:00:00`) : new Date(`${ultimo}-01T12:00:00`);
    if (ultimo !== '0000-00') cursor.setMonth(cursor.getMonth() + 1, 1);
    let proximo = chaveMes(cursor);
    while (ocupados.has(proximo)) { cursor.setMonth(cursor.getMonth() + 1); proximo = chaveMes(cursor); }
    return proximo;
  }

  // Coloca a tabela no mês, descartando a tabela vazia (oculta) que já estiver lá
  function tabelasComMes(sim, tabelaId, mes) {
    return sim.tabelas
      .filter((t) => t.id === tabelaId || t.mes !== mes)
      .map((t) => (t.id === tabelaId ? { ...t, mes, lancamentos: t.lancamentos.map((l) => moverLancamentoParaMes(l, mes)) } : t));
  }

  // ── Normalização (Firestore ↔ tela) ──────────────────────────────────────
  const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
  function normalizarSimulacao(id, d) {
    d = d || {};
    const tabelas = Array.isArray(d.tabelas) ? d.tabelas : [];
    const criado = d.criadoEm && typeof d.criadoEm.toMillis === 'function' ? d.criadoEm.toMillis() : 0;
    return {
      id,
      titulo: str(d.titulo, 120).trim() || 'Simulação sem título',
      descricao: str(d.descricao, 20000),
      saldoInicial: Number(d.saldoInicial) || 0,
      dataInicio: DATA_VALIDA.test(d.dataInicio) ? d.dataInicio : '',
      dataFim: DATA_VALIDA.test(d.dataFim) ? d.dataFim : '',
      criadoEmMs: criado,
      tabelas: tabelas.filter((t) => t && /^\d{4}-\d{2}$/.test(t.mes)).map((t) => ({
        id: str(t.id, 80) || uid('tabela'),
        mes: t.mes,
        lancamentos: (Array.isArray(t.lancamentos) ? t.lancamentos : []).filter((l) => l && typeof l === 'object').map((l) => ({
          id: str(l.id, 80) || uid('lanc'),
          descricao: str(l.descricao, 200),
          valor: Number(l.valor) || 0,
          data: DATA_VALIDA.test(l.data) ? l.data : dataNoMes(t.mes),
          areaId: str(l.areaId, 80),
          detalhes: str(l.detalhes, 20000)
        }))
      }))
    };
  }

  function serializarSimulacao(sim) {
    return {
      titulo: sim.titulo,
      descricao: sim.descricao,
      saldoInicial: Number(sim.saldoInicial) || 0,
      dataInicio: sim.dataInicio,
      dataFim: sim.dataFim,
      tabelas: sim.tabelas.map((t) => ({
        id: t.id,
        mes: t.mes,
        lancamentos: t.lancamentos.map((l) => ({
          id: l.id, descricao: l.descricao || '', valor: Number(l.valor) || 0,
          data: l.data || '', areaId: l.areaId || '', detalhes: l.detalhes || ''
        }))
      }))
    };
  }

  function normalizarAreas(lista) {
    if (!Array.isArray(lista) || lista.length === 0) return AREAS_PADRAO.map((a) => ({ ...a }));
    const vistas = new Set();
    const areas = lista.filter((a) => a && typeof a.id === 'string' && !vistas.has(a.id) && vistas.add(a.id)).map((a) => ({
      id: a.id.slice(0, 80),
      nome: str(a.nome, 60).trim() || 'Área',
      icone: ICONE_AREA[a.icone] ? a.icone : 'settings'
    }));
    return areas.length ? areas : AREAS_PADRAO.map((a) => ({ ...a }));
  }

  // ── Estado ───────────────────────────────────────────────────────────────
  const S = {
    simulacoes: [],
    areas: AREAS_PADRAO.map((a) => ({ ...a })),
    carregado: false,
    erro: null,
    tela: 'simulacoes',          // 'simulacoes' | 'painel'
    selecionadaId: null,
    busca: '',
    buscaTabelas: '',
    renomeandoId: null,
    renomeValor: '',
    menuAberto: false,           // menu lateral no celular
    mesAberto: null,             // { tabelaId, passo: 'mes'|'ano', rascunho: 'AAAA-MM' }
    areaAberta: null,            // id do lançamento com o seletor de área aberto
    arrastandoId: null,
    movidaId: null,
    modal: null,
    aviso: '',
    sync: 'ok'                   // 'ok' | 'salvando' | 'erro'
  };

  let raiz = null;
  let db = null;
  let pararSims = null;
  let pararAreas = null;
  let graficoSaldo = null;
  let graficoAnalise = null;
  let timerAviso = null;
  let renderPendente = false;
  const timers = new Map();     // id da simulação → gravação agendada
  const gravando = new Set();   // ids com escrita em andamento
  const falhas = new Set();     // ids cuja última gravação falhou

  const selecionada = () => S.simulacoes.find((s) => s.id === S.selecionadaId) || null;
  const usuario = () => (window.currentUser && window.currentUser.email) || ((firebase.auth().currentUser || {}).email) || '';
  const carimbo = () => firebase.firestore.FieldValue.serverTimestamp();
  const pendente = (id) => timers.has(id) || gravando.has(id);

  // ── Firestore ────────────────────────────────────────────────────────────
  function assinar() {
    pararSims = db.collection(COLECAO).onSnapshot((snap) => {
      const locais = new Map(S.simulacoes.map((s) => [s.id, s]));
      const lista = [];
      snap.forEach((doc) => {
        const local = locais.get(doc.id);
        if (local && (pendente(doc.id) || doc.metadata.hasPendingWrites)) { lista.push(local); return; }
        const sim = normalizarSimulacao(doc.id, doc.data({ serverTimestamps: 'estimate' }));
        lista.push(sim);
      });
      // Criadas aqui e ainda não refletidas no snapshot
      S.simulacoes.forEach((s) => { if (pendente(s.id) && !lista.some((x) => x.id === s.id)) lista.push(s); });
      lista.sort((a, b) => (b.criadoEmMs || Infinity) - (a.criadoEmMs || Infinity) || a.titulo.localeCompare(b.titulo));

      const mudou = !S.carregado || assinatura(lista) !== assinatura(S.simulacoes);
      S.simulacoes = lista;
      S.carregado = true;
      S.erro = null;
      if (S.tela === 'painel' && !selecionada()) {
        S.tela = 'simulacoes';
        S.selecionadaId = null;
        avisar('A simulação aberta foi apagada por outro administrador.');
      }
      if (mudou) renderSeguro();
    }, (err) => {
      console.error('[Organização de recursos] Erro ao ler simulações:', err);
      S.erro = err && err.code ? err.code : 'desconhecido';
      S.carregado = true;
      render();
    });

    pararAreas = db.collection(COLECAO_CONFIG).doc(DOC_AREAS).onSnapshot((doc) => {
      if (doc.metadata.hasPendingWrites) return;
      const areas = normalizarAreas(doc.exists ? doc.data().areas : null);
      if (JSON.stringify(areas) === JSON.stringify(S.areas)) return;
      S.areas = areas;
      renderSeguro();
      if (S.modal && S.modal.tipo === 'areas') renderModal();
    }, (err) => console.warn('[Organização de recursos] Usando áreas padrão:', err && (err.code || err.message)));
  }

  const assinatura = (lista) => JSON.stringify(lista.map((s) => [s.id, serializarSimulacao(s)]));

  function agendarGravacao(id) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => gravar(id), ATRASO_GRAVACAO));
    definirSync('salvando');
  }

  async function gravar(id, extras) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const sim = S.simulacoes.find((s) => s.id === id);
    if (!sim) return;
    gravando.add(id);
    definirSync('salvando');
    try {
      await db.collection(COLECAO).doc(id).set({
        ...serializarSimulacao(sim),
        ...(extras || {}),
        atualizadoEm: carimbo(),
        atualizadoPor: usuario()
      }, { merge: true });
      falhas.delete(id);
    } catch (err) {
      console.error('[Organização de recursos] Erro ao salvar:', err);
      falhas.add(id);
      avisar(mensagemErro(err, 'Não foi possível salvar a simulação.'));
    } finally {
      gravando.delete(id);
      definirSync();
    }
  }

  function criarNoBanco(sim) {
    return gravar(sim.id, { criadoEm: carimbo(), criadoPor: usuario() });
  }

  async function apagarNoBanco(id) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    falhas.delete(id);
    try {
      await db.collection(COLECAO).doc(id).delete();
    } catch (err) {
      console.error('[Organização de recursos] Erro ao apagar:', err);
      avisar(mensagemErro(err, 'Não foi possível apagar a simulação no banco.'));
    }
    definirSync();
  }

  async function gravarAreas() {
    definirSync('salvando');
    try {
      await db.collection(COLECAO_CONFIG).doc(DOC_AREAS).set({ areas: S.areas, atualizadoEm: carimbo(), atualizadoPor: usuario() });
    } catch (err) {
      console.error('[Organização de recursos] Erro ao salvar áreas:', err);
      avisar(mensagemErro(err, 'Não foi possível salvar as áreas.'));
    }
    definirSync();
  }

  function mensagemErro(err, padrao) {
    const codigo = err && err.code;
    if (codigo === 'permission-denied') return 'Sem permissão no Firestore para esta coleção. Verifique as regras de segurança.';
    if (codigo === 'resource-exhausted') return 'Cota do Firestore esgotada — tente mais tarde.';
    if (codigo === 'unavailable') return 'Sem conexão — a alteração será enviada quando a internet voltar.';
    return padrao;
  }

  function definirSync(forcado) {
    S.sync = forcado || (timers.size || gravando.size ? 'salvando' : falhas.size ? 'erro' : 'ok');
    const alvo = raiz && raiz.querySelector('[data-ref="sync"]');
    if (alvo) alvo.outerHTML = htmlSync();
  }

  function gravarPendencias() {
    Array.from(timers.keys()).forEach((id) => gravar(id));
  }

  function alterarSimulacao(sim) {
    S.simulacoes = S.simulacoes.map((s) => (s.id === sim.id ? sim : s));
    agendarGravacao(sim.id);
  }

  // ── Templates ────────────────────────────────────────────────────────────
  function htmlSync() {
    const rotulos = {
      ok: ['cloud', 'Salvo no banco de dados', ''],
      salvando: ['refresh-cw', 'Salvando alterações…', 'or-sync-salvando'],
      erro: ['cloud-off', 'Falha ao salvar — tentar de novo', 'or-sync-erro']
    };
    const [icone, texto, classe] = rotulos[S.sync] || rotulos.ok;
    const tag = S.sync === 'erro' ? 'button type="button" data-acao="tentar-sync"' : 'span';
    return `<${tag} class="or-sync ${classe}" data-ref="sync">${ic(icone, 11)} ${esc(texto)}</${tag.split(' ')[0]}>`;
  }

  function htmlMarca(compacta) {
    const logo = '<div class="brand-mark or-brand-master"><img src="img/logo2.png" alt="Logo Master Educação"></div>';
    return `<div class="brand">${logo}${compacta ? '<strong>Master <span>Educação</span></strong>' : '<div><strong>Master <span>Educação</span></strong><small>organização de recursos</small></div>'}</div>`;
  }

  function htmlLinhaSimulacao(item) {
    const ativo = S.selecionadaId === item.id ? ' active' : '';
    const conteudo = S.renomeandoId === item.id
      ? `<div class="nav-item simulation-nav"><input class="or-renomear" data-campo="renomear" maxlength="120" value="${esc(S.renomeValor)}" aria-label="Novo nome da simulação" /></div>`
      : `<button type="button" class="nav-item simulation-nav" data-acao="abrir-sim" data-id="${esc(item.id)}" title="${esc(item.titulo)} — clique duplo para renomear">${ic('clipboard-list', 15)}<span>${esc(item.titulo)}</span></button>`;
    return `<div class="simulation-nav-row${ativo}">${conteudo}<button type="button" class="simulation-delete" aria-label="Apagar ${esc(item.titulo)}" data-acao="pedir-apagar-sim" data-id="${esc(item.id)}">${ic('trash2', 14)}</button></div>`;
  }

  function htmlSidebar() {
    const email = usuario();
    const iniciais = (email.split('@')[0] || 'ME').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'ME';
    const linhas = S.simulacoes.map(htmlLinhaSimulacao).join('');

    return `<aside class="sidebar">
      ${htmlMarca(false)}
      <button type="button" class="or-voltar" data-acao="voltar-central" title="Voltar ao Painel Administrativo">${ic('arrow-left', 16)} Voltar à Central</button>
      <nav class="side-nav">
        <span class="nav-section-label">Workspace</span>
        <button type="button" class="nav-item ${S.tela === 'simulacoes' ? 'active' : ''}" data-acao="visao-geral">${ic('layout-dashboard', 18)} Visão geral</button>
        <button type="button" class="nav-item area-nav" data-acao="abrir-areas">${ic('plus-circle', 18)} Adicionar Área</button>
        <span class="nav-section-label simulation-nav-label">Simulações</span>
        ${linhas || '<span class="or-nav-vazio">Nenhuma simulação ainda</span>'}
      </nav>
      <div class="sidebar-bottom">
        <div class="tip-card">${ic('sparkles', 17)}<div><strong>Um passo de cada vez</strong><span>Clareza também é planejamento.</span></div></div>
        <div class="profile-chip"><div class="avatar">${esc(iniciais)}</div><div><strong title="${esc(email)}">${esc(email || 'Meu workspace')}</strong>${htmlSync()}</div></div>
      </div>
    </aside>`;
  }

  function htmlCabecalhoCelular() {
    return `<header class="mobile-header">
      <div class="or-mobile-acoes"><button type="button" class="icon-button" data-acao="voltar-central" aria-label="Voltar à Central" title="Voltar à Central">${ic('arrow-left', 20)}</button>${htmlMarca(true)}</div>
      <button type="button" class="icon-button" data-acao="abrir-menu" aria-label="Abrir menu">${ic('menu', 20)}</button>
    </header>`;
  }

  function htmlEstado(icone, titulo, texto, botao) {
    return `<div class="page-content"><div class="empty-state soft-card"><div class="empty-orbit">${ic(icone, 26)}</div><h2>${titulo}</h2><p>${texto}</p>${botao || ''}</div></div>`;
  }

  function htmlConteudo() {
    if (S.erro) {
      const semPermissao = S.erro === 'permission-denied';
      return htmlEstado('alert-triangle', semPermissao ? 'Acesso ao banco bloqueado' : 'Não foi possível carregar',
        semPermissao
          ? `As regras do Firestore não liberam a coleção <strong>${COLECAO}</strong> para este usuário. Libere-a para os administradores e tente de novo.`
          : 'Verifique a conexão com a internet e tente novamente.',
        `<button type="button" class="primary-button" data-acao="recarregar">${ic('refresh-cw', 16)} Tentar novamente</button>`);
    }
    if (!S.carregado) return htmlEstado('refresh-cw', 'Carregando simulações…', 'Buscando os dados no banco.', '');
    if (S.tela === 'simulacoes') return htmlLista();
    const sim = selecionada();
    return sim ? htmlPainel(sim) : htmlVazio();
  }

  function htmlVazio() {
    return `<div class="empty-state soft-card"><div class="empty-orbit">${ic('sparkles', 26)}</div><h2>Seu próximo plano começa aqui</h2><p>Crie uma simulação para visualizar o saldo, organizar seus meses e acompanhar cada lançamento.</p><button type="button" class="primary-button" data-acao="nova-sim">${ic('plus', 17)} Criar simulação</button></div>`;
  }

  function htmlLista() {
    const lancamentos = S.simulacoes.reduce((s, item) => s + totais(item).lancamentos, 0);
    return `<div class="page-content">
      <div class="page-heading"><div><span class="eyebrow">Planejamento · Master Educação</span><h1>Simulações</h1><p>Organize cenários, acompanhe o caixa e decida com mais clareza.</p></div><button type="button" class="primary-button" data-acao="nova-sim">${ic('plus', 17)} Nova simulação</button></div>
      <div class="overview-strip"><div><span class="overview-number">${S.simulacoes.length}</span><span class="overview-label">cenários ativos</span></div><div class="overview-accent-line"></div><div><span class="overview-number">${lancamentos}</span><span class="overview-label">lançamentos registrados</span></div><div class="overview-note">${ic('sparkles', 17)} <span>Pequenas decisões, grandes respiros.</span></div></div>
      <div class="list-toolbar"><div><h2>Todos os cenários</h2><span data-ref="qtd-sims"></span></div><label class="search-box">${ic('search', 16)}<input data-campo="busca-sim" value="${esc(S.busca)}" placeholder="Buscar simulação" /></label></div>
      <div data-ref="grade-sims">${htmlGradeSims()}</div>
    </div>`;
  }

  function simsFiltradas() {
    const q = S.busca.trim().toLocaleLowerCase('pt-BR');
    return S.simulacoes.filter((s) => s.titulo.toLocaleLowerCase('pt-BR').includes(q));
  }

  function htmlGradeSims() {
    const lista = simsFiltradas();
    if (lista.length === 0) return htmlVazio();
    return `<div class="simulation-grid">${lista.map((sim) => {
      const saldo = sim.saldoInicial - totais(sim).gasto;
      return `<button type="button" class="simulation-card soft-card" data-acao="abrir-sim" data-id="${esc(sim.id)}">
        <div class="simulation-card-top"><span class="scenario-mark">${ic('circle-dollar-sign', 19)}</span><span class="status-pill"><span></span> ${situacao(sim)}</span>${ic('more-horizontal', 19, 'muted-icon')}</div>
        <div class="simulation-card-body"><h3>${esc(sim.titulo)}</h3><p>${esc(textoDescricao(sim.descricao, 120))}</p><div class="simulation-date">${ic('calendar-days', 14)} ${fmtData(sim.dataInicio)} <span>—</span> ${fmtData(sim.dataFim)}</div></div>
        <div class="simulation-card-bottom"><div><span>Saldo projetado</span><strong>${moeda(saldo)}</strong></div>${ic('arrow-up-right', 18)}</div>
      </button>`;
    }).join('')}</div>`;
  }

  function tabelasOrdenadas(sim) { return [...sim.tabelas].sort((a, b) => a.mes.localeCompare(b.mes)); }

  function tabelasVisiveis(sim) {
    const comLancamentos = tabelasOrdenadas(sim).filter((t) => t.lancamentos.length > 0);
    const q = S.buscaTabelas.trim().toLocaleLowerCase('pt-BR');
    if (!q) return comLancamentos;
    return comLancamentos.filter((t) => rotuloMes(t.mes).toLocaleLowerCase('pt-BR').includes(q) || t.mes.includes(q)
      || t.lancamentos.some((l) => (l.descricao || '').toLocaleLowerCase('pt-BR').includes(q)));
  }

  function htmlPainel(sim) {
    const tot = totais(sim);
    const saldo = sim.saldoInicial - tot.gasto;
    return `<div class="page-content dashboard-page">
      <div class="breadcrumb-row"><button type="button" class="back-button" data-acao="visao-geral">${ic('arrow-left', 16)} Todas as simulações</button><div class="dashboard-actions"><button type="button" class="secondary-button compact" data-acao="analise">${ic('sliders-horizontal', 15)} Análise por área</button><button type="button" class="secondary-button compact" data-acao="editar-sim">${ic('edit3', 15)} Editar simulação</button><button type="button" class="primary-button compact" data-acao="nova-tabela">${ic('plus', 16)} Nova tabela</button></div></div>
      <div class="dashboard-title-row"><div><span class="eyebrow">Simulação ativa <span class="eyebrow-dot"></span></span><h1>${esc(sim.titulo)}</h1><div class="simulation-subline"><span>${ic('calendar-days', 14)} ${fmtData(sim.dataInicio)} — ${fmtData(sim.dataFim)}</span><span class="description-preview">${esc(textoDescricao(sim.descricao, 170))}</span></div></div><div class="balance-hero"><span>Saldo projetado</span><strong data-ref="saldo">${moeda(saldo)}</strong><small>${ic('trending-down', 14)} <span data-ref="saldo-detalhe">${tot.gasto > 0 ? `${moeda(tot.gasto)} em despesas acompanhadas` : 'Adicione sua primeira despesa'}</span></small></div></div>
      <div class="metrics-grid">
        ${htmlMetrica('circle-dollar-sign', 'Saldo inicial', moeda(sim.saldoInicial), 'neutral', 'valor recebido', '')}
        ${htmlMetrica('trending-down', 'Investimento', moeda(tot.gasto), 'negative', 'saídas acompanhadas', 'gasto')}
        ${htmlMetrica('receipt-text', 'Lançamentos', String(tot.lancamentos).padStart(2, '0'), 'neutral', 'em todas as tabelas', 'qtd')}
      </div>
      <section class="chart-card soft-card"><div class="section-heading"><div><span class="eyebrow">Visão acumulada</span><h2>Evolução do saldo</h2></div><div class="chart-legend"><span><i class="legend-line"></i> Saldo projetado</span><span><i class="legend-dot"></i> Atualizado agora</span></div></div><div class="chart-wrap"><canvas id="or-grafico-saldo" aria-label="Gráfico da evolução do saldo"></canvas></div><div class="chart-caption"><span><span class="caption-arrow">↗</span> Sua projeção parte de ${moeda(sim.saldoInicial)} e considera os lançamentos abaixo.</span><span>Arraste uma tabela pelo título para reorganizar os meses.</span></div></section>
      <section class="tables-section"><div class="tables-heading"><div><span class="eyebrow">Organização por período</span><h2>Meses da simulação</h2><p>Acompanhe apenas os meses cadastrados e filtre por descrição, mês ou ano.</p></div><div class="tables-tools"><label class="table-filter">${ic('search', 15)}<input data-campo="busca-tabelas" value="${esc(S.buscaTabelas)}" placeholder="Descrição, mês ou ano" /></label><button type="button" class="text-button" data-acao="nova-tabela">${ic('plus', 16)} Adicionar tabela</button></div></div><div class="tables-scroller"><div class="monthly-grid" data-ref="grade-tabelas">${htmlGradeTabelas(sim)}</div></div></section>
    </div>`;
  }

  function htmlMetrica(icone, rotulo, valor, tom, detalhe, ref) {
    return `<div class="metric-card metric-${tom}"><div class="metric-topline"><span class="metric-icon">${ic(icone, 18)}</span><span class="metric-label">${rotulo}</span></div><strong${ref ? ` data-ref="${ref}"` : ''}>${valor}</strong><span class="metric-detail">${detalhe}</span></div>`;
  }

  function htmlGradeTabelas(sim) {
    const tabelas = tabelasVisiveis(sim);
    const vazio = tabelas.length === 0
      ? `<div class="filtered-empty">${S.buscaTabelas.trim() ? 'Nenhum mês cadastrado encontrado para este filtro.' : 'Nenhum mês com lançamentos ainda. Use “Nova tabela” para começar.'}</div>`
      : '';
    return tabelas.map((t) => htmlCartao(sim, t)).join('') + vazio
      + `<div class="or-mes-livre" data-alvo="${NOVO_MES}">${ic('calendar-plus', 22)}<span>Solte aqui para mover ao<br>próximo mês livre</span></div>`;
  }

  function htmlCartao(sim, t) {
    const qtd = t.lancamentos.length;
    const picker = S.mesAberto && S.mesAberto.tabelaId === t.id ? htmlSeletorMes(sim) : '';
    const linhas = t.lancamentos.map((l) => `<tr>
      <td><div class="description-field"><input class="description-cell" data-campo="descricao" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}" value="${esc(l.descricao)}" maxlength="200" placeholder="Nome da despesa" /><button type="button" class="details-button ${l.detalhes && textoDescricao(l.detalhes, 1) ? 'has-details' : ''}" aria-label="Abrir detalhes" title="Anotações" data-acao="detalhes" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}">${ic('notebook-pen', 14)}</button></div></td>
      <td><div class="money-input"><span>R$</span><input type="number" min="0" step="0.01" data-campo="valor" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}" value="${l.valor || ''}" placeholder="0,00" /></div></td>
      <td><input class="date-cell" type="date" data-campo="data" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}" value="${esc(l.data)}" /></td>
      <td>${htmlSeletorArea(t, l)}</td>
      <td><button type="button" class="delete-row" aria-label="Excluir lançamento" data-acao="apagar-lanc" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}">${ic('trash2', 14)}</button></td>
    </tr>`).join('');
    const movida = S.movidaId === t.id ? ' just-moved' : '';
    return `<div class="monthly-card${movida}" data-tabela="${esc(t.id)}">
      <div class="monthly-heading" title="Arraste para mover este mês"><div class="monthly-title">${ic('grip-vertical', 17, 'drag-icon')}<div><h3>${rotuloMes(t.mes)}</h3><span data-ref="qtd-${esc(t.id)}">${qtd} lançamento${qtd === 1 ? '' : 's'}</span></div></div><div class="monthly-actions"><button type="button" class="icon-button subtle" aria-label="Editar mês e ano" data-acao="abrir-mes" data-tabela="${esc(t.id)}">${ic('pencil', 15)}</button><button type="button" class="icon-button subtle monthly-delete-button" aria-label="Apagar card mensal" data-acao="apagar-tabela" data-tabela="${esc(t.id)}">${ic('trash2', 15)}</button>${picker}</div></div>
      <div class="monthly-summary"><span><i class="dot dot-expense"></i> <span data-ref="soma-${esc(t.id)}">${moeda(somaTabela(t))} em saídas</span></span><span>${qtd} ${qtd === 1 ? 'item' : 'itens'}</span></div>
      <div class="entry-table-wrap"><table class="entry-table sem-cartao"><thead><tr><th>Descrição</th><th>Investimento</th><th>Data</th><th>Área de destino</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
      <button type="button" class="add-entry-button" data-acao="add-lanc" data-tabela="${esc(t.id)}">${ic('plus', 15)} Adicionar lançamento</button>
    </div>`;
  }

  function htmlSeletorArea(t, l) {
    const area = S.areas.find((a) => a.id === l.areaId);
    const aberto = S.areaAberta === l.id;
    const menu = aberto ? `<div class="area-menu"><div class="area-menu-title">Área de destino</div>${S.areas.map((a) => `<button type="button" title="${esc(a.nome)}" data-acao="area-escolher" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}" data-area="${esc(a.id)}"><span class="area-icon">${icArea(a.icone, 14)}</span>${esc(a.nome)}</button>`).join('')}<button type="button" class="area-add" data-acao="abrir-areas" data-tabela="${esc(t.id)}">${ic('plus', 13)} Adicionar área</button></div>` : '';
    return `<div class="area-picker"><button type="button" class="area-trigger${area ? '' : ' or-sem-area'}" data-acao="area-abrir" data-tabela="${esc(t.id)}" data-lanc="${esc(l.id)}" title="${esc(area ? area.nome : 'Área removida — escolha outra')}"><span class="area-icon">${icArea(area ? area.icone : 'settings', 13)}</span><span>${esc(area ? area.nome : 'Sem área')}</span>${ic('chevron-down', 12)}</button>${menu}</div>`;
  }

  function anosSeletor(sim, ano) {
    const atual = new Date().getFullYear();
    const inicio = sim.dataInicio ? Number(sim.dataInicio.slice(0, 4)) : atual;
    const fim = sim.dataFim ? Number(sim.dataFim.slice(0, 4)) : atual;
    const de = Math.min(inicio, ano, atual) - 1;
    const ate = Math.max(fim, ano, atual) + 3;
    return Array.from({ length: Math.min(ate - de + 1, 15) }, (_, i) => de + i);
  }

  function htmlSeletorMes(sim) {
    const { passo, rascunho } = S.mesAberto;
    const d = parseMes(rascunho);
    const corpo = passo === 'mes'
      ? `<div class="picker-label">Escolha o mês</div><div class="picker-month-list">${NOMES_MESES.map((m, i) => `<button type="button" class="${i === d.getMonth() ? 'selected' : ''}" data-acao="mes-escolher" data-indice="${i}">${m}</button>`).join('')}</div>`
      : `<div class="picker-label">Escolha o ano</div><div class="picker-year-list">${anosSeletor(sim, d.getFullYear()).map((a) => `<button type="button" class="${a === d.getFullYear() ? 'selected' : ''}" data-acao="ano-escolher" data-ano="${a}">${a}</button>`).join('')}</div>`;
    return `<div class="month-picker"><div class="month-picker-title"><button type="button" data-acao="mes-passo" class="${passo === 'mes' ? 'selected' : ''}">${NOMES_MESES[d.getMonth()]} de ${d.getFullYear()}</button>${ic('chevron-down', 14)}</div><div class="picker-panel picker-panel-${passo === 'mes' ? 'month' : 'year'}">${corpo}</div><button type="button" class="picker-cancel" data-acao="mes-cancelar">Cancelar</button></div>`;
  }

  // ── Modais ───────────────────────────────────────────────────────────────
  function htmlEditor(valor, dica) {
    return `<div class="editor-shell"><div class="editor-toolbar"><button type="button" class="editor-tool" aria-label="Negrito" data-comando="bold"><strong>B</strong></button><button type="button" class="editor-tool" aria-label="Itálico" data-comando="italic"><em>I</em></button><button type="button" class="editor-tool" aria-label="Lista" data-comando="insertUnorderedList"><span>☷</span></button><span class="editor-divider"></span><span class="editor-hint">${dica}</span></div><div class="editor-content" contenteditable="true" role="textbox" aria-multiline="true" tabindex="0" data-campo="editor">${sanitizarDescricao(valor)}</div></div>`;
  }

  function htmlModalSimulacao(m) {
    const f = m.form;
    const editar = m.tipo === 'editar';
    return `<div class="modal-backdrop" data-fundo="1"><form class="modal-card" data-form="simulacao" novalidate>
      <div class="modal-heading"><div><span class="eyebrow">${editar ? 'Ajustar cenário' : 'Novo cenário'}</span><h2>${editar ? 'Editar simulação' : 'Criar simulação'}</h2></div><button type="button" class="icon-button" data-acao="fechar-modal" aria-label="Fechar">${ic('x', 19)}</button></div>
      <div class="form-grid">
        <label class="field field-full"><span>Título</span><input data-campo="form-titulo" data-foco="1" maxlength="120" value="${esc(f.titulo)}" placeholder="Ex.: Expansão da loja" /></label>
        <div class="field field-full"><span>Descrição</span>${htmlEditor(f.descricao, 'Use o espaço para detalhar a simulação')}</div>
        <label class="field"><span>Saldo inicial (R$)</span><div class="input-prefix"><span>R$</span><input type="number" min="0" step="0.01" data-campo="form-saldo" value="${esc(f.saldoInicial)}" placeholder="0,00" /></div></label>
        <div class="field"><span>Período da simulação</span><div class="date-range"><label>${ic('calendar-days', 15)}<input type="date" data-campo="form-inicio" value="${esc(f.dataInicio)}" /></label><span>até</span><label>${ic('calendar-days', 15)}<input type="date" data-campo="form-fim" value="${esc(f.dataFim)}" /></label></div></div>
      </div>
      <div class="form-error" data-ref="erro-form"${m.erro ? '' : ' hidden'}>${esc(m.erro || '')}</div>
      <div class="gf-modal-footer"><button type="button" class="secondary-button" data-acao="fechar-modal">Cancelar</button><button type="submit" class="primary-button">${ic(editar ? 'check' : 'plus', 16)} ${editar ? 'Salvar alterações' : 'Criar simulação'}</button></div>
    </form></div>`;
  }

  function htmlModalDetalhes(m) {
    return `<div class="modal-backdrop" data-fundo="1"><div class="details-modal modal-card"><div class="modal-heading"><div><span class="eyebrow">Anotações do lançamento</span><h2>Detalhes</h2><p class="details-subtitle">${esc(m.titulo || 'Lançamento sem descrição')}</p></div><button type="button" class="icon-button" data-acao="fechar-modal" aria-label="Fechar">${ic('x', 19)}</button></div><div class="details-editor">${htmlEditor(m.valor, 'Use o espaço para detalhar o lançamento')}</div><div class="gf-modal-footer"><button type="button" class="secondary-button" data-acao="fechar-modal">Cancelar</button><button type="button" class="primary-button" data-acao="salvar-detalhes">${ic('check', 15)} Salvar detalhes</button></div></div></div>`;
  }

  function htmlModalAreas(m) {
    const padrao = new Set(AREAS_PADRAO.map((a) => a.id));
    return `<div class="modal-backdrop" data-fundo="1"><div class="area-manager modal-card"><div class="modal-heading"><div><span class="eyebrow">Workspace global</span><h2>Áreas de destino</h2></div><button type="button" class="icon-button" data-acao="fechar-modal" aria-label="Fechar">${ic('x', 19)}</button></div>
      <p class="modal-copy">As áreas ficam disponíveis em todas as simulações.</p>
      <form class="area-form" data-form="area"><input data-campo="area-nome" data-foco="1" maxlength="60" value="${esc(m.nome)}" placeholder="Nome da área" /><div class="icon-choice-row">${ICONES_AREA.map((i) => `<button type="button" class="${m.icone === i ? 'selected' : ''}" data-acao="area-icone" data-icone="${i}" title="${i}">${icArea(i)}</button>`).join('')}</div><button type="submit" class="primary-button">${m.editandoId ? 'Salvar área' : 'Adicionar área'}</button>${m.editandoId ? '<button type="button" class="secondary-button" data-acao="area-cancelar-edicao">Cancelar edição</button>' : ''}</form>
      <div class="area-list">${S.areas.map((a) => `<div class="area-list-row"><span class="area-icon">${icArea(a.icone)}</span><strong>${esc(a.nome)}</strong><button type="button" class="icon-button" aria-label="Editar ${esc(a.nome)}" data-acao="area-editar" data-area="${esc(a.id)}">${ic('pencil', 14)}</button>${padrao.has(a.id) ? '' : `<button type="button" class="icon-button danger" aria-label="Remover ${esc(a.nome)}" data-acao="area-apagar" data-area="${esc(a.id)}">${ic('trash2', 14)}</button>`}</div>`).join('')}</div>
    </div></div>`;
  }

  // Linhas da análise: uma por lançamento com valor, agrupadas pela área
  // (lançamentos de área removida entram em "Sem área" em vez de sumir).
  function dadosAnalise(sim) {
    const porId = new Map(S.areas.map((a) => [a.id, a]));
    const semArea = { id: '__sem-area__', nome: 'Sem área', icone: 'settings' };
    const linhas = [];
    sim.tabelas.forEach((t) => t.lancamentos.forEach((l) => {
      if (!(Number(l.valor) > 0)) return;
      linhas.push({ ...l, area: porId.get(l.areaId) || semArea });
    }));
    const grupos = new Map();
    linhas.forEach((l) => {
      const g = grupos.get(l.area.id) || { ...l.area, valor: 0 };
      g.valor += Number(l.valor) || 0;
      grupos.set(l.area.id, g);
    });
    return { linhas, grupos: Array.from(grupos.values()) };
  }

  function htmlModalAnalise(m, sim) {
    const { linhas, grupos } = dadosAnalise(sim);
    const ordenadas = [...linhas].sort((a, b) => (m.ordem === 'nome'
      ? (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
      : m.ordem === 'area' ? a.area.nome.localeCompare(b.area.nome, 'pt-BR') || b.valor - a.valor : b.valor - a.valor));
    return `<div class="modal-backdrop" data-fundo="1"><div class="analysis-modal"><div class="analysis-header"><div><span class="eyebrow">Leitura da simulação</span><h2>Análise de investimento por área</h2></div><button type="button" class="icon-button" data-acao="fechar-modal" aria-label="Fechar">${ic('x', 20)}</button></div>
      <div class="analysis-body"><div class="analysis-visual"><div class="analysis-tabs"><button type="button" class="${m.modo === 'radar' ? 'active' : ''}" data-acao="analise-modo" data-modo="radar">Radar</button><button type="button" class="${m.modo === 'barras' ? 'active' : ''}" data-acao="analise-modo" data-modo="barras">Barras</button></div><div class="analysis-chart"><canvas id="or-grafico-analise"></canvas></div><div class="analysis-areas">${grupos.map((g) => `<span><span class="area-icon">${icArea(g.icone, 13)}</span>${esc(g.nome)}</span>`).join('')}</div></div>
      <div class="analysis-table-panel"><div class="analysis-table-top"><div><span class="eyebrow">Detalhamento</span><strong>Saídas registradas</strong></div><select data-campo="analise-ordem"><option value="valor"${m.ordem === 'valor' ? ' selected' : ''}>Ordenar por valor</option><option value="nome"${m.ordem === 'nome' ? ' selected' : ''}>Ordenar por nome</option><option value="area"${m.ordem === 'area' ? ' selected' : ''}>Ordenar por área</option></select></div>
      <div class="analysis-table"><div class="analysis-row analysis-head"><span>Descrição</span><span>Valor</span><span>Área</span></div>${ordenadas.map((l) => `<div class="analysis-row"><span>${esc(l.descricao || 'Sem descrição')}</span><strong>${moeda(l.valor)}</strong><span class="area-name">${icArea(l.area.icone, 12)} ${esc(l.area.nome)}</span></div>`).join('')}${ordenadas.length === 0 ? '<div class="analysis-empty">Ainda não há saídas destinadas a uma área.</div>' : ''}</div></div></div>
    </div></div>`;
  }

  function htmlConfirmacao(titulo, texto, rotulo, acao) {
    return `<div class="modal-backdrop" data-fundo="1"><div class="delete-confirm modal-card"><div class="delete-confirm-icon">${ic('trash2', 24)}</div><h2>${titulo}</h2><p>${texto}</p><div class="delete-confirm-actions"><button type="button" class="secondary-button" data-acao="fechar-modal">Cancelar</button><button type="button" class="danger-button" data-acao="${acao}">${ic('trash2', 15)} ${rotulo}</button></div></div></div>`;
  }

  function htmlModal() {
    const m = S.modal;
    if (!m) return '';
    const sim = selecionada();
    switch (m.tipo) {
      case 'criar': case 'editar': return htmlModalSimulacao(m);
      case 'detalhes': return htmlModalDetalhes(m);
      case 'areas': return htmlModalAreas(m);
      case 'analise': return sim ? htmlModalAnalise(m, sim) : '';
      case 'apagar-tabela': return htmlConfirmacao('Apagar card mensal?', 'O mês e todos os lançamentos deste card serão removidos da simulação.', 'Apagar card', 'confirmar-apagar-tabela');
      case 'apagar-sim': {
        const alvo = S.simulacoes.find((s) => s.id === m.id);
        return alvo ? htmlConfirmacao('Apagar simulação?', `“${esc(alvo.titulo)}” e todos os seus meses e lançamentos serão removidos do banco de dados para todos os administradores.`, 'Apagar definitivamente', 'confirmar-apagar-sim') : '';
      }
      default: return '';
    }
  }

  // ── Renderização ─────────────────────────────────────────────────────────
  function render() {
    if (!raiz) return;
    renderPendente = false;
    const topo = raiz.scrollTop;
    destruirGrafico('saldo');
    raiz.querySelector('.or-shell').innerHTML = `<div class="app-shell${S.menuAberto ? ' or-menu-aberto' : ''}">${htmlSidebar()}<div class="or-sidebar-fundo" data-acao="fechar-menu"></div><main class="main-area">${htmlCabecalhoCelular()}${htmlConteudo()}</main></div>`;
    raiz.scrollTop = topo;
    atualizarContagemSims();
    const sim = selecionada();
    if (S.tela === 'painel' && sim) criarGraficoSaldo(sim);
    const renomear = raiz.querySelector('.or-renomear');
    if (renomear) { renomear.focus(); renomear.select(); }
  }

  // Mudança vinda do banco: não re-renderiza por baixo de quem está digitando
  function renderSeguro() {
    if (S.arrastandoId) { renderPendente = true; return; }
    const ativo = document.activeElement;
    if (raiz && ativo && raiz.contains(ativo) && (ativo.matches('input, select, textarea') || ativo.isContentEditable)) {
      renderPendente = true;
      return;
    }
    render();
  }

  function renderModal() {
    if (!raiz) return;
    destruirGrafico('analise');
    const host = raiz.querySelector('.or-modais');
    host.innerHTML = htmlModal();
    if (!S.modal) return;
    if (S.modal.tipo === 'analise') { const sim = selecionada(); if (sim) criarGraficoAnalise(sim); }
    const foco = host.querySelector('[data-foco]') || (S.modal.tipo === 'detalhes' ? host.querySelector('.editor-content') : null);
    if (foco && S.modal.focar !== false) { foco.focus(); S.modal.focar = false; }
  }

  function renderCartao(tabelaId) {
    const sim = selecionada();
    const tabela = sim && sim.tabelas.find((t) => t.id === tabelaId);
    const atual = raiz && raiz.querySelector(`.monthly-card[data-tabela="${CSS.escape(tabelaId)}"]`);
    if (!atual) return;
    if (!tabela || tabela.lancamentos.length === 0 || !tabelasVisiveis(sim).includes(tabela)) { renderGradeTabelas(); return; }
    atual.outerHTML = htmlCartao(sim, tabela);
  }

  function renderGradeTabelas() {
    const sim = selecionada();
    const grade = raiz && raiz.querySelector('[data-ref="grade-tabelas"]');
    if (sim && grade) grade.innerHTML = htmlGradeTabelas(sim);
  }

  function atualizarContagemSims() {
    const alvo = raiz && raiz.querySelector('[data-ref="qtd-sims"]');
    if (!alvo) return;
    const n = simsFiltradas().length;
    alvo.textContent = `${n} resultado${n === 1 ? '' : 's'}`;
  }

  function definirRef(ref, texto) {
    const alvo = raiz && raiz.querySelector(`[data-ref="${CSS.escape(ref)}"]`);
    if (alvo) alvo.textContent = texto;
  }

  // Valores que dependem dos lançamentos, sem redesenhar os campos em edição
  function atualizarDerivados() {
    const sim = selecionada();
    if (!sim || !raiz) return;
    const tot = totais(sim);
    definirRef('saldo', moeda(sim.saldoInicial - tot.gasto));
    definirRef('saldo-detalhe', tot.gasto > 0 ? `${moeda(tot.gasto)} em despesas acompanhadas` : 'Adicione sua primeira despesa');
    definirRef('gasto', moeda(tot.gasto));
    definirRef('qtd', String(tot.lancamentos).padStart(2, '0'));
    sim.tabelas.forEach((t) => definirRef(`soma-${t.id}`, `${moeda(somaTabela(t))} em saídas`));
    if (graficoSaldo) {
      const { rotulos, valores } = dadosGrafico(sim);
      graficoSaldo.data.labels = rotulos;
      graficoSaldo.data.datasets[0].data = valores;
      graficoSaldo.update('none');
    }
  }

  function avisar(texto) {
    S.aviso = texto;
    clearTimeout(timerAviso);
    const host = raiz && raiz.querySelector('.or-avisos');
    if (host) host.innerHTML = texto ? `<div class="gf-toast" role="status">${ic('check', 16)} ${esc(texto)}</div>` : '';
    if (texto) timerAviso = setTimeout(() => avisar(''), 3200);
  }

  // ── Gráficos (Chart.js, já carregado pelo index.html) ────────────────────
  const eixoMoeda = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `R$ ${Math.round(v)}`);

  function dadosGrafico(sim) {
    let acumulado = sim.saldoInicial;
    const rotulos = ['Início'];
    const valores = [acumulado];
    tabelasOrdenadas(sim).forEach((t) => {
      acumulado -= somaTabela(t);
      rotulos.push(rotuloMesCurto(t.mes));
      valores.push(acumulado);
    });
    return { rotulos, valores };
  }

  function tooltipSaldo(contexto) {
    const { chart, tooltip } = contexto;
    const wrap = chart.canvas.parentNode;
    let tip = wrap.querySelector('.chart-tooltip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tooltip or-chart-tooltip'; wrap.appendChild(tip); }
    if (tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) { tip.style.opacity = '0'; return; }
    const p = tooltip.dataPoints[0];
    tip.innerHTML = `<span>${esc(p.label)}</span><strong>${moeda(p.raw)}</strong>`;
    tip.style.opacity = '1';
    const x = Math.min(Math.max(tooltip.caretX + 12, 0), wrap.clientWidth - tip.offsetWidth);
    tip.style.left = `${x}px`;
    tip.style.top = `${Math.max(tooltip.caretY - tip.offsetHeight - 10, 0)}px`;
  }

  function criarGraficoSaldo(sim) {
    const canvas = raiz.querySelector('#or-grafico-saldo');
    if (!canvas || typeof Chart === 'undefined') return;
    const { rotulos, valores } = dadosGrafico(sim);
    graficoSaldo = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: rotulos,
        datasets: [{
          data: valores,
          borderColor: '#ef741d',
          borderWidth: 3,
          cubicInterpolationMode: 'monotone',
          fill: true,
          backgroundColor: (c) => {
            const area = c.chart.chartArea;
            if (!area) return 'rgba(244,123,32,.12)';
            const g = c.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, 'rgba(244,123,32,.24)');
            g.addColorStop(1, 'rgba(244,123,32,.015)');
            return g;
          },
          pointRadius: 4,
          pointBackgroundColor: '#fffaf5',
          pointBorderColor: '#ef741d',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#ef741d',
          pointHoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 14, right: 4 } },
        plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { enabled: false, external: tooltipSaldo } },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { color: '#9b9389', font: { size: 11 }, padding: 9 } },
          y: { grid: { color: '#ebe6df', borderDash: [4, 5], drawBorder: false }, ticks: { color: '#9b9389', font: { size: 11 }, callback: eixoMoeda, maxTicksLimit: 6 } }
        }
      }
    });
  }

  function criarGraficoAnalise(sim) {
    const canvas = raiz.querySelector('#or-grafico-analise');
    if (!canvas || typeof Chart === 'undefined') return;
    const { grupos } = dadosAnalise(sim);
    const radar = S.modal.modo === 'radar';
    const comum = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { callbacks: { label: (c) => moeda(c.raw) } } }
    };
    graficoAnalise = new Chart(canvas.getContext('2d'), radar ? {
      type: 'radar',
      data: { labels: grupos.map((g) => g.nome), datasets: [{ data: grupos.map((g) => g.valor), borderColor: '#f47b20', backgroundColor: 'rgba(244,123,32,.26)', pointBackgroundColor: '#f47b20', borderWidth: 2 }] },
      options: { ...comum, scales: { r: { beginAtZero: true, grid: { color: '#eadfd4' }, angleLines: { color: '#eadfd4' }, pointLabels: { color: '#85786d', font: { size: 10 } }, ticks: { color: '#b2a69b', font: { size: 9 }, backdropColor: 'transparent', callback: eixoMoeda, maxTicksLimit: 5 } } } }
    } : {
      type: 'bar',
      data: { labels: grupos.map((g) => g.nome), datasets: [{ data: grupos.map((g) => g.valor), backgroundColor: '#f47b20', borderRadius: 7, maxBarThickness: 56 }] },
      options: { ...comum, scales: { x: { grid: { display: false }, ticks: { color: '#85786d', font: { size: 9 } } }, y: { beginAtZero: true, grid: { color: '#eadfd4', drawBorder: false }, ticks: { color: '#b2a69b', font: { size: 9 }, callback: eixoMoeda } } } }
    });
  }

  function destruirGrafico(qual) {
    if (qual === 'saldo' && graficoSaldo) { graficoSaldo.destroy(); graficoSaldo = null; }
    if (qual === 'analise' && graficoAnalise) { graficoAnalise.destroy(); graficoAnalise = null; }
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  function abrirSimulacao(id) {
    S.selecionadaId = id;
    S.tela = 'painel';
    S.buscaTabelas = '';
    S.mesAberto = null;
    S.areaAberta = null;
    S.menuAberto = false;
    render();
    raiz.scrollTop = 0;
  }

  function irParaLista() {
    S.selecionadaId = null;
    S.tela = 'simulacoes';
    S.menuAberto = false;
    render();
  }

  function abrirModalSimulacao(tipo) {
    const sim = tipo === 'editar' ? selecionada() : null;
    const ano = new Date().getFullYear();
    S.modal = {
      tipo,
      erro: '',
      form: sim
        ? { titulo: sim.titulo, descricao: sim.descricao || '<p></p>', saldoInicial: String(sim.saldoInicial ?? ''), dataInicio: sim.dataInicio, dataFim: sim.dataFim }
        : { titulo: '', descricao: '<p></p>', saldoInicial: '', dataInicio: `${ano}-01-01`, dataFim: `${ano}-06-30` }
    };
    renderModal();
  }

  function salvarModalSimulacao() {
    const m = S.modal;
    const f = m.form;
    const erro = !f.titulo.trim() ? 'Dê um título para a simulação.'
      : (!f.dataInicio || !f.dataFim || f.dataInicio > f.dataFim) ? 'Escolha um período válido.'
      : mesesEntre(f.dataInicio, f.dataFim).length > 120 ? 'Use um período de até 10 anos.' : '';
    if (erro) {
      m.erro = erro;
      const alvo = raiz.querySelector('[data-ref="erro-form"]');
      if (alvo) { alvo.textContent = erro; alvo.hidden = false; }
      return;
    }
    const valores = { titulo: f.titulo.trim(), descricao: sanitizarDescricao(f.descricao), saldoInicial: Number(f.saldoInicial) || 0, dataInicio: f.dataInicio, dataFim: f.dataFim };

    if (m.tipo === 'criar') {
      const sim = { id: uid('sim'), ...valores, criadoEmMs: Date.now(), tabelas: mesesEntre(valores.dataInicio, valores.dataFim).map((mes) => novaTabela(mes)) };
      S.simulacoes = [sim, ...S.simulacoes];
      S.modal = null;
      renderModal();
      criarNoBanco(sim);
      abrirSimulacao(sim.id);
      return;
    }

    // Editar: o período define os meses; meses com lançamentos fora dele são
    // mantidos (o protótipo os apagava sem aviso).
    const sim = selecionada();
    if (!sim) { S.modal = null; renderModal(); return; }
    const permitidos = mesesEntre(valores.dataInicio, valores.dataFim);
    const porMes = new Map(sim.tabelas.map((t) => [t.mes, t]));
    const tabelas = permitidos.map((mes) => porMes.get(mes) || novaTabela(mes));
    const fora = sim.tabelas.filter((t) => !permitidos.includes(t.mes) && t.lancamentos.length > 0);
    alterarSimulacao({ ...sim, ...valores, tabelas: [...tabelas, ...fora] });
    S.modal = null;
    renderModal();
    render();
    if (fora.length) avisar(`${fora.length} ${fora.length === 1 ? 'mês com lançamentos ficou' : 'meses com lançamentos ficaram'} fora do novo período e ${fora.length === 1 ? 'foi mantido' : 'foram mantidos'}.`);
  }

  function atualizarTabela(tabelaId, fn) {
    const sim = selecionada();
    if (!sim) return null;
    const novo = { ...sim, tabelas: sim.tabelas.map((t) => (t.id === tabelaId ? fn(t) : t)) };
    alterarSimulacao(novo);
    return novo;
  }

  function alterarLancamento(tabelaId, lancId, campo, valor) {
    atualizarTabela(tabelaId, (t) => ({ ...t, lancamentos: t.lancamentos.map((l) => (l.id === lancId ? { ...l, [campo]: valor } : l)) }));
  }

  function novaTabelaNaSimulacao() {
    const sim = selecionada();
    if (!sim) return;
    const mes = mesLivre(sim);
    const existente = sim.tabelas.find((t) => t.mes === mes);
    const tabelas = existente
      ? sim.tabelas.map((t) => (t.id === existente.id ? { ...t, lancamentos: [novoLancamento(mes)] } : t))
      : [...sim.tabelas, novaTabela(mes, [novoLancamento(mes)])];
    alterarSimulacao({ ...sim, tabelas });
    S.buscaTabelas = '';
    render();
    avisar(`Tabela de ${rotuloMes(mes)} adicionada com um lançamento pronto para editar.`);
    const id = existente ? existente.id : tabelas[tabelas.length - 1].id;
    const card = raiz.querySelector(`.monthly-card[data-tabela="${CSS.escape(id)}"]`);
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const campo = card.querySelector('.description-cell'); if (campo) campo.focus({ preventScroll: true }); }
  }

  function editarMes(tabelaId, mes) {
    const sim = selecionada();
    if (!sim) return false;
    if (sim.tabelas.some((t) => t.id !== tabelaId && t.mes === mes && t.lancamentos.length > 0)) {
      avisar(`${rotuloMes(mes)} já possui um card cadastrado.`);
      return false;
    }
    alterarSimulacao({ ...sim, tabelas: tabelasComMes(sim, tabelaId, mes) });
    avisar(`Card atualizado para ${rotuloMes(mes)}.`);
    return true;
  }

  function moverParaMesLivre(tabelaId) {
    const sim = selecionada();
    const origem = sim && sim.tabelas.find((t) => t.id === tabelaId);
    if (!origem) return;
    const destino = mesLivre(sim, tabelaId);
    alterarSimulacao({ ...sim, tabelas: tabelasComMes(sim, tabelaId, destino) });
    S.movidaId = tabelaId;
    renderGradeTabelas();
    atualizarDerivados();
    setTimeout(() => { S.movidaId = null; }, 650);
    avisar(`${rotuloMes(origem.mes)} movido para ${rotuloMes(destino)}; as datas dos lançamentos foram atualizadas.`);
  }

  function confirmarRenomear() {
    const id = S.renomeandoId;
    const nome = S.renomeValor.trim().slice(0, 120);
    S.renomeandoId = null;
    const sim = S.simulacoes.find((s) => s.id === id);
    if (sim && nome && nome !== sim.titulo) alterarSimulacao({ ...sim, titulo: nome });
    // Redesenha só a linha do menu e o título: um redesenho completo aqui
    // engoliria o clique que tirou o foco do campo
    const campo = raiz && raiz.querySelector('.or-renomear');
    const linha = campo && campo.closest('.simulation-nav-row');
    const atual = S.simulacoes.find((s) => s.id === id);
    if (!linha || !atual) { render(); return; }
    linha.outerHTML = htmlLinhaSimulacao(atual);
    const titulo = S.tela === 'painel' && S.selecionadaId === id && raiz.querySelector('.dashboard-title-row h1');
    if (titulo) titulo.textContent = atual.titulo;
  }

  function salvarArea(m) {
    const nome = (m.nome || '').trim();
    if (!nome) { const campo = raiz.querySelector('[data-campo="area-nome"]'); if (campo) campo.focus(); return; }
    if (m.editandoId) S.areas = S.areas.map((a) => (a.id === m.editandoId ? { ...a, nome: nome.slice(0, 60), icone: m.icone } : a));
    else S.areas = [...S.areas, { id: uid('area'), nome: nome.slice(0, 60), icone: m.icone }];
    S.modal = { ...m, nome: '', editandoId: null, icone: 'briefcase', focar: true };
    gravarAreas();
    renderModal();
    render();
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  function aoClicar(e) {
    // Lido antes de fechar os popovers: fechar redesenha o card e tiraria o
    // botão clicado da página
    const alvo = e.target.closest('[data-acao]');
    const comando = e.target.closest('[data-comando]');

    // Popovers fecham ao clicar fora deles
    if (S.areaAberta && !e.target.closest('.area-picker')) {
      const aberto = S.areaAberta;
      S.areaAberta = null;
      const btn = raiz.querySelector(`[data-acao="area-abrir"][data-lanc="${CSS.escape(aberto)}"]`);
      if (btn) renderCartao(btn.dataset.tabela);
    }
    if (S.mesAberto && !e.target.closest('.month-picker') && !e.target.closest('[data-acao="abrir-mes"]')) {
      const id = S.mesAberto.tabelaId;
      S.mesAberto = null;
      renderCartao(id);
    }

    if (comando) { e.preventDefault(); document.execCommand(comando.dataset.comando, false); sincronizarEditor(); return; }
    if (!alvo) return;
    const { acao, id, tabela, lanc } = alvo.dataset;
    const sim = selecionada();
    if (/^(mes-|ano-)/.test(acao) && !S.mesAberto) return;

    switch (acao) {
      case 'voltar-central': voltarCentral(); break;
      case 'abrir-menu': S.menuAberto = true; render(); break;
      case 'fechar-menu': S.menuAberto = false; render(); break;
      case 'visao-geral': irParaLista(); break;
      case 'recarregar': recarregar(); break;
      case 'tentar-sync': Array.from(falhas).forEach((fid) => gravar(fid)); break;
      case 'abrir-areas':
        if (S.areaAberta) { S.areaAberta = null; if (tabela) renderCartao(tabela); }
        S.modal = { tipo: 'areas', nome: '', icone: 'briefcase', editandoId: null };
        renderModal();
        break;
      case 'abrir-sim':
        // Clique duplo no menu lateral renomeia
        if (e.detail >= 2 && alvo.classList.contains('simulation-nav')) {
          const item = S.simulacoes.find((s) => s.id === id);
          if (item) { S.renomeandoId = id; S.renomeValor = item.titulo; render(); }
        } else if (!(S.tela === 'painel' && S.selecionadaId === id)) abrirSimulacao(id);
        break;
      case 'pedir-apagar-sim': e.stopPropagation(); S.modal = { tipo: 'apagar-sim', id }; renderModal(); break;
      case 'nova-sim': abrirModalSimulacao('criar'); break;
      case 'editar-sim': abrirModalSimulacao('editar'); break;
      case 'analise': S.modal = { tipo: 'analise', modo: 'radar', ordem: 'valor' }; renderModal(); break;
      case 'nova-tabela': novaTabelaNaSimulacao(); break;
      case 'abrir-mes': {
        const t = sim && sim.tabelas.find((x) => x.id === tabela);
        if (!t) break;
        const fechar = S.mesAberto && S.mesAberto.tabelaId === tabela;
        const anterior = S.mesAberto && S.mesAberto.tabelaId;
        S.mesAberto = fechar ? null : { tabelaId: tabela, passo: 'mes', rascunho: t.mes };
        if (anterior && anterior !== tabela) renderCartao(anterior);
        renderCartao(tabela);
        break;
      }
      case 'mes-passo': S.mesAberto.passo = 'mes'; renderCartao(S.mesAberto.tabelaId); break;
      case 'mes-escolher': {
        const d = parseMes(S.mesAberto.rascunho);
        S.mesAberto.rascunho = `${d.getFullYear()}-${String(Number(alvo.dataset.indice) + 1).padStart(2, '0')}`;
        S.mesAberto.passo = 'ano';
        renderCartao(S.mesAberto.tabelaId);
        break;
      }
      case 'ano-escolher': {
        const d = parseMes(S.mesAberto.rascunho);
        const mes = `${alvo.dataset.ano}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const tabelaId = S.mesAberto.tabelaId;
        // Em conflito, o seletor continua aberto com a escolha feita
        if (editarMes(tabelaId, mes)) { S.mesAberto = null; render(); }
        else { S.mesAberto.rascunho = mes; renderCartao(tabelaId); }
        break;
      }
      case 'mes-cancelar': { const tid = S.mesAberto.tabelaId; S.mesAberto = null; renderCartao(tid); break; }
      case 'apagar-tabela': S.modal = { tipo: 'apagar-tabela', tabelaId: tabela }; renderModal(); break;
      case 'confirmar-apagar-tabela': {
        const tabelaId = S.modal.tabelaId;
        if (sim) alterarSimulacao({ ...sim, tabelas: sim.tabelas.filter((t) => t.id !== tabelaId) });
        S.modal = null;
        renderModal();
        render();
        break;
      }
      case 'confirmar-apagar-sim': {
        const alvoId = S.modal.id;
        S.simulacoes = S.simulacoes.filter((s) => s.id !== alvoId);
        S.modal = null;
        renderModal();
        if (S.selecionadaId === alvoId) irParaLista(); else render();
        apagarNoBanco(alvoId);
        break;
      }
      case 'detalhes': {
        const l = sim && sim.tabelas.find((t) => t.id === tabela)?.lancamentos.find((x) => x.id === lanc);
        if (!l) break;
        S.modal = { tipo: 'detalhes', tabelaId: tabela, lancId: lanc, titulo: l.descricao, valor: l.detalhes || '<p></p>' };
        renderModal();
        break;
      }
      case 'salvar-detalhes': {
        const m = S.modal;
        alterarLancamento(m.tabelaId, m.lancId, 'detalhes', sanitizarDescricao(m.valor));
        S.modal = null;
        renderModal();
        renderCartao(m.tabelaId);
        break;
      }
      case 'area-abrir': {
        const anterior = S.areaAberta;
        S.areaAberta = anterior === lanc ? null : lanc;
        renderCartao(tabela);
        break;
      }
      case 'area-escolher':
        S.areaAberta = null;
        alterarLancamento(tabela, lanc, 'areaId', alvo.dataset.area);
        renderCartao(tabela);
        break;
      case 'apagar-lanc': {
        const novo = atualizarTabela(tabela, (t) => ({ ...t, lancamentos: t.lancamentos.filter((l) => l.id !== lanc) }));
        const t = novo && novo.tabelas.find((x) => x.id === tabela);
        renderCartao(tabela);
        atualizarDerivados();
        if (t && t.lancamentos.length === 0) avisar(`${rotuloMes(t.mes)} ficou sem lançamentos e foi ocultado.`);
        break;
      }
      case 'add-lanc': {
        const novo = atualizarTabela(tabela, (t) => ({ ...t, lancamentos: [...t.lancamentos, novoLancamento(t.mes)] }));
        renderCartao(tabela);
        atualizarDerivados();
        const t = novo && novo.tabelas.find((x) => x.id === tabela);
        const ultimo = t && t.lancamentos[t.lancamentos.length - 1];
        const campo = ultimo && raiz.querySelector(`[data-campo="descricao"][data-lanc="${CSS.escape(ultimo.id)}"]`);
        if (campo) campo.focus();
        break;
      }
      case 'fechar-modal': S.modal = null; renderModal(); break;
      case 'area-icone': S.modal.icone = alvo.dataset.icone; renderModal(); break;
      case 'area-editar': {
        const a = S.areas.find((x) => x.id === alvo.dataset.area);
        if (a) { S.modal = { ...S.modal, editandoId: a.id, nome: a.nome, icone: a.icone, focar: true }; renderModal(); }
        break;
      }
      case 'area-cancelar-edicao': S.modal = { ...S.modal, editandoId: null, nome: '', icone: 'briefcase' }; renderModal(); break;
      case 'area-apagar': {
        const a = S.areas.find((x) => x.id === alvo.dataset.area);
        if (!a) break;
        if (!window.confirm(`A área “${a.nome}” será removida. Os investimentos que já usam esta área não serão alterados e aparecerão como “Sem área” até serem ajustados manualmente. Continuar?`)) break;
        S.areas = S.areas.filter((x) => x.id !== a.id);
        if (S.modal.editandoId === a.id) S.modal = { ...S.modal, editandoId: null, nome: '', icone: 'briefcase' };
        gravarAreas();
        renderModal();
        render();
        break;
      }
      case 'analise-modo': S.modal.modo = alvo.dataset.modo; renderModal(); break;
      default: break;
    }
  }

  function sincronizarEditor() {
    const editor = raiz && raiz.querySelector('.or-modais .editor-content');
    if (!editor || !S.modal) return;
    const html = sanitizarDescricao(editor.innerHTML);
    if (S.modal.tipo === 'detalhes') S.modal.valor = html;
    else if (S.modal.form) S.modal.form.descricao = html;
  }

  function aoDigitar(e) {
    const t = e.target;
    const campo = t.dataset && t.dataset.campo;
    if (!campo) return;
    switch (campo) {
      case 'busca-sim': {
        S.busca = t.value;
        const grade = raiz.querySelector('[data-ref="grade-sims"]');
        if (grade) grade.innerHTML = htmlGradeSims();
        atualizarContagemSims();
        break;
      }
      case 'busca-tabelas': S.buscaTabelas = t.value; renderGradeTabelas(); break;
      case 'renomear': S.renomeValor = t.value; break;
      case 'descricao': alterarLancamento(t.dataset.tabela, t.dataset.lanc, 'descricao', t.value.slice(0, 200)); break;
      case 'valor': alterarLancamento(t.dataset.tabela, t.dataset.lanc, 'valor', Math.max(0, Number(t.value) || 0)); atualizarDerivados(); break;
      case 'data': if (t.value) alterarLancamento(t.dataset.tabela, t.dataset.lanc, 'data', t.value); break;
      case 'editor': sincronizarEditor(); break;
      case 'form-titulo': S.modal.form.titulo = t.value; break;
      case 'form-saldo': S.modal.form.saldoInicial = t.value; break;
      case 'form-inicio': S.modal.form.dataInicio = t.value; break;
      case 'form-fim': S.modal.form.dataFim = t.value; break;
      case 'area-nome': S.modal.nome = t.value; break;
      default: break;
    }
  }

  function aoMudar(e) {
    if (e.target.dataset && e.target.dataset.campo === 'analise-ordem') { S.modal.ordem = e.target.value; renderModal(); }
  }

  function aoEnviar(e) {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'simulacao') { sincronizarEditor(); salvarModalSimulacao(); }
    if (form.dataset.form === 'area') salvarArea(S.modal);
  }

  function aoTeclar(e) {
    if (e.target.classList && e.target.classList.contains('or-renomear')) {
      if (e.key === 'Enter') { e.preventDefault(); confirmarRenomear(); }
      if (e.key === 'Escape') { S.renomeValor = ''; confirmarRenomear(); }
      return;
    }
    if (e.key !== 'Escape') return;
    if (S.modal) { S.modal = null; renderModal(); return; }
    if (S.mesAberto) { const id = S.mesAberto.tabelaId; S.mesAberto = null; renderCartao(id); return; }
    if (S.areaAberta) { S.areaAberta = null; render(); return; }
    if (S.menuAberto) { S.menuAberto = false; render(); }
  }

  function aoSairDoFoco(e) {
    if (e.target.classList && e.target.classList.contains('or-renomear') && S.renomeandoId) { confirmarRenomear(); return; }
    // Uma atualização do banco chegou enquanto o usuário digitava
    if (renderPendente) setTimeout(() => { if (renderPendente) renderSeguro(); }, 0);
  }

  // Fundo do modal fecha ao pressionar (como no protótipo), não ao soltar
  function aoPressionar(e) {
    if (e.target.dataset && e.target.dataset.fundo) { S.modal = null; renderModal(); return; }
    // O card só fica arrastável enquanto o título é segurado, para não
    // atrapalhar a seleção de texto nos campos
    const titulo = e.target.closest('.monthly-heading');
    if (titulo && !e.target.closest('button, .month-picker')) titulo.closest('.monthly-card').draggable = true;
  }
  // Botões do editor não podem tirar o foco do texto selecionado
  function aoPressionarMouse(e) {
    if (e.target.closest('[data-comando]')) e.preventDefault();
  }
  // Rolar a página com o cursor sobre um valor focado não deve alterá-lo
  function aoRolar(e) {
    if (e.target.type === 'number' && e.target === document.activeElement) e.target.blur();
  }
  function aoSoltarPonteiro() {
    if (!S.arrastandoId && raiz) raiz.querySelectorAll('.monthly-card[draggable="true"]').forEach((c) => { c.draggable = false; });
  }

  // ── Arrastar tabelas ──
  function alvoDoArraste(e) {
    const livre = e.target.closest('.or-mes-livre');
    if (livre) return NOVO_MES;
    const card = e.target.closest('.monthly-card');
    if (card) return card.dataset.tabela;
    return e.target.closest('.monthly-grid') ? NOVO_MES : null;
  }

  function marcarAlvo(alvo) {
    raiz.querySelectorAll('.is-drag-target').forEach((n) => n.classList.remove('is-drag-target'));
    if (!alvo || alvo === S.arrastandoId) return;
    const no = alvo === NOVO_MES ? raiz.querySelector('.or-mes-livre') : raiz.querySelector(`.monthly-card[data-tabela="${CSS.escape(alvo)}"]`);
    if (no) no.classList.add('is-drag-target');
  }

  function aoIniciarArraste(e) {
    const card = e.target.closest && e.target.closest('.monthly-card');
    if (!card || !card.draggable) return;
    S.arrastandoId = card.dataset.tabela;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', S.arrastandoId);
    requestAnimationFrame(() => {
      card.classList.add('is-dragging');
      const grade = raiz.querySelector('.monthly-grid');
      if (grade) grade.classList.add('is-dragging-grid');
    });
  }

  function aoArrastarSobre(e) {
    if (!S.arrastandoId || !e.target.closest('.monthly-grid')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    marcarAlvo(alvoDoArraste(e));
  }

  function aoSoltar(e) {
    if (!S.arrastandoId || !e.target.closest('.monthly-grid')) return;
    e.preventDefault();
    const origemId = S.arrastandoId;
    const alvo = alvoDoArraste(e);
    limparArraste();
    if (!alvo || alvo === origemId) return;
    if (alvo !== NOVO_MES) {
      const destino = selecionada() && selecionada().tabelas.find((t) => t.id === alvo);
      if (destino) avisar(`${rotuloMes(destino.mes)} já possui uma tabela. Solte no espaço “Mês livre”.`);
      return;
    }
    moverParaMesLivre(origemId);
  }

  function limparArraste() {
    S.arrastandoId = null;
    if (!raiz) return;
    if (renderPendente) setTimeout(renderSeguro, 0);
    raiz.querySelectorAll('.is-dragging, .is-drag-target').forEach((n) => n.classList.remove('is-dragging', 'is-drag-target'));
    raiz.querySelectorAll('.is-dragging-grid').forEach((n) => n.classList.remove('is-dragging-grid'));
    raiz.querySelectorAll('.monthly-card[draggable="true"]').forEach((c) => { c.draggable = false; });
  }

  function antesDeSair(e) {
    if (!timers.size && !gravando.size) return;
    gravarPendencias();
    e.preventDefault();
    e.returnValue = '';
  }

  const EVENTOS = [
    ['click', aoClicar], ['input', aoDigitar], ['change', aoMudar], ['submit', aoEnviar],
    ['focusout', aoSairDoFoco], ['pointerdown', aoPressionar], ['mousedown', aoPressionarMouse], ['pointerup', aoSoltarPonteiro],
    ['dragstart', aoIniciarArraste], ['dragover', aoArrastarSobre], ['drop', aoSoltar], ['dragend', limparArraste]
  ];

  // ── Abrir / fechar ───────────────────────────────────────────────────────
  function recarregar() {
    if (pararSims) pararSims();
    if (pararAreas) pararAreas();
    S.erro = null;
    S.carregado = false;
    render();
    assinar();
  }

  function abrir() {
    if (raiz) return;
    if (typeof firebase === 'undefined') { console.error('[Organização de recursos] Firebase não carregado.'); return; }
    db = window.db || firebase.firestore();
    Object.assign(S, { tela: 'simulacoes', selecionadaId: null, busca: '', buscaTabelas: '', renomeandoId: null, menuAberto: false, mesAberto: null, areaAberta: null, modal: null, aviso: '' });
    raiz = document.createElement('div');
    raiz.className = 'or-app';
    raiz.setAttribute('role', 'region');
    raiz.setAttribute('aria-label', 'Organização de recursos');
    raiz.innerHTML = '<div class="or-shell"></div><div class="or-modais"></div><div class="or-avisos" aria-live="polite"></div>';
    document.body.appendChild(raiz);
    document.body.classList.add('or-aberto');
    EVENTOS.forEach(([tipo, fn]) => raiz.addEventListener(tipo, fn));
    raiz.addEventListener('wheel', aoRolar, { passive: true });
    window.addEventListener('beforeunload', antesDeSair);
    // No document: depois de um redesenho o foco pode ficar no <body>
    document.addEventListener('keydown', aoTeclar);
    render();
    assinar();
  }

  function fechar() {
    if (!raiz) return;
    gravarPendencias();
    if (pararSims) { pararSims(); pararSims = null; }
    if (pararAreas) { pararAreas(); pararAreas = null; }
    destruirGrafico('saldo');
    destruirGrafico('analise');
    clearTimeout(timerAviso);
    window.removeEventListener('beforeunload', antesDeSair);
    document.removeEventListener('keydown', aoTeclar);
    raiz.remove();
    raiz = null;
    document.body.classList.remove('or-aberto');
  }

  // Volta para a tela da Central de onde o usuário veio (ou o Painel Central)
  function voltarCentral() {
    fechar();
    const anterior = typeof APP_STATE !== 'undefined' && APP_STATE.previousSection;
    const destino = anterior && anterior !== 'organizacao-recursos' ? anterior : 'painel-central';
    const nav = document.getElementById('div-menuLateral');
    const btn = nav && (nav.querySelector(`button[data-section="${CSS.escape(destino)}"]`) || nav.querySelector('button[data-section="painel-central"]'));
    if (btn) btn.click();
  }

  // Conteúdo da <section> por trás da tela cheia (aparece se ela for fechada)
  function carregarSecao() {
    const secao = document.getElementById('organizacao-recursos');
    if (secao) {
      secao.innerHTML = '<div class="text-center py-8"><i class="fas fa-diagram-project text-3xl text-gray-300 mb-3"></i>'
        + '<h3 class="font-lexend text-lg mb-2">Organização de recursos</h3>'
        + '<button type="button" class="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg" id="or-reabrir">Abrir em tela cheia</button></div>';
      const btn = document.getElementById('or-reabrir');
      if (btn) btn.addEventListener('click', abrir);
    }
    abrir();
  }

  window.OrganizacaoRecursos = { abrir: carregarSecao, fechar, voltar: voltarCentral };
})();
