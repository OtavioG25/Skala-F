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
  clipboard:'<rect width="16" height="18" x="4" y="4" rx="2"/><path d="M9 2h6v4H9z"/><path d="M8 12h8"/><path d="M8 16h6"/>',
  calendar:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  close:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
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

const APP_VERSION = 'v2.5.97';
const APP_DATE = '2026-05-12';

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



const SUPABASE_URL='https://rvymfrpugzwwgrcybwpk.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eW1mcnB1Z3p3d2dyY3lid3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODgzNTUsImV4cCI6MjA5MzA2NDM1NX0.kgWgFOlD53kclwB62GPOHbQh55Ypxp6rjGhYCmvs-Us';
const TABLE='lancamentos';

const sbFetch=async(method,path,body=null)=>{
  const token=localStorage.getItem('sb_token')||SUPABASE_KEY;
  const opts={method,headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json','Prefer':'return=representation'}};
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
async function dbInsert(item){const row=toRow(item);if(!row.id)row.id=crypto.randomUUID();const res=await sbFetch('POST',TABLE,row);return Array.isArray(res)?res[0]:res;}
async function dbUpdate(item){await sbFetch('PATCH',`${TABLE}?id=eq.${item.id}`,toRow(item));}
async function dbDelete(id){await sbFetch('DELETE',`${TABLE}?id=eq.${id}`);}

async function migrateLegacyContas(rows){
  const legacy=rows.filter(r=>(r.conta||'')==='Conta Corrente');
  if(!legacy.length)return;
  setSyncStatus('loading',`Ajustando ${legacy.length} conta(s)...`);
  for(const r of legacy){
    try{await sbFetch('PATCH',`${TABLE}?id=eq.${r.id}`,{conta:'Caixa'});}
    catch(e){console.warn('Falha ao migrar conta',r.id,e);}
  }
}

async function limparRecorrentesDespesas(){
  try{
    await sbFetch('DELETE','recorrentes?tipo=eq.D');
    RECORRENTES_DESPESAS=[];
    render();
    alert('✓ Despesas recorrentes excluídas do Supabase.');
  }catch(e){alert('Erro ao excluir: '+e.message);}
}

function diagnosticarRecorrentes(){
  const erros=[];
  RECORRENTES_DESPESAS.forEach(r=>{
    const err=validateCatSub('D',r.cat,r.sub);
    if(err) erros.push({desc:r.desc,cat:r.cat,sub:r.sub,erro:err});
  });
  if(!erros.length){console.log('✓ Todos os recorrentes estão válidos.');return;}
  console.table(erros);
  console.log(`\nCategorias disponíveis (D):\n`+CATS_DATA.D.map(c=>`  ${c.nome}: [${(c.subs||[]).map(s=>s.nome).join(', ')}]`).join('\n'));
}

async function adicionarSubConsultoria(){
  try{
    const catAdm=CATS_DATA.D.find(c=>c.nome==='Administrativo');
    if(!catAdm){alert('Categoria Administrativo não encontrada.');return;}
    if((catAdm.subs||[]).find(s=>s.nome==='Consultoria')){alert('Subcategoria Consultoria já existe.');return;}
    const sub={id:newId(),categoria_id:catAdm.id,nome:'Consultoria',slug:slugify('Consultoria'),ordem:(catAdm.subs||[]).length};
    await sbFetch('POST','subcategorias',[sub]);
    if(!catAdm.subs)catAdm.subs=[];
    catAdm.subs.push(sub);
    rebuildCatsObj();
    render();
    alert('✓ Subcategoria Consultoria adicionada em Administrativo.');
  }catch(e){alert('Erro: '+e.message);}
}


async function criarCategoriasReembolso(){
  for(const tipo of ['R','D']){
    if((CATS_DATA[tipo]||[]).find(c=>c.nome==='Reembolso')){
      toast(`Categoria Reembolso (${tipo}) já existe.`,'ok');continue;
    }
    const id=newId();
    const ordem=(CATS_DATA[tipo]||[]).length;
    await sbFetch('POST','categorias',[{id,tipo,nome:'Reembolso',slug:'reembolso',ordem}]);
    const subId=newId();
    const sub={id:subId,categoria_id:id,nome:'Reembolso',slug:'reembolso',ordem:0};
    await sbFetch('POST','subcategorias',[sub]);
    CATS_DATA[tipo].push({id,tipo,nome:'Reembolso',slug:'reembolso',ordem,subs:[sub]});
  }
  rebuildCatsObj();
  toast('✓ Categorias Reembolso (R e D) criadas. Não aparecem no DRE, apenas no Fluxo de Caixa.','ok');
}

async function limparReceitas01(){
  const errados=DATA.filter(l=>l.cat==='Receita de Serviços');
  if(!errados.length){toast('Nenhum lançamento com cat "Receita de Serviços" encontrado.','ok');return;}
  if(!confirm(`Excluir ${errados.length} lançamento(s) com categoria "Receita de Serviços"?`))return;
  setSyncStatus('loading','Removendo...');
  try{
    for(const l of errados){await sbFetch('DELETE',`${TABLE}?id=eq.${l.id}`);}
    errados.forEach(l=>{const i=DATA.findIndex(d=>d.id===l.id);if(i>=0)DATA.splice(i,1);});
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();render();
    toast(`✓ ${errados.length} lançamentos removidos. Agora rode importarReceitas01().`,'ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function migrarProLabore(){
  const DE='Pró-Labore', PARA='Pro-labores/Retiradas', SLUG=slugify(PARA);
  try{
    // Atualiza lançamentos e recorrentes
    await sbFetch('PATCH',`${TABLE}?sub=eq.${encodeURIComponent(DE)}`,{sub:PARA});
    await sbFetch('PATCH',`recorrentes?sub=eq.${encodeURIComponent(DE)}`,{sub:PARA});
    // Atualiza a subcategoria na tabela do Supabase
    await sbFetch('PATCH',`subcategorias?nome=eq.${encodeURIComponent(DE)}`,{nome:PARA,slug:SLUG});
    // Atualiza em memória
    DATA.forEach(l=>{if(l.sub===DE)l.sub=PARA;});
    RECORRENTES_DESPESAS.forEach(r=>{if(r.sub===DE)r.sub=PARA;});
    for(const tipo of ['R','D']){
      for(const cat of CATS_DATA[tipo]||[]){
        const sub=(cat.subs||[]).find(s=>s.nome===DE);
        if(sub){sub.nome=PARA;sub.slug=SLUG;}
      }
    }
    rebuildCatsObj();
    render();
    alert(`✓ Migração concluída: "${DE}" → "${PARA}"`);
  }catch(e){alert('Erro na migração: '+e.message);}
}

function toRow(l){return{id:l.id,tipo:l.tipo,data_comp:l.dataComp||null,data_pgto:l.dataPgto||null,cat:l.cat,sub:l.sub||null,descricao:l.desc||null,cc:l.cc||null,forma:l.forma||null,conta:normalizeConta(l.conta)||null,doc:l.doc||null,valor_bruto:parseMoney(l.valorBruto),ded:parseMoney(l.ded),valor_liq:parseMoney(l.valorLiq),status:l.status,obs:l.obs||null};}
function fromRow(r){return{id:r.id,seq:r.seq||null,tipo:r.tipo,dataComp:r.data_comp||'',dataPgto:r.data_pgto||'',cat:r.cat||'',sub:r.sub||'',desc:r.descricao||'',cc:r.cc||'',forma:r.forma||'PIX',conta:r.conta||'',doc:r.doc||'',valorBruto:r.valor_bruto||0,ded:r.ded||0,valorLiq:r.valor_liq||0,status:r.status||'Pendente',obs:r.obs||''};}
function extractParcHist(obs){const m=(obs||'').match(/~~P:(\[[\s\S]*?\])~~/);try{return m?JSON.parse(m[1]):[]}catch{return[];}}
function stripParcHist(obs){return(obs||'').replace(/\s*~~P:\[[\s\S]*?\]~~/,'').trim();}
function fromRecorrente(r){return{id:r.id,desc:r.descricao,cat:r.cat,sub:r.sub||'',valor:r.valor,diaVenc:r.dia_venc||null,compOffset:typeof r.comp_offset==='number'?r.comp_offset:0,conta:r.conta||''};}
function toRecorrenteRow(item){return{id:item.id,tipo:item.tipo,descricao:item.desc,cat:item.cat,sub:item.sub||null,valor:item.valor,dia_venc:item.diaVenc||null,comp_offset:typeof item.compOffset==='number'?item.compOffset:0,conta:item.conta||null};}

function setSyncStatus(state,msg){const dot=document.getElementById('sync-dot'),txt=document.getElementById('sync-txt');if(!dot)return;dot.className='sync-dot '+state;txt.textContent=msg;}

let DATA=[];
const newId=()=>crypto.randomUUID();

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
function getRecCats(){return (CATS_DATA.R||[]).sort((a,b)=>a.ordem-b.ordem);}

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

