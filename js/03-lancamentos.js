let currentTipoFilter='';
let filterTipos=new Set(),filterStatuses=new Set(),filterBusca='',filterComps=new Set(),filterContas=new Set(),filterCats=new Set(),filterSub='',filterVencIni='',filterVencFim='',filterPgtoIni='',filterPgtoFim='';
let filterPendBusca='',filterPendTipo='';
let filterRecBusca='';
let showFluxoProj=localStorage.getItem('financeiro_fluxo_proj')==='1';
let filterExtratoConta='',filterExtratoInicio='',filterExtratoFim='',filterExtratoInclPend=false;
let selectedExtratoIds = new Set();
function toggleFluxoProj(){
  showFluxoProj=!showFluxoProj;
  localStorage.setItem('financeiro_fluxo_proj',showFluxoProj?'1':'0');
  render();
}
let sortLan={col:'dataComp',dir:'desc'};
let sortExtrato={col:'',dir:'asc'};
let sortPend={col:'dataVenc',dir:'asc'};
let selectedLanIds = new Set();
let _lanShowAll = false;
let _contasVisCols = null;
const LAN_COL_WIDTHS_KEY='financeiro_lancamentos_col_widths';
const LAN_COLS=[
  {id:'sel',w:42,min:38},
  {id:'seq',lbl:'Nº',sort:'seq',w:58,min:46},
  {id:'tipo',lbl:'Tipo',w:84,min:70},
  {id:'dataVenc',lbl:'Vencimento',sort:'dataVenc',w:112,min:92},
  {id:'dataPgto',lbl:'Pagamento',sort:'dataPgto',w:112,min:92},
  {id:'dataComp',lbl:'Competência',sort:'dataComp',w:112,min:92},
  {id:'cat',lbl:'Categoria',sort:'cat',w:160,min:110},
  {id:'sub',lbl:'Subcategoria',sort:'sub',w:170,min:110},
  {id:'desc',lbl:'Descrição',sort:'desc',w:220,min:130},
  {id:'conta',lbl:'Conta',sort:'conta',w:140,min:100},
  {id:'valorLiq',lbl:'Valor',sort:'valorLiq',w:130,min:100},
  {id:'status',lbl:'Status',sort:'status',w:104,min:84},
  {id:'acoes',lbl:'',w:96,min:82}
];
let lanColWidthsIsDefault=false;
let lanColWidths=loadLanColWidths();

function loadLanColWidths(){
  try{
    const stored=localStorage.getItem(LAN_COL_WIDTHS_KEY);
    const parsed=stored?JSON.parse(stored):null;
    if(parsed){
      lanColWidthsIsDefault=false;
      return Object.fromEntries(LAN_COLS.map(c=>{
        const saved=parseInt(parsed[c.id],10);
        return [c.id,Math.max(c.min,Number.isFinite(saved)?saved:c.w)];
      }));
    }
    lanColWidthsIsDefault=true;
    return Object.fromEntries(LAN_COLS.map(c=>[c.id,c.w]));
  }catch(e){
    lanColWidthsIsDefault=true;
    return Object.fromEntries(LAN_COLS.map(c=>[c.id,c.w]));
  }
}

function saveLanColWidths(){
  lanColWidthsIsDefault=false;
  try{localStorage.setItem(LAN_COL_WIDTHS_KEY,JSON.stringify(lanColWidths));}
  catch(e){console.warn('Falha ao salvar larguras das colunas',e);}
}

function applyLanColWidthsToDOM(){
  const visCols=_contasVisCols||(currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS);
  visCols.forEach(c=>{
    document.querySelectorAll(`.lan-tbl.resizable col[data-col="${c.id}"],.lan-tbl.resizable th[data-col="${c.id}"]`).forEach(el=>el.style.width=lanColWidths[c.id]+'px');
  });
  const totalW=visCols.reduce((s,c)=>s+(lanColWidths[c.id]||c.w),0);
  const containerW=document.querySelector('.lan-scroll')?.clientWidth||0;
  document.querySelectorAll('.lan-tbl.resizable').forEach(tbl=>{
    tbl.style.width=Math.max(totalW,containerW)+'px';
  });
}

function fitLanColsToContainer(cols){
  const visCols=cols||(currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS);
  const container=document.querySelector('.lan-scroll');if(!container)return;
  const available=container.clientWidth;
  const totalMin=visCols.reduce((s,c)=>s+c.min,0);
  if(available<totalMin||available<10)return;
  const currentTotal=visCols.reduce((s,c)=>s+(lanColWidths[c.id]||c.w),0);
  if(Math.abs(currentTotal-available)<5)return;
  const ratio=available/currentTotal;
  visCols.forEach(c=>{lanColWidths[c.id]=Math.max(c.min,Math.round((lanColWidths[c.id]||c.w)*ratio));});
  applyLanColWidthsToDOM();
}

function renderLanColgroup(cols){
  const c=cols||LAN_COLS;
  return `<colgroup>${c.map(col=>`<col data-col="${col.id}" style="width:${lanColWidths[col.id]||col.w}px">`).join('')}</colgroup>`;
}

function renderLanHeadCell(col){
  const width=lanColWidths[col.id]||col.w;
  const resize=`<span class="col-resize" title="Arraste para ajustar a largura" onclick="event.stopPropagation()" onmousedown="startLanColResize(event,'${col.id}')"></span>`;
  if(!col.sort)return `<th class="lan-th" data-col="${col.id}" style="width:${width}px">${col.lbl||''}${resize}</th>`;
  const cls = sortLan.col===col.sort ? sortLan.dir : '';
  return `<th class="lan-th th-sort ${cls}" data-col="${col.id}" style="width:${width}px" onclick="sortLancamentos('${col.sort}')">${col.lbl}<span class="sort-ico"></span>${resize}</th>`;
}

function startLanColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const visCols=_contasVisCols||(currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS);
  const ci=visCols.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=visCols[ci],nextCol=visCols[ci+1]||null;
  const startX=e.clientX,startW=lanColWidths[colId]||col.w,startNextW=nextCol?(lanColWidths[nextCol.id]||nextCol.w):null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{
    const n=Math.max(col.min,startW+(ev.clientX-startX));
    lanColWidths[colId]=n;
    document.querySelectorAll(`.lan-tbl.resizable col[data-col="${colId}"],.lan-tbl.resizable th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');
    if(nextCol){const nn=Math.max(nextCol.min,startNextW-(n-startW));lanColWidths[nextCol.id]=nn;document.querySelectorAll(`.lan-tbl.resizable col[data-col="${nextCol.id}"],.lan-tbl.resizable th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');}
  };
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.classList.remove('resizing-col');saveLanColWidths();};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

// ── Pendentes cols ────────────────────────────────────────────────
const PEND_COL_WIDTHS_KEY='financeiro_pend_col_widths';
const PEND_COLS=[
  {id:'sel',w:40,min:36},
  {id:'dataVenc',lbl:'Vencimento',sort:'dataVenc',w:112,min:92},
  {id:'dataComp',lbl:'Competência',sort:'dataComp',w:112,min:92},
  {id:'tipo',lbl:'Tipo',w:80,min:66},
  {id:'cat',lbl:'Categoria',sort:'cat',w:160,min:110},
  {id:'sub',lbl:'Subcategoria',sort:'sub',w:160,min:110},
  {id:'desc',lbl:'Descrição',sort:'desc',w:220,min:130},
  {id:'valorLiq',lbl:'Valor',sort:'valorLiq',w:120,min:90},
  {id:'status',lbl:'Status',w:100,min:80},
  {id:'acoes',lbl:'',w:100,min:82},
];
let pendColWidths=loadPendColWidths();
function loadPendColWidths(){try{const s=localStorage.getItem(PEND_COL_WIDTHS_KEY);const p=s?JSON.parse(s):{};return Object.fromEntries(PEND_COLS.map(c=>{const v=parseInt(p[c.id],10);return[c.id,Math.max(c.min,Number.isFinite(v)?v:c.w)];}));}catch(e){return Object.fromEntries(PEND_COLS.map(c=>[c.id,c.w]));}}
function savePendColWidths(){try{localStorage.setItem(PEND_COL_WIDTHS_KEY,JSON.stringify(pendColWidths));}catch(e){}}
function renderPendColgroup(){return`<colgroup>${PEND_COLS.map(c=>`<col data-col="${c.id}" style="width:${pendColWidths[c.id]}px">`).join('')}</colgroup>`;}
function renderPendHeadCell(col){
  const w=pendColWidths[col.id];
  const resize=`<span class="col-resize" onclick="event.stopPropagation()" onmousedown="startPendColResize(event,'${col.id}')"></span>`;
  if(!col.sort)return`<th class="lan-th" data-col="${col.id}" style="width:${w}px">${col.lbl||''}${resize}</th>`;
  const cls=sortPend.col===col.sort?sortPend.dir:'';
  return`<th class="lan-th th-sort ${cls}" data-col="${col.id}" style="width:${w}px" onclick="sortPendentes('${col.sort}')">${col.lbl}<span class="sort-ico"></span>${resize}</th>`;
}
function startPendColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const ci=PEND_COLS.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=PEND_COLS[ci],nextCol=PEND_COLS[ci+1]||null;
  const startX=e.clientX,startW=pendColWidths[colId],startNextW=nextCol?pendColWidths[nextCol.id]:null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{const n=Math.max(col.min,startW+(ev.clientX-startX));pendColWidths[colId]=n;document.querySelectorAll(`.pend-tbl col[data-col="${colId}"],.pend-tbl th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');if(nextCol){const nn=Math.max(nextCol.min,startNextW-(n-startW));pendColWidths[nextCol.id]=nn;document.querySelectorAll(`.pend-tbl col[data-col="${nextCol.id}"],.pend-tbl th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');}};
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.classList.remove('resizing-col');savePendColWidths();};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

// ── Recorrentes cols ───────────────────────────────────────────────
const REC_COL_WIDTHS_KEY='financeiro_rec_col_widths';
const REC_COLS=[
  {id:'desc',lbl:'Descrição',sort:'desc',w:220,min:140},
  {id:'cat',lbl:'Categoria',sort:'cat',w:160,min:110},
  {id:'sub',lbl:'Subcategoria',sort:'sub',w:160,min:110},
  {id:'valor',lbl:'Valor',sort:'valor',w:110,min:90},
  {id:'diaVenc',lbl:'Dia Venc.',sort:'diaVenc',w:80,min:66},
  {id:'compOffset',lbl:'Competência',sort:'compOffset',w:170,min:130},
  {id:'conta',lbl:'Conta',sort:'conta',w:150,min:110},
  {id:'acoes',lbl:'',w:90,min:76},
];
let recColWidths=loadRecColWidths();
let sortRec={col:'diaVenc',dir:'asc'};
function loadRecColWidths(){try{const s=localStorage.getItem(REC_COL_WIDTHS_KEY);const p=s?JSON.parse(s):{};return Object.fromEntries(REC_COLS.map(c=>{const v=parseInt(p[c.id],10);return[c.id,Math.max(c.min,Number.isFinite(v)?v:c.w)];}));}catch(e){return Object.fromEntries(REC_COLS.map(c=>[c.id,c.w]));}}
function saveRecColWidths(){try{localStorage.setItem(REC_COL_WIDTHS_KEY,JSON.stringify(recColWidths));}catch(e){}}
function renderRecColgroup(){return`<colgroup>${REC_COLS.map(c=>`<col data-col="${c.id}" style="width:${recColWidths[c.id]}px">`).join('')}</colgroup>`;}
function renderRecHeadCell(col){
  const w=recColWidths[col.id];
  const resize=`<span class="col-resize" onclick="event.stopPropagation()" onmousedown="startRecColResize(event,'${col.id}')"></span>`;
  if(!col.sort)return`<th class="lan-th" data-col="${col.id}" style="width:${w}px">${col.lbl||''}${resize}</th>`;
  const cls=sortRec.col===col.sort?sortRec.dir:'';
  return`<th class="lan-th th-sort ${cls}" data-col="${col.id}" style="width:${w}px" onclick="sortRecorrentes('${col.sort}')">${col.lbl}<span class="sort-ico"></span>${resize}</th>`;
}
function startRecColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const ci=REC_COLS.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=REC_COLS[ci],nextCol=REC_COLS[ci+1]||null;
  const startX=e.clientX,startW=recColWidths[colId],startNextW=nextCol?recColWidths[nextCol.id]:null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{const n=Math.max(col.min,startW+(ev.clientX-startX));recColWidths[colId]=n;document.querySelectorAll(`.rec-tbl col[data-col="${colId}"],.rec-tbl th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');if(nextCol){const nn=Math.max(nextCol.min,startNextW-(n-startW));recColWidths[nextCol.id]=nn;document.querySelectorAll(`.rec-tbl col[data-col="${nextCol.id}"],.rec-tbl th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');}};
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.classList.remove('resizing-col');saveRecColWidths();};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}
function sortRecorrentes(col){
  if(sortRec.col===col)sortRec.dir=sortRec.dir==='asc'?'desc':'asc';
  else{sortRec.col=col;sortRec.dir='asc';}
  renderRecorrentes(document.getElementById('content'));
}

// ── Fin-tbl cols (DRE / Fluxo) ────────────────────────────────────
const FIN_COL_WIDTHS_KEY='financeiro_fin_col_widths';
const FIN_COLS=[{id:'desc',min:120,w:200},...MONTHS.map((_,i)=>({id:`mon-${i}`,min:60,w:90})),{id:'tot',min:70,w:100}];
let finColWidths=loadFinColWidths();
function loadFinColWidths(){try{const s=localStorage.getItem(FIN_COL_WIDTHS_KEY);const p=s?JSON.parse(s):{};const o={};FIN_COLS.forEach(c=>{const v=parseInt(p[c.id],10);o[c.id]=Math.max(c.min,Number.isFinite(v)?v:(p.mon&&c.id.startsWith('mon-')?Math.max(c.min,parseInt(p.mon,10)||c.w):c.w));});return o;}catch(e){return Object.fromEntries(FIN_COLS.map(c=>[c.id,c.w]));}}
function saveFinColWidths(){try{localStorage.setItem(FIN_COL_WIDTHS_KEY,JSON.stringify(finColWidths));}catch(e){}}
function renderFinColgroup(){return`<colgroup>${FIN_COLS.map(c=>`<col data-col="${c.id}" style="width:${finColWidths[c.id]}px">`).join('')}</colgroup>`;}
function renderFinHead(){
  const mHdr=MONTHS.map((m,i)=>{const cid=`mon-${i}`;return`<th class="lan-th" data-col="${cid}" style="width:${finColWidths[cid]}px;text-align:right">${m}<span class="col-resize" onclick="event.stopPropagation()" onmousedown="startFinColResize(event,'${cid}')"></span></th>`;}).join('');
  return`<tr><th class="lan-th" data-col="desc" style="width:${finColWidths.desc}px">Descrição<span class="col-resize" onclick="event.stopPropagation()" onmousedown="startFinColResize(event,'desc')"></span></th>${mHdr}<th class="lan-th tc" data-col="tot" style="width:${finColWidths.tot}px">Total<span class="col-resize" onclick="event.stopPropagation()" onmousedown="startFinColResize(event,'tot')"></span></th></tr>`;
}
function startFinColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const ci=FIN_COLS.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=FIN_COLS[ci],nextCol=FIN_COLS[ci+1]||null;
  const startX=e.clientX,startW=finColWidths[colId],startNextW=nextCol?finColWidths[nextCol.id]:null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{
    const n=Math.max(col.min,startW+(ev.clientX-startX));
    finColWidths[colId]=n;
    document.querySelectorAll(`.fin-tbl.resizable col[data-col="${colId}"],.fin-tbl.resizable th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');
    if(nextCol){const nn=Math.max(nextCol.min,startNextW-(n-startW));finColWidths[nextCol.id]=nn;document.querySelectorAll(`.fin-tbl.resizable col[data-col="${nextCol.id}"],.fin-tbl.resizable th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');}
  };
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.classList.remove('resizing-col');saveFinColWidths();};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

function sortData(arr, col, dir){
  return [...arr].sort((a,b)=>{
    let va=a[col]??'', vb=b[col]??'';
    if(col==='valorLiq'){va=titleAmount(a);vb=titleAmount(b);}
    else if(col==='valorBruto'||col==='valor'){va=parseMoney(va);vb=parseMoney(vb);}
    const r = va>vb?1:va<vb?-1:0;
    return dir==='asc'?r:-r;
  });
}

function thSort(lbl, col, sortObj, renderFn){
  const cls = sortObj.col===col ? sortObj.dir : '';
  return `<th class="th-sort ${cls}" onclick="${renderFn}('${col}')">${lbl}<span class="sort-ico"></span></th>`;
}

function sortLancamentos(col){
  if(sortLan.col===col)sortLan.dir=sortLan.dir==='asc'?'desc':'asc';
  else{sortLan.col=col;sortLan.dir='desc';}
  const ls=document.querySelector('.lan-scroll');const st=ls?ls.scrollTop:0;
  if(currentTipoFilter==='R'||currentTipoFilter==='D'){
    // Atualiza só o indicador de ordenação no cabeçalho — sem re-renderizar a aba inteira
    document.querySelectorAll('.lan-tbl .th-sort').forEach(th=>th.classList.remove('asc','desc'));
    const activeCol=LAN_COLS.find(c=>c.sort===sortLan.col);
    if(activeCol){const th=document.querySelector(`.lan-tbl .th-sort[data-col="${activeCol.id}"]`);if(th)th.classList.add(sortLan.dir);}
    filterContasTbody();
  }else{
    renderLancamentos(document.getElementById('content'));
  }
  if(st>0)requestAnimationFrame(()=>{const el=document.querySelector('.lan-scroll');if(el)el.scrollTop=st;});
}

function multiDrop(id,btnLabel,opts,selected,onChg){
  const cnt=selected.size;
  const mid='msd-'+id;
  const items=opts.map(({v,l})=>`<label style="display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;font-size:13px;user-select:none" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''"><input type="checkbox" value="${esc(v)}" ${selected.has(v)?'checked':''} onchange="${onChg}(this.value,this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue)"/>${esc(l)}</label>`).join('');
  return`<div class="msd-wrap" style="position:relative;flex-shrink:0"><button type="button" onclick="toggleMSD('${mid}')" style="display:flex;align-items:center;gap:5px;background:var(--s2);border:1px solid ${cnt?'var(--blue)':'var(--bd2)'};border-radius:8px;color:${cnt?'var(--blue)':'var(--tx2)'};padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap">${esc(btnLabel)}${cnt?`<span class="msd-cnt" style="background:var(--blue);color:#fff;border-radius:10px;padding:0 6px;font-size:10px;font-weight:700">${cnt}</span>`:''}<span class="msd-arrow" style="opacity:.5;font-size:9px">▾</span></button><div id="${mid}" style="display:none;position:absolute;top:calc(100% + 4px);left:0;min-width:160px;background:var(--s2);border:1px solid var(--bd2);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:200;padding:6px 0">${items}</div></div>`;
}
function toggleMSD(id){
  const el=document.getElementById(id);if(!el)return;
  const wasOpen=el.style.display!=='none';
  document.querySelectorAll('[id^="msd-"]').forEach(d=>d.style.display='none');
  if(!wasOpen)el.style.display='block';
}
document.addEventListener('click',e=>{if(!e.target.closest('.msd-wrap'))document.querySelectorAll('[id^="msd-"]').forEach(d=>d.style.display='none');});
document.addEventListener('click',e=>{
  const drop=document.getElementById('filtros-drop');
  if(!drop||drop.style.display!=='block')return;
  const btn=document.getElementById('filtros-toggle-btn');
  if(e.target===btn||btn?.contains(e.target)||drop.contains(e.target)||e.target.closest('.filter-chip'))return;
  drop.style.display='none';
  if(currentTipoFilter){filterLanTbody();_refreshFiltrosBar();}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const drop=document.getElementById('filtros-drop');if(drop&&drop.style.display==='block')drop.style.display='none';}
});
function _refreshMsdBtn(id,selected){
  const menu=document.getElementById('msd-'+id);if(!menu)return;
  const btn=menu.previousElementSibling;if(!btn)return;
  const cnt=selected.size;
  btn.style.borderColor=cnt?'var(--blue)':'';btn.style.color=cnt?'var(--blue)':'';
  let badge=btn.querySelector('.msd-cnt');
  if(cnt){if(!badge){badge=document.createElement('span');badge.className='msd-cnt';badge.style.cssText='background:var(--blue);color:#fff;border-radius:10px;padding:0 6px;font-size:10px;font-weight:700';btn.insertBefore(badge,btn.querySelector('.msd-arrow'));}badge.textContent=cnt;}
  else{badge?.remove();}
}
function _refreshAnyAdv(){
  const any=filterTipos.size||filterStatuses.size||filterComps.size||filterContas.size||filterCats.size||filterSub||filterVencIni||filterVencFim||filterPgtoIni||filterPgtoFim;
  const btn=document.querySelector('.lan-limpar-btn');if(btn)btn.style.display=any?'inline-flex':'none';
}
function onLanTipoFilter(val,chk){
  if(chk)filterTipos.add(val);else filterTipos.delete(val);
  _lanShowAll=false;filterLanTbody();_refreshMsdBtn('lan-tipo',filterTipos);_refreshAnyAdv();
}
function onLanStatusFilter(val,chk){
  if(chk)filterStatuses.add(val);else filterStatuses.delete(val);
  filterLanTbody();_refreshMsdBtn('lan-status',filterStatuses);_refreshAnyAdv();
}
function onLanCompFilter(val,chk){
  if(chk)filterComps.add(val);else filterComps.delete(val);
  filterLanTbody();_refreshMsdBtn('lan-comp',filterComps);_refreshAnyAdv();
}
function onLanContaFilter(val,chk){
  if(chk)filterContas.add(val);else filterContas.delete(val);
  filterLanTbody();_refreshMsdBtn('lan-conta',filterContas);_refreshAnyAdv();
}
function onLanCatFilter(val,chk){
  if(chk)filterCats.add(val);else filterCats.delete(val);
  filterSub='';
  filterLanTbody();_refreshMsdBtn('lan-cat',filterCats);_refreshAnyAdv();
}
function applyLanFilter(){
  _lanShowAll=false;
  if(currentTipoFilter==='R')renderReceber(document.getElementById('content'));
  else if(currentTipoFilter==='D')renderPagar(document.getElementById('content'));
  else renderLancamentos(document.getElementById('content'));
}
function showAllLanRows(){_lanShowAll=true;filterLanTbody();}
function dateSearchText(d){
  if(!d)return '';
  const raw=String(d);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const br=`${raw.slice(8,10)}/${raw.slice(5,7)}/${raw.slice(0,4)}`;
    const brDash=br.replace(/\//g,'-');
    return `${raw} ${br} ${brDash}`;
  }
  if(/^\d{4}-\d{2}$/.test(raw)){
    const br=`${raw.slice(5,7)}/${raw.slice(0,4)}`;
    return `${raw} ${br} ${br.replace('/','-')}`;
  }
  return raw;
}
function lanSearchText(l){
  return [
    l.desc,l.cat,l.sub,l.conta,l.status,l.doc,l.forma,
    l.dataVenc,dateSearchText(l.dataVenc),
    l.dataPgto,dateSearchText(l.dataPgto)
  ].filter(Boolean).join(' ').toLowerCase();
}
function filterLanTbody(){
  if(currentTipoFilter){filterContasTbody();return;}
  let filtered=DATA.filter(l=>{
    if(currentTipoFilter){if(l.tipo!==currentTipoFilter||isTransfer(l)||l.adjType)return false;}
    else if(filterTipos.size){const isT=isTransfer(l);if(!filterTipos.has(isT?'T':l.tipo))return false;}
    if(filterStatuses.size){
      const match=[...filterStatuses].some(fs=>fs==='Realizado'?(l.tipo==='R'?l.status==='Recebido':l.tipo==='D'?l.status==='Pago':(l.status==='Recebido'||l.status==='Pago')):l.status===fs);
      if(!match)return false;
    }
    if(filterVencIni&&effectiveVenc(l)<filterVencIni)return false;
    if(filterVencFim&&effectiveVenc(l)>filterVencFim)return false;
    if(filterPgtoIni&&(l.dataPgto||'')<filterPgtoIni)return false;
    if(filterPgtoFim&&(l.dataPgto||'')>filterPgtoFim)return false;
    if(filterComps.size&&!filterComps.has((l.dataComp||'').slice(0,7)))return false;
    if(filterContas.size&&!filterContas.has(l.conta||''))return false;
    if(filterCats.size&&!filterCats.has(l.cat||''))return false;
    if(filterSub&&(l.sub||'')!==filterSub)return false;
    if(filterBusca&&!lanSearchText(l).includes(filterBusca.toLowerCase()))return false;
    return true;
  });
  filtered=sortData(filtered,sortLan.col,sortLan.dir);
  const cb=document.getElementById('count-badge');
  if(cb)cb.style.display='none';
  const tb=document.getElementById('lan-tbody');
  if(!tb)return;
  const visCols=currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS;
  if(!filtered.length){tb.innerHTML=`<tr><td colspan="${visCols.length}" class="empty-row">Nenhum lançamento encontrado</td></tr>`;onLanCheck();return;}
  const LAN_PAGE=250;
  const hasMore=!_lanShowAll&&filtered.length>LAN_PAGE;
  const visible=hasMore?filtered.slice(0,LAN_PAGE):filtered;
  tb.innerHTML=visible.map(l=>renderLanRow(l,!!currentTipoFilter)).join('')+
    (hasMore?`<tr><td colspan="${visCols.length}" style="text-align:center;padding:14px;border-top:1px solid var(--bd)"><span style="color:var(--tx2);font-size:13px">Exibindo ${LAN_PAGE} de ${filtered.length} lançamentos</span><button class="btn btn-ghost" style="margin-left:12px;font-size:12px" onclick="showAllLanRows()">Mostrar todos (${filtered.length})</button></td></tr>`:'');
  onLanCheck();
  renderSaldoCards();
}

function renderValorLancamento(l,adjTotal=0){
  const total=titleAmount(l)+adjTotal;
  const paid=paidAmount(l);
  const open=openAmount(l);
  if(paid>0.005&&open>0.005){
    return `<span title="Baixado: ${fmt(paid)} | Em aberto: ${fmt(open)}">${fmt(paid)}<span style="font-size:10px;color:#ff8c00;margin-left:3px">/ ${fmt(total)}</span></span>`;
  }
  return fmt(total);
}

function renderLanRow(l,skipTipo){
  const checked=selectedLanIds.has(l.id)?'checked':'';
  const isTransf=isTransfer(l);
  const tipoCls=isTransf?'t':l.tipo==='R'?'r':'d';
  const tipoLbl=isTransf?`${appIcon('transfer','app-icon tp-icon')} Transf`:l.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`;
  const tipoTd=skipTipo?'':` <td onclick="openEdit('${l.id}')"><span class="tp ${tipoCls}">${tipoLbl}</span></td>`;
  const adjs=DATA.filter(x=>x.parentId===l.id);
  const adjTotal=adjs.reduce((s,x)=>s+(x.adjType==='desconto'?-x.valorLiq:x.valorLiq),0);
  const adjHtml=adjs.length?`<div style="font-size:10px;color:var(--tx3);line-height:1.3;margin-top:1px">${adjs.map(x=>`(${x.adjType[0].toUpperCase()+x.adjType.slice(1)} ${fmt(x.valorLiq)})`).join('<br>')}</div>`:'';
  return `<tr class="lr" id="lan-row-${l.id}">
    <td><input type="checkbox" class="lan-chk" value="${l.id}" ${checked} onchange="onLanCheck()" style="width:15px;height:15px;cursor:pointer"/></td>
    <td onclick="openEdit('${l.id}')" style="color:var(--tx2);font-size:12px;text-align:center">${l.seq||'—'}</td>
    ${tipoTd}
    <td onclick="openEdit('${l.id}')">${dateBR(effectiveVenc(l))||'—'}</td>
    <td data-pgto onclick="openEdit('${l.id}')">${dateBR(l.dataPgto)||'—'}</td>
    <td onclick="openEdit('${l.id}')">${compDisplay(l.dataComp)||'—'}</td>
    <td title="${esc(l.cat)}" onclick="openEdit('${l.id}')"><span class="ct">${esc(l.cat)}</span></td>
    <td class="dc" title="${esc(l.sub||'')}" onclick="openEdit('${l.id}')">${esc(l.sub||'—')}</td>
    <td class="dc" title="${esc(l.desc||'')}" onclick="openEdit('${l.id}')">${esc(l.desc||'—')}</td>
    <td title="${esc(l.conta||'')}" onclick="openEdit('${l.id}')">${esc(l.conta||'—')}</td>
    <td class="vc ${l.tipo==='R'?'r':'d'}" onclick="openEdit('${l.id}')">${renderValorLancamento(l,adjTotal)}${adjHtml}</td>
    <td><span onclick="toggleStatus('${l.id}')" style="cursor:pointer" title="${openAmount(l)>0.005?'Clique para registrar baixa':'Clique para editar'}">${badge(computedStatus(l))}</span></td>
    <td style="white-space:nowrap">
      ${isTransf?'':`<button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Editar" onclick="openEdit('${l.id}')">${appIcon('edit')}</button>`}
      ${isTransf?'':`<button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Duplicar" onclick="duplicarLancamento('${l.id}')">${appIcon('copy')}</button>`}
      <button class="btn" title="Excluir" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${l.id}')">${appIcon('trash')}</button>
    </td></tr>`;
}

function _vencInfo(l){
  const venc=effectiveVenc(l);
  if(!venc)return{color:'var(--tx3)',tip:''};
  const isPendente=openAmount(l)>0.005;
  if(!isPendente)return{color:'var(--tx3)',tip:''};
  const today=new Date();today.setHours(0,0,0,0);
  const vd=new Date(venc+'T00:00:00');
  const diff=Math.round((vd-today)/86400000);
  if(diff<0)return{color:'var(--red)',tip:`Venceu há ${Math.abs(diff)} dia${Math.abs(diff)===1?'':'s'}`};
  if(diff===0)return{color:'var(--orange)',tip:'Vence hoje'};
  if(diff===1)return{color:'var(--orange)',tip:'Vence amanhã'};
  return{color:'var(--tx2)',tip:`Vence em ${diff} dia${diff===1?'':'s'}`};
}
function renderContasRow(l,groupId){
  const checked=selectedLanIds.has(l.id)?'checked':'';
  const adjs=DATA.filter(x=>x.parentId===l.id);
  const adjTotal=adjs.reduce((s,x)=>s+(x.adjType==='desconto'?-x.valorLiq:x.valorLiq),0);
  const adjHtml=adjs.length?`<div style="font-size:10px;color:var(--tx3);line-height:1.3;margin-top:1px">${adjs.map(x=>`(${x.adjType[0].toUpperCase()+x.adjType.slice(1)} ${fmt(x.valorLiq)})`).join('<br>')}</div>`:'';
  const vi=_vencInfo(l);
  const canBaixar=openAmount(l)>0.005;
  const acaoBaixa=l.tipo==='R'?'Receber':'Pagar';
  return `<tr class="lr" data-group="${groupId}" id="lan-row-${l.id}">
    <td><label class="chk-hit"><input type="checkbox" class="lan-chk" value="${l.id}" ${checked} onchange="onLanCheck()"/></label></td>
    <td onclick="openEdit('${l.id}')" style="color:var(--tx3);font-size:11px;text-align:center">${l.seq||'—'}</td>
    <td onclick="openEdit('${l.id}')" style="color:${vi.color}"${vi.tip?` title="${vi.tip}"`:''}>${dateBR(effectiveVenc(l))||'—'}</td>
    <td data-pgto onclick="openEdit('${l.id}')" style="${l.dataPgto?'':'opacity:.28;color:var(--tx3)'}">${dateBR(l.dataPgto)||'—'}</td>
    <td onclick="openEdit('${l.id}')" style="color:var(--tx2);font-size:12px">${compDisplay(l.dataComp)||'—'}</td>
    <td title="${esc(l.cat)}" onclick="openEdit('${l.id}')"><span class="ct">${esc(l.cat)}</span>${l.sub?`<div style="font-size:10.5px;color:var(--tx3);margin-top:1px">${esc(l.sub)}</div>`:''}</td>
    <td class="dc" title="${esc(l.desc||'')}" onclick="openEdit('${l.id}')">${l.obs&&l.obs.includes('[recorrente]')?`<span title="Despesa recorrente" style="font-size:11px;color:var(--tx3);margin-right:3px;display:inline-flex;align-items:center;vertical-align:middle">${appIcon('repeat','app-icon')}</span>`:''}
${esc(l.desc||'—')}</td>
    <td title="${esc(l.conta||'')}" onclick="openEdit('${l.id}')">${esc(l.conta||'—')}</td>
    <td class="vc ${l.tipo==='R'?'r':'d'}" onclick="openEdit('${l.id}')">${renderValorLancamento(l,adjTotal)}${adjHtml}</td>
    <td><span onclick="toggleStatus('${l.id}')" style="cursor:pointer" title="${canBaixar?`Clique para ${acaoBaixa.toLowerCase()}`:'Clique para editar'}">${badge(computedStatus(l))}</span></td>
    <td style="white-space:nowrap">
      ${canBaixar?`<button class="btn btn-pri" style="padding:4px 8px;font-size:12px" title="${acaoBaixa}" onclick="openBaixaModal('${l.id}')">${appIcon('wallet')}${acaoBaixa}</button>`:''}
      <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Editar" onclick="openEdit('${l.id}')">${appIcon('edit')}</button>
      <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Duplicar" onclick="duplicarLancamento('${l.id}')">${appIcon('copy')}</button>
      <button class="btn" title="Excluir" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${l.id}')">${appIcon('trash')}</button>
    </td></tr>`;
}

function toggleContasGroup(id){
  const rows=document.querySelectorAll(`#lan-tbody tr[data-group="${id}"]`);
  const arrow=document.getElementById('arrow-'+id);
  const isHidden=rows.length>0&&rows[0].style.display==='none';
  rows.forEach(r=>r.style.display=isHidden?'':'none');
  if(arrow)arrow.textContent=isHidden?'▼':'▶';
}

function renderContasFooter(filtered,tipo){
  const foot=document.getElementById('contas-foot');if(!foot)return;
  if(tipo==='R'){foot.innerHTML='';return;}
  const hoje=new Date().toISOString().split('T')[0];
  const realStatus=tipo==='R'?'Recebido':'Pago';
  const ncols=(_contasVisCols||[]).length||10;
  const totalAberto=filtered.reduce((s,l)=>s+openAmount(l),0);
  const totalVencido=filtered.filter(l=>openAmount(l)>0.005&&effectiveVenc(l)&&effectiveVenc(l)<hoje).reduce((s,l)=>s+openAmount(l),0);
  const totalPago=filtered.reduce((s,l)=>s+paidAmount(l),0);
  foot.innerHTML=`<tr class="contas-foot-row"><td colspan="${ncols}"><div style="display:flex;gap:24px;justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:10px 16px">
    ${totalVencido>0?`<span style="font-size:12px">Em atraso: <strong style="color:var(--red);font-variant-numeric:tabular-nums">${fmt(totalVencido)}</strong></span>`:''}
    <span style="font-size:12px;color:var(--tx2)">Em aberto: <strong style="color:var(--tx);font-variant-numeric:tabular-nums">${fmt(totalAberto)}</strong></span>
    <span style="font-size:12px;color:var(--tx2)">${realStatus}: <strong style="color:var(--brand-dark);font-variant-numeric:tabular-nums">${fmt(totalPago)}</strong></span>
  </div></td></tr>`;
}

function _countFiltrosAtivos(){
  let n=0;
  if(filterStatuses.size)n++;if(filterComps.size)n++;if(filterContas.size)n++;
  if(filterCats.size)n++;if(filterSub)n++;if(filterVencIni||filterVencFim)n++;if(filterPgtoIni||filterPgtoFim)n++;
  return n;
}
function _renderFiltroChips(){
  const chips=[];
  const _p='<span class="filter-chip-pencil">✏</span>';
  if(filterStatuses.size){const lbl=[...filterStatuses].join(', ');chips.push(`<span class="filter-chip" onclick="openFiltroSub('status')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('status')">×</span></span>`);}
  if(filterComps.size){const lbl=filterComps.size===1?compToView([...filterComps][0]):`${filterComps.size} competências`;chips.push(`<span class="filter-chip" onclick="openFiltroSub('comp')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('comp')">×</span></span>`);}
  if(filterContas.size){const lbl=filterContas.size===1?[...filterContas][0]:`${filterContas.size} contas`;chips.push(`<span class="filter-chip" onclick="openFiltroSub('conta')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('conta')">×</span></span>`);}
  if(filterCats.size){const lbl=filterCats.size===1?[...filterCats][0]:`${filterCats.size} categorias`;chips.push(`<span class="filter-chip" onclick="openFiltroSub('cat')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('cat')">×</span></span>`);}
  if(filterSub){chips.push(`<span class="filter-chip" onclick="openFiltroSub('sub')">${_p}${esc(filterSub)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('sub')">×</span></span>`);}
  if(filterVencIni||filterVencFim){const lbl=`Venc.: ${filterVencIni?dateBR(filterVencIni):'…'} → ${filterVencFim?dateBR(filterVencFim):'…'}`;chips.push(`<span class="filter-chip" onclick="openFiltroSub('venc')">${_p}${lbl}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('venc')">×</span></span>`);}
  if(filterPgtoIni||filterPgtoFim){const lbl=`Pgto: ${filterPgtoIni?dateBR(filterPgtoIni):'…'} → ${filterPgtoFim?dateBR(filterPgtoFim):'…'}`;chips.push(`<span class="filter-chip" onclick="openFiltroSub('pgto')">${_p}${lbl}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('pgto')">×</span></span>`);}
  return chips;
}
function clearAllContasFiltros(){
  filterStatuses=new Set();filterComps=new Set();filterContas=new Set();filterCats=new Set();filterSub='';filterVencIni='';filterVencFim='';filterPgtoIni='';filterPgtoFim='';
  contasCardFilter=null;
  ['receber','atrasados','mes'].forEach(k=>{const el=document.getElementById('kpi-card-'+k);if(el)el.classList.remove('k-card-active');});
  filterLanTbody();_refreshFiltrosBar();
}
function setIflStatus(val){
  if(!val||filterStatuses.has(val))filterStatuses=new Set();
  else filterStatuses=new Set([val]);
  filterLanTbody();_refreshFiltrosBar();
}
function setIflCat(val){
  filterCats=val?new Set([val]):new Set();filterSub='';
  filterLanTbody();_refreshFiltrosBar();
}
function setIflConta(val){
  filterContas=val?new Set([val]):new Set();
  filterLanTbody();_refreshFiltrosBar();
}
function _onPgtoIniChange(val){
  filterPgtoIni=val;
  if(val&&!filterPgtoFim){
    const[y,m]=val.split('-').map(Number);
    if(y&&m){
      const lastDay=new Date(y,m,0).getDate();
      filterPgtoFim=`${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      const fim=document.getElementById('ifl-pgto-fim');
      if(fim)fim.value=filterPgtoFim;
    }
  }
  if(filterPgtoIni&&filterPgtoFim){filterLanTbody();_refreshFiltrosBar();}
}
function _onPgtoFimChange(val){
  filterPgtoFim=val;
  if(filterPgtoIni||filterPgtoFim){filterLanTbody();_refreshFiltrosBar();}
}
function _renderInlineFiltroChips(){
  const chips=_renderFiltroChips();
  if(!chips.length)return '';
  return chips.join('')+`<button type="button" class="filter-clear-inline" onclick="clearAllContasFiltros()">Limpar filtros</button>`;
}
function _refreshFiltrosBar(){
  const n=_countFiltrosAtivos();
  const pillTodos=document.getElementById('ifl-pill-todos');
  if(pillTodos)pillTodos.classList.toggle('ifl-pill-on',!filterStatuses.size);
  FILTER_STATUS.forEach(s=>{const el=document.getElementById('ifl-pill-'+s.value);if(el)el.classList.toggle('ifl-pill-on',filterStatuses.has(s.value));});
  const btn=document.getElementById('filtros-toggle-btn');
  if(btn){btn.innerHTML=n?`⚙ Filtrar <span class="flt-cnt">${n}</span> ▾`:'⚙ Filtrar ▾';btn.classList.toggle('btn-ghost-active',n>0);}
  _refreshContasChipsRow();
  const badge=document.getElementById('filtros-badge');if(badge){badge.textContent=n||'';badge.style.display=n?'inline-flex':'none';}
}
function _renderContasChips(){
  const chips=[];
  const _p='<span class="filter-chip-pencil">✏</span>';
  if(contasCardFilter==='receber')chips.push(`<span class="filter-chip filter-chip-warn">${_p}A Receber<span class="filter-chip-x" onclick="event.stopPropagation();_clearCardFilter()">×</span></span>`);
  else if(contasCardFilter==='atrasados')chips.push(`<span class="filter-chip filter-chip-danger">${_p}Atrasados<span class="filter-chip-x" onclick="event.stopPropagation();_clearCardFilter()">×</span></span>`);
  else if(contasCardFilter==='mes'){const _stLbl=currentTipoFilter==='R'?'Recebido':'Pago';chips.push(`<span class="filter-chip filter-chip-green">${_p}${_stLbl}<span class="filter-chip-x" onclick="event.stopPropagation();_clearCardFilter()">×</span></span>`);}
  if(filterCats.size){const lbl=filterCats.size===1?[...filterCats][0]:`${filterCats.size} categorias`;chips.push(`<span class="filter-chip" onclick="openChipEdit(this,'cat')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('cat')">×</span></span>`);}
  if(filterSub)chips.push(`<span class="filter-chip" onclick="openChipEdit(this,'sub')">${_p}${esc(filterSub)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('sub')">×</span></span>`);
  if(filterContas.size){const lbl=filterContas.size===1?[...filterContas][0]:`${filterContas.size} contas`;chips.push(`<span class="filter-chip" onclick="openChipEdit(this,'conta')">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('conta')">×</span></span>`);}
  if(filterVencIni||filterVencFim){const lbl=`Venc. ${filterVencIni?dateBR(filterVencIni):'…'}–${filterVencFim?dateBR(filterVencFim):'…'}`;chips.push(`<span class="filter-chip" onclick="openChipEdit(this,'venc')">${_p}${lbl}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('venc')">×</span></span>`);}
  if(filterPgtoIni||filterPgtoFim){const lbl=`Pgto. ${filterPgtoIni?dateBR(filterPgtoIni):'…'}–${filterPgtoFim?dateBR(filterPgtoFim):'…'}`;chips.push(`<span class="filter-chip" onclick="openChipEdit(this,'pgto')">${_p}${lbl}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('pgto')">×</span></span>`);}
  if(filterComps.size){const lbl=filterComps.size===1?compToView([...filterComps][0]):`${filterComps.size} competências`;chips.push(`<span class="filter-chip" onclick="toggleFiltrosDrop()">${_p}${esc(lbl)}<span class="filter-chip-x" onclick="event.stopPropagation();clearFiltro('comp')">×</span></span>`);}
  if(!chips.length)return'';
  return chips.join('')+`<button type="button" style="margin-left:auto;font-size:11px;color:var(--red);background:none;border:none;cursor:pointer;white-space:nowrap;padding:2px 6px;flex-shrink:0" onclick="clearAllContasFiltros()">Limpar tudo</button>`;
}
function _clearCardFilter(){
  contasCardFilter=null;
  ['receber','atrasados','mes'].forEach(k=>{const el=document.getElementById('kpi-card-'+k);if(el)el.classList.remove('k-card-active');});
  filterLanTbody();_refreshFiltrosBar();
}
function _refreshContasChipsRow(){
  const row=document.getElementById('contas-chips-row');if(!row)return;
  const hasChips=_countFiltrosAtivos()>0||!!contasCardFilter;
  row.innerHTML=hasChips?_renderContasChips():'';
  row.style.display=hasChips?'flex':'none';
}
function _renderFiltrosDrop(){
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catSel=filterCats.size===1?[...filterCats][0]:'';
  const catObj=catsDisp.find(c=>c.nome===catSel);
  const subsDisp=catObj?(catObj.subs||[]):[];
  const inp='width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:13px;outline:none;box-sizing:border-box';
  const lbl=t=>`<div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${t}</div>`;
  return`<div style="padding:16px 16px 0">
    <div style="margin-bottom:14px">${lbl('Categoria')}<select id="fdrop-cat" style="${inp}" onchange="_fdropCatChange(this.value)"><option value="">Todas</option>${catsDisp.map(cat=>`<option value="${esc(cat.nome)}"${catSel===cat.nome?' selected':''}>${esc(cat.nome)}</option>`).join('')}</select></div>
    <div id="fdrop-sub-wrap" style="display:${subsDisp.length?'block':'none'};margin-bottom:14px">${subsDisp.length?`${lbl('Subcategoria')}<select id="fdrop-sub" style="${inp}"><option value="">Todas</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}"${filterSub===s.nome?' selected':''}>${esc(s.nome)}</option>`).join('')}</select>`:''}</div>
    ${contasDisp.length>1?`<div style="margin-bottom:14px">${lbl('Conta')}<select id="fdrop-conta" style="${inp}"><option value="">Todas</option>${contasDisp.map(ct=>`<option value="${esc(ct)}"${filterContas.has(ct)?' selected':''}>${esc(ct)}</option>`).join('')}</select></div>`:''}
    <div style="margin-bottom:16px">${lbl('Vencimento')}
      <div style="display:flex;flex-direction:column;gap:6px">
        <div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">De</div><input type="date" id="fdrop-venc-ini" value="${filterVencIni}" style="${inp};color-scheme:light"/></div>
        <div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">Até</div><input type="date" id="fdrop-venc-fim" value="${filterVencFim}" style="${inp};color-scheme:light"/></div>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--bd);background:var(--s2);border-radius:0 0 12px 12px">
    <button class="btn btn-ghost" style="font-size:13px" onclick="clearFiltrosDrop()">Limpar</button>
    <button class="btn btn-pri" style="font-size:13px" onclick="aplicarFiltrosDrop()">Aplicar</button>
  </div>`;
}
function _fdropCatChange(catNome){
  const wrap=document.getElementById('fdrop-sub-wrap');if(!wrap)return;
  const tipo=currentTipoFilter;
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=catsDisp.find(c=>c.nome===catNome);
  const subsDisp=catObj?(catObj.subs||[]):[];
  const inp='width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:13px;outline:none;box-sizing:border-box';
  const lbl=t=>`<div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${t}</div>`;
  if(!subsDisp.length){wrap.innerHTML='';wrap.style.display='none';return;}
  wrap.innerHTML=`${lbl('Subcategoria')}<select id="fdrop-sub" style="${inp}"><option value="">Todas</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}">${esc(s.nome)}</option>`).join('')}</select>`;
  wrap.style.display='block';
}
function aplicarFiltrosDrop(){
  const cat=document.getElementById('fdrop-cat')?.value||'';
  const conta=document.getElementById('fdrop-conta')?.value||'';
  const vencIni=document.getElementById('fdrop-venc-ini')?.value||'';
  const vencFim=document.getElementById('fdrop-venc-fim')?.value||'';
  const sub=document.getElementById('fdrop-sub')?.value||'';
  filterCats=cat?new Set([cat]):new Set();filterSub=sub;
  filterContas=conta?new Set([conta]):new Set();
  filterVencIni=vencIni;filterVencFim=vencFim;
  const drop=document.getElementById('filtros-drop');if(drop)drop.style.display='none';
  filterLanTbody();_refreshFiltrosBar();
}
function clearFiltrosDrop(){
  filterCats=new Set();filterSub='';filterContas=new Set();filterVencIni='';filterVencFim='';
  const c=document.getElementById('fdrop-cat');if(c)c.value='';
  const ct=document.getElementById('fdrop-conta');if(ct)ct.value='';
  const vi=document.getElementById('fdrop-venc-ini');if(vi)vi.value='';
  const vf=document.getElementById('fdrop-venc-fim');if(vf)vf.value='';
  const sw=document.getElementById('fdrop-sub-wrap');if(sw){sw.innerHTML='';sw.style.display='none';}
}
function openChipEdit(el,key){
  const drop=_getFiltrosDrop();
  const r=el.getBoundingClientRect();
  drop.style.width='300px';
  let left=r.left;
  if(left+300>window.innerWidth-12)left=window.innerWidth-312;
  drop.style.top=(r.bottom+6)+'px';drop.style.left=left+'px';drop.style.right='auto';
  const tipo=currentTipoFilter;
  const inp='width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:13px;outline:none;box-sizing:border-box';
  const lbl=t=>`<div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${t}</div>`;
  const foot=`<div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--bd);background:var(--s2);border-radius:0 0 12px 12px"><button class="btn btn-ghost" style="font-size:13px" onclick="clearFiltro('${key}');_getFiltrosDrop().style.display='none'">Limpar</button><button class="btn btn-pri" style="font-size:13px" onclick="_applyChipEdit('${key}')">Aplicar</button></div>`;
  let body='';
  if(key==='venc'){
    body=`<div style="padding:16px 16px 0"><div style="margin-bottom:16px">${lbl('Vencimento')}<div style="display:flex;flex-direction:column;gap:6px"><div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">De</div><input type="date" id="cedit-ini" value="${filterVencIni}" style="${inp};color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">Até</div><input type="date" id="cedit-fim" value="${filterVencFim}" style="${inp};color-scheme:light"/></div></div></div></div>`;
  }else if(key==='pgto'){
    body=`<div style="padding:16px 16px 0"><div style="margin-bottom:16px">${lbl('Pagamento')}<div style="display:flex;flex-direction:column;gap:6px"><div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">De</div><input type="date" id="cedit-ini" value="${filterPgtoIni}" style="${inp};color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">Até</div><input type="date" id="cedit-fim" value="${filterPgtoFim}" style="${inp};color-scheme:light"/></div></div></div></div>`;
  }else if(key==='cat'){
    const catsDisp=CATS_DATA[tipo]||[];
    const catSel=filterCats.size===1?[...filterCats][0]:'';
    const catObj=catsDisp.find(c=>c.nome===catSel);
    const subsDisp=catObj?(catObj.subs||[]):[];
    body=`<div style="padding:16px 16px 0"><div style="margin-bottom:14px">${lbl('Categoria')}<select id="cedit-cat" style="${inp}" onchange="_chipCatChange(this.value)"><option value="">Todas</option>${catsDisp.map(c=>`<option value="${esc(c.nome)}"${catSel===c.nome?' selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div id="cedit-sub-wrap" style="display:${subsDisp.length?'block':'none'};margin-bottom:14px">${subsDisp.length?`${lbl('Subcategoria')}<select id="cedit-sub" style="${inp}"><option value="">Todas</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}"${filterSub===s.nome?' selected':''}>${esc(s.nome)}</option>`).join('')}</select>`:''}</div></div>`;
  }else if(key==='sub'){
    const catsDisp=CATS_DATA[tipo]||[];
    const catSel=filterCats.size===1?[...filterCats][0]:'';
    const catObj=catsDisp.find(c=>c.nome===catSel);
    const subsDisp=catObj?(catObj.subs||[]):[];
    body=`<div style="padding:16px 16px 0"><div style="margin-bottom:14px">${lbl('Subcategoria')}<select id="cedit-sub" style="${inp}"><option value="">Todas</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}"${filterSub===s.nome?' selected':''}>${esc(s.nome)}</option>`).join('')}</select></div></div>`;
  }else if(key==='conta'){
    const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
    const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
    const contaSel=filterContas.size===1?[...filterContas][0]:'';
    body=`<div style="padding:16px 16px 0"><div style="margin-bottom:14px">${lbl('Conta')}<select id="cedit-conta" style="${inp}"><option value="">Todas</option>${contasDisp.map(ct=>`<option value="${esc(ct)}"${contaSel===ct?' selected':''}>${esc(ct)}</option>`).join('')}</select></div></div>`;
  }
  drop.innerHTML=body+foot;
  drop.style.display='block';
}
function _chipCatChange(catNome){
  const wrap=document.getElementById('cedit-sub-wrap');if(!wrap)return;
  const tipo=currentTipoFilter;
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=catsDisp.find(c=>c.nome===catNome);
  const subsDisp=catObj?(catObj.subs||[]):[];
  const inp='width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:13px;outline:none;box-sizing:border-box';
  const lbl=t=>`<div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${t}</div>`;
  if(!subsDisp.length){wrap.innerHTML='';wrap.style.display='none';return;}
  wrap.innerHTML=`${lbl('Subcategoria')}<select id="cedit-sub" style="${inp}"><option value="">Todas</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}">${esc(s.nome)}</option>`).join('')}</select>`;
  wrap.style.display='block';
}
function _applyChipEdit(key){
  if(key==='venc'){filterVencIni=document.getElementById('cedit-ini')?.value||'';filterVencFim=document.getElementById('cedit-fim')?.value||'';}
  else if(key==='pgto'){filterPgtoIni=document.getElementById('cedit-ini')?.value||'';filterPgtoFim=document.getElementById('cedit-fim')?.value||'';}
  else if(key==='cat'){const cat=document.getElementById('cedit-cat')?.value||'';const sub=document.getElementById('cedit-sub')?.value||'';filterCats=cat?new Set([cat]):new Set();filterSub=sub;}
  else if(key==='sub'){filterSub=document.getElementById('cedit-sub')?.value||'';}
  else if(key==='conta'){const c=document.getElementById('cedit-conta')?.value||'';filterContas=c?new Set([c]):new Set();}
  _getFiltrosDrop().style.display='none';
  filterLanTbody();_refreshFiltrosBar();
}
function clearFiltro(key){
  if(key==='status')filterStatuses=new Set();
  else if(key==='comp')filterComps=new Set();
  else if(key==='conta')filterContas=new Set();
  else if(key==='cat'){filterCats=new Set();filterSub='';}
  else if(key==='sub')filterSub='';
  else if(key==='venc'){filterVencIni='';filterVencFim='';}
  else if(key==='pgto'){filterPgtoIni='';filterPgtoFim='';}
  filterLanTbody();_refreshFiltrosBar();
}
function _getFiltrosDrop(){
  let drop=document.getElementById('filtros-drop');
  if(!drop){
    drop=document.createElement('div');
    drop.id='filtros-drop';
    drop.style.cssText='display:none;position:fixed;width:340px;background:var(--s1);border:1px solid var(--bd);border-radius:12px;box-shadow:0 8px 28px rgba(9,30,18,.16);z-index:9999;overflow:hidden';
    document.body.appendChild(drop);
  } else if(drop.parentElement!==document.body){
    document.body.appendChild(drop);
    drop.style.display='none';
  }
  return drop;
}
function toggleFiltrosDrop(){
  try{
    const drop=_getFiltrosDrop();
    if(drop.style.display==='block'){drop.style.display='none';return;}
    drop.style.width='340px';
    const btn=document.getElementById('filtros-toggle-btn');
    if(btn){const r=btn.getBoundingClientRect();drop.style.top=(r.bottom+6)+'px';drop.style.right=(window.innerWidth-r.right)+'px';drop.style.left='auto';}
    if(currentTipoFilter){drop.innerHTML=_renderFiltrosDrop();}
    else{_renderFiltrosDropMain();}
    drop.style.display='block';
  }catch(e){console.error('filtros err',e);}
}
function _renderFiltrosDropMain(){
  const drop=_getFiltrosDrop();if(!drop)return;
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(c=>c.nome===[...filterCats][0]):null;
  const hasSubOpts=(catObj?.subs||[]).length>0;
  const items=[
    {key:'status',label:'Situação',active:filterStatuses.size>0},
    {key:'comp',label:'Competência',active:filterComps.size>0},
    {key:'conta',label:'Conta',active:filterContas.size>0,hide:!contasDisp.length},
    {key:'cat',label:'Categoria',active:filterCats.size>0},
    {key:'sub',label:'Subcategoria',active:!!filterSub,hide:!hasSubOpts},
    {key:'pgto',label:'Data de Pagamento',active:!!(filterPgtoIni||filterPgtoFim)},
  ].filter(i=>!i.hide);
  drop.innerHTML=`<div style="padding:6px 0">${items.map(it=>`<button type="button" class="filtro-drop-item${it.active?' fdi-active':''}" onclick="event.stopPropagation();openFiltroSub('${it.key}')">${it.label}${it.active?'<span class="fdi-dot"></span>':''}</button>`).join('')}</div>`;
}
function filterFiltroOptions(raw){
  const q=String(raw||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  document.querySelectorAll('#filtros-drop .filtro-chk-row[data-filter-text]').forEach(row=>{
    const txt=String(row.dataset.filterText||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    row.style.display=!q||txt.includes(q)?'flex':'none';
  });
}
function _renderFiltroSearch(ph='Pesquisar'){
  return `<div class="filtro-search-wrap"><input class="filtro-search" type="text" placeholder="${esc(ph)}" oninput="filterFiltroOptions(this.value)" onclick="event.stopPropagation()"/></div>`;
}
function _renderFiltroChecks(values,selected,setName,extra=''){
  if(!values.length)return `<div class="filtro-empty">Nenhuma opção disponível</div>`;
  return values.map(item=>{
    const v=typeof item==='string'?item:item.value;
    const l=typeof item==='string'?item:item.label;
    return `<label class="filtro-chk-row" data-filter-text="${esc(l)}"><input type="checkbox" value="${esc(v)}" ${selected.has(v)?'checked':''} onchange="if(this.checked)${setName}.add(this.value);else ${setName}.delete(this.value);${extra}"/>${esc(l)}</label>`;
  }).join('');
}
function openFiltroSub(key){
  const drop=_getFiltrosDrop();if(!drop)return;
  drop.style.display='block';
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const compsDisp=[...new Set(tipoData.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(c=>c.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  const back=`<div class="filtro-sub-back" onclick="_renderFiltrosDropMain()">← Todos os filtros</div>`;
  let html='';
  if(key==='status'){
    html=`${back}<div class="filtro-sub-ttl">Situação</div><div class="filtro-sub-list">${FILTER_STATUS.map(s=>`<label class="filtro-chk-row"><input type="checkbox" value="${esc(s.value)}" ${filterStatuses.has(s.value)?'checked':''} onchange="if(this.checked)filterStatuses.add(this.value);else filterStatuses.delete(this.value)"/>${esc(s.label)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='comp'){
    html=`${back}<div class="filtro-sub-ttl">Competência</div><div class="filtro-sub-list">${compsDisp.map(v=>`<label class="filtro-chk-row"><input type="checkbox" value="${esc(v)}" ${filterComps.has(v)?'checked':''} onchange="if(this.checked)filterComps.add(this.value);else filterComps.delete(this.value)"/>${compToView(v)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='conta'){
    html=`${back}<div class="filtro-sub-ttl">Conta</div><div class="filtro-sub-list">${contasDisp.map(v=>`<label class="filtro-chk-row"><input type="checkbox" value="${esc(v)}" ${filterContas.has(v)?'checked':''} onchange="if(this.checked)filterContas.add(this.value);else filterContas.delete(this.value)"/>${esc(v)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='cat'){
    html=`${back}<div class="filtro-sub-ttl">Categoria</div><div class="filtro-sub-list">${catsDisp.map(cat=>`<label class="filtro-chk-row"><input type="checkbox" value="${esc(cat.nome)}" ${filterCats.has(cat.nome)?'checked':''} onchange="if(this.checked)filterCats.add(this.value);else filterCats.delete(this.value)"/>${esc(cat.nome)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='sub'){
    html=!subsDisp.length?`${back}<div class="filtro-sub-ttl">Subcategoria</div><div style="padding:16px;color:var(--tx3);font-size:12px;text-align:center">Selecione uma categoria primeiro</div>`:
    `${back}<div class="filtro-sub-ttl">Subcategoria</div><div class="filtro-sub-list"><label class="filtro-chk-row"><input type="radio" name="flt-sub" value="" ${!filterSub?'checked':''} onchange="filterSub=this.value"/>Todas</label>${subsDisp.map(s=>`<label class="filtro-chk-row"><input type="radio" name="flt-sub" value="${esc(s.nome)}" ${filterSub===s.nome?'checked':''} onchange="filterSub=this.value"/>${esc(s.nome)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='pgto'){
    html=`${back}<div class="filtro-sub-ttl">Data de Pagamento</div><div style="padding:10px 0 12px;display:flex;flex-direction:column;gap:8px"><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">De</div><input type="date" id="fp-ini" value="${filterPgtoIni}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Até</div><input type="date" id="fp-fim" value="${filterPgtoFim}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div></div><button class="btn btn-pri filtro-aplicar" onclick="filterPgtoIni=document.getElementById('fp-ini').value;filterPgtoFim=document.getElementById('fp-fim').value;aplicarFiltroSub()">Aplicar</button>`;
  }
  drop.innerHTML=`<div>${html}</div>`;
}
function openFiltroSub(key){
  const drop=_getFiltrosDrop();if(!drop)return;
  drop.style.display='block';
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const compsDisp=[...new Set(tipoData.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(c=>c.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  const _btn=document.getElementById('filtros-toggle-btn');
  if(_btn){const _r=_btn.getBoundingClientRect();drop.style.top=(_r.bottom+6)+'px';drop.style.right=(window.innerWidth-_r.right)+'px';drop.style.left='auto';}
  const back=`<button type="button" class="filtro-sub-back" onclick="event.stopPropagation();_renderFiltrosDropMain()">← Todos os filtros</button>`;
  let html='';
  if(key==='status'){
    html=`${back}<div class="filtro-sub-ttl">Situação</div><div class="filtro-sub-list">${_renderFiltroChecks(FILTER_STATUS.map(s=>({value:s.value,label:s.label})),filterStatuses,'filterStatuses')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='comp'){
    html=`${back}<div class="filtro-sub-ttl">Competência</div>${_renderFiltroSearch('Pesquisar competência')}<div class="filtro-sub-list">${_renderFiltroChecks(compsDisp.map(v=>({value:v,label:compToView(v)})),filterComps,'filterComps')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='conta'){
    html=`${back}<div class="filtro-sub-ttl">Conta</div>${_renderFiltroSearch('Pesquisar conta')}<div class="filtro-sub-list">${_renderFiltroChecks(contasDisp,filterContas,'filterContas')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='cat'){
    html=`${back}<div class="filtro-sub-ttl">Categoria</div>${_renderFiltroSearch('Pesquisar categoria')}<div class="filtro-sub-list">${_renderFiltroChecks(catsDisp.map(cat=>cat.nome),filterCats,'filterCats',"filterSub='';")}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='sub'){
    html=!subsDisp.length?`${back}<div class="filtro-sub-ttl">Subcategoria</div><div class="filtro-empty">Selecione uma categoria primeiro</div>`:
    `${back}<div class="filtro-sub-ttl">Subcategoria</div>${_renderFiltroSearch('Pesquisar subcategoria')}<div class="filtro-sub-list"><label class="filtro-chk-row" data-filter-text="Todas"><input type="radio" name="flt-sub" value="" ${!filterSub?'checked':''} onchange="filterSub=this.value"/>Todas</label>${subsDisp.map(s=>`<label class="filtro-chk-row" data-filter-text="${esc(s.nome)}"><input type="radio" name="flt-sub" value="${esc(s.nome)}" ${filterSub===s.nome?'checked':''} onchange="filterSub=this.value"/>${esc(s.nome)}</label>`).join('')}</div><button class="btn btn-pri filtro-aplicar" onclick="aplicarFiltroSub()">Aplicar</button>`;
  }else if(key==='pgto'){
    html=`${back}<div class="filtro-sub-ttl">Data de Pagamento</div><div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px"><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">De</div><input type="date" id="fp-ini" value="${filterPgtoIni}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Até</div><input type="date" id="fp-fim" value="${filterPgtoFim}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div></div><button class="btn btn-pri filtro-aplicar" onclick="filterPgtoIni=document.getElementById('fp-ini').value;filterPgtoFim=document.getElementById('fp-fim').value;aplicarFiltroSub()">Aplicar</button>`;
  }
  drop.innerHTML=`<div>${html}</div>`;
  const search=drop.querySelector('.filtro-search');
  if(search)requestAnimationFrame(()=>search.focus());
}

function _filtroItems(){
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(c=>c.nome===[...filterCats][0]):null;
  const hasSubOpts=(catObj?.subs||[]).length>0;
  return[
    {key:'status',label:'Situação',active:filterStatuses.size>0},
    {key:'comp',label:'Competência',active:filterComps.size>0},
    {key:'conta',label:'Conta',active:filterContas.size>0,hide:!contasDisp.length},
    {key:'cat',label:'Categoria',active:filterCats.size>0},
    {key:'sub',label:'Subcategoria',active:!!filterSub,hide:!hasSubOpts},
    {key:'venc',label:'Data de Vencimento',active:!!(filterVencIni||filterVencFim)},
    {key:'pgto',label:'Data de Pagamento',active:!!(filterPgtoIni||filterPgtoFim)},
  ].filter(i=>!i.hide);
}
function _renderFiltroPicker(activeKey='cat'){
  const items=_filtroItems();
  return `<div class="filtro-picker">
    <div class="filtro-picker-title">Mais filtros</div>
    <div class="filtro-picker-tags">
      ${items.map(it=>`<button type="button" class="filtro-type-chip${it.key===activeKey?' on':''}${it.active?' active':''}" onclick="event.stopPropagation();openFiltroSub('${it.key}')">${it.label}${it.active?'<span class="fdi-dot"></span>':''}</button>`).join('')}
      ${_countFiltrosAtivos()?`<button type="button" class="filtro-clear-link" onclick="event.stopPropagation();clearAllContasFiltros();openFiltroSub('${activeKey}')">Limpar filtros</button>`:''}
    </div>
  </div>`;
}
function _renderFiltroOptions(key){
  const tipo=currentTipoFilter;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));
  const compsDisp=[...new Set(tipoData.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(c=>c.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  if(key==='status')return `<div class="filtro-sub-ttl">Situação</div><div class="filtro-sub-list">${_renderFiltroChecks(FILTER_STATUS.map(s=>({value:s.value,label:s.label})),filterStatuses,'filterStatuses')}</div>`;
  if(key==='comp')return `<div class="filtro-sub-ttl">Competência</div>${_renderFiltroSearch('Pesquisar competência')}<div class="filtro-sub-list">${_renderFiltroChecks(compsDisp.map(v=>({value:v,label:compToView(v)})),filterComps,'filterComps')}</div>`;
  if(key==='conta')return `<div class="filtro-sub-ttl">Conta</div>${_renderFiltroSearch('Pesquisar conta')}<div class="filtro-sub-list">${_renderFiltroChecks(contasDisp,filterContas,'filterContas')}</div>`;
  if(key==='cat')return `<div class="filtro-sub-ttl">Categoria</div>${_renderFiltroSearch('Pesquisar categoria')}<div class="filtro-sub-list">${_renderFiltroChecks(catsDisp.map(cat=>cat.nome),filterCats,'filterCats',"filterSub='';")}</div>`;
  if(key==='sub')return !subsDisp.length?`<div class="filtro-sub-ttl">Subcategoria</div><div class="filtro-empty">Selecione uma categoria primeiro</div>`:
    `<div class="filtro-sub-ttl">Subcategoria</div>${_renderFiltroSearch('Pesquisar subcategoria')}<div class="filtro-sub-list"><label class="filtro-chk-row" data-filter-text="Todas"><input type="radio" name="flt-sub" value="" ${!filterSub?'checked':''} onchange="filterSub=this.value"/>Todas</label>${subsDisp.map(s=>`<label class="filtro-chk-row" data-filter-text="${esc(s.nome)}"><input type="radio" name="flt-sub" value="${esc(s.nome)}" ${filterSub===s.nome?'checked':''} onchange="filterSub=this.value"/>${esc(s.nome)}</label>`).join('')}</div>`;
  if(key==='venc')return `<div class="filtro-sub-ttl">Data de Vencimento</div><div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px"><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">De</div><input type="date" id="fv-ini" value="${filterVencIni}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Até</div><input type="date" id="fv-fim" value="${filterVencFim}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div></div>`;
  if(key==='pgto')return `<div class="filtro-sub-ttl">Data de Pagamento</div><div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px"><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">De</div><input type="date" id="fp-ini" value="${filterPgtoIni}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div><div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Até</div><input type="date" id="fp-fim" value="${filterPgtoFim}" style="width:100%;background:#fff;border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 8px;font-size:12px;outline:none;color-scheme:light"/></div></div>`;
  return '';
}
function _renderFiltrosDropMain(activeKey){
  const drop=_getFiltrosDrop();if(!drop)return;
  const key=activeKey||(_filtroItems()[0]?.key||'cat');
  drop.innerHTML=`${_renderFiltroPicker(key)}<div class="filtro-options-panel">${_renderFiltroOptions(key)}<button class="btn btn-pri filtro-aplicar" onclick="${key==='venc'?"filterVencIni=document.getElementById('fv-ini').value;filterVencFim=document.getElementById('fv-fim').value;":key==='pgto'?"filterPgtoIni=document.getElementById('fp-ini').value;filterPgtoFim=document.getElementById('fp-fim').value;":''}aplicarFiltroSub()">Aplicar</button></div>`;
  const search=drop.querySelector('.filtro-search');
  if(search)requestAnimationFrame(()=>search.focus());
}
function openFiltroSub(key){
  const drop=_getFiltrosDrop();if(!drop)return;
  drop.style.display='block';
  _renderFiltrosDropMain(key);
}
function aplicarFiltroSub(){
  const drop=document.getElementById('filtros-drop');if(drop)drop.style.display='none';
  filterLanTbody();_refreshFiltrosBar();
}

function toggleContasCardFilter(key){
  contasCardFilter=contasCardFilter===key?null:key;
  ['receber','atrasados','mes'].forEach(k=>{
    const el=document.getElementById('kpi-card-'+k);
    if(el)el.classList.toggle('k-card-active',contasCardFilter===k);
  });
  filterLanTbody();
  _refreshContasChipsRow();
}

const _calSvg=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

function _renderContasPeriodControl(){
  const wrap=document.getElementById('contas-period-wrap');if(!wrap)return;
  const mesRef=contasMesSel||new Date().toISOString().slice(0,7);
  if(contasRangeMode){
    const ini=contasRangeIni?dateBR(contasRangeIni):'';
    const fim=contasRangeFim?dateBR(contasRangeFim):'';
    wrap.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;gap:6px">
      <input type="date" id="contas-range-ini" value="${contasRangeIni}" class="ifl-date" style="width:130px;color-scheme:light" placeholder="dd/mm/aaaa" onchange="contasRangeIni=this.value"/>
      <span style="font-size:12px;color:var(--tx3)">→</span>
      <input type="date" id="contas-range-fim" value="${contasRangeFim}" class="ifl-date" style="width:130px;color-scheme:light" placeholder="dd/mm/aaaa" onchange="contasRangeFim=this.value"/>
      <button onclick="contasRangeIni=document.getElementById('contas-range-ini').value;contasRangeFim=document.getElementById('contas-range-fim').value;filterContasTbody();updateContasCardValues()" class="btn btn-pri" style="padding:5px 12px;font-size:12px">OK</button>
      <button onclick="exitContasRangeMode()" class="btn btn-ghost" style="padding:5px 9px;border-radius:8px;font-size:12px;color:var(--tx2)" title="Voltar para navegação por mês">✕ Período</button>
    </div>`;
  }else{
    wrap.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;gap:0">
      <button onclick="navContasMes(-1)" class="btn btn-ghost" style="padding:5px 12px;border-radius:8px 0 0 8px;border-right:none;font-size:16px;line-height:1;color:var(--tx2)">‹</button>
      <button onclick="setContasMes('')" id="contas-mes-lbl" style="padding:5px 18px;background:var(--s2);border:1px solid var(--bd);font-size:13px;font-weight:600;color:${contasMesSel?'var(--tx)':'var(--brand-dark)'};cursor:pointer;min-width:120px;text-align:center;line-height:1.6">${compDisplay(mesRef+'-01')}${!contasMesSel?'&nbsp;·':''}</button>
      <button onclick="navContasMes(1)" class="btn btn-ghost" style="padding:5px 12px;border-radius:0 8px 8px 0;border-left:none;font-size:16px;line-height:1;color:var(--tx2)">›</button>
      <button onclick="toggleContasRangeMode()" class="btn btn-ghost" style="margin-left:8px;padding:5px 9px;border-radius:8px;font-size:13px;color:var(--tx2);display:inline-flex;align-items:center" title="Definir período personalizado">${_calSvg}</button>
    </div>`;
  }
}
function toggleContasRangeMode(){
  contasRangeMode=true;
  if(!contasRangeIni){
    const mesRef=contasMesSel||new Date().toISOString().slice(0,7);
    const [y,m]=mesRef.split('-').map(Number);
    contasRangeIni=`${y}-${String(m).padStart(2,'0')}-01`;
    contasRangeFim=`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`;
  }
  _renderContasPeriodControl();
  filterContasTbody();
  updateContasCardValues();
}
function exitContasRangeMode(){
  contasRangeMode=false;contasRangeIni='';contasRangeFim='';
  _renderContasPeriodControl();
  filterContasTbody();
  updateContasCardValues();
}

function navContasMes(dir){
  const hoje=new Date();
  const base=contasMesSel?new Date(contasMesSel+'-02'):new Date(hoje.getFullYear(),hoje.getMonth(),1);
  base.setMonth(base.getMonth()+dir);
  const newVal=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
  setContasMes(newVal);
}

function setContasMes(val){
  contasMesSel=val;
  try{localStorage.setItem('skala_receber_mes',val);}catch(e){}
  const lbl=document.getElementById('contas-mes-lbl');
  if(lbl){const mesRef=val||new Date().toISOString().slice(0,7);lbl.innerHTML=compDisplay(mesRef+'-01')+(val?'':'&nbsp;·');lbl.style.color=val?'var(--tx)':'var(--brand-dark)';}
  const skel='<span class="kpi-skeleton"></span>';
  const skelSm='<span class="kpi-skeleton" style="width:52px;height:.7em"></span>';
  ['receber','atrasados','mes'].forEach(k=>{
    const el=document.getElementById('kpi-card-'+k);
    if(!el)return;
    const v=el.querySelector('.kpi-val');const s=el.querySelector('.kpi-sub');
    if(v)v.innerHTML=skel;if(s)s.innerHTML=skelSm;
  });
  requestAnimationFrame(updateContasCardValues);
}

function updateContasCardValues(){
  const tipo=currentTipoFilter;if(!tipo)return;
  const isR=tipo==='R';
  const hoje=new Date().toISOString().split('T')[0];
  const mesRef=contasMesSel||hoje.slice(0,7);
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!isTransfer(l)&&!l.adjType);
  const pendentes=tipoData.filter(l=>openAmount(l)>0.005);
  const totalPend=pendentes.reduce((s,l)=>s+openAmount(l),0);
  const atrasadas=pendentes.filter(l=>effectiveVenc(l)&&effectiveVenc(l)<hoje);
  const totalAtras=atrasadas.reduce((s,l)=>s+openAmount(l),0);
  const doMes=cashMovements().filter(m=>{
    if(m.tipo!==tipo||isTransfer(m)||m.adjType)return false;
    const p=m.dataPgto||'';
    if(contasRangeMode&&(contasRangeIni||contasRangeFim)){
      if(contasRangeIni&&p<contasRangeIni)return false;
      if(contasRangeFim&&p>contasRangeFim)return false;
      return true;
    }
    return p.startsWith(mesRef);
  });
  const totalMes=doMes.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  const set=(id,val,sub)=>{const el=document.getElementById(id);if(!el)return;const v=el.querySelector('.kpi-val');const s=el.querySelector('.kpi-sub');if(v)v.textContent=val;if(s)s.textContent=sub;};
  set('kpi-card-receber',fmt(totalPend),pendentes.length+' lançamento(s)');
  set('kpi-card-atrasados',fmt(totalAtras),atrasadas.length+' lançamento(s)');
  set('kpi-card-mes',fmt(totalMes),doMes.length+' lançamento(s)');
  const lbl=document.getElementById('kpi-lbl-mes');
  if(lbl)lbl.textContent=(isR?'Recebidos':'Pagos')+(contasRangeMode&&(contasRangeIni||contasRangeFim)?' no período':' em '+compDisplay(mesRef+'-01'));
  filterLanTbody();
}

function filterContasTbody(){
  const tipo=currentTipoFilter;
  const hoje=new Date().toISOString().split('T')[0];
  const mesRef=contasMesSel||hoje.slice(0,7);
  let filtered=DATA.filter(l=>{
    if(l.tipo!==tipo||isTransfer(l)||l.adjType)return false;
    if(filterStatuses.size){
      const match=[...filterStatuses].some(fs=>fs==='Realizado'?(tipo==='R'?l.status==='Recebido':l.status==='Pago'):l.status===fs);
      if(!match)return false;
    }
    if(filterVencIni&&effectiveVenc(l)<filterVencIni)return false;
    if(filterVencFim&&effectiveVenc(l)>filterVencFim)return false;
    if(filterPgtoIni&&(l.dataPgto||'')<filterPgtoIni)return false;
    if(filterPgtoFim&&(l.dataPgto||'')>filterPgtoFim)return false;
    if(filterComps.size&&!filterComps.has((l.dataComp||'').slice(0,7)))return false;
    if(filterContas.size&&!filterContas.has(l.conta||''))return false;
    if(filterCats.size&&!filterCats.has(l.cat||''))return false;
    if(filterSub&&(l.sub||'')!==filterSub)return false;
    if(filterBusca&&!lanSearchText(l).includes(filterBusca.toLowerCase()))return false;
    return true;
  });
  // Filtro de período
  if(!contasCardFilter){
    if(contasRangeMode&&(contasRangeIni||contasRangeFim)){
      const inRange=d=>{if(!d)return false;if(contasRangeIni&&d<contasRangeIni)return false;if(contasRangeFim&&d>contasRangeFim)return false;return true;};
      filtered=filtered.filter(l=>{
        const venc=effectiveVenc(l)||'';const pgto=l.dataPgto||'';
        if(!venc&&!pgto)return true;
        return inRange(venc)||inRange(pgto);
      });
    }else{
      filtered=filtered.filter(l=>{
        const venc=(effectiveVenc(l)||'').slice(0,7);
        const pgto=(l.dataPgto||'').slice(0,7);
        if(!venc&&!pgto)return true;
        return venc===mesRef||pgto===mesRef;
      });
    }
  }
  // Filtro de card ativo
  if(contasCardFilter){
    const realSt=tipo==='R'?'Recebido':'Pago';
    const useRange=contasRangeMode&&(contasRangeIni||contasRangeFim);
    const inRange=d=>{if(!d)return false;if(contasRangeIni&&d<contasRangeIni)return false;if(contasRangeFim&&d>contasRangeFim)return false;return true;};
    if(contasCardFilter==='receber')
      filtered=filtered.filter(l=>openAmount(l)>0.005&&(useRange?inRange(effectiveVenc(l)):(effectiveVenc(l)||'').startsWith(mesRef)));
    else if(contasCardFilter==='atrasados')
      filtered=filtered.filter(l=>openAmount(l)>0.005&&effectiveVenc(l)&&effectiveVenc(l)<hoje);
    else if(contasCardFilter==='mes'){
      const movs=cashMovements();
      filtered=filtered.filter(l=>movs.some(m=>{
        if(m.lancamentoId!==l.id)return false;
        const p=m.dataPgto||'';
        return useRange?inRange(p):p.startsWith(mesRef);
      }));
    }
  }
  filtered=sortData(filtered,sortLan.col,sortLan.dir);
  const cb=document.getElementById('count-badge');if(cb)cb.style.display='none';
  const tb=document.getElementById('lan-tbody');if(!tb)return;
  const ncols=(_contasVisCols||[]).length||10;
  if(!filtered.length){
    const _periodoNome=contasRangeMode&&(contasRangeIni||contasRangeFim)
      ?`${contasRangeIni?dateBR(contasRangeIni):'início'} → ${contasRangeFim?dateBR(contasRangeFim):'fim'}`
      :compDisplay(mesRef+'-01');
    const hasExtraFiltros=filterStatuses.size||filterCats.size||filterContas.size||filterVencIni||filterVencFim||filterPgtoIni||filterPgtoFim||filterBusca||contasCardFilter;
    tb.innerHTML=`<tr><td colspan="${ncols}" class="empty-row"><div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0"><span style="opacity:.3;color:var(--tx3)">${appIcon('clipboard','app-icon')}</span><span style="font-size:14px;color:var(--tx2);text-align:center">${hasExtraFiltros?'Nenhum lançamento corresponde aos filtros selecionados.':`Nenhum lançamento encontrado para <strong>${_periodoNome}</strong>.`}</span>${hasExtraFiltros?`<button type="button" style="font-size:12px;color:var(--brand-dark);background:none;border:none;cursor:pointer;text-decoration:underline" onclick="clearAllContasFiltros()">Limpar filtros</button>`:''}</div></td></tr>`;
    renderContasFooter([],tipo);onLanCheck();return;
  }
  tb.innerHTML=filtered.map(l=>renderContasRow(l,'')).join('');
  renderContasFooter(filtered,tipo);
  onLanCheck();
  renderSaldoCards();
}

function renderSaldoCards(){
  const el=document.getElementById('saldo-cards');
  if(!el||!CONTAS_DATA.length)return;
  const cards=calcContaCards(false);
  el.innerHTML=`<div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px 18px">
  <div style="font-size:11px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Saldo por Conta</div>
  <div style="display:flex;gap:8px">
    ${cards.map(c=>`<div style="flex:1;background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:8px 12px">
      <div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome)}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:2px">
        <span style="font-size:10px;color:var(--tx3)">Atual</span>
        <span style="font-size:12px;font-weight:700;color:${c.atual>=0?'var(--teal)':'var(--red)'};white-space:nowrap">${fmt(c.atual)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px">
        <span style="font-size:10px;color:var(--tx3)">Projetado</span>
        <span style="font-size:11px;font-weight:600;color:${c.projetado>=0?'var(--teal)':'var(--red)'};white-space:nowrap">${fmt(c.projetado)}</span>
      </div>
    </div>`).join('')}
  </div></div>`;
}

function renderLancamentos(c){
  currentTipoFilter='';_contasVisCols=null;
  const compsDisp=[...new Set(DATA.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...CONTAS].filter(Boolean).sort();
  const selectedTypesForCat=[...filterTipos].filter(t=>t!=='T');
  const catsDisp=selectedTypesForCat.length>0?selectedTypesForCat.flatMap(t=>CATS_DATA[t]||[]):[...(CATS_DATA.R||[]),...(CATS_DATA.D||[])];
  const catObj=filterCats.size===1?catsDisp.find(cat=>cat.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  const anyAdv=filterTipos.size||filterStatuses.size||filterComps.size||filterContas.size||filterCats.size||filterSub||filterPgtoIni||filterPgtoFim;
  c.innerHTML=`<div class="tbl-wrap"><div style="padding:14px 18px 0"><div class="toolbar"><div class="filters">
    ${multiDrop('lan-tipo','Tipo',[{v:'R',l:'Receitas'},{v:'D',l:'Despesas'},{v:'T',l:'Transferências'}],filterTipos,'onLanTipoFilter')}
    ${multiDrop('lan-status','Status',FILTER_STATUS.map(s=>({v:s.value,l:s.label})),filterStatuses,'onLanStatusFilter')}
    <button class="btn ${filterStatuses.has('Pendente')?'btn-pri':'btn-ghost'}" style="font-size:12px;padding:5px 10px;white-space:nowrap" onclick="if(filterStatuses.has('Pendente'))filterStatuses.delete('Pendente');else filterStatuses.add('Pendente');filterLanTbody();_refreshMsdBtn('lan-status',filterStatuses);_refreshAnyAdv()">⏳ Pendentes</button>
    <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
      <span style="font-size:11px;color:var(--tx2);white-space:nowrap">Pgto</span>
      <input id="lan-pgto-ini" type="date" value="${filterPgtoIni}" style="background:var(--s2);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:4px 7px;font-size:12px;outline:none;color-scheme:dark;width:136px" onblur="if(event.relatedTarget?.id==='lan-pgto-fim'){filterPgtoIni=this.value;}else{filterPgtoIni=this.value;applyLanFilter();}" onchange="filterPgtoIni=this.value"/>
      <span style="font-size:11px;color:var(--tx2)">até</span>
      <input id="lan-pgto-fim" type="date" value="${filterPgtoFim}" style="background:var(--s2);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:4px 7px;font-size:12px;outline:none;color-scheme:dark;width:136px" onblur="filterPgtoFim=this.value;applyLanFilter();" onchange="filterPgtoFim=this.value"/>
    </div>
    ${multiDrop('lan-comp','Competência',compsDisp.map(v=>({v,l:compToView(v)})),filterComps,'onLanCompFilter')}
    ${multiDrop('lan-conta','Conta',contasDisp.map(ct=>({v:ct,l:ct})),filterContas,'onLanContaFilter')}
    ${multiDrop('lan-cat','Categoria',catsDisp.map(cat=>({v:cat.nome,l:cat.nome})),filterCats,'onLanCatFilter')}
    ${subsDisp.length?`<div class="fg"><select onchange="filterSub=this.value;applyLanFilter()">
      <option value="">Subcategoria</option>
      ${subsDisp.map(s=>`<option value="${esc(s.nome)}"${filterSub===s.nome?' selected':''}>${esc(s.nome)}</option>`).join('')}
    </select></div>`:''}
    <button class="btn btn-ghost lan-limpar-btn" style="font-size:12px;padding:5px 10px;white-space:nowrap;display:none" onclick="filterTipos=new Set();clearAllContasFiltros();applyLanFilter()">✕ Limpar</button>
    <input class="sinp" placeholder="Buscar..." value="${esc(filterBusca)}" oninput="filterBusca=this.value;filterLanTbody()"/>
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <label style="display:flex;align-items:center;gap:6px;color:var(--tx2);font-size:12px;cursor:pointer">
      <input type="checkbox" class="lan-chk" id="lan-sel-all" onchange="toggleSelectAllLan(this.checked)"/>
      Selecionar visíveis
    </label>
    <button class="btn btn-ghost" id="lan-del-btn" style="display:none;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteSelectedLancamentos()">${appIcon('trash')}Excluir selecionados</button>
    <button class="btn btn-ghost" id="lan-clear-btn" style="display:none;font-size:12px" onclick="clearLanSelection()">✕ Limpar seleção</button>
    <span id="lan-count" style="font-size:12px;color:var(--tx2)"></span>
    <span id="lan-sel-total" class="cbadge" style="display:none"></span>
    <div id="filtros-chips-inline" style="display:${anyAdv?'flex':'none'};flex-wrap:wrap;gap:6px;align-items:center">${_renderInlineFiltroChips()}</div>
    <button class="btn btn-ghost btn-export-soft" style="margin-left:auto" onclick="exportLancamentosExcel()">${appIcon('download')}Exportar</button>
  </div>
  <div id="lan-bulk-edit" style="display:none;margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:10px;background:var(--s2)">
    <div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap">
      <div style="min-width:150px">
        <div class="fl">Vencimento</div>
        <input type="date" id="lan-bulk-venc" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none;color-scheme:dark"/>
      </div>
      <div style="min-width:150px">
        <div class="fl">Pagamento / Recebimento</div>
        <input type="date" id="lan-bulk-data" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none;color-scheme:dark"/>
      </div>
      <div style="min-width:120px">
        <div class="fl">Competência</div>
        <input type="text" id="lan-bulk-comp" placeholder="MM/AAAA" maxlength="7" oninput="this.value=formatCompInput(this.value)" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none"/>
      </div>
      <div style="min-width:180px">
        <div class="fl">Conta</div>
        <select id="lan-bulk-conta" style="width:100%"><option value="">Manter conta</option>${CONTAS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
      </div>
      <div style="min-width:150px">
        <div class="fl">Status</div>
        <select id="lan-bulk-status" style="width:100%"><option value="">Manter status</option><option value="__QUITAR__">Recebido/Pago conforme tipo</option>${STATUS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
      </div>
      <button class="btn btn-pri" id="lan-bulk-apply" onclick="applyBulkEditSelectedLancamentos()" style="font-size:12px">✓ Aplicar alterações</button>
    </div>
  </div></div></div>
  <div class="tbl-scroll lan-scroll"><table class="lan-tbl resizable">${renderLanColgroup()}<thead><tr>
    ${LAN_COLS.map(renderLanHeadCell).join('')}
  </tr></thead><tbody id="lan-tbody"></tbody></table></div></div>
  <div id="saldo-cards" style="margin-top:12px"></div>`;

  filterLanTbody();
  if(lanColWidthsIsDefault)requestAnimationFrame(fitLanColsToContainer);
  else requestAnimationFrame(applyLanColWidthsToDOM);
}

function sortPendentes(col){
  if(sortPend.col===col)sortPend.dir=sortPend.dir==='asc'?'desc':'asc';
  else{sortPend.col=col;sortPend.dir='asc';}
  renderPendentes(document.getElementById('content'));
}

function onLanCheck(){
  const allBoxes=[...document.querySelectorAll('.lan-chk')];
  allBoxes.forEach(c=>{
    if(c.checked)selectedLanIds.add(c.value);
    else selectedLanIds.delete(c.value);
  });
  const btn=document.getElementById('lan-del-btn');
  const bulkBar=document.getElementById('lan-bulk-edit');
  const countEl=document.getElementById('lan-count');
  const totalEl=document.getElementById('lan-sel-total');
  const selAll=document.getElementById('lan-sel-all');
  const selectedItems=[...selectedLanIds].map(id=>DATA.find(l=>l.id===id)).filter(Boolean);
  const clearBtn=document.getElementById('lan-clear-btn');
  if(btn)btn.style.display=selectedLanIds.size>0?'inline-flex':'none';
  if(clearBtn)clearBtn.style.display=selectedLanIds.size>0?'inline-flex':'none';
  if(bulkBar)bulkBar.style.display=selectedLanIds.size>0?'block':'none';
  if(countEl)countEl.textContent=selectedLanIds.size>0?`${selectedLanIds.size} selecionado(s)`:'';
  if(totalEl){
    const total=selectedItems.reduce((s,item)=>{
      const valor=titleAmount(item);
      return s+(item.tipo==='D'?-valor:valor);
    },0);
    totalEl.style.display=selectedLanIds.size>0?'inline-block':'none';
    totalEl.textContent=`Total selecionado: ${fmt(total)}`;
    totalEl.style.color=total<0?'var(--red)':'var(--teal)';
    totalEl.style.borderColor=total<0?'rgba(248,81,73,.25)':'rgba(57,211,83,.25)';
    totalEl.style.background=total<0?'rgba(248,81,73,.08)':'rgba(57,211,83,.08)';
  }
  if(selAll)selAll.checked=allBoxes.length>0 && allBoxes.every(c=>selectedLanIds.has(c.value));
}

function toggleSelectAllLan(checked){
  const boxes=[...document.querySelectorAll('.lan-chk')];
  boxes.forEach(c=>c.checked=checked);
  boxes.forEach(c=>{
    if(checked)selectedLanIds.add(c.value);
    else selectedLanIds.delete(c.value);
  });
  onLanCheck();
}

function clearLanSelection(){
  selectedLanIds.clear();
  document.querySelectorAll('.lan-chk').forEach(c=>c.checked=false);
  onLanCheck();
}

async function salvarTipoConta(id,tipo){
  try{
    await sbFetch('PATCH',`contas?id=eq.${id}`,{tipo});
    const conta=CONTAS_DATA.find(c=>c.id===id);
    if(conta)conta.tipo=tipo;
    toast(`Tipo atualizado para "${tipo==='investimento'?'Investimento':'Corrente'}"!`,'ok');
    render();
  }catch(e){toast('Erro: '+e.message,'err');}
}

async function salvarSaldoIni(id,inputVal){
  const v=parseMoney(inputVal.trim());
  const saldo=(!inputVal.trim()||!Number.isFinite(v))?0:v;
  try{
    await sbFetch('PATCH',`contas?id=eq.${id}`,{saldo_inicial:saldo});
    const conta=CONTAS_DATA.find(c=>c.id===id);
    if(conta){conta.saldo_inicial=saldo;toast(`Saldo inicial de "${conta.nome}" salvo!`,'ok');}
    if(TAB==='receber'||TAB==='pagar'||TAB==='lancamentos')renderSaldoCards();
  }catch(e){toast('Erro ao salvar: '+e.message,'err');}
}

async function deleteSelectedLancamentos(){
  const ids=[...selectedLanIds];
  const expandedIds=new Set();
  ids.map(id=>DATA.find(l=>l.id===id)).filter(Boolean).forEach(item=>getRelatedDeleteIds(item).forEach(x=>expandedIds.add(x)));
  if(expandedIds.size){
    const delItems=DATA.filter(l=>expandedIds.has(l.id));
    const delErr=canDeleteLancamentos(delItems);
    if(delErr){toast(delErr,'err');return;}
    ids.splice(0,ids.length,...expandedIds);
  }
  if(!ids.length){toast('Selecione pelo menos um lançamento','err');return;}
  if(!confirm(`Excluir ${ids.length} lançamento(s) selecionados? Esta ação não pode ser desfeita.`))return;
  setSyncStatus('loading',`Excluindo ${ids.length} lançamento(s)...`);
  let ok=0,err=0;
  for(const id of ids){
    try{await dbDelete(id);DATA=DATA.filter(l=>l.id!==id);BAIXAS_DATA=BAIXAS_DATA.filter(b=>b.lancamentoId!==id);ok++;}
    catch(e){err++;console.error(e);}
  }
  selectedLanIds.clear();
  setSyncStatus('ok',`${DATA.length} registros`);
  buildNav();renderKeepScroll();
  toast(`✓ ${ok} excluído(s)${err?` — ${err} erro(s)`:''}`,'err');
}

async function applyBulkEditSelectedLancamentos(){
  const ids=[...selectedLanIds];
  if(!ids.length){toast('Selecione pelo menos um lançamento','err');return;}

  const dataVenc=document.getElementById('lan-bulk-venc')?.value||'';
  const dataPgto=document.getElementById('lan-bulk-data')?.value||'';
  const compRaw=document.getElementById('lan-bulk-comp')?.value||'';
  const contaRaw=document.getElementById('lan-bulk-conta')?.value||'';
  const statusRaw=document.getElementById('lan-bulk-status')?.value||'';
  const dataComp=compRaw?compFromView(compRaw):'';
  const conta=contaRaw?normalizeConta(contaRaw):'';
  const items=DATA.filter(l=>ids.includes(l.id));

  if(compRaw&&!dataComp){toast('Competência inválida. Use MM/AAAA.','err');return;}
  if(contaRaw&&(!conta||!CONTAS.includes(conta))){toast('Selecione uma conta cadastrada.','err');return;}
  if(statusRaw&&statusRaw!=='__QUITAR__'&&!STATUS.includes(statusRaw)){toast('Status inválido.','err');return;}
  if(statusRaw==='Recebido'&&items.some(l=>l.tipo==='D')){toast('Use "Recebido/Pago conforme tipo" para seleções com despesas.','err');return;}
  if(statusRaw==='Pago'&&items.some(l=>l.tipo==='R')){toast('Use "Recebido/Pago conforme tipo" para seleções com receitas.','err');return;}
  if(!dataVenc&&!dataPgto&&!dataComp&&!conta&&!statusRaw){toast('Informe pelo menos uma alteração para aplicar.','err');return;}

  for(const item of items){
    if(isTransfer(item)){toast('Transferencias nao podem ser editadas em lote. Exclua e recrie a transferencia para corrigir.','err');return;}
    const next={...item};
    if(dataVenc)next.dataVenc=dataVenc;
    if(dataPgto)next.dataPgto=dataPgto;
    if(dataComp)next.dataComp=dataComp;
    if(conta)next.conta=conta;
    if(statusRaw)next.status=statusRaw==='__QUITAR__'?expectedRealizedStatus(item.tipo):statusRaw;
    const validation=validateLancamentoCore(next);
    if(validation.errors.length){toast(firstValidationError(validation),'err');return;}
    if(!confirmValidationWarnings(validation))return;
  }

  const resumo=[];
  if(dataVenc)resumo.push(`vencimento ${dataVenc}`);
  if(dataPgto)resumo.push(`data ${dataPgto}`);
  if(dataComp)resumo.push(`competência ${compToView(dataComp)}`);
  if(conta)resumo.push(`conta ${conta}`);
  if(statusRaw)resumo.push(`status ${statusRaw==='__QUITAR__'?'Recebido/Pago conforme tipo':statusRaw}`);
  if(!confirm(`Aplicar em ${items.length} lançamento(s)?\n${resumo.join('\n')}`))return;

  const btn=document.getElementById('lan-bulk-apply');
  if(btn){btn.disabled=true;btn.textContent='Aplicando...';}
  setSyncStatus('loading',`Atualizando ${items.length}...`);
  let ok=0,err=0;
  for(const item of items){
    const patch={};
    if(dataVenc)patch.data_venc=dataVenc;
    if(dataPgto)patch.data_pgto=dataPgto;
    if(dataComp)patch.data_comp=dataComp;
    if(conta)patch.conta=conta;
    if(statusRaw&&statusRaw!=='__QUITAR__')patch.status=statusRaw;
    try{
      if(Object.keys(patch).length)await sbFetch('PATCH',`${TABLE}?id=eq.${item.id}`,patch);
      const idx=DATA.findIndex(l=>l.id===item.id);
      if(idx>=0){
        if(dataVenc)DATA[idx].dataVenc=dataVenc;
        if(dataPgto)DATA[idx].dataPgto=dataPgto;
        if(dataComp)DATA[idx].dataComp=dataComp;
        if(conta)DATA[idx].conta=conta;
        if(patch.status)DATA[idx].status=patch.status;
        if(statusRaw==='__QUITAR__')await registerBaixa(DATA[idx],{valor:openAmount(DATA[idx]),dataPgto,conta:conta||DATA[idx].conta,forma:DATA[idx].forma,origem:'manual',obs:'Baixa em lote'});
      }
      ok++;
    }catch(e){err++;console.error(e);}
  }
  if(btn){btn.disabled=false;btn.textContent='✓ Aplicar alterações';}
  selectedLanIds.clear();
  setSyncStatus(err?'err':'ok',err?`${err} erro(s)`:`${DATA.length} registros`);
  buildNav();renderKeepScroll();
  toast(`✓ ${ok} lançamento(s) atualizado(s)${err?` — ${err} erro(s)`:''}` ,err?'err':'ok');
}

function renderPendentes(c){
  const allPend=DATA.filter(l=>openAmount(l)>0.005&&l.tipo==='D');
  const totDesp=allPend.reduce((s,l)=>s+openAmount(l),0);
  const hoje=new Date().toISOString().split('T')[0];

  let pend=allPend;
  if(filterPendBusca){const b=filterPendBusca.toLowerCase();pend=pend.filter(l=>`${l.desc} ${l.cat} ${l.sub} ${effectiveVenc(l)}`.toLowerCase().includes(b));}
  pend=sortData(pend,sortPend.col,sortPend.dir);

  if(!allPend.length){
    c.innerHTML=`<div style="text-align:center;padding:60px;color:var(--tx3)"><div style="font-size:48px">🎉</div><div style="margin-top:12px;font-size:15px">Nenhuma conta pendente!</div></div>`;
    return;
  }

  c.innerHTML=`
    <div style="margin-bottom:16px">
      <div class="kpi k-red" style="max-width:320px"><div class="kpi-lbl">A Pagar</div><div class="kpi-val">${fmt(totDesp)}</div><div class="kpi-sub">${allPend.length} lançamento(s)</div></div>
    </div>

    <div class="card" style="margin-bottom:14px" id="lote-bar">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="sel-all" onchange="toggleSelectAll(this.checked)" style="width:16px;height:16px;cursor:pointer"/>
          <span style="font-size:13px;color:var(--tx2)">Selecionar todos</span>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <span style="font-size:12px;color:var(--tx2);margin-right:6px">Data de pagamento:</span>
            <input type="date" id="lote-data" value="${hoje}" style="background:var(--s2);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 10px;font-size:13px;outline:none"/>
          </div>
          <button class="btn btn-pri" id="lote-btn" onclick="baixarEmLote()" style="display:none">✓ Baixar selecionados</button>
          <button class="btn" id="lote-del-btn" onclick="deletarEmLote()" style="display:none;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2);font-size:12px">${appIcon('trash')}Excluir selecionados</button>
          <span id="lote-count" style="font-size:12px;color:var(--tx2)"></span>
        </div>
      </div>
    </div>

    <div class="tbl-wrap">
      <div style="padding:10px 18px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" placeholder="Buscar descrição, categoria..." value="${esc(filterPendBusca)}"
          oninput="filterPendBusca=this.value;renderPendentes(document.getElementById('content'))"
          style="background:var(--s2);border:1px solid var(--bd2);color:var(--tx);border-radius:8px;padding:6px 12px;font-size:13px;width:260px"/>
        ${filterPendBusca?`<button class="btn btn-ghost" style="font-size:12px" onclick="filterPendBusca='';renderPendentes(document.getElementById('content'))">✕ Limpar</button>`:''}
        <span style="font-size:12px;color:var(--tx3);margin-left:auto">${pend.length} de ${allPend.length} registro(s)</span>
      </div>
      <div class="tbl-scroll"><table class="lan-tbl pend-tbl resizable">${renderPendColgroup()}
        <thead><tr>${PEND_COLS.map(renderPendHeadCell).join('')}</tr></thead>
        <tbody>
          ${pend.length===0?`<tr><td colspan="${PEND_COLS.length}" style="text-align:center;padding:24px;color:var(--tx3)">Nenhum resultado para o filtro aplicado</td></tr>`:
          pend.map(l=>`
            <tr class="lr" id="prow-${l.id}">
              <td><input type="checkbox" class="pend-chk" value="${l.id}" onchange="onPendCheck()" style="width:15px;height:15px;cursor:pointer"/></td>
              <td onclick="openEdit('${l.id}')">${effectiveVenc(l)||'—'}</td>
              <td onclick="openEdit('${l.id}')">${compToView(l.dataComp)||'—'}</td>
              <td onclick="openEdit('${l.id}')"><span class="tp ${l.tipo==='R'?'r':'d'}">${l.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`}</span></td>
              <td onclick="openEdit('${l.id}')"><span class="ct">${esc(l.cat)}</span></td>
              <td onclick="openEdit('${l.id}')"><span class="cs">${esc(l.sub||'—')}</span></td>
              <td class="dc" onclick="openEdit('${l.id}')">${esc(l.desc||'—')}</td>
              <td class="vc ${l.tipo==='R'?'r':'d'}" onclick="openEdit('${l.id}')">${fmt(openAmount(l))}</td>
              <td><span onclick="toggleStatus('${l.id}')" style="cursor:pointer" title="Clique para registrar baixa">${badge(computedStatus(l))}</span></td>
              <td style="white-space:nowrap">
                <button class="btn btn-ghost" title="Editar" style="padding:4px 8px;font-size:12px" onclick="openEdit('${l.id}')">${appIcon('edit')}</button>
                <button class="btn" title="Excluir" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${l.id}')">${appIcon('trash')}</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
}

function onPendCheck(){
  const chks=[...document.querySelectorAll('.pend-chk:checked')];
  const btn=document.getElementById('lote-btn');
  const delBtn=document.getElementById('lote-del-btn');
  const cnt=document.getElementById('lote-count');
  const selAll=document.getElementById('sel-all');
  const total=document.querySelectorAll('.pend-chk').length;
  if(btn){btn.style.display=chks.length>0?'inline-flex':'none';}
  if(delBtn){delBtn.style.display=chks.length>0?'inline-flex':'none';}
  if(cnt){
    if(chks.length>0){
      const ids=chks.map(c=>c.value);
      const items=DATA.filter(l=>ids.includes(l.id));
      const tot=items.reduce((s,l)=>s+openAmount(l),0);
      cnt.textContent=`${chks.length} selecionado(s) — ${fmt(tot)}`;
    } else {cnt.textContent='';}
  }
  if(selAll)selAll.checked=chks.length===total&&total>0;
}

function toggleSelectAll(checked){
  document.querySelectorAll('.pend-chk').forEach(c=>{c.checked=checked;});
  onPendCheck();
}

function selecionarTipo(tipo){
  const pend=DATA.filter(l=>openAmount(l)>0.005);
  document.querySelectorAll('.pend-chk').forEach(c=>{
    const item=pend.find(l=>l.id===c.value);
    c.checked=item&&item.tipo===tipo;
  });
  onPendCheck();
}

async function baixarEmLote(){
  const chks=[...document.querySelectorAll('.pend-chk:checked')];
  if(!chks.length){toast('Selecione pelo menos um lançamento','err');return;}
  const data=document.getElementById('lote-data').value;
  if(!data){toast('Informe a data de pagamento/recebimento','err');return;}
  const ids=chks.map(c=>c.value);
  const items=DATA.filter(l=>ids.includes(l.id));
  const pgClosed=assertOpenPeriod(data,'Data de pagamento');
  if(pgClosed){toast(pgClosed,'err');return;}
  for(const item of items){
    const next={...item,status:expectedRealizedStatus(item.tipo),dataPgto:data};
    const validation=validateLancamentoCore(next);
    if(validation.errors.length){toast(firstValidationError(validation),'err');return;}
  }
  const tot=items.reduce((s,l)=>s+openAmount(l),0);
  if(!confirm(`Baixar ${items.length} lançamento(s) totalizando ${fmt(tot)}?\nData: ${data}`))return;

  setSyncStatus('loading',`Baixando ${items.length}...`);
  let ok=0,err=0;
  for(const item of items){
    try{
      await registerBaixa(item,{valor:openAmount(item),dataPgto:data,conta:item.conta,forma:item.forma,origem:'manual',obs:'Baixa em lote'});
      ok++;
    }catch(e){err++;console.error(e);}
  }
  setSyncStatus('ok',`${DATA.length} registros`);
  buildNav();renderKeepScroll();
  toast(`✓ ${ok} baixado(s)${err?` — ${err} erro(s)`:''}!`,'ok');
}

async function deletarEmLote(){
  const chks=[...document.querySelectorAll('.pend-chk:checked')];
  if(!chks.length){toast('Selecione pelo menos um lançamento','err');return;}
  const ids=chks.map(c=>c.value);
  const items=DATA.filter(l=>ids.includes(l.id));
  const tot=items.reduce((s,l)=>s+titleAmount(l),0);
  if(!confirm(`Excluir ${items.length} lançamento(s) pendente(s) totalizando ${fmt(tot)}?`))return;

  setSyncStatus('loading',`Excluindo ${items.length}...`);
  let ok=0,err=0;
  for(const item of items){
    try{
      await dbDelete(item.id);
      ok++;
    }catch(e){err++;console.error(e);}
  }
  DATA=DATA.filter(l=>!ids.includes(l.id));
  BAIXAS_DATA=BAIXAS_DATA.filter(b=>!ids.includes(b.lancamentoId));
  setSyncStatus('ok',`${DATA.length} registros`);
  buildNav();renderKeepScroll();
  toast(`✓ ${ok} excluído(s)${err?` — ${err} erro(s)`:''}!`,'err');
}

// ── Contas a Receber / Contas a Pagar ────────────────────────────────

let contasCardFilter=null;
let contasMesSel='';
let contasRangeMode=false,contasRangeIni='',contasRangeFim='';
function _resetContasFilters(){
  filterStatuses=new Set();filterCats=new Set();filterContas=new Set();filterComps=new Set();
  filterSub='';filterBusca='';filterVencIni='';filterVencFim='';filterPgtoIni='';filterPgtoFim='';
}
function renderReceber(c){
  const _switching=currentTipoFilter!=='R';
  currentTipoFilter='R';filterTipos=new Set();contasCardFilter=null;
  if(_switching){contasRangeMode=false;contasRangeIni='';contasRangeFim='';_resetContasFilters();}
  try{const s=localStorage.getItem('skala_receber_mes');contasMesSel=s!==null?s:'';}catch(e){contasMesSel='';}
  try{
    const _rf=JSON.parse(localStorage.getItem('skala_receber_filtro')||'null');
    if(_rf){localStorage.removeItem('skala_receber_filtro');_resetContasFilters();if(_rf.status)filterStatuses=new Set([_rf.status]);}
  }catch(e){}
  renderContasTipo(c,'R');
}
function renderPagar(c){
  const _switching=currentTipoFilter!=='D';
  currentTipoFilter='D';filterTipos=new Set();contasCardFilter=null;
  if(_switching){contasRangeMode=false;contasRangeIni='';contasRangeFim='';_resetContasFilters();}
  try{
    const _pf=JSON.parse(localStorage.getItem('skala_pagar_filtro')||'null');
    if(_pf){localStorage.removeItem('skala_pagar_filtro');_resetContasFilters();if(_pf.status)filterStatuses=new Set([_pf.status]);if(_pf.vencidos)contasCardFilter='atrasados';}
  }catch(e){}
  renderContasTipo(c,'D');
}

function renderContasTipo(c,tipo){
  const isR=tipo==='R';
  const hoje=new Date().toISOString().split('T')[0];
  const mesAtual=hoje.slice(0,7);
  const mesRef=contasMesSel||mesAtual;
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));

  const pendentes=tipoData.filter(l=>openAmount(l)>0.005);
  const totalPend=pendentes.reduce((s,l)=>s+openAmount(l),0);
  const atrasadas=pendentes.filter(l=>effectiveVenc(l)&&effectiveVenc(l)<hoje);
  const totalAtras=atrasadas.reduce((s,l)=>s+openAmount(l),0);
  const doMes=cashMovements().filter(m=>m.tipo===tipo&&!isTransfer(m)&&(m.dataPgto||'').startsWith(mesRef));
  const totalMes=doMes.reduce((s,l)=>s+parseMoney(l.valorLiq),0);

  const visCols=LAN_COLS.filter(col=>!['tipo','sub'].includes(col.id));
  _contasVisCols=visCols;
  const compsDisp=[...new Set(tipoData.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(cat=>cat.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  const anyAdv=filterStatuses.size||filterComps.size||filterContas.size||filterCats.size||filterSub||filterVencIni||filterVencFim||filterPgtoIni||filterPgtoFim;

  c.innerHTML=`
  <div id="contas-period-wrap" style="margin-bottom:12px"></div>
  <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap" id="contas-kpi-row">
    <div id="kpi-card-receber" class="kpi ${isR?'k-teal':'k-red'}${contasCardFilter==='receber'?' k-card-active':''}" style="flex:1;min-width:160px;cursor:pointer" onclick="toggleContasCardFilter('receber')">
      <div class="kpi-lbl">${isR?'A Receber':'A Pagar'}</div>
      <div class="kpi-val">${fmt(totalPend)}</div>
      <div class="kpi-sub">${pendentes.length} lançamento(s)</div>
    </div>
    <div id="kpi-card-atrasados" class="kpi k-red${contasCardFilter==='atrasados'?' k-card-active':''}" style="flex:1;min-width:160px;cursor:pointer" onclick="toggleContasCardFilter('atrasados')">
      <div class="kpi-lbl">Atrasados</div>
      <div class="kpi-val">${fmt(totalAtras)}</div>
      <div class="kpi-sub">${atrasadas.length} lançamento(s)</div>
    </div>
    <div id="kpi-card-mes" class="kpi k-feature${contasCardFilter==='mes'?' k-card-active':''}" style="flex:1;min-width:160px;cursor:pointer" onclick="toggleContasCardFilter('mes')">
      <div class="kpi-lbl" id="kpi-lbl-mes">${isR?'Recebidos':'Pagos'} em ${compDisplay(mesRef+'-01')}</div>
      <div class="kpi-val">${fmt(totalMes)}</div>
      <div class="kpi-sub">${doMes.length} lançamento(s)</div>
    </div>
  </div>
  <div style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <div style="display:flex;gap:3px;flex-wrap:wrap">
        <button id="ifl-pill-todos" class="ifl-pill${!filterStatuses.size?' ifl-pill-on':''}" onclick="setIflStatus('')">Todos</button>
        ${FILTER_STATUS.map(s=>`<button id="ifl-pill-${esc(s.value)}" class="ifl-pill${filterStatuses.has(s.value)?' ifl-pill-on':''}" onclick="setIflStatus('${esc(s.value)}')">${esc(s.label)}</button>`).join('')}
      </div>
      <input class="sinp" placeholder="Buscar..." value="${esc(filterBusca)}" oninput="filterBusca=this.value;filterLanTbody()" style="flex:1;min-width:160px;box-sizing:border-box"/>
      ${isR?`<button class="btn btn-ghost" onclick="openBaixarRelModal()" style="font-size:13px">${appIcon('upload')} Importar</button>`:''}
      <button id="filtros-toggle-btn" class="btn btn-ghost${anyAdv?' btn-ghost-active':''}" style="font-size:13px" onclick="toggleFiltrosDrop()">⚙ Filtrar${anyAdv?` <span class="flt-cnt">${_countFiltrosAtivos()}</span>`:''} ▾</button>
      <button class="btn btn-ghost btn-export-soft" onclick="exportLancamentosExcel()" style="font-size:13px">${appIcon('download')} Exportar</button>
    </div>
    <div id="contas-chips-row" style="display:${anyAdv||contasCardFilter?'flex':'none'};align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${anyAdv||contasCardFilter?_renderContasChips():''}
    </div>
  </div>
  <div class="tbl-wrap"><div style="padding:12px 18px">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
    <label style="display:flex;align-items:center;gap:6px;color:var(--tx2);font-size:12px;cursor:pointer">
      <input type="checkbox" class="lan-chk" id="lan-sel-all" onchange="toggleSelectAllLan(this.checked)"/>
      Selecionar visíveis
    </label>
    <button class="btn btn-ghost" id="lan-del-btn" style="display:none;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteSelectedLancamentos()">${appIcon('trash')}Excluir selecionados</button>
    <button class="btn btn-ghost" id="lan-clear-btn" style="display:none;font-size:12px" onclick="clearLanSelection()">✕ Limpar seleção</button>
    <span id="lan-count" style="font-size:12px;color:var(--tx2)"></span>
    <span id="lan-sel-total" class="cbadge" style="display:none"></span>
    <div id="filtros-chips-inline" style="display:none"></div>
  </div>
  <div id="lan-bulk-edit" style="display:none;margin-top:0;margin-bottom:12px;padding:12px;border:1px solid var(--bd);border-radius:10px;background:var(--s2)">
    <div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap">
      <div style="min-width:150px"><div class="fl">Vencimento</div><input type="date" id="lan-bulk-venc" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none;color-scheme:dark"/></div>
      <div style="min-width:150px"><div class="fl">${isR?'Recebimento':'Pagamento'}</div><input type="date" id="lan-bulk-data" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none;color-scheme:dark"/></div>
      <div style="min-width:120px"><div class="fl">Competência</div><input type="text" id="lan-bulk-comp" placeholder="MM/AAAA" maxlength="7" oninput="this.value=formatCompInput(this.value)" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none"/></div>
      <div style="min-width:180px"><div class="fl">Conta</div><select id="lan-bulk-conta" style="width:100%"><option value="">Manter conta</option>${CONTAS.map(ct=>`<option value="${esc(ct)}">${esc(ct)}</option>`).join('')}</select></div>
      <div style="min-width:150px"><div class="fl">Status</div><select id="lan-bulk-status" style="width:100%"><option value="">Manter status</option><option value="__QUITAR__">${isR?'Marcar como Recebido':'Marcar como Pago'}</option>${STATUS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      <button class="btn btn-pri" id="lan-bulk-apply" onclick="applyBulkEditSelectedLancamentos()" style="font-size:12px">✓ Aplicar alterações</button>
    </div>
  </div></div>
  <div class="tbl-scroll lan-scroll"><table class="lan-tbl resizable">${renderLanColgroup(visCols)}<thead><tr>
    ${visCols.map(renderLanHeadCell).join('')}
  </tr></thead><tbody id="lan-tbody"></tbody><tfoot id="contas-foot"></tfoot></table></div></div>
  ${!isR?'<div id="saldo-cards" style="margin-top:12px"></div>':''}`;

  _renderContasPeriodControl();
  if(contasRangeMode)updateContasCardValues();
  filterLanTbody();
  if(lanColWidthsIsDefault)requestAnimationFrame(()=>fitLanColsToContainer(visCols));
  else requestAnimationFrame(applyLanColWidthsToDOM);
}
