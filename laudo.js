/* =================================================================
   Laudo de inspeção (PDF) — gerado na gestão, a partir de um checklist do Histórico.
   Abre uma página A4 pronta para imprimir ou "Salvar como PDF" no navegador.
   Layout compacto: 1 página (sem não conformidades) a 2 páginas (com fotos e histórico longo).
   Usa: comum.js (S, itensDe, RESPOSTAS, detalheDe, nomeTipo, duplaDe, membrosDupla, ...) e api() para as fotos.
   ================================================================= */

const LAUDO_COR = { ok: '#0f7a52', nc: '#d6262f', na: '#9aa3af', vazio: '#e6e8ee', ink: '#15181d' };
const NORMAS = {
  Extintor: ['NR-23', 'ABNT NBR 12962 (inspeção, manutenção e recarga de extintores)', 'ABNT NBR 12693 (sistemas de proteção por extintores)'],
  Hidrante: ['NR-23', 'ABNT NBR 13714 (sistemas de hidrantes e mangotinhos)', 'ABNT NBR 11861 (mangueiras de incêndio)'],
  Alarme: ['NR-23', 'ABNT NBR 17240 (sistemas de detecção e alarme de incêndio)'],
};
const NORMAS_GERAIS = ['ABNT NBR 14276 (brigada de incêndio)', 'Normas Técnicas do CBMGO'];

const fmtDia = iso => new Date(iso).toLocaleDateString('pt-BR');
const fmtHora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDataBr = d => (d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—');
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const escL = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- gráficos (SVG: imprimem nítidos) ---------- */
function svgRosca(partes, centro, rotulo, tam) {
  const total = partes.reduce((s, p) => s + p.v, 0) || 1;
  let acc = 0;
  const arcos = partes.filter(p => p.v > 0).map(p => {
    const len = p.v / total * 100;
    const s = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${p.cor}" stroke-width="6" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${25 - acc}"/>`;
    acc += len; return s;
  }).join('');
  return `<svg viewBox="0 0 42 42" width="${tam}" height="${tam}" role="img"><circle cx="21" cy="21" r="15.915" fill="none" stroke="${LAUDO_COR.vazio}" stroke-width="6"/>${arcos}
    <text x="21" y="22" text-anchor="middle" font-size="8" font-weight="800" fill="${LAUDO_COR.ink}">${centro}</text>
    <text x="21" y="28" text-anchor="middle" font-size="3.4" fill="#6b7280">${rotulo}</text></svg>`;
}
/* Linha do tempo de 12 meses: um bloco por mês colorido pelo resultado */
function svgLinhaTempo(meses) {
  const w = 360, bw = w / meses.length;
  return `<svg viewBox="0 0 ${w} 52" width="100%" role="img">${meses.map((m, i) => {
    const cor = m.st === 'ok' ? LAUDO_COR.ok : m.st === 'nc' ? LAUDO_COR.nc : LAUDO_COR.vazio;
    const txt = m.st === 'ok' ? '✔' : m.st === 'nc' ? '✖' : '–';
    const x = i * bw + 1.5, cw = bw - 3;
    return `<rect x="${x}" y="2" width="${cw}" height="26" rx="4" fill="${cor}" ${m.atual ? `stroke="${LAUDO_COR.ink}" stroke-width="2"` : ''}/>
      <text x="${x + cw / 2}" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="${m.st ? '#fff' : '#9aa3af'}">${txt}</text>
      <text x="${x + cw / 2}" y="39" text-anchor="middle" font-size="8" font-weight="600" fill="#374151">${m.rotulo}</text>
      <text x="${x + cw / 2}" y="49" text-anchor="middle" font-size="6.5" fill="#9aa3af">${m.ano.slice(2)}</text>`;
  }).join('')}</svg>`;
}
/* Barras: quantas vezes cada item ficou "Não conforme" */
function svgBarras(linhas) {
  const w = 360, lh = 17, max = Math.max(...linhas.map(l => l.n)), rot = 140;
  return `<svg viewBox="0 0 ${w} ${linhas.length * lh + 2}" width="100%" role="img">${linhas.map((l, i) => {
    const bw = Math.max(3, (w - rot - 30) * l.n / max);
    return `<text x="${rot - 6}" y="${i * lh + 12}" text-anchor="end" font-size="8.5" fill="#374151">${escL(l.item.length > 30 ? l.item.slice(0, 29) + '…' : l.item)}</text>
      <rect x="${rot}" y="${i * lh + 3}" width="${bw}" height="11" rx="3" fill="${LAUDO_COR.nc}"/>
      <text x="${rot + bw + 5}" y="${i * lh + 12}" font-size="8.5" font-weight="700" fill="#374151">${l.n}×</text>`;
  }).join('')}</svg>`;
}

/* ---------- análise automática ---------- */
function analiseTexto(ctx) {
  const { reg, eq, cont, nc, hist, mesesInspec, recorrentes, extras, temItens } = ctx;
  const p = [];
  p.push(temItens
    ? `Em ${fmtDia(reg.DataHora)}, às ${fmtHora(reg.DataHora)}, o equipamento <b>${escL(eq.Codigo)}</b> (${escL(nomeTipo(eq))}) foi verificado em ${cont.total} itens: <b>${cont.ok} conformes</b>, <b>${cont.nc} não conformes</b> e ${cont.na} não aplicáveis, com índice de conformidade de <b>${cont.indice}%</b>.`
    : `Em ${fmtDia(reg.DataHora)}, às ${fmtHora(reg.DataHora)}, o equipamento <b>${escL(eq.Codigo)}</b> foi registrado como <b>${reg.Resultado === 'OK' ? 'conforme' : 'não conforme'}</b> (detalhamento por item não registrado).`);
  p.push(nc.length
    ? `Não conformidades: ${nc.map(x => `<b>${escL(x.item)}</b>${x.obs ? ` (${escL(x.obs)})` : ''}`).join('; ')}. O equipamento deve ser considerado <b>com restrição</b> até a correção e nova inspeção que comprove a regularização.`
    : `Sem não conformidades: o equipamento encontra-se <b>em condições de uso</b> na data da inspeção.`);
  if (extras.proximoTeste) {
    const dias = Math.round((new Date(extras.proximoTeste + 'T12:00') - new Date()) / 86400000);
    p.push(dias < 0 ? `<b>Atenção:</b> próximo teste (${fmtDataBr(extras.proximoTeste)}) vencido há ${-dias} dia(s).`
      : dias <= 60 ? `<b>Atenção:</b> próximo teste em ${fmtDataBr(extras.proximoTeste)} (${dias} dia(s)); providenciar o agendamento.`
      : `Próximo teste previsto para ${fmtDataBr(extras.proximoTeste)}.`);
  }
  const conf = hist.filter(h => h.Resultado === 'OK').length;
  p.push(`Nos últimos 12 meses: <b>${hist.length} inspeção(ões)</b>, ${conf} conforme(s) (${pct(conf, hist.length)}%); rotina mensal cumprida em <b>${mesesInspec} de 12 meses</b>${mesesInspec < 12 ? ' — manter a periodicidade mensal' : ''}.`);
  if (recorrentes.length) p.push(`<b>Reincidência:</b> ${recorrentes.map(r => `${escL(r.item)} (${r.n}×)`).join(', ')}. Investigar a causa e adotar ação corretiva definitiva.`);
  return p.join(' ');
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

  let fotos = [];
  if (Object.keys(det.fotos || {}).length) {
    try {
      fotos = DEMO ? (lsGet(LS.demo, {}).fotos || []).filter(f => f.registro_id === reg.Id)
        : (await api({ acao: 'fotos', pin: pinGestao(), registro: reg.Id })).fotos;
    } catch (e) { fotos = []; }
  }

  const hist = S.registros.filter(r => r.Codigo === reg.Codigo).sort((a, b) => b.DataHora.localeCompare(a.DataHora));
  const mesRef = mesReg(reg);
  const meses = Array.from({ length: 12 }, (_, k) => mesAnterior(mesRef, 11 - k)).map(m => {
    const doMes = hist.filter(r => mesReg(r) === m).sort((a, b) => b.DataHora.localeCompare(a.DataHora));
    const [ano, n] = m.split('-');
    return { rotulo: MESES[+n - 1].slice(0, 3), ano, atual: m === mesRef, st: doMes.length ? (doMes[0].Resultado === 'OK' ? 'ok' : 'nc') : '' };
  });
  const mesesInspec = meses.filter(m => m.st).length;
  const freq = {};
  hist.forEach(r => Object.entries(detalheDe(r).itens || {}).forEach(([t, v]) => { if (v === 'nc') freq[t] = (freq[t] || 0) + 1; }));
  const ranking = Object.entries(freq).map(([item, n]) => ({ item, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  const recorrentes = ranking.filter(r => r.n > 1);
  const confHist = hist.filter(h => h.Resultado === 'OK').length;

  const dupla = reg.Dupla || duplaDe(eq);
  const ok = reg.Resultado === 'OK';
  const numero = `LI-${mesRef.replace('-', '')}-${String(reg.Id).toUpperCase()}`;
  const base = new URL('./', location.href).href;
  const emitidoEm = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const normas = (NORMAS[eq.Categoria] || ['NR-23']).concat(NORMAS_GERAIS);
  const camposExtras = camposExtrasDe(eq).filter(c => extras[c.id]);
  const metade = Math.ceil(itens.length / 2);
  const linhaItem = (t, n) => { const v = respostas[t];
    return `<tr><td class="n">${String(n + 1).padStart(2, '0')}</td><td>${escL(t)}${obsItens[t] ? `<div class="obs">${escL(obsItens[t])}</div>` : ''}</td>
      <td class="s"><span class="st ${v || 'na'}">${escL(RESPOSTAS[v] || '—')}</span></td></tr>`; };
  const tabelaItens = lista => `<table class="itens"><tbody>${lista.map(([t, n]) => linhaItem(t, n)).join('')}</tbody></table>`;
  const histMostrar = hist.slice(0, fotos.length ? 6 : 8); // com fotos, menos linhas: o laudo segue em 1 página

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Laudo ${numero} — ${escL(eq.Codigo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 9mm 10mm 11mm;
    @bottom-left { content: "Laudo ${numero} · Brigada de Emergência · Dois Marcos Sementes"; font: 6.5pt Inter, sans-serif; color: #6b7280; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 6.5pt Inter, sans-serif; color: #6b7280; } }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 8.5pt/1.35 Inter, system-ui, sans-serif; color: #1f2430; background: #e9ebef; }
  .folha { width: 210mm; margin: 10px auto; background: #fff; padding: 9mm 10mm; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .barra-acoes { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; justify-content: center; padding: 8px; background: #15181d; }
  .barra-acoes button { font: 600 13px Inter, sans-serif; padding: 8px 16px; border-radius: 8px; border: 0; cursor: pointer; background: #d6262f; color: #fff; }
  .barra-acoes button.sec { background: #2a2f38; }
  header { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; border-bottom: 2.5px solid #d6262f; }
  header img { width: 42px; height: 42px; object-fit: contain; }
  header .t { flex: 1; }
  header small { display: block; color: #6b7280; font-size: 6.5pt; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
  header h1 { margin: 1px 0 0; font-size: 12pt; line-height: 1.15; font-weight: 800; }
  header .num { text-align: right; font-size: 7pt; color: #4b5563; }
  header .num b { display: block; font-size: 9.5pt; color: #15181d; }
  h2 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em; margin: 6px 0 3px; padding: 2.5px 7px; background: #15181d; color: #fff; border-left: 4px solid #d6262f; border-radius: 2px; }
  .info { display: grid; grid-template-columns: repeat(6, 1fr); border: 1px solid #e1e4e9; border-radius: 5px; overflow: hidden; margin-top: 7px; }
  .info div { padding: 3px 6px; border-right: 1px solid #e1e4e9; border-bottom: 1px solid #e1e4e9; min-width: 0; }
  .info span { display: block; font-size: 6pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; font-weight: 600; }
  .info b { font-weight: 600; }
  .c2 { grid-column: span 2; } .c3 { grid-column: span 3; } .c4 { grid-column: span 4; } .c6 { grid-column: span 6; }
  .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .resultado { display: flex; align-items: center; gap: 8px; border: 1px solid #e1e4e9; border-radius: 6px; padding: 6px; }
  .selo { text-align: center; padding: 6px 8px; border-radius: 5px; color: #fff; width: 104px; flex: none; }
  .selo b { display: block; font-size: 10.5pt; font-weight: 800; line-height: 1.15; }
  .selo small { font-size: 6pt; opacity: .9; display: block; }
  .cont { display: grid; gap: 3px; font-size: 8pt; }
  .cont b { display: inline-block; min-width: 18px; font-size: 10pt; font-weight: 800; }
  .hist-box { border: 1px solid #e1e4e9; border-radius: 6px; padding: 5px 6px 3px; }
  .kpis { display: flex; gap: 8px; font-size: 7pt; color: #4b5563; margin-top: 2px; }
  .kpis b { color: #15181d; font-size: 8.5pt; }
  .legenda { display: flex; gap: 9px; font-size: 6.5pt; color: #6b7280; }
  .legenda i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; vertical-align: -1px; margin-right: 3px; }
  table { width: 100%; border-collapse: collapse; }
  .itens td { padding: 1.4px 4px; border-bottom: 1px solid #eceef1; vertical-align: top; }
  .itens td.n { width: 18px; color: #9aa3af; font-variant-numeric: tabular-nums; }
  .itens td.s { width: 74px; text-align: right; }
  .obs { font-size: 7pt; color: #d6262f; font-style: italic; }
  .st { display: inline-block; font-weight: 700; font-size: 6.8pt; padding: 1px 6px; border-radius: 99px; white-space: nowrap; }
  .st.ok { background: #e4f4ec; color: #0f7a52; } .st.nc { background: #fdecec; color: #d6262f; } .st.na { background: #f1f2f4; color: #6b7280; }
  .hist td, .hist th { padding: 1.5px 5px; border-bottom: 1px solid #eceef1; text-align: left; vertical-align: top; }
  .hist th { font-size: 6pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 1.5px solid #d1d5db; }
  .hist .atual td { background: #fff8e6; }
  .hist td:first-child, .hist td:nth-child(3) { white-space: nowrap; }
  .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .fotos figure { margin: 0; border: 1px solid #e1e4e9; border-radius: 4px; overflow: hidden; break-inside: avoid; }
  .fotos img { width: 100%; height: 78px; object-fit: cover; display: block; }
  .fotos figcaption { font-size: 6.5pt; padding: 2px 4px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .analise { margin: 0; text-align: justify; line-height: 1.3; }
  .rodape { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 12px; align-items: end; margin-top: 16px; break-inside: avoid; }
  .rodape .normas { font-size: 6.5pt; color: #4b5563; }
  .rodape .ass { border-top: 1px solid #374151; padding-top: 3px; text-align: center; font-size: 7pt; }
  .rodape .ass small { display: block; color: #6b7280; font-size: 6.3pt; }
  .verif { margin-top: 6px; font-size: 6.3pt; color: #6b7280; }
  .bloco { break-inside: avoid; }
  .muted { color: #6b7280; }
  @media print { body { background: #fff; } .folha { margin: 0; width: auto; padding: 0; box-shadow: none; } .barra-acoes { display: none; } }
</style></head><body>
<div class="barra-acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button><button class="sec" onclick="window.close()">Fechar</button></div>
<div class="folha">
  <header>
    <img src="${base}brigada.png" alt="">
    <div class="t"><small>Dois Marcos Sementes · Brigada de Emergência</small><h1>Laudo de Inspeção de Equipamento de Combate a Incêndio</h1></div>
    <div class="num">Laudo nº<b>${numero}</b>Emitido em ${emitidoEm}</div>
  </header>

  <div class="info">
    <div><span>Código</span><b>${escL(eq.Codigo)}</b></div>
    <div class="c2"><span>Equipamento</span><b>${escL(nomeTipo(eq))}</b></div>
    <div class="c3"><span>Setor / localização</span><b>${escL(eq.Local)}${eq.Descricao ? ' — ' + escL(eq.Descricao) : ''}</b></div>
    <div><span>Data / hora</span><b>${fmtDia(reg.DataHora)} ${fmtHora(reg.DataHora)}</b></div>
    <div class="c2"><span>Inspecionado por</span><b>${escL(reg.Brigadista)}</b></div>
    <div class="c3"><span>Dupla responsável</span><b>${dupla ? 'Dupla ' + escL(dupla) + ' — ' + escL(membrosDupla(dupla).map(b => b.Nome).join(' / ') || '—') : 'Sem dupla definida'}</b></div>
    <div class="c${camposExtras.length ? 2 : 3}"><span>Verificação</span><b>QR Code lido no local${det.lidoEm ? ' às ' + fmtHora(det.lidoEm) : ''}</b></div>
    <div class="c${camposExtras.length ? 1 : 3}"><span>Referência</span><b>${camposExtras.length ? MESES[+mesRef.split('-')[1] - 1].slice(0, 3) + '/' + mesRef.slice(0, 4) : 'Inspeção mensal — ' + nomeMes(mesRef)}</b></div>
    ${camposExtras.map(c => `<div class="${camposExtras.length === 2 ? 'c' + (c.id === 'aquisicaoMangueira' ? '2' : '1') : 'c3'}"><span>${escL(c.rotulo)}</span><b>${fmtDataBr(extras[c.id])}</b></div>`).join('')}
  </div>

  <div class="duas bloco" style="margin-top:8px">
    <div><h2 style="margin-top:0">Resultado</h2>
      <div class="resultado">
        <div class="selo" style="background:${ok ? LAUDO_COR.ok : LAUDO_COR.nc}"><small>RESULTADO</small><b>${ok ? 'CONFORME' : 'NÃO CONFORME'}</b><small>${ok ? 'em condições de uso' : 'com restrição'}</small></div>
        ${temItens ? `${svgRosca([{ v: cont.ok, cor: LAUDO_COR.ok }, { v: cont.nc, cor: LAUDO_COR.nc }, { v: cont.na, cor: LAUDO_COR.na }], cont.indice + '%', 'conformidade', 64)}
        <div class="cont"><span><b style="color:${LAUDO_COR.ok}">${cont.ok}</b>conformes</span><span><b style="color:${LAUDO_COR.nc}">${cont.nc}</b>não conformes</span><span><b style="color:#6b7280">${cont.na}</b>não aplicáveis</span></div>`
        : '<span class="muted">Detalhamento por item não registrado.</span>'}
      </div></div>
    <div><h2 style="margin-top:0">Histórico — últimos 12 meses</h2>
      <div class="hist-box">${svgLinhaTempo(meses)}
        <div class="kpis"><span><b>${hist.length}</b> inspeções</span><span><b>${pct(confHist, hist.length)}%</b> conformes</span><span>rotina mensal <b>${mesesInspec}/12</b></span></div>
        <div class="legenda"><span><i style="background:${LAUDO_COR.ok}"></i>Conforme</span><span><i style="background:${LAUDO_COR.nc}"></i>Não conforme</span><span><i style="background:${LAUDO_COR.vazio}"></i>Sem inspeção</span><span><i style="border:1.5px solid ${LAUDO_COR.ink}"></i>Este laudo</span></div>
      </div></div>
  </div>

  <h2>Checklist de verificação (${itens.length} itens)</h2>
  ${temItens ? `<div class="duas">${tabelaItens(itens.slice(0, metade).map((t, n) => [t, n]))}${tabelaItens(itens.slice(metade).map((t, n) => [t, n + metade]))}</div>`
    : `<p class="muted" style="margin:0">Itens não registrados (inspeção anterior à versão atual do checklist). Resultado geral: <b>${ok ? 'Conforme' : 'Não conforme'}</b>${reg.ItensNC ? ' — ' + escL(reg.ItensNC) : ''}.</p>`}
  ${reg.Observacao ? `<p style="margin:4px 0 0"><b>Observações / ações necessárias:</b> ${escL(reg.Observacao)}</p>` : ''}

  ${fotos.length || ranking.length ? `<div class="duas bloco">
    ${fotos.length ? `<div><h2>Registro fotográfico</h2><div class="fotos">${fotos.slice(0, 6).map((f, n) => `<figure><img src="${f.imagem}" alt=""><figcaption><b>${n + 1}</b> · ${escL(f.item)}</figcaption></figure>`).join('')}</div>
      ${fotos.length > 6 ? `<p class="muted" style="margin:2px 0 0">+ ${fotos.length - 6} foto(s) no sistema.</p>` : ''}</div>` : ''}
    ${ranking.length ? `<div${fotos.length ? '' : ' style="grid-column: span 2"'}><h2>Recorrência de não conformidades (12 meses)</h2>${svgBarras(ranking)}</div>` : ''}
  </div>` : ''}

  <div class="bloco"><h2>Inspeções anteriores${hist.length > histMostrar.length ? ` (${histMostrar.length} mais recentes de ${hist.length})` : ''}</h2>
  <table class="hist"><thead><tr><th style="width:100px">Data</th><th style="width:30%">Inspecionado por</th><th style="width:78px">Resultado</th><th>Não conformidades</th></tr></thead><tbody>
    ${histMostrar.map(h => `<tr${h.Id === reg.Id ? ' class="atual"' : ''}><td>${fmtDia(h.DataHora)} ${fmtHora(h.DataHora)}</td><td>${escL(h.Brigadista)}</td>
      <td><span class="st ${h.Resultado === 'OK' ? 'ok' : 'nc'}">${h.Resultado === 'OK' ? 'Conforme' : 'Não conforme'}</span></td><td>${escL(h.ItensNC || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem outras inspeções no período.</td></tr>'}
  </tbody></table></div>

  <div class="bloco"><h2>Análise e conclusão</h2><p class="analise">${analiseTexto({ reg, eq, cont, nc, hist, mesesInspec, recorrentes, extras, temItens })}</p></div>

  <div class="rodape">
    <div class="normas"><b>Referências:</b> ${normas.map(escL).join(' · ')}.</div>
    <div class="ass"><b>${escL(reg.Brigadista)}</b><small>Brigadista responsável</small></div>
    <div class="ass"><b>&nbsp;</b><small>Coordenação da Brigada</small></div>
    <div class="ass"><b>&nbsp;</b><small>Segurança do Trabalho (SESTR)</small></div>
  </div>
  <div class="verif">Registro eletrônico nº ${escL(reg.Id)} · inspeção validada pela leitura do código exclusivo (QR Code) afixado no equipamento · sistema Checklist Brigada · ${emitidoEm}.</div>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 600));<\/script>
</body></html>`;
  janela.document.open(); janela.document.write(html); janela.document.close();
}
