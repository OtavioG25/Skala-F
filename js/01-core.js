(function clearOldAppCache(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(function(registrations){
        registrations.forEach(function(registration){
          registration.unregister();
        });
      })
      .catch(function(error){
        console.warn('Nao foi possivel remover service workers antigos:', error);
      });
  }

  if ('caches' in window) {
    caches.keys()
      .then(function(keys){
        keys.forEach(function(key){
          caches.delete(key);
        });
      })
      .catch(function(error){
        console.warn('Nao foi possivel limpar o Cache Storage:', error);
      });
  }
})();

const APP_ICON_PATHS = {
  dashboard:'<rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/>',
  list:'<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  chart:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/><path d="M14 7h5v5"/>',
  wallet:'<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M17 12h4"/><path d="M17 12a2 2 0 0 0 0 4h4"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z"/>',
  tools:'<path d="M14.7 6.3a4.2 4.2 0 0 0-5 5L3.6 17.4a2 2 0 1 0 3 3l6.1-6.1a4.2 4.2 0 0 0 5-5l-2.6 2.6-3-3Z"/><path d="m15 5 4 4"/>',
  chevronRight:'<path d="m9 18 6-6-6-6"/>',
  bank:'<path d="m3 10 9-7 9 7"/><path d="M5 10h14"/><path d="M6 10v8"/><path d="M10 10v8"/><path d="M14 10v8"/><path d="M18 10v8"/><path d="M4 18h16"/><path d="M3 21h18"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>',
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  transfer:'<path d="M7 7h14"/><path d="m17 3 4 4-4 4"/><path d="M17 17H3"/><path d="m7 13-4 4 4 4"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  arrowUp:'<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>',
  arrowDown:'<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  grip:'<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  clipboard:'<rect width="16" height="18" x="4" y="4" rx="2"/><path d="M9 2h6v4H9z"/><path d="M8 12h8"/><path d="M8 16h6"/>',
  calendar:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  close:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trendingUp:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  trendingDown:'<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  activity:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  print:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>'
};
function appIcon(name, className='app-icon'){
  const path=APP_ICON_PATHS[name]||APP_ICON_PATHS.file;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}
function hydrateAppIcons(root=document){
  root.querySelectorAll('[data-app-icon]').forEach(el=>{
    el.innerHTML=appIcon(el.dataset.appIcon, el.className||'app-icon');
    el.removeAttribute('data-app-icon');
  });
}

let _cfmResolve=null;
function _cfmClose(ok){
  const ov=document.getElementById('confirm-overlay');
  if(ov)ov.style.display='none';
  if(_cfmResolve){_cfmResolve(ok);_cfmResolve=null;}
}
function openConfirmModal(msg,opts={}){
  return new Promise(resolve=>{
    _cfmResolve=resolve;
    const ov=document.getElementById('confirm-overlay');
    const body=document.getElementById('confirm-body');
    const title=document.getElementById('confirm-title');
    const okBtn=document.getElementById('confirm-ok-btn');
    const cancelBtn=document.getElementById('confirm-cancel-btn');
    if(body)body.innerHTML=String(msg||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    if(title)title.textContent=opts.title||'Confirmar';
    if(okBtn){
      okBtn.textContent=opts.confirmLabel||'Confirmar';
      okBtn.className='btn';
      okBtn.style.cssText=opts.danger?'background:var(--red);color:#fff;border:1px solid rgba(217,74,56,.4)':'background:var(--brand);color:#fff;border:1px solid var(--brand)';
    }
    if(cancelBtn)cancelBtn.textContent=opts.cancelLabel||'Cancelar';
    if(ov)ov.style.display='flex';
  });
}

const APP_VERSION = 'v2.5.162';
const APP_DATE = '2026-05-29';

// Preenche versão na tela
document.addEventListener('DOMContentLoaded',()=>{
  hydrateAppIcons();
  const verEl=document.getElementById('app-ver');
  if(verEl) verEl.textContent=APP_VERSION;
  startApp();
});

window.addEventListener('popstate',e=>{
  TAB=e.state?.tab||tabFromPath();
  buildNav();render();updateTitle();
});

let _lanResizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(_lanResizeTimer);
  _lanResizeTimer=setTimeout(()=>{if(TAB==='receber'||TAB==='pagar'||TAB==='lancamentos')fitLanColsToContainer();},150);
});



// SUPABASE_URL, SUPABASE_KEY e TABLE são definidos em js/00-config.js

const sbFetch=async(method,path,body=null,extraHeaders={})=>{
  const token=localStorage.getItem('sb_token')||SUPABASE_KEY;
  const opts={method,headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json','Prefer':'return=representation',...extraHeaders}};
  if(body)opts.body=JSON.stringify(body);
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,opts);
  if(!r.ok){const err=await r.json().catch(()=>({message:r.statusText}));throw new Error(err.message||r.statusText);}
  const txt=await r.text();return txt?JSON.parse(txt):null;
};

async function dbLoad(){
  const PAGE=1000;let all=[],offset=0,chunk;
  do{
    chunk=await sbFetch('GET',`${TABLE}?order=created_at.desc&select=*&limit=${PAGE}&offset=${offset}`);
    if(!chunk||!chunk.length)break;
    all=all.concat(chunk);offset+=PAGE;
  }while(chunk.length===PAGE);
  return all;
}
async function dbInsert(item){const row=toRow(item);if(!row.id)row.id=crypto.randomUUID();const res=await sbFetch('POST',TABLE,row);touchFinanceData();return Array.isArray(res)?res[0]:res;}
async function dbUpdate(item){await sbFetch('PATCH',`${TABLE}?id=eq.${item.id}`,toRow(item));touchFinanceData();}
async function dbDelete(id){await sbFetch('DELETE',`${TABLE}?id=eq.${id}`);touchFinanceData();}

const BAIXAS_TABLE='baixas_lancamentos';
async function dbLoadBaixas(){
  const PAGE=1000;let all=[],offset=0,chunk;
  do{
    chunk=await sbFetch('GET',`${BAIXAS_TABLE}?order=data_pgto.asc,created_at.asc&select=*&limit=${PAGE}&offset=${offset}`);
    if(!chunk||!chunk.length)break;
    all=all.concat(chunk);offset+=PAGE;
  }while(chunk.length===PAGE);
  return all;
}
async function dbInsertBaixa(item){
  const row=toBaixaRow(item);
  if(!row.id)row.id=crypto.randomUUID();
  const res=await sbFetch('POST',BAIXAS_TABLE,row);
  touchFinanceData();
  return Array.isArray(res)?res[0]:res;
}
async function dbDeleteBaixa(id){await sbFetch('DELETE',`${BAIXAS_TABLE}?id=eq.${id}`);touchFinanceData();}
async function dbUpdateBaixa(item){await sbFetch('PATCH',`${BAIXAS_TABLE}?id=eq.${item.id}`,toBaixaRow(item));touchFinanceData();}
async function clearBaixasForLancamento(lancamentoId){
  const baixas=getBaixas(lancamentoId);
  for(const b of baixas)await dbDeleteBaixa(b.id);
  BAIXAS_DATA=BAIXAS_DATA.filter(b=>b.lancamentoId!==lancamentoId);
  _invalidateBaixasCache();
  return baixas.length;
}

function fromProjecao(r){
  return{id:r.id,catSlug:r.cat_slug||'',tipo:r.tipo||'',comp:r.comp||'',valor:parseMoney(r.valor)};
}
function toProjecaoRow(p){
  const existing=PROJECOES.find(x=>x.catSlug===p.catSlug&&x.tipo===p.tipo&&x.comp===p.comp);
  return{
    id:p.id||existing?.id||newId(),
    cat_slug:p.catSlug,
    tipo:p.tipo,
    comp:p.comp,
    valor:parseMoney(p.valor)
  };
}
async function dbLoadProjecoes(){
  const rows=await sbFetch('GET','projecoes_manuais?select=*');
  PROJECOES=(rows||[]).map(fromProjecao);
  return PROJECOES;
}
async function dbUpsertProjecao(p){
  const row=toProjecaoRow(p);
  const res=await sbFetch('POST','projecoes_manuais?on_conflict=cat_slug,tipo,comp',row,{'Prefer':'resolution=merge-duplicates,return=representation'});
  const saved=fromProjecao(Array.isArray(res)?res[0]:res);
  const idx=PROJECOES.findIndex(x=>x.catSlug===saved.catSlug&&x.tipo===saved.tipo&&x.comp===saved.comp);
  if(idx>=0)PROJECOES[idx]=saved;else PROJECOES.push(saved);
  return saved;
}
async function dbDeleteProjecao(catSlug,tipo,comp){
  await sbFetch('DELETE',`projecoes_manuais?cat_slug=eq.${encodeURIComponent(catSlug)}&tipo=eq.${encodeURIComponent(tipo)}&comp=eq.${encodeURIComponent(comp)}`);
  PROJECOES=PROJECOES.filter(p=>!(p.catSlug===catSlug&&p.tipo===tipo&&p.comp===comp));
}

function isPendingStatus(l){
  return l.status==='Pendente'||l.status==='Parcial';
}
function effectiveVenc(l){
  return l.dataVenc||((isPendingStatus(l)&&l.dataPgto)?l.dataPgto:'')||'';
}
function dateForSchedule(l){
  return effectiveVenc(l)||l.dataPgto||l.dataComp||'';
}
function toRow(l){const r={id:l.id,tipo:l.tipo,data_comp:l.dataComp||null,data_venc:effectiveVenc(l)||null,data_pgto:l.dataPgto||null,cat:l.cat,sub:l.sub||null,descricao:l.desc||null,cc:l.cc||null,cliente_id:l.clienteId||null,forma:l.forma||null,conta:normalizeConta(l.conta)||null,doc:l.doc||null,valor_bruto:parseMoney(l.valorBruto),ded:parseMoney(l.ded),valor_liq:parseMoney(l.valorLiq),status:l.status,obs:l.obs||null};if(l.parentId)r.parent_id=l.parentId;if(l.adjType)r.adj_type=l.adjType;return r;}
function fromRow(r){const status=r.status||'Pendente';const legacyVenc=!r.data_venc&&(status==='Pendente'||status==='Parcial')?r.data_pgto||'':'';const dataVenc=r.data_venc||legacyVenc;const dataPgto=(status==='Pago'||status==='Recebido'||status==='Parcial')?r.data_pgto||'':'';return{id:r.id,seq:r.seq||null,tipo:r.tipo,dataComp:r.data_comp||'',dataVenc,dataPgto,cat:r.cat||'',sub:r.sub||'',desc:r.descricao||'',cc:r.cc||'',clienteId:r.cliente_id||'',forma:r.forma||'PIX',conta:r.conta||'',doc:r.doc||'',valorBruto:r.valor_bruto||0,ded:r.ded||0,valorLiq:r.valor_liq||0,status,obs:r.obs||'',parentId:r.parent_id||null,adjType:r.adj_type||null};}
function fromBaixaRow(r){
  return{id:r.id,lancamentoId:r.lancamento_id,dataPgto:r.data_pgto||'',conta:r.conta||'',valor:r.valor||0,forma:r.forma||'',tipo:r.tipo||'',origem:r.origem||'manual',obs:r.obs||'',createdAt:r.created_at||''};
}
function toBaixaRow(b){
  return{id:b.id,lancamento_id:b.lancamentoId||b.lancamento_id,data_pgto:b.dataPgto||b.data_pgto||null,conta:normalizeConta(b.conta)||b.conta||null,valor:parseMoney(b.valor),forma:b.forma||null,tipo:b.tipo||null,origem:b.origem||'manual',obs:b.obs||null};
}
function getBaixas(lancamentoId){
  if(!_baixasMap){
    _baixasMap=new Map();
    for(const b of (BAIXAS_DATA||[])){
      let arr=_baixasMap.get(b.lancamentoId);
      if(!arr){arr=[];_baixasMap.set(b.lancamentoId,arr);}
      arr.push(b);
    }
    _baixasMap.forEach(arr=>arr.sort((a,b)=>(a.dataPgto||'').localeCompare(b.dataPgto||'')||(a.createdAt||'').localeCompare(b.createdAt||'')));
  }
  return _baixasMap.get(lancamentoId)||[];
}
function titleAmount(l){
  const bruto=parseMoney(l?.valorBruto),liq=parseMoney(l?.valorLiq);
  if(l?.status==='Parcial'&&bruto>liq+0.005)return bruto;
  return liq||bruto;
}
function legacyPaidAmount(l){
  const lows=getBaixas(l.id);
  if(lows.length)return 0;
  if(l.status==='Parcial'&&parseMoney(l.valorBruto)>parseMoney(l.valorLiq)+0.005)return parseMoney(l.valorLiq);
  if((l.status==='Pago'||l.status==='Recebido')&&l.dataPgto)return titleAmount(l);
  return 0;
}
function paidAmount(l){
  if(!l||l.status==='Cancelado')return 0;
  const lows=getBaixas(l.id).reduce((s,b)=>s+parseMoney(b.valor),0);
  return +(lows+legacyPaidAmount(l)).toFixed(2);
}
function openAmount(l){
  if(!l||l.status==='Cancelado')return 0;
  return +Math.max(0,titleAmount(l)-paidAmount(l)).toFixed(2);
}
function computedStatus(l){
  if(!l)return'Pendente';
  if(l.status==='Cancelado')return'Cancelado';
  const total=titleAmount(l),paid=paidAmount(l);
  if(paid<=0.005)return'Pendente';
  if(paid+0.005<total)return'Parcial';
  return expectedRealizedStatus(l.tipo);
}
function latestBaixaDate(l){
  const dates=getBaixas(l.id).map(b=>b.dataPgto).filter(Boolean).sort();
  if(dates.length)return dates[dates.length-1];
  return (l.status==='Pago'||l.status==='Recebido'||l.status==='Parcial')?l.dataPgto||'':'';
}
function refreshLancamentoComputed(l){
  if(!l||l.status==='Cancelado')return l;
  l.status=computedStatus(l);
  l.dataPgto=paidAmount(l)>0?latestBaixaDate(l):'';
  return l;
}
function baixaTipoFromLancamento(l){return l?.tipo==='D'?'pagamento':'recebimento';}
function cashMovements(){
  if(_cashMovementsCache&&_cashMovementsCache.version===DATA_VERSION)return _cashMovementsCache.rows;
  const rows=[];
  const byId=new Map(DATA.map(l=>[l.id,l]));
  (BAIXAS_DATA||[]).forEach(b=>{
    const l=byId.get(b.lancamentoId);
    if(!l||l.status==='Cancelado')return;
    rows.push({...l,id:`baixa-${b.id}`,lancamentoId:l.id,baixaId:b.id,dataPgto:b.dataPgto,dataExtrato:b.dataPgto,conta:b.conta||l.conta,forma:b.forma||l.forma,valorLiq:parseMoney(b.valor),status:computedStatus(l),origem:b.origem,baixaObs:b.obs,isBaixa:true,isPend:false});
  });
  DATA.forEach(l=>{
    if(!l||l.status==='Cancelado'||getBaixas(l.id).length)return;
    const paid=legacyPaidAmount(l);
    if(paid>0&&l.dataPgto){
      rows.push({...l,id:`legacy-${l.id}`,lancamentoId:l.id,dataExtrato:l.dataPgto,valorLiq:paid,status:computedStatus(l),isBaixa:false,isPend:false});
    }
  });
  _cashMovementsCache={version:DATA_VERSION,rows};
  return rows;
}
async function registerBaixa(lancamento,baixa){
  const original=DATA.find(l=>l.id===lancamento.id)||lancamento;
  if(!original||original.status==='Cancelado')throw new Error('Lancamento cancelado nao aceita baixa.');
  const valor=parseMoney(baixa.valor);
  const saldo=openAmount(original);
  if(valor<=0)throw new Error('Informe um valor maior que zero.');
  if(valor>saldo+0.005)throw new Error('Valor informado excede o saldo em aberto.');
  if(!baixa.dataPgto)throw new Error('Informe a data da baixa.');
  const pgClosed=assertOpenPeriod(baixa.dataPgto,'Data de pagamento');
  if(pgClosed)throw new Error(pgClosed);
  const conta=normalizeConta(baixa.conta)||baixa.conta;
  if(!conta||!CONTAS.includes(conta))throw new Error('Selecione uma conta bancaria cadastrada.');
  const row={id:baixa.id||newId(),lancamentoId:original.id,dataPgto:baixa.dataPgto,conta,valor,forma:baixa.forma||original.forma||'PIX',tipo:baixa.tipo||baixaTipoFromLancamento(original),origem:baixa.origem||'manual',obs:cleanText(baixa.obs||'')};
  const saved=await dbInsertBaixa(row);
  const baixaApp=saved?fromBaixaRow(saved):row;
  BAIXAS_DATA.push(baixaApp);
  _invalidateBaixasCache();
  const next={...original,status:computedStatus(original),dataPgto:latestBaixaDate(original)};
  if(original.status==='Parcial'&&parseMoney(original.valorBruto)>parseMoney(original.valorLiq)+0.005){
    next.valorLiq=titleAmount(original);
    next.ded=0;
  }
  await dbUpdate(next);
  const idx=DATA.findIndex(l=>l.id===original.id);
  if(idx>=0)DATA[idx]={...DATA[idx],...next};
  return{baixa:baixaApp,lancamento:idx>=0?DATA[idx]:next};
}
function fromRecorrente(r){return{id:r.id,desc:r.descricao,cat:r.cat,sub:r.sub||'',valor:r.valor,diaVenc:r.dia_venc||null,compOffset:typeof r.comp_offset==='number'?r.comp_offset:0,conta:r.conta||''};}
function toRecorrenteRow(item){return{id:item.id,tipo:item.tipo,descricao:item.desc,cat:item.cat,sub:item.sub||null,valor:item.valor,dia_venc:item.diaVenc||null,comp_offset:typeof item.compOffset==='number'?item.compOffset:0,conta:item.conta||null};}

const CLOSED_PERIODS_KEY='financeiro_closed_periods';
function normText(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
function cleanText(v){return String(v||'').replace(/\s+/g,' ').trim();}
function periodKeyFromDate(d){
  if(!d)return'';
  const s=String(d);
  if(/^\d{4}-\d{2}/.test(s))return s.slice(0,7);
  const c=compFromView(s);
  return c?c.slice(0,7):'';
}
function getClosedPeriods(){
  try{return new Set(JSON.parse(localStorage.getItem(CLOSED_PERIODS_KEY)||'[]'));}
  catch{return new Set();}
}
function saveClosedPeriods(set){
  localStorage.setItem(CLOSED_PERIODS_KEY,JSON.stringify([...set].sort()));
}
function isPeriodClosed(dateOrComp){
  const k=periodKeyFromDate(dateOrComp);
  return !!k&&getClosedPeriods().has(k);
}
function toggleClosedPeriod(period){
  const k=periodKeyFromDate(period);
  if(!k)return;
  const set=getClosedPeriods();
  if(set.has(k))set.delete(k);else set.add(k);
  saveClosedPeriods(set);
  render();
}
function assertOpenPeriod(dateOrComp,label='periodo'){
  if(isPeriodClosed(dateOrComp))return `${label} ${periodKeyFromDate(dateOrComp)} esta fechado. Reabra o mes antes de alterar.`;
  return null;
}
function isRealizedStatus(l){
  return l.status==='Pago'||l.status==='Recebido'||l.status==='Parcial';
}
function expectedRealizedStatus(tipo){return tipo==='R'?'Recebido':'Pago';}
function validateLancamentoCore(item,opts={}){
  const errors=[],warnings=[];
  const l={...item};
  l.desc=cleanText(l.desc);
  l.doc=cleanText(l.doc);
  l.cc=cleanText(l.cc);
  l.obs=cleanText(l.obs);
  l.conta=normalizeConta(l.conta);
  const bruto=parseMoney(l.valorBruto),ded=parseMoney(l.ded),liq=parseMoney(l.valorLiq);
  if(!['R','D'].includes(l.tipo))errors.push('Tipo invalido.');
  if(!l.dataComp)errors.push('Competencia e obrigatoria.');
  else{
    const e=validarAno(l.dataComp,'Competencia');if(e)errors.push(e);
    const c=assertOpenPeriod(l.dataComp,'Competencia');if(c)errors.push(c);
  }
  if(l.dataVenc){
    const e=validarAno(l.dataVenc,'Data de vencimento');if(e)errors.push(e);
    const c=assertOpenPeriod(l.dataVenc,'Data de vencimento');if(c)errors.push(c);
  }
  if(l.dataPgto){
    const e=validarAno(l.dataPgto,'Data de pagamento');if(e)errors.push(e);
    const c=assertOpenPeriod(l.dataPgto,'Data de pagamento');if(c)errors.push(c);
  }
  if(isPendingStatus(l)&&!effectiveVenc(l))errors.push('Lancamento pendente precisa de data de vencimento.');
  if(isRealizedStatus(l)&&!l.dataPgto)errors.push('Lancamento realizado precisa de data de pagamento/recebimento.');
  if(l.status==='Pendente'&&l.dataPgto)warnings.push('Lancamento pendente possui data de pagamento preenchida.');
  if(l.tipo==='R'&&l.status==='Pago')errors.push('Receita deve usar status Recebido, Pendente, Parcial ou Cancelado.');
  if(l.tipo==='D'&&l.status==='Recebido')errors.push('Despesa deve usar status Pago, Pendente, Parcial ou Cancelado.');
  if(!l.cat)errors.push('Categoria e obrigatoria.');
  else if(typeof validateCatSub==='function'){
    const ce=validateCatSub(l.tipo,l.cat,l.sub);if(ce)errors.push(ce);
  }
  if(!l.conta||!CONTAS.includes(l.conta))errors.push('Selecione uma conta bancaria cadastrada.');
  if(bruto<=0)errors.push('Valor bruto invalido.');
  if(ded<0)errors.push('Deducao nao pode ser negativa.');
  if(ded>bruto)errors.push('Deducao nao pode ser maior que o valor bruto.');
  if(liq<=0)errors.push('Valor liquido invalido.');
  if(liq<0)errors.push('Valor liquido nao pode ser negativo.');
  const calc=+(bruto-ded).toFixed(2);
  if(bruto>0&&ded>=0&&Math.abs(calc-liq)>0.01)warnings.push(`Valor liquido (${fmt(liq)}) nao confere com bruto - deducoes (${fmt(calc)}).`);
  if(!l.desc&&!opts.allowEmptyDesc)errors.push('Descricao e obrigatoria.');
  if(isTransfer(l)&&!opts.allowTransferEdit)errors.push('Transferencias devem ser alteradas pelo fluxo de transferencia, nao como lancamento comum.');
  return{errors,warnings,item:l};
}
function firstValidationError(result){
  return result?.errors?.[0]||'Verifique os dados informados.';
}
async function confirmValidationWarnings(result){
  if(!result?.warnings?.length)return true;
  return await openConfirmModal('Atenção:\n\n'+result.warnings.join('\n')+'\n\nDeseja continuar mesmo assim?',{title:'Atenção'});
}
function findProbableDuplicateLancamento(item){
  const val=parseMoney(item.valorLiq);
  const desc=normText(item.desc);
  if(!item.tipo||!item.dataComp||!desc||val<=0)return null;
  return DATA.find(l=>
    l.id!==item.id&&
    !isTransfer(l)&&
    l.status!=='Cancelado'&&
    l.tipo===item.tipo&&
    periodKeyFromDate(l.dataComp)===periodKeyFromDate(item.dataComp)&&
    Math.abs(parseMoney(l.valorLiq)-val)<=0.01&&
    normText(l.desc)===desc
  )||null;
}
async function confirmProbableDuplicate(item){
  const dup=findProbableDuplicateLancamento(item);
  if(!dup)return true;
  return await openConfirmModal(`Possível lançamento duplicado encontrado:\n\n${dup.desc||dup.cat}\n${compDisplay(dup.dataComp)||dup.dataComp} - ${fmt(dup.valorLiq)}\n\nDeseja salvar mesmo assim?`,{title:'Duplicata detectada'});
}
function validateTransferPair(doc){
  const rows=DATA.filter(l=>l.doc===doc);
  const deb=rows.find(l=>l.tipo==='D'),cred=rows.find(l=>l.tipo==='R');
  if(!doc||!isTransfer({doc}))return null;
  if(rows.length!==2||!deb||!cred)return 'Transferencia incompleta: precisa ter uma saida e uma entrada.';
  if(Math.abs(parseMoney(deb.valorLiq)-parseMoney(cred.valorLiq))>0.01)return 'Transferencia inconsistente: valores de saida e entrada nao conferem.';
  if(deb.dataPgto!==cred.dataPgto)return 'Transferencia inconsistente: datas de saida e entrada nao conferem.';
  if(deb.conta===cred.conta)return 'Transferencia inconsistente: origem e destino nao podem ser a mesma conta.';
  return null;
}
function getRelatedDeleteIds(item){
  if(!item)return[];
  const ids=new Set([item.id]);
  if(isTransfer(item))DATA.filter(x=>x.doc===item.doc).forEach(x=>ids.add(x.id));
  DATA.filter(x=>x.parentId===item.id).forEach(x=>ids.add(x.id));
  return[...ids];
}
function canDeleteLancamentos(items){
  for(const item of items){
    const compClosed=assertOpenPeriod(item.dataComp,'Competencia');
    if(compClosed)return compClosed;
    const vencClosed=assertOpenPeriod(item.dataVenc,'Data de vencimento');
    if(vencClosed)return vencClosed;
    const pgClosed=assertOpenPeriod(item.dataPgto,'Data de pagamento');
    if(pgClosed)return pgClosed;
    for(const b of getBaixas(item.id)){
      const baixaClosed=assertOpenPeriod(b.dataPgto,'Data da baixa');
      if(baixaClosed)return baixaClosed;
    }
  }
  return null;
}

function setSyncStatus(state,msg){const dot=document.getElementById('sync-dot'),txt=document.getElementById('sync-txt');if(!dot)return;dot.className='sync-dot '+state;if(txt)txt.textContent=msg;}

function showTip(e,text){
  const el=document.getElementById('float-tip');
  if(!el)return;
  el.textContent=text;
  el.style.left='-9999px';
  el.style.display='block';
  const tipH=el.offsetHeight,tipW=el.offsetWidth||220;
  let left=e.clientX-tipW/2,top=e.clientY-tipH-12;
  if(left<8)left=8;
  if(left+tipW>window.innerWidth-8)left=window.innerWidth-8-tipW;
  if(top<8)top=e.clientY+16;
  el.style.left=left+'px';
  el.style.top=top+'px';
}
function hideTip(){const el=document.getElementById('float-tip');if(el)el.style.display='none';}

let DATA=[];
let BAIXAS_DATA=[];
let _baixasMap=null;
function _invalidateBaixasCache(){_baixasMap=null;}
let PROJECOES=[];
let DATA_VERSION=0;
let _cashMovementsCache=null;
function touchFinanceData(){
  DATA_VERSION++;
  _cashMovementsCache=null;
  if(typeof clearFinanceCalcCache==='function')clearFinanceCalcCache();
}
const newId=()=>crypto.randomUUID();
function isTransfer(l){return !!(l?.doc||'').startsWith('TRANSF#');}

// CATS é dinâmico — carregado do Supabase
// Estrutura: {R: [{id, nome, ordem, subs:[{id,nome,ordem,slug}]}], D: [...]}
let CATS_DATA = {R:[], D:[]};

// CATS compatível com o restante do código (objeto nome->array de subs)
const CATS = {R:{}, D:{}};

function rebuildCatsObj() {
  ['R','D'].forEach(tipo => {
    CATS[tipo] = {};
    (CATS_DATA[tipo]||[]).sort((a,b)=>a.ordem-b.ordem).forEach(cat => {
      CATS[tipo][cat.nome] = (cat.subs||[]).sort((a,b)=>a.ordem-b.ordem).map(s=>s.nome);
    });
  });
  if(typeof clearFinanceCalcCache==='function')clearFinanceCalcCache();
}

// Slugify: transforma nome de categoria em chave para DRE/Fluxo
function slugify(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');}

// Mapeamento fixo de fallback para categorias padrão
const SLUG_FALLBACK = {
  'pessoal':'pessoal',
  'impostos e taxas':'impostos_e_taxas',
  'infraestrutura':'infraestrutura',
  'tecnologia':'tecnologia',
  'marketing':'marketing',
  'administrativo':'administrativo',
  'financeiro':'financeiro',
};

// Retorna o slug de uma categoria para uso nos cálculos
function catSlug(nome){
  // 1. Tenta achar no CATS_DATA carregado do Supabase
  const d = (CATS_DATA.D||[]).find(c=>c.nome===nome);
  if(d && d.slug) return d.slug;
  // 2. Tenta fallback fixo
  const k = (nome||'').toLowerCase().trim();
  if(SLUG_FALLBACK[k]) return SLUG_FALLBACK[k];
  // 3. Gera slug dinamicamente
  return slugify(nome);
}

// Retorna todas as categorias de despesa com seus slugs (para DRE/Fluxo dinâmico)
function getDespCats(){
  return (CATS_DATA.D||[]).sort((a,b)=>a.ordem-b.ordem).map(c=>({
    ...c,
    slug: c.slug || SLUG_FALLBACK[(c.nome||'').toLowerCase().trim()] || slugify(c.nome)
  }));
}
function getRecCats(){
  return (CATS_DATA.R||[]).sort((a,b)=>a.ordem-b.ordem).map(c=>({
    ...c,
    slug: c.slug || SLUG_FALLBACK[(c.nome||'').toLowerCase().trim()] || slugify(c.nome)
  }));
}

// Categorias excluídas do DRE (aparecem apenas no Fluxo de Caixa)
const EXCL_DRE_SLUGS = new Set(['reembolso','transferencia']);
function isExclDRE(cat){ return EXCL_DRE_SLUGS.has(cat.slug||slugify(cat.nome)) || !!cat.excluir_dre; }
function dreCatSlug(cat){return cat.slug||slugify(cat.nome);}
function isNaoOpDRE(cat){
  const slug=dreCatSlug(cat);
  return (cat.fluxo||'operacional')==='nao_operacional'||slug==='outras_receitas'||slug.includes('reembols');
}

// Categoria especial de receita financeira
function isRecFinCat(nome){
  const r=(CATS_DATA.R||[]).find(c=>c.nome===nome);
  if(r) return (r.slug||slugify(r.nome)).includes('financeira');
  return (nome||'').toLowerCase().includes('financeira');
}
