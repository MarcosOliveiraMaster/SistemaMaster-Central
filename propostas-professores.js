// propostas-professores.js
// Propostas de aulas para professores (coleção propostasProfessores).
//
// 1) Envio — botão "Enviar proposta para professores" nos modais de Simulação e
//    de Detalhes da contratação:
//      passo 1: caixas de seleção das aulas (versão SALVA da simulação/contratação);
//      passo 2 (com animação): grade de professores com filtro por nome e
//      disciplina — só quem tem acesso à plataforma, professores de ouro primeiro.
//    Cada professor escolhido recebe um documento com as aulas marcadas e o total
//    que ELE recebe (hora/aula do professor × duração), mais estudantes, bairro,
//    cidade e conteúdos da contratação. Sem CPF, pacote ou lucro.
// 2) Área "Propostas" (antiga Notificações) — um card por contratação/simulação;
//    dentro, os cards 4:3 (resumo + calendário) de cada proposta com as
//    respostas: aceite, recusa com motivo e contraproposta por aula. Aprovar
//    contraproposta, gerar solicitação, confirmar o professor, reenviar, enviar para
//    análise e apagar; aceite sem alteração vincula o professor sozinho
//    (detalhes no bloco "Notificações: grid das propostas").
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
    .pe-aula .pe-a1{flex:1;min-width:0;font-size:.85rem;color:#111827;line-height:1.45;}
    #pe-disc-aula{flex:0 0 40%;}
    .pe-aula .pe-a1 b{color:#111827;}
    .pe-aula .pe-a2{font-family:'Lexend',sans-serif;font-weight:700;color:#15803d;white-space:nowrap;}
    .pe-aula .pe-status{flex-shrink:0;min-width:84px;text-align:center;border:1.5px solid;border-radius:8px;padding:.15rem .5rem;font-size:.72rem;font-weight:700;white-space:nowrap;}
    .pe-todas{display:flex;gap:.5rem;align-items:center;font-size:.85rem;font-weight:700;margin-bottom:.7rem;cursor:pointer;}
    .pe-todas input{width:18px;height:18px;accent-color:var(--pe-acc);}
    .pe-aula[hidden],.pe-todas[hidden],.pe-vazio[hidden]{display:none;}
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
    .pe-grade.pe-grade-ind{grid-template-columns:repeat(auto-fill,minmax(max(230px,calc((100% - 3.6rem)/5)),1fr));grid-auto-rows:1fr;align-items:stretch;gap:.9rem;}
    .pe-ind{--st-bg:#fff;--st-borda:#e5e7eb;position:relative;display:flex;flex-direction:column;gap:.6rem;border:2px solid var(--st-borda);border-radius:18px;padding:.6rem;background:var(--st-bg);cursor:pointer;text-align:left;min-width:0;transition:box-shadow .15s,transform .15s;}
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
    .pe-ind-foto{position:relative;margin-bottom:.25rem;}
    .pe-ind-foto img,.pe-ind-foto .pe-iniciais{width:100%;aspect-ratio:16/11;border-radius:14px;object-fit:cover;object-position:center 22%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.75);color:var(--pe-acc-esc);font:700 2.4rem 'Lexend',sans-serif;}
    .pe-selo{position:absolute;right:10px;bottom:-22px;width:56px;height:56px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.14);}
    .pe-selo::before{content:"";position:absolute;inset:3px;border-radius:50%;background:conic-gradient(var(--pe-acc) calc(var(--p) * 1%),#eef0f3 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 0);}
    .pe-selo b{font:700 .95rem 'Lexend',sans-serif;color:var(--pe-acc-esc);line-height:1;font-variant-numeric:tabular-nums;}
    .pe-selo small{font:500 .52rem 'Lexend',sans-serif;color:#6b7280;margin-top:2px;letter-spacing:.04em;text-transform:uppercase;}
    .pe-ind-foto .pe-ouro{position:absolute;top:8px;left:8px;width:26px;height:26px;border-radius:50%;background:#fff;color:#eab308;display:flex;align-items:center;justify-content:center;font-size:.8rem;box-shadow:0 2px 6px rgba(0,0,0,.18);}
    .pe-ind-nome{min-width:0;padding:0 64px 0 .25rem;}
    .pe-ind-nome b{display:block;font:700 1.05rem/1.2 'Lexend',sans-serif;color:#111827;}
    .pe-ind-nome small{display:block;font-size:.74rem;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .pe-ind .pe-mats{padding:0 .25rem;}
    .pe-ind .pe-media{padding:0 .25rem;}
    .pe-ind-cantos{position:absolute;top:8px;right:8px;display:flex;gap:6px;align-items:center;}
    .pe-ind .pe-marca{width:24px;height:24px;border-radius:50%;background:var(--pe-acc);color:#fff;display:none;align-items:center;justify-content:center;font-size:.75rem;box-shadow:0 2px 6px rgba(0,0,0,.18);}
    .pe-ind[aria-pressed="true"] .pe-marca{display:flex;}
    /* Matérias das aulas marcadas: ícone na cor do tema se o professor leciona, cinza se não */
    .pe-mats{display:flex;flex-wrap:wrap;gap:6px;}
    .pe-mat{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:.9rem;background:color-mix(in srgb,var(--pe-acc) 12%,#fff);color:var(--pe-acc);border:1.5px solid color-mix(in srgb,var(--pe-acc) 35%,#fff);}
    .pe-mat.nao{background:#f1eeea;color:#b9b1a9;border-color:transparent;}
    .pe-media{font-size:.76rem;color:#6b7280;}
    .pe-media b{color:#111827;font-family:'Lexend',sans-serif;}
    /* Barra de pendências em duas metades fixas: disponibilidade à esquerda, aulas agendadas à direita.
       A metade zerada fica apagada; a cor do card já diz a situação. */
    .pe-ind-barra{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;border-radius:12px;overflow:hidden;border:1.5px solid #e8e0d7;background:#fff;}
    .pe-ind-barra > button{border:0;background:transparent;display:grid;justify-items:center;gap:3px;padding:.45rem .25rem;cursor:pointer;min-width:0;font:inherit;}
    .pe-ind-barra > button + button{border-left:1.5px solid #e8e0d7;}
    .pe-ind-barra .pe-l1{display:flex;align-items:center;gap:5px;font:700 .95rem 'Lexend',sans-serif;font-variant-numeric:tabular-nums;}
    .pe-ind-barra small{font:500 .6rem 'Lexend',sans-serif;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
    .pe-ind-barra .fora .pe-l1{color:#c2410c;} .pe-ind-barra .dia .pe-l1{color:#a16207;}
    .pe-ind-barra .off{cursor:default;} .pe-ind-barra .off .pe-l1{color:#c9c1b9;}
    .pe-ind-barra button:not(.off):hover{background:#faf7f3;}
    .pe-ind-barra button:focus-visible{outline:2px solid var(--pe-acc);outline-offset:-2px;}
    .pe-ordem{display:flex;align-items:center;gap:.4rem;border:2px solid #e5e7eb;border-radius:10px;padding:0 .4rem 0 .7rem;min-height:42px;background:#fff;font:700 .82rem 'Comfortaa',sans-serif;color:#374151;}
    .pe-ordem[hidden]{display:none;}
    .pe-ordem select{border:0;outline:0;background:transparent;font:.86rem 'Comfortaa',sans-serif;color:#111827;padding:.4rem .2rem;min-height:0;cursor:pointer;}
    .pe-ordem:focus-within{border-color:var(--pe-acc);}
    .pe-info-ico{width:24px;height:24px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--pe-acc-esc);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.6rem;box-shadow:0 2px 6px rgba(0,0,0,.18);}
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
      .pe-ind-foto img,.pe-ind-foto .pe-iniciais{aspect-ratio:16/9;}
      .pe-rodape{padding-bottom:calc(.8rem + env(safe-area-inset-bottom));}
      .pe-rodape .pe-info{flex-basis:100%;order:-1;font-size:.8rem;}
      .pe-rodape .pe-btn{flex:1;justify-content:center;}
      .pe-prof .pe-foto,.pe-prof .pe-iniciais{width:60px;height:60px;font-size:1.2rem;border-radius:12px;}
      .pe-multi,.pe-verif,#pe-disc-aula{flex:1 1 100%;justify-content:center;}
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
  // Lido a cada abertura do envio (sem cache): professor desligado ou sem acesso
  // durante a sessão já sai da lista sem recarregar a página.
  async function carregarProfessores() {
    const snap = await fdb().collection('dataBaseProfessores').get();
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
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
    // O professor não lê o cadastro do cliente nem conteudosContratacoes antes de
    // ser professor da contratação: o que ele precisa ver na proposta vai copiado
    // no documento (estudantes, bairro, cidade, conteúdos). Endereço completo só
    // na aprovação (localDoCliente).
    let apelido = '', cad = null, bairro = '', conteudos = null;
    const codigo = origem === 'simulacao' ? (d.idSimulacao || id) : (d.codigoContratacao || id);
    try {
      if (d.cpf) {
        const c = await fdb().collection('cadastroClientes').where('cpf', '==', d.cpf).limit(1).get();
        if (!c.empty) { cad = c.docs[0].data(); apelido = cad.apelido || ''; }
      }
    } catch (_) { /* cadastro é opcional */ }
    try {
      if (d.cpf && window.Match && typeof window.Match.resolverBairroCliente === 'function') bairro = (await window.Match.resolverBairroCliente(d.cpf)).bairro || '';
    } catch (_) { /* bairro é opcional */ }
    try {
      if (origem !== 'simulacao') {
        const ct = await fdb().collection('conteudosContratacoes').doc(String(codigo)).get();
        if (ct.exists) conteudos = { texto: String(ct.data().texto || '').slice(0, 5000), linkAnexo: ct.data().linkAnexo || '' };
      }
    } catch (_) { /* conteúdos são opcionais */ }
    const residencial = cad && (cad.mesmoEndereco === true || (!String(cad.enderecoAulas || '').trim() && !String(cad.cidadeUFAulas || '').trim()));
    const nomesAulas = new Set(aulas.flatMap(a => String(a.estudante || '').split(',').map(n => norm(n)).filter(Boolean)));
    const todosEst = (cad && Array.isArray(cad.estudantes) ? cad.estudantes : []).filter(e => e && e.nome);
    const estudantes = (nomesAulas.size ? todosEst.filter(e => nomesAulas.has(norm(e.nome))) : todosEst).slice(0, 6)
      .map(e => ({ nome: String(e.nome || ''), serie: String(e.serie || ''), escola: String(e.escola || '') }));
    return {
      origem, id: String(id), codigo,
      clienteNome: d.nomeCliente || d.nome || '', clienteApelido: apelido, cpf: d.cpf || '', aulas,
      estudantes, bairro, cidade: cad ? String((residencial ? cad.cidadeUF : cad.cidadeUFAulas) || '') : '', conteudos
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

    // Só professores ativos na equipe (mesmo critério do Match e do BD Professores:
    // sem status = Ativo), com acesso à plataforma e e-mail — os outros não veriam a proposta.
    const elegiveis = profs.filter(p => norm(p.status || 'Ativo') === 'ativo' && p.acessoPlataforma === true && p.email)
      .sort((a, b) => (ehOuro(a) === ehOuro(b)) ? String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') : (ehOuro(a) ? -1 : 1));
    const disciplinas = [...new Set(elegiveis.flatMap(disciplinasDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    // Matérias das aulas para o filtro do passo 1 (uma aula pode ter "Mat1, Mat2 e Mat3").
    const materiasDe = (a) => String(a.materia || '').split(/,\s+|\s+e\s+/).map(m => m.trim()).filter(Boolean);
    const materiasAulas = [...new Map(dados.aulas.flatMap(materiasDe).map(m => [norm(m), m])).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
              <div class="pe-filtros">
                <input type="search" id="pe-busca-aula" placeholder="Buscar professor" aria-label="Buscar professor já marcado nas aulas">
                <div class="pe-multi" id="pe-disc-aula">
                  <button type="button" class="pe-multi-btn" aria-haspopup="true" aria-expanded="false" aria-label="Filtrar Disciplinas"><span>Filtrar Disciplinas</span><i class="fas fa-chevron-down"></i></button>
                  <div class="pe-multi-painel" hidden>
                    ${materiasAulas.map(m => `<label><input type="checkbox" value="${esc(norm(m))}" data-rotulo="${esc(m)}"> ${esc(m)}</label>`).join('') || '<p class="pe-vazio" style="padding:.6rem">Nenhuma matéria nas aulas.</p>'}
                    <button type="button" class="pe-multi-limpar">Limpar seleção</button>
                  </div>
                </div>
              </div>
              <label class="pe-todas"><input type="checkbox" id="pe-todas" checked> <span id="pe-todas-txt">Selecionar todas as aulas</span></label>
              <p class="pe-vazio" id="pe-aulas-vazio" hidden>Nenhuma aula para este filtro.</p>
              ${dados.aulas.map(a => `
                <label class="pe-aula" data-i="${a.i}"><input type="checkbox" class="pe-chk" value="${a.i}" checked>
                  <span class="pe-a1"><b>${esc(a.data || '—')}</b> · <b>Início:</b> ${esc(a.horario || '--')} · <b>Duração:</b> ${esc(a.duracao || '--')}<br>
                  <b>Disciplina:</b> ${esc(a.materia || '--')} · <b>Prof.:</b> ${esc(a.professor || '--')}${a.estudante ? ` · <b>Aluno:</b> ${esc(a.estudante)}` : ''}</span>
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
      const painelAberto = fundo.querySelector('.pe-multi-painel:not([hidden])');
      if (painelAberto) { painelAberto.hidden = true; painelAberto.previousElementSibling.setAttribute('aria-expanded', 'false'); return; }
      fechar();
    };
    document.addEventListener('keydown', teclas);
    $('.pe-x').onclick = fechar;
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });

    const selecionadas = () => [...fundo.querySelectorAll('.pe-chk:checked')].map(c => dados.aulas[+c.value]);
    // Filtros do passo 1 só escondem aulas da lista: o que vai na proposta continua
    // sendo o que está marcado (o resumo avisa se há marcadas escondidas).
    const visiveisAula = () => [...fundo.querySelectorAll('.pe-aula:not([hidden]) .pe-chk')];
    function resumo() {
      const s = selecionadas(); const total = s.reduce((t, a) => t + a.valor, 0);
      const txt = `${s.length} ${s.length === 1 ? 'aula' : 'aulas'} · professor recebe <b>${moeda(total)}</b>`;
      const escondidas = fundo.querySelectorAll('.pe-aula[hidden] .pe-chk:checked').length;
      $('#pe-resumo').innerHTML = txt + (escondidas ? ` · <span style="color:#b45309">${escondidas} ${escondidas === 1 ? 'marcada fora' : 'marcadas fora'} do filtro</span>` : '');
      $('#pe-resumo2').innerHTML = `${txt} · ${escolhidos.size} ${escolhidos.size === 1 ? 'professor' : 'professores'}`;
      $('#pe-avancar').disabled = !s.length;
      $('#pe-enviar').disabled = !s.length || !escolhidos.size;
      const vis = visiveisAula();
      $('#pe-todas').checked = vis.length > 0 && vis.every(c => c.checked);
    }
    function filtrarAulas() {
      const busca = norm($('#pe-busca-aula').value);
      const discs = [...fundo.querySelectorAll('#pe-disc-aula input:checked')].map(c => c.value);
      fundo.querySelectorAll('.pe-aula').forEach(el => {
        const a = dados.aulas[+el.dataset.i];
        el.hidden = !((!busca || norm(a.professor).includes(busca))
          && (!discs.length || materiasDe(a).some(m => discs.includes(norm(m)))));
      });
      const filtrando = !!(busca || discs.length);
      $('#pe-todas-txt').textContent = filtrando ? 'Selecionar todas as aulas filtradas' : 'Selecionar todas as aulas';
      $('#pe-aulas-vazio').hidden = visiveisAula().length > 0;
      $('.pe-todas').hidden = !visiveisAula().length;
      resumo();
    }
    // Vista de indicadores (padrão) x vista geral (grade antiga). verif guarda o
    // cálculo das aulas marcadas: Map professorId → { conflitos, fora, materias, media }.
    let modo = 'indicadores';
    let verif = null, calculando = false, erroCalculo = false, calcId = 0, bairroP = null;
    const aulasMudaram = () => { verif = null; erroCalculo = false; resumo(); };
    $('#pe-todas').onchange = (e) => { visiveisAula().forEach(c => { c.checked = e.target.checked; }); aulasMudaram(); };
    fundo.querySelectorAll('.pe-chk').forEach(c => { c.onchange = aulasMudaram; });
    $('#pe-busca-aula').oninput = filtrarAulas;

    // Dropdown "Filtrar Disciplinas" (passo 1) e "Todas as disciplinas" (passo 2).
    function ligarMulti(raiz, vazio, aoMudar) {
      const btn = raiz.querySelector('.pe-multi-btn'), painel = raiz.querySelector('.pe-multi-painel');
      const marcadas = () => [...painel.querySelectorAll('input:checked')];
      const abrir = (sim) => { painel.hidden = !sim; btn.setAttribute('aria-expanded', String(sim)); };
      const rotulo = () => {
        const m = marcadas().map(c => c.dataset.rotulo);
        btn.querySelector('span').textContent = !m.length ? vazio : m.length <= 2 ? m.join(' + ') : `${m.length} disciplinas`;
        btn.title = m.join(', ');
      };
      btn.onclick = () => abrir(painel.hidden);
      painel.querySelectorAll('input').forEach(c => { c.onchange = () => { rotulo(); aoMudar(); }; });
      painel.querySelector('.pe-multi-limpar').onclick = () => { painel.querySelectorAll('input').forEach(c => { c.checked = false; }); rotulo(); aoMudar(); };
      fundo.addEventListener('mousedown', e => { if (!painel.hidden && !raiz.contains(e.target)) abrir(false); });
    }
    ligarMulti($('#pe-disc-aula'), 'Filtrar Disciplinas', filtrarAulas);

    function passo(n) {
      $('.pe-palco').classList.toggle('passo2', n === 2);
      fundo.querySelectorAll('.pe-passos span').forEach(s => s.classList.toggle('on', s.dataset.p === String(n)));
      setTimeout(() => { (n === 2 ? $('#pe-busca') : $('#pe-avancar')).focus({ preventScroll: true }); $('.pe-trilho').scrollLeft = 0; }, 460);
    }
    $('#pe-avancar').onclick = () => { passo(2); if (modo === 'indicadores' && !verif) calcular(); else desenharGrade(); };
    $('#pe-voltar').onclick = () => passo(1);

    // Disciplinas marcadas no dropdown: o professor precisa dar TODAS.
    const discMarcadas = () => [...fundo.querySelectorAll('#pe-disc .pe-multi-painel input:checked')];
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
          const nFora = v.fora.length, nDia = v.conflitos.length;
          return `<div class="pe-ind ${st}" role="button" tabindex="0" data-id="${id}" aria-pressed="${escolhidos.has(p.id)}">
            <div class="pe-ind-foto">${fotoHtml(p)}${ehOuro(p) ? '<i class="fas fa-star pe-ouro" title="Professor de ouro"></i>' : ''}
              <span class="pe-ind-cantos"><span class="pe-marca"><i class="fas fa-check"></i></span>${v.materias.length ? `<button type="button" class="pe-info-ico" data-id="${id}" data-pop="just" title="Ver justificativa do match" aria-label="Ver justificativa do match"><i class="fas fa-info"></i></button>` : ''}</span>
              ${v.media !== null ? `<span class="pe-selo" style="--p:${v.media}" title="Match${v.materias.length > 1 ? ' (média das matérias)' : ''}"><b>${v.media}%</b><small>Match</small></span>` : ''}</div>
            <div class="pe-ind-nome"><b>${esc(apelidoDe(p))}</b><small title="${esc(p.nome || '')}">${esc(p.nome || '')}</small></div>
            ${v.materias.length ? `<div class="pe-mats" role="list" aria-label="Matérias das aulas marcadas">${v.materias.map(m =>
              `<span class="pe-mat${m.leciona ? '' : ' nao'}" role="listitem" title="${esc(m.nome)} — ${m.leciona ? 'leciona (' + m.taxa + '% de match)' : 'não leciona'}" aria-label="${esc(m.nome)}: ${m.leciona ? 'leciona, ' + m.taxa + '% de match' : 'não leciona'}"><i class="${esc(iconeMateria(m.nome))}"></i></span>`).join('')}</div>`
              : '<div class="pe-media">Sem matéria definida nas aulas marcadas.</div>'}
            <div class="pe-ind-barra">
              <button type="button" class="${fora ? 'pe-pend-ico fora' : 'off'}" ${fora ? `data-id="${id}" data-pop="fora" aria-label="${nFora} aula(s) fora da disponibilidade — ver detalhes"` : 'tabindex="-1" aria-label="Dentro da disponibilidade"'} title="Fora da disponibilidade"><span class="pe-l1"><i class="far fa-clock"></i>${nFora}</span><small>Fora da disponib.</small></button>
              <button type="button" class="${dia ? 'pe-pend-ico dia' : 'off'}" ${dia ? `data-id="${id}" data-pop="dia" aria-label="${nDia} aula(s) no mesmo dia — ver detalhes"` : 'tabindex="-1" aria-label="Sem aulas agendadas nos dias"'} title="Aulas agendadas"><span class="pe-l1"><i class="fas fa-calendar-xmark"></i>${nDia}</span><small>Aulas agendadas</small></button>
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

    ligarMulti($('#pe-disc'), 'Todas as disciplinas', desenharGrade);

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
      // indice = posição na simulação (lá as aulas costumam não ter id-Aula).
      const aulas = selecionadas().map(a => ({ idAula: a.idAula || '', indice: a.i, data: a.data, horario: a.horario, duracao: a.duracao, materia: a.materia, estudante: a.estudante, valor: a.valor }));
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
          estudantes: dados.estudantes, bairro: dados.bairro, cidade: dados.cidade,
          conteudos: dados.conteudos || { texto: '', linkAnexo: '' },
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

  // ── Notificações: grid das propostas ─────────────────────────────────────
  // Cada proposta vira um card 4:3. À esquerda (40%) o resumo: valor, aulas
  // remarcadas e a mensagem do professor; à direita (60%) o calendário com
  // seletor de mês (verde = aceita, amarelo = contraproposta, tracejado = data
  // sugerida, cinza = sem resposta). Clique no card abre os detalhes no espaço
  // do grid. Botões do card:
  //   • Gerar solicitação com contraproposta → modal "Solicitação de Aula"
  //     (BancoDeAulasCards) com os horários sugeridos em borda amarela;
  //   • Confirmar Professor → numa disciplina da proposta, troca as aulas com
  //     contraproposta para a data/horário sugeridos e atribui o professor às
  //     aulas (as que têm outro professor passam pelo modal de substituição), grava o endereço completo (local) e encerra as outras
  //     propostas abertas que disputam as mesmas aulas (mesmo lote). Propostas
  //     de outros lotes da contratação (outra disciplina) seguem abertas;
  //   • Reenviar proposta → nova proposta 'pendente' com as mesmas aulas para o
  //     mesmo professor; a antiga sai das duas listas sem aviso;
  //   • Enviar para análise → o card do professor fica com a ampulheta;
  //   • Apagar → status 'cancelada' com o motivo (o professor vê o aviso e a
  //     proposta some da lista dele). As aulas continuam onde estão.
  // Dia amarelo do calendário (ou "Aprovar" na lista) → aprovar contraproposta:
  // a aula muda de data/horário na contratação (BancoDeAulas-Lista) ou na
  // simulação. O professor só é atribuído em "Confirmar Professor".
  //
  // A tela principal mostra um card por SIMULAÇÃO/CONTRATAÇÃO (grupo); ao abrir,
  // aparecem as propostas daquele grupo. "Ocultar todas" marca ocultaCentral nas
  // propostas dos grupos exibidos (nada é apagado); o grupo volta sozinho quando
  // chega proposta nova ou resposta depois de ocultado, e "Exibir todas" desfaz.
  //
  // Aceite sem alteração (status 'aceita', sem contraproposta) vincula o professor
  // automaticamente (processarAceitesAutomaticos) se as aulas estão "A definir";
  // se já têm outro professor, fica para o botão "Confirmar Professor", que pergunta antes de
  // substituir.
  let propostas = [];
  let filtro = 'todas';
  let cancelar = null;
  let grupoAberto = null;        // chave origem|idOrigem do grupo aberto
  let aberta = null;             // id da proposta aberta no espaço do grid
  const mesDoCard = new Map();   // id → 'aaaa-mm' visível no calendário

  const ST = {
    pendente: ['Aguardando resposta', 'n'], aceita: ['Aceitou', 'g'], contraproposta: ['Contraproposta', 'y'],
    recusada: ['Recusou', 'r'], encerrada: ['Encerrada', 'n'], aprovado: ['Professor aprovado', 'g']
  };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEM3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoDe = (br) => { const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
  const curta = (br) => { const iso = isoDe(br); if (!iso) return String(br || '—'); const [y, m, d] = iso.split('-').map(Number); return `${SEM3[new Date(y, m - 1, d).getDay()]} ${pad2(d)}/${pad2(m)}`; };
  const fimDe = (ini, duracao) => { const m = String(ini || '').match(/(\d{1,2}):(\d{2})/); if (!m) return ''; const t = +m[1] * 60 + +m[2] + Math.round(horasDe(duracao) * 60 || 60); return `${pad2(Math.floor(t / 60) % 24)}:${pad2(t % 60)}`; };
  const faixa = (a) => a.horario ? `${a.horario}–${fimDe(a.horario, a.duracao)}` : '--:--';
  const origemNome = (p) => (p.origem === 'simulacao' ? 'Simulação' : 'Contratação');
  const profNome = (p) => p.professorApelido || String(p.professorNome || '').split(' ')[0] || 'Professor';
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const visiveis = () => propostas.filter(p => p.status !== 'cancelada');
  const naoLidas = () => visiveis().filter(p => p.status !== 'pendente' && !p.lidaCentral).length;

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
      processarAceitesAutomaticos();
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

  // Situação de cada aula da proposta: pend | rec | aceita | contra | aprovada.
  function aulasComEstado(p) {
    const alts = new Map((Array.isArray(p.alteracoes) ? p.alteracoes : []).map(a => [Number(a.i), a]));
    return (p.aulas || []).map((a, i) => {
      const alt = alts.get(i) || null;
      let estado = 'pend';
      if (p.status === 'recusada') estado = 'rec';
      else if (alt && !alt.aprovada) estado = 'contra';
      else if (alt && alt.aprovada) estado = 'aprovada';
      else if (['aceita', 'contraproposta', 'aprovado'].includes(p.status)) estado = 'aceita';
      return { ...a, i, alt, estado };
    });
  }

  function pode(p) {
    const est = aulasComEstado(p);
    return {
      sol: est.some(a => a.alt) && !['aprovado', 'encerrada'].includes(p.status),
      aprovar: ['aceita', 'contraproposta'].includes(p.status) && est.some(a => ['aceita', 'aprovada', 'contra'].includes(a.estado)),
      analise: p.status === 'contraproposta' && !p.emAnalise,
      reenviar: p.status !== 'aprovado',
      apagar: true
    };
  }

  let estiloGrid = false;
  function injetarEstiloGrid() {
    if (estiloGrid) return;
    estiloGrid = true;
    const s = document.createElement('style');
    s.textContent = `
    .nt2-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;}
    @media (max-width:1280px){.nt2-grade{grid-template-columns:repeat(2,minmax(0,1fr));}}
    .nt2-card{aspect-ratio:4/3;background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;min-width:0;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:border-color .15s,box-shadow .15s;}
    .nt2-card:hover{border-color:#fdba74;box-shadow:0 8px 22px rgba(0,0,0,.08);}
    .nt2-card.nova{border-color:#f28705;}
    .nt2-hit{flex:1;min-height:0;display:flex;flex-direction:column;cursor:pointer;}
    .nt2-hit:focus-visible{outline:3px solid #fcd9a8;outline-offset:-3px;}
    .nt2-topo{display:flex;gap:.6rem;align-items:center;padding:.7rem .85rem;border-bottom:1px solid #f1f2f4;}
    .nt2-av{width:36px;height:36px;border-radius:50%;background:#ffedd5;color:#d97804;display:grid;place-items:center;font:700 .78rem 'Lexend',sans-serif;flex:none;}
    .nt2-quem{flex:1;min-width:0;display:flex;flex-direction:column;}
    .nt2-quem b{font:700 .9rem 'Lexend',sans-serif;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .nt2-quem span{font-size:.74rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .nt2-pills{display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;}
    .nt2-st{font:700 .66rem 'Comfortaa',sans-serif;border-radius:999px;padding:.18rem .55rem;white-space:nowrap;border:1px solid;}
    .nt2-st.n{background:#f3f4f6;color:#6b7280;border-color:#e5e7eb;} .nt2-st.g{background:#f0fdf4;color:#15803d;border-color:#bbf7d0;}
    .nt2-st.r{background:#fef2f2;color:#b91c1c;border-color:#fecaca;} .nt2-st.y{background:#fffbeb;color:#a16207;border-color:#fde68a;}
    .nt2-st.o{background:#fff7ed;color:#d97804;border-color:#fed7aa;}
    .nt2-novo{width:9px;height:9px;border-radius:50%;background:#ef4444;}
    .nt2-split{flex:1;min-height:0;display:grid;grid-template-columns:40% 60%;}
    .nt2-esq{padding:.65rem .8rem;border-right:1px solid #f1f2f4;display:flex;flex-direction:column;gap:.45rem;min-width:0;overflow:hidden;font-size:.76rem;color:#4b5563;}
    .nt2-esq p{margin:0;} .nt2-esq p.ok{color:#15803d;font-weight:700;}
    .nt2-dir{padding:.55rem .7rem;min-width:0;display:flex;flex-direction:column;gap:.35rem;}
    .nt2-num{display:flex;flex-direction:column;gap:.1rem;}
    .nt2-num span,.nt2-mini{font:700 .62rem 'Comfortaa',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;}
    .nt2-num strong{font:700 1.1rem 'Lexend',sans-serif;color:#111827;}
    .nt2-chg{display:flex;flex-direction:column;gap:.25rem;}
    .nt2-chg div{background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:.25rem .45rem;font-size:.72rem;line-height:1.35;}
    .nt2-chg div.ap{background:#f0fdf4;border-color:#bbf7d0;}
    .nt2-chg s{color:#9ca3af;text-decoration:none;} .nt2-chg b{color:#111827;}
    .nt2-lista s,.nt2-modal s{color:#9ca3af !important;text-decoration:none;}
    .nt2-msg{font-size:.72rem;color:#4b5563;background:#f3f4f6;border-radius:7px;padding:.35rem .5rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-style:italic;}
    .nt2-acoes{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #e5e7eb;flex:none;}
    .nt2-acoes button{border:0;border-right:1px solid #e5e7eb;background:#fff;min-height:48px;padding:.35rem .3rem;font:700 .68rem 'Comfortaa',sans-serif;color:#4b5563;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem;line-height:1.2;cursor:pointer;}
    .nt2-acoes button:last-child{border-right:0;}
    .nt2-acoes button i{font-size:.95rem;}
    .nt2-acoes button:hover:not(:disabled){background:#fff7eb;color:#d97804;}
    .nt2-acoes button.del:hover:not(:disabled){background:#fef2f2;color:#dc2626;}
    .nt2-acoes button:disabled{opacity:.35;cursor:not-allowed;}
    .nt2-cal-h{display:flex;align-items:center;justify-content:space-between;gap:.3rem;}
    .nt2-cal-h b{font:700 .8rem 'Lexend',sans-serif;text-transform:capitalize;color:#111827;}
    .nt2-nav{border:0;background:#f3f4f6;border-radius:7px;width:26px;height:26px;display:grid;place-items:center;color:#4b5563;font-size:.7rem;cursor:pointer;}
    .nt2-nav:disabled{opacity:.3;cursor:default;}
    .nt2-cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;align-content:start;}
    .nt2-cal-g .w{font-size:.58rem;color:#9ca3af;font-weight:700;}
    .nt2-d{border-radius:6px;font:600 .64rem 'Lexend',sans-serif;color:#9ca3af;display:grid;place-items:center;border:1.5px solid transparent;background:none;padding:0;min-width:0;height:22px;}
    .nt2-d.ok{background:#16a34a;color:#fff;} .nt2-d.ct{background:#f59e0b;color:#422006;}
    .nt2-d.sug{border:1.5px dashed #f59e0b;color:#a16207;background:#fffbeb;}
    .nt2-d.pend{background:#f3f4f6;color:#4b5563;border-color:#e5e7eb;} .nt2-d.rec{background:#f3f4f6;color:#9ca3af;text-decoration:line-through;}
    button.nt2-d{cursor:pointer;} button.nt2-d:hover{outline:2px solid #a16207;outline-offset:1px;}
    .nt2-leg{display:flex;flex-wrap:wrap;gap:.2rem .6rem;font-size:.6rem;color:#9ca3af;}
    .nt2-leg span{display:inline-flex;gap:.25rem;align-items:center;}
    .nt2-sw{width:9px;height:9px;border-radius:3px;display:inline-block;}
    .nt2-x{border:1.5px solid #fdba74;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;height:min(760px,calc(100vh - 220px));min-height:560px;background:#fff;}
    .nt2-x-topo{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;padding:.8rem 1rem;border-bottom:1px solid #e5e7eb;}
    .nt2-voltar{border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:.4rem .7rem;font:700 .78rem 'Comfortaa',sans-serif;display:inline-flex;gap:.35rem;align-items:center;color:#4b5563;cursor:pointer;}
    .nt2-x-split{flex:1;display:grid;grid-template-columns:40% 60%;min-height:0;}
    .nt2-x-esq{padding:1rem;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;gap:.8rem;min-width:0;min-height:0;overflow:hidden;font-size:.84rem;color:#4b5563;}
    .nt2-x-esq>*{flex:none;}
    .nt2-x-dir{padding:1rem;display:flex;flex-direction:column;gap:.6rem;min-width:0;min-height:0;overflow-y:auto;}
    .nt2-x-dir .nt2-cal-g{gap:5px;}
    .nt2-x-dir .nt2-d{height:auto;aspect-ratio:1.3;font-size:.82rem;border-radius:9px;}
    .nt2-x-dir .nt2-cal-g .w{font-size:.7rem;padding:.2rem 0;}
    .nt2-x-dir .nt2-cal-h b{font-size:.98rem;}
    .nt2-x-dir .nt2-nav{width:34px;height:34px;}
    .nt2-x-dir .nt2-leg{font-size:.74rem;gap:.3rem .9rem;}
    .nt2-x-dir .nt2-sw{width:11px;height:11px;}
    .nt2-kv{display:grid;grid-template-columns:1fr;background:#f3f4f6;border-radius:10px;padding:.7rem .85rem;margin:0;font-size:.84rem;}
    .nt2-kv dt{color:#9ca3af;font-size:.72rem;margin-top:.45rem;} .nt2-kv dt:first-child{margin-top:0;}
    .nt2-kv dd{margin:0;color:#111827;font-weight:700;}
    .nt2-sec{display:flex;flex-direction:column;gap:.45rem;min-height:0;}
    .nt2-sec h4{margin:0;font:700 .86rem 'Lexend',sans-serif;color:#111827;display:flex;gap:.45rem;align-items:center;}
    .nt2-sec h4 i{color:#f28705;}
    .nt2-texto{background:#f3f4f6;border-radius:10px;padding:.65rem .8rem;white-space:pre-wrap;line-height:1.6;color:#111827;max-height:120px;overflow-y:auto;}
    .nt2-sec.aulas{flex:1 1 0;min-height:140px;}
    .nt2-lista{list-style:none;margin:0;padding:0 4px 0 0;display:flex;flex-direction:column;gap:.4rem;flex:1;min-height:0;overflow-y:auto;}
    .nt2-lista li{border:1.5px solid #e5e7eb;border-radius:10px;padding:.5rem .65rem;display:flex;flex-direction:column;gap:.3rem;font-size:.8rem;}
    .nt2-lista li.ct{border-color:#fde68a;background:#fffbeb;} .nt2-lista li.ap{border-color:#bbf7d0;background:#f0fdf4;}
    .nt2-lista .lin{display:flex;justify-content:space-between;gap:.5rem;align-items:center;flex-wrap:wrap;}
    .nt2-lista s{color:#9ca3af;}
    .nt2-mini-btn{border:0;background:#16a34a;color:#fff;border-radius:8px;padding:.3rem .65rem;font:700 .72rem 'Comfortaa',sans-serif;cursor:pointer;display:inline-flex;gap:.3rem;align-items:center;}
    .nt2-x-acoes{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;padding:.8rem 1rem;border-top:1px solid #e5e7eb;}
    .nt2-x-acoes .pe-btn{justify-content:center;min-height:46px;font-size:.78rem;text-align:center;}
    .nt2-x-acoes .pe-btn.ok{background:#16a34a;border-color:#16a34a;color:#fff;}
    .nt2-x-acoes .pe-btn.del{color:#dc2626;border-color:#fecaca;}
    .nt2-dica{font-size:.76rem;color:#9ca3af;margin:0;}
    .nt2-modal p{margin:0 0 .7rem;font-size:.9rem;color:#374151;line-height:1.55;}
    .nt2-modal .item{border:1.5px solid #fde68a;background:#fffbeb;border-radius:12px;padding:.65rem .8rem;margin-bottom:.6rem;display:grid;grid-template-columns:auto 1fr;gap:.25rem .8rem;font-size:.86rem;}
    .nt2-modal .item .h{grid-column:1/-1;font:700 .7rem 'Comfortaa',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#a16207;}
    .nt2-modal .item dt{color:#9ca3af;} .nt2-modal .item dd{margin:0;color:#111827;font-weight:700;}
    .nt2-modal .item .so{grid-column:1/-1;justify-self:start;}
    .nt2-modal ul{list-style:none;margin:0 0 .7rem;padding:0;display:flex;flex-direction:column;gap:.35rem;}
    .nt2-modal li{background:#f3f4f6;border-radius:8px;padding:.45rem .6rem;font-size:.84rem;}
    .nt2-modal .aviso{background:#fffbeb;border:1px solid #fde68a;color:#854d0e;border-radius:10px;padding:.55rem .7rem;font-size:.82rem;margin-bottom:.7rem;}
    .nt2-modal .fino{font-size:.78rem;color:#9ca3af;}
    .nt2-modal textarea{width:100%;min-height:96px;box-sizing:border-box;border:2px solid #e5e7eb;border-radius:10px;padding:.6rem;font:.9rem 'Comfortaa',sans-serif;resize:vertical;margin:.3rem 0 .7rem;}
    .nt2-modal textarea:focus{outline:none;border-color:#f28705;}
    .nt2-modal label.chk{display:flex;gap:.6rem;align-items:flex-start;font-size:.86rem;color:#111827;cursor:pointer;}
    .nt2-modal label.chk input{width:18px;height:18px;accent-color:#dc2626;flex:none;margin-top:.1rem;}
    .nt2-barra-dir{margin-left:auto;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;}
    .nt2-filtro-wrap{position:relative;}
    .nt2-badge{background:#f28705;color:#fff;border-radius:999px;font-size:.66rem;padding:.05rem .45rem;}
    .nt2-badge[hidden]{display:none;}
    .nt2-apagar-todas{color:#dc2626;border-color:#fecaca;}
    .nt2-apagar-todas:hover{background:#fef2f2;}
    .nt2-filtro{--pe-acc:#f28705;position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:min(320px,90vw);background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.16);padding:.8rem;display:flex;flex-direction:column;gap:.7rem;font:.84rem 'Comfortaa',sans-serif;color:#374151;}
    .nt2-filtro[hidden]{display:none;}
    .nt2-f-sec{display:flex;flex-direction:column;gap:.25rem;}
    .nt2-f-sec b{font:700 .8rem 'Lexend',sans-serif;color:#111827;margin-bottom:.15rem;}
    .nt2-f-sec label{display:flex;gap:.5rem;align-items:center;cursor:pointer;padding:.2rem 0;}
    .nt2-f-sec input{width:16px;height:16px;accent-color:#f28705;}
    .nt2-f-campo{display:flex;flex-direction:column;gap:.25rem;font:700 .8rem 'Lexend',sans-serif;color:#111827;}
    .nt2-f-campo input{border:2px solid #e5e7eb;border-radius:10px;padding:.5rem .65rem;font:.86rem 'Comfortaa',sans-serif;}
    .nt2-f-campo input:focus{outline:none;border-color:#f28705;}
    .nt2-f-acoes{display:flex;gap:.5rem;justify-content:flex-end;}
    .nt2-mes{margin-bottom:1.6rem;}
    .nt2-mes-h{display:flex;align-items:baseline;gap:.6rem;margin:0 0 .8rem;font:700 1.15rem 'Lexend',sans-serif;color:#111827;border-bottom:2px solid #f28705;padding-bottom:.35rem;}
    .nt2-mes-h span,.nt2-sem-h span{font:700 .72rem 'Comfortaa',sans-serif;color:#9ca3af;}
    .nt2-semana{margin:0 0 1.1rem .2rem;}
    .nt2-sem-h{display:flex;align-items:baseline;gap:.5rem;margin:0 0 .6rem;font:700 .9rem 'Lexend',sans-serif;color:#d97804;}
    .nt2-hit{position:relative;}
    .nt2-auto{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;padding:1.2rem;text-align:center;background:rgba(255,255,255,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#15803d;font:700 1rem 'Lexend',sans-serif;line-height:1.4;}
    .nt2-auto i{font-size:2rem;}
    .nt2-auto small{font:600 .74rem 'Comfortaa',sans-serif;color:#4b5563;}
    .nt2-auto-faixa{display:flex;gap:.6rem;align-items:center;background:#f0fdf4;border:1.5px solid #bbf7d0;color:#15803d;border-radius:12px;padding:.6rem .85rem;font:700 .86rem 'Lexend',sans-serif;}
    .nt2-ggrade{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:1rem;}
    .nt2-g{position:relative;background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;padding:.95rem 1rem;display:flex;flex-direction:column;gap:.6rem;cursor:pointer;text-align:left;font:inherit;color:#374151;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:border-color .15s,box-shadow .15s,transform .15s;}
    .nt2-g:hover{border-color:#fdba74;box-shadow:0 8px 22px rgba(0,0,0,.08);transform:translateY(-1px);}
    .nt2-g:focus-visible{outline:3px solid #fcd9a8;outline-offset:2px;}
    .nt2-g.nova{border-color:#f28705;}
    .nt2-g-topo{display:flex;gap:.65rem;align-items:center;}
    .nt2-g-ico{width:40px;height:40px;border-radius:12px;background:#fff7ed;color:#f28705;display:grid;place-items:center;font-size:1rem;flex:none;}
    .nt2-g-quem{flex:1;min-width:0;display:flex;flex-direction:column;}
    .nt2-g-quem b{font:700 .95rem 'Lexend',sans-serif;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .nt2-g-quem span{font-size:.74rem;color:#9ca3af;}
    .nt2-sino{position:relative;width:34px;height:34px;border-radius:50%;background:#f3f4f6;color:#9ca3af;display:grid;place-items:center;flex:none;}
    .nt2-sino.on{background:#fff7ed;color:#f28705;}
    .nt2-sino b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font:700 .64rem/18px 'Lexend',sans-serif;text-align:center;}
    .nt2-g-info{display:grid;grid-template-columns:auto 1fr;gap:.2rem .6rem;font-size:.78rem;margin:0;}
    .nt2-g-info dt{color:#9ca3af;} .nt2-g-info dd{margin:0;color:#111827;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .nt2-g-chips{display:flex;flex-wrap:wrap;gap:.3rem;}
    .nt2-prog{display:flex;flex-direction:column;gap:.35rem;}
    .nt2-prog-h{display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;font-size:.74rem;color:#9ca3af;}
    .nt2-prog-h b{font:700 .8rem 'Lexend',sans-serif;color:#15803d;font-variant-numeric:tabular-nums;}
    .nt2-prog-barra{display:flex;gap:3px;height:10px;}
    .nt2-prog-barra i{flex:1;min-width:0;border-radius:999px;background:#e5e7eb;overflow:hidden;display:block;}
    .nt2-prog-barra i b{display:block;height:100%;background:#16a34a;border-radius:999px;transition:width .3s;}
    .nt2-tip{position:fixed;z-index:100000;width:min(360px,92vw);max-height:70vh;overflow-y:auto;background:#fff;color:var(--gray-dark,#374151);border:1px solid var(--orange,#f28705);border-radius:var(--radius-sm,10px);box-shadow:var(--shadow,0 14px 40px rgba(0,0,0,.16));padding:.7rem .8rem;font:.75rem 'Comfortaa',sans-serif;pointer-events:none;display:flex;flex-direction:column;gap:.7rem;}
    .nt2-tip-mat{display:flex;flex-direction:column;gap:.45rem;}
    .nt2-tip-mat+.nt2-tip-mat{border-top:1px dashed #e5e7eb;padding-top:.6rem;}
    .nt2-tip-h{display:flex;align-items:center;gap:.45rem;}
    .nt2-tip-h>i{color:#f28705;width:16px;text-align:center;}
    .nt2-tip-h>b{flex:1;min-width:0;font:700 .8rem 'Lexend',sans-serif;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .nt2-tip-grade{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;}
    .nt2-tip-p{position:relative;display:flex;flex-direction:column;align-items:center;gap:.2rem;min-width:0;}
    .nt2-tip-p img,.nt2-tip-p .ini{width:52px;height:52px;border-radius:12px;object-fit:cover;object-position:center 22%;display:grid;place-items:center;background:#ffedd5;color:#d97804;font:700 .9rem 'Lexend',sans-serif;filter:grayscale(1);opacity:.45;}
    .nt2-tip-p small{max-width:100%;font-size:.64rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .nt2-tip-p.on img,.nt2-tip-p.on .ini{filter:none;opacity:1;box-shadow:0 0 0 2px #16a34a;}
    .nt2-tip-p.on small{color:#15803d;font-weight:700;}
    .nt2-tip-p.on::after{content:"\\2713";position:absolute;top:-4px;right:calc(50% - 32px);width:16px;height:16px;border-radius:50%;background:#16a34a;color:#fff;font:700 .6rem/16px 'Lexend',sans-serif;text-align:center;}
    .nt2-tip-p .ini{font-size:.9rem;}
    body.theme-blue .nt2-tip{background:var(--glass-header-bg,#fff);backdrop-filter:blur(var(--glass-header-blur,0));-webkit-backdrop-filter:blur(var(--glass-header-blur,0));}
    .nt2-g-pe{display:flex;justify-content:space-between;align-items:center;gap:.5rem;border-top:1px solid #f1f2f4;padding-top:.55rem;font-size:.72rem;color:#9ca3af;}
    .nt2-g-pe span:last-child{color:#d97804;font-weight:700;}
    .nt2-gv-topo{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;margin-bottom:1rem;padding:.8rem 1rem;background:#fff;border:1.5px solid #fdba74;border-radius:14px;}
    .nt2-gv-topo .nt2-g-quem b{font-size:1.05rem;}
    .nt2-gerar-sol{padding:.45rem .9rem;font-size:.82rem;border-color:#fdba74;color:#d97804;background:#fff7eb;}
    .nt2-gerar-sol:hover:not(:disabled){background:#f28705;border-color:#f28705;color:#fff;}
    .nt2-sub-tit{font:700 1rem 'Lexend',sans-serif !important;color:#111827 !important;text-align:center;}
    .nt2-troca{display:flex;align-items:center;justify-content:center;gap:1rem;margin:.4rem 0 1rem;flex-wrap:wrap;}
    .nt2-troca-lado{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;}
    .nt2-troca-seta{color:#f28705;font-size:1.4rem;}
    .nt2-troca-p{display:flex;flex-direction:column;align-items:center;gap:.3rem;width:84px;}
    .nt2-troca-p img,.nt2-troca-p .ini{width:72px;height:72px;border-radius:16px;object-fit:cover;object-position:center 22%;display:grid;place-items:center;background:#f3f4f6;color:#9ca3af;font:700 1.2rem 'Lexend',sans-serif;}
    .nt2-troca-p small{max-width:100%;font-size:.74rem;color:#6b7280;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .nt2-troca-p.on img,.nt2-troca-p.on .ini{box-shadow:0 0 0 3px #16a34a;background:#f0fdf4;color:#15803d;}
    .nt2-troca-p.on small{color:#15803d;font-weight:700;}
    .nt2-f-datas{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;}
    @media (max-width:760px){
      .nt2-grade{grid-template-columns:1fr;}
      .nt2-card{aspect-ratio:auto;} .nt2-split,.nt2-x-split{grid-template-columns:1fr;}
      .nt2-esq,.nt2-x-esq{border-right:0;border-bottom:1px solid #f1f2f4;}
      .nt2-x{height:auto;} .nt2-lista{max-height:420px;} .nt2-x-acoes{grid-template-columns:1fr 1fr;}
    }`;
    document.head.appendChild(s);
  }

  function calendario(p) {
    const est = aulasComEstado(p);
    const meses = [...new Set(est.flatMap(a => [isoDe(a.data), a.estado === 'contra' ? isoDe(a.alt.data) : '']).filter(Boolean).map(d => d.slice(0, 7)))].sort();
    if (!meses.length) return '<p class="nt2-dica">Aulas sem data.</p>';
    let ym = mesDoCard.get(p.id);
    if (!meses.includes(ym)) ym = meses[0];
    const i = meses.indexOf(ym), [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay(), dias = new Date(y, m, 0).getDate();
    let cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(w => `<span class="w">${w}</span>`).join('') + '<span></span>'.repeat(first);
    for (let d = 1; d <= dias; d++) {
      const iso = `${ym}-${pad2(d)}`;
      const doDia = est.filter(a => isoDe(a.data) === iso);
      const sug = est.filter(a => a.estado === 'contra' && isoDe(a.alt.data) === iso);
      let cls = '', clic = false, tit = '';
      if (doDia.some(a => a.estado === 'contra')) { cls = 'ct'; clic = true; tit = 'Contraproposta: clique para aprovar'; }
      else if (doDia.some(a => a.estado === 'rec')) { cls = 'rec'; tit = 'Recusada'; }
      else if (doDia.some(a => a.estado === 'aceita' || a.estado === 'aprovada')) { cls = 'ok'; tit = 'Aceita'; }
      else if (doDia.length) { cls = 'pend'; tit = 'Sem resposta'; }
      else if (sug.length) { cls = 'sug'; clic = true; tit = 'Data sugerida pelo professor: clique para aprovar'; }
      cells += clic
        ? `<button type="button" class="nt2-d ${cls}" data-dia="${iso}" data-id="${esc(p.id)}" title="${tit}" aria-label="${d}: ${tit}">${d}</button>`
        : `<span class="nt2-d ${cls}"${tit ? ` title="${tit}"` : ''}>${d}</span>`;
    }
    return `<div class="nt2-cal-h">
        <button type="button" class="nt2-nav" data-mes="${meses[i - 1] || ''}" data-id="${esc(p.id)}" ${i > 0 ? '' : 'disabled'} aria-label="Mês anterior"><i class="fas fa-chevron-left"></i></button>
        <b>${MESES[m - 1]} ${y}</b>
        <button type="button" class="nt2-nav" data-mes="${meses[i + 1] || ''}" data-id="${esc(p.id)}" ${i < meses.length - 1 ? '' : 'disabled'} aria-label="Próximo mês"><i class="fas fa-chevron-right"></i></button></div>
      <div class="nt2-cal-g">${cells}</div>
      <div class="nt2-leg"><span><i class="nt2-sw" style="background:#16a34a"></i>Aceita</span><span><i class="nt2-sw" style="background:#f59e0b"></i>Contraproposta</span>
        <span><i class="nt2-sw" style="border:1.5px dashed #f59e0b;background:#fffbeb"></i>Data sugerida</span><span><i class="nt2-sw" style="background:#f3f4f6;border:1px solid #e5e7eb"></i>Sem resposta</span></div>`;
  }

  function resumo(p) {
    const est = aulasComEstado(p);
    const nCt = est.filter(a => a.estado === 'contra').length, nAp = est.filter(a => a.estado === 'aprovada').length;
    let h = `<div class="nt2-num"><span>${est.length} aulas · professor recebe</span><strong>${moeda(p.valorTotal)}</strong></div>`;
    if (p.status === 'pendente') h += '<p>Aguardando a resposta do professor.</p>';
    if (p.status === 'recusada') h += `<span class="nt2-mini">Motivo da recusa</span><div class="nt2-msg" style="font-style:normal">${esc(p.motivoRecusa || 'Não informado')}${p.textoRecusa ? ' · ' + esc(p.textoRecusa) : ''}</div>`;
    if (p.status === 'encerrada') h += '<p>Outro professor foi confirmado para estas aulas.</p>';
    if (p.status === 'aceita') h += '<p class="ok">Aceitou todas as aulas.</p>';
    if (p.status === 'aceita' && p.autoVinculo === 'manual') h += '<p>As aulas já têm outro professor: use "Confirmar Professor" para substituir.</p>';
    if (p.status === 'aprovado') h += `<p class="ok">Atribuído a ${(p.aulasAtribuidas || []).length} aula(s).</p>`;
    if (nCt || nAp) {
      h += `<span class="nt2-mini">${est.length - nCt - nAp} aceitas · ${nCt} a aprovar · ${nAp} aprovadas</span>
        <div class="nt2-chg">${est.filter(a => a.alt).slice(0, 3).map(a =>
          `<div class="${a.estado === 'aprovada' ? 'ap' : ''}"><s>${esc(curta(a.alt.deData || a.data))} ${esc(a.alt.deHorario || '')}</s> → <b>${esc(curta(a.alt.data))} ${esc(a.alt.horario || '')}</b></div>`).join('')}</div>`;
    }
    if (p.contraproposta) h += `<div class="nt2-msg">"${esc(p.contraproposta)}"</div>`;
    return h;
  }

  function topo(p) {
    const [rot, cor] = ST[p.status] || ST.pendente;
    return `<span class="nt2-av">${esc(iniciais(p.professorNome))}</span>
      <span class="nt2-quem"><b>Prof. ${esc(p.professorNome || profNome(p))}</b><span>${origemNome(p)} ${esc(p.codigo || '')} · ${esc(p.clienteNome || '')}</span></span>
      <span class="nt2-pills"><span class="nt2-st ${cor}">${rot}</span>${p.emAnalise && p.status === 'contraproposta' ? '<span class="nt2-st o">Em análise</span>' : ''}</span>
      ${p.status !== 'pendente' && !p.lidaCentral ? '<span class="nt2-novo" title="Não lida"></span>' : ''}`;
  }

  function botoes(p, compacto) {
    const ok = pode(p);
    const B = [
      ['sol', 'fas fa-file-contract', 'Gerar solicitação com contraproposta', 'Solicitação', ok.sol, ''],
      ['aprovar', 'fas fa-user-check', 'Confirmar Professor', 'Confirmar Professor', ok.aprovar, 'ok'],
      ['reenviar', 'fas fa-paper-plane', 'Reenviar proposta', 'Reenviar proposta', ok.reenviar, ''],
      ['analise', 'fas fa-hourglass-half', p.emAnalise ? 'Em análise' : 'Enviar para análise', p.emAnalise ? 'Em análise' : 'Análise', ok.analise, ''],
      ['apagar', 'fas fa-trash', 'Apagar proposta', 'Apagar', ok.apagar, 'del']
    ];
    return B.map(([acao, ico, longo, curto, on, cls]) => compacto
      ? `<button type="button" class="${cls === 'del' ? 'del' : ''}" data-acao="${acao}" data-id="${esc(p.id)}" ${on ? '' : 'disabled'} title="${longo}" aria-label="${longo}"><i class="${ico}"></i>${curto}</button>`
      : `<button type="button" class="pe-btn ${on ? cls : (cls === 'del' ? 'del' : '')}" data-acao="${acao}" data-id="${esc(p.id)}" ${on ? '' : 'disabled'}><i class="${ico}"></i>${longo}</button>`).join('');
  }

  function cardHtml(p) {
    return `<article class="nt2-card${p.status !== 'pendente' && !p.lidaCentral ? ' nova' : ''}">
      <div class="nt2-hit" role="button" tabindex="0" data-abrir="${esc(p.id)}" aria-label="Abrir detalhes da proposta de ${esc(p.professorNome || '')}">
        <div class="nt2-topo">${topo(p)}</div>
        <div class="nt2-split"><div class="nt2-esq">${resumo(p)}</div><div class="nt2-dir">${calendario(p)}</div></div>
        ${autoConfirmada(p) ? `<div class="nt2-auto"><i class="fas fa-circle-check"></i>${textoAuto(p)}<small>Clique para ver os detalhes</small></div>` : ''}
      </div>
      <div class="nt2-acoes">${botoes(p, true)}</div></article>`;
  }

  function expandidaHtml(p) {
    const linhas = aulasComEstado(p).map(a => {
      const st = a.estado === 'contra' ? '<span class="nt2-st y">Contraproposta</span>' : a.estado === 'aprovada' ? '<span class="nt2-st g">Contraproposta aprovada</span>'
        : a.estado === 'aceita' ? '<span class="nt2-st g">Aceita</span>' : a.estado === 'rec' ? '<span class="nt2-st r">Recusada</span>' : '<span class="nt2-st n">Sem resposta</span>';
      return `<li class="${a.estado === 'contra' ? 'ct' : a.estado === 'aprovada' ? 'ap' : ''}">
        <div class="lin"><span><b>${esc(curta(a.data))}</b> · ${esc(faixa(a))} · ${esc(a.materia || '—')}</span>${st}</div>
        ${a.estado === 'contra' ? `<div class="lin"><span>Cliente: <s>${esc(curta(a.alt.deData || a.data))} ${esc(a.alt.deHorario || a.horario || '')}</s> → Professor: <b>${esc(curta(a.alt.data))} ${esc(a.alt.horario || '')}</b></span>
          <button type="button" class="nt2-mini-btn" data-aprovar-aula="${a.i}" data-id="${esc(p.id)}"><i class="fas fa-check"></i> Aprovar</button></div>` : ''}
        ${a.estado === 'aprovada' ? `<div class="lin"><span>Cliente tinha escolhido <s>${esc(curta(a.alt.deData || ''))} ${esc(a.alt.deHorario || '')}</s></span></div>` : ''}</li>`;
    }).join('');
    const est = Array.isArray(p.estudantes) ? p.estudantes : [];
    return `<div class="nt2-x">
      <div class="nt2-x-topo"><button type="button" class="nt2-voltar" data-fechar><i class="fas fa-arrow-left"></i> Voltar às propostas</button>
        <div class="nt2-topo" style="padding:0;border:0;flex:1;min-width:0">${topo(p)}</div>
        ${autoConfirmada(p) ? `<div class="nt2-auto-faixa" style="flex-basis:100%"><i class="fas fa-circle-check"></i>${textoAuto(p)}</div>` : ''}</div>
      <div class="nt2-x-split">
        <div class="nt2-x-esq">
          <dl class="nt2-kv"><dt>Cliente</dt><dd>${esc(p.clienteNome || '—')}</dd>
            ${est.length ? `<dt>Aluno</dt><dd>${est.map(e => esc([e.nome, e.serie].filter(Boolean).join(' · '))).join('<br>')}</dd>` : ''}
            <dt>Bairro</dt><dd>${esc([p.bairro, p.cidade].filter(Boolean).join(' · ') || '—')}</dd>
            <dt>Enviada</dt><dd>${esc(fmtData(p.criadoEm) || '—')}</dd>
            ${p.respondidoEm ? `<dt>Respondida</dt><dd>${esc(fmtData(p.respondidoEm))}</dd>` : ''}
            <dt>Professor recebe</dt><dd style="color:#15803d">${moeda(p.valorTotal)}</dd></dl>
          ${p.contraproposta ? `<div class="nt2-sec"><h4><i class="fas fa-comment-dots"></i> Mensagem do professor</h4><div class="nt2-texto">${esc(p.contraproposta)}</div></div>` : ''}
          ${p.status === 'recusada' ? `<div class="nt2-sec"><h4><i class="fas fa-circle-xmark"></i> Motivo da recusa</h4><div class="nt2-texto">${esc(p.motivoRecusa || 'Não informado')}${p.textoRecusa ? '\n' + esc(p.textoRecusa) : ''}</div></div>` : ''}
          <div class="nt2-sec aulas"><h4><i class="far fa-clock"></i> Aulas (${(p.aulas || []).length})</h4><ul class="nt2-lista">${linhas}</ul></div>
        </div>
        <div class="nt2-x-dir">${calendario(p)}
          <p class="nt2-dica">Clique num dia amarelo para aprovar a contraproposta. A aula muda na ${origemNome(p).toLowerCase()} ${esc(p.codigo || '')}; o professor só é atribuído em "Confirmar Professor".</p></div>
      </div>
      <div class="nt2-x-acoes">${botoes(p, false)}</div></div>`;
  }

  function desenharNotificacoes() {
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    injetarEstiloGrid();
    const cont = sec.querySelector('.nt-conteudo');
    fecharTooltip();
    sec.querySelectorAll('.nt-chip').forEach(c => c.classList.toggle('on', c.dataset.f === filtro));
    if (filtro === 'clientes') {
      if (window.SolicitacoesClientes) window.SolicitacoesClientes.desenhar(cont);
      return;
    }
    atualizarBotoesOcultar();
    const p = aberta && visiveis().find(x => x.id === aberta);
    if (p) { cont.innerHTML = expandidaHtml(p); return; }
    aberta = null;
    atualizarBotaoFiltro();

    // Dentro de um grupo: todas as propostas daquela simulação/contratação.
    const g = grupoAberto && grupos(visiveis()).find(x => x.chave === grupoAberto);
    if (g) {
      cont.innerHTML = `<div class="nt2-gv-topo">
          <button type="button" class="nt2-voltar" data-fechar-grupo><i class="fas fa-arrow-left"></i> Voltar às contratações</button>
          ${grupoTopoHtml(g, true)}</div>
        <div class="nt2-grade">${ordenar(g.propostas).map(cardHtml).join('')}</div>`;
      return;
    }
    grupoAberto = null;

    const lista = grupos(visiveis().filter(passaNoChip).filter(passaNoFiltro)).filter(x => !x.oculto);
    if (!lista.length) {
      const ocultos = gruposOcultos().length;
      cont.innerHTML = `<p class="pe-vazio">${filtrosAtivos() ? 'Nenhuma proposta para este filtro.' : filtro === 'aguardando' ? 'Nenhuma proposta aguardando resposta.' : 'Nenhuma notificação por aqui.'}${ocultos ? ` ${ocultos} ${ocultos === 1 ? 'contratação/simulação está oculta' : 'contratações/simulações estão ocultas'} — use "Exibir todas as propostas".` : ''}</p>`;
      return;
    }
    cont.innerHTML = agrupar(lista, x => x.ultima).map(m => `
      <section class="nt2-mes"><h3 class="nt2-mes-h">${m.titulo}<span>${m.total} ${m.total === 1 ? 'contratação/simulação' : 'contratações/simulações'}</span></h3>
        ${m.semanas.map(s => `<div class="nt2-semana"><h4 class="nt2-sem-h">${s.titulo}<span>${s.itens.length}</span></h4>
          <div class="nt2-ggrade">${s.itens.map(grupoCardHtml).join('')}</div></div>`).join('')}
      </section>`).join('');
  }

  // ── Grupos: uma simulação ou contratação com todas as suas propostas ─────
  const passaNoChip = (x) => filtro === 'todas' ? true : filtro === 'aguardando' ? x.status === 'pendente' : x.status !== 'pendente';
  const chaveGrupo = (p) => `${p.origem || 'contratacao'}|${p.idOrigem || p.codigo || ''}`;
  const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
  // Última movimentação da proposta (envio, resposta ou aprovação).
  const atividade = (p) => Math.max(ms(p.criadoEm), ms(p.respondidoEm), ms(p.aprovadoEm));
  // Oculta pela Central e nada aconteceu depois disso (ocultaEm ainda sem hora do
  // servidor = acabou de ocultar).
  const ocultaP = (p) => p.ocultaCentral === true && (!p.ocultaEm || atividade(p) <= ms(p.ocultaEm));
  const novaP = (p) => p.status !== 'pendente' && !p.lidaCentral;
  const autoConfirmada = (p) => p.status === 'aprovado' && p.autoConfirmado === true;
  const textoAuto = (p) => `Professor ${esc(profNome(p))} Aceitou`;

  function grupos(lista) {
    const mapa = new Map();
    lista.forEach(p => {
      const k = chaveGrupo(p);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(p);
    });
    // O grupo usa TODAS as propostas visíveis dele (não só as do filtro) para
    // o resumo, o sino e a regra de oculto.
    const todas = visiveis();
    return [...mapa.keys()].map(k => {
      const ps = todas.filter(p => chaveGrupo(p) === k);
      const base = ps.slice().sort((a, b) => atividade(b) - atividade(a))[0];
      const ultimaMs = Math.max(...ps.map(atividade));
      return {
        chave: k, origem: base.origem, codigo: base.codigo, clienteNome: base.clienteNome || '',
        propostas: ps, ultima: ultimaMs ? new Date(ultimaMs) : null,
        novas: ps.filter(novaP).length, oculto: ps.every(ocultaP)
      };
    }).sort((a, b) => (b.novas ? 1 : 0) - (a.novas ? 1 : 0) || (b.ultima || 0) - (a.ultima || 0));
  }
  const gruposOcultos = () => grupos(visiveis()).filter(g => g.oculto);

  // comAcoes: topo do grupo aberto (o card da lista já é um botão, não leva outro dentro).
  function grupoTopoHtml(g, comAcoes) {
    return `<span class="nt2-g-ico"><i class="fas ${g.origem === 'simulacao' ? 'fa-calculator' : 'fa-file-signature'}"></i></span>
      <span class="nt2-g-quem"><b>${esc(g.clienteNome || 'Cliente não identificado')}</b><span>${g.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${esc(g.codigo || '')}</span></span>
      ${comAcoes ? `<button type="button" class="pe-btn nt2-gerar-sol" data-gerar-sol="${esc(g.chave)}"><i class="fas fa-file-contract"></i> Gerar Solicitação de aula</button>` : ''}
      <span class="nt2-sino${g.novas ? ' on' : ''}" title="${g.novas ? `${g.novas} atualização(ões) não lida(s)` : 'Sem atualizações novas'}" aria-label="${g.novas} atualizações não lidas"><i class="fas fa-bell"></i>${g.novas ? `<b>${g.novas > 99 ? '99+' : g.novas}</b>` : ''}</span>`;
  }

  function grupoCardHtml(g) {
    const n = (st) => g.propostas.filter(p => p.status === st).length;
    const datas = g.propostas.flatMap(p => (p.aulas || []).map(a => isoDe(a.data))).filter(Boolean).sort();
    const br = (iso) => iso.split('-').reverse().join('/');
    const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? br(datas[0]) : `${br(datas[0])} a ${br(datas[datas.length - 1])}`) : '—';
    const nAulas = Math.max(0, ...g.propostas.map(p => (p.aulas || []).length));
    const alunos = [...new Set(g.propostas.flatMap(p => (Array.isArray(p.estudantes) ? p.estudantes : []).map(e => e.nome)).filter(Boolean))];
    const bairro = (g.propostas.find(p => p.bairro) || {}).bairro || '';
    const mats = materiasDoGrupo(g);
    const nConf = mats.filter(m => m.conf === m.total).length;
    const chips = [['pendente', 'Aguardando'], ['aceita', 'Aceitaram'], ['contraproposta', 'Contraproposta'], ['recusada', 'Recusaram'], ['encerrada', 'Encerradas']]
      .map(([st, rot]) => [st, rot, n(st)]).filter(x => x[2])
      .map(([st, rot, k]) => `<span class="nt2-st ${(ST[st] || ST.pendente)[1]}">${rot} · ${k}</span>`).join('');
    return `<button type="button" class="nt2-g${g.novas ? ' nova' : ''}" data-grupo="${esc(g.chave)}" aria-label="Abrir propostas de ${esc(g.clienteNome)}">
      <div class="nt2-g-topo">${grupoTopoHtml(g)}</div>
      <dl class="nt2-g-info">
        <dt>Aulas</dt><dd>${nAulas} · ${esc(periodo)}</dd>
        ${alunos.length ? `<dt>Aluno</dt><dd>${esc(alunos.join(', '))}</dd>` : ''}
        ${bairro ? `<dt>Bairro</dt><dd>${esc(bairro)}</dd>` : ''}
        <dt>Propostas</dt><dd>${g.propostas.length} ${g.propostas.length === 1 ? 'professor' : 'professores'}</dd>
      </dl>
      ${mats.length ? `<div class="nt2-prog" data-prog="${esc(g.chave)}">
        <div class="nt2-prog-h"><span>Professores confirmados</span><b>${nConf}/${mats.length} ${mats.length === 1 ? 'matéria' : 'matérias'}</b></div>
        <div class="nt2-prog-barra">${mats.map(m => `<i><b style="width:${Math.round(m.conf / m.total * 100)}%"></b></i>`).join('')}</div></div>` : ''}
      ${chips ? `<div class="nt2-g-chips">${chips}</div>` : ''}
      <div class="nt2-g-pe"><span>${g.ultima ? `Atualizado em ${g.ultima.toLocaleDateString('pt-BR')} ${g.ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span><span>Ver propostas <i class="fas fa-arrow-right"></i></span></div>
    </button>`;
  }

  // Por matéria do grupo: aulas (cada uma uma vez, chaveAula), quantas já têm
  // professor confirmado (proposta 'aprovado' com a aula atribuída) e os
  // professores que receberam a proposta — confirmados primeiro.
  function materiasDoGrupo(g) {
    const mapa = new Map();
    g.propostas.forEach(p => {
      const atrib = new Set(p.status === 'aprovado' ? (p.aulasAtribuidas || []).map(Number) : []);
      const quem = String(p.professorId || p.professorEmail || p.id);
      (p.aulas || []).forEach((a, i) => {
        const nome = String(a.materia || '').trim() || 'Sem matéria';
        if (!mapa.has(norm(nome))) mapa.set(norm(nome), { nome, aulas: new Set(), conf: new Set(), profs: new Map() });
        const m = mapa.get(norm(nome));
        const ka = chaveAula(a);
        m.aulas.add(ka);
        const prof = m.profs.get(quem) || { p, confirmado: false };
        if (atrib.has(i)) { m.conf.add(ka); prof.confirmado = true; prof.p = p; }
        m.profs.set(quem, prof);
      });
    });
    return [...mapa.values()]
      .map(m => ({ nome: m.nome, total: m.aulas.size, conf: m.conf.size, profs: [...m.profs.values()].sort((a, b) => b.confirmado - a.confirmado) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Fotos dos professores para o tooltip da barra (dataBaseProfessores, lido uma vez).
  let professoresPorId = null, carregandoFotos = null;
  function carregarFotosProfessores() {
    if (!carregandoFotos) carregandoFotos = carregarProfessores()
      .then(lista => { professoresPorId = new Map(lista.map(p => [String(p.id), p])); })
      .catch(err => { carregandoFotos = null; console.warn('[Propostas] Fotos dos professores indisponíveis:', err && err.code); });
    return carregandoFotos;
  }

  // Tooltip da barra: matéria + situação e a grade (4 colunas) dos professores
  // que receberam a proposta; o confirmado aparece colorido, os outros em cinza.
  function tooltipHtml(g) {
    return materiasDoGrupo(g).map(m => {
      const ok = m.conf === m.total;
      const st = ok ? '<span class="nt2-st g">Prof. confirmado</span>'
        : `<span class="nt2-st n">Aguardando professor${m.conf ? ` · ${m.conf}/${m.total} aulas` : ''}</span>`;
      const profs = m.profs.map(({ p, confirmado }) => {
        const cad = (professoresPorId && professoresPorId.get(String(p.professorId))) || {};
        const foto = fotoDe(cad);
        const nome = cad.apelido || profNome(p);
        return `<span class="nt2-tip-p${confirmado ? ' on' : ''}">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : `<span class="ini">${esc(iniciais(cad.nome || p.professorNome))}</span>`}<small>${esc(nome)}</small></span>`;
      }).join('');
      return `<div class="nt2-tip-mat"><div class="nt2-tip-h"><i class="${esc(iconeMateria(m.nome))}"></i><b>${esc(m.nome)}</b>${st}</div>
        <div class="nt2-tip-grade">${profs}</div></div>`;
    }).join('');
  }

  let tip = null, tipAlvo = null;
  function fecharTooltip() { if (tip) tip.remove(); tip = null; tipAlvo = null; }
  function abrirTooltip(alvo) {
    if (alvo === tipAlvo && tip) return;
    fecharTooltip();
    const g = grupos(visiveis()).find(x => x.chave === alvo.dataset.prog);
    if (!g) return;
    tipAlvo = alvo;
    tip = document.createElement('div');
    tip.className = 'nt2-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = tooltipHtml(g);
    document.body.appendChild(tip);
    const r = alvo.getBoundingClientRect(), t = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    const top = r.bottom + 8 + t.height <= window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - t.height - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  // ── Classificação por mês e semana ───────────────────────────────────────
  const dataEnvio = (p) => (p.criadoEm && p.criadoEm.toDate ? p.criadoEm.toDate() : null);
  function segundaDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  const ddmm = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  // Meses do mais novo para o mais antigo; dentro de cada mês, semanas de segunda a domingo.
  function agrupar(lista, dataDoItem) {
    const meses = new Map();
    lista.forEach(p => {
      const d = dataDoItem(p);
      const chaveMes = d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : '0000-00';
      if (!meses.has(chaveMes)) meses.set(chaveMes, { titulo: d ? `${MESES[d.getMonth()].replace(/^./, c => c.toUpperCase())} ${d.getFullYear()}` : 'Sem data', semanas: new Map(), total: 0 });
      const mes = meses.get(chaveMes);
      mes.total++;
      const seg = d ? segundaDe(d) : null;
      const chaveSem = seg ? seg.getTime() : 0;
      if (!mes.semanas.has(chaveSem)) {
        const dom = seg ? new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6) : null;
        mes.semanas.set(chaveSem, { titulo: seg ? `Semana de ${ddmm(seg)} até ${ddmm(dom)}` : 'Sem data', itens: [] });
      }
      mes.semanas.get(chaveSem).itens.push(p);
    });
    return [...meses.entries()].sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, m]) => ({ ...m, semanas: [...m.semanas.entries()].sort((a, b) => b[0] - a[0]).map(([, s]) => s) }));
  }

  // ── Filtro: status, professor, cliente e data de envio ───────────────────
  const filtros = { status: new Set(), professor: '', cliente: '', de: '', ate: '' };
  const filtrosAtivos = () => filtros.status.size + (filtros.professor ? 1 : 0) + (filtros.cliente ? 1 : 0) + (filtros.de || filtros.ate ? 1 : 0);
  const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function passaNoFiltro(p) {
    if (filtros.status.size && !filtros.status.has(p.status)) return false;
    if (filtros.de || filtros.ate) {
      const d = dataEnvio(p);
      if (!d) return false;
      const iso = isoLocal(d);
      if (filtros.de && iso < filtros.de) return false;
      if (filtros.ate && iso > filtros.ate) return false;
    }
    if (filtros.professor && !norm(`${p.professorNome} ${p.professorApelido}`).includes(norm(filtros.professor))) return false;
    if (filtros.cliente && !norm(`${p.clienteNome} ${p.clienteApelido}`).includes(norm(filtros.cliente))) return false;
    return true;
  }
  function atualizarBotaoFiltro() {
    const n = document.querySelector('#nt2-btn-filtro .nt2-badge');
    if (n) { const k = filtrosAtivos(); n.textContent = k; n.hidden = !k; }
  }
  function painelFiltroHtml() {
    return `<div class="nt2-filtro" id="nt2-filtro" hidden role="dialog" aria-label="Filtrar propostas">
      <div class="nt2-f-sec"><b>Status</b>${Object.entries(ST).map(([k, [rot]]) =>
        `<label><input type="checkbox" value="${k}" ${filtros.status.has(k) ? 'checked' : ''}> ${rot}</label>`).join('')}</div>
      <label class="nt2-f-campo">Professor<input type="search" id="nt2-f-prof" placeholder="Nome do professor" value="${esc(filtros.professor)}"></label>
      <label class="nt2-f-campo">Cliente<input type="search" id="nt2-f-cli" placeholder="Nome do cliente" value="${esc(filtros.cliente)}"></label>
      <div class="nt2-f-sec"><b>Data de envio da proposta</b>
        <div class="nt2-f-datas"><label class="nt2-f-campo">De<input type="date" id="nt2-f-de" value="${esc(filtros.de)}"></label>
          <label class="nt2-f-campo">Até<input type="date" id="nt2-f-ate" value="${esc(filtros.ate)}"></label></div></div>
      <div class="nt2-f-acoes"><button type="button" class="pe-btn" id="nt2-f-limpar">Limpar filtros</button><button type="button" class="pe-btn pri" id="nt2-f-ok">Fechar</button></div>
    </div>`;
  }
  function ligarFiltro(sec) {
    const btn = sec.querySelector('#nt2-btn-filtro'), painel = sec.querySelector('#nt2-filtro');
    const abrir = (sim) => { painel.hidden = !sim; btn.setAttribute('aria-expanded', String(sim)); if (sim) sec.querySelector('#nt2-f-prof').focus(); };
    btn.onclick = () => abrir(painel.hidden);
    sec.querySelector('#nt2-f-ok').onclick = () => abrir(false);
    painel.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      if (e.target.checked) filtros.status.add(e.target.value); else filtros.status.delete(e.target.value);
      aberta = null; desenharNotificacoes();
    });
    sec.querySelector('#nt2-f-prof').oninput = (e) => { filtros.professor = e.target.value.trim(); aberta = null; desenharNotificacoes(); };
    sec.querySelector('#nt2-f-cli').oninput = (e) => { filtros.cliente = e.target.value.trim(); aberta = null; desenharNotificacoes(); };
    sec.querySelector('#nt2-f-de').onchange = (e) => { filtros.de = e.target.value; aberta = null; grupoAberto = null; desenharNotificacoes(); };
    sec.querySelector('#nt2-f-ate').onchange = (e) => { filtros.ate = e.target.value; aberta = null; grupoAberto = null; desenharNotificacoes(); };
    sec.querySelector('#nt2-f-limpar').onclick = () => {
      filtros.status.clear(); filtros.professor = ''; filtros.cliente = ''; filtros.de = ''; filtros.ate = '';
      painel.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = false; });
      sec.querySelector('#nt2-f-prof').value = ''; sec.querySelector('#nt2-f-cli').value = '';
      sec.querySelector('#nt2-f-de').value = ''; sec.querySelector('#nt2-f-ate').value = '';
      desenharNotificacoes();
    };
    if (!ligarFiltro.fora) {
      ligarFiltro.fora = true;
      document.addEventListener('mousedown', (e) => {
        const pn = document.getElementById('nt2-filtro');
        if (pn && !pn.hidden && !e.target.closest('#nt2-filtro, #nt2-btn-filtro')) { pn.hidden = true; document.getElementById('nt2-btn-filtro')?.setAttribute('aria-expanded', 'false'); }
      });
    }
  }

  // ── Ocultar / exibir (só visual: nada é apagado e o professor não vê) ─────
  async function gravarEmLotes(ids, dados) {
    for (let i = 0; i < ids.length; i += 400) {
      const lote = fdb().batch();
      ids.slice(i, i + 400).forEach(id => lote.update(fdb().collection(COLECAO).doc(id), dados));
      await lote.commit();
    }
  }

  // Oculta os grupos que estão na tela agora (respeita chip e filtros).
  async function ocultarTodas() {
    const exibidos = grupos(visiveis().filter(passaNoChip).filter(passaNoFiltro)).filter(g => !g.oculto);
    const ids = exibidos.flatMap(g => g.propostas.map(p => p.id));
    if (!ids.length) { aviso('Não há propostas na tela para ocultar.', 'info'); return; }
    try {
      await gravarEmLotes(ids, { ocultaCentral: true, ocultaEm: ts() });
      grupoAberto = null; aberta = null;
      aviso(`${exibidos.length} ${exibidos.length === 1 ? 'contratação/simulação ocultada' : 'contratações/simulações ocultadas'}. Elas voltam sozinhas se houver resposta nova.`, 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao ocultar:', err);
      aviso('Não foi possível ocultar as propostas.', 'error');
    }
  }

  async function exibirTodas() {
    const ids = visiveis().filter(p => p.ocultaCentral === true).map(p => p.id);
    if (!ids.length) { aviso('Não há propostas ocultas.', 'info'); return; }
    try {
      await gravarEmLotes(ids, { ocultaCentral: false });
      aviso('Todas as propostas voltaram a ser exibidas.', 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao exibir:', err);
      aviso('Não foi possível exibir as propostas.', 'error');
    }
  }

  function atualizarBotoesOcultar() {
    const n = gruposOcultos().length;
    const b = document.getElementById('nt2-exibir-todas');
    if (b) { b.querySelector('.nt2-badge').textContent = n; b.querySelector('.nt2-badge').hidden = !n; b.disabled = !n; }
  }

  function abrirProposta(id) {
    const p = propostas.find(x => x.id === id);
    if (!p) return;
    aberta = id;
    grupoAberto = chaveGrupo(p);
    if (p.status !== 'pendente' && !p.lidaCentral) {
      fdb().collection(COLECAO).doc(p.id).update({ lidaCentral: true }).catch(err => console.warn('[Notificações] Não marcou como lida:', err && err.code));
    }
    desenharNotificacoes();
    const sec = document.getElementById('notificacoes');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function aoClicarGrid(e) {
    if (filtro === 'clientes') return;
    const gerar = e.target.closest('[data-gerar-sol]');
    if (gerar) { gerarSolicitacaoGrupo(gerar.dataset.gerarSol, gerar); return; }
    const grupo = e.target.closest('[data-grupo], [data-fechar-grupo]');
    if (grupo) {
      grupoAberto = grupo.hasAttribute('data-fechar-grupo') ? null : grupo.dataset.grupo;
      aberta = null;
      desenharNotificacoes();
      const sec = document.getElementById('notificacoes');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const alvo = e.target.closest('[data-mes], [data-dia], [data-acao], [data-aprovar-aula], [data-fechar], [data-abrir]');
    if (!alvo || alvo.disabled) return;
    const p = propostas.find(x => x.id === (alvo.dataset.id || alvo.dataset.abrir));
    if (alvo.hasAttribute('data-fechar')) { aberta = null; desenharNotificacoes(); return; }
    if (alvo.dataset.mes !== undefined) { if (alvo.dataset.mes && p) { mesDoCard.set(p.id, alvo.dataset.mes); desenharNotificacoes(); } return; }
    if (!p) return;
    if (alvo.dataset.dia) {
      const idx = aulasComEstado(p).filter(a => a.estado === 'contra' && (isoDe(a.data) === alvo.dataset.dia || isoDe(a.alt.data) === alvo.dataset.dia)).map(a => a.i);
      aprovarContra(p, idx);
      return;
    }
    if (alvo.dataset.aprovarAula !== undefined) { aprovarContra(p, [Number(alvo.dataset.aprovarAula)]); return; }
    if (alvo.dataset.abrir) { abrirProposta(p.id); return; }
    const acao = alvo.dataset.acao;
    if (acao === 'sol') gerarSolicitacao(p);
    else if (acao === 'aprovar') aprovarProfessor(p);
    else if (acao === 'reenviar') reenviarProposta(p);
    else if (acao === 'analise') enviarParaAnalise(p);
    else if (acao === 'apagar') apagarProposta(p);
  }

  // Janela simples com botões. botoes: [{ rotulo, valor, classe, desabilitado }].
  // aoMontar(caixa, botoesEl) permite validar campos antes de liberar o botão.
  function janela({ titulo, corpo, botoes, largura = 560, aoMontar }) {
    return new Promise(resolve => {
      const f = document.createElement('div');
      f.className = 'pe-fundo';
      f.innerHTML = `<div class="pe-caixa nt2-modal" style="max-width:${largura}px;height:auto" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="pe-topo"><h3>${esc(titulo)}</h3><button class="pe-x" aria-label="Fechar">&times;</button></div>
        <div class="pe-corpo">${corpo}</div>
        <div class="pe-rodape" style="justify-content:flex-end">${botoes.map((b, i) => `<button class="pe-btn ${b.classe || ''}" data-i="${i}" ${b.desabilitado ? 'disabled' : ''}>${esc(b.rotulo)}</button>`).join('')}</div></div>`;
      const fim = (v) => { f.remove(); document.removeEventListener('keydown', k); resolve(v); };
      const k = (e) => { if (e.key === 'Escape') fim(null); };
      document.addEventListener('keydown', k);
      f.querySelector('.pe-x').onclick = () => fim(null);
      f.addEventListener('mousedown', e => { if (e.target === f) fim(null); });
      f.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => { const bt = botoes[+b.dataset.i]; fim(typeof bt.valor === 'function' ? bt.valor(f) : bt.valor); }; });
      document.body.appendChild(f);
      if (aoMontar) aoMontar(f, [...f.querySelectorAll('[data-i]')]);
    });
  }

  // ── Contratação / simulação de origem ────────────────────────────────────
  async function docOrigem(p) {
    const col = p.origem === 'simulacao' ? 'simulacoes' : 'BancoDeAulas';
    const s = await fdb().collection(col).doc(String(p.idOrigem || p.codigo)).get();
    return s.exists ? s.data() : null;
  }
  // Aulas reais da origem e como achar a de uma aula da proposta. ref = data e
  // horário com que a aula está gravada lá (o original, antes de aprovar).
  async function aulasReais(p) {
    if (p.origem === 'simulacao') {
      const d = await docOrigem(p);
      const lista = (d && Array.isArray(d.aulas)) ? d.aulas.slice() : [];
      return {
        lista,
        achar(a, ref = a) {
          const i = Number.isInteger(a.indice) && lista[a.indice] && lista[a.indice].data === ref.data && lista[a.indice].horario === ref.horario
            ? a.indice : lista.findIndex(x => x.data === ref.data && x.horario === ref.horario);
          return i >= 0 ? { idx: i, aula: lista[i] } : null;
        }
      };
    }
    const codigo = String(p.idOrigem || p.codigo || '');
    const [porId, porCodigo] = await Promise.all([
      fdb().collection('BancoDeAulas-Lista').where('idContratacao', '==', codigo).get(),
      fdb().collection('BancoDeAulas-Lista').where('codigoContratacao', '==', codigo).get()
    ]);
    const mapa = new Map();
    [...porId.docs, ...porCodigo.docs].forEach(d => mapa.set(d.id, d.data()));
    const lista = [...mapa.values()];
    return {
      lista,
      achar(a, ref = a) {
        const x = (a.idAula && lista.find(y => y['id-Aula'] === a.idAula)) || lista.find(y => y.data === ref.data && y.horario === ref.horario);
        return x && x['id-Aula'] ? { idAula: x['id-Aula'], aula: x } : null;
      }
    };
  }

  // Endereço completo das aulas (mesma regra de local-aula.js do portal):
  // gravado na proposta só quando a Master aprova o professor.
  function coordenadasDoLink(url) {
    let t = String(url || '');
    try { t = decodeURIComponent(t); } catch (_) { /* mantém */ }
    const padroes = [/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/, /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, /\/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/];
    for (const re of padroes) { const m = t.match(re); if (m) return { lat: Number(m[1]), lng: Number(m[2]) }; }
    return null;
  }
  async function localDoCliente(p) {
    try {
      const d = await docOrigem(p);
      if (!d || !d.cpf) return null;
      const c = await fdb().collection('cadastroClientes').where('cpf', '==', d.cpf).limit(1).get();
      if (c.empty) return null;
      const cad = c.docs[0].data();
      const res = cad.mesmoEndereco === true || (!String(cad.enderecoAulas || '').trim() && !String(cad.cidadeUFAulas || '').trim());
      const rua = String((res ? cad.endereco : cad.enderecoAulas) || '').trim();
      const compl = String((res ? cad.complemento : cad.complementoAulas) || '').trim();
      const cidade = String((res ? cad.cidadeUF : cad.cidadeUFAulas) || '').trim();
      const link = String(cad.linkMapsResidencia || '').trim();
      const coords = coordenadasDoLink(link);
      return {
        endereco: [rua, cidade].filter(Boolean).join(' · ').slice(0, 300),
        enderecoBusca: [rua, cidade].filter(Boolean).join(', ').slice(0, 300),
        referencia: compl.slice(0, 200), linkMaps: link.slice(0, 500),
        lat: coords ? coords.lat : null, lng: coords ? coords.lng : null
      };
    } catch (err) {
      console.warn('[Propostas] Endereço do cliente indisponível:', err && err.code);
      return null;
    }
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  async function aprovarContra(p, indices) {
    const est = aulasComEstado(p).filter(a => indices.includes(a.i) && a.estado === 'contra');
    if (!est.length) return;
    const varias = est.length > 1;
    const escolha = await janela({
      titulo: 'Aprovar contraproposta',
      corpo: `<p>Prof. <b>${esc(p.professorNome || '')}</b> · ${origemNome(p)} ${esc(p.codigo || '')} · ${esc(p.clienteNome || '')}</p>
        ${est.map(a => `<dl class="item"><span class="h">${esc(a.materia || 'Aula')} · ${esc(a.duracao || '')}</span>
          <dt>Cliente escolheu</dt><dd><s style="color:#9ca3af">${esc(curta(a.alt.deData || a.data))} · ${esc(a.alt.deHorario || a.horario || '')}</s></dd>
          <dt>Professor sugere</dt><dd>${esc(curta(a.alt.data))} · ${esc(a.alt.horario || '')}</dd>
          ${varias ? `<label class="chk so"><input type="checkbox" class="nt2-so" value="${a.i}" checked style="accent-color:#16a34a"> Aprovar esta</label>` : ''}</dl>`).join('')}
        ${p.contraproposta ? `<p class="fino">"${esc(p.contraproposta)}"</p>` : ''}
        <p class="fino">Ao aprovar, a aula muda na ${origemNome(p).toLowerCase()} ${esc(p.codigo || '')} para a data e o horário sugeridos. O professor só é atribuído em "Confirmar Professor".</p>`,
      botoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Aprovar contraproposta', classe: 'pri', valor: (f) => varias ? [...f.querySelectorAll('.nt2-so:checked')].map(c => Number(c.value)) : [est[0].i] }]
    });
    if (!escolha || !escolha.length) return;
    const alvo = est.filter(a => escolha.includes(a.i));
    try {
      const reais = await aulasReais(p);
      const sim = p.origem === 'simulacao' ? reais.lista : null;
      const feitos = [], falhas = [];
      for (const a of alvo) {
        const r = reais.achar(a, { data: a.alt.deData || a.data, horario: a.alt.deHorario || a.horario });
        if (!r) { falhas.push(a); continue; }
        if (sim) sim[r.idx] = { ...sim[r.idx], data: a.alt.data, horario: a.alt.horario };
        else await BANCO.updateCamposCalendario(r.idAula, { data: a.alt.data, horario: a.alt.horario });
        feitos.push(a.i);
      }
      if (sim && feitos.length) await fdb().collection('simulacoes').doc(String(p.idOrigem)).update({ aulas: sim });
      if (feitos.length) {
        const alts = new Map((p.alteracoes || []).map(al => [Number(al.i), al]));
        const aulas = (p.aulas || []).map((x, i) => feitos.includes(i) ? { ...x, data: alts.get(i).data, horario: alts.get(i).horario } : x);
        const alteracoes = (p.alteracoes || []).map(al => feitos.includes(Number(al.i)) ? { ...al, aprovada: true } : al);
        await fdb().collection(COLECAO).doc(p.id).update({ aulas, alteracoes });
      }
      aviso(`${feitos.length} aula(s) alterada(s) na ${origemNome(p).toLowerCase()}${falhas.length ? ` · ${falhas.length} não encontrada(s) (confira datas e horários)` : ''}.`, falhas.length ? 'warning' : 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao aprovar contraproposta:', err);
      aviso('Não foi possível aprovar a contraproposta.', 'error');
    }
  }

  // ── Atribuição do professor às aulas (manual e automática) ───────────────
  const livre = (x) => !String(x.professor || '').trim() || String(x.professor).trim() === 'A definir';
  const emailDe = (v) => String(v || '').trim().toLowerCase();
  // A aula já está com este professor (e-mail nas contratações; nome nas simulações).
  const ehDoProfessor = (aula, nome, email) =>
    (email && emailDe(aula.professorEmail) === email) || (!!nome && norm(aula.professor) === norm(nome));
  // "qua - 21/10/26"
  const dataBullet = (br) => {
    const iso = isoDe(br); if (!iso) return String(br || '—');
    const [y, m, d] = iso.split('-').map(Number);
    return `${SEM3[new Date(y, m - 1, d).getDay()]} - ${pad2(d)}/${pad2(m)}/${String(y).slice(2)}`;
  };

  async function cadastroDoProfessor(p) {
    const s = await fdb().collection('dataBaseProfessores').doc(String(p.professorId)).get();
    return s.exists ? s.data() : null;
  }

  // Grava o professor nas aulas indicadas (m.r = aula real achada na origem).
  async function gravarProfessorNasAulas(p, itens, reais, prof) {
    if (!itens.length) return;
    const nome = prof.nome || p.professorNome || '';
    if (p.origem === 'simulacao') {
      const lista = reais.lista;
      itens.forEach(m => { lista[m.r.idx] = { ...lista[m.r.idx], professor: nome, idProfessor: prof.cpf || '', professorUid: prof.uid || '' }; });
      await fdb().collection('simulacoes').doc(String(p.idOrigem)).update({ aulas: lista });
    } else {
      for (const m of itens) await BANCO.updateProfessorAula(m.r.idAula, nome, prof.cpf || '', prof.uid || '');
    }
  }

  // Duas propostas concorrem quando têm aula em comum: o envio é por lote (uma
  // disciplina por vez), então quem recebeu o mesmo lote disputa as mesmas aulas
  // e lotes de outra disciplina da mesma contratação não se cruzam.
  // Contratação: id-Aula; simulação: posição na lista; antigas sem os dois: data/horário/matéria.
  const chaveAula = (a) => a.idAula ? `id|${a.idAula}` : a.indice != null ? `i|${a.indice}` : `d|${a.data}|${a.horario}|${norm(a.materia)}`;
  function concorrem(a, b) {
    const ka = new Set((a.aulas || []).map(chaveAula));
    return (b.aulas || []).some(x => ka.has(chaveAula(x)));
  }

  // Proposta vira 'aprovado' (o professor vê "Nova contratação!" e o endereço) e
  // as outras propostas abertas do grupo que concorrem pelas mesmas aulas ficam
  // encerradas ("As aulas foram atribuídas a outro professor"). Devolve quantas
  // foram encerradas.
  async function marcarAprovada(p, indices, extra) {
    const local = await localDoCliente(p);
    await fdb().collection(COLECAO).doc(p.id).update({
      status: 'aprovado', aprovadoEm: ts(), atribuidaEm: ts(), emAnalise: false, avisoVisto: false, lidaCentral: true,
      aulasAtribuidas: indices, local: local || null, ...extra
    });
    // Só as aulas atribuídas agora (as de outra disciplina da proposta seguem livres).
    const atribuidas = { aulas: indices.map(i => (p.aulas || [])[i]).filter(Boolean) };
    const outras = propostas.filter(x => x.id !== p.id && chaveGrupo(x) === chaveGrupo(p) && concorrem(atribuidas, x)
      && ['pendente', 'aceita', 'contraproposta'].includes(x.status));
    if (outras.length) {
      const lote = fdb().batch();
      outras.forEach(x => lote.update(fdb().collection(COLECAO).doc(x.id), { status: 'encerrada', emAnalise: false, lidaCentral: true }));
      await lote.commit();
    }
    return outras.length;
  }

  // Disciplina da aula como aparece na proposta.
  const materiaDe = (a) => String(a.materia || '').trim() || 'Sem matéria';

  // O professor pode ter recebido aulas de mais de uma disciplina: ele é
  // confirmado em uma por vez e as outras ficam livres para outro professor.
  async function escolherDisciplina(p) {
    const mats = [...new Set(aulasComEstado(p).filter(a => a.estado !== 'rec').map(materiaDe))];
    if (mats.length <= 1) return mats[0] || '';
    return janela({
      titulo: 'Confirmar Professor',
      largura: 480,
      corpo: `<p>O <b>Prof. ${esc(p.professorNome || '')}</b> recebeu aulas de ${mats.length} disciplinas. Em qual delas ele vai ser confirmado?</p>
        <p class="fino">As outras disciplinas continuam sem professor e podem ser confirmadas para outro.</p>`,
      botoes: [{ rotulo: 'Cancelar', valor: null }, ...mats.map(m => ({ rotulo: m, valor: m, classe: 'pri' }))]
    });
  }

  // Cadastro de quem está na aula hoje (foto do modal de substituição).
  function cadastroPorAula(aula) {
    const email = emailDe(aula.professorEmail), nome = norm(aula.professor);
    return [...(professoresPorId || new Map()).values()].find(c =>
      (aula.professorUid && c.uid === aula.professorUid) || (email && emailDe(c.email) === email) || (nome && norm(c.nome) === nome)) || null;
  }
  const fotoModal = (cad, nome) => {
    const foto = cad ? fotoDe(cad) : '';
    return foto ? `<img src="${esc(foto)}" alt="">` : `<span class="ini">${esc(iniciais(nome))}</span>`;
  };

  // "Deseja substituir os professores?": fotos de quem está nas aulas → foto do
  // novo. Não fecha sem gravar; Sim fica carregando até executar() terminar
  // (com erro, o modal continua aberto para tentar de novo).
  function modalSubstituicao({ atuais, novo, detalhe, executar }) {
    return new Promise(resolve => {
      const f = document.createElement('div');
      f.className = 'pe-fundo';
      f.innerHTML = `<div class="pe-caixa nt2-modal" style="max-width:520px;height:auto" role="dialog" aria-modal="true" aria-label="Substituir professor">
        <div class="pe-topo"><h3>Substituir professor</h3><button class="pe-x" aria-label="Fechar">&times;</button></div>
        <div class="pe-corpo"><p class="nt2-sub-tit">Deseja substituir os professores?</p>
          <div class="nt2-troca">
            <div class="nt2-troca-lado">${atuais.map(x => `<span class="nt2-troca-p">${fotoModal(x.cad, x.nome)}<small>${esc(x.nome)}</small></span>`).join('')}</div>
            <i class="fas fa-arrow-right nt2-troca-seta" aria-hidden="true"></i>
            <div class="nt2-troca-lado"><span class="nt2-troca-p on">${fotoModal(novo.cad, novo.nome)}<small>${esc(novo.nome)}</small></span></div>
          </div>${detalhe}</div>
        <div class="pe-rodape" style="justify-content:flex-end"><button class="pe-btn" data-nao>Não</button><button class="pe-btn pri" data-sim>Sim</button></div></div>`;
      let rodando = false;
      const fim = (v) => { f.remove(); document.removeEventListener('keydown', k); resolve(v); };
      const k = (e) => { if (e.key === 'Escape' && !rodando) fim(false); };
      document.addEventListener('keydown', k);
      f.querySelector('.pe-x').onclick = () => { if (!rodando) fim(false); };
      f.querySelector('[data-nao]').onclick = () => fim(false);
      f.addEventListener('mousedown', e => { if (e.target === f && !rodando) fim(false); });
      const sim = f.querySelector('[data-sim]'), nao = f.querySelector('[data-nao]');
      sim.onclick = async () => {
        rodando = true;
        sim.disabled = nao.disabled = true;
        sim.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Substituindo...';
        if (await executar()) { fim(true); return; }
        rodando = false;
        sim.disabled = nao.disabled = false;
        sim.textContent = 'Sim';
      };
      document.body.appendChild(f);
    });
  }

  // Confirmar Professor: numa disciplina da proposta, aceita de uma vez as
  // datas/horários da contraproposta (a aula muda na contratação ou simulação)
  // e coloca o professor nas aulas. Aulas "A definir" → grava direto; aulas com
  // outro professor → modal de substituição. Propostas abertas de outros
  // professores para as mesmas aulas ficam encerradas (marcarAprovada).
  async function aprovarProfessor(p) {
    const materia = await escolherDisciplina(p);
    if (materia == null) return;
    const est = aulasComEstado(p).filter(a => a.estado !== 'rec' && (!materia || materiaDe(a) === materia));
    let reais, prof;
    try {
      [reais, prof] = await Promise.all([aulasReais(p), cadastroDoProfessor(p), carregarFotosProfessores()]);
    } catch (err) { console.error('[Propostas] Origem indisponível:', err); aviso('Não foi possível ler as aulas da origem.', 'error'); return; }
    if (!prof) { aviso('Cadastro do professor não encontrado.', 'error'); return; }
    const nomeY = prof.nome || p.professorNome || '';
    const emailY = emailDe(prof.email || p.professorEmail);
    // Contraproposta ainda não aprovada: a aula está na origem com a data antiga e vai para a sugerida.
    const mapa = est.map(a => {
      const contra = a.estado === 'contra';
      const ref = contra ? { data: a.alt.deData || a.data, horario: a.alt.deHorario || a.horario } : { data: a.data, horario: a.horario };
      return { a, novo: contra ? { data: a.alt.data, horario: a.alt.horario } : null, r: reais.achar(a, ref) };
    });
    const eleg = mapa.filter(m => m.r && livre(m.r.aula));
    const jaDele = mapa.filter(m => m.r && !livre(m.r.aula) && ehDoProfessor(m.r.aula, nomeY, emailY));
    const ocupadas = mapa.filter(m => m.r && !livre(m.r.aula) && !ehDoProfessor(m.r.aula, nomeY, emailY));
    const semPar = mapa.filter(m => !m.r);
    const achadas = [...eleg, ...jaDele, ...ocupadas];
    if (!achadas.length) { aviso(`Nenhuma aula desta proposta foi encontrada na ${origemNome(p).toLowerCase()} ${p.codigo || ''} (data ou horário mudou?).`, 'error'); return; }

    const executar = async () => {
      try {
        // 1) Datas da contraproposta.
        const remarcadas = achadas.filter(m => m.novo);
        const sim = p.origem === 'simulacao' ? reais.lista : null;
        for (const m of remarcadas) {
          if (sim) sim[m.r.idx] = { ...sim[m.r.idx], data: m.novo.data, horario: m.novo.horario };
          else await BANCO.updateCamposCalendario(m.r.idAula, m.novo);
        }
        // 2) Professor nas aulas (na simulação grava a lista inteira, já com as datas novas).
        const gravar = [...eleg, ...ocupadas];
        if (gravar.length) await gravarProfessorNasAulas(p, gravar, reais, prof);
        else if (sim && remarcadas.length) await fdb().collection('simulacoes').doc(String(p.idOrigem)).update({ aulas: sim });
        // 3) Proposta: aulas com as datas novas e contrapropostas marcadas como aprovadas.
        const extra = {};
        if (remarcadas.length) {
          const novas = new Map(remarcadas.map(m => [m.a.i, m.novo]));
          extra.aulas = (p.aulas || []).map((x, i) => novas.has(i) ? { ...x, ...novas.get(i) } : x);
          extra.alteracoes = (p.alteracoes || []).map(al => novas.has(Number(al.i)) ? { ...al, aprovada: true } : al);
        }
        const encerradas = await marcarAprovada(p, achadas.map(m => m.a.i), extra);
        // 4) Professor substituído que ficou sem nenhuma aula do grupo: a proposta
        // aprovada dele passa a "encerrada".
        let substituidas = 0;
        if (ocupadas.length) {
          const trocadas = new Set(ocupadas.map(m => m.r.aula));
          const lote = fdb().batch();
          const vistos = new Set();
          ocupadas.forEach(m => {
            const nomeX = String(m.r.aula.professor || '').trim(), emailX = emailDe(m.r.aula.professorEmail);
            const k = emailX || norm(nomeX);
            if (vistos.has(k)) return;
            vistos.add(k);
            if (reais.lista.some(x => !trocadas.has(x) && ehDoProfessor(x, nomeX, emailX))) return;
            propostas.filter(x => x.id !== p.id && chaveGrupo(x) === chaveGrupo(p) && x.status === 'aprovado'
                && ((emailX && emailDe(x.professorEmail) === emailX) || norm(x.professorNome) === norm(nomeX)))
              .forEach(x => { substituidas++; lote.update(fdb().collection(COLECAO).doc(x.id), { status: 'encerrada', emAnalise: false, lidaCentral: true, substituidoEm: ts() }); });
          });
          if (substituidas) await lote.commit();
        }
        const n = eleg.length + ocupadas.length;
        aviso(`Prof. ${profNome(p)} confirmado em ${n || jaDele.length} aula(s)${materia ? ` de ${materia}` : ''}`
          + `${remarcadas.length ? ` · ${remarcadas.length} remarcada(s) pela contraproposta` : ''}`
          + `${ocupadas.length ? ` · ${ocupadas.length} substituída(s)` : ''}`
          + `${encerradas + substituidas ? ` · ${encerradas + substituidas} outra(s) proposta(s) encerrada(s)` : ''}`
          + `${semPar.length ? ` · ${semPar.length} não encontrada(s)` : ''}.`, semPar.length ? 'warning' : 'success');
        return true;
      } catch (err) {
        console.error('[Propostas] Erro ao confirmar o professor:', err);
        aviso('Não foi possível confirmar o professor.', 'error');
        return false;
      }
    };

    if (!ocupadas.length) { await executar(); return; }
    // Uma foto por professor que está nas aulas hoje.
    const atuais = [];
    ocupadas.forEach(m => {
      const nome = String(m.r.aula.professor).trim();
      if (!atuais.some(x => norm(x.nome) === norm(nome))) atuais.push({ nome, cad: cadastroPorAula(m.r.aula) });
    });
    await modalSubstituicao({
      atuais,
      novo: { nome: prof.apelido || nomeY, cad: prof },
      detalhe: `<ul>${ocupadas.map(m => `<li>${esc(dataBullet(m.novo ? m.novo.data : m.a.data))} · ${esc(m.a.materia || '')} - ${esc(String(m.r.aula.professor).trim())} → ${esc(nomeY)}</li>`).join('')}</ul>
        ${eleg.length ? `<p class="fino">Mais ${eleg.length} aula(s) que estavam "A definir" também ficam com ${esc(nomeY)}.</p>` : ''}
        ${mapa.some(m => m.novo) ? `<p class="fino">As datas e horários sugeridos pelo professor na contraproposta substituem os atuais.</p>` : ''}
        ${semPar.length ? `<div class="aviso">${semPar.length} aula(s) não foram encontradas na ${origemNome(p).toLowerCase()} (data ou horário mudou?).</div>` : ''}
        <p class="fino">O professor substituído sai destas aulas e é avisado na plataforma.</p>`,
      executar
    });
  }

  // ── Aceite sem alterações → professor vinculado automaticamente ──────────
  // Roda na Central (o projeto está no plano Spark, sem Cloud Functions): a
  // escuta das propostas começa no login, então basta alguém estar com a Central
  // aberta. Uma transação marca autoVinculo antes de mexer nas aulas, para duas
  // abas abertas não processarem a mesma proposta. Resultado em autoVinculo:
  //   'feito'  → aprovado automaticamente (autoConfirmado);
  //   'manual' → aulas já com outro professor/não encontradas: fica "Aceitou" e a
  //              Central decide no botão "Confirmar Professor";
  //   'erro'   → falhou; também fica para o "Confirmar Professor".
  // Só vale para aceites a partir desta versão — aceites antigos que estavam
  // esperando a Central continuam esperando.
  const AUTO_DESDE = Date.parse('2026-10-21T17:45:00-03:00');
  const emAutoVinculo = new Set();
  let filaAuto = Promise.resolve();

  function processarAceitesAutomaticos() {
    propostas
      .filter(p => p.status === 'aceita' && !p.autoVinculo && ms(p.respondidoEm) >= AUTO_DESDE
        && !(Array.isArray(p.alteracoes) && p.alteracoes.length) && !String(p.contraproposta || '').trim()
        && !emAutoVinculo.has(p.id))
      .forEach(p => {
        emAutoVinculo.add(p.id);
        // Uma por vez: duas propostas do mesmo grupo aceitas juntas não disputam as aulas.
        filaAuto = filaAuto.then(() => vincularAutomaticamente(p)).catch(() => {});
      });
  }

  async function vincularAutomaticamente(p) {
    const ref = fdb().collection(COLECAO).doc(p.id);
    try {
      const minha = await fdb().runTransaction(async (t) => {
        const s = await t.get(ref);
        const d = s.exists ? s.data() : null;
        if (!d || d.status !== 'aceita' || d.autoVinculo) return false;
        t.update(ref, { autoVinculo: 'processando' });
        return true;
      });
      if (!minha) return;
    } catch (err) {
      console.warn('[Propostas] Vínculo automático não iniciado:', err && err.code);
      emAutoVinculo.delete(p.id);
      return;
    }
    try {
      // Estado mais recente (outra proposta do grupo pode ter acabado de ser aprovada).
      const atual = propostas.find(x => x.id === p.id) || p;
      const [reais, prof] = await Promise.all([aulasReais(atual), cadastroDoProfessor(atual)]);
      if (!prof) { await ref.update({ autoVinculo: 'manual' }); return; }
      const nome = prof.nome || atual.professorNome || '';
      const email = emailDe(prof.email || atual.professorEmail);
      const achadas = (atual.aulas || []).map((a, i) => ({ a: { ...a, i }, r: reais.achar({ ...a, i }) })).filter(m => m.r);
      const deOutro = achadas.filter(m => !livre(m.r.aula) && !ehDoProfessor(m.r.aula, nome, email));
      if (!achadas.length || deOutro.length) { await ref.update({ autoVinculo: 'manual' }); return; }
      await gravarProfessorNasAulas(atual, achadas.filter(m => livre(m.r.aula)), reais, prof);
      // lidaCentral false: o card acende o sino para a Central ver a confirmação.
      const encerradas = await marcarAprovada(atual, achadas.map(m => m.a.i), { autoConfirmado: true, autoVinculo: 'feito', lidaCentral: false });
      console.log(`✅ [Propostas] ${nome} aceitou e foi vinculado a ${achadas.length} aula(s) de ${origemNome(atual)} ${atual.codigo || ''}${encerradas ? ` · ${encerradas} proposta(s) encerrada(s)` : ''}`);
      aviso(`Prof. ${profNome(atual)} aceitou a proposta e foi confirmado nas aulas de ${atual.clienteNome || origemNome(atual)}.`, 'success');
    } catch (err) {
      console.error('[Propostas] Erro no vínculo automático:', err);
      await ref.update({ autoVinculo: 'erro' }).catch(() => {});
    }
  }

  // Reenviar: cria uma proposta nova ('pendente') com as mesmas aulas para o
  // mesmo professor — já com as contrapropostas aprovadas na data nova — e a
  // antiga vira 'cancelada' sem aviso (avisoVisto). Documento novo porque o
  // professor só responde proposta 'pendente' e o histórico em
  // respostasPropostas usa o id da proposta (o professor só cria, não regrava).
  async function reenviarProposta(p) {
    const respondida = ['aceita', 'contraproposta', 'recusada'].includes(p.status);
    const ok = await janela({
      titulo: 'Reenviar proposta',
      corpo: `<p>O <b>Prof. ${esc(p.professorNome || '')}</b> recebe de novo a proposta da ${origemNome(p).toLowerCase()} ${esc(p.codigo || '')} · ${esc(p.clienteNome || '')} (${(p.aulas || []).length} aulas · ${moeda(p.valorTotal)}) para responder.</p>
        ${respondida ? '<div class="aviso">A resposta atual do professor é descartada: a proposta volta para "Aguardando resposta".</div>' : ''}
        ${p.status === 'encerrada' ? '<div class="aviso">Esta proposta foi encerrada porque outro professor foi confirmado. Se ele aceitar, use "Confirmar Professor" para substituir.</div>' : ''}`,
      botoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Reenviar proposta', valor: true, classe: 'pri' }]
    });
    if (!ok) return;
    const alts = new Map((Array.isArray(p.alteracoes) ? p.alteracoes : []).filter(a => a.aprovada).map(a => [Number(a.i), a]));
    const aulas = (p.aulas || []).map((a, i) => { const alt = alts.get(i); return alt ? { ...a, data: alt.data, horario: alt.horario } : a; });
    const campos = ['origem', 'idOrigem', 'codigo', 'clienteNome', 'clienteApelido', 'professorId', 'professorEmail', 'professorNome',
      'professorApelido', 'valorTotal', 'estudantes', 'bairro', 'cidade', 'conteudos'];
    const nova = Object.fromEntries(campos.filter(c => p[c] !== undefined).map(c => [c, p[c]]));
    try {
      const ref = fdb().collection(COLECAO).doc();
      const lote = fdb().batch();
      lote.set(ref, {
        ...nova, aulas, status: 'pendente', contraproposta: '', respondidoEm: null, lidaCentral: false,
        reenvioDe: p.id, enviadoPor: (window.currentUser && window.currentUser.email) || '', criadoEm: ts()
      });
      lote.update(fdb().collection(COLECAO).doc(p.id), {
        status: 'cancelada', canceladaEm: ts(), motivoCancelamento: [], avisoVisto: true, emAnalise: false, lidaCentral: true, reenviadaComo: ref.id
      });
      await lote.commit();
      if (aberta === p.id) aberta = null;
      aviso(`Proposta reenviada para o Prof. ${profNome(p)}.`, 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao reenviar:', err);
      aviso('Não foi possível reenviar a proposta.', 'error');
    }
  }

  async function enviarParaAnalise(p) {
    try {
      await fdb().collection(COLECAO).doc(p.id).update({ emAnalise: true, lidaCentral: true });
      aviso(`Proposta em análise. O professor ${profNome(p)} vê o aviso de negociação.`, 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao enviar para análise:', err);
      aviso('Não foi possível enviar para análise.', 'error');
    }
  }

  const MOTIVO_SEM_DISPONIBILIDADE = 'O cliente não tem disponibilidade para os dias definidos na contraproposta.';
  async function apagarProposta(p) {
    const silenciosa = p.status === 'aprovado' || p.status === 'encerrada';
    const motivos = await janela({
      titulo: 'Apagar proposta',
      corpo: `<p>A proposta enviada ao <b>Prof. ${esc(p.professorNome || '')}</b> (${origemNome(p)} ${esc(p.codigo || '')} · ${esc(p.clienteNome || '')}) será apagada e <b>não poderá ser recuperada</b>. Ela também some do painel do professor.</p>
        <p class="fino">As aulas continuam na ${origemNome(p).toLowerCase()} e no Banco de Aulas. Só a proposta é apagada.${p.status === 'aprovado' ? ' O professor continua atribuído às aulas.' : ''}</p>
        ${silenciosa ? '' : `<label class="fino" for="nt2-motivo" style="color:#111827;font-weight:700">Motivo (o professor vai ver)</label>
        <textarea id="nt2-motivo" maxlength="1000" placeholder="Escreva aqui o motivo da não aprovação da contraproposta para exibir ao professor"></textarea>
        <label class="chk"><input type="checkbox" id="nt2-sem-disp"> Marcar que o cliente não tem disponibilidade para os dias definidos na contraproposta</label>`}`,
      botoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Apagar proposta', classe: 'perigo', desabilitado: !silenciosa,
          valor: (f) => silenciosa ? [] : [f.querySelector('#nt2-sem-disp').checked ? MOTIVO_SEM_DISPONIBILIDADE : '', f.querySelector('#nt2-motivo').value.trim()].filter(Boolean) }],
      aoMontar: (f, bts) => {
        if (silenciosa) return;
        const txt = f.querySelector('#nt2-motivo'), chk = f.querySelector('#nt2-sem-disp');
        const validar = () => { bts[1].disabled = !(txt.value.trim() || chk.checked); };
        txt.addEventListener('input', validar); chk.addEventListener('change', validar);
      }
    });
    if (!motivos) return;
    try {
      await fdb().collection(COLECAO).doc(p.id).update({
        status: 'cancelada', canceladaEm: ts(), motivoCancelamento: motivos, avisoVisto: silenciosa, emAnalise: false, lidaCentral: true
      });
      if (aberta === p.id) aberta = null;
      aviso('Proposta apagada.', 'success');
    } catch (err) {
      console.error('[Propostas] Erro ao apagar:', err);
      aviso('Não foi possível apagar a proposta.', 'error');
    }
  }

  const linhaSolicitacao = (a, data, horario, professor, divergente) => ({
    data, horario, duracao: a.duracao, materia: a.materia, professor, estudante: a.estudante || '',
    valorAula: a.valor, status: 'Pendente', divergente
  });

  // Abre o modal "Solicitação de Aula" (BancoDeAulasCards) com as aulas por data;
  // divergente = horário sugerido pelo professor (borda amarela).
  async function abrirSolicitacao(p, aulas) {
    if (!window.BancoDeAulasCards || typeof BancoDeAulasCards.showModalSolicitacaoFinal !== 'function') { aviso('Módulo de solicitação indisponível.', 'error'); return; }
    let d = null;
    try { d = await docOrigem(p); } catch (_) { /* segue sem CPF: só não busca o cadastro */ }
    aulas.sort((x, y) => (isoDe(x.data) + x.horario).localeCompare(isoDe(y.data) + y.horario));
    const contrato = { nomeCliente: p.clienteNome || '', cpf: (d && d.cpf) || '', enderecoAulas: '', referencia: '' };
    if (d && (d.ValorPacote || d.ValorPacote === 0 || d.valorPacote)) contrato.ValorPacote = Number(d.ValorPacote ?? d.valorPacote);
    BancoDeAulasCards.showModalSolicitacaoFinal(contrato, aulas, undefined, 'cliente');
  }

  async function gerarSolicitacao(p) {
    await abrirSolicitacao(p, aulasComEstado(p).map(a => a.estado === 'contra'
      ? linhaSolicitacao(a, a.alt.data, a.alt.horario, p.professorNome || '', true)
      : linhaSolicitacao(a, a.data, a.horario, p.professorNome || '', !!a.alt)));
  }

  // "Gerar Solicitação de aula" do grupo: cronograma com todas as aulas da
  // contratação/simulação, cada uma uma vez (chaveAula), assim:
  //   • já tem professor confirmado (proposta 'aprovado' com a aula atribuída) →
  //     linha com ele, na data aprovada;
  //   • algum professor mandou contraproposta para ela → uma linha por sugestão,
  //     com o nome do professor (duas ou mais = "Opção 1 · Ana", "Opção 2 · Bruno");
  //   • senão → como o cliente pediu, professor "A definir".
  // Propostas canceladas e recusadas não entram.
  async function gerarSolicitacaoGrupo(chave, botao) {
    const ps = visiveis().filter(p => chaveGrupo(p) === chave && p.status !== 'recusada');
    if (!ps.length) return;
    const ok = await janela({
      titulo: 'Gerar Solicitação de aula',
      corpo: '<p>Deseja criar uma solicitação de aula com todas as contrapropostas dos professores?</p>',
      largura: 460,
      botoes: [{ rotulo: 'Voltar', valor: false }, { rotulo: 'Sim', valor: true, classe: 'pri' }]
    });
    if (!ok) return;
    const original = botao.innerHTML;
    botao.disabled = true; botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
    try {
      const porAula = new Map();
      ps.forEach(p => aulasComEstado(p).forEach(a => {
        const k = chaveAula(a);
        if (!porAula.has(k)) porAula.set(k, { a, confirmada: null, sugestoes: [], remarcada: null });
        const item = porAula.get(k);
        if (p.status === 'aprovado' && (p.aulasAtribuidas || []).map(Number).includes(a.i)) item.confirmada = { p, a };
        else if (a.alt && a.alt.aprovada) item.remarcada = a.alt; // contraproposta aprovada: a aula já mudou na origem
        else if (a.alt && p.status !== 'encerrada') item.sugestoes.push({ p, a });
      }));
      const aulas = [...porAula.values()].flatMap(({ a, confirmada, sugestoes, remarcada }) => {
        if (confirmada) {
          const c = confirmada.a, ap = c.alt && c.alt.aprovada;
          return [linhaSolicitacao(c, ap ? c.alt.data : c.data, ap ? c.alt.horario : c.horario, confirmada.p.professorNome || '', !!ap)];
        }
        // Mais de uma sugestão para a mesma aula: "Opção 1 · Ana", "Opção 2 · Bruno" para o cliente escolher.
        if (sugestoes.length) return sugestoes.map((s, n) => linhaSolicitacao(s.a, s.a.alt.data, s.a.alt.horario,
          (sugestoes.length > 1 ? `Opção ${n + 1} · ` : '') + (s.p.professorNome || ''), true));
        if (remarcada) return [linhaSolicitacao(a, remarcada.data, remarcada.horario, 'A definir', true)];
        return [linhaSolicitacao(a, a.data, a.horario, 'A definir', false)];
      });
      await abrirSolicitacao(ps[0], aulas);
    } catch (err) {
      console.error('[Propostas] Erro ao gerar a solicitação do grupo:', err);
      aviso('Não foi possível gerar a solicitação.', 'error');
    } finally {
      botao.disabled = false; botao.innerHTML = original;
    }
  }

  function loadNotificacoes() {
    injetarEstilo();
    injetarEstiloGrid();
    iniciarEscuta();
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    sec.innerHTML = `<div class="nt-wrap">
      <div class="nt-barra">
        <button class="nt-chip" data-f="clientes"><i class="fas fa-user-clock"></i> Clientes · reagendar/cancelar <span class="nt-chip-n" hidden>0</span></button>
        <button class="nt-chip" data-f="respondidas">Respondidas</button>
        <button class="nt-chip" data-f="aguardando">Aguardando resposta</button>
        <button class="nt-chip" data-f="todas">Todas</button>
        <span class="nt2-barra-dir">
          <span class="nt2-filtro-wrap"><button type="button" class="pe-btn" id="nt2-btn-filtro" aria-haspopup="true" aria-expanded="false"><i class="fas fa-filter"></i> Filtrar <span class="nt2-badge" hidden>0</span></button>${painelFiltroHtml()}</span>
          <button type="button" class="pe-btn" id="nt2-ocultar-todas" title="Esconde da tela as contratações/simulações exibidas. Nada é apagado."><i class="fas fa-eye-slash"></i> Ocultar todas as propostas</button>
          <button type="button" class="pe-btn" id="nt2-exibir-todas" title="Volta a mostrar tudo o que foi ocultado"><i class="fas fa-eye"></i> Exibir todas as propostas <span class="nt2-badge" hidden>0</span></button>
        </span>
      </div>
      <p class="nt-dica" style="margin:-.4rem 0 1rem">Cada card é uma contratação ou simulação: clique para ver as propostas enviadas aos professores. O sino mostra as respostas ainda não lidas.</p>
      <div class="nt-conteudo"><p class="pe-vazio">Carregando…</p></div></div>`;
    sec.querySelectorAll('.nt-chip').forEach(c => { c.onclick = () => { filtro = c.dataset.f; aberta = null; grupoAberto = null; desenharNotificacoes(); }; });
    ligarFiltro(sec);
    sec.querySelector('#nt2-ocultar-todas').onclick = ocultarTodas;
    sec.querySelector('#nt2-exibir-todas').onclick = exibirTodas;
    const cont = sec.querySelector('.nt-conteudo');
    cont.addEventListener('click', (e) => { fecharTooltip(); aoClicarGrid(e); });
    cont.addEventListener('mouseover', (e) => { const b = e.target.closest('[data-prog]'); if (b) abrirTooltip(b); else fecharTooltip(); });
    cont.addEventListener('mouseleave', fecharTooltip);
    cont.addEventListener('focusin', (e) => { const b = e.target.matches('[data-grupo]') && e.target.querySelector('[data-prog]'); if (b) abrirTooltip(b); else fecharTooltip(); });
    cont.addEventListener('focusout', fecharTooltip);
    if (!loadNotificacoes.rolagem) { loadNotificacoes.rolagem = true; window.addEventListener('scroll', fecharTooltip, true); }
    carregarFotosProfessores();
    carregarIconesMaterias();
    cont.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-abrir]')) { e.preventDefault(); abrirProposta(e.target.dataset.abrir); }
    });
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
