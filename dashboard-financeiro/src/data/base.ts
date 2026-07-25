// Base de informações — gerada a partir de CRM.xlsx (2022–2024),
// Planilha sem título.xlsx (2025) e DRE_2026_7meses.pdf (jan–jul/2026).
// Para 2022–2024 o lucro e a despesa com equipe mensais foram distribuídos
// proporcionalmente ao faturamento a partir dos totais anuais do CRM
// (2022 usa as margens de 2023, pois não há registro no CRM) — flag `estimado`.

export interface LinhaBase {
  ano: number;
  mes: number; // 1-12
  clientes: number; // contratações no mês
  faturamento: number; // R$
  lucro: number; // R$ (líquido)
  despesaEquipe: number; // R$ (repasse para professores/equipe)
  estimado: boolean; // lucro/despesa derivados de totais anuais
}

export const BASE: LinhaBase[] = [
  { ano: 2022, mes: 1, clientes: 1, faturamento: 560.0, lucro: 267.27, despesaEquipe: 292.73, estimado: true },
  { ano: 2022, mes: 2, clientes: 4, faturamento: 560.0, lucro: 267.27, despesaEquipe: 292.73, estimado: true },
  { ano: 2022, mes: 3, clientes: 13, faturamento: 2330.0, lucro: 1112.03, despesaEquipe: 1217.97, estimado: true },
  { ano: 2022, mes: 4, clientes: 23, faturamento: 5015.0, lucro: 2393.49, despesaEquipe: 2621.51, estimado: true },
  { ano: 2022, mes: 5, clientes: 20, faturamento: 4675.0, lucro: 2231.22, despesaEquipe: 2443.78, estimado: true },
  { ano: 2022, mes: 6, clientes: 14, faturamento: 2635.0, lucro: 1257.59, despesaEquipe: 1377.41, estimado: true },
  { ano: 2022, mes: 7, clientes: 16, faturamento: 2405.0, lucro: 1147.82, despesaEquipe: 1257.18, estimado: true },
  { ano: 2022, mes: 8, clientes: 16, faturamento: 3180.0, lucro: 1517.7, despesaEquipe: 1662.3, estimado: true },
  { ano: 2022, mes: 9, clientes: 14, faturamento: 3000.0, lucro: 1431.8, despesaEquipe: 1568.2, estimado: true },
  { ano: 2022, mes: 10, clientes: 24, faturamento: 3800.0, lucro: 1813.61, despesaEquipe: 1986.39, estimado: true },
  { ano: 2022, mes: 11, clientes: 15, faturamento: 2212.0, lucro: 1055.71, despesaEquipe: 1156.29, estimado: true },
  { ano: 2022, mes: 12, clientes: 12, faturamento: 1392.0, lucro: 664.35, despesaEquipe: 727.65, estimado: true },
  { ano: 2023, mes: 1, clientes: 2, faturamento: 490.0, lucro: 233.86, despesaEquipe: 256.14, estimado: true },
  { ano: 2023, mes: 2, clientes: 2, faturamento: 570.0, lucro: 272.04, despesaEquipe: 297.96, estimado: true },
  { ano: 2023, mes: 3, clientes: 13, faturamento: 4035.0, lucro: 1925.77, despesaEquipe: 2109.23, estimado: true },
  { ano: 2023, mes: 4, clientes: 11, faturamento: 2165.0, lucro: 1033.28, despesaEquipe: 1131.72, estimado: true },
  { ano: 2023, mes: 5, clientes: 15, faturamento: 3980.0, lucro: 1899.52, despesaEquipe: 2080.48, estimado: true },
  { ano: 2023, mes: 6, clientes: 17, faturamento: 4560.0, lucro: 2176.33, despesaEquipe: 2383.67, estimado: true },
  { ano: 2023, mes: 7, clientes: 3, faturamento: 1285.0, lucro: 613.29, despesaEquipe: 671.71, estimado: true },
  { ano: 2023, mes: 8, clientes: 16, faturamento: 5420.0, lucro: 2586.78, despesaEquipe: 2833.22, estimado: true },
  { ano: 2023, mes: 9, clientes: 17, faturamento: 5615.0, lucro: 2679.84, despesaEquipe: 2935.16, estimado: true },
  { ano: 2023, mes: 10, clientes: 13, faturamento: 3880.0, lucro: 1851.79, despesaEquipe: 2028.21, estimado: true },
  { ano: 2023, mes: 11, clientes: 13, faturamento: 4540.0, lucro: 2166.78, despesaEquipe: 2373.22, estimado: true },
  { ano: 2023, mes: 12, clientes: 9, faturamento: 3245.0, lucro: 1548.73, despesaEquipe: 1696.27, estimado: true },
  { ano: 2024, mes: 1, clientes: 1, faturamento: 470.0, lucro: 272.73, despesaEquipe: 197.27, estimado: true },
  { ano: 2024, mes: 2, clientes: 6, faturamento: 1475.0, lucro: 855.9, despesaEquipe: 619.1, estimado: true },
  { ano: 2024, mes: 3, clientes: 10, faturamento: 1855.0, lucro: 1076.4, despesaEquipe: 778.6, estimado: true },
  { ano: 2024, mes: 4, clientes: 8, faturamento: 2630.0, lucro: 1526.11, despesaEquipe: 1103.89, estimado: true },
  { ano: 2024, mes: 5, clientes: 24, faturamento: 4754.0, lucro: 2758.61, despesaEquipe: 1995.39, estimado: true },
  { ano: 2024, mes: 6, clientes: 15, faturamento: 3437.0, lucro: 1994.39, despesaEquipe: 1442.61, estimado: true },
  { ano: 2024, mes: 7, clientes: 15, faturamento: 4860.0, lucro: 2820.12, despesaEquipe: 2039.88, estimado: true },
  { ano: 2024, mes: 8, clientes: 13, faturamento: 8700.0, lucro: 5048.36, despesaEquipe: 3651.64, estimado: true },
  { ano: 2024, mes: 9, clientes: 19, faturamento: 7455.0, lucro: 4325.92, despesaEquipe: 3129.08, estimado: true },
  { ano: 2024, mes: 10, clientes: 18, faturamento: 8595.0, lucro: 4987.43, despesaEquipe: 3607.57, estimado: true },
  { ano: 2024, mes: 11, clientes: 11, faturamento: 6130.0, lucro: 3557.06, despesaEquipe: 2572.94, estimado: true },
  { ano: 2024, mes: 12, clientes: 4, faturamento: 890.0, lucro: 516.44, despesaEquipe: 373.56, estimado: true },
  { ano: 2025, mes: 1, clientes: 2, faturamento: 715.0, lucro: 355.0, despesaEquipe: 360.0, estimado: false },
  { ano: 2025, mes: 2, clientes: 9, faturamento: 2135.0, lucro: 1055.0, despesaEquipe: 1080.0, estimado: false },
  { ano: 2025, mes: 3, clientes: 12, faturamento: 3364.0, lucro: 1672.0, despesaEquipe: 1692.0, estimado: false },
  { ano: 2025, mes: 4, clientes: 9, faturamento: 3920.0, lucro: 1904.0, despesaEquipe: 2016.0, estimado: false },
  { ano: 2025, mes: 5, clientes: 19, faturamento: 4619.0, lucro: 2279.0, despesaEquipe: 2340.0, estimado: false },
  { ano: 2025, mes: 6, clientes: 12, faturamento: 4079.0, lucro: 2015.0, despesaEquipe: 2064.0, estimado: false },
  { ano: 2025, mes: 7, clientes: 21, faturamento: 8644.0, lucro: 4180.0, despesaEquipe: 4464.0, estimado: false },
  { ano: 2025, mes: 8, clientes: 16, faturamento: 7708.5, lucro: 3359.5, despesaEquipe: 4349.0, estimado: false },
  { ano: 2025, mes: 9, clientes: 22, faturamento: 10435.0, lucro: 4575.5, despesaEquipe: 5859.5, estimado: false },
  { ano: 2025, mes: 10, clientes: 24, faturamento: 8299.5, lucro: 3585.5, despesaEquipe: 4714.0, estimado: false },
  { ano: 2025, mes: 11, clientes: 12, faturamento: 4338.5, lucro: 2129.0, despesaEquipe: 2209.5, estimado: false },
  { ano: 2025, mes: 12, clientes: 3, faturamento: 1542.5, lucro: 537.0, despesaEquipe: 1005.5, estimado: false },
  { ano: 2026, mes: 1, clientes: 7, faturamento: 4535.0, lucro: 2587.0, despesaEquipe: 1160.0, estimado: false },
  { ano: 2026, mes: 2, clientes: 11, faturamento: 5112.1, lucro: 3172.14, despesaEquipe: 1342.5, estimado: false },
  { ano: 2026, mes: 3, clientes: 8, faturamento: 8077.0, lucro: 4257.0, despesaEquipe: 3820.0, estimado: false },
  { ano: 2026, mes: 4, clientes: 14, faturamento: 8761.0, lucro: 2863.5, despesaEquipe: 5897.5, estimado: false },
  { ano: 2026, mes: 5, clientes: 20, faturamento: 14334.76, lucro: 5090.78, despesaEquipe: 5123.52, estimado: false },
  { ano: 2026, mes: 6, clientes: 10, faturamento: 7065.0, lucro: 2294.52, despesaEquipe: 4445.0, estimado: false },
  { ano: 2026, mes: 7, clientes: 13, faturamento: 7158.5, lucro: 5102.5, despesaEquipe: 1390.0, estimado: false },
];

export const ULTIMO_MES_REAL = { ano: 2026, mes: 7 };
