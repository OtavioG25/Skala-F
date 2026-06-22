// Módulo de Clientes — Fase 3
// Estado local
let filterClienteBusca='';
let filterClienteRec='todos'; // 'todos' | 'rec' | 'norec'
let editingClienteId=null;
let formCliente={nome:'',codigo:'',cpfCnpj:'',recorrente:false,recorrenteDesde:'',inativadoEm:'',ativo:true};
let sortCli={col:'',dir:'asc'};
let clienteDetalheId=null;
let clientesCompSel=''; // YYYY-MM — competência selecionada na aba Clientes ('' = mês fechado)

// ---------- Mapeamento app → banco ----------
function toRowCliente(c){
  const r={
    id:c.id,
    codigo:c.codigo||null,
    nome:c.nome,
    cpf_cnpj:c.cpfCnpj||null,
    recorrente:!!c.recorrente,
    recorrente_desde:c.recorrenteDesde||null,
    inativado_em:c.inativadoEm||null,
    ativo:c.ativo!==false
  };
  return r;
}

// ---------- CRUD ----------
async function dbInsertCliente(c){
  const row=toRowCliente(c);
  if(!row.id)row.id=newId();
  const res=await sbFetch('POST','clientes',row);
  return Array.isArray(res)?res[0]:res;
}
async function dbUpdateCliente(c){
  await sbFetch('PATCH',`clientes?id=eq.${c.id}`,toRowCliente(c));
}
async function dbDeleteCliente(id){
  await sbFetch('DELETE',`clientes?id=eq.${id}`);
}

// ---------- Helpers ----------
function maskCpfCnpj(v){
  const d=String(v||'').replace(/\D/g,'').slice(0,14);
  if(d.length<=11){
    // CPF: 000.000.000-00
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/,(_,a,b,c,d)=>
      [a,b,c].filter(Boolean).join('.')+(d?'-'+d:''));
  }
  // CNPJ: 00.000.000/0000-00
  return d.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/,(_,a,b,c,d,e)=>{
    let out=a;
    if(b)out+='.'+b;
    if(c)out+='.'+c;
    if(d)out+='/'+d;
    if(e)out+='-'+e;
    return out;
  });
}
function clienteTipoFromDoc(cpfCnpj){
  const d=String(cpfCnpj||'').replace(/\D/g,'');
  return d.length>11?'PJ':'PF';
}

// ---------- Cálculos ----------
function calcSaudeCliente(clienteId){
  if(!clienteId)return 'ok';
  const hoje=new Date().toISOString().slice(0,10);
  const pend=DATA.filter(l=>
    l.clienteId===clienteId
    && l.status==='Pendente'
    && l.dataVenc
    && l.dataVenc<hoje
  );
  if(!pend.length)return 'ok';
  const maxAtraso=Math.max(...pend.map(l=>{
    const d1=new Date(l.dataVenc), d2=new Date(hoje);
    return Math.floor((d2-d1)/(1000*60*60*24));
  }));
  return maxAtraso>30 ? 'inadimplente' : 'atraso';
}
function countInadimplentes(){
  return CLIENTES.filter(c=>c.ativo!==false&&calcSaudeCliente(c.id)==='inadimplente').length;
}
function countAtrasados(){
  return CLIENTES.filter(c=>c.ativo!==false&&calcSaudeCliente(c.id)==='atraso').length;
}
function _mesFechadoComp(){
  const hoje=new Date();
  const dt=new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}
function _recCatNames(){
  return new Set((CATS_DATA?.R||[]).filter(c=>c.recorrente).map(c=>c.nome));
}
function calcMRR(comp){
  const compRef=comp||_mesFechadoComp();
  const rec=_recCatNames();
  if(!rec.size)return 0;
  return DATA
    .filter(l=>l.tipo==='R'
      && rec.has(l.cat)
      && (l.dataComp||'').slice(0,7)===compRef)
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0);
}
function calcNRR(comp){
  const compRef=comp||_mesFechadoComp();
  const rec=_recCatNames();
  return DATA
    .filter(l=>l.tipo==='R'
      && !rec.has(l.cat)
      && (l.dataComp||'').slice(0,7)===compRef)
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0);
}

// ---------- UI (stubs — Parte 4) ----------
function _clientesFiltered(){
  const q=_norm(filterClienteBusca||'');
  return CLIENTES.filter(c=>{
    if(filterClienteRec==='rec'&&!c.recorrente)return false;
    if(filterClienteRec==='norec'&&c.recorrente)return false;
    if(!q)return true;
    return _norm(c.nome).includes(q)
      ||_norm(c.codigo).includes(q)
      ||_norm(c.cpfCnpj).includes(q);
  });
}
function _clienteUltimoPgto(clienteId){
  const datas=DATA.filter(l=>l.clienteId===clienteId&&l.dataPgto).map(l=>l.dataPgto);
  return datas.length?datas.sort().pop():'';
}
function _clienteReceitaRecorrente(clienteId){
  if(!clienteId)return {valor:0,comp:''};
  const rec=_recCatNames();
  if(!rec.size)return {valor:0,comp:''};
  const lancs=DATA.filter(l=>l.clienteId===clienteId
    && l.tipo==='R'
    && rec.has(l.cat)
    && l.dataComp);
  if(!lancs.length)return {valor:0,comp:''};
  const latestComp=lancs.reduce((max,l)=>{
    const c=(l.dataComp||'').slice(0,7);
    return c>max?c:max;
  },'');
  const valor=lancs
    .filter(l=>(l.dataComp||'').slice(0,7)===latestComp)
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0);
  return {valor,comp:latestComp};
}
function _compShort(comp){
  if(!comp)return '';
  const [y,m]=comp.split('-').map(Number);
  const mesNome=(typeof MONTHS!=='undefined'&&MONTHS[m-1])||String(m).padStart(2,'0');
  return `${mesNome}/${y}`;
}
function _prevComp(comp){
  const [y,m]=comp.split('-').map(Number);
  const d=new Date(y,m-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function _nextComp(comp){
  const [y,m]=comp.split('-').map(Number);
  const d=new Date(y,m,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function _compStart(comp){
  return comp?`${comp}-01`:'';
}
function _compEnd(comp){
  if(!comp)return '';
  const [y,m]=comp.split('-').map(Number);
  return new Date(y,m,0).toISOString().slice(0,10);
}
function _clienteInicioEfetivo(c){
  if(c?.recorrenteDesde)return c.recorrenteDesde;
  const datas=DATA.filter(l=>l.clienteId===c?.id&&l.tipo==='R'&&l.dataComp).map(l=>l.dataComp);
  return datas.length?datas.sort()[0]:'';
}
function _clienteAtivoNaComp(c,comp){
  if(!c?.recorrente||!comp)return false;
  const inicio=_clienteInicioEfetivo(c);
  if(!inicio||inicio>_compEnd(comp))return false;
  return !c.inativadoEm||c.inativadoEm>=_compStart(comp);
}
function _getClientesComp(){
  return `${YEAR}-${String(DASHBOARD_MONTH+1).padStart(2,'0')}`;
}
function navClientesMes(dir){
  const ref=_getClientesComp();
  clientesCompSel=dir>0?_nextComp(ref):_prevComp(ref);
  renderKeepScroll();
}
function setClientesMes(val){
  clientesCompSel=val||'';
  renderKeepScroll();
}
function abrirDetalheCliente(id){
  if(window._chartCliDetalhe){try{window._chartCliDetalhe.destroy();}catch(e){}window._chartCliDetalhe=null;}
  clienteDetalheId=id;
  render();
}
function _renderClientesPeriodControl(){
  const wrap=document.getElementById('clientes-period-wrap');
  if(!wrap)return;
  const mesRef=_getClientesComp();
  const isDefault=!clientesCompSel;
  const lblTxt=compDisplay(mesRef+'-01')+(isDefault?'&nbsp;·':'');
  const lblColor=isDefault?'var(--brand-dark)':'var(--tx)';
  wrap.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;gap:0">
    <button onclick="navClientesMes(-1)" class="btn btn-ghost" style="padding:5px 12px;border-radius:8px 0 0 8px;border-right:none;font-size:16px;line-height:1;color:var(--tx2)">‹</button>
    <button onclick="setClientesMes('')" id="clientes-mes-lbl" style="padding:5px 18px;background:var(--s2);border:1px solid var(--bd);font-size:13px;font-weight:600;color:${lblColor};cursor:pointer;min-width:120px;text-align:center;line-height:1.6" title="Clique para voltar ao último mês fechado">${lblTxt}</button>
    <button onclick="navClientesMes(1)" class="btn btn-ghost" style="padding:5px 12px;border-radius:0 8px 8px 0;border-left:none;font-size:16px;line-height:1;color:var(--tx2)">›</button>
  </div>`;
}
function _clientesAtivosNaComp(comp){
  if(!comp)return new Set();
  return new Set(CLIENTES.filter(c=>_clienteAtivoNaComp(c,comp)).map(c=>c.id));
}
function _movimentoClientesAtivos(comp){
  const atual=_clientesAtivosNaComp(comp);
  let novos=0,churn=0;
  CLIENTES.forEach(c=>{
    const ini=_clienteInicioEfetivo(c);
    if(c.recorrente&&ini&&(ini||'').slice(0,7)===comp)novos++;
    if(c.recorrente&&c.inativadoEm&&(c.inativadoEm||'').slice(0,7)===comp)churn++;
  });
  return {total:atual.size,novos,churn};
}
function _clientesKPIs(){
  const comp=_getClientesComp();
  const ativos=_movimentoClientesAtivos(comp);
  const mrr=calcMRR(comp);
  const nrr=calcNRR(comp);
  const tot=mrr+nrr;
  const mixMRR=tot>0?Math.round(mrr/tot*100):0;
  const mrrPrev=calcMRR(_prevComp(comp));
  const mrrVar=mrrPrev>0?((mrr-mrrPrev)/mrrPrev*100):null;
  const inad=countInadimplentes();
  const atraso=countAtrasados();
  return {ativos,comp,mrr,nrr,mixMRR,mrrVar,inad,atraso};
}
function _clienteStatusBadge(c){
  if(!c.recorrente)return '<span class="badge bx" title="Cliente pontual / avulso">Pontual</span>';
  if(c.ativo===false)return `<span class="badge br" title="Inativo desde ${dateBR(c.inativadoEm)||'data não informada'} (clique para ativar)" onclick="event.stopPropagation();toggleClienteAtivo('${c.id}')" style="cursor:pointer">Inativo</span>`;
  return `<span class="badge bg" title="Recorrente ativo desde ${dateBR(_clienteInicioEfetivo(c))||'data não informada'} (clique para inativar)" onclick="event.stopPropagation();toggleClienteAtivo('${c.id}')" style="cursor:pointer">Ativo</span>`;
}
async function toggleClienteAtivo(id){
  const c=CLIENTES.find(x=>x.id===id);
  if(!c||!c.recorrente)return;
  const reativar=c.ativo===false;
  const novo={...c,ativo:reativar,inativadoEm:reativar?'':(c.inativadoEm||new Date().toISOString().slice(0,10))};
  try{
    await dbUpdateCliente(novo);
    c.ativo=novo.ativo;
    c.inativadoEm=novo.inativadoEm;
    toast(novo.ativo?'Cliente reativado':'Cliente inativado','ok');
    renderKeepScroll();
  }catch(e){
    console.error(e);
    toast('Erro ao alterar status: '+(e.message||e),'err');
  }
}
function _saudeBadge(saude){
  if(saude==='inadimplente')return '<span class="badge br">Inadimplente</span>';
  if(saude==='atraso')return '<span class="badge by">Em atraso</span>';
  return '<span class="badge bg">Adimplente</span>';
}
function _toggleBtn(val,label){
  const on=filterClienteRec===val;
  return `<button class="btn ${on?'btn-pri':'btn-ghost'}" style="padding:6px 12px;font-size:12px" onclick="filterClienteRec='${val}';renderKeepScroll()">${label}</button>`;
}

// Colunas redimensionáveis (mesmo padrão de LAN_COLS)
const CLI_COL_WIDTHS_KEY='financeiro_clientes_col_widths';
const CLI_COLS=[
  {id:'codigo',  lbl:'Código',           sort:'codigo',  w:90, min:70 },
  {id:'nome',    lbl:'Cliente',          sort:'nome',    w:240,min:140},
  {id:'cpfCnpj', lbl:'CPF/CNPJ',         sort:'cpfCnpj', w:160,min:120},
  {id:'tipo',    lbl:'Tipo',             sort:'tipo',    w:70, min:56 },
  {id:'status',  lbl:'Status',           sort:'status',  w:120,min:96 },
  {id:'inicio',  lbl:'Início',           sort:'inicio',  w:110,min:92 },
  {id:'saida',   lbl:'Saída',            sort:'saida',   w:110,min:92 },
  {id:'ultPgto', lbl:'Último pgto',      sort:'ultPgto', w:120,min:96 },
  {id:'recRec',  lbl:'Rec. Recorrente',  sort:'recRec',  w:150,min:110},
  {id:'saude',   lbl:'Saúde',            sort:'saude',   w:140,min:110},
  {id:'acoes',   lbl:'',                                 w:120,min:96 }
];
let cliColWidths=_loadCliColWidths();
function _loadCliColWidths(){
  try{
    const s=localStorage.getItem(CLI_COL_WIDTHS_KEY);
    const p=s?JSON.parse(s):{};
    return Object.fromEntries(CLI_COLS.map(c=>{
      const v=parseInt(p[c.id],10);
      return [c.id,Math.max(c.min,Number.isFinite(v)?v:c.w)];
    }));
  }catch(e){
    return Object.fromEntries(CLI_COLS.map(c=>[c.id,c.w]));
  }
}
function _saveCliColWidths(){
  try{localStorage.setItem(CLI_COL_WIDTHS_KEY,JSON.stringify(cliColWidths));}catch(e){}
}
function _renderCliColgroup(){
  return `<colgroup>${CLI_COLS.map(c=>`<col data-col="${c.id}" style="width:${cliColWidths[c.id]||c.w}px">`).join('')}</colgroup>`;
}
function _renderCliHead(){
  return `<tr>${CLI_COLS.map(c=>{
    const resize=`<span class="col-resize" title="Arraste para ajustar a largura" onclick="event.stopPropagation()" onmousedown="startCliColResize(event,'${c.id}')"></span>`;
    const w=cliColWidths[c.id]||c.w;
    if(!c.sort){
      return `<th class="lan-th" data-col="${c.id}" style="width:${w}px">${c.lbl||''}${resize}</th>`;
    }
    const cls=sortCli.col===c.sort?sortCli.dir:'';
    return `<th class="lan-th th-sort ${cls}" data-col="${c.id}" style="width:${w}px" onclick="sortClientes('${c.sort}')">${c.lbl||''}<span class="sort-ico"></span>${resize}</th>`;
  }).join('')}</tr>`;
}
function sortClientes(col){
  if(sortCli.col===col)sortCli.dir=sortCli.dir==='asc'?'desc':'asc';
  else{sortCli.col=col;sortCli.dir='asc';}
  renderKeepScroll();
}
function _sortClientesArr(list){
  if(!sortCli.col)return list;
  const dir=sortCli.dir==='asc'?1:-1;
  const get=(c)=>{
    if(sortCli.col==='ultPgto')return _clienteUltimoPgto(c.id)||'';
    if(sortCli.col==='recRec')return _clienteReceitaRecorrente(c.id).valor;
    if(sortCli.col==='inicio')return _clienteInicioEfetivo(c)||'';
    if(sortCli.col==='saida')return c.inativadoEm||'';
    if(sortCli.col==='status'){
      if(!c.recorrente)return 2;
      return c.ativo===false?1:0;
    }
    if(sortCli.col==='saude'){
      const s=calcSaudeCliente(c.id);
      return s==='inadimplente'?0:s==='atraso'?1:2;
    }
    return c[sortCli.col]??'';
  };
  return [...list].sort((a,b)=>{
    const va=get(a),vb=get(b);
    if(typeof va==='number'&&typeof vb==='number')return (va-vb)*dir;
    return String(va).localeCompare(String(vb),'pt-BR')*dir;
  });
}
function startCliColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const ci=CLI_COLS.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=CLI_COLS[ci],nextCol=CLI_COLS[ci+1]||null;
  const startX=e.clientX,startW=cliColWidths[colId]||col.w,startNextW=nextCol?(cliColWidths[nextCol.id]||nextCol.w):null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{
    const n=Math.max(col.min,startW+(ev.clientX-startX));
    cliColWidths[colId]=n;
    document.querySelectorAll(`.cli-tbl col[data-col="${colId}"],.cli-tbl th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');
    if(nextCol){
      const nn=Math.max(nextCol.min,startNextW-(n-startW));
      cliColWidths[nextCol.id]=nn;
      document.querySelectorAll(`.cli-tbl col[data-col="${nextCol.id}"],.cli-tbl th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');
    }
  };
  const onUp=()=>{
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    document.body.classList.remove('resizing-col');
    _saveCliColWidths();
  };
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}

function _mrrMesLabel(){
  // Mês fechado = mês anterior ao atual
  const hoje=new Date();
  const dt=new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
  const mesNome=(typeof MONTHS_FULL!=='undefined'&&MONTHS_FULL[dt.getMonth()])||String(dt.getMonth()+1).padStart(2,'0');
  return `${mesNome}/${dt.getFullYear()}`;
}

function renderClientes(c){
  if(clienteDetalheId){
    const cli=CLIENTES.find(x=>x.id===clienteDetalheId);
    if(cli){renderClienteDetalhe(cli,c);return;}
    clienteDetalheId=null;
  }
  const focusedBusca=document.activeElement&&document.activeElement.id==='cli-busca';
  const cursorPos=focusedBusca?document.activeElement.selectionStart:null;
  const k=_clientesKPIs();
  const list=_sortClientesArr(_clientesFiltered());
  const compLbl=_compShort(k.comp);
  const ttMRR=`Soma das receitas recorrentes, da competência ${compLbl}`;
  const ttNRR=`Soma das receitas NÃO recorrentes, da competência ${compLbl}`;
  const ttInad=`Estado atual — não acompanha o seletor de competência`;
  const mov=k.ativos;
  const sinalNovos=mov.novos>0?`+${mov.novos} novos`:'';
  const sinalEncerrados=mov.churn>0?`-${mov.churn} encerrados`:'';
  const movTxt=[sinalNovos,sinalEncerrados].filter(Boolean).join(' · ')||'Sem alteração vs mês anterior';
  c.innerHTML=`
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-lbl">Clientes ativos</div>
        <div class="kpi-val">${mov.total}</div>
        <div class="kpi-sub">${movTxt}</div>
      </div>
      <div class="kpi" title="${esc(ttMRR)}" style="cursor:help"><div class="kpi-lbl">MRR</div><div class="kpi-val">${fmt(k.mrr)}</div><div class="kpi-sub" style="color:${k.mrrVar===null?'var(--tx3)':k.mrrVar>=0?'var(--teal)':'var(--red)'}">${k.mrrVar===null?'sem dado anterior':k.mrrVar>=0?`+${k.mrrVar.toFixed(1)}% vs mês anterior`:`${k.mrrVar.toFixed(1)}% vs mês anterior`}</div></div>
      <div class="kpi" title="${esc(ttNRR)}" style="cursor:help"><div class="kpi-lbl">NRR — Pontual</div><div class="kpi-val">${fmt(k.nrr)}</div><div class="kpi-sub">${100-k.mixMRR}% da receita do mês</div></div>
      <div class="kpi" title="${esc(ttInad)}" style="cursor:help"><div class="kpi-lbl">Inadimplentes</div><div class="kpi-val">${k.inad}</div><div class="kpi-sub">${k.atraso} em atraso</div></div>
    </div>

    <div class="card" style="padding:18px 20px">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <input type="text" id="cli-busca" placeholder="Buscar por nome, código ou CPF/CNPJ"
          value="${esc(filterClienteBusca)}"
          oninput="filterClienteBusca=this.value;renderKeepScroll()"
          style="flex:1;min-width:240px;padding:8px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:13px;outline:none">
        <div style="display:flex;gap:6px">
          ${_toggleBtn('todos','Todos')}
          ${_toggleBtn('rec','Recorrentes')}
          ${_toggleBtn('norec','Não Recorrentes')}
        </div>
        <button class="btn btn-pri" onclick="openEditCliente(null)">${appIcon('plus')}Novo Cliente</button>
      </div>

      <div class="lan-scroll">
        <table class="lan-tbl resizable cli-tbl">
          ${_renderCliColgroup()}
          <thead>${_renderCliHead()}</thead>
          <tbody>
            ${list.length?list.map(_clienteRowHTML).join(''):
              `<tr><td colspan="${CLI_COLS.length}" style="padding:32px;text-align:center;color:var(--tx3)">Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  if(focusedBusca){
    const inp=document.getElementById('cli-busca');
    if(inp){
      inp.focus();
      if(cursorPos!==null)inp.setSelectionRange(cursorPos,cursorPos);
    }
  }
}
function _clienteRowHTML(c){
  const ult=_clienteUltimoPgto(c.id);
  const recRec=_clienteReceitaRecorrente(c.id);
  const saude=calcSaudeCliente(c.id);
  const inicio=_clienteInicioEfetivo(c);
  const ultCell=ult?dateBR(ult):'<span style="opacity:.28;color:var(--tx3)">—</span>';
  const inicioCell=inicio?dateBR(inicio):'<span style="opacity:.28;color:var(--tx3)">—</span>';
  const saidaCell=c.inativadoEm?dateBR(c.inativadoEm):'<span style="opacity:.28;color:var(--tx3)">—</span>';
  const recCell=recRec.valor>0
    ? `<span title="Última competência: ${compDisplay(recRec.comp+'-01')}">${fmt(recRec.valor)}</span>`
    : '<span style="opacity:.28;color:var(--tx3)">—</span>';
  const recClass=recRec.valor>0?'vc r':'';
  return `<tr class="lr" id="cli-row-${c.id}" onclick="abrirDetalheCliente('${c.id}')">
    <td data-col="codigo" style="text-align:center">${esc(c.codigo||'—')}</td>
    <td data-col="nome" title="${esc(c.nome)}"><span class="ct">${esc(c.nome)}</span></td>
    <td data-col="cpfCnpj">${esc(c.cpfCnpj||'—')}</td>
    <td data-col="tipo"><span class="badge ${c.tipo==='PJ'?'bg':'by'}">${c.tipo||'—'}</span></td>
    <td data-col="status">${_clienteStatusBadge(c)}</td>
    <td data-col="inicio">${inicioCell}</td>
    <td data-col="saida">${saidaCell}</td>
    <td data-col="ultPgto">${ultCell}</td>
    <td data-col="recRec" class="${recClass}">${recCell}</td>
    <td data-col="saude">${_saudeBadge(saude)}</td>
    <td data-col="acoes" style="white-space:nowrap" onclick="event.stopPropagation()">
      <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Editar" onclick="openEditCliente('${c.id}')">${appIcon('edit')}</button>
      <button class="btn" title="Excluir" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteCliente('${c.id}')">${appIcon('trash')}</button>
    </td></tr>`;
}
function _renderClienteForm(){
  const f=formCliente;
  const lblSty='display:block;font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:4px';
  const inpSty='width:100%;box-sizing:border-box;padding:8px 10px';
  return `
    <div style="display:grid;gap:14px">
      <div>
        <label style="${lblSty}">Nome *</label>
        <input id="cli-nome" type="text" value="${esc(f.nome)}"
          oninput="formCliente.nome=this.value" style="${inpSty}"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label style="${lblSty}">Código (Domínio)</label>
          <input type="text" value="${esc(f.codigo||'')}"
            oninput="formCliente.codigo=this.value" style="${inpSty}"/>
        </div>
        <div>
          <label style="${lblSty}">CPF / CNPJ</label>
          <input id="cli-doc" type="text" value="${esc(f.cpfCnpj||'')}"
            oninput="formCliente.cpfCnpj=maskCpfCnpj(this.value);this.value=formCliente.cpfCnpj"
            style="${inpSty}"/>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:8px">
        <input type="checkbox" ${f.recorrente?'checked':''}
          onchange="formCliente.recorrente=this.checked;if(this.checked&&!formCliente.recorrenteDesde)formCliente.recorrenteDesde=new Date().toISOString().slice(0,10);if(!this.checked){formCliente.inativadoEm='';formCliente.ativo=true;}document.getElementById('cliente-body').innerHTML=_renderClienteForm()"
          style="width:18px;height:18px;cursor:pointer;margin:0">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--tx)">Cliente recorrente</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">Marque se este cliente paga mensalidade fixa (compõe MRR e Clientes Ativos)</div>
        </div>
      </label>
      ${f.recorrente?`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label style="${lblSty}">Início da recorrência</label>
          <input type="date" value="${esc(f.recorrenteDesde||'')}"
            onchange="formCliente.recorrenteDesde=this.value" style="${inpSty}"/>
        </div>
        <div>
          <label style="${lblSty}">Data de inativação</label>
          <input type="date" id="cli-inativado-em" value="${esc(f.inativadoEm||'')}"
            onchange="formCliente.inativadoEm=this.value;formCliente.ativo=!this.value;const _c=document.getElementById('cli-ativo-chk');if(_c)_c.checked=formCliente.ativo!==false" style="${inpSty}"/>
        </div>
      </div>`:''}
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:8px">
        <input type="checkbox" id="cli-ativo-chk" ${f.ativo!==false?'checked':''}
          onchange="formCliente.ativo=this.checked;formCliente.inativadoEm=this.checked?'':(formCliente.inativadoEm||new Date().toISOString().slice(0,10));const _d=document.getElementById('cli-inativado-em');if(_d)_d.value=formCliente.inativadoEm||''"
          style="width:18px;height:18px;cursor:pointer;margin:0">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--tx)">Cliente ativo</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">Desmarque ao perder o cliente — preserva histórico mas sai do KPI "Clientes Ativos"</div>
        </div>
      </label>
    </div>
    <div class="fa" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--bd)">
      <button class="btn btn-ghost" onclick="closeClienteForm()">Cancelar</button>
      <button class="btn btn-pri" onclick="saveCliente()">Salvar Cliente</button>
    </div>
  `;
}
function openEditCliente(id){
  editingClienteId=id;
  if(id){
    const c=CLIENTES.find(x=>x.id===id);
    if(!c){toast('Cliente não encontrado','err');return;}
    formCliente={nome:c.nome,codigo:c.codigo,cpfCnpj:c.cpfCnpj,
      recorrente:c.recorrente,recorrenteDesde:c.recorrenteDesde,
      inativadoEm:c.inativadoEm||'',
      ativo:c.ativo!==false};
  }else{
    formCliente={nome:'',codigo:'',cpfCnpj:'',recorrente:false,recorrenteDesde:'',inativadoEm:'',ativo:true};
  }
  document.getElementById('cliente-modal-ttl').innerHTML=
    `<span data-app-icon="clipboard"></span>${id?'Editar Cliente':'Novo Cliente'}`;
  document.getElementById('cliente-body').innerHTML=_renderClienteForm();
  document.getElementById('cliente-overlay').style.display='flex';
  if(typeof renderAppIcons==='function')renderAppIcons();
  setTimeout(()=>document.getElementById('cli-nome')?.focus(),50);
}
function closeClienteForm(){
  const ov=document.getElementById('cliente-overlay');
  if(ov)ov.style.display='none';
  editingClienteId=null;
}
async function saveCliente(){
  const f=formCliente;
  if(!f.nome||!f.nome.trim()){toast('Nome é obrigatório','err');return;}
  const doc=(f.cpfCnpj||'').replace(/\D/g,'');
  if(doc&&doc.length!==11&&doc.length!==14){
    toast('CPF deve ter 11 dígitos ou CNPJ 14 dígitos','err');return;
  }
  if(f.recorrente&&!f.recorrenteDesde){
    f.recorrenteDesde=new Date().toISOString().slice(0,10);
  }
  if(!f.recorrente){
    f.recorrenteDesde='';
    f.inativadoEm='';
    f.ativo=true;
  }else if(f.ativo===false&&!f.inativadoEm){
    f.inativadoEm=new Date().toISOString().slice(0,10);
  }else if(f.ativo!==false&&f.inativadoEm){
    f.ativo=false;
  }
  try{
    if(editingClienteId){
      const obj={id:editingClienteId,...f};
      await dbUpdateCliente(obj);
      const idx=CLIENTES.findIndex(c=>c.id===editingClienteId);
      if(idx>=0)CLIENTES[idx]={...CLIENTES[idx],...f,
        tipo:clienteTipoFromDoc(f.cpfCnpj)};
      toast('Cliente atualizado','ok');
    }else{
      const obj={id:newId(),...f};
      await dbInsertCliente(obj);
      CLIENTES.push({...obj,tipo:clienteTipoFromDoc(f.cpfCnpj),createdAt:new Date().toISOString()});
      CLIENTES.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
      toast('Cliente cadastrado','ok');
    }
    closeClienteForm();
    render();
  }catch(e){
    console.error(e);
    toast('Erro ao salvar: '+(e.message||e),'err');
  }
}
async function deleteCliente(id){
  const c=CLIENTES.find(x=>x.id===id);
  if(!c)return;
  const vinculados=DATA.filter(l=>l.clienteId===id).length;
  if(vinculados>0){
    toast(`Cliente "${c.nome}" tem ${vinculados} lançamento(s) vinculado(s). Desvincule antes de excluir.`,'err');
    return;
  }
  if(!await openConfirmModal(`Excluir o cliente "${c.nome}"? Esta ação não pode ser desfeita.`,{danger:true,confirmLabel:'Excluir cliente'}))return;
  try{
    await dbDeleteCliente(id);
    CLIENTES=CLIENTES.filter(x=>x.id!==id);
    if(clienteDetalheId===id)clienteDetalheId=null;
    toast('Cliente excluído','ok');
    render();
  }catch(e){
    console.error(e);
    toast('Erro ao excluir: '+(e.message||e),'err');
  }
}

// -------- Visão individual do cliente --------
function _clienteDetalheKPIs(clienteId){
  const anoAtual=new Date().getFullYear();
  const lancsR=DATA.filter(l=>l.clienteId===clienteId&&l.tipo==='R');

  const totalAno=lancsR
    .filter(l=>(l.status==='Recebido'||l.status==='Parcial')
      &&(l.dataPgto||'').startsWith(String(anoAtual)))
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0);

  const porMes={};
  lancsR.filter(l=>l.status==='Recebido'||l.status==='Parcial').forEach(l=>{
    const m=(l.dataPgto||l.dataComp||'').slice(0,7);
    if(m)porMes[m]=(porMes[m]||0)+(parseFloat(l.valorLiq)||0);
  });
  const vals=Object.values(porMes);
  const ticketMedio=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;

  const comps=lancsR.filter(l=>l.dataComp).map(l=>l.dataComp).sort();
  let tempoCasa=0,inicioLabel='sem histórico';
  if(comps.length){
    const ini=new Date(comps[0].slice(0,7)+'-01');
    const hoje=new Date();
    tempoCasa=(hoje.getFullYear()-ini.getFullYear())*12+(hoje.getMonth()-ini.getMonth());
    inicioLabel='desde '+_compShort(comps[0].slice(0,7));
  }

  const comAmbas=lancsR.filter(l=>l.dataPgto&&l.dataVenc);
  const noPrazo=comAmbas.filter(l=>l.dataPgto<=l.dataVenc).length;
  const scoreAdim=comAmbas.length?Math.round(noPrazo/comAmbas.length*100):null;

  return{totalAno,ticketMedio,tempoCasa,inicioLabel,scoreAdim};
}
function _corStatusLanc(l){
  const hoje=new Date().toISOString().slice(0,10);
  if(l.status==='Recebido'||l.status==='Parcial')
    return l.dataPgto&&l.dataVenc&&l.dataPgto<=l.dataVenc?'var(--teal)':'#e3b341';
  if(l.status==='Pendente')
    return l.dataVenc&&l.dataVenc<hoje?'var(--red)':'var(--tx2)';
  return 'var(--tx3)';
}
function _alertasCliente(c){
  const hoje=new Date().toISOString().slice(0,10);
  const compAtual=hoje.slice(0,7);
  const lancsR=DATA.filter(l=>l.clienteId===c.id&&l.tipo==='R');
  const alertas=[];
  const vencidos=lancsR.filter(l=>l.status==='Pendente'&&l.dataVenc
    &&Math.floor((new Date(hoje)-new Date(l.dataVenc))/86400000)>30);
  if(vencidos.length){
    const tot=vencidos.reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0);
    alertas.push({cls:'br',msg:`${vencidos.length} título(s) vencido(s) há mais de 30 dias — total ${fmt(tot)}`});
  }
  if(c.recorrente&&c.ativo!==false&&!lancsR.some(l=>(l.dataComp||'').slice(0,7)===compAtual))
    alertas.push({cls:'by',msg:`Nenhum lançamento em ${_compShort(compAtual)} — verifique se o faturamento foi lançado`});
  const h6=new Date(hoje);h6.setMonth(h6.getMonth()-6);
  const ult6=lancsR.filter(l=>(l.dataComp||'').slice(0,7)>=h6.toISOString().slice(0,7)&&l.dataPgto&&l.dataVenc);
  if(ult6.length&&ult6.every(l=>l.dataPgto<=l.dataVenc))
    alertas.push({cls:'bg',msg:`Todos os títulos foram pagos no prazo nos últimos 6 meses`});
  return alertas;
}
function _desenhaGraficoCliente(clienteId){
  const canvas=document.getElementById('cli-detalhe-chart');
  if(!canvas||typeof Chart==='undefined')return;
  if(window._chartCliDetalhe){try{window._chartCliDetalhe.destroy();}catch(e){}window._chartCliDetalhe=null;}
  const hoje=new Date();
  const meses=[];
  for(let i=11;i>=0;i--){
    const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const lancs=DATA.filter(l=>l.clienteId===clienteId&&l.tipo==='R');
  const recebido=meses.map(m=>lancs
    .filter(l=>(l.status==='Recebido'||l.status==='Parcial')&&(l.dataPgto||'').slice(0,7)===m)
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0));
  const esperado=meses.map(m=>lancs
    .filter(l=>(l.dataVenc||l.dataComp||'').slice(0,7)===m)
    .reduce((s,l)=>s+(parseFloat(l.valorLiq)||0),0));
  const labels=meses.map(m=>{
    const [,mo]=m.split('-').map(Number);
    return (typeof MONTHS!=='undefined'&&MONTHS[mo-1])||String(mo).padStart(2,'0');
  });
  window._chartCliDetalhe=new Chart(canvas.getContext('2d'),{
    data:{labels,datasets:[
      {type:'bar',label:'Recebido',data:recebido,
       backgroundColor:'rgba(19,124,60,.65)',borderRadius:5,order:2},
      {type:'line',label:'Esperado',data:esperado,
       borderColor:'#58a6ff',borderDash:[5,4],borderWidth:2,
       pointRadius:3,pointBackgroundColor:'#58a6ff',tension:0,fill:false,order:1}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,animation:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.raw)}`}}
      },
      scales:{
        x:{grid:{color:'rgba(0,0,0,.04)'},ticks:{color:'#8a978f',font:{size:11}}},
        y:{grid:{color:'rgba(0,0,0,.05)'},border:{dash:[3,3]},
           ticks:{color:'#8a978f',font:{size:11},
             callback:v=>v>=1000?`${(v/1000).toFixed(0)}k`:v===0?'0':String(v)}}
      }
    }
  });
}
function renderClienteDetalhe(c,container){
  const saude=calcSaudeCliente(c.id);
  const kpis=_clienteDetalheKPIs(c.id);
  const alertas=_alertasCliente(c);
  const tipoDoc=clienteTipoFromDoc(c.cpfCnpj);
  const hoje=new Date().toISOString().slice(0,10);

  const lancsR=DATA.filter(l=>l.clienteId===c.id&&l.tipo==='R')
    .sort((a,b)=>{
      const da=a.dataComp||a.dataVenc||a.dataPgto||'';
      const db=b.dataComp||b.dataVenc||b.dataPgto||'';
      if(db!==da)return db.localeCompare(da);
      return (b.dataVenc||'').localeCompare(a.dataVenc||'');
    });

  // Score de adimplência com barra
  const scoreHtml=kpis.scoreAdim===null
    ?`<div class="kpi-val" style="font-size:20px">—</div><div class="kpi-sub">sem dados suficientes</div>`
    :(()=>{
      const s=kpis.scoreAdim;
      const cor=s>90?'var(--teal)':s>70?'#e3b341':'var(--red)';
      return `<div class="kpi-val">${s}%</div>
        <div class="kpi-sub">
          <div style="height:5px;background:var(--s3);border-radius:3px;overflow:hidden;margin:6px 0 3px">
            <div style="width:${s}%;height:100%;background:${cor};border-radius:3px"></div>
          </div>
          % pago no prazo
        </div>`;
    })();

  // Seção de alertas
  const alertasHtml=alertas.length?`
    <div class="card" style="margin-bottom:14px">
      <div class="card-ttl">${appIcon('activity')} Alertas</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${alertas.map(a=>`<div class="badge ${a.cls}" style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;border-radius:10px;font-size:12px;font-weight:500;white-space:normal">${a.msg}</div>`).join('')}
      </div>
    </div>`:'';

  // Linhas da tabela de lançamentos
  const tabelaRows=lancsR.map(l=>{
    const cor=_corStatusLanc(l);
    const lbl=l.status==='Pendente'&&l.dataVenc&&l.dataVenc<hoje?'Vencido':l.status;
    return `<tr class="lr" onclick="openEdit('${l.id}')" style="cursor:pointer">
      <td>${compDisplay(l.dataComp)||'<span style="opacity:.3">—</span>'}</td>
      <td>${l.dataVenc?dateBR(l.dataVenc):'<span style="opacity:.3">—</span>'}</td>
      <td>${l.dataPgto?dateBR(l.dataPgto):'<span style="opacity:.3">—</span>'}</td>
      <td title="${esc(l.desc||'')}" style="max-width:220px"><span class="ct">${esc(l.desc||'—')}</span></td>
      <td class="vc r" style="text-align:right">${fmt(l.valorLiq)}</td>
      <td><span style="font-size:12px;font-weight:700;color:${cor}">${lbl}</span></td>
    </tr>`;
  }).join('');

  const metaInfo=[c.codigo?`Cód. ${esc(c.codigo)}`:'',c.cpfCnpj?esc(c.cpfCnpj):''].filter(Boolean).join(' · ');

  container.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-ghost" style="gap:4px;flex-shrink:0" onclick="clienteDetalheId=null;render()">← Voltar</button>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:18px;font-weight:700;color:var(--tx);letter-spacing:-.01em">${esc(c.nome)}</span>
          <span class="badge ${tipoDoc==='PJ'?'bg':'by'}">${tipoDoc}</span>
          ${_clienteStatusBadge(c)}
          ${_saudeBadge(saude)}
        </div>
        ${metaInfo?`<div style="font-size:12px;color:var(--tx3);margin-top:3px">${metaInfo}</div>`:''}
      </div>
      <button class="btn btn-ghost" style="flex-shrink:0" onclick="openEditCliente('${c.id}')" title="Editar cadastro do cliente">${appIcon('edit')} Editar</button>
    </div>

    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi">
        <div class="kpi-lbl">Recebido em ${new Date().getFullYear()}</div>
        <div class="kpi-val">${fmt(kpis.totalAno)}</div>
        <div class="kpi-sub">receitas recebidas no ano</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Ticket médio mensal</div>
        <div class="kpi-val">${fmt(kpis.ticketMedio)}</div>
        <div class="kpi-sub">por mês com recebimento</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Tempo de casa</div>
        <div class="kpi-val">${kpis.tempoCasa||'—'}</div>
        <div class="kpi-sub">${kpis.tempoCasa?'meses · '+kpis.inicioLabel:'sem histórico'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Adimplência</div>
        ${scoreHtml}
      </div>
    </div>

    ${alertasHtml}

    <div class="card" style="margin-bottom:14px">
      <div class="card-ttl">${appIcon('chart')} Histórico mensal — últimos 12 meses</div>
      <div style="position:relative;height:200px">
        <canvas id="cli-detalhe-chart"></canvas>
      </div>
      <div style="display:flex;gap:20px;margin-top:10px;font-size:12px;color:var(--tx3)">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:12px;height:12px;background:rgba(19,124,60,.65);border-radius:3px;flex-shrink:0;display:inline-block"></span>
          Recebido
        </span>
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:20px;border-top:2px dashed #58a6ff;display:inline-block;flex-shrink:0"></span>
          Esperado (por vencimento)
        </span>
      </div>
    </div>

    <div class="card">
      <div class="card-ttl">${appIcon('list')} Lançamentos (${lancsR.length})</div>
      ${lancsR.length?`
        <div class="lan-scroll">
          <table class="lan-tbl" style="min-width:100%">
            <thead><tr>
              <th class="lan-th">Competência</th>
              <th class="lan-th">Vencimento</th>
              <th class="lan-th">Pagamento</th>
              <th class="lan-th">Descrição</th>
              <th class="lan-th" style="text-align:right">Valor</th>
              <th class="lan-th">Status</th>
            </tr></thead>
            <tbody>${tabelaRows}</tbody>
          </table>
        </div>`
      :`<div style="padding:28px 0;text-align:center;color:var(--tx3)">Nenhum lançamento vinculado a este cliente.</div>`}
    </div>
  `;

  setTimeout(()=>_desenhaGraficoCliente(c.id),50);
}

