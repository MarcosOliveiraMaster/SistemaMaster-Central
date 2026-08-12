/**
 * FERIADOS — nacionais, estaduais (Alagoas) e municipais (Maceió)
 *
 * Calcula a lista de feriados de um ano qualquer, incluindo os móveis derivados
 * da Páscoa. Usado pelo Calendário Master (calendario-busca.js).
 *
 * Escopo: apenas feriados de fato. Pontos facultativos (Carnaval, Quarta-feira de
 * Cinzas, Quinta-feira Santa, vésperas de Natal e Ano Novo) NÃO entram aqui,
 * porque não são feriados — se um dia forem necessários, entram como esfera
 * própria em PONTOS_FACULTATIVOS.
 *
 * Fontes das datas:
 * - Nacionais: Lei 662/1949, Lei 9.093/1995 e Lei 14.759/2023 (Consciência Negra).
 * - Estaduais AL: Leis 5.508/1993, 5.509/1993, 5.724/1995 e 7.530/2013,
 *   reafirmadas no Decreto estadual 106.093 de 29/12/2025 (calendário 2026).
 * - Municipais Maceió: Lei municipal 1.391/1967 (padroeira) e o calendário
 *   publicado pela Prefeitura de Maceió para 2026.
 */
const Feriados = (function () {
  'use strict';

  const NACIONAL = 'Nacional';
  const ESTADUAL = 'Estadual (AL)';
  const MUNICIPAL = 'Municipal (Maceió)';

  // mes é 0-11, como em Date.
  const NACIONAIS_FIXOS = [
    { mes: 0,  dia: 1,  nome: 'Confraternização Universal' },
    { mes: 3,  dia: 21, nome: 'Tiradentes' },
    { mes: 4,  dia: 1,  nome: 'Dia do Trabalho' },
    { mes: 8,  dia: 7,  nome: 'Independência do Brasil' },
    { mes: 9,  dia: 12, nome: 'Nossa Senhora Aparecida' },
    { mes: 10, dia: 2,  nome: 'Finados' },
    { mes: 10, dia: 15, nome: 'Proclamação da República' },
    { mes: 10, dia: 20, nome: 'Dia Nacional de Zumbi e da Consciência Negra' },
    { mes: 11, dia: 25, nome: 'Natal' }
  ];

  const ESTADUAIS_ALAGOAS = [
    { mes: 5,  dia: 24, nome: 'São João' },
    { mes: 5,  dia: 29, nome: 'São Pedro' },
    { mes: 8,  dia: 16, nome: 'Emancipação Política de Alagoas' },
    { mes: 10, dia: 30, nome: 'Dia Estadual do Evangélico' }
  ];

  const MUNICIPAIS_MACEIO = [
    // 29/06 acumula com São Pedro: a data cai no falecimento de Floriano Peixoto,
    // nascido em Maceió.
    { mes: 5,  dia: 29, nome: 'Marechal Floriano Peixoto' },
    { mes: 7,  dia: 27, nome: 'Nossa Senhora dos Prazeres — Padroeira de Maceió' },
    { mes: 11, dia: 8,  nome: 'Nossa Senhora da Conceição' }
  ];

  /**
   * Domingo de Páscoa pelo algoritmo gregoriano anônimo (Meeus/Jones/Butcher).
   * Confere com 2026: 05/04, o que põe a Sexta-feira Santa em 03/04 e o
   * Corpus Christi em 04/06 — as datas dos decretos publicados para o ano.
   */
  function calcularPascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }

  function somarDias(data, dias) {
    const d = new Date(data.getTime());
    d.setDate(d.getDate() + dias);
    return d;
  }

  /** Feriados móveis do ano, todos ancorados na Páscoa. */
  function moveis(ano) {
    const pascoa = calcularPascoa(ano);
    const sextaSanta = somarDias(pascoa, -2);
    const corpusChristi = somarDias(pascoa, 60);
    return [
      { mes: sextaSanta.getMonth(),     dia: sextaSanta.getDate(),     nome: 'Sexta-feira da Paixão',  esfera: NACIONAL },
      { mes: corpusChristi.getMonth(),  dia: corpusChristi.getDate(),  nome: 'Corpus Christi',         esfera: MUNICIPAL }
    ];
  }

  /**
   * Todos os feriados do ano, ordenados por data.
   * Cada item: { dia, mes, ano, nome, esfera, data }
   */
  function listar(ano) {
    const marcar = (lista, esfera) => lista.map(f => ({ ...f, esfera }));

    const todos = [
      ...marcar(NACIONAIS_FIXOS, NACIONAL),
      ...marcar(ESTADUAIS_ALAGOAS, ESTADUAL),
      ...marcar(MUNICIPAIS_MACEIO, MUNICIPAL),
      ...moveis(ano)
    ].map(f => ({ ...f, ano, data: new Date(ano, f.mes, f.dia) }));

    return todos.sort((a, b) => a.data - b.data);
  }

  /**
   * Feriados de um mês agrupados por dia: { 25: [ {...}, ... ] }.
   * Uma mesma data pode acumular mais de um feriado (ex.: 29/06 em Maceió).
   */
  function porDia(mes, ano) {
    const mapa = {};
    listar(ano).forEach(f => {
      if (f.mes !== mes) return;
      if (!mapa[f.dia]) mapa[f.dia] = [];
      mapa[f.dia].push(f);
    });
    return mapa;
  }

  /** Lista de feriados de uma data específica (vazia se não for feriado). */
  function doDia(dia, mes, ano) {
    return porDia(mes, ano)[dia] || [];
  }

  return {
    listar,
    porDia,
    doDia,
    calcularPascoa,
    NACIONAL,
    ESTADUAL,
    MUNICIPAL
  };
})();

if (typeof window !== 'undefined') window.Feriados = Feriados;
