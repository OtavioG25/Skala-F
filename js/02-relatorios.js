let _calcDreCache={};
let _calcFluxoCache={};
function clearFinanceCalcCache(){
  _calcDreCache={};
  _calcFluxoCache={};
}
function calcDRE(year){
  const cacheKey=`${year}:${DATA_VERSION}`;
  if(_calcDreCache[cacheKey])return _calcDreCache[cacheKey];
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
    const i=getM(l.dataComp),v=titleAmount(l);
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
  _calcDreCache[cacheKey]=m;
  return m;
}

function calcFluxo(year){
  const cacheKey=`${year}:${DATA_VERSION}`;
  if(_calcFluxoCache[cacheKey])return _calcFluxoCache[cacheKey];
  const despCats=getDespCats();
  const recCats=getRecCats();
  const base={entradas:0,totSaidas:0,saldoOp:0,saldoIni:0,saldoFin:0};
  recCats.forEach(c=>{ base['r_'+(c.slug||slugify(c.nome))]=0; });
  despCats.forEach(c=>{ base['d_'+(c.slug||slugify(c.nome))]=0; });
  const m=Array.from({length:12},()=>({...base}));

  cashMovements().forEach(l=>{
    if((l.doc||'').startsWith('TRANSF#'))return;
    if(!l.dataPgto||getY(l.dataPgto)!==year)return;
    const i=getM(l.dataPgto),v=parseMoney(l.valorLiq);
    if(l.tipo==='R'){const rc=recCats.find(c=>c.nome===l.cat);const rslug='r_'+(rc?(rc.slug||slugify(rc.nome)):slugify(l.cat));m[i][rslug]=(m[i][rslug]||0)+v;}
    else{const slug='d_'+catSlug(l.cat);m[i][slug]=(m[i][slug]||0)+v;}
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
  _calcFluxoCache[cacheKey]=m;
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
let CLIENTES=[];
const MONTHS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
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
function fromRowCliente(r){
  return{
    id:r.id,
    codigo:r.codigo||'',
    nome:r.nome||'',
    cpfCnpj:r.cpf_cnpj||'',
    tipo:r.tipo||'',
    recorrente:!!r.recorrente,
    recorrenteDesde:r.recorrente_desde||'',
    inativadoEm:r.inativado_em||'',
    ativo:r.ativo!==false,
    createdAt:r.created_at||''
  };
}
async function loadClientesFromDB(){
  try{
    const rows=await sbFetch('GET','clientes?order=nome.asc&select=*');
    CLIENTES=(rows||[]).map(fromRowCliente);
  }catch(e){
    console.warn('Falha ao carregar clientes',e);
    toast('Erro ao carregar clientes: '+e.message,'err');
    CLIENTES=[];
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
const FORM_FIELD_IDS=['f-comp','f-datavenc','f-datapgto','f-cat','f-vbruto','form-valor-liq','f-conta'];
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
function onDataVencBlur(el){
  formData.dataVenc=el.value;
  if(!el.value){el.style.boxShadow='';return;}
  const err=validarAno(el.value,'Data Vencimento');
  el.style.boxShadow=err?'0 0 0 2px var(--red)':'';
  if(err){toast(err,'err');el.value='';formData.dataVenc='';}
}

let TAB='dashboard',prevTAB='',YEAR=new Date().getFullYear(),DASHBOARD_MONTH=new Date().getMonth(),editingId=null;
const TABS=[
  {id:'dashboard',lbl:'Dashboard',ico:appIcon('dashboard'),sub:()=>`Visão consolidada do mês · ${MONTHS_FULL[getDashboardMonthIndex()]}/${YEAR}`},
  {id:'receber',lbl:'Contas a Receber',ico:appIcon('arrowDown'),sub:'Honorários, mensalidades e recebíveis em aberto'},
  {id:'pagar',lbl:'Contas a Pagar',ico:appIcon('arrowUp'),sub:'Compromissos com fornecedores e despesas operacionais'},
  {id:'clientes',lbl:'Clientes',ico:appIcon('clipboard'),sub:'Cadastro e gestão de clientes'},
  {id:'dre',lbl:'Relatórios & DRE',ico:appIcon('chart'),sub:()=>`Demonstração do Resultado do Exercício · ${YEAR}`},
  {id:'fluxo',lbl:'Fluxo de Caixa',ico:appIcon('wallet'),sub:()=>`Regime de caixa — movimentações realizadas · ${YEAR}`},
  {id:'recorrentes',lbl:'Desp. Recorrentes',ico:appIcon('repeat'),sub:'Despesas de recorrência mensal programadas'},
  {id:'categorias',lbl:'Categorias',ico:appIcon('settings'),sub:'Plano de contas e categorias de lançamentos'},
  {id:'contas',lbl:'Contas',ico:appIcon('bank'),sub:'Contas bancárias e saldos iniciais'},
  {id:'extrato',lbl:'Extrato',ico:appIcon('file'),sub:'Movimentações detalhadas por conta bancária'}
];

const BASE_PATH='/Skala-F/';
function tabFromPath(){const seg=location.pathname.replace(BASE_PATH,'').split('/')[0].toLowerCase();return TABS.find(t=>t.id===seg)?seg:'dashboard';}
function pushTab(id){history.pushState({tab:id},'',(BASE_PATH+id));}

async function init(){
  initSidebar();
  const ys=document.getElementById('yr-sel');
  for(let y=YEAR-1;y<=YEAR+1;y++){
    MONTHS.forEach((m,i)=>{
      const o=document.createElement('option');
      o.value=`${y}-${String(i+1).padStart(2,'0')}`;
      o.textContent=`${m}/${y}`;
      if(y===YEAR&&i===DASHBOARD_MONTH)o.selected=true;
      ys.appendChild(o);
    });
  }
  try{
    setSyncStatus('loading','Carregando...');
    const [rows, cats, subs, recRows, baixaRows] = await Promise.all([
      dbLoad(),
      sbFetch('GET','categorias?order=ordem.asc&select=*'),
      sbFetch('GET','subcategorias?order=ordem.asc&select=*'),
      sbFetch('GET','recorrentes?order=descricao.asc&select=*').catch(()=>null),
      dbLoadBaixas().catch(e=>{console.warn('Falha ao carregar baixas_lancamentos',e);return[];}),
      loadContasFromDB(),
      loadClientesFromDB(),
    ]);
    DATA=rows.map(fromRow);
    BAIXAS_DATA=(baixaRows||[]).map(fromBaixaRow);
    DATA.forEach(refreshLancamentoComputed);
    touchFinanceData();

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
  buildNav();render();renderProfileArea();
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
  const today=new Date().toISOString().slice(0,10);
  const pendR=DATA.filter(l=>!isTransfer(l)&&!l.adjType&&l.tipo==='R'&&openAmount(l)>0.005).length;
  const pendD=DATA.filter(l=>!isTransfer(l)&&!l.adjType&&l.tipo==='D'&&openAmount(l)>0.005).length;
  const lateR=DATA.filter(l=>!isTransfer(l)&&!l.adjType&&l.tipo==='R'&&openAmount(l)>0.005&&effectiveVenc(l)&&effectiveVenc(l)<today).length;
  const lateD=DATA.filter(l=>!isTransfer(l)&&!l.adjType&&l.tipo==='D'&&openAmount(l)>0.005&&effectiveVenc(l)&&effectiveVenc(l)<today).length;

  function mkBadge(cnt,late){
    if(!cnt)return '';
    const cap=cnt>99?'99+':cnt;
    const urg=late>0;
    const ttl=urg?`${late} em atraso · ${cnt} pendente${cnt>1?'s':''}`:`${cnt} pendente${cnt>1?'s':''}`;
    return `<span class="nb${urg?' nb-urg':''}" title="${ttl}">${cap}</span>`;
  }
  function addTab(id,badge='',container){
    const c=container||nav;
    const t=TABS.find(x=>x.id===id);if(!t)return;
    const b=document.createElement('button');
    b.className='nv'+(t.id===TAB?' on':'');b.title=t.lbl;
    b.onclick=()=>{TAB=t.id;pushTab(t.id);buildNav();render();updateTitle();};
    b.innerHTML=`<span class="nv-ico">${t.ico}</span><span class="nv-lbl">${t.lbl}</span>${badge}`;
    c.appendChild(b);
  }
  function addTool(ico,lbl,fn,container){
    const c=container||nav;
    const b=document.createElement('button');
    b.className='nv nv-tool';b.title=lbl;b.onclick=fn;
    b.innerHTML=`<span class="nv-ico">${appIcon(ico)}</span><span class="nv-lbl">${lbl}</span>`;
    c.appendChild(b);
  }
  function addSection(label,key,ico,activeIds=[]){
    const exp=localStorage.getItem(key)!=='0';
    const active=activeIds.includes(TAB);
    const wrap=document.createElement('div');wrap.className='nav-sec-wrap';
    const btn=document.createElement('button');btn.className='nav-sec-btn'+(exp?' open':'')+(active?' has-active':'');btn.title=label;
    const icoEl=document.createElement('span');icoEl.className='nav-sec-ico';icoEl.innerHTML=appIcon(ico);
    const lblEl=document.createElement('span');lblEl.className='nav-sec-lbl-text';lblEl.textContent=label;
    const arrow=document.createElement('span');arrow.className='nav-sec-arrow'+(exp?' open':'');arrow.textContent='›';
    arrow.innerHTML=appIcon('chevronRight');
    btn.appendChild(icoEl);btn.appendChild(lblEl);btn.appendChild(arrow);
    const items=document.createElement('div');items.className='nav-sec-items';
    items.style.maxHeight=exp?'300px':'0px';
    btn.onclick=()=>{
      const open=arrow.classList.contains('open');
      if(open){arrow.classList.remove('open');btn.classList.remove('open');items.style.maxHeight='0px';localStorage.setItem(key,'0');}
      else{arrow.classList.add('open');btn.classList.add('open');items.style.maxHeight='300px';localStorage.setItem(key,'1');}
    };
    wrap.appendChild(btn);wrap.appendChild(items);nav.appendChild(wrap);
    return items;
  }

  const inadCount=(typeof countInadimplentes==='function')?countInadimplentes():0;
  const clientesBadge=inadCount>0
    ? `<span class="nb nb-urg" title="${inadCount} cliente(s) inadimplente(s)">${inadCount>99?'99+':inadCount}</span>`
    : '';
  ['dashboard','receber','pagar','clientes','dre','fluxo','recorrentes','extrato'].forEach(id=>{
    const badge=id==='receber'?mkBadge(pendR,lateR)
      :id==='pagar'?mkBadge(pendD,lateD)
      :id==='clientes'?clientesBadge
      :'';
    addTab(id,badge);
  });
  const cfg=addSection('Configurações','skala_nav_config','settings',['categorias','contas']);
  addTab('categorias','',cfg);addTab('contas','',cfg);
  const tools=addSection('Ferramentas','skala_nav_tools','tools');
  addTool('download','Exportar Excel',()=>exportExcel(),tools);
  addTool('upload','Importar Faturamento',()=>document.getElementById('imp-fat-file').click(),tools);
  addTool('clipboard','Baixar por Relatório',()=>openBaixarRelModal(),tools);
}

function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const collapsed=sb.classList.toggle('collapsed');
  localStorage.setItem('skala_sidebar_collapsed',collapsed?'1':'0');
  const tog=document.getElementById('sb-toggle');
  if(tog){tog.textContent=collapsed?'»':'«';tog.title=collapsed?'Expandir menu':'Recolher menu';}
}

let _profileDropdownInited=false;
function initSidebar(){
  if(localStorage.getItem('skala_sidebar_collapsed')==='1'){
    const sb=document.getElementById('sidebar');if(sb)sb.classList.add('collapsed');
    const tog=document.getElementById('sb-toggle');
    if(tog){tog.textContent='»';tog.title='Expandir menu';}
  }
  if(!_profileDropdownInited){
    _profileDropdownInited=true;
    document.addEventListener('click',()=>{
      const dd=document.getElementById('pf-options');
      if(dd&&dd.classList.contains('open')){
        dd.classList.remove('open');
        document.getElementById('pf-chevron')?.classList.remove('open');
      }
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        const dd=document.getElementById('pf-options');
        if(dd&&dd.classList.contains('open')){
          dd.classList.remove('open');
          document.getElementById('pf-chevron')?.classList.remove('open');
        }
      }
    });
  }
}

function renderProfileArea(){
  const u=typeof _getUserData==='function'?_getUserData():{};
  const email=u.email||'';
  const name=u.name||email;
  const initials=name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||email.slice(0,2).toUpperCase()||'?';
  const avEl=document.getElementById('pf-avatar');
  const nameEl=document.getElementById('pf-name');
  const roleEl=document.getElementById('pf-role');
  if(avEl)avEl.textContent=initials;
  if(nameEl)nameEl.textContent=name||'Usuário';
  if(roleEl){roleEl.textContent=u.role||'';roleEl.style.display=u.role?'':'none';}
}

function updateTitle(){
  const tab=TABS.find(t=>t.id===TAB);
  document.getElementById('page-ttl').textContent=tab?.lbl||'';
  const subEl=document.getElementById('page-sub');
  if(subEl)subEl.textContent=tab?.sub?(typeof tab.sub==='function'?tab.sub():tab.sub):'';
}
function setYear(y){YEAR=parseInt(y);syncPeriodSelect();render();}
function setDashboardPeriod(period){
  const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
  if(m){
    YEAR=parseInt(m[1],10);
    DASHBOARD_MONTH=parseInt(m[2],10)-1;
  }else{
    YEAR=parseInt(period,10)||YEAR;
  }
  render();
}
function syncPeriodSelect(){
  const ys=document.getElementById('yr-sel');
  if(ys)ys.value=`${YEAR}-${String(getDashboardMonthIndex()+1).padStart(2,'0')}`;
}
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
  else if(TAB==='clientes')renderClientes(c);
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
  const syntheticTransfs=DATA
    .filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')&&!DATA.some(cr=>cr.doc===l.doc&&cr.conta===l.obs.slice(12)&&cr.tipo==='R'))
    .map(l=>({...l,id:`transf-dest-${l.id}`,lancamentoId:l.id,tipo:'R',conta:l.obs.slice(12),dataExtrato:l.dataPgto,valorLiq:parseMoney(l.valorLiq),isBaixa:false,isPend:false}));
  const movements=[...cashMovements(),...syntheticTransfs].filter(l=>l.conta===conta&&l.dataPgto);
  const prePeriod=movements.filter(l=>!filterExtratoInicio||l.dataPgto<filterExtratoInicio);
  const saldoAntes=saldoIni+prePeriod.reduce((s,l)=>s+(l.tipo==='R'?parseMoney(l.valorLiq):-parseMoney(l.valorLiq)),0);
  const pendingItems=filterExtratoInclPend?DATA.filter(l=>{
    if(l.status==='Cancelado'||l.conta!==conta||openAmount(l)<=0.005)return false;
    const dataExtrato=dateForSchedule(l);
    if(!dataExtrato)return false;
    return true;
  }).map(l=>({...l,id:`pend-${l.id}`,lancamentoId:l.id,dataExtrato:dateForSchedule(l),valorLiq:openAmount(l),status:computedStatus(l),isPend:true,isBaixa:false})):[];
  let items=[...movements.map(l=>({...l,dataExtrato:l.dataPgto,isPend:false})),...pendingItems].filter(l=>{
    if(filterExtratoInicio&&l.dataExtrato<filterExtratoInicio)return false;
    if(filterExtratoFim&&l.dataExtrato>filterExtratoFim)return false;
    return true;
  });
  items.sort((a,b)=>{
    const da=a.dataExtrato;
    const db=b.dataExtrato;
    if(da<db)return -1;
    if(da>db)return 1;
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
    if(!l.isPend)running+=(l.tipo==='R'?parseMoney(l.valorLiq):-parseMoney(l.valorLiq));
    return{...l,saldo:running};
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
  const checks=[...document.querySelectorAll('.extrato-chk')];
  checks.forEach(c=>{
    if(c.checked)selectedExtratoIds.add(c.value);
    else selectedExtratoIds.delete(c.value);
  });
  const items=checks.filter(c=>c.checked);
  const entradas=items.filter(c=>c.dataset.tipo==='R').reduce((s,c)=>s+parseMoney(c.dataset.valor),0);
  const saidas=items.filter(c=>c.dataset.tipo==='D').reduce((s,c)=>s+parseMoney(c.dataset.valor),0);
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
      ${rows.length?rows.map(r=>`<tr style="border-bottom:1px solid var(--bd);${r.isPend?'opacity:.6':''};cursor:pointer" class="lr" onclick="openEdit('${r.lancamentoId||r.id}')">
        <td style="padding:9px 8px;text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="extrato-chk" value="${r.id}" data-tipo="${r.tipo}" data-valor="${parseMoney(r.valorLiq)}" ${selectedExtratoIds.has(r.id)?'checked':''} onchange="updateExtratoSelectionInfo()" style="width:15px;height:15px;cursor:pointer"/></td>
        <td style="padding:9px 12px;white-space:nowrap">${dateBR(r.dataExtrato||r.dataPgto)}</td>
        <td style="padding:9px 8px;white-space:nowrap;color:var(--tx2);font-size:12px">${compDisplay(r.dataComp)||'—'}</td>
        <td style="padding:9px 8px"><span class="tp ${(r.doc||'').startsWith('TRANSF#')?'t':r.tipo==='R'?'r':'d'}">${(r.doc||'').startsWith('TRANSF#')?`${appIcon('transfer','app-icon tp-icon')} Transf`:r.tipo==='R'?`${appIcon('arrowDown','app-icon tp-icon')} Rec`:`${appIcon('arrowUp','app-icon tp-icon')} Desp`}</span></td>
        <td style="padding:9px 8px"><span class="ct">${esc(r.cat)}</span></td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px">${esc(r.sub||'—')}</td>
        <td style="padding:9px 8px;color:var(--tx2);font-size:12px">${esc(r.desc||'—')}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:600;white-space:nowrap;color:${r.tipo==='R'?'var(--teal)':'var(--red)'}">${r.tipo==='R'?'+':'-'} ${fmt(r.valorLiq)}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:700;white-space:nowrap;color:${r.saldo>=0?'var(--teal)':'var(--red)'}${r.isPend?';font-style:italic':''}">${fmt(r.saldo)}</td>
        <td style="padding:7px 8px;text-align:right" onclick="event.stopPropagation()">
          <button class="btn" title="Excluir lançamento" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="deleteItem('${r.lancamentoId||r.id}')">${appIcon('trash')}</button>
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
  const movements=cashMovements();
  return contasVis.map(conta=>{
    const ini=parseFloat(conta.saldo_inicial)||0;
    const realizados=movements.filter(l=>l.conta===conta.nome)
      .reduce((s,l)=>s+(l.tipo==='R'?parseMoney(l.valorLiq):-parseMoney(l.valorLiq)),0);
    const pendentes=DATA.filter(l=>l.conta===conta.nome&&openAmount(l)>0.005)
      .reduce((s,l)=>s+(l.tipo==='R'?openAmount(l):-openAmount(l)),0);
    const hasRealCredit=doc=>DATA.some(cr=>cr.doc===doc&&cr.conta===conta.nome&&cr.tipo==='R');
    const legacyTransfs=DATA.filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')&&l.obs.slice(12)===conta.nome&&!hasRealCredit(l.doc));
    const transfCredReal=legacyTransfs.filter(l=>paidAmount(l)>0).reduce((s,l)=>s+paidAmount(l),0);
    const transfCredPend=legacyTransfs.filter(l=>openAmount(l)>0.005).reduce((s,l)=>s+openAmount(l),0);
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

function getDashboardMonthIndex(){
  return DASHBOARD_MONTH;
}

function dashboardPeriodMatch(dateLike,monthIndex,year){
  if(!dateLike)return false;
  return getY(dateLike)===year&&getM(dateLike)===monthIndex;
}

function dashboardMonthWindow(year,monthIndex,size=6){
  const dreCache={},fluxoCache={};
  const getYearDre=y=>dreCache[y]||(dreCache[y]=calcDRE(y));
  const getYearFluxo=y=>fluxoCache[y]||(fluxoCache[y]=calcFluxo(y));
  return Array.from({length:size},(_,idx)=>{
    const offset=idx-size+1;
    const d=new Date(year,monthIndex+offset,1);
    const y=d.getFullYear(),m=d.getMonth();
    return{label:MONTHS[m],year:y,month:m,dre:getYearDre(y)[m],fluxo:getYearFluxo(y)[m]};
  });
}

// ── #36 helpers — Saldo do Mês interativo ────────────────────────
const _EYE_OPEN=`<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _EYE_SHUT=`<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;stroke-width:2;fill:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
function _getSaldoModo(){return localStorage.getItem('skala_saldo_modo')||'movimento';}
function _getSaldoOcult(){return localStorage.getItem('skala_ocultar_valores')==='1';}
function setSaldoModo(modo){
  localStorage.setItem('skala_saldo_modo',modo);
  _updateSaldoCard();
}
function toggleSaldoExpand(){
  const list=document.getElementById('saldo-expand-list');if(!list)return;
  const open=list.style.maxHeight&&list.style.maxHeight!=='0px';
  if(open){list.style.maxHeight='0';list.style.opacity='0';}
  else{list.style.maxHeight=list.scrollHeight+'px';list.style.opacity='1';}
}
function toggleOcultarValores(){
  localStorage.setItem('skala_ocultar_valores',_getSaldoOcult()?'0':'1');
  _updateSaldoCard();
}
function _updateSaldoCard(){
  const modo=_getSaldoModo(),ocultar=_getSaldoOcult();
  const cards=calcContaCards(true);
  const saldo=(modo==='total'?cards:cards.filter(c=>c.tipo!=='investimento')).reduce((s,c)=>s+c.atual,0);
  const valEl=document.getElementById('saldo-kpi-val');if(valEl)valEl.textContent=ocultar?'••••••':fmt(saldo);
  const subEl=document.getElementById('saldo-kpi-sub');if(subEl)subEl.textContent=modo==='movimento'?'Contas movimento':'Todas as contas';
  const eye=document.getElementById('saldo-eye');
  if(eye){eye.style.opacity=ocultar?'1':'.5';eye.title=ocultar?'Mostrar valores':'Ocultar valores';eye.innerHTML=ocultar?_EYE_SHUT:_EYE_OPEN;}
  const bM=document.getElementById('saldo-btn-mov'),bT=document.getElementById('saldo-btn-tot');
  if(bM){bM.style.opacity=modo==='movimento'?'1':'.5';bM.style.fontWeight=modo==='movimento'?'700':'400';}
  if(bT){bT.style.opacity=modo==='total'?'1':'.5';bT.style.fontWeight=modo==='total'?'700':'400';}
  const list=document.getElementById('saldo-expand-list');
  if(list){
    const wasOpen=list.style.maxHeight&&list.style.maxHeight!=='0px';
    const listCards=modo==='total'?cards:cards.filter(c=>c.tipo!=='investimento');
    list.innerHTML=listCards.map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid rgba(255,255,255,.15);font-size:12px"><span style="color:rgba(255,255,255,.8)">${esc(c.nome)}${c.tipo==='investimento'?'<span style="opacity:.6;font-size:10px"> (inv)</span>':''}</span><strong style="color:#fff;white-space:nowrap">${ocultar?'••••••':fmt(c.atual)}</strong></div>`).join('');
    if(wasOpen)requestAnimationFrame(()=>{list.style.maxHeight=list.scrollHeight+'px';});
  }
}
function navReceber(){
  try{localStorage.setItem('skala_receber_filtro',JSON.stringify({status:'Pendente'}));}catch(e){}
  TAB='receber';pushTab('receber');buildNav();render();
}
function navPagar(vencidos){
  try{localStorage.setItem('skala_pagar_filtro',JSON.stringify(vencidos?{status:'Pendente',vencidos:true}:{status:'Pendente'}));}catch(e){}
  TAB='pagar';pushTab('pagar');buildNav();render();
}
function renderDashboard(c){
  const monthIndex=getDashboardMonthIndex();
  const monthLabel=`${MONTHS_FULL[monthIndex]}/${YEAR}`;
  const prevMonthIndex=monthIndex===0?11:monthIndex-1;
  const graficoPeriodo=_getGraficoPeriodo();
  const dre=calcDRE(YEAR),fluxo=calcFluxo(YEAR),chartWindow=dashboardMonthWindow(YEAR,monthIndex,graficoPeriodo),fluxoWindow=dashboardMonthWindow(YEAR,monthIndex,6);
  const monthDre=dre[monthIndex],monthFluxo=fluxo[monthIndex];
  const prevFluxo=monthIndex>0?fluxo[prevMonthIndex]:calcFluxo(YEAR-1)[11];
  const totRec=monthDre.recOpLiq,totDesp=monthDre.totDesp,totLL=monthDre.ll,saldoFin=monthFluxo.saldoFin;
  const saldoPrev=prevFluxo?prevFluxo.saldoFin:0;
  const saldoDelta=saldoPrev?((saldoFin-saldoPrev)/Math.abs(saldoPrev)):0;
  const pend=DATA.filter(l=>openAmount(l)>0.005&&dashboardPeriodMatch(dateForSchedule(l)||l.dataComp,monthIndex,YEAR));
  const pendR=pend.filter(l=>l.tipo==='R'),pendD=pend.filter(l=>l.tipo==='D');
  const aReceber=pendR.reduce((s,l)=>s+openAmount(l),0);
  const aPagar=pendD.reduce((s,l)=>s+openAmount(l),0);
  const today=new Date().toISOString().slice(0,10);
  const vencidosD=pendD.filter(l=>effectiveVenc(l)&&effectiveVenc(l)<today).length;
  const margem=totRec>0?totLL/totRec:0;
  const varCaixa=monthFluxo.saldoOp;
  const varProj=varCaixa+aReceber-aPagar;
  const contaCards=calcContaCards(true);
  const saldoModo=_getSaldoModo(),saldoOcult=_getSaldoOcult();
  const saldoDisp=(saldoModo==='total'?contaCards:contaCards.filter(c=>c.tipo!=='investimento')).reduce((s,c)=>s+c.atual,0);
  const saldoVal=saldoOcult?'••••••':fmt(saldoDisp);
  const _btnSt='background:rgba(255,255,255,.18);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:11px;padding:3px 7px;line-height:1.4;transition:opacity .15s';
  const listCards=saldoModo==='total'?contaCards:contaCards.filter(c=>c.tipo!=='investimento');
  const saldoCardHtml=`<div class="kpi k-feature" style="position:relative">`+
    `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">`+
      `<div style="flex:1;min-width:0;cursor:pointer" onclick="toggleSaldoExpand()">`+
        `<div class="kpi-lbl">Saldo do Mês</div>`+
        `<div class="kpi-val" id="saldo-kpi-val">${saldoVal}</div>`+
        `<div class="kpi-sub" id="saldo-kpi-sub">${saldoModo==='movimento'?'Contas movimento':'Todas as contas'}</div>`+
      `</div>`+
      `<div style="display:flex;gap:4px;margin-top:2px;flex-shrink:0">`+
        `<button id="saldo-btn-mov" onclick="setSaldoModo('movimento')" style="${_btnSt};opacity:${saldoModo==='movimento'?'1':'.5'};font-weight:${saldoModo==='movimento'?'700':'400'}">Mov.</button>`+
        `<button id="saldo-btn-tot" onclick="setSaldoModo('total')" style="${_btnSt};opacity:${saldoModo==='total'?'1':'.5'};font-weight:${saldoModo==='total'?'700':'400'}">Total</button>`+
        `<button id="saldo-eye" onclick="toggleOcultarValores()" title="${saldoOcult?'Mostrar valores':'Ocultar valores'}" style="${_btnSt};opacity:${saldoOcult?'1':'.5'};padding:3px 5px;display:inline-flex;align-items:center">${saldoOcult?_EYE_SHUT:_EYE_OPEN}</button>`+
      `</div>`+
    `</div>`+
    `<div id="saldo-expand-list" style="max-height:0;overflow:hidden;opacity:0;transition:max-height .2s ease,opacity .2s ease;margin-top:4px">`+
      listCards.map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid rgba(255,255,255,.15);font-size:12px"><span style="color:rgba(255,255,255,.8)">${esc(c.nome)}${c.tipo==='investimento'?'<span style="opacity:.6;font-size:10px"> (inv)</span>':''}</span><strong style="color:#fff;white-space:nowrap">${saldoOcult?'••••••':fmt(c.atual)}</strong></div>`).join('')+
    `</div>`+
  `</div>`;
  const vencidosSub=vencidosD>0
    ?`<span style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" onclick="event.stopPropagation();navPagar(true)">${vencidosD} título${vencidosD===1?'':'s'} vencido${vencidosD===1?'':'s'}</span>`
    :`0 títulos vencidos`;
  const kpis=[
    {lbl:'A Receber',val:fmt(aReceber),sub:`${fmt(monthFluxo.entradas)} recebidos`,cls:'k-clean k-receber kpi-clickable',ico:'arrowDown',onclick:'navReceber()'},
    {lbl:'A Pagar',val:fmt(aPagar),sub:vencidosSub,cls:`k-clean k-pagar kpi-clickable${vencidosD>0?' kpi-venc-pulse':''}`,ico:'arrowUp',onclick:'navPagar(false)'},
    {lbl:'Variação de Caixa',val:`<span style="color:var(${varCaixa>=0?'--teal':'--red'})">${varCaixa>=0?'+':''}${fmt(varCaixa)}</span>`,sub:`Projeção: ${varProj>=0?'+':''}${fmt(varProj)}`,cls:'k-clean k-amber',ico:'chart'},
  ];
  let html='<div class="kpi-grid dashboard-kpis">'+saldoCardHtml;
  kpis.forEach(k=>{html+=`<div class="kpi ${k.cls}" style="align-self:start"${k.onclick?` onclick="${k.onclick}"`:''}>` +`${k.ico?`<div class="kpi-ico-wrap">${appIcon(k.ico)}</div>`:''}`+`<div class="kpi-lbl">${k.lbl}</div><div class="kpi-val">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`;});
  html+=`</div><div class="charts-row"><div class="card wide"><div class="card-ttl" style="display:flex;align-items:center;justify-content:space-between"><span>Fluxo de Caixa</span><div style="display:flex;gap:4px">${[3,6,12].map(n=>`<button id="chart-period-${n}" class="btn btn-ghost" style="font-size:11px;padding:3px 9px;opacity:${graficoPeriodo===n?'1':'.45'};font-weight:${graficoPeriodo===n?'700':'400'}" onclick="setGraficoPeriodo(${n})">${n}m</button>`).join('')}</div></div><div style="position:relative;height:330px"><canvas id="chart-main"></canvas></div></div><div class="card" style="margin-bottom:0"><div class="card-ttl" style="display:flex;align-items:center;justify-content:space-between"><span id="pie-ttl">${(window._pieMode||'D')==='D'?'Despesas':'Receitas'} por Categoria · ${monthLabel}</span><div style="display:flex;gap:4px"><button id="pie-btn-d" class="btn btn-ghost" style="font-size:11px;padding:3px 9px;opacity:${(window._pieMode||'D')==='D'?'1':'.45'}" onclick="setPieMode('D')">Despesas</button><button id="pie-btn-r" class="btn btn-ghost" style="font-size:11px;padding:3px 9px;opacity:${(window._pieMode||'D')==='R'?'1':'.45'}" onclick="setPieMode('R')">Receitas</button></div></div><canvas id="chart-pie" height="240"></canvas><div id="pie-legend" class="pie-legend"></div></div></div><div id="chart-main-tip" style="position:fixed;pointer-events:none;z-index:100;background:var(--s1);border:1px solid var(--bd);border-radius:8px;box-shadow:var(--shadow);padding:10px 12px;min-width:160px;opacity:0;transition:opacity .1s"></div><div id="pie-tooltip" class="pie-tooltip"></div>`;
  html+=`<div class="charts-row"><div class="card" style="margin-bottom:0"><div class="card-ttl">Fluxo de Caixa — Saldo Final Mensal <span class="yr-pill">Últimos 6 meses</span></div><canvas id="chart-fluxo" height="170"></canvas></div>`;
  if(pend.length>0){
    html+=`<div class="pend-card" style="margin-bottom:0"><div class="card-ttl">Contas Pendentes · ${monthLabel}</div><div class="pend-list">`;
    pend.slice(0,8).forEach(l=>{const isR=l.tipo==='R';html+=`<div class="pend-row"><span class="pt ${isR?'r':'d'}">${isR?appIcon('arrowDown','app-icon tp-icon'):appIcon('arrowUp','app-icon tp-icon')}</span><span class="pdesc">${esc(l.desc||l.sub||l.cat)}</span><span class="pcat">${esc(l.cat)}</span><span class="pdata">${effectiveVenc(l)||'—'}</span><span class="pval ${isR?'r':'d'}">${fmt(openAmount(l))}</span></div>`;});
    html+='</div></div>';
  }else{html+='<div></div>';}
  html+='</div>';
  const vPR=pendR.reduce((s,l)=>s+openAmount(l),0),vPD=pendD.reduce((s,l)=>s+openAmount(l),0);
  const ipts=[];
  if(totLL>0)ipts.push(`Resultado positivo de <strong>${fmt(totLL)}</strong> com margem de <strong>${fmtPct(margem)}</strong> em ${monthLabel}.`);
  else if(totLL<0)ipts.push(`Atenção: resultado negativo de <strong>${fmt(Math.abs(totLL))}</strong> no mês.`);
  if(pendR.length>0)ipts.push(`${pendR.length} recebível${pendR.length>1?'is':''} em aberto: <strong>${fmt(vPR)}</strong>.`);
  if(pendD.length>0)ipts.push(`${pendD.length} conta${pendD.length>1?'s':''} a pagar pendente${pendD.length>1?'s':''}: <strong>${fmt(vPD)}</strong>.`);
  if(ipts.length)html+=`<div class="insight-block"><div class="insight-lbl">${appIcon('chart')} Insight do Mês</div><p class="insight-txt${totLL<0?' neg':''}">${ipts.join(' ')}</p></div>`;
  c.innerHTML=html;
  setTimeout(()=>{
    drawLineChart('chart-main',chartWindow);
    const pieMode=window._pieMode||'D';
    const pieSrc=pieMode==='D'?getDespCats():getRecCats();
    const piePfx=pieMode==='D'?'d_':'r_';
    const pieCategs=pieSrc.map(cat=>({lbl:cat.nome,val:monthDre[piePfx+(cat.slug||slugify(cat.nome))]||0})).filter(d=>d.val>0);
    drawPieChart('chart-pie',pieCategs,pieMode);
    drawBarChartSingle('chart-fluxo',fluxoWindow.map(m=>m.label),fluxoWindow.map(m=>m.fluxo.saldoFin));
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

function _getGraficoPeriodo(){return parseInt(localStorage.getItem('skala_grafico_periodo')||'6');}
function setGraficoPeriodo(n){
  localStorage.setItem('skala_grafico_periodo',String(n));
  [3,6,12].forEach(v=>{const btn=document.getElementById('chart-period-'+v);if(btn){btn.style.opacity=v===n?'1':'.45';btn.style.fontWeight=v===n?'700':'400';}});
  drawLineChart('chart-main',dashboardMonthWindow(YEAR,getDashboardMonthIndex(),n));
}
function drawLineChart(id,chartWindow){
  window._dashChartWindow=chartWindow;
  const canvas=document.getElementById(id);if(!canvas)return;
  if(typeof Chart==='undefined'){
    drawBarChart(id,chartWindow.map(m=>m.label),[{label:'Entradas',data:chartWindow.map(m=>m.fluxo.entradas),color:'#1a9d4d'},{label:'Saídas',data:chartWindow.map(m=>m.fluxo.totSaidas),color:'#e3b341'},{label:'Variação',data:chartWindow.map(m=>m.fluxo.saldoOp),color:'#58a6ff'}]);
    return;
  }
  if(window._chartMain){try{window._chartMain.destroy();}catch(e){}window._chartMain=null;}
  const ctx=canvas.getContext('2d');
  const cH=canvas.parentElement?.offsetHeight||canvas.offsetHeight||220;
  const mkGrad=(r,g,b)=>{const gr=ctx.createLinearGradient(0,0,0,cH);gr.addColorStop(0,`rgba(${r},${g},${b},.15)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);return gr;};
  const hasMultiYear=new Set(chartWindow.map(m=>m.year)).size>1;
  const labels=chartWindow.map(m=>hasMultiYear?`${m.label}/${String(m.year).slice(2)}`:m.label);
  const ds=[
    {label:'Entradas',data:chartWindow.map(m=>m.fluxo.entradas),color:'#1a9d4d',grad:mkGrad(26,157,77)},
    {label:'Saídas',data:chartWindow.map(m=>m.fluxo.totSaidas),color:'#e3b341',grad:mkGrad(227,179,65)},
    {label:'Variação',data:chartWindow.map(m=>m.fluxo.saldoOp),color:'#58a6ff',grad:mkGrad(88,166,255)},
  ];
  window._chartMain=new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:ds.map(s=>({
        label:s.label,data:s.data,borderColor:s.color,backgroundColor:s.grad,
        tension:0.4,fill:true,borderWidth:2,
        pointRadius:4,pointBorderWidth:2,pointBackgroundColor:s.color,pointBorderColor:s.color,
        pointHoverRadius:6,pointHoverBackgroundColor:s.color,pointHoverBorderWidth:0,
      }))
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      animation:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          enabled:false,
          external:({chart,tooltip})=>{
            const tipEl=document.getElementById('chart-main-tip');if(!tipEl)return;
            if(tooltip.opacity===0){tipEl.style.opacity='0';return;}
            const rect=chart.canvas.getBoundingClientRect();
            tipEl.style.opacity='1';
            tipEl.style.left=(rect.left+tooltip.caretX+16)+'px';
            tipEl.style.top=(rect.top+tooltip.caretY-10)+'px';
            const di=tooltip.dataPoints[0].dataIndex;
            const entry=window._dashChartWindow?.[di];
            const lbl=entry?`${MONTHS_FULL[entry.month]}/${entry.year}`:(tooltip.title[0]||'');
            const rec=tooltip.dataPoints.find(p=>p.dataset.label==='Entradas')?.raw??0;
            const desp=tooltip.dataPoints.find(p=>p.dataset.label==='Saídas')?.raw??0;
            const ll=tooltip.dataPoints.find(p=>p.dataset.label==='Variação')?.raw??0;
            tipEl.innerHTML=`<div style="font-weight:700;margin-bottom:6px;font-size:12px;color:var(--tx)">${lbl}</div>`+
              `<div style="display:flex;flex-direction:column;gap:4px;font-size:12px">`+
              `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--tx2)">Entradas</span><strong style="color:#1a9d4d">${fmt(rec)}</strong></div>`+
              `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--tx2)">Saídas</span><strong style="color:#e3b341">${fmt(desp)}</strong></div>`+
              `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--tx2)">Variação</span><strong style="color:${ll>=0?'#58a6ff':'#f85149'}">${fmt(ll)}</strong></div>`+
              `</div>`;
          }
        }
      },
      onClick:(event,elements)=>{
        if(!elements.length)return;
        const idx=elements[0].index;
        const entry=window._dashChartWindow?.[idx];if(!entry)return;
        const{year,month}=entry;
        const mm=String(month+1).padStart(2,'0');
        const mesStr=`${year}-${mm}-01`;
        localStorage.setItem('skala_extrato_mes',mesStr);
        filterExtratoInicio=mesStr;
        filterExtratoFim=new Date(year,month+1,0).toISOString().slice(0,10);
        TAB='extrato';pushTab('extrato');buildNav();render();
      },
      onHover:(event,elements)=>{
        if(event.native)event.native.target.style.cursor=elements.length?'pointer':'default';
      },
      scales:{
        x:{grid:{color:'rgba(255,255,255,.06)'},ticks:{color:'#8b949e',font:{size:11}},border:{display:false}},
        y:{grid:{color:'rgba(255,255,255,.06)'},ticks:{color:'#8b949e',font:{size:11},callback:v=>v>=1000?`${(v/1000).toFixed(0)}k`:v.toFixed(0)},border:{display:false}}
      }
    },
    plugins:[{
      id:'drawFromLeft',
      beforeDatasetsDraw(chart){
        const pct=chart._drawPct??0;if(pct>=1)return;
        const{ctx,chartArea:{left,right,top,bottom}}=chart;
        ctx.save();ctx.beginPath();ctx.rect(left,top,(right-left)*pct,bottom-top);ctx.clip();
      },
      afterDatasetsDraw(chart){if((chart._drawPct??0)<1)chart.ctx.restore();}
    }]
  });
  const _mc=window._chartMain,_t0=performance.now(),_ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  (function _f(now){
    if(window._chartMain!==_mc)return;
    const p=Math.min((now-_t0)/800,1);
    _mc._drawPct=_ease(p);_mc.draw();
    if(p<1)requestAnimationFrame(_f);
  })(performance.now());
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
  const monthIndex=getDashboardMonthIndex();
  const monthLabel=`${MONTHS_FULL[monthIndex]}/${YEAR}`;
  const monthDre=calcDRE(YEAR)[monthIndex];
  const src=m==='D'?getDespCats():getRecCats(),pfx=m==='D'?'d_':'r_';
  const cats=src.map(cat=>({lbl:cat.nome,val:monthDre[pfx+(cat.slug||slugify(cat.nome))]||0})).filter(d=>d.val>0);
  const ttl=document.getElementById('pie-ttl');if(ttl)ttl.textContent=(m==='D'?'Despesas':'Receitas')+' por Categoria · '+monthLabel;
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
  const paidData=cashMovements().filter(l=>l.dataPgto&&getY(l.dataPgto)===YEAR);
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
      if(openAmount(l)<=0.005)return false;
      const d=dateForSchedule(l);
      return d&&getY(d)===YEAR;
    });
    const projEnt=Array(12).fill(0);
    const projSai=Array(12).fill(0);
    pendData.forEach(l=>{
      const d=dateForSchedule(l);
      const i=getM(d);
      if(i==null||i<0||i>11)return;
      const v=openAmount(l);
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
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--tx3)">VARIAÇÃO NO PERÍODO</td></tr>
    ${contaRows}
    ${row('VARIAÇÃO TOTAL DE CAIXA','saldoOp',true,false,'tot')}
    <tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:var(--blue)">SALDO FINAL POR CONTA</td></tr>
    ${contaSaldoFinRows}
    ${totalSaldoFinRow}
    ${projSection}
    </tbody></table></div></div>`;
}

