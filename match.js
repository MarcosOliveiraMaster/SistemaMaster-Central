console.log('✅ match.js carregado');

// Orquestra o botão "Match" do modal "Detalhes da Contratação": agrupa as aulas
// da contratação por disciplina e, para cada uma, monta um ranking dos professores
// que lecionam aquela matéria — pontuando disponibilidade (dia/turno), bairro do
// cliente, agenda existente no sistema, nível acadêmico e experiências.
//
// Somente leitura por enquanto: clicar num professor do ranking não atribui nada,
// apenas abre a justificativa (breakdown) da pontuação.
window.Match = (function () {
  'use strict';

  let _modalEl = null;

  // ===== Helpers genéricos =====
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizarTexto(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  function isTruthy(v) {
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    return ['true', '1', 'sim', 's', 'yes', 'on'].includes(String(v).toLowerCase().trim());
  }

  // ===== Dias / turnos =====
  // O professor só tem campos de disponibilidade de segunda a sábado — uma aula
  // caída num domingo nunca pontua aqui (não existe "domManha"/"domTarde").
  const DIA_LABEL = { seg: 'Segunda-feira', ter: 'Terça-feira', qua: 'Quarta-feira', qui: 'Quinta-feira', sex: 'Sexta-feira', sab: 'Sábado', dom: 'Domingo' };

  function extrairDiaKey(dataAula) {
    // Formato produzido pelo seletor de datas do modal: "seg - 10/01/2026".
    const prefixo = String(dataAula || '').split(' - ')[0];
    const norm = normalizarTexto(prefixo).slice(0, 3);
    return DIA_LABEL[norm] ? norm : null;
  }

  function extrairTurno(horario) {
    const m = String(horario || '').match(/^(\d{1,2}):/);
    if (!m) return null;
    return parseInt(m[1], 10) < 12 ? 'Manha' : 'Tarde';
  }

  function extrairDataReal(dataAula) {
    const m = String(dataAula || '').match(/\d{2}\/\d{2}\/\d{4}/);
    return m ? m[0] : null;
  }

  function horarioParaMinutos(horario) {
    const m = String(horario || '').match(/^(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }

  // ===== Matérias =====
  // Mesmo critério de parsing usado no seletor de matérias da tabela de aulas
  // (uma aula pode ter mais de uma matéria, formatada como "Mat1, Mat2 e Mat3").
  function splitMaterias(materiaStr) {
    if (!materiaStr) return [];
    return String(materiaStr)
      .split(/,\s+|\s+e\s+/)
      .map(m => m.trim())
      .filter(m => m && normalizarTexto(m) !== 'a definir');
  }

  function professorLecionaMateria(professor, materiaNormalizada) {
    const lista = String(professor.disciplinas || '').split(',').map(normalizarTexto).filter(Boolean);
    return lista.includes(materiaNormalizada);
  }

  // ===== Nível acadêmico =====
  // Campo de texto livre no cadastro do professor (sem lista fixa de opções) —
  // busca por palavra-chave, ignorando acento/maiúsculas, priorizando o nível
  // mais alto encontrado no texto.
  const NIVEL_KEYWORDS = [
    { chave: 'doutor', pontos: 5, label: 'Doutor(a) / Doutorando(a)' },
    { chave: 'mestre', pontos: 4, label: 'Mestre(a)' },
    { chave: 'mestrando', pontos: 3, label: 'Mestrando(a)' },
    { chave: 'graduado', pontos: 2, label: 'Graduado(a)' },
    { chave: 'graduando', pontos: 1, label: 'Graduando(a)' }
  ];

  function pontuarNivel(nivelTexto) {
    const norm = normalizarTexto(nivelTexto);
    if (!norm) return null;
    return NIVEL_KEYWORDS.find(item => norm.includes(item.chave)) || null;
  }

  // ===== Bairro do cliente =====
  // Não existe campo estruturado de bairro no cadastro do cliente — resolve via
  // CEP (ViaCEP) quando disponível, com fallback para busca em texto no endereço.
  async function resolverBairroCliente(cpf) {
    if (!cpf) return { bairro: '', origemCep: false };
    try {
      const snap = await db.collection('cadastroClientes').where('cpf', '==', cpf).limit(1).get();
      if (snap.empty) return { bairro: '', origemCep: false };
      const data = snap.docs[0].data();
      const cep = data.mesmoEndereco ? (data.cep || '') : (data.cepAulas || data.cep || '');
      const cepDigits = String(cep).replace(/\D/g, '');

      if (cepDigits.length === 8) {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
          if (resp.ok) {
            const json = await resp.json();
            if (json && !json.erro && json.bairro) {
              return { bairro: normalizarTexto(json.bairro), origemCep: true };
            }
          }
        } catch (_) { /* segue para o fallback de texto */ }
      }

      const enderecoTexto = data.mesmoEndereco ? (data.endereco || '') : (data.enderecoAulas || data.endereco || '');
      return { bairro: normalizarTexto(enderecoTexto), origemCep: false };
    } catch (e) {
      console.warn('[Match] Erro ao resolver bairro do cliente:', e);
      return { bairro: '', origemCep: false };
    }
  }

  function professorAtendeBairro(professor, bairroInfo) {
    if (!bairroInfo || !bairroInfo.bairro) return false;
    const listaBairrosProf = String(professor.bairros || '').split(',').map(normalizarTexto).filter(Boolean);
    if (!listaBairrosProf.length) return false;
    if (bairroInfo.origemCep) {
      // Bairro oficial (ViaCEP): aceita igualdade ou um contendo o outro (variações de escrita).
      return listaBairrosProf.some(b => b === bairroInfo.bairro || b.includes(bairroInfo.bairro) || bairroInfo.bairro.includes(b));
    }
    // Fallback em texto livre do endereço: aceita se o bairro do professor aparece dentro do texto.
    return listaBairrosProf.some(b => bairroInfo.bairro.includes(b));
  }

  // ===== Foto do professor =====
  // A área "BD Professores" atual (menu ativo -> dashboardProfessores.js /
  // GaleriaProfessores) guarda a foto como data URL base64 no campo "fotoUpload" —
  // é essa imagem que precisa aparecer aqui. O campo antigo "fotoPerfil" (pasta
  // estática img-professor/) pertence ao módulo anterior, hoje oculto no menu;
  // mantido só como fallback para cadastros legados que não tenham fotoUpload.
  function resolverFotoProfessor(professor) {
    if (professor.fotoUpload) return professor.fotoUpload;
    if (professor.fotoPerfil && professor.fotoPerfil !== 'icone-padrao') {
      return `img-professor/${professor.fotoPerfil}`;
    }
    return null;
  }

  // ===== Agrupamento das aulas da contratação por disciplina =====
  function montarGruposPorDisciplina(aulasContrato) {
    const grupos = {};
    (aulasContrato || []).forEach(aula => {
      splitMaterias(aula.materia).forEach(materia => {
        const key = normalizarTexto(materia);
        if (!grupos[key]) grupos[key] = { nome: materia, aulas: [] };
        grupos[key].aulas.push(aula);
      });
    });
    return grupos;
  }

  // ===== Pontuação de um professor dentro de um grupo (disciplina) =====
  function pontuarProfessor(professor, grupo, bairroInfo, todasAulasSistema, codigoContratacaoAtual, cpfCliente) {
    const detalhes = [];
    let pontos = 0;
    let maxPontos = 0;

    // 1) Leciona a matéria — já é pré-requisito para o professor entrar no grupo.
    pontos += 1; maxPontos += 1;
    detalhes.push({ label: `Leciona ${grupo.nome}`, pontos: 1 });

    // 2) e 3) Dias/turnos únicos da semana presentes nas aulas deste grupo
    // (avaliado por dia único, não por ocorrência de aula).
    const diasUnicos = new Set();
    const diaTurnoUnicos = new Set();
    grupo.aulas.forEach(a => {
      const dia = extrairDiaKey(a.data);
      const turno = extrairTurno(a.horario);
      if (dia) diasUnicos.add(dia);
      if (dia && turno) diaTurnoUnicos.add(`${dia}_${turno}`);
    });

    diasUnicos.forEach(dia => {
      maxPontos += 1;
      if (isTruthy(professor[`${dia}Manha`]) || isTruthy(professor[`${dia}Tarde`])) {
        pontos += 1;
        detalhes.push({ label: `Disponível ${DIA_LABEL[dia]}`, pontos: 1 });
      }
    });

    diaTurnoUnicos.forEach(chave => {
      maxPontos += 1;
      const [dia, turno] = chave.split('_');
      if (isTruthy(professor[`${dia}${turno}`])) {
        pontos += 1;
        detalhes.push({ label: `Disponível ${DIA_LABEL[dia]} à ${turno === 'Manha' ? 'manhã' : 'tarde'}`, pontos: 1 });
      }
    });

    // 4) Bairro do cliente — só entra na conta (pontos e máximo) quando foi possível resolver algum bairro.
    if (bairroInfo && bairroInfo.bairro) {
      maxPontos += 3;
      if (professorAtendeBairro(professor, bairroInfo)) {
        pontos += 3;
        detalhes.push({ label: 'Atende o bairro do cliente', pontos: 3 });
      }
    }

    // 5) Já atendeu este cliente antes — em qualquer matéria, qualquer status, qualquer
    // contratação (incluindo esta mesma, se ele já leciona outra disciplina aqui).
    // Checagem única por professor (não por aula), assim como o bairro.
    if (cpfCliente) {
      maxPontos += 3;
      const jaAtendeu = (todasAulasSistema || []).some(a => {
        const mesmoCliente = a.cpf && a.cpf === cpfCliente;
        const mesmoProfessor = (a.idProfessor && a.idProfessor === professor.cpf) ||
                                (a.professorUid && professor.uid && a.professorUid === professor.uid);
        return mesmoCliente && mesmoProfessor;
      });
      if (jaAtendeu) {
        pontos += 3;
        detalhes.push({ label: 'Já atendeu este cliente antes', pontos: 3 });
      }
    }

    // 6) e 7) Agenda do professor no sistema (todas as contratações, exceto esta,
    // ignorando aulas Canceladas/Reagendadas) — por aula real (data específica) do grupo.
    const aulasDoProfessorNoSistema = (todasAulasSistema || []).filter(a => {
      const mesmoProfessor = (a.idProfessor && a.idProfessor === professor.cpf) ||
                              (a.professorUid && professor.uid && a.professorUid === professor.uid);
      if (!mesmoProfessor) return false;
      const cod = a.idContratacao || (a['id-Aula'] || '').substring(0, 4);
      if (cod === codigoContratacaoAtual) return false;
      const status = a.StatusAula || '';
      return status !== 'Cancelada' && status !== 'Reagendada';
    });

    grupo.aulas.forEach(a => {
      const dataReal = extrairDataReal(a.data);
      if (!dataReal) return;
      maxPontos += 2;

      const minutos = horarioParaMinutos(a.horario);
      const aulasNoMesmoDia = aulasDoProfessorNoSistema.filter(x => extrairDataReal(x.data) === dataReal);

      if (aulasNoMesmoDia.length === 0) {
        pontos += 2;
        detalhes.push({ label: `Agenda livre em ${dataReal}`, pontos: 2 });
      } else if (minutos !== null) {
        const proxima = aulasNoMesmoDia.some(x => {
          const m2 = horarioParaMinutos(x.horario);
          return m2 !== null && Math.abs(m2 - minutos) <= 60;
        });
        if (proxima) {
          pontos += 1;
          detalhes.push({ label: `Já tem aula próxima ao horário em ${dataReal}`, pontos: 1 });
        }
      }
    });

    // 8) Nível acadêmico
    maxPontos += 5;
    const nivel = pontuarNivel(professor.nivel);
    if (nivel) {
      pontos += nivel.pontos;
      detalhes.push({ label: `Nível acadêmico: ${nivel.label}`, pontos: nivel.pontos });
    }

    // 9) Experiências
    [
      ['expAulas', 'Experiência com aulas particulares'],
      ['expNeuro', 'Experiência com alunos atípicos'],
      ['expTdics', 'Experiência com TDICs']
    ].forEach(([campo, label]) => {
      maxPontos += 1;
      if (isTruthy(professor[campo])) {
        pontos += 1;
        detalhes.push({ label, pontos: 1 });
      }
    });

    const taxaMatch = maxPontos > 0 ? Math.max(0, Math.min(100, Math.round((pontos / maxPontos) * 100))) : 0;

    return { professor, pontos, maxPontos, taxaMatch, detalhes };
  }

  // ===== Render =====
  function renderBarraMatch(taxa) {
    return `
      <div class="match-bar-track"><div class="match-bar-fill" style="width:${taxa}%"></div></div>
      <div class="match-bar-label">${taxa}% de match</div>
    `;
  }

  const PROFESSORES_POR_PAGINA = 3;

  function renderProfessorItem(resultado, idx, oculto) {
    const professor = resultado.professor;
    const foto = resolverFotoProfessor(professor);
    const fotoHtml = foto
      ? `<img src="${escapeHtml(foto)}" alt="${escapeHtml(professor.nome || '')}" class="match-foto" onerror="this.outerHTML='&lt;div class=\\'match-foto-fallback\\'&gt;&lt;i class=\\'fas fa-user\\'&gt;&lt;/i&gt;&lt;/div&gt;'">`
      : `<div class="match-foto-fallback"><i class="fas fa-user"></i></div>`;

    return `
      <div class="match-professor-row${oculto ? ' match-row-hidden' : ''}" data-row-idx="${idx}">
        <div class="match-professor-posicao">${idx + 1}º</div>
        ${fotoHtml}
        <div class="match-professor-info">
          <div class="match-professor-nome" title="${escapeHtml(professor.nome || '')}">${escapeHtml(professor.nome || 'Sem nome')}</div>
          ${renderBarraMatch(resultado.taxaMatch)}
        </div>
        <button type="button" class="match-info-btn" title="Ver justificativa da pontuação" data-idx="${idx}">
          <i class="fas fa-circle-info"></i>
        </button>
      </div>
    `;
  }

  function renderGrupoConteudo(grupo, ranking) {
    if (!ranking.length) {
      return `
        <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
          <i class="fas fa-book text-orange-500 mr-2"></i>${escapeHtml(grupo.nome)}
          <span class="text-xs font-normal text-gray-400 ml-2">${grupo.aulas.length} aula(s)</span>
        </h4>
        <p class="text-sm text-gray-400">Nenhum professor ativo cadastrado leciona esta matéria.</p>
      `;
    }

    const linhas = ranking.map((r, idx) => renderProfessorItem(r, idx, idx >= PROFESSORES_POR_PAGINA)).join('');
    const restantes = ranking.length - PROFESSORES_POR_PAGINA;
    const botaoMostrarMais = restantes > 0
      ? `<button type="button" class="match-mostrar-mais-btn btn-secondary btn-compact mt-2" data-shown="${PROFESSORES_POR_PAGINA}" data-total="${ranking.length}">
           Mostrar mais (${restantes} restante${restantes !== 1 ? 's' : ''})
         </button>`
      : '';

    return `
      <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
        <i class="fas fa-book text-orange-500 mr-2"></i>${escapeHtml(grupo.nome)}
        <span class="text-xs font-normal text-gray-400 ml-2">${grupo.aulas.length} aula(s)</span>
      </h4>
      <div class="match-lista">${linhas}</div>
      ${botaoMostrarMais}
    `;
  }

  function tratarCliqueMostrarMais(botaoMais) {
    const grupoEl = botaoMais.closest('.match-grupo');
    if (!grupoEl) return;
    const shown = parseInt(botaoMais.dataset.shown, 10) || 0;
    const total = parseInt(botaoMais.dataset.total, 10) || 0;
    const novoShown = Math.min(shown + PROFESSORES_POR_PAGINA, total);

    grupoEl.querySelectorAll('.match-professor-row.match-row-hidden').forEach(row => {
      const rowIdx = parseInt(row.dataset.rowIdx, 10);
      if (rowIdx < novoShown) row.classList.remove('match-row-hidden');
    });

    const restantes = total - novoShown;
    if (restantes <= 0) {
      botaoMais.remove();
    } else {
      botaoMais.dataset.shown = String(novoShown);
      botaoMais.textContent = `Mostrar mais (${restantes} restante${restantes !== 1 ? 's' : ''})`;
    }
  }

  // ===== Popover de justificativa (accordeon fechado por padrão) =====
  function posicionarPopover(pop, botaoEl) {
    const rect = botaoEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.right - popRect.width;
    if (top + popRect.height > window.innerHeight - 8) top = Math.max(8, rect.top - popRect.height - 6);
    if (left < 8) left = 8;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  function abrirPopoverJustificativa(botaoEl, resultado) {
    document.querySelectorAll('.match-popover').forEach(p => p.remove());

    const pop = document.createElement('div');
    pop.className = 'match-popover';
    pop.innerHTML = `
      <div class="match-popover-header">
        <div class="match-popover-nome">${escapeHtml(resultado.professor.nome || '')}</div>
        <div class="match-popover-percentual">${resultado.taxaMatch}% de match</div>
      </div>
      <button type="button" class="match-popover-toggle">
        <span>Ver detalhes da pontuação</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      <div class="match-popover-detalhes" style="display:none;">
        <div class="match-popover-lista">
          ${resultado.detalhes.map(d => `
            <div class="match-popover-item"><span>${escapeHtml(d.label)}</span><strong>+${d.pontos}</strong></div>
          `).join('')}
        </div>
        <div class="match-popover-total">Total: ${resultado.pontos} de ${resultado.maxPontos} pontos possíveis</div>
      </div>
    `;
    document.body.appendChild(pop);
    posicionarPopover(pop, botaoEl);

    const toggleBtn = pop.querySelector('.match-popover-toggle');
    const detalhesEl = pop.querySelector('.match-popover-detalhes');
    toggleBtn.addEventListener('click', () => {
      const vaiAbrir = detalhesEl.style.display === 'none';
      detalhesEl.style.display = vaiAbrir ? 'flex' : 'none';
      toggleBtn.classList.toggle('match-popover-toggle--aberto', vaiAbrir);
      posicionarPopover(pop, botaoEl);
    });

    const fechar = (e) => {
      if (pop.contains(e.target) || botaoEl.contains(e.target)) return;
      pop.remove();
      document.removeEventListener('click', fechar, true);
    };
    setTimeout(() => document.addEventListener('click', fechar, true), 0);
  }

  // ===== Esqueleto do modal =====
  function montarEsqueleto(aula) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="match-modal-overlay" style="z-index:10000;">
        <div class="modal-container" style="max-width:900px; width:92vw; max-height:88vh;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              <i class="fas fa-people-arrows text-orange-500 mr-2"></i>
              Match — ${escapeHtml(aula.codigoContratacao || 'Sem código')}${(aula.nome || aula.nomeCliente) ? ' - ' + escapeHtml(aula.nome || aula.nomeCliente) : ''}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600" id="match-modal-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body vertical-scroll-hidden" id="match-modal-body" style="overflow:auto; max-height:72vh;">
            <div class="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
              <span class="loading-spinner-large"></span> Calculando ranking de professores...
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary btn-compact" id="match-modal-fechar">Fechar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  // ===== Fluxo principal =====
  async function abrirModalMatch(aula) {
    if (_modalEl) { _modalEl.remove(); _modalEl = null; }

    const wrap = montarEsqueleto(aula);
    _modalEl = wrap;
    const overlay = wrap.querySelector('#match-modal-overlay');
    const body = wrap.querySelector('#match-modal-body');
    const rankingsPorGrupo = {};

    const closeModal = () => {
      document.removeEventListener('keydown', escHandler);
      document.querySelectorAll('.match-popover').forEach(p => p.remove());
      wrap.remove();
      if (_modalEl === wrap) _modalEl = null;
    };
    wrap.querySelector('#match-modal-close').addEventListener('click', closeModal);
    wrap.querySelector('#match-modal-fechar').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);

    body.addEventListener('click', (e) => {
      const btnMais = e.target.closest('.match-mostrar-mais-btn');
      if (btnMais) {
        e.stopPropagation();
        tratarCliqueMostrarMais(btnMais);
        return;
      }

      const btn = e.target.closest('.match-info-btn');
      if (!btn) return;
      e.stopPropagation();
      const grupoEl = btn.closest('.match-grupo');
      const grupoKey = grupoEl ? grupoEl.dataset.grupoKey : null;
      const idx = parseInt(btn.dataset.idx, 10);
      const ranking = rankingsPorGrupo[grupoKey];
      if (ranking && ranking[idx]) abrirPopoverJustificativa(btn, ranking[idx]);
    });

    try {
      const codigoContratacao = aula.codigoContratacao;
      const [aulasContrato, professores, todasAulasSistema, bairroInfo] = await Promise.all([
        BANCO.fetchBancoDeAulasLista(codigoContratacao),
        BANCO.fetchDataBaseProfessores(),
        BANCO.fetchBancoDeAulasListaBatch(),
        resolverBairroCliente(aula.cpf)
      ]);

      const professoresAtivos = (professores || []).filter(p => (p.status || 'Ativo') === 'Ativo');
      const grupos = montarGruposPorDisciplina(aulasContrato);
      const chaves = Object.keys(grupos);

      if (!chaves.length) {
        body.innerHTML = `<p class="text-sm text-gray-500 text-center py-8">Nenhuma aula com matéria definida encontrada nesta contratação.</p>`;
        return;
      }

      let html = '';
      chaves.forEach(key => {
        const grupo = grupos[key];
        const ranking = professoresAtivos
          .filter(p => professorLecionaMateria(p, key))
          .map(professor => pontuarProfessor(professor, grupo, bairroInfo, todasAulasSistema, codigoContratacao, aula.cpf))
          .sort((a, b) => b.pontos - a.pontos || (a.professor.nome || '').localeCompare(b.professor.nome || ''));

        rankingsPorGrupo[key] = ranking;
        html += `<div class="match-grupo mb-6" data-grupo-key="${escapeHtml(key)}">${renderGrupoConteudo(grupo, ranking)}</div>`;
      });

      body.innerHTML = html;
    } catch (e) {
      console.error('[Match] Erro ao montar ranking:', e);
      body.innerHTML = `<p class="text-red-600 text-sm text-center py-8">Erro ao calcular o ranking: ${escapeHtml(e.message)}</p>`;
    }
  }

  return { abrirModalMatch };
})();
