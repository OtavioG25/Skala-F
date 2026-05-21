let currentTipoFilter='';
let filterTipos=new Set(),filterStatuses=new Set(),filterBusca='',filterComps=new Set(),filterContas=new Set(),filterCats=new Set(),filterSub='',filterPgtoIni='',filterPgtoFim='';
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
let sortPend={col:'dataPgto',dir:'asc'};
let selectedLanIds = new Set();
const LAN_COL_WIDTHS_KEY='financeiro_lancamentos_col_widths';
const LAN_COLS=[
  {id:'sel',w:42,min:38},
  {id:'seq',lbl:'Nº',sort:'seq',w:58,min:46},
  {id:'tipo',lbl:'Tipo',w:84,min:70},
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
  const visCols=currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS;
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
  const visCols=currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS;
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
  {id:'dataPgto',lbl:'Vencimento',sort:'dataPgto',w:112,min:92},
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
    if(col==='valorLiq'||col==='valorBruto'||col==='valor'){va=parseMoney(va);vb=parseMoney(vb);}
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
  if(currentTipoFilter==='R')renderReceber(document.getElementById('content'));
  else if(currentTipoFilter==='D')renderPagar(document.getElementById('content'));
  else renderLancamentos(document.getElementById('content'));
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
  const any=filterTipos.size||filterStatuses.size||filterComps.size||filterContas.size||filterCats.size||filterSub||filterPgtoIni||filterPgtoFim;
  const btn=document.querySelector('.lan-limpar-btn');if(btn)btn.style.display=any?'inline-flex':'none';
}
function onLanTipoFilter(val,chk){
  if(chk)filterTipos.add(val);else filterTipos.delete(val);
  filterLanTbody();_refreshMsdBtn('lan-tipo',filterTipos);_refreshAnyAdv();
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
  if(currentTipoFilter==='R')renderReceber(document.getElementById('content'));
  else if(currentTipoFilter==='D')renderPagar(document.getElementById('content'));
  else renderLancamentos(document.getElementById('content'));
}
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
    l.dataPgto,dateSearchText(l.dataPgto)
  ].filter(Boolean).join(' ').toLowerCase();
}
function filterLanTbody(){
  let filtered=DATA.filter(l=>{
    if(currentTipoFilter){if(l.tipo!==currentTipoFilter||(l.doc||'').startsWith('TRANSF#'))return false;}
    else if(filterTipos.size){const isT=(l.doc||'').startsWith('TRANSF#');if(!filterTipos.has(isT?'T':l.tipo))return false;}
    if(filterStatuses.size){
      const match=[...filterStatuses].some(fs=>fs==='Realizado'?(l.tipo==='R'?l.status==='Recebido':l.tipo==='D'?l.status==='Pago':(l.status==='Recebido'||l.status==='Pago')):l.status===fs);
      if(!match)return false;
    }
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
  if(cb)cb.textContent=`${filtered.length} lançamentos`;
  const tb=document.getElementById('lan-tbody');
  if(!tb)return;
  const visCols=currentTipoFilter?LAN_COLS.filter(c=>c.id!=='tipo'):LAN_COLS;
  if(!filtered.length){tb.innerHTML=`<tr><td colspan="${visCols.length}" class="empty-row">Nenhum lançamento encontrado</td></tr>`;onLanCheck();return;}
  tb.innerHTML=filtered.map(l=>renderLanRow(l,!!currentTipoFilter)).join('');
  onLanCheck();
  renderSaldoCards();
}

function renderLanRow(l,skipTipo){
  const checked=selectedLanIds.has(l.id)?'checked':'';
  const isTransf=(l.doc||'').startsWith('TRANSF#');
  const tipoCls=isTransf?'t':l.tipo==='R'?'r':'d';
  const tipoLbl=isTransf?`${appIcon('transfer','app-icon tp-icon')} Transf`:l.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`;
  const tipoTd=skipTipo?'':` <td onclick="openEdit('${l.id}')"><span class="tp ${tipoCls}">${tipoLbl}</span></td>`;
  return `<tr class="lr" id="lan-row-${l.id}">
    <td><input type="checkbox" class="lan-chk" value="${l.id}" ${checked} onchange="onLanCheck()" style="width:15px;height:15px;cursor:pointer"/></td>
    <td onclick="openEdit('${l.id}')" style="color:var(--tx2);font-size:12px;text-align:center">${l.seq||'—'}</td>
    ${tipoTd}
    <td onclick="openEdit('${l.id}')">${dateBR(l.dataPgto)||'—'}</td>
    <td onclick="openEdit('${l.id}')">${compDisplay(l.dataComp)||'—'}</td>
    <td title="${esc(l.cat)}" onclick="openEdit('${l.id}')"><span class="ct">${esc(l.cat)}</span></td>
    <td class="dc" title="${esc(l.sub||'')}" onclick="openEdit('${l.id}')">${esc(l.sub||'—')}</td>
    <td class="dc" title="${esc(l.desc||'')}" onclick="openEdit('${l.id}')">${esc(l.desc||'—')}</td>
    <td title="${esc(l.conta||'')}" onclick="openEdit('${l.id}')">${esc(l.conta||'—')}</td>
    <td class="vc ${l.tipo==='R'?'r':'d'}" onclick="openEdit('${l.id}')">${l.status==='Parcial'?`<span title="Pago: ${fmt(l.valorLiq)} | Pendente: ${fmt(Math.max(0,parseMoney(l.valorBruto)-parseMoney(l.valorLiq)))}">${fmt(l.valorLiq)}<span style="font-size:10px;color:#ff8c00;margin-left:3px">/ ${fmt(parseMoney(l.valorBruto))}</span></span>`:fmt(l.valorLiq)}</td>
    <td><span onclick="toggleStatus('${l.id}')" style="cursor:pointer" title="${l.status==='Parcial'?'Clique para registrar complemento':'Clique para alternar status'}">${badge(l.status)}</span></td>
    <td style="white-space:nowrap">
      ${isTransf?'':`<button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Editar" onclick="openEdit('${l.id}')">${appIcon('edit')}</button>`}
      ${isTransf?'':`<button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Duplicar" onclick="duplicarLancamento('${l.id}')">${appIcon('copy')}</button>`}
      <button class="btn" title="Excluir" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${l.id}')">${appIcon('trash')}</button>
    </td></tr>`;
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
  currentTipoFilter='';
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
    <button class="btn btn-ghost lan-limpar-btn" style="font-size:12px;padding:5px 10px;white-space:nowrap;display:${anyAdv?'inline-flex':'none'}" onclick="filterTipos=new Set();filterStatuses=new Set();filterComps=new Set();filterContas=new Set();filterCats=new Set();filterSub='';filterPgtoIni='';filterPgtoFim='';applyLanFilter()">✕ Limpar</button>
    <input class="sinp" placeholder="Buscar..." value="${esc(filterBusca)}" oninput="filterBusca=this.value;filterLanTbody()"/>
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <label style="display:flex;align-items:center;gap:6px;color:var(--tx2);font-size:12px;cursor:pointer">
      <input type="checkbox" id="lan-sel-all" onchange="toggleSelectAllLan(this.checked)" style="width:16px;height:16px;cursor:pointer" />
      Selecionar visíveis
    </label>
    <button class="btn btn-ghost" id="lan-del-btn" style="display:none;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteSelectedLancamentos()">${appIcon('trash')}Excluir selecionados</button>
    <button class="btn btn-ghost" id="lan-clear-btn" style="display:none;font-size:12px" onclick="clearLanSelection()">✕ Limpar seleção</button>
    <span id="lan-count" style="font-size:12px;color:var(--tx2)"></span>
    <span id="lan-sel-total" class="cbadge" style="display:none"></span>
    <span class="cbadge" id="count-badge"></span>
    <button class="btn btn-ghost" style="font-size:12px;margin-left:auto;white-space:nowrap" onclick="exportLancamentosExcel()">${appIcon('download')}Exportar Excel</button>
  </div>
  <div id="lan-bulk-edit" style="display:none;margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:10px;background:var(--s2)">
    <div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap">
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
      const valor=parseMoney(item.valorLiq);
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
  if(!ids.length){toast('Selecione pelo menos um lançamento','err');return;}
  if(!confirm(`Excluir ${ids.length} lançamento(s) selecionados? Esta ação não pode ser desfeita.`))return;
  setSyncStatus('loading',`Excluindo ${ids.length} lançamento(s)...`);
  let ok=0,err=0;
  for(const id of ids){
    try{await dbDelete(id);DATA=DATA.filter(l=>l.id!==id);ok++;}
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
  if(!dataPgto&&!dataComp&&!conta&&!statusRaw){toast('Informe pelo menos uma alteração para aplicar.','err');return;}

  const resumo=[];
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
    if(dataPgto)patch.data_pgto=dataPgto;
    if(dataComp)patch.data_comp=dataComp;
    if(conta)patch.conta=conta;
    if(statusRaw)patch.status=statusRaw==='__QUITAR__'?(item.tipo==='R'?'Recebido':'Pago'):statusRaw;
    try{
      await sbFetch('PATCH',`${TABLE}?id=eq.${item.id}`,patch);
      const idx=DATA.findIndex(l=>l.id===item.id);
      if(idx>=0){
        if(dataPgto)DATA[idx].dataPgto=dataPgto;
        if(dataComp)DATA[idx].dataComp=dataComp;
        if(conta)DATA[idx].conta=conta;
        if(patch.status)DATA[idx].status=patch.status;
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
  const allPend=DATA.filter(l=>l.status==='Pendente'&&l.tipo==='D');
  const totDesp=allPend.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  const hoje=new Date().toISOString().split('T')[0];

  let pend=allPend;
  if(filterPendBusca){const b=filterPendBusca.toLowerCase();pend=pend.filter(l=>`${l.desc} ${l.cat} ${l.sub}`.toLowerCase().includes(b));}
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
              <td onclick="openEdit('${l.id}')">${l.dataPgto||'—'}</td>
              <td onclick="openEdit('${l.id}')">${compToView(l.dataComp)||'—'}</td>
              <td onclick="openEdit('${l.id}')"><span class="tp ${l.tipo==='R'?'r':'d'}">${l.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`}</span></td>
              <td onclick="openEdit('${l.id}')"><span class="ct">${esc(l.cat)}</span></td>
              <td onclick="openEdit('${l.id}')"><span class="cs">${esc(l.sub||'—')}</span></td>
              <td class="dc" onclick="openEdit('${l.id}')">${esc(l.desc||'—')}</td>
              <td class="vc ${l.tipo==='R'?'r':'d'}" onclick="openEdit('${l.id}')">${fmt(l.valorLiq)}</td>
              <td><span onclick="toggleStatus('${l.id}')" style="cursor:pointer" title="Clique para alternar status">${badge(l.status)}</span></td>
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
      const tot=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
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
  const pend=DATA.filter(l=>l.status==='Pendente');
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
  const tot=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  if(!confirm(`Baixar ${items.length} lançamento(s) totalizando ${fmt(tot)}?\nData: ${data}`))return;

  setSyncStatus('loading',`Baixando ${items.length}...`);
  let ok=0,err=0;
  for(const item of items){
    const novoStatus=item.tipo==='R'?'Recebido':'Pago';
    try{
      await sbFetch('PATCH',`lancamentos?id=eq.${item.id}`,{status:novoStatus,data_pgto:data});
      const idx=DATA.findIndex(l=>l.id===item.id);
      if(idx>=0){DATA[idx].status=novoStatus;DATA[idx].dataPgto=data;}
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
  const tot=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
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
  setSyncStatus('ok',`${DATA.length} registros`);
  buildNav();renderKeepScroll();
  toast(`✓ ${ok} excluído(s)${err?` — ${err} erro(s)`:''}!`,'err');
}

// ── Contas a Receber / Contas a Pagar ────────────────────────────────

function renderReceber(c){currentTipoFilter='R';filterTipos=new Set();renderContasTipo(c,'R');}
function renderPagar(c){currentTipoFilter='D';filterTipos=new Set();renderContasTipo(c,'D');}

function renderContasTipo(c,tipo){
  const isR=tipo==='R';
  const hoje=new Date().toISOString().split('T')[0];
  const mesAtual=hoje.slice(0,7);
  const tipoData=DATA.filter(l=>l.tipo===tipo&&!(l.doc||'').startsWith('TRANSF#'));

  const pendentes=tipoData.filter(l=>l.status==='Pendente'||l.status==='Parcial');
  const totalPend=pendentes.reduce((s,l)=>{
    if(l.status==='Parcial')return s+Math.max(0,parseMoney(l.valorBruto)-parseMoney(l.valorLiq));
    return s+parseMoney(l.valorLiq);
  },0);
  const atrasadas=pendentes.filter(l=>l.dataPgto&&l.dataPgto<hoje);
  const totalAtras=atrasadas.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  const doMes=tipoData.filter(l=>l.status===(isR?'Recebido':'Pago')&&(l.dataPgto||'').startsWith(mesAtual));
  const totalMes=doMes.reduce((s,l)=>s+parseMoney(l.valorLiq),0);

  const visCols=LAN_COLS.filter(col=>col.id!=='tipo');
  const compsDisp=[...new Set(tipoData.map(l=>l.dataComp?.slice(0,7)).filter(Boolean))].sort().reverse();
  const contasDisp=[...new Set(tipoData.map(l=>l.conta).filter(Boolean))].sort();
  const catsDisp=CATS_DATA[tipo]||[];
  const catObj=filterCats.size===1?catsDisp.find(cat=>cat.nome===[...filterCats][0]):null;
  const subsDisp=catObj?(catObj.subs||[]):[];
  const anyAdv=filterStatuses.size||filterComps.size||filterContas.size||filterCats.size||filterSub||filterPgtoIni||filterPgtoFim;

  c.innerHTML=`
  <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <div class="kpi ${isR?'k-teal':'k-red'}" style="flex:1;min-width:160px">
      <div class="kpi-lbl">${isR?'A Receber':'A Pagar'}</div>
      <div class="kpi-val">${fmt(totalPend)}</div>
      <div class="kpi-sub">${pendentes.length} lançamento(s)</div>
    </div>
    <div class="kpi k-red" style="flex:1;min-width:160px">
      <div class="kpi-lbl">Atrasados</div>
      <div class="kpi-val">${fmt(totalAtras)}</div>
      <div class="kpi-sub">${atrasadas.length} lançamento(s)</div>
    </div>
    <div class="kpi k-teal" style="flex:1;min-width:160px">
      <div class="kpi-lbl">${isR?'Recebidos este mês':'Pagos este mês'}</div>
      <div class="kpi-val">${fmt(totalMes)}</div>
      <div class="kpi-sub">${doMes.length} lançamento(s)</div>
    </div>
  </div>
  <div class="tbl-wrap"><div style="padding:14px 18px 0"><div class="toolbar"><div class="filters">
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
    ${subsDisp.length?`<div class="fg"><select onchange="filterSub=this.value;applyLanFilter()"><option value="">Subcategoria</option>${subsDisp.map(s=>`<option value="${esc(s.nome)}"${filterSub===s.nome?' selected':''}>${esc(s.nome)}</option>`).join('')}</select></div>`:''}
    <button class="btn btn-ghost lan-limpar-btn" style="font-size:12px;padding:5px 10px;white-space:nowrap;display:${anyAdv?'inline-flex':'none'}" onclick="filterStatuses=new Set();filterComps=new Set();filterContas=new Set();filterCats=new Set();filterSub='';filterPgtoIni='';filterPgtoFim='';applyLanFilter()">✕ Limpar</button>
    <input class="sinp" placeholder="Buscar..." value="${esc(filterBusca)}" oninput="filterBusca=this.value;filterLanTbody()"/>
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <label style="display:flex;align-items:center;gap:6px;color:var(--tx2);font-size:12px;cursor:pointer">
      <input type="checkbox" id="lan-sel-all" onchange="toggleSelectAllLan(this.checked)" style="width:16px;height:16px;cursor:pointer"/>
      Selecionar visíveis
    </label>
    <button class="btn btn-ghost" id="lan-del-btn" style="display:none;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteSelectedLancamentos()">${appIcon('trash')}Excluir selecionados</button>
    <button class="btn btn-ghost" id="lan-clear-btn" style="display:none;font-size:12px" onclick="clearLanSelection()">✕ Limpar seleção</button>
    <span id="lan-count" style="font-size:12px;color:var(--tx2)"></span>
    <span id="lan-sel-total" class="cbadge" style="display:none"></span>
    <span class="cbadge" id="count-badge"></span>
    <button class="btn btn-ghost" style="font-size:12px;margin-left:auto;white-space:nowrap" onclick="exportLancamentosExcel()">${appIcon('download')}Exportar Excel</button>
  </div>
  <div id="lan-bulk-edit" style="display:none;margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:10px;background:var(--s2)">
    <div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap">
      <div style="min-width:150px"><div class="fl">${isR?'Recebimento':'Pagamento'}</div><input type="date" id="lan-bulk-data" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none;color-scheme:dark"/></div>
      <div style="min-width:120px"><div class="fl">Competência</div><input type="text" id="lan-bulk-comp" placeholder="MM/AAAA" maxlength="7" oninput="this.value=formatCompInput(this.value)" style="width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:12px;outline:none"/></div>
      <div style="min-width:180px"><div class="fl">Conta</div><select id="lan-bulk-conta" style="width:100%"><option value="">Manter conta</option>${CONTAS.map(ct=>`<option value="${esc(ct)}">${esc(ct)}</option>`).join('')}</select></div>
      <div style="min-width:150px"><div class="fl">Status</div><select id="lan-bulk-status" style="width:100%"><option value="">Manter status</option><option value="__QUITAR__">${isR?'Marcar como Recebido':'Marcar como Pago'}</option>${STATUS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      <button class="btn btn-pri" id="lan-bulk-apply" onclick="applyBulkEditSelectedLancamentos()" style="font-size:12px">✓ Aplicar alterações</button>
    </div>
  </div></div></div>
  <div class="tbl-scroll lan-scroll"><table class="lan-tbl resizable">${renderLanColgroup(visCols)}<thead><tr>
    ${visCols.map(renderLanHeadCell).join('')}
  </tr></thead><tbody id="lan-tbody"></tbody></table></div></div>
  <div id="saldo-cards" style="margin-top:12px"></div>`;

  filterLanTbody();
  if(lanColWidthsIsDefault)requestAnimationFrame(()=>fitLanColsToContainer(visCols));
  else requestAnimationFrame(applyLanColWidthsToDOM);
}
