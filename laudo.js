/* =================================================================
   Laudo de inspeção (PDF) — gerado na gestão, a partir de um checklist do Histórico.
   Abre uma página A4 pronta para imprimir ou "Salvar como PDF" no navegador.
   Usa: comum.js (S, itensDe, RESPOSTAS, detalheDe, nomeTipo, duplaDe, nomesDupla, ...) e api() para as fotos.
   ================================================================= */

const LAUDO_COR = { ok: '#0f7a52', nc: '#d6262f', na: '#9aa3af', pend: '#e8a317', vazio: '#e6e8ee', ink: '#15181d' };
const NORMAS = {
  Extintor: ['NR-23 — Proteção contra incêndios', 'ABNT NBR 12962 — Inspeção, manutenção e recarga em extintores de incêndio', 'ABNT NBR 12693 — Sistemas de proteção por extintores de incêndio'],
  Hidrante: ['NR-23 — Proteção contra incêndios', 'ABNT NBR 13714 — Sistemas de hidrantes e de mangotinhos para combate a incêndio', 'ABNT NBR 11861 — Mangueira de incêndio — Requisitos e métodos de ensaio'],
  Alarme: ['NR-23 — Proteção contra incêndios', 'ABNT NBR 17240 — Sistemas de detecção e alarme de incêndio'],
};
const NORMAS_GERAIS = ['ABNT NBR 14276 — Brigada de incêndio e emergência', 'Normas Técnicas do Corpo de Bombeiros Militar do Estado de Goiás (NT CBMGO)'];

const fmtDia = iso => new Date(iso).toLocaleDateString('pt-BR');
const fmtHora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDataBr = d => (d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—');
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

/* ---------- gráficos (SVG puro: imprimem nítidos em qualquer navegador) ---------- */
function svgRosca(partes, centro, rotulo, tam = 150) {
  const total = partes.reduce((s, p) => s + p.v, 0) || 1;
  let acc = 0;
  const arcos = partes.filter(p => p.v > 0).map(p => {
    const len = p.v / total * 100;
    const s = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${p.cor}" stroke-width="5.5" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${25 - acc}"/>`;
    acc += len; return s;
  }).join('');
  return `<svg viewBox="0 0 42 42" width="${tam}" height="${tam}" role="img"><circle cx="21" cy="21" r="15.915" fill="none" stroke="${LAUDO_COR.vazio}" stroke-width="5.5"/>${arcos}
    <text x="21" y="21.5" text-anchor="middle" font-size="7" font-weight="800" fill="${LAUDO_COR.ink}">${centro}</text>
    <text x="21" y="27" text-anchor="middle" font-size="2.6" fill="#6b7280">${rotulo}</text></svg>`;
}
/* Linha do tempo: 12 meses, um bloco por mês colorido pelo resultado */
function svgLinhaTempo(meses) {
  const w = 680, h = 92, bw = w / meses.length;
  const blocos = meses.map((m, i) => {
    const cor = m.st === 'ok' ? LAUDO_COR.ok : m.st === 'nc' ? LAUDO_COR.nc : LAUDO_COR.vazio;
    const txt = m.st === 'ok' ? '✔' : m.st === 'nc' ? '✖' : '—';
    return `<g transform="translate(${i * bw + 3},0)">
      <rect x="0" y="8" width="${bw - 6}" height="44" rx="6" fill="${cor}" ${m.atual ? `stroke="${LAUDO_COR.ink}" stroke-width="2.5"` : ''}/>
      <text x="${(bw - 6) / 2}" y="36" text-anchor="middle" font-size="16" font-weight="800" fill="${m.st ? '#fff' : '#9aa3af'}">${txt}</text>
      <text x="${(bw - 6) / 2}" y="70" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">${m.rotulo}</text>
      <text x="${(bw - 6) / 2}" y="85" text-anchor="middle" font-size="9" fill="#9aa3af">${m.ano}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${blocos}</svg>`;
}
/* Barras horizontais: quantas vezes cada item ficou "Não conforme" */
function svgBarras(linhas) {
  if (!linhas.length) return '';
  const w = 680, lh = 26, max = Math.max(...linhas.map(l => l.n)), h = linhas.length * lh + 4, rot = 250;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${linhas.map((l, i) => {
    const bw = Math.max(4, (w - rot - 60) * l.n / max);
    return `<text x="${rot - 10}" y="${i * lh + 17}" text-anchor="end" font-size="12" fill="#374151">${escL(l.item.length > 38 ? l.item.slice(0, 37) + '…' : l.item)}</text>
      <rect x="${rot}" y="${i * lh + 5}" width="${bw}" height="16" rx="4" fill="${LAUDO_COR.nc}"/>
      <text x="${rot + bw + 8}" y="${i * lh + 17}" font-size="12" font-weight="700" fill="#374151">${l.n}×</text>`;
  }).join('')}</svg>`;
}
const escL = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- análise automática ---------- */
function analiseTexto(ctx) {
  const { reg, eq, cont, nc, hist, mesesInspec, mesesTotal, recorrentes, extras } = ctx;
  const p = [];
  if (!ctx.temItens) p.push(`Na inspeção realizada em ${fmtDia(reg.DataHora)}, às ${fmtHora(reg.DataHora)}, o equipamento <b>${escL(eq.Codigo)}</b> foi registrado como <b>${reg.Resultado === 'OK' ? 'conforme' : 'não conforme'}</b>. O detalhamento item a item não foi registrado nesta inspeção.`);
  else p.push(`Na inspeção realizada em ${fmtDia(reg.DataHora)}, às ${fmtHora(reg.DataHora)}, o equipamento <b>${escL(eq.Codigo)}</b> (${escL(nomeTipo(eq))}), localizado em <b>${escL(ondeFica(eq))}</b>, foi verificado em ${cont.total} item(ns), resultando em <b>${cont.ok} conforme(s)</b>, <b>${cont.nc} não conforme(s)</b> e ${cont.na} não aplicável(is), com índice de conformidade de <b>${cont.indice}%</b> sobre os itens aplicáveis.`);
  if (nc.length) {
    p.push(`Foram identificadas as seguintes não conformidades: ${nc.map(x => `<b>${escL(x.item)}</b>${x.obs ? ` (${escL(x.obs)})` : ''}`).join('; ')}. O equipamento deve ser considerado <b>com restrição</b> até a correção e a realização de nova inspeção que comprove a regularização.`);
  } else {
    p.push(`Não foram identificadas não conformidades. O equipamento encontra-se <b>em condições de uso</b> na data da inspeção.`);
  }
  if (extras.proximoTeste) {
    const dias = Math.round((new Date(extras.proximoTeste + 'T12:00') - new Date()) / 86400000);
    p.push(dias < 0 ? `<b>Atenção:</b> a data do próximo teste informada (${fmtDataBr(extras.proximoTeste)}) está vencida há ${-dias} dia(s).`
      : dias <= 60 ? `<b>Atenção:</b> o próximo teste está previsto para ${fmtDataBr(extras.proximoTeste)} (em ${dias} dia(s)); providenciar o agendamento.`
      : `O próximo teste está previsto para ${fmtDataBr(extras.proximoTeste)}.`);
  }
  const conf = hist.filter(h => h.Resultado === 'OK').length;
  p.push(`No período analisado (últimos ${mesesTotal} meses), o equipamento recebeu <b>${hist.length} inspeção(ões)</b>, das quais ${conf} conforme(s) (${pct(conf, hist.length)}%). A rotina mensal foi cumprida em <b>${mesesInspec} de ${mesesTotal} meses</b> (${pct(mesesInspec, mesesTotal)}%)${mesesInspec < mesesTotal ? '; recomenda-se manter a periodicidade mensal de inspeção' : ''}.`);
  if (recorrentes.length) p.push(`Itens com <b>reincidência</b> de não conformidade no período: ${recorrentes.map(r => `${escL(r.item)} (${r.n}×)`).join(', ')}. Recomenda-se investigar a causa e adotar ação corretiva definitiva.`);
  return p.map(x => `<p>${x}</p>`).join('');
}

/* ---------- laudo ---------- */
async function gerarLaudo(reg) {
  const janela = window.open('', '_blank');
  if (!janela) return toast('Permita pop-ups para gerar o laudo');
  janela.document.write('<p style="font:16px sans-serif;padding:40px">Gerando laudo…</p>');

  const eq = eqPorCodigo(reg.Codigo) || { Codigo: reg.Codigo, Categoria: reg.Categoria, Tipo: reg.Tipo, Local: reg.Local, Grupo: '', Descricao: '' };
  const det = detalheDe(reg);
  const respostas = det.itens || {}, obsItens = det.obsItens || {}, extras = det.extras || {};
  const temItens = Object.keys(respostas).length > 0;
  const itens = temItens ? Object.keys(respostas) : itensDe(eq);
  const cont = { ok: 0, nc: 0, na: 0, total: itens.length };
  itens.forEach(t => { const v = respostas[t]; if (cont[v] !== undefined) cont[v]++; });
  cont.indice = pct(cont.ok, cont.ok + cont.nc);
  const nc = itens.filter(t => respostas[t] === 'nc').map(t => ({ item: t, obs: obsItens[t] || '' }));

  // fotos desta inspeção
  let fotos = [];
  if (Object.keys(det.fotos || {}).length) {
    try {
      fotos = DEMO ? (lsGet(LS.demo, {}).fotos || []).filter(f => f.registro_id === reg.Id)
        : (await api({ acao: 'fotos', pin: pinGestao(), registro: reg.Id })).fotos;
    } catch (e) { fotos = []; }
  }

  // histórico (dados carregados: últimos 13 meses) e linha do tempo de 12 meses
  const hist = S.registros.filter(r => r.Codigo === reg.Codigo).sort((a, b) => b.DataHora.localeCompare(a.DataHora));
  const mesRef = mesReg(reg);
  const meses = Array.from({ length: 12 }, (_, k) => mesAnterior(mesRef, 11 - k)).map(m => {
    const doMes = hist.filter(r => mesReg(r) === m).sort((a, b) => b.DataHora.localeCompare(a.DataHora));
    const [ano, n] = m.split('-');
    return { m, rotulo: MESES[+n - 1].slice(0, 3), ano, atual: m === mesRef, st: doMes.length ? (doMes[0].Resultado === 'OK' ? 'ok' : 'nc') : '' };
  });
  const mesesInspec = meses.filter(m => m.st).length;
  const freq = {};
  hist.forEach(r => { const d = detalheDe(r); Object.entries(d.itens || {}).forEach(([t, v]) => { if (v === 'nc') freq[t] = (freq[t] || 0) + 1; }); });
  const ranking = Object.entries(freq).map(([item, n]) => ({ item, n })).sort((a, b) => b.n - a.n);
  const recorrentes = ranking.filter(r => r.n > 1);

  const dupla = reg.Dupla || duplaDe(eq);
  const resultadoOk = reg.Resultado === 'OK';
  const numero = `LI-${mesRef.replace('-', '')}-${String(reg.Id).toUpperCase()}`;
  const base = new URL('./', location.href).href;
  const emitidoEm = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const normas = (NORMAS[eq.Categoria] || ['NR-23 — Proteção contra incêndios']).concat(NORMAS_GERAIS);
  const camposExtras = camposExtrasDe(eq).filter(c => extras[c.id]);

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Laudo ${numero} — ${escL(eq.Codigo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 13mm 16mm;
    @bottom-left { content: "Laudo ${numero} · Brigada de Emergência · Dois Marcos Sementes"; font: 7.5pt Inter, sans-serif; color: #6b7280; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Inter, sans-serif; color: #6b7280; } }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10pt/1.45 Inter, system-ui, sans-serif; color: #1f2430; background: #e9ebef; }
  .folha { width: 210mm; min-height: 297mm; margin: 12px auto; background: #fff; padding: 14mm 13mm; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .barra-acoes { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; justify-content: center; padding: 10px; background: #15181d; }
  .barra-acoes button { font: 600 14px Inter, sans-serif; padding: 10px 18px; border-radius: 8px; border: 0; cursor: pointer; background: #d6262f; color: #fff; }
  .barra-acoes button.sec { background: #2a2f38; }
  header.cab { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 3px solid #d6262f; }
  header.cab img { width: 64px; height: 64px; object-fit: contain; }
  header.cab .t { flex: 1; }
  header.cab .t small { display: block; color: #6b7280; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
  header.cab h1 { margin: 2px 0 0; font-size: 15pt; line-height: 1.2; font-weight: 800; }
  header.cab .num { text-align: right; font-size: 8.5pt; color: #374151; }
  header.cab .num b { display: block; font-size: 11pt; color: #15181d; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .06em; margin: 18px 0 8px; padding: 5px 9px; background: #15181d; color: #fff; border-left: 5px solid #d6262f; border-radius: 3px; }
  .grade { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #dfe3e8; border-radius: 6px; overflow: hidden; }
  .grade div { padding: 6px 9px; border-right: 1px solid #dfe3e8; border-bottom: 1px solid #dfe3e8; }
  .grade div span { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; font-weight: 600; }
  .grade div b { font-weight: 600; }
  .g2 { grid-column: span 2; } .g4 { grid-column: span 4; }
  .resumo { display: flex; gap: 16px; align-items: center; border: 1px solid #dfe3e8; border-radius: 8px; padding: 12px; }
  .selo { flex: 0 0 auto; text-align: center; padding: 12px 16px; border-radius: 8px; color: #fff; min-width: 150px; }
  .selo b { display: block; font-size: 14pt; font-weight: 800; letter-spacing: .03em; }
  .selo small { font-size: 8pt; opacity: .9; }
  .indicadores { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ind { border: 1px solid #e6e8ee; border-radius: 6px; padding: 8px; text-align: center; }
  .ind b { display: block; font-size: 16pt; font-weight: 800; line-height: 1.1; }
  .ind span { font-size: 8pt; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #f3f4f6; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #4b5563; padding: 6px 7px; border-bottom: 2px solid #d1d5db; }
  td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr { break-inside: avoid; }
  .st { display: inline-block; font-weight: 700; font-size: 8pt; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
  .st.ok { background: #e4f4ec; color: #0f7a52; } .st.nc { background: #fdecec; color: #d6262f; } .st.na { background: #f1f2f4; color: #6b7280; }
  .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .fotos figure { margin: 0; border: 1px solid #dfe3e8; border-radius: 6px; overflow: hidden; break-inside: avoid; }
  .fotos img { width: 100%; height: 150px; object-fit: cover; display: block; }
  .fotos figcaption { font-size: 8pt; padding: 5px 7px; color: #374151; }
  .legenda { display: flex; gap: 14px; font-size: 8pt; color: #4b5563; margin-top: 4px; }
  .legenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; }
  .analise p { margin: 0 0 7px; text-align: justify; }
  .bloco { break-inside: avoid; }
  .normas { margin: 0; padding-left: 16px; font-size: 8.5pt; color: #374151; }
  .assin { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 40px; break-inside: avoid; }
  .assin div { border-top: 1px solid #374151; padding-top: 5px; text-align: center; font-size: 8.5pt; }
  .assin small { display: block; color: #6b7280; }
  .verif { margin-top: 14px; padding: 8px 10px; background: #f8f9fb; border: 1px dashed #c8cdd5; border-radius: 6px; font-size: 8pt; color: #4b5563; }
  .muted { color: #6b7280; }
  @media print { body { background: #fff; } .folha { margin: 0; width: auto; min-height: 0; padding: 0; box-shadow: none; } .barra-acoes { display: none; } }
</style></head><body>
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button><button class="sec" onclick="window.close()">Fechar</button></div>
<div class="folha">
  <header class="cab">
    <img src="${base}brigada.png" alt="">
    <div class="t"><small>Dois Marcos Sementes · Brigada de Emergência</small><h1>Laudo de Inspeção de Equipamento de Combate a Incêndio</h1></div>
    <div class="num">Laudo nº<b>${numero}</b>Emitido em ${emitidoEm}</div>
  </header>

  <h2>1. Identificação do equipamento</h2>
  <div class="grade">
    <div><span>Código</span><b>${escL(eq.Codigo)}</b></div>
    <div><span>Categoria</span><b>${escL(eq.Categoria)}</b></div>
    <div class="g2"><span>Tipo</span><b>${escL(eq.Tipo)}</b></div>
    <div class="g2"><span>Setor / localização</span><b>${escL(eq.Local)}</b></div>
    <div class="g2"><span>${eq.Descricao ? 'Descrição do local' : 'Grupo'}</span><b>${escL(eq.Descricao || eq.Grupo || '—')}</b></div>
    ${eq.Descricao && eq.Grupo ? `<div class="g2"><span>Grupo</span><b>${escL(eq.Grupo)}</b></div>` : ''}
    <div class="${eq.Descricao && eq.Grupo ? 'g2' : 'g4'}"><span>Dupla responsável</span><b>${dupla ? 'Dupla ' + escL(dupla) + ' — ' + escL(membrosDupla(dupla).map(b => b.Nome).join(' / ') || '—') : 'Sem dupla definida'}</b></div>
    ${camposExtras.map(c => `<div class="g2"><span>${escL(c.rotulo)}</span><b>${fmtDataBr(extras[c.id])}</b></div>`).join('')}
  </div>

  <h2>2. Dados da inspeção</h2>
  <div class="grade">
    <div><span>Data</span><b>${fmtDia(reg.DataHora)}</b></div>
    <div><span>Hora</span><b>${fmtHora(reg.DataHora)}</b></div>
    <div class="g2"><span>Inspecionado por</span><b>${escL(reg.Brigadista)}</b></div>
    <div class="g2"><span>Método de verificação</span><b>Leitura do QR Code no local${det.lidoEm ? ' às ' + fmtHora(det.lidoEm) : ''}</b></div>
    <div class="g2"><span>Referência</span><b>Inspeção mensal — ${nomeMes(mesRef)}</b></div>
  </div>

  <h2>3. Resultado</h2>
  <div class="resumo bloco">
    <div class="selo" style="background:${resultadoOk ? LAUDO_COR.ok : LAUDO_COR.nc}"><small>RESULTADO DA INSPEÇÃO</small><b>${resultadoOk ? 'CONFORME' : 'NÃO CONFORME'}</b><small>${resultadoOk ? 'Equipamento em condições de uso' : 'Equipamento com restrição'}</small></div>
    ${temItens ? `${svgRosca([{ v: cont.ok, cor: LAUDO_COR.ok }, { v: cont.nc, cor: LAUDO_COR.nc }, { v: cont.na, cor: LAUDO_COR.na }], cont.indice + '%', 'conformidade', 120)}
    <div class="indicadores">
      <div class="ind"><b style="color:${LAUDO_COR.ok}">${cont.ok}</b><span>Conformes</span></div>
      <div class="ind"><b style="color:${LAUDO_COR.nc}">${cont.nc}</b><span>Não conformes</span></div>
      <div class="ind"><b style="color:#6b7280">${cont.na}</b><span>Não aplicáveis</span></div>
    </div>` : `<p class="muted" style="margin:0">Detalhamento por item não registrado nesta inspeção.</p>`}
  </div>

  <h2>4. Checklist de verificação</h2>
  ${temItens ? `<table><thead><tr><th style="width:34px">Nº</th><th>Item verificado</th><th style="width:110px">Situação</th><th>Observação</th></tr></thead><tbody>
    ${itens.map((t, n) => { const v = respostas[t]; return `<tr><td>${String(n + 1).padStart(2, '0')}</td><td>${escL(t)}</td>
      <td><span class="st ${v || 'na'}">${escL(RESPOSTAS[v] || '—')}</span></td><td>${escL(obsItens[t] || '')}</td></tr>`; }).join('')}
  </tbody></table>` : `<p class="muted">Itens não registrados (inspeção anterior à versão atual do checklist). Resultado geral: <b>${resultadoOk ? 'Conforme' : 'Não conforme'}</b>${reg.ItensNC ? ' — ' + escL(reg.ItensNC) : ''}.</p>`}
  ${reg.Observacao ? `<p style="margin:8px 0 0"><b>Observações / ações necessárias:</b> ${escL(reg.Observacao)}</p>` : ''}

  ${fotos.length ? `<h2>5. Registro fotográfico</h2>
  <div class="fotos">${fotos.map((f, n) => `<figure><img src="${f.imagem}" alt=""><figcaption><b>Foto ${n + 1}</b> — ${escL(f.item)}</figcaption></figure>`).join('')}</div>` : ''}

  <h2>${fotos.length ? 6 : 5}. Histórico do equipamento — últimos 12 meses</h2>
  <div class="bloco">${svgLinhaTempo(meses)}
    <div class="legenda"><span><i style="background:${LAUDO_COR.ok}"></i>Conforme</span><span><i style="background:${LAUDO_COR.nc}"></i>Não conforme</span><span><i style="background:${LAUDO_COR.vazio}"></i>Sem inspeção</span><span><i style="background:#fff;border:2px solid ${LAUDO_COR.ink}"></i>Mês deste laudo</span></div>
  </div>
  <table style="margin-top:10px"><thead><tr><th>Data</th><th>Inspecionado por</th><th>Resultado</th><th>Não conformidades</th></tr></thead><tbody>
    ${hist.map(h => `<tr${h.Id === reg.Id ? ' style="background:#fff8e6"' : ''}><td>${fmtDia(h.DataHora)} ${fmtHora(h.DataHora)}</td><td>${escL(h.Brigadista)}</td>
      <td><span class="st ${h.Resultado === 'OK' ? 'ok' : 'nc'}">${h.Resultado === 'OK' ? 'Conforme' : 'Não conforme'}</span></td><td>${escL(h.ItensNC || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem outras inspeções no período.</td></tr>'}
  </tbody></table>

  ${ranking.length ? `<div class="bloco"><h2>${fotos.length ? 7 : 6}. Recorrência de não conformidades por item</h2>${svgBarras(ranking.slice(0, 10))}</div>` : ''}

  <div class="bloco"><h2>${fotos.length ? (ranking.length ? 8 : 7) : (ranking.length ? 7 : 6)}. Análise e conclusão</h2>
    <div class="analise">${analiseTexto({ reg, eq, cont, nc, hist, mesesInspec, mesesTotal: 12, recorrentes, extras, temItens })}</div></div>

  <div class="bloco"><h2>Referências normativas</h2><ul class="normas">${normas.map(n => `<li>${escL(n)}</li>`).join('')}</ul></div>

  <div class="assin">
    <div><b>${escL(reg.Brigadista)}</b><small>Brigadista responsável pela inspeção</small></div>
    <div><b>&nbsp;</b><small>Coordenação da Brigada de Emergência</small></div>
    <div><b>&nbsp;</b><small>Segurança do Trabalho (SESTR)</small></div>
  </div>
  <div class="verif">Registro eletrônico nº ${escL(reg.Id)} · inspeção validada pela leitura do código exclusivo (QR Code) afixado no equipamento · gerado pelo sistema Checklist Brigada em ${emitidoEm}.</div>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 600));<\/script>
</body></html>`;
  janela.document.open(); janela.document.write(html); janela.document.close();
}
