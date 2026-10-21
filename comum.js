/* =================================================================
   Código comum aos dois apps (index.html = brigada / gestao.html = PC).

   CONFIGURAÇÃO — dados do projeto Supabase (veja LEIAME.md).
   Supabase › Project Settings › API:
     SUPABASE_URL = "Project URL"
     SUPABASE_KEY = chave "publishable" (ou a antiga "anon public"). É pública por natureza: a segurança fica nas funções do banco.
   NUNCA cole aqui a chave "service_role".
   Vazio = modo demonstração (dados só no aparelho).
   ================================================================= */
const CONFIG = {
  SUPABASE_URL: 'https://paueyalgozwchzrkgfoq.supabase.co',
  SUPABASE_KEY: 'sb_publishable_7sOItl5WFPfx9mtN9NLy2g_7FNqHCNE',
  EMPRESA: 'Dois Marcos Sementes',
  PIN_DEMO: '1234', // PIN da gestão no modo demonstração (com Supabase, vale o PIN definido no banco)
};

/* ---------------- Checklists por tipo de equipamento ---------------- */
const CHECKLISTS = {
  'Extintor': [
    'Lacre e pino de segurança intactos',
    'Manômetro na faixa verde (quando houver)',
    'Mangueira / difusor sem trincas ou obstrução',
    'Carga dentro da validade',
    'Teste hidrostático dentro da validade',
    'Rótulo e etiqueta de inspeção legíveis',
    'Corpo sem corrosão, amassado ou vazamento',
    'Sinalização (placa e piso) visível',
    'Acesso desobstruído e altura correta',
  ],
  // Formulário "Checklist de verificação – Sistema de hidrantes" (mesma ordem do papel)
  'Hidrante com abrigo': [
    'Acesso obstruído',
    'Demarcação no piso',
    'Identificação',
    'Vazamento',
    'Esguicho',
    'Chave Storz - 2 UND',
    'Mangueiras - 2 UND',
    'Abrigo hidrante',
    'Registros',
    'Lacre',
    'Botoeira de alarmes',
  ],
  'Hidrante de recalque': [
    'Tampa presente e identificada "INCÊNDIO"',
    'Caixa limpa, sem água ou terra acumulada',
    'Tampão e adaptador storz presentes',
    'Registro sem vazamento',
    'Acesso livre para viatura dos bombeiros',
  ],
  'Acionamento manual': [
    'Botoeira sinalizada e visível',
    'Proteção / vidro intacto',
    'Sem danos ou corrosão',
    'Acesso desobstruído',
  ],
};
const CHECKLIST_PADRAO = ['Equipamento em bom estado', 'Sinalização visível', 'Acesso desobstruído'];
const itensDe = eq => CHECKLISTS[eq.Categoria === 'Extintor' ? 'Extintor' : eq.Tipo] || CHECKLIST_PADRAO;

/* Campos extras do cabeçalho do formulário, por tipo. Vêm preenchidos com o valor do último checklist do equipamento. */
const CAMPOS_EXTRAS = {
  'Hidrante com abrigo': [
    { id: 'aquisicaoMangueira', rotulo: 'Aquisição da mangueira', tipo: 'date' },
    { id: 'proximoTeste', rotulo: 'Próximo teste', tipo: 'date' },
  ],
};
const camposExtrasDe = eq => CAMPOS_EXTRAS[eq.Categoria === 'Extintor' ? 'Extintor' : eq.Tipo] || [];

/* Respostas de cada item: Conforme / Não conforme / N.A. (como no formulário em papel) */
const RESPOSTAS = { ok: 'Conforme', nc: 'Não conforme', na: 'N.A.' };
const detalheDe = r => { try { return JSON.parse(r.Detalhe || '{}'); } catch (e) { return {}; } };

/* ---------------- Ícones (traço) ---------------- */
const ICONES = {
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M20 20h.01M14 20h.01M17 17h3v3"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  admin: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  historico: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alerta: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  caixa: '<path d="M12 2.5l8.5 4.5v10L12 21.5 3.5 17V7z"/><path d="M3.5 7L12 11.5 20.5 7M12 11.5v10"/>',
  extintor: '<rect x="8" y="8" width="8" height="13.5" rx="3"/><path d="M10 8V5.5h4V8M14 5.5h2.5l2.5 2.5M10 5.5H7.5"/><path d="M11 13h2"/>',
  hidrante: '<path d="M7 21h10M8.5 21V10h7v11M7 10h10M10 10V7.5a2 2 0 0 1 4 0V10M5.5 13.5h3M15.5 13.5h3"/><circle cx="12" cy="15" r="1.5"/>',
  salvar: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  imprimir: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  subir: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  sair: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  celular: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  pin: '<path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};
const ico = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n] || ''}</svg>`;
const ESCUDO = '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z" fill="#d6262f"/><path d="M12.2 7.2c1.6 1.9 3.1 3.2 3.1 5.5a3.3 3.3 0 0 1-6.6 0c0-1.3.6-2.2 1.4-2.9.1 1.1.7 1.7 1.3 1.7 0-1.7-.2-2.8.8-4.3z" fill="#fff"/></svg>';
const nomeTipo = eq => String(eq.Tipo).toLowerCase().startsWith(String(eq.Categoria).toLowerCase()) ? eq.Tipo : eq.Categoria + ' ' + eq.Tipo;
const iconeDe = eq => ico(eq.Categoria === 'Hidrante' ? 'hidrante' : 'extintor');

/* ---------------- Armazenamento (com reserva em memória) ----------------
   Alguns navegadores de celular (abrir pelo WhatsApp/OneDrive, modo restrito)
   bloqueiam o localStorage. Nesses casos o app continua funcionando em memória. */
const LS = { usuario: 'brig_usuario', cache: 'brig_cache', fila: 'brig_fila', demo: 'brig_demo', pin: 'brig_pin' };
const MEM = {};
let ARMAZENAMENTO_OK = true;
function lsGet(k, def) {
  if (k in MEM) return MEM[k];
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { ARMAZENAMENTO_OK = false; return def; }
}
function lsSet(k, v) {
  MEM[k] = v;
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { ARMAZENAMENTO_OK = false; }
}

/* ---------------- Utilitários ---------------- */
// ?demo no endereço força o modo demonstração (para testar sem tocar no banco real)
const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY || new URLSearchParams(location.search).has("demo");
const VERSAO_DADOS = 4; // muda quando o formato do cadastro de demonstração muda
let S = { brigadistas: [], setores: [], equipamentos: [], registros: [], atualizadoEm: null, offline: false };
/* argumento seguro para onclick="fn(${js(x)})" */
const js = s => esc(JSON.stringify(String(s ?? '')));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ativo = x => !['NÃO', 'NAO', 'N', 'FALSE', 'INATIVO'].includes(String(x.Ativo ?? 'SIM').trim().toUpperCase());
function mesDe(d) { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
const mesAtual = () => mesDe(new Date());
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function nomeMes(m) { const [a, n] = m.split('-'); return MESES[+n - 1] + '/' + a; }
function mesAnterior(m, k = 1) { const [a, n] = m.split('-').map(Number); return mesDe(new Date(a, n - 1 - k, 1)); }
const mesReg = r => r.Mes || mesDe(r.DataHora);
const fmtData = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const primeiroNome = n => String(n || '').split(' ')[0];
const equipamentos = () => S.equipamentos.filter(ativo);
const eqPorCodigo = c => S.equipamentos.find(e => String(e.Codigo).toUpperCase() === String(c).toUpperCase());
const membrosDupla = d => S.brigadistas.filter(b => ativo(b) && String(b.Dupla) === String(d) && d !== '');
const nomesDupla = d => membrosDupla(d).map(b => primeiroNome(b.Nome)).join(' e ') || '—';
const duplas = () => [...new Set(S.brigadistas.filter(ativo).map(b => String(b.Dupla)).filter(Boolean))].sort((a, b) => a - b);
const proximaDupla = () => String(Math.max(0, ...S.brigadistas.map(b => +b.Dupla || 0), ...S.setores.map(s => +s.Dupla || 0)) + 1);
/* Responsabilidade: Brigadista → Dupla → Setor → Equipamentos.
   O SETOR é a Localização do equipamento: todos os equipamentos da mesma localização ficam com a mesma dupla
   (aba Setores: Setor = texto da localização, Dupla = responsável). */
const ordenaPt = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true });
const setorDe = eq => String(eq.Local || '').trim();
const setorPorNome = n => S.setores.find(s => String(s.Setor).trim().toUpperCase() === String(n).trim().toUpperCase());
const duplaDe = eq => String((setorPorNome(setorDe(eq)) || {}).Dupla || '');
const nomesSetores = () => [...new Set(equipamentos().map(setorDe).filter(Boolean))].sort(ordenaPt);
const setoresDaDupla = d => nomesSetores().filter(n => String((setorPorNome(n) || {}).Dupla || '') === String(d));
const categorias = () => [...new Set(equipamentos().map(e => e.Categoria))];
/* Link que vai no QR Code: sempre aponta para o app da brigada (index.html) */
/* O QR leva o código secreto (token) do equipamento: só quem lê a etiqueta no local consegue fazer o checklist */
const urlEquip = (cod, token) => new URL('./', location.href).href + '#/eq/' + encodeURIComponent(cod) + '/' + encodeURIComponent(token || '');
const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const urlApp = () => new URL('./', location.href).href;

function statusEq(cod, mes) {
  let ult = null;
  for (const r of S.registros) {
    if (r.Codigo !== cod || mesReg(r) !== mes) continue;
    if (!ult || r.DataHora > ult.DataHora) ult = r;
  }
  if (!ult) return { st: 'pend', txt: 'Pendente' };
  return ult.Resultado === 'OK' ? { st: 'ok', txt: 'Conforme', reg: ult } : { st: 'nc', txt: 'Não conforme', reg: ult };
}
const tagStatus = s => `<span class="tag ${s.st}">${s.txt}</span>`;

function resumo(lista, mes) {
  const r = { total: lista.length, ok: 0, nc: 0, pend: 0 };
  lista.forEach(e => r[statusEq(e.Codigo, mes).st]++);
  r.feitos = r.ok + r.nc;
  r.pct = r.total ? Math.round(r.feitos / r.total * 100) : 0;
  return r;
}

/* Gráfico de rosca: partes = [{v, cor}] */
const COR = { ok: '#0f7a52', nc: '#d6262f', pend: '#e8a317' };
function donut(partes, centro, sub, tam = 150, fundo = '#e9ecf0') {
  const total = partes.reduce((s, p) => s + p.v, 0) || 1;
  let acc = 0;
  const arcos = partes.filter(p => p.v > 0).map(p => {
    const len = p.v / total * 100;
    const s = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${p.cor}" stroke-width="5" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${25 - acc}"/>`;
    acc += len; return s;
  }).join('');
  return `<div class="donut" style="width:${tam}px;height:${tam}px"><svg viewBox="0 0 42 42" width="${tam}" height="${tam}">
    <circle cx="21" cy="21" r="15.915" fill="none" stroke="${fundo}" stroke-width="5"/>${arcos}</svg>
    <div class="centro"><b>${centro}</b><small>${sub}</small></div></div>`;
}

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}

function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
}
async function gerarQRs(raiz = document) {
  if (!window.QRCode) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
  raiz.querySelectorAll('.qr:empty').forEach(el =>
    new QRCode(el, { text: el.dataset.url, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M }));
}

/* ---------------- Dados: carregar / salvar ---------------- */
/* Supabase: leitura pelas visões v_* e gravação pelas funções do banco (supabase/schema.sql) */
// Chave nova (sb_publishable_…) vai só em "apikey"; a antiga (anon, JWT "eyJ…") também em Authorization.
const SB_HEADERS = () => ({ apikey: CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json',
  ...(CONFIG.SUPABASE_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + CONFIG.SUPABASE_KEY } : {}) });
const RPC = { registrar: 'registrar', pin: 'admin_pin', setorDupla: 'definir_setor_dupla', brigadista: 'salvar_brigadista', tokens: 'tokens', novoToken: 'novo_token' };

async function api(corpo) {
  const { acao, ...params } = corpo;
  const resp = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${RPC[acao]}`, { method: 'POST', headers: SB_HEADERS(), body: JSON.stringify(params) });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(j.message || 'Erro no servidor (' + resp.status + ')');
  if (j && j.ok === false) throw new Error(j.erro || 'Erro no servidor');
  return j;
}

/* Lê uma visão inteira, em páginas de 1000 linhas (limite padrão do Supabase) */
async function lerVisao(nome) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const resp = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${nome}?select=*`, { headers: { ...SB_HEADERS(), Range: `${de}-${de + 999}` } });
    if (!resp.ok) throw new Error('Erro ao ler ' + nome + ' (' + resp.status + ')');
    const pagina = await resp.json();
    linhas.push(...pagina);
    if (pagina.length < 1000) return linhas;
  }
}

async function carregar() {
  if (DEMO) {
    let d = lsGet(LS.demo, null);
    if (!d || d.versao !== VERSAO_DADOS) { // primeira vez, ou dados de demonstração de versão antiga
      d = { ...JSON.parse(JSON.stringify(window.DADOS_INICIAIS || { brigadistas: [], setores: [], equipamentos: [] })), registros: (d && d.registros) || [], versao: VERSAO_DADOS };
      // na demonstração os códigos secretos dos QR são criados no navegador (com o Supabase, quem cria é o banco)
      d.equipamentos.forEach(e => { if (!e.Token) e.Token = novoToken(); });
      lsSet(LS.demo, d);
    }
    Object.assign(S, d, { atualizadoEm: new Date().toISOString(), offline: false });
    return;
  }
  try {
    const [brigadistas, setores, equipamentos, registros] = await Promise.all(
      ['v_brigadistas', 'v_setores', 'v_equipamentos', 'v_registros'].map(lerVisao));
    const j = { brigadistas, setores, equipamentos, registros, atualizadoEm: new Date().toISOString() };
    Object.assign(S, j, { offline: false });
    lsSet(LS.cache, j);
  } catch (e) {
    const c = lsGet(LS.cache, null);
    if (c) Object.assign(S, c);
    S.offline = true;
  }
  // registros ainda não enviados aparecem como feitos
  const ids = new Set(S.registros.map(r => r.Id));
  lsGet(LS.fila, []).forEach(r => { if (!ids.has(r.Id)) S.registros.push(r); });
}

/* Altera o cadastro: no Supabase (com PIN) ou, no modo demonstração, no navegador.
   `aplicar(dados)` repete a mesma alteração na cópia local para a tela atualizar na hora. */
async function alterarCadastro(acao, corpo, pin, aplicar) {
  if (DEMO) {
    const d = JSON.parse(JSON.stringify(lsGet(LS.demo, {})));
    aplicar(d); lsSet(LS.demo, d);
    Object.assign(S, { brigadistas: d.brigadistas, setores: d.setores, equipamentos: d.equipamentos });
  } else {
    await api({ acao, pin, ...corpo });
    aplicar(S);
  }
}

/* Envia os checklists pendentes. Devolve os Ids que o banco recusou (código do QR inválido). */
async function enviarFila() {
  if (DEMO) return [];
  const fila = lsGet(LS.fila, []);
  if (!fila.length) return [];
  try {
    const j = await api({ acao: 'registrar', registros: fila });
    const rejeitados = j.rejeitados || [];
    const fora = new Set(j.ids.concat(rejeitados));
    lsSet(LS.fila, lsGet(LS.fila, []).filter(r => !fora.has(r.Id)));
    if (rejeitados.length) {
      S.registros = S.registros.filter(r => !rejeitados.includes(r.Id));
      toast(`${rejeitados.length} checklist(s) recusado(s): QR Code inválido ou trocado. Leia a etiqueta de novo.`);
    }
    return rejeitados;
  } catch (e) { return []; /* sem internet: tenta de novo depois */ }
}

/* Salva um checklist. Retorna { enviado, recusado }. reg.Token = código lido no QR. */
async function salvarRegistro(reg) {
  if (DEMO) {
    const d = lsGet(LS.demo, {});
    const eq = (d.equipamentos || []).find(e => e.Codigo === reg.Codigo);
    if (!eq || eq.Token !== reg.Token) return { enviado: false, recusado: true };
    const { Token, ...limpo } = reg;
    d.registros = (d.registros || []).concat(limpo); lsSet(LS.demo, d);
    S.registros.push(limpo);
    return { enviado: true, recusado: false };
  }
  S.registros.push(reg);
  lsSet(LS.fila, lsGet(LS.fila, []).concat(reg));
  const recusados = await enviarFila();
  if (recusados.includes(reg.Id)) return { enviado: false, recusado: true };
  return { enviado: !lsGet(LS.fila, []).some(r => r.Id === reg.Id), recusado: false };
}

function textoBanner() {
  const fila = lsGet(LS.fila, []).length;
  const msgs = [];
  if (DEMO) msgs.push('Modo demonstração — os dados ficam só neste aparelho.');
  else if (S.offline) msgs.push('Sem conexão — mostrando últimos dados salvos.');
  if (fila) msgs.push(`${fila} checklist(s) aguardando envio.`);
  if (!ARMAZENAMENTO_OK) msgs.push('Este navegador não permite salvar dados: abra o link no Chrome ou Safari.');
  return msgs.join(' ');
}
function atualizarBanner() {
  const msg = textoBanner();
  document.getElementById('banner').innerHTML = msg ? `<div class="banner">${esc(msg)}</div>` : '';
}

/* Navegação por #/rota — chama a tela mesmo se o endereço já for o mesmo */
function ir(h) { const alvo = '#/' + h; if (location.hash === alvo) rota(); else location.hash = alvo; }
function voltar() { if (history.length > 1) history.back(); else ir(''); }
