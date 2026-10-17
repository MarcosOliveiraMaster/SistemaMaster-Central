// propostas-professores.js
// Propostas de aulas para professores (coleção propostasProfessores).
//
// 1) Envio — botão "Enviar proposta para professores" nos modais de Simulação e
//    de Detalhes da contratação:
//      passo 1: caixas de seleção das aulas (versão SALVA da simulação/contratação);
//      passo 2 (com animação): grade de professores com filtro por nome e
//      disciplina — só quem tem acesso à plataforma, professores de ouro primeiro.
//    Cada professor escolhido recebe um documento com as aulas marcadas e o total
//    que ELE recebe (hora/aula do professor × duração). Sem CPF, pacote ou lucro.
// 2) Área "Notificações" — cards com as respostas (aceitou / recusou /
//    contraproposta). Aceita: borda verde e etiqueta "Aula fechada". Clique abre
//    os detalhes (e o texto da contraproposta). Botão direito (ou segurar o dedo)
//    → Excluir: some também para o professor.
// O professor responde pelo portal (SistemMaster-Login/propostas-professor.js).
// Regras: SistemMaster-Login/firestore.rules → match /propostasProfessores.

(function () {
  'use strict';

  const COLECAO = 'propostasProfessores';
  const HORA_PADRAO = 35;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const dataDe = (ts) => (ts && ts.toDate ? ts.toDate() : null);
  const fmtData = (ts) => { const d = dataDe(ts); return d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };

  function horasDe(duracao) {
    const m = String(duracao || '').match(/(\d+)\s*h\s*(\d+)?/i);
    return m ? (parseInt(m[1], 10) || 0) + (parseInt(m[2] || '0', 10) || 0) / 60 : 0;
  }

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .pe-fundo{--pe-acc:#f28705;--pe-acc-esc:#d97804;--pe-claro:#fff7eb;--pe-hover:#fcd9a8;--pe-sombra:rgba(242,135,5,.2);--pe-aviso-bg:#fefce8;--pe-aviso-borda:#facc15;--pe-aviso-txt:#854d0e;--pe-ok:#16a34a;position:fixed;inset:0;z-index:10050;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:1rem;}
    .pe-caixa{background:#fff;border-radius:18px;width:100%;max-width:96vw;height:92vh;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:'Comfortaa',sans-serif;}
    .pe-topo{background:var(--pe-acc);color:#fff;padding:.9rem 1.2rem;display:flex;align-items:center;gap:.7rem;}
    .pe-topo h3{font-family:'Lexend',sans-serif;font-size:1.05rem;margin:0;flex:1;min-width:0;}
    .pe-passos{display:flex;gap:.35rem;font-size:.72rem;font-weight:700;}
    .pe-passos span{background:rgba(255,255,255,.25);border-radius:999px;padding:.2rem .6rem;}
    .pe-passos span.on{background:#fff;color:var(--pe-acc-esc);}
    .pe-x{background:rgba(255,255,255,.2);border:0;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1.1rem;}
    .pe-trilho{flex:1;min-height:0;overflow:hidden;position:relative;}
    .pe-palco{display:flex;width:200%;height:100%;transition:transform .45s cubic-bezier(.4,0,.2,1);}
    .pe-palco.passo2{transform:translateX(-50%);}
    .pe-pag{width:50%;display:flex;flex-direction:column;min-height:0;}
    .pe-corpo{padding:1rem 1.2rem;overflow-y:auto;flex:1;}
    .pe-rodape{border-top:1px solid #e5e7eb;padding:.8rem 1.2rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;}
    .pe-rodape .pe-info{flex:1;font-size:.85rem;color:#374151;}
    .pe-rodape .pe-info b{color:#15803d;font-family:'Lexend',sans-serif;}
    .pe-btn{border-radius:10px;padding:.6rem 1.1rem;font:700 .88rem 'Comfortaa',sans-serif;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#374151;display:inline-flex;gap:.45rem;align-items:center;}
    .pe-btn.pri{background:var(--pe-acc);border-color:var(--pe-acc);color:#fff;}
    .pe-btn.perigo{background:#dc2626;border-color:#dc2626;color:#fff;}
    .pe-btn:disabled{opacity:.5;cursor:not-allowed;}
    .pe-aula{display:flex;gap:.75rem;align-items:center;border:1.5px solid #e5e7eb;border-radius:12px;padding:.6rem .8rem;margin-bottom:.5rem;cursor:pointer;}
    .pe-aula:has(input:checked){border-color:var(--pe-acc);background:var(--pe-claro);}
    .pe-aula input{width:18px;height:18px;accent-color:var(--pe-acc);flex-shrink:0;}
    .pe-aula .pe-a1{flex:1;min-width:0;font-size:.85rem;color:#374151;line-height:1.45;}
    .pe-aula .pe-a1 b{color:#111827;}
    .pe-aula .pe-a2{font-family:'Lexend',sans-serif;font-weight:700;color:#15803d;white-space:nowrap;}
    .pe-aula .pe-status{flex-shrink:0;min-width:84px;text-align:center;border:1.5px solid;border-radius:8px;padding:.15rem .5rem;font-size:.72rem;font-weight:700;white-space:nowrap;}
    .pe-todas{display:flex;gap:.5rem;align-items:center;font-size:.85rem;font-weight:700;margin-bottom:.7rem;cursor:pointer;}
    .pe-todas input{width:18px;height:18px;accent-color:var(--pe-acc);}
    .pe-filtros{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.9rem;align-items:stretch;}
    .pe-filtros input,.pe-filtros select{border:2px solid #e5e7eb;border-radius:10px;padding:.55rem .7rem;font:.9rem 'Comfortaa',sans-serif;min-height:42px;}
    .pe-filtros input{flex:1 1 220px;}
    .pe-multi{position:relative;flex:0 1 240px;min-width:0;}
    .pe-multi-btn{width:100%;min-height:42px;border:2px solid #e5e7eb;border-radius:10px;padding:.55rem .7rem;background:#fff;font:.9rem Comfortaa,sans-serif;color:#374151;display:flex;align-items:center;gap:.5rem;cursor:pointer;text-align:left;}
    .pe-multi-btn span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .pe-multi-btn[aria-expanded="true"]{border-color:var(--pe-acc);}
    .pe-multi-btn[aria-expanded="true"] i{transform:rotate(180deg);}
    .pe-multi-btn i{transition:transform .2s;color:#9ca3af;font-size:.8rem;}
    .pe-multi-painel{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:5;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:.35rem;max-height:280px;overflow-y:auto;}
    .pe-multi-painel[hidden]{display:none;}
    .pe-multi-painel label{display:flex;gap:.55rem;align-items:center;padding:.45rem .55rem;border-radius:8px;cursor:pointer;font-size:.86rem;color:#374151;}
    .pe-multi-painel label:hover{background:var(--pe-claro);}
    .pe-multi-painel input{width:16px;height:16px;min-height:0;accent-color:var(--pe-acc);flex:none;}
    .pe-multi-limpar{width:100%;margin-top:.25rem;border:0;border-top:1px solid #e5e7eb;background:none;padding:.5rem;font:700 .8rem Comfortaa,sans-serif;color:var(--pe-acc-esc);cursor:pointer;}
    .pe-verif{min-height:42px;border-color:var(--pe-acc);color:var(--pe-acc-esc);background:var(--pe-claro);}
    .pe-verif:hover:not(:disabled){background:var(--pe-acc);color:#fff;}
    .pe-cel{display:flex;flex-direction:column;gap:.45rem;min-width:0;}
    .pe-prof .pe-ok{position:absolute;top:6px;right:6px;font-size:1.05rem;line-height:1;}
    .pe-prof.pe-verificado .pe-marca{right:34px;}
    .pe-pend{border-radius:12px;padding:.6rem .7rem;font-size:.78rem;line-height:1.4;text-align:left;}
    .pe-pend b{display:block;font-family:Lexend,sans-serif;font-size:.78rem;margin-bottom:.25rem;}
    .pe-pend ul{margin:0;padding-left:1.05rem;list-style:disc;}
    .pe-pend li{margin:.1rem 0;}
    .pe-pend small{display:block;opacity:.85;margin-bottom:.45rem;}
    .pe-conf{background:var(--pe-claro);border:1.5px solid var(--pe-hover);color:#374151;}
    .pe-conf b{color:var(--pe-acc-esc);}
    .pe-aviso{background:var(--pe-aviso-bg);border:1.5px solid var(--pe-aviso-borda);color:var(--pe-aviso-txt);}
    .pe-ver-disp{width:100%;justify-content:center;padding:.4rem .6rem;font-size:.76rem;border-color:var(--pe-aviso-borda);color:var(--pe-aviso-txt);background:#fff;}
    .pe-ver-disp:hover{background:var(--pe-aviso-borda);color:#fff;}
    body.theme-blue .pe-fundo{--pe-acc:#00255f;--pe-acc-esc:#00255f;--pe-claro:#eef3fb;--pe-hover:#b9c9e6;--pe-sombra:rgba(0,37,95,.2);--pe-aviso-bg:#e8f0fc;--pe-aviso-borda:#4d668f;--pe-aviso-txt:#00255f;}
    .pe-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.8rem;align-items:start;}
    /* Vista de indicadores completa: 1 a 4 colunas conforme a largura */
    .pe-grade.pe-grade-ind{grid-template-columns:repeat(auto-fill,minmax(max(340px,calc((100% - 2.7rem)/4)),1fr));grid-auto-rows:1fr;align-items:stretch;gap:.9rem;}
    .pe-ind{--st-bg:#fff;--st-borda:#e5e7eb;position:relative;display:grid;grid-template-columns:40% minmax(0,1fr);gap:.85rem;align-items:start;border:2px solid var(--st-borda);border-radius:16px;padding:.8rem;background:var(--st-bg);cursor:pointer;text-align:left;transition:box-shadow .15s,transform .15s;}
    /* ── CORES DOS CARDS (ajuste aqui) ──────────────────────────────────────
       Situação do professor para as aulas marcadas (mesmas cores nos dois temas).
       --st-bg = fundo do card · --st-borda = borda do card.
       Mais suave: tons mais claros (ex.: verde #f0fdf4 / #4ade80).
       Mais forte: tons mais escuros (ex.: verde #dcfce7 / #16a34a).
       A espessura da borda vem de .pe-ind (border:2px). */
    .pe-ind.st-ok{--st-bg:#effdf3;--st-borda:#38db73;}
    .pe-ind.st-dia{--st-bg:#fefce6;--st-borda:#fac700;}
    .pe-ind.st-fora{--st-bg:#fff6eb;--st-borda:#fb8728;}
    .pe-ind.st-ambos{--st-bg:#fef1f1;--st-borda:#f76363;}
    .pe-ind:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.08);}
    .pe-ind:focus-visible{outline:3px solid var(--pe-hover);outline-offset:2px;}
    .pe-ind[aria-pressed="true"]{box-shadow:0 0 0 3px var(--pe-acc),0 8px 20px var(--pe-sombra);}
    .pe-ind-foto{position:relative;}
    .pe-ind-foto img,.pe-ind-foto .pe-iniciais{width:100%;aspect-ratio:1/1;border-radius:14px;object-fit:cover;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.75);color:var(--pe-acc-esc);font:700 2.2rem 'Lexend',sans-serif;}
    .pe-selo{position:absolute;right:-8px;bottom:-8px;width:62px;height:62px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);}
    .pe-selo::before{content:"";position:absolute;inset:3px;border-radius:50%;background:conic-gradient(var(--pe-acc) calc(var(--p) * 1%),#eef0f3 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0);}
    .pe-selo b{font:700 1rem 'Lexend',sans-serif;color:var(--pe-acc-esc);line-height:1;}
    .pe-selo small{font-size:.6rem;color:#6b7280;margin-top:1px;}
    .pe-ind-foto .pe-ouro{position:absolute;top:6px;left:6px;width:26px;height:26px;border-radius:50%;background:#fff;color:#eab308;display:flex;align-items:center;justify-content:center;font-size:.8rem;box-shadow:0 2px 6px rgba(0,0,0,.15);}
    .pe-ind-info{min-width:0;height:100%;display:flex;flex-direction:column;gap:.5rem;}
    .pe-ind-topo{display:flex;gap:.5rem;align-items:flex-start;}
    .pe-ind-topo > div{flex:1;min-width:0;}
    .pe-ind-topo b{display:block;font:700 1rem 'Lexend',sans-serif;color:#111827;}
    .pe-ind-topo small{display:block;font-size:.76rem;color:#6b7280;line-height:1.35;}
    .pe-ind-sinais{display:flex;gap:.3rem;align-items:center;flex:none;font-size:1.05rem;line-height:1;}
    .pe-ind .pe-marca{width:24px;height:24px;border-radius:50%;background:var(--pe-acc);color:#fff;display:none;align-items:center;justify-content:center;font-size:.75rem;}
    .pe-ind[aria-pressed="true"] .pe-marca{display:flex;}
    /* Matérias das aulas marcadas: ícone na cor do tema se o professor leciona, cinza se não */
    .pe-mats{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,36px));gap:.4rem;}
    .pe-mat{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.05rem;background:color-mix(in srgb,var(--pe-acc) 14%,#fff);color:var(--pe-acc);border:1.5px solid color-mix(in srgb,var(--pe-acc) 45%,#fff);}
    .pe-mat.nao{background:#f3f4f6;color:#9ca3af;border-color:#e5e7eb;}
    .pe-media{font-size:.76rem;color:#6b7280;}
    .pe-media b{color:#111827;font-family:'Lexend',sans-serif;}
    /* Rodapé em duas partes, preenchidas da esquerda: disponibilidade e aulas agendadas */
    .pe-ind-rodape{margin-top:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;align-items:center;min-height:42px;align-items:end;}
    .pe-ind-rodape > span{justify-self:stretch;display:flex;justify-content:center;min-width:0;}
    .pe-pend-ico{position:relative;width:42px;height:42px;border-radius:50%;border:1.5px solid;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex:none;}
    .pe-pend-ico.dia{border-color:#fac700;color:#a16207;}
    .pe-pend-ico.fora{border-color:#fb8728;color:#c2410c;}
    .pe-pend-ico:not(.ok):hover{filter:brightness(.95);transform:translateY(-1px);}
    .pe-pend-ico .pe-n{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 4px;border-radius:999px;background:#a16207;color:#fff;font:700 .7rem 'Lexend',sans-serif;display:flex;align-items:center;justify-content:center;}
    .pe-pend-ico.fora .pe-n{background:#c2410c;}
    .pe-slot{display:flex;flex-direction:column;align-items:center;gap:.6rem;width:100%;min-width:0;text-align:center;}
    .pe-slot > small{font:700 .64rem 'Lexend',sans-serif;line-height:1.2;}
    .pe-slot.dia > small{color:#a16207;} .pe-slot.fora > small{color:#c2410c;}
    .pe-ordem{display:flex;align-items:center;gap:.4rem;border:2px solid #e5e7eb;border-radius:10px;padding:0 .4rem 0 .7rem;min-height:42px;background:#fff;font:700 .82rem 'Comfortaa',sans-serif;color:#374151;}
    .pe-ordem[hidden]{display:none;}
    .pe-ordem select{border:0;outline:0;background:transparent;font:.86rem 'Comfortaa',sans-serif;color:#111827;padding:.4rem .2rem;min-height:0;cursor:pointer;}
    .pe-ordem:focus-within{border-color:var(--pe-acc);}
    .pe-info-ico{position:absolute;right:.45rem;bottom:.45rem;width:21px;height:21px;border-radius:50%;border:1.5px solid var(--pe-hover);background:#fff;color:var(--pe-acc-esc);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.55rem;opacity:.8;}
    .pe-info-ico:hover,.pe-info-ico:focus-visible{opacity:1;background:var(--pe-acc);border-color:var(--pe-acc);color:#fff;}
    .pe-pop{position:fixed;z-index:10065;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.2);padding:.7rem .9rem .8rem;width:min(340px,92vw);max-height:60vh;overflow-y:auto;font:.8rem 'Comfortaa',sans-serif;color:#374151;}
    .pe-pop h4{display:flex;justify-content:space-between;gap:.5rem;font:700 .85rem 'Lexend',sans-serif;color:var(--pe-acc-esc);margin:.45rem 0 .25rem;}
    .pe-pop ul{margin:0;padding:0;list-style:none;}
    .pe-pop li{display:flex;justify-content:space-between;gap:.6rem;padding:.22rem 0;border-bottom:1px dashed #eef0f3;}
    .pe-pop li b{color:#15803d;white-space:nowrap;}
    .pe-pop p{margin:.2rem 0;color:#6b7280;}
    .pe-pop .pe-pop-tit{font:700 .82rem 'Lexend',sans-serif;margin:0 0 .35rem;}
    .pe-pop.dia{border:2px solid #fac700;} .pe-pop.dia .pe-pop-tit{color:#a16207;}
    .pe-pop.fora{border:2px solid #fb8728;} .pe-pop.fora .pe-pop-tit{color:#c2410c;}
    .pe-pop.dia li,.pe-pop.fora li{display:list-item;border:0;padding:.12rem 0;margin-left:1rem;list-style:disc;}
    .pe-pop .pe-ver-disp{margin-top:.55rem;border-color:#fb8728;color:#c2410c;}
    .pe-pop .pe-ver-disp:hover{background:#fb8728;color:#fff;}
    .pe-carregando{grid-column:1/-1;text-align:center;padding:3rem 1rem;color:#6b7280;font-size:.9rem;}
    .pe-prof{position:relative;border:2px solid #e5e7eb;border-radius:14px;padding:.8rem .6rem;text-align:center;cursor:pointer;background:#fff;font:inherit;transition:border-color .15s,box-shadow .15s,transform .15s;}
    .pe-prof:hover{border-color:var(--pe-hover);transform:translateY(-2px);}
    .pe-prof[aria-pressed="true"]{border-color:var(--pe-acc);background:var(--pe-claro);box-shadow:0 6px 18px var(--pe-sombra);}
    .pe-prof .pe-foto{width:84px;height:84px;border-radius:16px;object-fit:cover;margin:0 auto .5rem;display:block;background:#f3f4f6;}
    .pe-prof .pe-iniciais{width:84px;height:84px;border-radius:16px;margin:0 auto .5rem;display:flex;align-items:center;justify-content:center;background:var(--pe-claro);color:var(--pe-acc-esc);font:700 1.6rem 'Lexend',sans-serif;}
    .pe-prof b{display:block;font-family:'Lexend',sans-serif;font-size:.92rem;color:#111827;}
    .pe-prof small{display:block;font-size:.75rem;color:#6b7280;line-height:1.35;margin-top:.15rem;}
    .pe-prof .pe-ouro{position:absolute;top:8px;left:8px;color:#eab308;font-size:.9rem;}
    .pe-prof .pe-marca{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:var(--pe-acc);color:#fff;display:none;align-items:center;justify-content:center;font-size:.75rem;}
    .pe-prof[aria-pressed="true"] .pe-marca{display:flex;}
    .pe-vazio{text-align:center;color:#6b7280;padding:2rem;font-size:.9rem;}
    @media (max-width:640px){
      .pe-fundo{padding:0;align-items:flex-end;} .pe-caixa{border-radius:18px 18px 0 0;max-width:100vw;height:94vh;max-height:94vh;}
      .pe-grade{grid-template-columns:repeat(2,minmax(0,1fr));} .pe-passos{display:none;}
      .pe-grade.pe-grade-ind{grid-template-columns:1fr;}
      .pe-ind{grid-template-columns:34% minmax(0,1fr);gap:.65rem;padding:.65rem;}
      .pe-rodape{padding-bottom:calc(.8rem + env(safe-area-inset-bottom));}
      .pe-rodape .pe-info{flex-basis:100%;order:-1;font-size:.8rem;}
      .pe-rodape .pe-btn{flex:1;justify-content:center;}
      .pe-prof .pe-foto,.pe-prof .pe-iniciais{width:60px;height:60px;font-size:1.2rem;border-radius:12px;}
      .pe-multi,.pe-verif{flex:1 1 100%;justify-content:center;}
      .pe-topo h3{font-size:.95rem;}
    }
    /* Notificações */
    .nt-wrap{padding:1rem 1.2rem 2rem;}
    .nt-barra{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;}
    .nt-chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:.35rem .85rem;font:700 .82rem 'Comfortaa',sans-serif;cursor:pointer;color:#374151;}
    .nt-chip.on{background:#fff7eb;border-color:#f28705;color:#d97804;}
    .nt-dica{margin-left:auto;font-size:.75rem;color:#9ca3af;}
    .nt-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem;}
    .nt-card{position:relative;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:1rem;cursor:pointer;text-align:left;font:inherit;display:flex;flex-direction:column;gap:.35rem;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .15s,transform .15s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}
    .nt-card:hover{box-shadow:0 8px 22px rgba(0,0,0,.08);transform:translateY(-2px);}
    .nt-card.aceita{border-color:#16a34a;}
    .nt-card.recusada{border-color:#fca5a5;}
    .nt-card.contraproposta{border-color:#fdba74;}
    .nt-card.pendente{border-style:dashed;opacity:.85;}
    .nt-tag{position:absolute;top:-11px;left:12px;background:#16a34a;color:#fff;font:700 .7rem 'Lexend',sans-serif;padding:.2rem .6rem;border-radius:999px;letter-spacing:.02em;}
    .nt-novo{position:absolute;top:12px;right:12px;width:10px;height:10px;border-radius:50%;background:#ef4444;}
    .nt-num{font:700 .78rem 'Lexend',sans-serif;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;}
    .nt-apelido{font:700 1.05rem 'Lexend',sans-serif;color:#111827;}
    .nt-nome{font-size:.85rem;color:#6b7280;}
    .nt-status{font-size:.88rem;font-weight:700;margin-top:.3rem;display:flex;gap:.4rem;align-items:center;}
    .nt-status.aceita{color:#15803d;} .nt-status.recusada{color:#dc2626;} .nt-status.contraproposta{color:#d97804;} .nt-status.pendente{color:#6b7280;} .nt-status.encerrada{color:#6b7280;}
    .nt-data{font-size:.75rem;color:#9ca3af;}
    .nt-menu{position:fixed;z-index:10060;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:.3rem;min-width:160px;}
    .nt-menu button{display:flex;gap:.5rem;align-items:center;width:100%;background:none;border:0;padding:.6rem .8rem;border-radius:8px;cursor:pointer;font:700 .88rem 'Comfortaa',sans-serif;color:#dc2626;}
    .nt-menu button:hover{background:#fef2f2;}
    .nt-texto{background:#fff7eb;border-left:4px solid #f28705;border-radius:8px;padding:.8rem 1rem;white-space:pre-wrap;font-size:.92rem;color:#111827;line-height:1.55;}
    .nt-aulas{list-style:none;padding:0;margin:.6rem 0 0;display:flex;flex-direction:column;gap:.35rem;font-size:.85rem;color:#374151;}
    .nt-aulas li{background:#f9fafb;border-radius:8px;padding:.45rem .6rem;}
    .nt-chip-n{background:#ef4444;color:#fff;border-radius:999px;font-size:.66rem;padding:.05rem .4rem;margin-left:.2rem;}
    .nt-chip-n[hidden]{display:none;}
    #contador-notificacoes{margin-left:auto;background:#fff;color:#d97804;border-radius:999px;font:700 .7rem 'Lexend',sans-serif;padding:.05rem .45rem;min-width:1.2rem;text-align:center;}
    #menu-lateral.collapsed #contador-notificacoes{position:absolute;top:4px;right:8px;margin:0;}
    `;
    document.head.appendChild(s);
  }

  // ── Dados ────────────────────────────────────────────────────────────────
  let professoresCache = null;
  async function carregarProfessores() {
    if (professoresCache) return professoresCache;
    const snap = await fdb().collection('dataBaseProfessores').get();
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    professoresCache = lista;
    return lista;
  }
  const disciplinasDe = (p) => (Array.isArray(p.disciplinas) ? p.disciplinas : String(p.disciplinas || '').split(/[,;/]/))
    .map(s => String(s).trim()).filter(Boolean);
  const fotoDe = (p) => p.fotoUpload || (p.fotoPerfil && p.fotoPerfil !== 'icone-padrao' ? `img-professor/${p.fotoPerfil}` : '');
  const ehOuro = (p) => p.prof_ouro === true || p.prof_ouro === 'true';
  const iniciais = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();

  // Disponibilidade: campos segManha, segTarde ... sabTarde do professor (mesma
  // convenção de functions-verificar-datas.js / match.js: antes de 12h = Manhã).
  // Domingo nunca tem disponibilidade cadastrada. Sem horário não dá pra checar.
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const STATUS_SEM_CONFLITO = ['Cancelada', 'Reagendada'];
  // Mesmas cores do status na tabela "Aulas Agendadas".
  const CORES_STATUS = {
    'Pendente': ['#6B7280', '#F3F4F6', '#D1D5DB'],
    'Reagendada': ['#D97706', '#FEF3C7', '#FCD34D'],
    'Concluída': ['#059669', '#D1FAE5', '#6EE7B7'],
    'Reposição': ['#2563EB', '#DBEAFE', '#93C5FD'],
    'Cancelada': ['#DC2626', '#FEE2E2', '#FCA5A5']
  };
  const corStatus = (st) => { const [c, bg, b] = CORES_STATUS[st] || ['#6B7280', '#F3F4F6', '#D1D5DB']; return `color:${c};background:${bg};border-color:${b}`; };
  const verdadeiro = (v) => v === true || v === 1 || ['true', '1', 'sim', 's', 'yes', 'on'].includes(String(v ?? '').toLowerCase().trim());
  // "Sex - 16/10": dia da semana calculado pela própria data (dd/mm/aaaa).
  const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diaSemanaMes = (data) => {
    const m = String(data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${SEMANA[new Date(+m[3], +m[2] - 1, +m[1]).getDay()]} - ${m[1]}/${m[2]}` : diaMes(data);
  };
  const diaMes = (data) => { const m = String(data || '').match(/(\d{2})\/(\d{2})/); return m ? `${m[1]}/${m[2]}` : String(data || ''); };
  function disponivelEm(p, data, horario) {
    const d = String(data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const h = String(horario || '').match(/^(\d{1,2}):/);
    if (!d || !h) return true;
    const dia = DIAS[new Date(+d[3], +d[2] - 1, +d[1]).getDay()];
    if (dia === 'dom') return false;
    return verdadeiro(p[dia + (parseInt(h[1], 10) < 12 ? 'Manha' : 'Tarde')]);
  }

  // Abre o perfil do professor da Galeria (aba "Aulas" mostra a disponibilidade).
  // O overlay vive dentro de #galeria-professores (escondida fora da aba), então
  // vai pro body enquanto aberto — com as variáveis --gp-* copiadas — e volta ao
  // lugar quando fecha.
  async function abrirPerfilProfessor(p) {
    const G = window.GaleriaProfessores;
    if (!G || typeof G.abrirDetalhes !== 'function') { aviso('Módulo de professores não carregado.', 'error'); return; }
    try {
      if (!document.getElementById('gp-detOverlay') && typeof G.init === 'function') await G.init();
      const ov = document.getElementById('gp-detOverlay');
      if (!ov) { aviso('Não foi possível abrir o perfil do professor.', 'error'); return; }
      const pai = ov.parentElement, prox = ov.nextSibling;
      const raiz = document.getElementById('galeria-professores');
      const css = (document.getElementById('gp-styles') || {}).textContent || '';
      const vars = [...new Set(css.match(/--gp-[\w-]+(?=\s*:)/g) || [])];
      if (raiz) { const cs = getComputedStyle(raiz); vars.forEach(v => { const val = cs.getPropertyValue(v); if (val) ov.style.setProperty(v, val.trim()); }); }
      ov.style.zIndex = '10070';
      document.body.appendChild(ov);
      G.abrirDetalhes(p);
      const obs = new MutationObserver(() => {
        if (ov.classList.contains('gp-open')) return;
        obs.disconnect();
        ov.style.zIndex = '';
        vars.forEach(v => ov.style.removeProperty(v));
        if (pai && pai.isConnected && pai !== document.body) pai.insertBefore(ov, prox && prox.parentNode === pai ? prox : null);
      });
      obs.observe(ov, { attributes: true, attributeFilter: ['class'] });
    } catch (err) {
      console.error('[Propostas] Erro ao abrir perfil do professor:', err);
      aviso('Não foi possível abrir o perfil do professor.', 'error');
    }
  }

  // Ícones das matérias (área "Lista de matérias" → coleção Disciplinas).
  let iconesMaterias = new Map();
  async function carregarIconesMaterias() {
    const D = window.DisciplinasStore;
    if (!D) return;
    try {
      D.limparCache();
      const lista = await D.getAll();
      iconesMaterias = new Map(lista.map(d => [norm(d.nome), D.iconeDe(d)]));
    } catch (_) { /* sem lista: usa o ícone padrão pelo nome */ }
  }
  function iconeMateria(nome) {
    const D = window.DisciplinasStore;
    return iconesMaterias.get(norm(nome)) || (D && D.iconePadrao ? D.iconePadrao(nome) : 'fas fa-book');
  }

  // Aulas do contrato em BancoDeAulas-Lista (prefixo do id-Aula), por data e horário.
  async function aulasDaLista(codigo) {
    const snap = await fdb().collection('BancoDeAulas-Lista')
      .where('id-Aula', '>=', codigo).where('id-Aula', '<', codigo + '\uf8ff').get();
    const chave = (a) => { const m = String(a.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return (m ? m[3] + m[2] + m[1] : '99999999') + (a.horario || ''); };
    const aulas = [];
    snap.forEach(doc => { const a = doc.data(); if (String(a['id-Aula'] || '').slice(0, codigo.length) === codigo) aulas.push(a); });
    return aulas.sort((x, y) => chave(x).localeCompare(chave(y)));
  }

  async function carregarOrigem(origem, id) {
    const col = origem === 'simulacao' ? 'simulacoes' : 'BancoDeAulas';
    const snap = await fdb().collection(col).doc(String(id)).get();
    if (!snap.exists) return null;
    const d = snap.data();
    const hora = Number(origem === 'simulacao' ? d.valorHoraProfessor : d.horaAulaProfessor) || HORA_PADRAO;
    // Contratação: a lista `aulas` do documento é a cópia de quando o contrato foi
    // criado; as edições da tabela "Aulas Agendadas" (datas, matérias, professores,
    // status) ficam em BancoDeAulas-Lista. Usa a lista antiga só se não houver nada lá.
    let fonte = d.aulas || [];
    if (origem !== 'simulacao') {
      try {
        const lista = await aulasDaLista(String(d.codigoContratacao || id));
        if (lista.length) {
          const doContrato = new Map(fonte.map(a => [a['id-Aula'], a]));
          fonte = lista.map(a => ({ ...a, estudante: a.estudante || (doContrato.get(a['id-Aula']) || {}).estudante || '' }));
        }
      } catch (err) { console.warn('[Propostas] BancoDeAulas-Lista indisponível, usando as aulas do contrato:', err); }
    }
    const aulas = fonte.map((a, i) => {
      const valorSalvo = Number(a.ValorAula);
      return {
        i, idAula: a['id-Aula'] || '', data: a.data || '', horario: a.horario || '', duracao: a.duracao || '', materia: a.materia || '',
        estudante: a.estudante || '', professor: a.professor || '', status: a.StatusAula || (origem !== 'simulacao' ? 'Pendente' : ''),
        valor: Number((valorSalvo > 0 ? valorSalvo : hora * horasDe(a.duracao)).toFixed(2))
      };
    });
    let apelido = '';
    try {
      if (d.cpf) {
        const c = await fdb().collection('cadastroClientes').where('cpf', '==', d.cpf).limit(1).get();
        if (!c.empty) apelido = c.docs[0].data().apelido || '';
      }
    } catch (_) { /* apelido é opcional */ }
    return {
      origem, id: String(id),
      codigo: origem === 'simulacao' ? (d.idSimulacao || id) : (d.codigoContratacao || id),
      clienteNome: d.nomeCliente || d.nome || '', clienteApelido: apelido, cpf: d.cpf || '', aulas
    };
  }

  // ── Envio (2 passos) ─────────────────────────────────────────────────────
  async function abrirEnvio({ origem, id }) {
    injetarEstilo();
    if (!id) { aviso('Salve antes de enviar a proposta para professores.', 'warning'); return; }
    let dados, profs;
    try {
      [dados, profs] = await Promise.all([carregarOrigem(origem, id), carregarProfessores(), carregarIconesMaterias()]);
    } catch (err) {
      console.error('[Propostas] Erro ao carregar:', err);
      aviso('Não foi possível carregar os dados para a proposta.', 'error');
      return;
    }
    if (!dados) { aviso(origem === 'simulacao' ? 'Salve a simulação antes de enviar a proposta.' : 'Contratação não encontrada.', 'warning'); return; }
    if (!dados.aulas.length) { aviso('Não há aulas para enviar.', 'warning'); return; }

    // Só professores com acesso à plataforma (e e-mail) — os outros não veriam a proposta.
    const elegiveis = profs.filter(p => p.acessoPlataforma === true && p.email)
      .sort((a, b) => (ehOuro(a) === ehOuro(b)) ? String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') : (ehOuro(a) ? -1 : 1));
    const disciplinas = [...new Set(elegiveis.flatMap(disciplinasDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const escolhidos = new Set();
    const titulo = origem === 'simulacao' ? `Simulação ${dados.codigo}` : `Contratação ${dados.codigo}`;

    const fundo = document.createElement('div');
    fundo.className = 'pe-fundo';
    fundo.innerHTML = `
      <div class="pe-caixa" role="dialog" aria-modal="true" aria-label="Enviar proposta para professores">
        <div class="pe-topo">
          <h3><i class="fas fa-paper-plane mr-2"></i>Enviar proposta · ${esc(titulo)} · ${esc(dados.clienteNome)}</h3>
          <div class="pe-passos"><span class="on" data-p="1">1. Aulas</span><span data-p="2">2. Professores</span></div>
          <button class="pe-x" aria-label="Fechar">&times;</button>
        </div>
        <div class="pe-trilho"><div class="pe-palco">
          <section class="pe-pag" aria-label="Escolher aulas">
            <div class="pe-corpo">
              <label class="pe-todas"><input type="checkbox" id="pe-todas" checked> Selecionar todas as aulas</label>
              ${dados.aulas.map(a => `
                <label class="pe-aula"><input type="checkbox" class="pe-chk" value="${a.i}" checked>
                  <span class="pe-a1"><b>${esc(a.data || '—')}</b>${a.horario ? ' · ' + esc(a.horario) : ''}${a.duracao ? ' · ' + esc(a.duracao) : ''}<br>
                  ${esc(a.materia || '—')}${a.estudante ? ' · ' + esc(a.estudante) : ''}${a.professor ? ` · <span style="color:#9ca3af">atual: ${esc(a.professor)}</span>` : ''}</span>
                  <span class="pe-a2">${moeda(a.valor)}</span>${a.status ? `<span class="pe-status" style="${corStatus(a.status)}">${esc(a.status)}</span>` : ''}</label>`).join('')}
            </div>
            <div class="pe-rodape">
              <span class="pe-info" id="pe-resumo"></span>
              <button class="pe-btn pri" id="pe-avancar">Escolher professores <i class="fas fa-arrow-right"></i></button>
            </div>
          </section>
          <section class="pe-pag" aria-label="Escolher professores">
            <div class="pe-corpo">
              <div class="pe-filtros">
                <input type="search" id="pe-busca" placeholder="Buscar professor pelo nome ou apelido" aria-label="Buscar professor">
                <div class="pe-multi" id="pe-disc">
                  <button type="button" class="pe-multi-btn" aria-haspopup="true" aria-expanded="false" aria-label="Disciplinas"><span>Todas as disciplinas</span><i class="fas fa-chevron-down"></i></button>
                  <div class="pe-multi-painel" hidden>
                    ${disciplinas.map(d => `<label><input type="checkbox" value="${esc(norm(d))}" data-rotulo="${esc(d)}"> ${esc(d)}</label>`).join('') || '<p class="pe-vazio" style="padding:.6rem">Nenhuma disciplina cadastrada.</p>'}
                    <button type="button" class="pe-multi-limpar">Limpar seleção</button>
                  </div>
                </div>
                <button type="button" class="pe-btn pe-verif" id="pe-vista"></button>
                <label class="pe-ordem" id="pe-ordem-wrap">Ordenar
                  <select id="pe-ordem" aria-label="Ordenar professores">
                    <option value="match">Match</option>
                    <option value="disp">Dentro da disponibilidade</option>
                    <option value="sem-aulas">Sem aulas alocadas</option>
                    <option value="livre">Totalmente livre</option>
                  </select></label>
              </div>
              <div class="pe-grade" id="pe-grade"></div>
            </div>
            <div class="pe-rodape">
              <button class="pe-btn" id="pe-voltar"><i class="fas fa-arrow-left"></i> Voltar</button>
              <span class="pe-info" id="pe-resumo2"></span>
              <button class="pe-btn pri" id="pe-enviar" disabled><i class="fas fa-paper-plane"></i> Enviar proposta</button>
            </div>
          </section>
        </div></div>
      </div>`;
    document.body.appendChild(fundo);
    const $ = (s) => fundo.querySelector(s);
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => {
      if (e.key !== 'Escape' || document.querySelector('#gp-detOverlay.gp-open')) return;
      if (fecharPop()) return;
      if (!$('.pe-multi-painel').hidden) { abrirDisc(false); return; }
      fechar();
    };
    document.addEventListener('keydown', teclas);
    $('.pe-x').onclick = fechar;
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });

    const selecionadas = () => [...fundo.querySelectorAll('.pe-chk:checked')].map(c => dados.aulas[+c.value]);
    function resumo() {
      const s = selecionadas(); const total = s.reduce((t, a) => t + a.valor, 0);
      const txt = `${s.length} ${s.length === 1 ? 'aula' : 'aulas'} · professor recebe <b>${moeda(total)}</b>`;
      $('#pe-resumo').innerHTML = txt;
      $('#pe-resumo2').innerHTML = `${txt} · ${escolhidos.size} ${escolhidos.size === 1 ? 'professor' : 'professores'}`;
      $('#pe-avancar').disabled = !s.length;
      $('#pe-enviar').disabled = !s.length || !escolhidos.size;
      $('#pe-todas').checked = s.length === dados.aulas.length;
    }
    // Vista de indicadores (padrão) x vista geral (grade antiga). verif guarda o
    // cálculo das aulas marcadas: Map professorId → { conflitos, fora, materias, media }.
    let modo = 'indicadores';
    let verif = null, calculando = false, erroCalculo = false, calcId = 0, bairroP = null;
    const aulasMudaram = () => { verif = null; erroCalculo = false; resumo(); };
    $('#pe-todas').onchange = (e) => { fundo.querySelectorAll('.pe-chk').forEach(c => { c.checked = e.target.checked; }); aulasMudaram(); };
    fundo.querySelectorAll('.pe-chk').forEach(c => { c.onchange = aulasMudaram; });

    function passo(n) {
      $('.pe-palco').classList.toggle('passo2', n === 2);
      fundo.querySelectorAll('.pe-passos span').forEach(s => s.classList.toggle('on', s.dataset.p === String(n)));
      setTimeout(() => { (n === 2 ? $('#pe-busca') : $('#pe-avancar')).focus({ preventScroll: true }); $('.pe-trilho').scrollLeft = 0; }, 460);
    }
    $('#pe-avancar').onclick = () => { passo(2); if (modo === 'indicadores' && !verif) calcular(); else desenharGrade(); };
    $('#pe-voltar').onclick = () => passo(1);

    // Disciplinas marcadas no dropdown: o professor precisa dar TODAS.
    const discMarcadas = () => [...fundo.querySelectorAll('.pe-multi-painel input:checked')];
    function desenharGrade() {
      const busca = norm($('#pe-busca').value), discs = discMarcadas().map(c => c.value);
      const lista = elegiveis.filter(p => (!busca || norm(p.nome).includes(busca) || norm(p.apelido).includes(busca))
        && (!discs.length || (() => { const dp = disciplinasDe(p).map(norm); return discs.every(d => dp.includes(d)); })()));
      const grade = $('#pe-grade');
      const ind = modo === 'indicadores';
      grade.classList.toggle('pe-grade-ind', ind);
      $('#pe-ordem-wrap').hidden = !ind;
      $('#pe-vista').innerHTML = ind ? '<i class="fas fa-table-cells"></i> Vista geral de professores' : '<i class="fas fa-chart-simple"></i> Vista de indicadores completa';
      fecharPop();
      const vazio = '<p class="pe-vazio" style="grid-column:1/-1">Nenhum professor com acesso à plataforma encontrado para este filtro.</p>';
      const apelidoDe = (p) => p.apelido || String(p.nome || '').split(' ')[0] || 'Professor';
      const fotoHtml = (p) => { const foto = fotoDe(p); return foto ? `<img class="pe-foto" src="${esc(foto)}" alt="" loading="lazy">` : `<span class="pe-iniciais">${esc(iniciais(p.nome))}</span>`; };

      if (!ind) {
        grade.innerHTML = lista.length ? lista.map(p => `<button type="button" class="pe-prof" data-id="${esc(p.id)}" aria-pressed="${escolhidos.has(p.id)}">
          ${ehOuro(p) ? '<i class="fas fa-star pe-ouro" title="Professor de ouro"></i>' : ''}<span class="pe-marca"><i class="fas fa-check"></i></span>
          ${fotoHtml(p)}<b>${esc(apelidoDe(p))}</b><small>${esc(p.nome || '')}</small></button>`).join('') : vazio;
      } else if (calculando || (!verif && !erroCalculo)) {
        grade.innerHTML = '<p class="pe-carregando"><i class="fas fa-spinner fa-spin"></i> Calculando match dos professores...</p>';
      } else if (!verif) {
        grade.innerHTML = '<p class="pe-carregando">Não foi possível calcular o match. <button type="button" class="pe-btn" id="pe-recalcular"><i class="fas fa-rotate-right"></i> Tentar de novo</button></p>';
        $('#pe-recalcular').onclick = calcular;
      } else {
        const nota = (p) => { const v = verif.get(p.id); return v && v.media !== null ? v.media : -1; };
        // Ordenar: professores de ouro sempre no topo; depois quem atende o critério
        // escolhido (disponibilidade / sem aulas no dia / os dois); depois maior match e nome.
        const criterio = $('#pe-ordem').value;
        const atende = (p) => {
          const v = verif.get(p.id); if (!v) return 0;
          const semFora = !v.fora.length, semDia = !v.conflitos.length;
          return criterio === 'disp' ? +semFora : criterio === 'sem-aulas' ? +semDia : criterio === 'livre' ? +(semFora && semDia) : 0;
        };
        const ordem = [...lista].sort((a, b) => (ehOuro(b) - ehOuro(a)) || (atende(b) - atende(a)) || nota(b) - nota(a) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        grade.innerHTML = ordem.length ? ordem.map(p => {
          const v = verif.get(p.id) || { conflitos: [], fora: [], materias: [], media: null };
          const dia = v.conflitos.length > 0, fora = v.fora.length > 0;
          // Cor do card: verde (ok), amarelo (aula no dia), laranja (fora da disponibilidade), vermelho (os dois).
          const st = dia && fora ? 'st-ambos' : dia ? 'st-dia' : fora ? 'st-fora' : 'st-ok';
          const id = esc(p.id);
          // Ícones de pendência ocupam os terços da esquerda para a direita: com uma só, ela vai
          // para o 1º terço; com as duas, disponibilidade no 1º e choque de aulas no 2º.
          const pend = [
            fora ? `<span class="pe-slot fora"><small>Fora da disponibilidade</small><button type="button" class="pe-pend-ico fora" data-id="${id}" data-pop="fora" title="Fora da disponibilidade" aria-label="Fora da disponibilidade — ver detalhes"><i class="far fa-clock"></i><span class="pe-n">${v.fora.length}</span></button></span>` : '',
            dia ? `<span class="pe-slot dia"><small>Aulas agendadas</small><button type="button" class="pe-pend-ico dia" data-id="${id}" data-pop="dia" title="Aula no mesmo dia" aria-label="${v.conflitos.length} aula(s) no mesmo dia — ver detalhes"><i class="fas fa-calendar-xmark"></i><span class="pe-n">${v.conflitos.length}</span></button></span>` : ''
          ].filter(Boolean);
          return `<div class="pe-ind ${st}" role="button" tabindex="0" data-id="${id}" aria-pressed="${escolhidos.has(p.id)}">
            <div class="pe-ind-foto">${fotoHtml(p)}${ehOuro(p) ? '<i class="fas fa-star pe-ouro" title="Professor de ouro"></i>' : ''}
              ${v.media !== null ? `<span class="pe-selo" style="--p:${v.media}" title="Match${v.materias.length > 1 ? ' (média das matérias)' : ''}"><b>${v.media}%</b><small>Match</small></span>` : ''}</div>
            <div class="pe-ind-info">
              <div class="pe-ind-topo"><div><b>${esc(apelidoDe(p))}</b><small>${esc(p.nome || '')}</small></div>
                <span class="pe-ind-sinais"><span class="pe-marca"><i class="fas fa-check"></i></span></span></div>
              ${v.materias.length ? `<div class="pe-mats" role="list" aria-label="Matérias das aulas marcadas">${v.materias.map(m =>
                `<span class="pe-mat${m.leciona ? '' : ' nao'}" role="listitem" title="${esc(m.nome)} — ${m.leciona ? 'leciona (' + m.taxa + '% de match)' : 'não leciona'}" aria-label="${esc(m.nome)}: ${m.leciona ? 'leciona, ' + m.taxa + '% de match' : 'não leciona'}"><i class="${esc(iconeMateria(m.nome))}"></i></span>`).join('')}</div>`
                : '<div class="pe-media">Sem matéria definida nas aulas marcadas.</div>'}
              <div class="pe-ind-rodape">
                <span>${pend[0] || ''}</span>
                <span>${pend[1] || ''}</span>
                ${v.materias.length ? `<button type="button" class="pe-info-ico" data-id="${id}" data-pop="just" title="Ver justificativa do match" aria-label="Ver justificativa do match"><i class="fas fa-info"></i></button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('') : vazio;
      }

      fundo.querySelectorAll('.pe-ver-disp').forEach(b => {
        b.onclick = () => { const p = elegiveis.find(x => x.id === b.dataset.id); if (p) abrirPerfilProfessor(p); };
      });
      fundo.querySelectorAll('.pe-info-ico, .pe-pend-ico[data-pop]').forEach(b => { b.onclick = () => abrirPop(b); });
      const alternar = (el) => {
        const pid = el.dataset.id;
        if (escolhidos.has(pid)) escolhidos.delete(pid); else escolhidos.add(pid);
        el.setAttribute('aria-pressed', String(escolhidos.has(pid)));
        resumo();
      };
      fundo.querySelectorAll('.pe-prof').forEach(b => { b.onclick = () => alternar(b); });
      fundo.querySelectorAll('.pe-ind').forEach(c => {
        c.onclick = (e) => { if (!e.target.closest('button')) alternar(c); };
        c.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); alternar(c); } };
      });
    }

    // Balões sobre os cards: justificativa do match (ⓘ), aulas no mesmo dia e fora
    // da disponibilidade (ícones do rodapé do card). Clicar de novo no mesmo ícone fecha.
    let pop = null;
    function fecharPop() { if (!pop) return false; pop.remove(); pop = null; return true; }
    function abrirPop(botao) {
      const tipo = botao.dataset.pop || 'just';
      const chave = botao.dataset.id + ':' + tipo;
      const aberto = pop && pop.dataset.chave === chave;
      fecharPop();
      if (aberto) return;
      const v = verif && verif.get(botao.dataset.id);
      if (!v) return;
      pop = document.createElement('div');
      pop.className = 'pe-pop' + (tipo === 'just' ? '' : ' ' + tipo);
      pop.dataset.chave = chave;
      pop.setAttribute('role', 'dialog');
      if (tipo === 'dia') {
        pop.setAttribute('aria-label', 'Aulas no mesmo dia');
        pop.innerHTML = `<p class="pe-pop-tit">Este professor já tem aula neste dia com:</p><ul>${v.conflitos.map(c =>
          `<li>${esc(diaSemanaMes(c.data))} · ${esc(c.cliente)} às ${esc(c.horario || '--:--')}</li>`).join('')}</ul>`;
      } else if (tipo === 'fora') {
        pop.setAttribute('aria-label', 'Fora da disponibilidade');
        pop.innerHTML = `<p class="pe-pop-tit">O dia e horário está fora da disponibilidade do professor</p><ul>${v.fora.map(a =>
          `<li>${esc(diaSemanaMes(a.data))}${a.horario ? ' às ' + esc(a.horario) : ''}</li>`).join('')}</ul>
          <button type="button" class="pe-btn pe-ver-disp"><i class="fas fa-calendar-week"></i> Ver disponibilidade</button>`;
        pop.querySelector('.pe-ver-disp').onclick = () => {
          const p = elegiveis.find(x => x.id === botao.dataset.id);
          fecharPop();
          if (p) abrirPerfilProfessor(p);
        };
      } else {
        pop.setAttribute('aria-label', 'Justificativa do match');
        pop.innerHTML = v.materias.map(m => `<h4><span>${esc(m.nome)}</span><span>${m.leciona ? m.taxa + '%' : 'Não leciona'}</span></h4>
          ${!m.leciona ? '<p>O professor não leciona esta matéria (conta 0% na média).</p>'
            : m.detalhes.length ? `<ul>${m.detalhes.map(d => `<li><span>${esc(d.label)}</span><b>+${d.pontos}</b></li>`).join('')}</ul>
              <p>${m.pontos} de ${m.max} pontos possíveis.</p>` : '<p>Nenhum critério pontuou.</p>'}`).join('');
      }
      fundo.appendChild(pop);
      const r = botao.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      let top = r.bottom + 6, left = tipo === 'just' ? r.right - pr.width : r.left;
      if (top + pr.height > innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
      pop.style.top = top + 'px';
      pop.style.left = Math.max(8, Math.min(left, innerWidth - pr.width - 8)) + 'px';
    }
    fundo.addEventListener('mousedown', e => { if (pop && !e.target.closest('.pe-pop, .pe-info-ico, .pe-pend-ico')) fecharPop(); });
    fundo.addEventListener('scroll', () => fecharPop(), true);
    $('#pe-busca').oninput = desenharGrade;
    $('#pe-ordem').onchange = desenharGrade;

    // Dropdown de múltiplas disciplinas
    const btnDisc = $('.pe-multi-btn'), painelDisc = $('.pe-multi-painel');
    function abrirDisc(abrir) { painelDisc.hidden = !abrir; btnDisc.setAttribute('aria-expanded', String(abrir)); }
    function rotuloDisc() {
      const m = discMarcadas().map(c => c.dataset.rotulo);
      btnDisc.querySelector('span').textContent = !m.length ? 'Todas as disciplinas' : m.length <= 2 ? m.join(' + ') : `${m.length} disciplinas`;
      btnDisc.title = m.join(', ');
    }
    btnDisc.onclick = () => abrirDisc(painelDisc.hidden);
    painelDisc.querySelectorAll('input').forEach(c => { c.onchange = () => { rotuloDisc(); desenharGrade(); }; });
    $('.pe-multi-limpar').onclick = () => { painelDisc.querySelectorAll('input').forEach(c => { c.checked = false; }); rotuloDisc(); desenharGrade(); };
    fundo.addEventListener('mousedown', e => { if (!painelDisc.hidden && !e.target.closest('.pe-multi')) abrirDisc(false); });

    // Cálculo da vista de indicadores, para as aulas marcadas no passo 1:
    //  • conflitos: aulas do mesmo dia em outros contratos (BancoDeAulas-Lista);
    //  • fora: aulas fora da disponibilidade cadastrada;
    //  • match por matéria: mesma pontuação do botão "Match" (match.js). Em vez de
    //    baixar todas as aulas do sistema, basta o que a pontuação usa: as aulas nas
    //    datas marcadas (agenda) e as aulas deste cliente ("já atendeu antes").
    async function calcular() {
      const meu = ++calcId;
      calculando = true; erroCalculo = false; verif = null;
      desenharGrade();
      try {
        const marcadas = selecionadas();
        const aulas = marcadas.filter(a => a.data);
        const M = window.Match && typeof window.Match.pontuarProfessor === 'function' ? window.Match : null;
        const datas = [...new Set(aulas.map(a => a.data))];
        const col = fdb().collection('BancoDeAulas-Lista');
        if (M && !bairroP) bairroP = M.resolverBairroCliente(dados.cpf).catch(() => ({ bairro: '', origemCep: false }));
        const [snaps, snapCliente, bairro] = await Promise.all([
          Promise.all(datas.map(d => col.where('data', '==', d).get())),
          M && dados.cpf ? col.where('cpf', '==', dados.cpf).get() : Promise.resolve(null),
          M ? bairroP : Promise.resolve(null)
        ]);
        if (meu !== calcId) return;
        const sistema = new Map();
        [...snaps, snapCliente].forEach(snap => snap && snap.forEach(doc => sistema.set(doc.id, { id: doc.id, ...doc.data() })));
        const grupos = M ? M.montarGruposPorDisciplina(marcadas) : {};
        const chaves = Object.keys(grupos);
        const porProf = new Map();
        snaps.forEach(snap => snap.forEach(doc => {
          const a = doc.data();
          if (!a.idProfessor || a.idProfessor === 'A definir' || STATUS_SEM_CONFLITO.includes(a.StatusAula)) return;
          // Aulas desta mesma contratação não são conflito.
          if (dados.origem !== 'simulacao' && String(a.codigoContratacao || '') === String(dados.codigo)) return;
          const k = String(a.idProfessor);
          if (!porProf.has(k)) porProf.set(k, []);
          porProf.get(k).push({ cliente: a.nomeCliente || a.nome || 'Cliente', data: a.data || '', horario: a.horario || '' });
        }));
        const chave = (c) => { const m = String(c.data).match(/(\d{2})\/(\d{2})\/(\d{4})/); return (m ? m[3] + m[2] + m[1] : '') + c.horario; };
        const listaSistema = [...sistema.values()];
        const novo = new Map();
        elegiveis.forEach(p => {
          const ids = [...new Set([p.cpf, p.id].filter(Boolean).map(String))];
          const conflitos = ids.flatMap(k => porProf.get(k) || []).sort((x, y) => chave(x).localeCompare(chave(y)));
          // Uma barra por matéria das aulas marcadas; "Não leciona" conta 0% na média.
          const materias = chaves.map(k => {
            if (!M.professorLecionaMateria(p, k)) return { nome: grupos[k].nome, leciona: false, taxa: 0, detalhes: [], pontos: 0, max: 0 };
            const r = M.pontuarProfessor(p, grupos[k], bairro, listaSistema, String(dados.codigo), dados.cpf);
            return { nome: grupos[k].nome, leciona: true, taxa: r.taxaMatch, detalhes: r.detalhes, pontos: r.pontos, max: r.maxPontos };
          });
          const media = materias.length ? Math.round(materias.reduce((t, m) => t + m.taxa, 0) / materias.length) : null;
          novo.set(p.id, { conflitos, fora: aulas.filter(a => !disponivelEm(p, a.data, a.horario)), materias, media });
        });
        verif = novo;
      } catch (err) {
        if (meu !== calcId) return;
        console.error('[Propostas] Erro ao calcular o match dos professores:', err);
        erroCalculo = true;
      }
      calculando = false;
      if (modo === 'indicadores') desenharGrade();
    }

    // Alterna entre a vista de indicadores completa e a vista geral (grade antiga).
    $('#pe-vista').onclick = () => {
      modo = modo === 'indicadores' ? 'geral' : 'indicadores';
      if (modo === 'indicadores' && !verif && !calculando) calcular(); else desenharGrade();
    };
    desenharGrade();
    resumo();

    $('#pe-enviar').onclick = async () => {
      // idAula liga cada aula da proposta à aula real (BancoDeAulas-Lista) para
      // "Atribuir às aulas" depois do aceite.
      const aulas = selecionadas().map(a => ({ idAula: a.idAula || '', data: a.data, horario: a.horario, duracao: a.duracao, materia: a.materia, estudante: a.estudante, valor: a.valor }));
      const total = Number(aulas.reduce((t, a) => t + a.valor, 0).toFixed(2));
      const lote = fdb().batch();
      const quem = (window.currentUser && window.currentUser.email) || '';
      [...escolhidos].forEach(pid => {
        const p = elegiveis.find(x => x.id === pid);
        lote.set(fdb().collection(COLECAO).doc(), {
          origem: dados.origem, idOrigem: dados.id, codigo: String(dados.codigo),
          clienteNome: dados.clienteNome, clienteApelido: dados.clienteApelido,
          professorId: p.id, professorEmail: String(p.email).trim().toLowerCase(),
          professorNome: p.nome || '', professorApelido: p.apelido || '',
          aulas, valorTotal: total,
          status: 'pendente', contraproposta: '', respondidoEm: null, lidaCentral: false,
          enviadoPor: quem, criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      const btn = $('#pe-enviar');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      try {
        await lote.commit();
        aviso(`Proposta enviada para ${escolhidos.size} ${escolhidos.size === 1 ? 'professor' : 'professores'}.`, 'success');
        fechar();
      } catch (err) {
        console.error('[Propostas] Erro ao enviar:', err);
        aviso('Não foi possível enviar a proposta. Tente novamente.', 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar proposta';
      }
    };
  }

  // ── Notificações ─────────────────────────────────────────────────────────
  let propostas = [];
  let filtro = 'respondidas';
  let cancelar = null;

  const STATUS = {
    aceita:         { texto: 'aceitou', icone: 'fas fa-circle-check' },
    recusada:       { texto: 'recusou', icone: 'fas fa-circle-xmark' },
    contraproposta: { texto: 'realizou contraproposta', icone: 'fas fa-comment-dots' },
    encerrada:      { texto: 'não respondeu a tempo (aulas já atribuídas a outro professor)', icone: 'fas fa-lock' },
    pendente:       { texto: '', icone: 'far fa-clock' }
  };
  const naoLidas = () => propostas.filter(p => p.status !== 'pendente' && !p.lidaCentral).length;

  // Pedidos de reagendar/cancelar dos clientes (solicitacoes-clientes.js) somam no mesmo contador.
  const naoLidasClientes = () => (window.SolicitacoesClientes ? window.SolicitacoesClientes.naoLidas() : 0);

  function atualizarContador() {
    const el = document.getElementById('contador-notificacoes');
    const chip = document.querySelector('.nt-chip[data-f="clientes"] .nt-chip-n');
    if (chip) { const c = naoLidasClientes(); chip.textContent = c; chip.hidden = c === 0; }
    if (!el) return;
    const n = naoLidas() + naoLidasClientes();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
  }

  function iniciarEscuta() {
    if (cancelar || !window.firebase || !window.currentUser) return;
    injetarEstilo();
    cancelar = fdb().collection(COLECAO).onSnapshot((snap) => {
      propostas = [];
      snap.forEach(d => propostas.push({ id: d.id, ...d.data() }));
      atualizarContador();
      const sec = document.getElementById('notificacoes');
      if (sec && sec.classList.contains('active') && sec.querySelector('.nt-wrap')) desenharNotificacoes();
    }, (err) => console.warn('[Notificações] Escuta indisponível:', err && err.code));
  }

  function ordenar(lista) {
    const t = (x) => (x && x.toMillis ? x.toMillis() : 0);
    return lista.slice().sort((a, b) => {
      const na = a.status !== 'pendente' && !a.lidaCentral, nb = b.status !== 'pendente' && !b.lidaCentral;
      if (na !== nb) return na ? -1 : 1;
      return (t(b.respondidoEm) || t(b.criadoEm)) - (t(a.respondidoEm) || t(a.criadoEm));
    });
  }

  function desenharNotificacoes() {
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    const cont = sec.querySelector('.nt-conteudo');
    sec.querySelectorAll('.nt-chip').forEach(c => c.classList.toggle('on', c.dataset.f === filtro));
    const dica = sec.querySelector('.nt-dica');
    if (dica) dica.hidden = filtro === 'clientes';
    if (filtro === 'clientes') {
      if (window.SolicitacoesClientes) window.SolicitacoesClientes.desenhar(cont);
      return;
    }
    const lista = ordenar(propostas.filter(p => filtro === 'todas' ? true : filtro === 'aguardando' ? p.status === 'pendente' : p.status !== 'pendente'));
    sec.querySelectorAll('.nt-chip').forEach(c => c.classList.toggle('on', c.dataset.f === filtro));
    if (!lista.length) {
      cont.innerHTML = `<p class="pe-vazio">${filtro === 'aguardando' ? 'Nenhuma proposta aguardando resposta.' : 'Nenhuma notificação por aqui.'}</p>`;
      return;
    }
    cont.innerHTML = `<div class="nt-grade">${lista.map(p => {
      const st = STATUS[p.status] || STATUS.pendente;
      const prof = p.professorApelido || String(p.professorNome || '').split(' ')[0] || 'Professor';
      const linha = p.status === 'pendente' ? `Aguardando resposta do professor ${esc(prof)}` : `Professor ${esc(prof)} ${st.texto}`;
      return `<button type="button" class="nt-card ${esc(p.status)}" data-id="${esc(p.id)}">
        ${p.status === 'aceita' ? '<span class="nt-tag">Aula fechada</span>' : ''}
        ${p.status !== 'pendente' && !p.lidaCentral ? '<span class="nt-novo" title="Não lida"></span>' : ''}
        <span class="nt-num">${p.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${esc(p.codigo || '')}</span>
        <span class="nt-apelido">${esc(p.clienteApelido || String(p.clienteNome || '').split(' ')[0] || 'Cliente')}</span>
        <span class="nt-nome">${esc(p.clienteNome || '')}</span>
        <span class="nt-status ${esc(p.status)}"><i class="${st.icone}"></i>${linha}</span>
        <span class="nt-data">${esc(fmtData(p.respondidoEm) || ('Enviada em ' + fmtData(p.criadoEm)))} · ${(p.aulas || []).length} aulas · ${moeda(p.valorTotal)}</span>
      </button>`;
    }).join('')}</div>`;

    cont.querySelectorAll('.nt-card').forEach(card => {
      const p = propostas.find(x => x.id === card.dataset.id);
      card.onclick = () => abrirDetalhe(p);
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); menuExcluir(p, e.clientX, e.clientY); });
      // Toque longo (celular/tablet) abre o mesmo menu.
      let timer = null;
      card.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        timer = setTimeout(() => { timer = 'aberto'; menuExcluir(p, t.clientX, t.clientY); }, 550);
      }, { passive: true });
      const parar = () => { if (timer && timer !== 'aberto') clearTimeout(timer); };
      card.addEventListener('touchmove', parar, { passive: true });
      card.addEventListener('touchend', (e) => { if (timer === 'aberto') e.preventDefault(); parar(); timer = null; });
    });
  }

  function janela(titulo, corpo, botoes) {
    return new Promise(resolve => {
      const f = document.createElement('div');
      f.className = 'pe-fundo';
      f.innerHTML = `<div class="pe-caixa" style="max-width:520px" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="pe-topo"><h3>${esc(titulo)}</h3><button class="pe-x" aria-label="Fechar">&times;</button></div>
        <div class="pe-corpo">${corpo}</div>
        <div class="pe-rodape" style="justify-content:flex-end">${botoes.map((b, i) => `<button class="pe-btn ${b.classe || ''}" data-i="${i}">${esc(b.rotulo)}</button>`).join('')}</div></div>`;
      const fim = (v) => { f.remove(); document.removeEventListener('keydown', k); resolve(v); };
      const k = (e) => { if (e.key === 'Escape') fim(null); };
      document.addEventListener('keydown', k);
      f.querySelector('.pe-x').onclick = () => fim(null);
      f.addEventListener('mousedown', e => { if (e.target === f) fim(null); });
      f.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => fim(botoes[+b.dataset.i].valor); });
      document.body.appendChild(f);
    });
  }

  async function abrirDetalhe(p) {
    if (p.status !== 'pendente' && !p.lidaCentral) {
      fdb().collection(COLECAO).doc(p.id).update({ lidaCentral: true }).catch(err => console.warn('[Notificações] Não marcou como lida:', err && err.code));
    }
    const st = STATUS[p.status] || STATUS.pendente;
    const prof = p.professorApelido || p.professorNome || 'Professor';
    const aulas = (p.aulas || []).map(a => `<li><b>${esc(a.data)}</b> · ${esc(a.horario)} · ${esc(a.duracao)} · ${esc(a.materia)}${a.estudante ? ' · ' + esc(a.estudante) : ''}</li>`).join('');
    const escolha = await janela(`${p.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${p.codigo || ''} · ${p.clienteNome || ''}`, `
      <p class="nt-status ${esc(p.status)}" style="margin:0 0 .8rem"><i class="${st.icone}"></i>${p.status === 'pendente' ? `Aguardando resposta do professor ${esc(prof)}` : `Professor ${esc(prof)} ${st.texto}`}</p>
      ${p.status === 'contraproposta' ? `<p style="font-weight:700;margin:0 0 .4rem">Contraproposta do professor:</p><div class="nt-texto">${esc(p.contraproposta || '')}</div>` : ''}
      <p style="margin:1rem 0 0;font-size:.85rem;color:#374151">Aulas enviadas (${(p.aulas || []).length}) · professor recebe <b>${moeda(p.valorTotal)}</b> · professor: ${esc(p.professorNome || '')}</p>
      <ul class="nt-aulas">${aulas}</ul>
      ${p.status === 'aceita' && p.atribuidaEm ? '<p style="margin:.6rem 0 0;font-size:.85rem;color:#15803d"><i class="fas fa-check"></i> Professor já atribuído às aulas.</p>' : ''}
      ${p.status === 'aceita' && p.origem === 'simulacao' ? '<p style="margin:.6rem 0 0;font-size:.85rem;color:#6b7280">Simulação: escolha este professor nas aulas da simulação antes de aprovar.</p>' : ''}`,
      p.status === 'aceita' && p.origem !== 'simulacao' && !p.atribuidaEm
        ? [{ rotulo: 'Fechar', valor: null }, { rotulo: 'Atribuir às aulas', valor: 'atribuir', classe: 'pri' }]
        : [{ rotulo: 'Fechar', valor: null, classe: 'pri' }]);
    if (escolha === 'atribuir') await atribuirAsAulas(p);
  }

  // Aceite → grava o professor nas aulas da contratação (BANCO.updateProfessorAula
  // já resolve professorEmail/uid) e encerra as outras propostas pendentes da
  // mesma contratação, que somem como "encerrada" para os outros professores.
  async function atribuirAsAulas(p) {
    if (!window.BANCO || typeof BANCO.updateProfessorAula !== 'function') { aviso('Função de atribuição indisponível.', 'error'); return; }
    try {
      const profSnap = await fdb().collection('dataBaseProfessores').doc(String(p.professorId)).get();
      if (!profSnap.exists) { aviso('Cadastro do professor não encontrado.', 'error'); return; }
      const prof = profSnap.data();

      const codigo = String(p.idOrigem || p.codigo || '');
      const [porId, porCodigo] = await Promise.all([
        fdb().collection('BancoDeAulas-Lista').where('idContratacao', '==', codigo).get(),
        fdb().collection('BancoDeAulas-Lista').where('codigoContratacao', '==', codigo).get()
      ]);
      const doContrato = new Map();
      [...porId.docs, ...porCodigo.docs].forEach(d => doContrato.set(d.id, d.data()));
      const listaAulas = [...doContrato.values()];

      let ok = 0, semPar = 0;
      for (const a of (p.aulas || [])) {
        const alvo = (a.idAula && listaAulas.find(x => x['id-Aula'] === a.idAula))
          || listaAulas.find(x => x.data === a.data && x.horario === a.horario);
        if (!alvo || !alvo['id-Aula']) { semPar++; continue; }
        await BANCO.updateProfessorAula(alvo['id-Aula'], prof.nome || p.professorNome || '', prof.cpf || '', prof.uid || '');
        ok++;
      }

      await fdb().collection(COLECAO).doc(p.id).update({ atribuidaEm: firebase.firestore.FieldValue.serverTimestamp() });
      const outras = propostas.filter(x => x.id !== p.id && String(x.idOrigem) === String(p.idOrigem) && x.status === 'pendente');
      if (outras.length) {
        const lote = fdb().batch();
        outras.forEach(x => lote.update(fdb().collection(COLECAO).doc(x.id), { status: 'encerrada', lidaCentral: true }));
        await lote.commit();
      }
      aviso(`Professor atribuído a ${ok} aula(s)${semPar ? ` · ${semPar} não encontrada(s) na contratação (confira datas/horários)` : ''}${outras.length ? ` · ${outras.length} proposta(s) pendente(s) encerrada(s)` : ''}.`, semPar ? 'warning' : 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao atribuir:', err);
      aviso('Não foi possível atribuir o professor às aulas.', 'error');
    }
  }

  function menuExcluir(p, x, y) {
    document.querySelector('.nt-menu')?.remove();
    const m = document.createElement('div');
    m.className = 'nt-menu';
    m.innerHTML = '<button type="button"><i class="fas fa-trash"></i> Excluir</button>';
    m.style.left = Math.min(x, innerWidth - 180) + 'px';
    m.style.top = Math.min(y, innerHeight - 60) + 'px';
    document.body.appendChild(m);
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', fora, true); document.removeEventListener('touchstart', fora, true); } };
    setTimeout(() => { document.addEventListener('mousedown', fora, true); document.addEventListener('touchstart', fora, true); }, 0);
    m.querySelector('button').onclick = async () => {
      m.remove();
      const ok = await janela('Excluir proposta', `<p style="margin:0;font-size:.92rem;color:#374151;line-height:1.55">Excluir a proposta de <b>${esc(p.clienteNome || '')}</b> enviada ao professor <b>${esc(p.professorApelido || p.professorNome || '')}</b>?<br><br>Ela também <b>some da área do professor</b>. Para mudar as aulas, exclua e envie uma nova proposta.</p>`,
        [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir', valor: true, classe: 'perigo' }]);
      if (!ok) return;
      try { await fdb().collection(COLECAO).doc(p.id).delete(); aviso('Proposta excluída.', 'success'); }
      catch (err) { console.error('[Notificações] Erro ao excluir:', err); aviso('Não foi possível excluir.', 'error'); }
    };
  }

  function loadNotificacoes() {
    injetarEstilo();
    iniciarEscuta();
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    sec.innerHTML = `<div class="nt-wrap">
      <div class="nt-barra">
        <button class="nt-chip" data-f="clientes"><i class="fas fa-user-clock"></i> Clientes · reagendar/cancelar <span class="nt-chip-n" hidden>0</span></button>
        <button class="nt-chip" data-f="respondidas">Respondidas</button>
        <button class="nt-chip" data-f="aguardando">Aguardando resposta</button>
        <button class="nt-chip" data-f="todas">Todas</button>
        <span class="nt-dica">Clique com o botão direito (ou segure o dedo) num card para excluir.</span>
      </div>
      <div class="nt-conteudo"><p class="pe-vazio">Carregando…</p></div></div>`;
    sec.querySelectorAll('.nt-chip').forEach(c => { c.onclick = () => { filtro = c.dataset.f; desenharNotificacoes(); }; });
    // Com pedido de cliente sem ler, a área já abre nessa aba.
    if (naoLidasClientes() > 0) filtro = 'clientes';
    atualizarContador();
    if (cancelar || filtro === 'clientes') desenharNotificacoes();
  }

  // Começa a escutar assim que o login do Central terminar (contador no menu).
  const espera = setInterval(() => { if (window.currentUser && window.firebase) { clearInterval(espera); iniciarEscuta(); } }, 500);
  setTimeout(() => clearInterval(espera), 60000);

  window.PropostasProfessores = { abrirEnvio };
  window.atualizarContadorNotificacoesCentral = atualizarContador;
  window.loadNotificacoes = loadNotificacoes;
})();
