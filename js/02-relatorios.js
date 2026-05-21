function calcDRE(year){
  const despCats=getDespCats().filter(c=>!isExclDRE(c));
  const recCats=getRecCats().filter(c=>!isExclDRE(c));
  const base={totRec:0,totDesp:0,ebitda:0,ll:0,
    // Totalizadores intermediários do modelo Skala
    recOpBruta:0, impostos:0, custosOp:0, recOpLiq:0,
    cusPessoal:0, lucOpBruto:0, despOp:0, resOp:0,
    investimentos:0, recFin:0, outrasRec:0, doacoes:0
  };
  // Chave por categoria
  recCats.forEach(c=>{ base['r_'+(c.slug||slugify(c.nome))]=0; });
  despCats.forEach(c=>{ base['d_'+(c.slug||slugify(c.nome))]=0; });
  // Chave por subcategoria
  recCats.forEach(c=>{ (c.subs||[]).forEach(s=>{ base['rs_'+(s.slug||slugify(s.nome))]=0; }); });
  despCats.forEach(c=>{ (c.subs||[]).forEach(s=>{ base['ds_'+(s.slug||slugify(s.nome))]=0; }); });

  const m=Array.from({length:12},()=>({...base}));

  DATA.forEach(l=>{
    if(!l.dataComp||getY(l.dataComp)!==year||l.status==='Cancelado')return;
    // Parcial: reconhece receita cheia (valorBruto) no DRE — apenas parcialmente recebida no caixa
    const i=getM(l.dataComp),v=l.status==='Parcial'?parseMoney(l.valorBruto):parseMoney(l.valorLiq);
    if(l.tipo==='R'){
      const rc=recCats.find(c=>c.nome===l.cat);
      const rslug='r_'+(rc?(rc.slug||slugify(rc.nome)):slugify(l.cat));
      m[i][rslug]=(m[i][rslug]||0)+v;
      // Subcategoria
      if(rc){
        const sub=(rc.subs||[]).find(s=>s.nome===l.sub);
        if(sub){ const sk='rs_'+(sub.slug||slugify(sub.nome)); m[i][sk]=(m[i][sk]||0)+v; }
      }
    } else {
      const dc=despCats.find(c=>c.nome===l.cat);
      const dslug='d_'+(dc?(dc.slug||slugify(dc.nome)):catSlug(l.cat));
      m[i][dslug]=(m[i][dslug]||0)+v;
      // Subcategoria
      if(dc){
        const sub=(dc.subs||[]).find(s=>s.nome===l.sub);
        if(sub){ const sk='ds_'+(sub.slug||slugify(sub.nome)); m[i][sk]=(m[i][sk]||0)+v; }
      }
    }
  });

  const PESSOAL_SLUG      = 'pessoal';
  const IMPOSTOS_SLUG     = 'impostos_e_taxas';
  const EXCL_DESP_SLUGS   = [PESSOAL_SLUG, IMPOSTOS_SLUG];
  const recOpCats = recCats.filter(c=>!isNaoOpDRE(c));
  const recNaoOpCats = recCats.filter(c=>isNaoOpDRE(c));
  const despOpCatsForCalc = despCats.filter(c=>!isNaoOpDRE(c));
  const despNaoOpCats = despCats.filter(c=>isNaoOpDRE(c));

  m.forEach(r=>{
    r.recOpBruta = recOpCats.reduce((s,c)=>s+(r['r_'+dreCatSlug(c)]||0),0);
    // Impostos
    const impostoCat = despOpCatsForCalc.find(c=>dreCatSlug(c)===IMPOSTOS_SLUG);
    r.impostos  = impostoCat ? (r['d_'+dreCatSlug(impostoCat)]||0) : 0;
    r.custosOp  = 0;
    r.recOpLiq  = r.recOpBruta - r.impostos;
    // Custo pessoal
    const pessoalCat = despOpCatsForCalc.find(c=>dreCatSlug(c)===PESSOAL_SLUG);
    r.cusPessoal = pessoalCat ? (r['d_'+dreCatSlug(pessoalCat)]||0) : 0;
    r.lucOpBruto = r.recOpLiq - r.cusPessoal;
    // Despesas operacionais (todas as categorias exceto Pessoal e Impostos e Taxas)
    r.despOp = despOpCatsForCalc.filter(c=>!EXCL_DESP_SLUGS.includes(dreCatSlug(c))).reduce((s,c)=>s+(r['d_'+dreCatSlug(c)]||0),0);
    r.resOp  = r.lucOpBruto - r.despOp;
    r.investimentos = 0;
    r.recFin        = 0;
    r.outrasRec     = recNaoOpCats.reduce((s,c)=>s+(r['r_'+dreCatSlug(c)]||0),0);
    r.despNaoOp     = despNaoOpCats.reduce((s,c)=>s+(r['d_'+dreCatSlug(c)]||0),0);
    r.doacoes       = 0;
    // Totais gerais
    r.totRec  = r.recOpBruta + r.outrasRec;
    r.totDesp = despCats.reduce((s,c)=>s+(r['d_'+(c.slug||slugify(c.nome))]||0),0);
    r.ll      = r.resOp + r.outrasRec - r.despNaoOp;
  });
  return m;
}

function calcFluxo(year){
  const despCats=getDespCats();
  const recCats=getRecCats();
  const base={entradas:0,totSaidas:0,saldoOp:0,saldoIni:0,saldoFin:0};
  recCats.forEach(c=>{ base['r_'+(c.slug||slugify(c.nome))]=0; });
  despCats.forEach(c=>{ base['d_'+(c.slug||slugify(c.nome))]=0; });
  const m=Array.from({length:12},()=>({...base}));

  DATA.forEach(l=>{
    if(l.status!=='Pago'&&l.status!=='Recebido'&&l.status!=='Parcial')return;
    if((l.doc||'').startsWith('TRANSF#'))return;
    const hist=extractParcHist(l.obs);
    if(hist.length>0){
      hist.forEach(p=>{
        if(!p.d||getY(p.d)!==year)return;
        const pi=getM(p.d),pv=+p.v||0;
        if(l.tipo==='R'){const rc=recCats.find(c=>c.nome===l.cat);const rs='r_'+(rc?(rc.slug||slugify(rc.nome)):slugify(l.cat));m[pi][rs]=(m[pi][rs]||0)+pv;}
        else{const sl='d_'+catSlug(l.cat);m[pi][sl]=(m[pi][sl]||0)+pv;}
      });
    } else {
      if(!l.dataPgto||getY(l.dataPgto)!==year)return;
      const i=getM(l.dataPgto),v=parseMoney(l.valorLiq);
      if(l.tipo==='R'){const rc=recCats.find(c=>c.nome===l.cat);const rslug='r_'+(rc?(rc.slug||slugify(rc.nome)):slugify(l.cat));m[i][rslug]=(m[i][rslug]||0)+v;}
      else{const slug='d_'+catSlug(l.cat);m[i][slug]=(m[i][slug]||0)+v;}
    }
  });

  m.forEach((r,i)=>{
    r.entradas=recCats.reduce((s,c)=>s+(r['r_'+(c.slug||slugify(c.nome))]||0),0);
    r.totSaidas=despCats.reduce((s,c)=>s+(r['d_'+(c.slug||slugify(c.nome))]||0),0);
    r.saldoOp=r.entradas-r.totSaidas;
    r.saldoIni=i===0?0:m[i-1].saldoFin;
    r.saldoFin=r.saldoIni+r.saldoOp;
    r.entradasOp=recCats.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').reduce((s,c)=>s+(r['r_'+(c.slug||slugify(c.nome))]||0),0);
    r.saidasOp=despCats.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').reduce((s,c)=>s+(r['d_'+(c.slug||slugify(c.nome))]||0),0);
    r.resultadoOp=r.entradasOp-r.saidasOp;
    r.entradasNaoOp=recCats.filter(c=>(c.fluxo||'operacional')==='nao_operacional').reduce((s,c)=>s+(r['r_'+(c.slug||slugify(c.nome))]||0),0);
    r.saidasNaoOp=despCats.filter(c=>(c.fluxo||'operacional')==='nao_operacional').reduce((s,c)=>s+(r['d_'+(c.slug||slugify(c.nome))]||0),0);
    r.resultadoNaoOp=r.entradasNaoOp-r.saidasNaoOp;
  });
  return m;
}

const FORMAS=['PIX','TED','Boleto','Cartão Crédito','Cartão Débito','Dinheiro','Cheque'];
const STATUS=['Pago','Recebido','Pendente','Parcial','Cancelado'];
const FILTER_STATUS=[
  {value:'Pendente',label:'Pendente'},
  {value:'Parcial',label:'Parcial'},
  {value:'Realizado',label:'Recebido/Pago'}
];
let CONTAS=[];
let CONTAS_DATA=[];
const MONTHS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function normalizeConta(conta){
  const raw=String(conta||'').trim();
  if(!raw||raw==='Conta Corrente')return 'Caixa';
  return CONTAS.includes(raw)?raw:'';
}
function parseMoney(v){
  if(typeof v==='number')return Number.isFinite(v)?v:0;
  const raw=String(v??'').trim();
  if(!raw)return 0;
  let s=raw.replace(/\s/g,'').replace(/[R$]/g,'');
  const hasComma=s.includes(','), hasDot=s.includes('.');
  if(hasComma&&hasDot)s=s.replace(/\./g,'').replace(',','.');
  else if(hasComma)s=s.replace(',','.');
  else if(hasDot&&/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  s=s.replace(/[^0-9.-]/g,'');
  return parseFloat(s)||0;
}
const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(parseMoney(v));
const fmtMoneyInput=v=>parseMoney(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function moneyInputValue(v){return fmtMoneyInput(v);}
function formatMoneyField(el,key,obj=formData){
  obj[key]=fmtMoneyInput(el.value);
  el.value=obj[key];
}
const fmtPct=v=>`${((parseFloat(v)||0)*100).toFixed(1)}%`;
const getM=d=>d?parseInt(d.split('-')[1],10)-1:null;
const getY=d=>d?parseInt(d.split('-')[0],10):null;
async function loadContasFromDB(){
  try{
    const rows=await sbFetch('GET','contas?order=ordem.asc,nome.asc&select=*');
    if(rows&&rows.length>0){
      CONTAS_DATA=rows;
      CONTAS=rows.map(c=>c.nome);
    }else{
      CONTAS_DATA=[];
      CONTAS=['Caixa'];
    }
  }catch(e){
    console.warn('Falha ao carregar contas',e);
    toast('Erro ao carregar contas: '+e.message,'err');
    CONTAS_DATA=[];
    CONTAS=['Caixa'];
  }
}
function dateBR(d){
  if(!d)return'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(d))return`${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`;
  return d;
}
function compToView(v){
  if(!v)return'';
  if(/^\d{4}-\d{2}$/.test(v))return`${v.slice(5)}/${v.slice(0,4)}`;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return`${v.slice(5,7)}/${v.slice(0,4)}`;
  if(/^\d{2}\/\d{4}$/.test(v))return v;
  return v;
}
function compDisplay(v){
  if(!v)return'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v.slice(0,7);
  if(/^\d{4}-\d{2}$/.test(v))return v;
  return v;
}
function compFromView(v){
  if(!v)return null;
  const digits=String(v||'').replace(/\D/g,'');
  if(digits.length===6){
    const mm=String(digits.slice(0,2)).padStart(2,'0');
    const yyyy=digits.slice(2);
    return `${yyyy}-${mm}-01`;
  }
  const m=String(v||'').trim().match(/^(\d{1,2})\/(\d{4})$/);
  if(!m)return null;
  const mm=String(m[1]).padStart(2,'0');
  return `${m[2]}-${mm}-01`;
}
function formatCompInput(v){
  const digits=String(v||'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.length<=2) return digits;
  const mm=digits.slice(0,2);
  const yy=digits.slice(2,6);
  return yy?`${mm}/${yy}`:mm;
}

// Retorna mensagem de erro se o ano estiver fora do intervalo 1900-2100, ou null se ok
function validarAno(dateStr, label){
  if(!dateStr)return null;
  const y=parseInt(String(dateStr).slice(0,4));
  if(!y||isNaN(y))return null;
  if(y<1900||y>2100)return`Ano inválido em "${label}" (${y}). Use um ano entre 1900 e 2100.`;
  return null;
}
// Feedback visual no campo Competência ao sair do campo
function onCompBlur(el){
  el.value=formData.dataCompView=formatCompInput(el.value);
  const comp=compFromView(formData.dataCompView);
  const err=validarAno(comp,'Competência');
  el.style.boxShadow=err?'0 0 0 2px var(--red)':'';
  if(err)toast(err,'err');
}
const FORM_FIELD_IDS=['f-comp','f-datapgto','f-cat','f-vbruto','form-valor-liq','f-conta'];
function markInvalid(id){const el=document.getElementById(id);if(el)el.style.boxShadow='0 0 0 2px var(--red)';}
function clearFormMarks(){FORM_FIELD_IDS.forEach(id=>{const el=document.getElementById(id);if(el)el.style.boxShadow='';});}
// Feedback visual no campo Data Pagamento ao sair do campo
function onDataPgtoBlur(el){
  formData.dataPgto=el.value;
  if(!el.value){el.style.boxShadow='';return;}
  const err=validarAno(el.value,'Data Pagamento');
  el.style.boxShadow=err?'0 0 0 2px var(--red)':'';
  if(err){toast(err,'err');el.value='';formData.dataPgto='';}
}

let TAB='dashboard',prevTAB='',YEAR=new Date().getFullYear(),editingId=null;
const TABS=[
  {id:'dashboard',lbl:'Dashboard',ico:appIcon('dashboard')},
  {id:'receber',lbl:'Contas a Receber',ico:appIcon('arrowDown')},
  {id:'pagar',lbl:'Contas a Pagar',ico:appIcon('arrowUp')},
  {id:'dre',lbl:'DRE',ico:appIcon('chart')},
  {id:'fluxo',lbl:'Fluxo de Caixa',ico:appIcon('wallet')},
  {id:'recorrentes',lbl:'Desp. Recorrentes',ico:appIcon('repeat')},
  {id:'categorias',lbl:'Categorias',ico:appIcon('settings')},
  {id:'contas',lbl:'Contas',ico:appIcon('bank')},
  {id:'extrato',lbl:'Extrato',ico:appIcon('file')}
];

const BASE_PATH='/Skala-F/';
function tabFromPath(){const seg=location.pathname.replace(BASE_PATH,'').split('/')[0].toLowerCase();return TABS.find(t=>t.id===seg)?seg:'dashboard';}
function pushTab(id){history.pushState({tab:id},'',(BASE_PATH+id));}

async function init(){
  const ys=document.getElementById('yr-sel');
  for(let y=YEAR-1;y<=YEAR+1;y++){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===YEAR)o.selected=true;ys.appendChild(o);}
  try{
    setSyncStatus('loading','Carregando...');
    const [rows, cats, subs, recRows] = await Promise.all([
      dbLoad(),
      sbFetch('GET','categorias?order=ordem.asc&select=*'),
      sbFetch('GET','subcategorias?order=ordem.asc&select=*'),
      sbFetch('GET','recorrentes?order=descricao.asc&select=*').catch(()=>null),
      loadContasFromDB(),
    ]);
    await migrateLegacyContas(rows);
    DATA=rows.map(fromRow);

    if(cats && cats.length > 0){
      CATS_DATA.R = cats.filter(c=>c.tipo==='R').map(c=>({...c, subs: subs.filter(s=>s.categoria_id===c.id)}));
      CATS_DATA.D = cats.filter(c=>c.tipo==='D').map(c=>({...c, subs: subs.filter(s=>s.categoria_id===c.id)}));
    } else {
      await seedCategorias();
    }
    rebuildCatsObj();

    if(recRows && recRows.length > 0){
      RECORRENTES_RECEITAS = recRows.filter(r=>r.tipo==='R').map(fromRecorrente);
      RECORRENTES_DESPESAS = recRows.filter(r=>r.tipo==='D').map(fromRecorrente);
    } else if(recRows !== null){
      await seedRecorrentes();
    }

    setSyncStatus('ok',`${DATA.length} registros`);
  }catch(e){
    console.error(e);setSyncStatus('err','Erro de conexão');
    toast('Erro ao conectar: '+e.message,'err');
  }
  document.getElementById('app').style.display='flex';
  TAB=tabFromPath();
  buildNav();render();
}

// Popula categorias padrão no Supabase na primeira vez
async function seedCategorias(){
  const defaults = {
    R:[
      {nome:'Receita de Serviços', subs:['Honorários Contábeis','Assessoria Fiscal','Consultoria Tributária','Abertura de Empresas','Folha de Pagamento','Outros Serviços']},
      {nome:'Receita Financeira',  subs:['Juros Recebidos','Rendimento de Aplicação']},
      {nome:'Outras Receitas',     subs:['Reembolso','Outros']},
    ],
    D:[
      {nome:'Pessoal',         subs:['Salários e Encargos','Pro-labores/Retiradas','FGTS','INSS Patronal','Vale Transporte','Vale Refeição','Plano de Saúde','Férias e 13º']},
      {nome:'Impostos e Taxas',subs:['Simples Nacional','ISS','PIS/COFINS','CSLL','IRPJ','IPTU','Taxas Diversas']},
      {nome:'Infraestrutura',  subs:['Aluguel','Condomínio','Energia Elétrica','Internet / Telefone','Água','Limpeza']},
      {nome:'Tecnologia',      subs:['Software Contábil','Microsoft 365','Manutenção TI']},
      {nome:'Marketing',       subs:['Site / SEO','Publicidade']},
      {nome:'Administrativo',  subs:['Material de Escritório','Cursos / Capacitação','Correios','Despesas Bancárias','Consultoria','Outros']},
      {nome:'Financeiro',      subs:['Empréstimos','Juros Pagos','Multas / Juros Mora']},
    ]
  };
  for(const tipo of ['R','D']){
    CATS_DATA[tipo] = [];
    for(let ci=0; ci<defaults[tipo].length; ci++){
      const cat = defaults[tipo][ci];
      const slug = slugify(cat.nome);
      const id = newId();
      await sbFetch('POST','categorias',[{id, tipo, nome:cat.nome, slug, ordem:ci}]);
      const subsRows = cat.subs.map((s,si)=>({id:newId(), categoria_id:id, nome:s, slug:slugify(s), ordem:si}));
      if(subsRows.length) await sbFetch('POST','subcategorias',subsRows);
      CATS_DATA[tipo].push({id, tipo, nome:cat.nome, slug, ordem:ci, subs:subsRows});
    }
  }
}


function buildNav(){
  const nav=document.getElementById('nav');nav.innerHTML='';
  const pendR=DATA.filter(l=>l.status==='Pendente'&&l.tipo==='R').length;
  const pendD=DATA.filter(l=>l.status==='Pendente'&&l.tipo==='D').length;
  TABS.forEach(t=>{
    const b=document.createElement('button');b.className='nv'+(t.id===TAB?' on':'');
    b.onclick=()=>{TAB=t.id;pushTab(t.id);buildNav();render();updateTitle();};
    const badge=t.id==='receber'&&pendR?`<span class="nb">${pendR}</span>`:t.id==='pagar'&&pendD?`<span class="nb">${pendD}</span>`:'';
    b.innerHTML=`<span class="nv-ico">${t.ico}</span>${t.lbl}${badge}`;
    nav.appendChild(b);
  });
}

function updateTitle(){document.getElementById('page-ttl').textContent=TABS.find(t=>t.id===TAB)?.lbl||'';}
function setYear(y){YEAR=parseInt(y);render();}
function renderKeepScroll(){
  const ls=document.querySelector('.lan-scroll');
  const st=ls?ls.scrollTop:0;
  render();
  if(st>0)requestAnimationFrame(()=>{const el=document.querySelector('.lan-scroll');if(el)el.scrollTop=st;});
}
function render(){
  if(TAB==='pendentes'||TAB==='lancamentos')TAB='receber';
  updateTitle();const c=document.getElementById('content');c.innerHTML='';
  if(TAB==='dashboard')renderDashboard(c);
  else if(TAB==='receber')renderReceber(c);
  else if(TAB==='pagar')renderPagar(c);
  else if(TAB==='dre')renderDRE(c);
  else if(TAB==='fluxo')renderFluxo(c);
  else if(TAB==='recorrentes')renderRecorrentes(c);
  else if(TAB==='categorias')renderCategorias(c);
  else if(TAB==='contas')renderContas(c);
  else if(TAB==='extrato')renderExtrato(c);
  prevTAB=TAB;
}

function calcExtrato(){
  const conta=filterExtratoConta;
  const contaObj=CONTAS_DATA.find(c=>c.nome===conta);
  const saldoIni=parseFloat(contaObj?.saldo_inicial)||0;
  const transfCredits=DATA
    .filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')&&l.obs.slice(12)===conta&&!DATA.some(cr=>cr.doc===l.doc&&cr.conta===conta&&cr.tipo==='R'))
    .map(l=>({...l,tipo:'R',conta}));
  const allItems=[...DATA,...transfCredits];
  const prePeriod=allItems.filter(l=>
    l.conta===conta&&(l.status==='Pago'||l.status==='Recebido'||l.status==='Parcial')&&
    l.dataPgto&&(!filterExtratoInicio||l.dataPgto<filterExtratoInicio)
  );
  const saldoAntes=saldoIni+prePeriod.reduce((s,l)=>s+(l.tipo==='R'?l.valorLiq:-l.valorLiq),0);
  let items=allItems.filter(l=>{
    if(l.conta!==conta||!l.dataPgto||l.status==='Cancelado')return false;
    if(!filterExtratoInclPend&&l.status==='Pendente')return false;
    if(filterExtratoInicio&&l.dataPgto<filterExtratoInicio)return false;
    if(filterExtratoFim&&l.dataPgto>filterExtratoFim)return false;
    return true;
  });
  items.sort((a,b)=>{
    if(a.dataPgto<b.dataPgto)return -1;
    if(a.dataPgto>b.dataPgto)return 1;
    if(sortExtrato.col){
      let va=a[sortExtrato.col]??'',vb=b[sortExtrato.col]??'';
      if(sortExtrato.col==='valorLiq'){va=parseMoney(va);vb=parseMoney(vb);}
      const r=va>vb?1:va<vb?-1:0;
      return sortExtrato.dir==='asc'?r:-r;
    }
    return 0;
  });
  let running=saldoAntes;
  const rows=items.map(l=>{
    running+=(l.tipo==='R'?l.valorLiq:-l.valorLiq);
    return{...l,saldo:running,isPend:l.status==='Pendente'||l.status==='Parcial'};
  });
  return{rows,saldoAntes,saldoFinal:running};
}

function sortExtratoBy(col){
  if(sortExtrato.col===col){sortExtrato.dir=sortExtrato.dir==='asc'?'desc':'asc';}
  else{sortExtrato.col=col;sortExtrato.dir='asc';}
  const c=document.getElementById('content');const ts=c.querySelector('.tbl-scroll');const st=ts?ts.scrollTop:0;
  renderExtrato(c);
  if(st>0)requestAnimationFrame(()=>{const el=document.getElementById('content').querySelector('.tbl-scroll');if(el)el.scrollTop=st;});
}

function clearExtratoSelectionState(){
  selectedExtratoIds.clear();
}
function clearExtratoSelection(){
  clearExtratoSelectionState();
  document.querySelectorAll('.extrato-chk').forEach(c=>c.checked=false);
  updateExtratoSelectionInfo();
}
function toggleSelectAllExtrato(checked){
  document.querySelectorAll('.extrato-chk').forEach(c=>{
    c.checked=checked;
    if(checked)selectedExtratoIds.add(c.value);
    else selectedExtratoIds.delete(c.value);
  });
  updateExtratoSelectionInfo();
}
function updateExtratoSelectionInfo(){
  document.querySelectorAll('.extrato-chk').forEach(c=>{
    if(c.checked)selectedExtratoIds.add(c.value);
    else selectedExtratoIds.delete(c.value);
  });
  const items=[...selectedExtratoIds].map(id=>DATA.find(l=>l.id===id)).filter(Boolean);
  const entradas=items.filter(l=>l.tipo==='R').reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  const saidas=items.filter(l=>l.tipo==='D').reduce((s,l)=>s+parseMoney(l.valorLiq),0);
  const liquido=entradas-saidas;
  const box=document.getElementById('extrato-selection-info');
  const count=document.getElementById('extrato-selection-count');
  const ent=document.getElementById('extrato-total-entradas');
  const sai=document.getElementById('extrato-total-saidas');
  const liq=document.getElementById('extrato-total-liquido');
  const clearBtn=document.getElementById('extrato-clear-btn');
  const all=[...document.querySelectorAll('.extrato-chk')];
  const selAll=document.getElementById('extrato-sel-all');
  if(box)box.style.visibility=items.length?'visible':'hidden';
  if(clearBtn)clearBtn.style.display=items.length?'inline-flex':'none';
  if(count)count.textContent=`${items.length} selecionado(s)`;
  if(ent)ent.textContent=fmt(entradas);
  if(sai)sai.textContent=fmt(saidas);
  if(liq){
    liq.textContent=fmt(liquido);
    liq.style.color=liquido>=0?'var(--teal)':'var(--red)';
  }
  if(selAll)selAll.checked=all.length>0&&all.every(c=>selectedExtratoIds.has(c.value));
}

function renderExtrato(c){
  if(!filterExtratoConta){
    const pref=CONTAS_DATA.find(ct=>ct.nome==='Dominio Conta Digital');
    const first=CONTAS_DATA.find(ct=>(ct.tipo||'corrente')==='corrente');
    filterExtratoConta=pref?pref.nome:first?first.nome:(CONTAS[0]||'');
  }
  const hoje=new Date();
  if(!filterExtratoInicio)filterExtratoInicio=`${YEAR}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  if(!filterExtratoFim){const ld=new Date(YEAR,hoje.getMonth()+1,0);filterExtratoFim=ld.toISOString().slice(0,10);}
  const{rows,saldoAntes,saldoFinal}=calcExtrato();
  const visibleIds=new Set(rows.map(r=>r.id));
  selectedExtratoIds=new Set([...selectedExtratoIds].filter(id=>visibleIds.has(id)));
  const inp='background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:6px 10px;font-size:13px;outline:none;color-scheme:dark';
  const ST='position:sticky;top:0;z-index:5;background:var(--s2)';
  const exHdr=(lbl,col,align='left',px='8')=>{
    if(lbl==='__chk')return`<th style="${ST};padding:10px 8px;text-align:center;white-space:nowrap"><input type="checkbox" id="extrato-sel-all" onchange="toggleSelectAllExtrato(this.checked)" style="width:15px;height:15px;cursor:pointer"/></th>`;
    const base=`${ST};padding:10px ${px}px;text-align:${align};font-size:12px;color:var(--tx2);font-weight:600`;
    if(!col)return`<th style="${base};white-space:nowrap">${lbl}</th>`;
    const cls=sortExtrato.col===col?sortExtrato.dir:'';
    return`<th class="th-sort ${cls}" style="${base}" onclick="sortExtratoBy('${col}')" title="Ordenar por ${lbl} dentro do dia">${lbl}<span class="sort-ico"></span></th>`;
  };
  c.innerHTML=`<div class="tbl-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 116px);overflow:visible">
  <div style="padding:12px 18px 10px;flex-shrink:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap">
    <div class="fg"><select onchange="clearExtratoSelectionState();filterExtratoConta=this.value;renderExtrato(document.getElementById('content'))">
      ${CONTAS_DATA.map(ct=>`<option value="${esc(ct.nome)}"${filterExtratoConta===ct.nome?' selected':''}>${esc(ct.nome)}${ct.tipo==='investimento'?' (Invest.)':''}</option>`).join('')}
    </select></div>
    <input id="extrato-ini" type="date" value="${filterExtratoInicio}" style="${inp};width:148px" onblur="if(event.relatedTarget?.id==='extrato-fim'){filterExtratoInicio=this.value;}else{clearExtratoSelectionState();filterExtratoInicio=this.value;renderExtrato(document.getElementById('content'));}" onchange="filterExtratoInicio=this.value"/>
    <span style="font-size:12px;color:var(--tx2);white-space:nowrap">até</span>
    <input id="extrato-fim" type="date" value="${filterExtratoFim}" style="${inp};width:148px" onblur="clearExtratoSelectionState();filterExtratoFim=this.value;renderExtrato(document.getElementById('content'))" onchange="filterExtratoFim=this.value"/>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2);cursor:pointer;white-space:nowrap">
      <input type="checkbox" ${filterExtratoInclPend?'checked':''} onchange="clearExtratoSelectionState();filterExtratoInclPend=this.checked;renderExtrato(document.getElementById('content'))" style="width:14px;height:14px"/>
      Incluir pendentes
    </label>
    <div id="extrato-selection-info" style="visibility:hidden;display:flex;align-items:center;gap:8px;flex-wrap:nowrap;margin-left:8px;min-width:0">
      <span id="extrato-selection-count" class="cbadge" style="white-space:nowrap"></span>
      <span class="cbadge" style="white-space:nowrap">Entradas: <strong id="extrato-total-entradas" style="color:var(--teal)">R$ 0,00</strong></span>
      <span class="cbadge" style="white-space:nowrap">Saídas: <strong id="extrato-total-saidas" style="color:var(--red)">R$ 0,00</strong></span>
      <span class="cbadge" style="white-space:nowrap">Líquido: <strong id="extrato-total-liquido">R$ 0,00</strong></span>
    </div>
    <button class="btn btn-ghost" style="font-size:12px;margin-left:auto;white-space:nowrap" onclick="exportExtratoExcel()">${appIcon('download')}Exportar Excel</button>
    <button class="btn btn-ghost" id="extrato-clear-btn" style="display:none;font-size:12px" onclick="clearExtratoSelection()">✕ Limpar Seleção</button>
  </div></div>
  <div class="tbl-scroll" style="flex:1;overflow:auto">
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--s2);border-bottom:2px solid var(--bd2)">
      ${exHdr('__chk')}
      ${exHdr('Data','','left','12')}
      ${exHdr('Competência','dataComp')}
      ${exHdr('Tipo','tipo')}
      ${exHdr('Categoria','cat')}
      ${exHdr('Subcategoria','sub')}
      ${exHdr('Descrição','desc')}
      ${exHdr('Valor','valorLiq','right','12')}
      ${exHdr('Saldo','','right','12')}
      ${exHdr('','','center','8')}
    </tr></thead>
    <tbody>
      <tr style="background:rgba(88,166,255,.035);border-bottom:1px solid var(--bd)">
        <td style="padding:9px 8px;text-align:center"></td>
        <td style="padding:9px 12px;white-space:nowrap;color:var(--tx3)">—</td>
        <td style="padding:9px 8px;color:var(--tx3);font-size:12px">—</td>
        <td style="padding:9px 8px"><span class="badge bx">Saldo</span></td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px">Abertura</td>
        <td style="padding:9px 8px;color:var(--tx3);font-size:12px">—</td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px;font-style:italic">Saldo anterior ao período</td>
        <td style="padding:9px 12px;text-align:right;color:var(--tx3)">—</td>
        <td style="padding:9px 12px;text-align:right;font-weight:700;color:${saldoAntes>=0?'var(--teal)':'var(--red)'}">${fmt(saldoAntes)}</td>
        <td style="padding:9px 8px"></td>
      </tr>
      ${rows.length?rows.map(r=>`<tr style="border-bottom:1px solid var(--bd);${r.isPend?'opacity:.6':''};cursor:pointer" class="lr" onclick="openEdit('${r.id}')">
        <td style="padding:9px 8px;text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="extrato-chk" value="${r.id}" ${selectedExtratoIds.has(r.id)?'checked':''} onchange="updateExtratoSelectionInfo()" style="width:15px;height:15px;cursor:pointer"/></td>
        <td style="padding:9px 12px;white-space:nowrap">${dateBR(r.dataPgto)}</td>
        <td style="padding:9px 8px;white-space:nowrap;color:var(--tx2);font-size:12px">${compDisplay(r.dataComp)||'—'}</td>
        <td style="padding:9px 8px"><span class="tp ${(r.doc||'').startsWith('TRANSF#')?'t':r.tipo==='R'?'r':'d'}">${(r.doc||'').startsWith('TRANSF#')?`${appIcon('transfer','app-icon tp-icon')} Transf`:r.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`}</span></td>
        <td style="padding:9px 8px"><span class="ct">${esc(r.cat)}</span></td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px">${esc(r.sub||'—')}</td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px">${esc(r.desc||'—')}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:600;white-space:nowrap;color:${r.tipo==='R'?'var(--teal)':'var(--red)'}">${r.tipo==='R'?'+':'-'} ${fmt(r.valorLiq)}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:700;white-space:nowrap;color:${r.saldo>=0?'var(--teal)':'var(--red)'}${r.isPend?';font-style:italic':''}">${fmt(r.saldo)}</td>
        <td style="padding:7px 8px;text-align:right" onclick="event.stopPropagation()">
          <button class="btn" title="Excluir lançamento" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${r.id}')">${appIcon('trash')}</button>
        </td>
      </tr>`).join(''):`<tr><td colspan="10" class="empty-row">Nenhum lançamento no período</td></tr>`}
    </tbody>
    <tfoot style="position:sticky;bottom:0;z-index:2">
      <tr style="background:var(--s2);border-top:2px solid var(--bd2)">
        <td colspan="7" style="padding:11px 12px;font-size:13px;font-weight:700">Saldo final do período</td>
        <td></td>
        <td style="padding:11px 12px;text-align:right;font-size:14px;font-weight:700;color:${saldoFinal>=0?'var(--teal)':'var(--red)'}">${fmt(saldoFinal)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table></div></div>`;
  updateExtratoSelectionInfo();
}

function calcContaCards(includeInvestimentos=true){
  const contasVis=CONTAS_DATA.filter(c=>includeInvestimentos||(c.tipo||'corrente')==='corrente');
  return contasVis.map(conta=>{
    const lan=DATA.filter(l=>l.conta===conta.nome);
    const ini=parseFloat(conta.saldo_inicial)||0;
    const realizados=lan.filter(l=>l.status==='Pago'||l.status==='Recebido'||l.status==='Parcial')
      .reduce((s,l)=>s+(l.tipo==='R'?parseMoney(l.valorLiq):-parseMoney(l.valorLiq)),0);
    const pendentes=lan.filter(l=>l.status==='Pendente'||l.status==='Parcial')
      .reduce((s,l)=>{
        const v=l.status==='Parcial'?Math.max(0,parseMoney(l.valorBruto)-parseMoney(l.valorLiq)):parseMoney(l.valorLiq);
        return s+(l.tipo==='R'?v:-v);
      },0);
    const hasRealCredit=doc=>DATA.some(cr=>cr.doc===doc&&cr.conta===conta.nome&&cr.tipo==='R');
    const legacyTransfs=DATA.filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')&&l.obs.slice(12)===conta.nome&&!hasRealCredit(l.doc));
    const transfCredReal=legacyTransfs.filter(l=>l.status==='Pago'||l.status==='Recebido'||l.status==='Parcial').reduce((s,l)=>s+parseMoney(l.valorLiq),0);
    const transfCredPend=legacyTransfs.filter(l=>l.status==='Pendente'||l.status==='Parcial').reduce((s,l)=>s+(l.status==='Parcial'?Math.max(0,parseMoney(l.valorBruto)-parseMoney(l.valorLiq)):parseMoney(l.valorLiq)),0);
    const atual=ini+realizados+transfCredReal;
    return{nome:conta.nome,tipo:conta.tipo||'corrente',atual,projetado:atual+pendentes+transfCredPend};
  });
}

function renderDashboardSaldoCards(){
  const cards=calcContaCards(true);
  if(!cards.length)return'';
  return`<div class="card" style="padding:14px 18px;margin-bottom:14px">
    <div class="card-ttl" style="margin-bottom:12px">Saldo atualizado por conta</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px">
      ${cards.map(c=>`<div style="background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:11px 13px;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome)}</div>
          ${c.tipo==='investimento'?`<span class="cbadge" style="font-size:10px;padding:1px 6px">Invest.</span>`:''}
        </div>
        <div style="font-size:11px;color:var(--tx3);margin-bottom:2px">Atual</div>
        <div style="font-size:18px;font-weight:800;color:${c.atual>=0?'var(--teal)':'var(--red)'};white-space:nowrap">${fmt(c.atual)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:11px;color:var(--tx2)">
          <span>Projetado</span><strong style="color:${c.projetado>=0?'var(--tx2)':'var(--red)'};white-space:nowrap">${fmt(c.projetado)}</strong>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderDashboard(c){
  const dre=calcDRE(YEAR),fluxo=calcFluxo(YEAR),sum=k=>dre.reduce((s,m)=>s+m[k],0);
  const totRec=sum('recOpLiq'),totDesp=sum('totDesp'),totLL=sum('ll'),saldoFin=fluxo[11].saldoFin;
  const pend=DATA.filter(l=>l.status==='Pendente'||l.status==='Parcial');
  const totalPend=pend.reduce((s,l)=>s+(l.status==='Parcial'?Math.max(0,parseMoney(l.valorBruto)-parseMoney(l.valorLiq)):parseMoney(l.valorLiq)),0);
  const kpis=[
    {lbl:'Receita Líquida',val:fmt(totRec),sub:`Margem: ${fmtPct(totRec?totLL/totRec:0)}`,cls:'k-teal'},
    {lbl:'Lucro Líquido',val:fmt(totLL),sub:fmtPct(totRec?totLL/totRec:0),cls:'k-green'},
    {lbl:'Saldo de Caixa',val:fmt(saldoFin),sub:'Posição atual',cls:saldoFin>=0?'k-teal':'k-red'},
    {lbl:'Total Despesas',val:fmt(totDesp),sub:`Índice: ${fmtPct(totRec?totDesp/totRec:0)}`,cls:'k-orange'},
    {lbl:'Pendentes',val:fmt(totalPend),sub:`${pend.length} lançamento(s)`,cls:'k-yellow'},
  ];
  let html='<div class="kpi-grid">';
  kpis.forEach(k=>{html+=`<div class="kpi ${k.cls}"><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`;});
  html+=`</div>${renderDashboardSaldoCards()}<div class="charts-row"><div class="card wide"><div class="card-ttl">Receita vs Despesas vs Lucro <span class="yr-pill">${YEAR}</span></div><canvas id="chart-main" height="220"></canvas></div><div class="card" style="margin-bottom:0"><div class="card-ttl" style="display:flex;align-items:center;justify-content:space-between"><span id="pie-ttl">${(window._pieMode||'D')==='D'?'Despesas':'Receitas'} por Categoria</span><div style="display:flex;gap:4px"><button id="pie-btn-d" class="btn btn-ghost" style="font-size:11px;padding:3px 9px;opacity:${(window._pieMode||'D')==='D'?'1':'.45'}" onclick="setPieMode('D')">Despesas</button><button id="pie-btn-r" class="btn btn-ghost" style="font-size:11px;padding:3px 9px;opacity:${(window._pieMode||'D')==='R'?'1':'.45'}" onclick="setPieMode('R')">Receitas</button></div></div><canvas id="chart-pie" height="240"></canvas><div id="pie-legend" class="pie-legend"></div></div></div><div id="pie-tooltip" class="pie-tooltip"></div>`;
  html+=`<div class="card"><div class="card-ttl">Fluxo de Caixa — Saldo Final Mensal <span class="yr-pill">${YEAR}</span></div><canvas id="chart-fluxo" height="170"></canvas></div>`;
  if(pend.length>0){
    html+=`<div class="pend-card"><div class="card-ttl">⚠️ Contas Pendentes</div><div class="pend-list">`;
    pend.slice(0,8).forEach(l=>{const isR=l.tipo==='R';html+=`<div class="pend-row"><span class="pt ${isR?'r':'d'}">${isR?appIcon('arrowDown','app-icon tp-icon'):appIcon('arrowUp','app-icon tp-icon')}</span><span class="pdesc">${esc(l.desc||l.sub||l.cat)}</span><span class="pcat">${esc(l.cat)}</span><span class="pdata">${l.dataPgto||'—'}</span><span class="pval ${isR?'r':'d'}">${fmt(l.valorLiq)}</span></div>`;});
    html+='</div></div>';
  }
  c.innerHTML=html;
  setTimeout(()=>{
    drawBarChart('chart-main',MONTHS,[{label:'Receita',data:dre.map(m=>m.recOpLiq),color:'#39d353'},{label:'Despesas',data:dre.map(m=>m.totDesp),color:'#f85149'},{label:'Lucro',data:dre.map(m=>m.ll),color:'#58a6ff'}]);
    const pieMode=window._pieMode||'D';
    const pieSrc=pieMode==='D'?getDespCats():getRecCats();
    const piePfx=pieMode==='D'?'d_':'r_';
    const pieCategs=pieSrc.map(cat=>({lbl:cat.nome,val:sum(piePfx+(cat.slug||slugify(cat.nome)))})).filter(d=>d.val>0);
    drawPieChart('chart-pie',pieCategs,pieMode);
    drawBarChartSingle('chart-fluxo',MONTHS,fluxo.map(m=>m.saldoFin));
  },0);
}

function drawBarChart(id,labels,series){
  const canvas=document.getElementById(id);if(!canvas)return;
  const ctx=canvas.getContext('2d');canvas.width=canvas.parentElement.clientWidth-40||canvas.offsetWidth;
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
  const PAD={top:20,right:20,bottom:30,left:60},cW=W-PAD.left-PAD.right,cH=H-PAD.top-PAD.bottom;
  const allVals=series.flatMap(s=>s.data),maxV=Math.max(...allVals,0),minV=Math.min(...allVals,0),range=maxV-minV||1;
  const toY=v=>PAD.top+cH-((v-minV)/range*cH),barW=(cW/labels.length)/(series.length+1);
  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=PAD.top+(cH/4)*i;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(PAD.left+cW,y);ctx.stroke();const val=maxV-(range/4*i);ctx.fillStyle='#484f58';ctx.font='10px system-ui';ctx.textAlign='right';ctx.fillText(val>=1000?`${(val/1000).toFixed(0)}k`:val.toFixed(0),PAD.left-4,y+3);}
  if(minV<0){const zy=toY(0);ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.left,zy);ctx.lineTo(PAD.left+cW,zy);ctx.stroke();}
  labels.forEach((lbl,li)=>{const xCenter=PAD.left+(li+0.5)*(cW/labels.length);series.forEach((s,si)=>{const x=xCenter-(series.length/2-si)*barW-barW/2,v=s.data[li],y0=toY(0),y1=toY(v),bH=Math.abs(y1-y0)||1;ctx.fillStyle=s.color+'cc';ctx.fillRect(x,Math.min(y0,y1),barW-2,bH);});ctx.fillStyle='#8b949e';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(lbl,xCenter,H-8);});
  let lx=PAD.left;series.forEach(s=>{ctx.fillStyle=s.color;ctx.fillRect(lx,4,10,8);ctx.fillStyle='#8b949e';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText(s.label,lx+13,12);lx+=80;});
}

function drawBarChartSingle(id,labels,data){
  const canvas=document.getElementById(id);if(!canvas)return;
  const ctx=canvas.getContext('2d');canvas.width=canvas.parentElement.clientWidth-40||canvas.offsetWidth;
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
  const PAD={top:15,right:20,bottom:28,left:60},cW=W-PAD.left-PAD.right,cH=H-PAD.top-PAD.bottom;
  const maxV=Math.max(...data,0),minV=Math.min(...data,0),range=maxV-minV||1;
  const toY=v=>PAD.top+cH-((v-minV)/range*cH),barW=cW/labels.length*0.6;
  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
  for(let i=0;i<=3;i++){const y=PAD.top+(cH/3)*i;ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(PAD.left+cW,y);ctx.stroke();const val=maxV-(range/3*i);ctx.fillStyle='#484f58';ctx.font='10px system-ui';ctx.textAlign='right';ctx.fillText(val>=1000?`${(val/1000).toFixed(0)}k`:val.toFixed(0),PAD.left-4,y+3);}
  const zy=toY(0);ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.left,zy);ctx.lineTo(PAD.left+cW,zy);ctx.stroke();
  labels.forEach((lbl,i)=>{const xC=PAD.left+(i+0.5)*(cW/labels.length),v=data[i],y1=toY(v),y0=toY(0),bH=Math.abs(y1-y0)||1;ctx.fillStyle=v>=0?'#39d353bb':'#f85149bb';ctx.beginPath();ctx.roundRect(xC-barW/2,Math.min(y0,y1),barW,bH,[3,3,0,0]);ctx.fill();ctx.fillStyle='#8b949e';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(lbl,xC,H-8);});
}

function drawPieChart(id,data,mode){
  let canvas=document.getElementById(id);if(!canvas)return;
  const origH=canvas.height;
  const nc=canvas.cloneNode(false);
  canvas.parentNode.replaceChild(nc,canvas);
  canvas=nc;
  canvas.height=origH;
  const ctx=canvas.getContext('2d');
  canvas.width=canvas.offsetWidth||canvas.parentElement?.offsetWidth-40||300;
  const W=canvas.width,H=canvas.height;
  const leg=document.getElementById('pie-legend'),tip=document.getElementById('pie-tooltip');
  if(!data.length){
    ctx.fillStyle='#484f58';ctx.font='13px system-ui';ctx.textAlign='center';
    ctx.fillText((mode||'D')==='R'?'Nenhuma receita lançada':'Nenhuma despesa lançada',W/2,H/2);
    if(leg)leg.innerHTML='';return;
  }
  const COLS=['#39d353','#f778ba','#e3b341','#58a6ff','#bc8cff','#f0883e','#56d364','#79c0ff','#ffa657','#ff7b72'];
  const total=data.reduce((s,d)=>s+d.val,0);
  const cx=W/2,cy=H/2,r=Math.min(W/2,H/2)*0.84,ri=r*0.52;
  const slices=[];let angle=-Math.PI/2;
  data.forEach((d,i)=>{const sweep=(d.val/total)*Math.PI*2;slices.push({start:angle,end:angle+sweep,lbl:d.lbl,val:d.val,color:COLS[i%COLS.length],pct:d.val/total});angle+=sweep;});
  function drawSlices(hov){
    ctx.clearRect(0,0,W,H);
    slices.forEach((s,i)=>{
      const isH=i===hov,off=isH?7:0,mid=(s.start+s.end)/2;
      ctx.save();ctx.translate(Math.cos(mid)*off,Math.sin(mid)*off);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,isH?r+5:r,s.start,s.end);ctx.closePath();
      ctx.fillStyle=isH?s.color:s.color+'cc';ctx.fill();
      ctx.strokeStyle='#0d1117';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    });
    ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle='#161b22';ctx.fill();
    if(hov>=0&&slices[hov]){
      const s=slices[hov];
      ctx.fillStyle='#e6edf3';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(fmtPct(s.pct),cx,cy-4);
      ctx.fillStyle='#8b949e';ctx.font='11px system-ui';ctx.fillText(fmt(s.val),cx,cy+13);
    }
  }
  drawSlices(-1);
  if(leg){
    leg.innerHTML=slices.map(s=>`<div class="pie-leg-item" onclick="pieClickCat(${JSON.stringify(s.lbl)},${JSON.stringify(mode||'D')})"><span class="pie-leg-dot" style="background:${s.color}"></span><span class="pie-leg-name">${esc(s.lbl)}</span><span class="pie-leg-pct">${fmtPct(s.pct)}</span><span class="pie-leg-val">${fmt(s.val)}</span></div>`).join('');
  }
  function hitTest(cx2,cy2,ex,ey){
    const rect=canvas.getBoundingClientRect();
    const dx=ex-rect.left-cx2,dy=ey-rect.top-cy2,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<ri-2||dist>r+8)return -1;
    let a=Math.atan2(dy,dx);if(a<slices[0].start)a+=Math.PI*2;
    for(let i=0;i<slices.length;i++)if(a>=slices[i].start&&a<=slices[i].end)return i;
    return -1;
  }
  canvas.addEventListener('mousemove',e=>{
    const i=hitTest(cx,cy,e.clientX,e.clientY);
    drawSlices(i);
    if(i>=0&&tip){const s=slices[i];tip.style.display='block';tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-10)+'px';tip.innerHTML=`<strong>${esc(s.lbl)}</strong><br>${fmt(s.val)} <span style="color:#8b949e">(${fmtPct(s.pct)})</span>`;}
    else if(tip)tip.style.display='none';
    canvas.style.cursor=i>=0?'pointer':'default';
  });
  canvas.addEventListener('mouseleave',()=>{drawSlices(-1);if(tip)tip.style.display='none';canvas.style.cursor='default';});
  canvas.addEventListener('click',e=>{const i=hitTest(cx,cy,e.clientX,e.clientY);if(i>=0)pieClickCat(slices[i].lbl,mode||'D');});
}

function setPieMode(m){
  window._pieMode=m;
  const dre=calcDRE(YEAR),sum=k=>dre.reduce((s,r)=>s+(r[k]||0),0);
  const src=m==='D'?getDespCats():getRecCats(),pfx=m==='D'?'d_':'r_';
  const cats=src.map(cat=>({lbl:cat.nome,val:sum(pfx+(cat.slug||slugify(cat.nome)))})).filter(d=>d.val>0);
  const ttl=document.getElementById('pie-ttl');if(ttl)ttl.textContent=(m==='D'?'Despesas':'Receitas')+' por Categoria';
  const bd=document.getElementById('pie-btn-d'),br=document.getElementById('pie-btn-r');
  if(bd)bd.style.opacity=m==='D'?'1':'.45';if(br)br.style.opacity=m==='R'?'1':'.45';
  drawPieChart('chart-pie',cats,m);
}

function pieClickCat(cat,tipo){
  filterTipos=new Set([tipo]);filterCats=new Set([cat]);filterSub='';
  TAB='receber';buildNav();render();
}

function renderDRE(c){
  const dre=calcDRE(YEAR);
  const recCats=getRecCats().filter(c=>!isExclDRE(c));
  const despCats=getDespCats().filter(c=>!isExclDRE(c));
  const tot=k=>dre.reduce((s,m)=>s+(m[k]||0),0);
  const mHdr=MONTHS.map(m=>`<th>${m}</th>`).join('');

  // Estado de expansão
  if(!window._dreExpanded) window._dreExpanded={};

  function row(lbl,k,type='normal',groupId=null,parentId=null){
    const isTotal   = type==='total';
    const isSep     = type==='sep';
    const isGroup   = type==='group';
    const isSub     = type==='sub';
    const isResult  = type==='result';

    if(isSep) return `<tr class="sep"><td colspan="14">${lbl}</td></tr>`;

    const expanded = groupId ? (window._dreExpanded[groupId]!==false) : true;
    const hasSubs  = groupId && !parentId;

    const cells=dre.map(m=>{
      const v=m[k]||0;
      return`<td class="${v<0?'neg':v>0?'pos':''}" style="font-size:11.5px">${v!==0?fmt(v):'—'}</td>`;
    }).join('');
    const tv=tot(k);

    let style='';
    let tdStyle=`padding-left:${isSub?40:isGroup?20:12}px`;
    let cls='dr';
    if(isTotal||isResult) cls+=' bold';
    if(isResult) cls+=' hl';
    if(type==='lucro') cls+=' tot';

    // Linha oculta se for subcategoria de grupo fechado
    if(parentId&&window._dreExpanded[parentId]===false) style='display:none';

    const toggleBtn = hasSubs ? `<span onclick="toggleDRE('${groupId}')" style="cursor:pointer;margin-right:6px;font-size:10px;display:inline-block;width:12px">${expanded?'▼':'▶'}</span>` : `<span style="display:inline-block;width:18px"></span>`;

    return`<tr class="${cls}" id="dre-row-${groupId||k}" style="${style}">
      <td style="${tdStyle}">${toggleBtn}${lbl}</td>${cells}
      <td class="${tv<0?'neg':tv>0?'pos':''} tc" style="font-weight:${isTotal||isResult||type==='lucro'?700:400}">${tv!==0?fmt(tv):'—'}</td>
    </tr>`;
  }

  function groupRows(cat, tipo){
    const k = tipo==='R' ? 'r_'+(cat.slug||slugify(cat.nome)) : 'd_'+(cat.slug||slugify(cat.nome));
    const gid = k;
    const subs = (cat.subs||[]).sort((a,b)=>a.ordem-b.ordem);
    let html = row(cat.nome, k, 'group', gid);
    subs.forEach(sub=>{
      const sk = tipo==='R' ? 'rs_'+(sub.slug||slugify(sub.nome)) : 'ds_'+(sub.slug||slugify(sub.nome));
      html += row(sub.nome, sk, 'sub', sk, gid);
    });
    return html;
  }

  const recOpCats    = recCats.filter(c=>!isNaoOpDRE(c));
  const recNaoOpCats = recCats.filter(c=>isNaoOpDRE(c));

  // Grupos de despesas — dinâmico: Pessoal e Impostos e Taxas têm seções próprias, resto vai em Despesas Operacionais
  const despOpBase   = despCats.filter(c=>!isNaoOpDRE(c));
  const despNaoOpCats= despCats.filter(c=>isNaoOpDRE(c));
  const impostoCat  = despOpBase.find(c=>(c.slug||slugify(c.nome))==='impostos_e_taxas');
  const pessoalCat  = despOpBase.find(c=>(c.slug||slugify(c.nome))==='pessoal');
  const EXCL_SLUGS  = ['pessoal','impostos_e_taxas'];
  const despOpCats  = despOpBase.filter(c=>!EXCL_SLUGS.includes(c.slug||slugify(c.nome)));

  const g=(cat,tipo)=>cat?groupRows(cat,tipo):'';

  c.innerHTML=`
  <div class="tbl-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 116px);overflow:visible">
    <div class="tbl-hdr" style="display:flex;align-items:center;justify-content:space-between">
      <div class="sec-ttl">DRE — Regime de Competência <span class="yr-pill">${YEAR}</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost" style="font-size:12px" onclick="exportDREExcel()">${appIcon('download')}Exportar Excel</button>
        <button class="btn btn-ghost" style="font-size:12px" onclick="toggleAllDRE()">⊞ Expandir/Recolher tudo</button>
      </div>
    </div>
    <div class="tbl-scroll" style="flex:1;overflow:auto"><table class="fin-tbl resizable">${renderFinColgroup()}<thead>${renderFinHead()}</thead>
      <tbody>
        ${row('RECEITAS OPERACIONAIS','','sep')}
        ${recOpCats.map(cat=>groupRows(cat,'R')).join('')}
        ${row('(=) RECEITA OPERACIONAL BRUTA','recOpBruta','result')}

        ${impostoCat?`${row('IMPOSTOS E TAXAS','','sep')}${g(impostoCat,'D')}`:''}
        ${row('(=) RECEITA OPERACIONAL LÍQUIDA','recOpLiq','result')}

        ${pessoalCat?`${row('CUSTO COM PESSOAL','','sep')}${g(pessoalCat,'D')}${row('(=) CUSTO COM PESSOAL','cusPessoal','total')}`:''}
        ${row('(=) LUCRO OPERACIONAL BRUTO','lucOpBruto','result')}

        ${despOpCats.length?`${row('DESPESAS OPERACIONAIS','','sep')}${despOpCats.map(cat=>g(cat,'D')).join('')}${row('(=) DESPESAS OPERACIONAIS','despOp','total')}`:''}
        ${row('(=) RESULTADO OPERACIONAL','resOp','result')}

        ${recNaoOpCats.length?`${row('RECEITAS NÃO OPERACIONAIS','','sep')}${recNaoOpCats.map(cat=>groupRows(cat,'R')).join('')}${row('(=) RECEITAS NÃO OPERACIONAIS','outrasRec','total')}`:''}
        ${despNaoOpCats.length?`${row('DESPESAS NÃO OPERACIONAIS','','sep')}${despNaoOpCats.map(cat=>groupRows(cat,'D')).join('')}${row('(=) DESPESAS NÃO OPERACIONAIS','despNaoOp','total')}`:''}

        ${row('RESULTADO FINAL','ll','lucro')}
      </tbody>
    </table></div>
  </div>`;
}

function toggleDRE(groupId){
  if(!window._dreExpanded) window._dreExpanded={};
  window._dreExpanded[groupId] = window._dreExpanded[groupId]===false ? true : false;
  // Toggle visibility of sub rows
  document.querySelectorAll(`[id^="dre-row-"]`).forEach(tr=>{
    // Check if this row's parent is the toggled group
    const cells=tr.querySelectorAll('td');
    if(!cells.length) return;
  });
  // Re-render to apply
  renderDRE(document.getElementById('content'));
}

function toggleAllDRE(){
  if(!window._dreExpanded) window._dreExpanded={};
  const allExpanded=Object.values(window._dreExpanded).every(v=>v!==false);
  // Toggle all known groups
  const recCats=getRecCats(), despCats=getDespCats();
  [...recCats,...despCats].forEach(c=>{
    const k=(c.tipo==='R'?'r_':'d_')+(c.slug||slugify(c.nome));
    window._dreExpanded[k]=allExpanded?false:true;
  });
  renderDRE(document.getElementById('content'));
}

function renderFluxo(c){
  const f=calcFluxo(YEAR);
  const recCats=getRecCats();
  const despCats=getDespCats();
  const tot=k=>f.reduce((s,m)=>s+(m[k]||0),0);

  function row(lbl,k,bold,indent,cls='',neg=false){
    const cells=f.map(m=>{const v=(neg?-1:1)*(m[k]||0);return`<td class="${v<0?'neg':'pos'}">${fmt(v)}</td>`;}).join('');
    const tv=(neg?-1:1)*tot(k);
    return`<tr class="dr${bold?' bold':''} ${cls}"><td style="padding-left:${indent?28:12}px">${lbl}</td>${cells}<td class="${tv<0?'neg':'pos'} tc">${fmt(tv)}</td></tr>`;
  }
  const sep=lbl=>`<tr class="sep"><td colspan="14">${lbl}</td></tr>`;

  const recCatsVis=recCats.filter(cat=>(cat.slug||slugify(cat.nome))!==TRANSF_SLUG);
  const despCatsVis=despCats.filter(cat=>(cat.slug||slugify(cat.nome))!==TRANSF_SLUG);
  const entradasOpRows=recCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>row(cat.nome,'r_'+(cat.slug||slugify(cat.nome)),false,true)).join('');
  const saidasOpRows=despCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>row(cat.nome,'d_'+(cat.slug||slugify(cat.nome)),false,true,'',true)).join('');
  const entradasNaoOpRows=recCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>row(cat.nome,'r_'+(cat.slug||slugify(cat.nome)),false,true)).join('');
  const saidasNaoOpRows=despCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>row(cat.nome,'d_'+(cat.slug||slugify(cat.nome)),false,true,'',true)).join('');
  const hasNaoOp=recCatsVis.some(c=>(c.fluxo||'operacional')==='nao_operacional')||despCatsVis.some(c=>(c.fluxo||'operacional')==='nao_operacional');

  // Per-account saldo calculation
  const paidData=DATA.filter(l=>(l.status==='Pago'||l.status==='Recebido')&&l.dataPgto&&getY(l.dataPgto)===YEAR);
  const contaFlows={};
  paidData.forEach(l=>{const c=l.conta||'(Sem conta)';if(!contaFlows[c])contaFlows[c]=Array(12).fill(0);});
  // Include destination accounts from new-style single-record transfers
  paidData.filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')).forEach(l=>{
    const dest=l.obs.slice(12);if(dest&&!contaFlows[dest])contaFlows[dest]=Array(12).fill(0);
  });
  const contaOrder=CONTAS_DATA.map(c=>c.nome);
  const contaSet=[...new Set(Object.keys(contaFlows))].sort((a,b)=>{const ia=contaOrder.indexOf(a),ib=contaOrder.indexOf(b);if(ia<0&&ib<0)return a.localeCompare(b);if(ia<0)return 1;if(ib<0)return -1;return ia-ib;});
  paidData.forEach(l=>{
    const i=getM(l.dataPgto),v=parseMoney(l.valorLiq);
    const conta=l.conta||'(Sem conta)';
    contaFlows[conta][i]+=(l.tipo==='R'?v:-v);
    // New-style transfer: also credit destination account
    if((l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')){
      const dest=l.obs.slice(12);if(dest&&!paidData.some(cr=>cr.doc===l.doc&&cr.conta===dest&&cr.tipo==='R'))contaFlows[dest][i]+=v;
    }
  });
  const contaRows=contaSet.map(conta=>{
    const vals=contaFlows[conta];
    const cells=vals.map(v=>`<td class="${v<0?'neg':'pos'}">${fmt(v)}</td>`).join('');
    const tv=vals.reduce((s,v)=>s+v,0);
    return`<tr class="dr"><td style="padding-left:28px">${esc(conta)}</td>${cells}<td class="${tv<0?'neg':'pos'} tc">${fmt(tv)}</td></tr>`;
  }).join('');

  // Per-account closing balance: saldo_inicial + cumulative monthly flows
  const contaSaldoFin={};
  contaSet.forEach(conta=>{
    const ini=parseFloat(CONTAS_DATA.find(c=>c.nome===conta)?.saldo_inicial)||0;
    let cum=ini;
    contaSaldoFin[conta]=contaFlows[conta].map(v=>{cum+=v;return cum;});
  });
  const totalSaldoFinVals=Array(12).fill(0);
  contaSet.forEach(conta=>contaSaldoFin[conta].forEach((v,i)=>totalSaldoFinVals[i]+=v));
  const mkBalRow=(lbl,vals,bold,indent,cls='')=>{
    const cells=vals.map(v=>`<td class="${v<0?'neg':'pos'}">${fmt(v)}</td>`).join('');
    const tv=vals[vals.length-1];
    return`<tr class="dr${bold?' bold':''} ${cls}"><td style="padding-left:${indent?28:12}px">${lbl}</td>${cells}<td class="${tv<0?'neg':'pos'} tc">${fmt(tv)}</td></tr>`;
  };
  const contaSaldoFinRows=contaSet.map(conta=>mkBalRow(esc(conta),contaSaldoFin[conta],false,true)).join('');
  const totalSaldoFinRow=mkBalRow('SALDO FINAL TOTAL',totalSaldoFinVals,true,false,'tot-bal');

  let projSection='';
  if(showFluxoProj){
    const pendData=DATA.filter(l=>{
      if(l.status!=='Pendente')return false;
      const d=l.dataPgto||l.dataComp;
      return d&&getY(d)===YEAR;
    });
    const projEnt=Array(12).fill(0);
    const projSai=Array(12).fill(0);
    pendData.forEach(l=>{
      const d=l.dataPgto||l.dataComp;
      const i=getM(d);
      if(i==null||i<0||i>11)return;
      const v=parseMoney(l.valorLiq);
      if(l.tipo==='R')projEnt[i]+=v;
      else projSai[i]+=v;
    });
    const projSaldoOp=projEnt.map((e,i)=>e-projSai[i]);
    let cumProj=0;
    const projSaldoFin=f.map((m,i)=>{cumProj+=projSaldoOp[i];return m.saldoFin+cumProj;});
    const mkRow=(lbl,vals,bold,cls='')=>{
      const cells=vals.map(v=>`<td class="${v<0?'neg':'pos'}">${fmt(v)}</td>`).join('');
      const tv=vals.reduce((s,v)=>s+v,0);
      return`<tr class="dr${bold?' bold':''} ${cls}"><td style="padding-left:12px">${lbl}</td>${cells}<td class="${tv<0?'neg':'pos'} tc">${fmt(tv)}</td></tr>`;
    };
    projSection=`<tr class="sep proj-sep"><td colspan="14">${appIcon('chart')} PROJEÇÃO — Lançamentos Pendentes</td></tr>
    ${mkRow('Entradas Previstas',projEnt,false,'proj-row')}
    ${mkRow('Saídas Previstas',projSai,false,'proj-row')}
    ${mkRow('Saldo Final Projetado',projSaldoFin,true,'proj-tot')}`;
  }

  c.innerHTML=`<div class="tbl-wrap"><div class="tbl-hdr" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="sec-ttl">Fluxo de Caixa — Regime de Caixa <span class="yr-pill">${YEAR}</span></div><div style="display:flex;gap:6px"><button class="btn btn-ghost" style="font-size:12px" onclick="exportFluxoExcel()">${appIcon('download')}Exportar Excel</button><button class="btn btn-ghost" style="font-size:12px;${showFluxoProj?'border-color:#58a6ff;color:#58a6ff':''}" onclick="toggleFluxoProj()">${appIcon('chart')} ${showFluxoProj?'Ocultar projetado':'Fluxo Projetado'}</button></div></div>
    <div class="tbl-scroll" style="max-height:calc(100vh - 190px);overflow-y:auto"><table class="fin-tbl resizable">${renderFinColgroup()}<thead>${renderFinHead()}</thead><tbody>
    ${sep('FLUXO OPERACIONAL')}
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--tx3)">ENTRADAS</td></tr>
    ${entradasOpRows}
    ${row('TOTAL ENTRADAS OPERACIONAIS','entradasOp',true,false,'hl')}
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--tx3)">SAÍDAS</td></tr>
    ${saidasOpRows}
    ${row('TOTAL SAÍDAS OPERACIONAIS','saidasOp',true,false,'',true)}
    ${row('(=) RESULTADO OPERACIONAL','resultadoOp',true,false,'tot')}
    ${hasNaoOp?`
    ${sep('NÃO-OPERACIONAL')}
    ${entradasNaoOpRows}
    ${saidasNaoOpRows}
    ${row('(=) RESULTADO NÃO-OPERACIONAL','resultadoNaoOp',true,false,'tot')}
    `:''}
    ${sep('SALDOS')}
    ${row('VARIAÇÃO TOTAL DE CAIXA','saldoOp',true,false,'tot')}
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--tx3)">VARIAÇÃO NO PERÍODO</td></tr>
    ${contaRows}
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--blue)">SALDO FINAL POR CONTA</td></tr>
    ${contaSaldoFinRows}
    ${totalSaldoFinRow}
    ${projSection}
    </tbody></table></div></div>`;
}

