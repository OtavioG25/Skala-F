let _calcDreCache={};
let _calcFluxoCache={};
let _calcFluxoProjCache={};
function clearFinanceCalcCache(){
  _calcDreCache={};
  _calcFluxoCache={};
  _calcFluxoProjCache={};
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
  recCats.forEach(c=>{ (c.subs||[]).forEach(s=>{ base['rs_'+(s.slug||slugify(s.nome))]=0; }); });
  despCats.forEach(c=>{ (c.subs||[]).forEach(s=>{ base['ds_'+(s.slug||slugify(s.nome))]=0; }); });
  const m=Array.from({length:12},()=>({...base}));

  cashMovements().forEach(l=>{
    if((l.doc||'').startsWith('TRANSF#'))return;
    if(!l.dataPgto||getY(l.dataPgto)!==year)return;
    const i=getM(l.dataPgto),v=parseMoney(l.valorLiq);
    if(l.tipo==='R'){
      const rc=recCats.find(c=>c.nome===l.cat);
      const rslug='r_'+(rc?(rc.slug||slugify(rc.nome)):slugify(l.cat));
      m[i][rslug]=(m[i][rslug]||0)+v;
      if(rc){const sub=(rc.subs||[]).find(s=>s.nome===l.sub);if(sub){const sk='rs_'+(sub.slug||slugify(sub.nome));m[i][sk]=(m[i][sk]||0)+v;}}
    } else {
      const dc=despCats.find(c=>c.nome===l.cat);
      const dslug='d_'+(dc?(dc.slug||slugify(dc.nome)):catSlug(l.cat));
      m[i][dslug]=(m[i][dslug]||0)+v;
      if(dc){const sub=(dc.subs||[]).find(s=>s.nome===l.sub);if(sub){const sk='ds_'+(sub.slug||slugify(sub.nome));m[i][sk]=(m[i][sk]||0)+v;}}
    }
  });

  m.forEach((r,i)=>{
    r.entradas=Object.keys(r).filter(k=>k.startsWith('r_')).reduce((s,k)=>s+(r[k]||0),0);
    r.totSaidas=Object.keys(r).filter(k=>k.startsWith('d_')).reduce((s,k)=>s+(r[k]||0),0);
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

function _projTooltip(src){
  const t={manual:'Valor manual',pendentes:'Pendentes do mês',pendentes_cur:'Realizado + pendentes',media_3:'Projeção automática (média 3 meses)',media_6:'Projeção automática (média 6 meses)',ultimo_mes:'Projeção automática (último mês)',parent_manual:'Override manual na categoria-pai — subs ocultados',nao_projetar:'Categoria não projetada'};
  return t[src]||'';
}

function calcFluxoProj(year){
  const cacheKey=`${year}:${DATA_VERSION}`;
  if(_calcFluxoProjCache[cacheKey])return _calcFluxoProjCache[cacheKey];

  const now=new Date();
  const curY=now.getFullYear(),curM=now.getMonth();
  const recCats=getRecCats(),despCats=getDespCats();
  const real=calcFluxo(year);

  // Itens projetáveis: categorias-pai + subcategorias (subs herdam projection_rule do pai)
  // parentKey nas subs permite checar override manual do pai durante a projeção
  const projItems=[];
  recCats.forEach(c=>{
    const cslug=c.slug||slugify(c.nome);
    const rule=c.projection_rule||'media_3';
    projItems.push({key:'r_'+cslug,slug:cslug,tipo:'R',isSub:false,rule,parentKey:null});
    (c.subs||[]).forEach(s=>{
      const sslug=s.slug||slugify(s.nome);
      projItems.push({key:'rs_'+sslug,slug:sslug,tipo:'R',isSub:true,rule,parentKey:'r_'+cslug});
    });
  });
  despCats.forEach(c=>{
    const cslug=c.slug||slugify(c.nome);
    const rule=c.projection_rule||'media_3';
    projItems.push({key:'d_'+cslug,slug:cslug,tipo:'D',isSub:false,rule,parentKey:null});
    (c.subs||[]).forEach(s=>{
      const sslug=s.slug||slugify(s.nome);
      projItems.push({key:'ds_'+sslug,slug:sslug,tipo:'D',isSub:true,rule,parentKey:'d_'+cslug});
    });
  });

  // pendMap: indexado por (catKey|mi) para cat E sub (lançamento com sub conta nos dois)
  const pendMap={};
  DATA.forEach(l=>{
    if(l.status==='Cancelado')return;
    const open=openAmount(l);
    if(open<=0.005)return;
    const d=effectiveVenc(l)||l.dataComp||'';
    if(!d||getY(d)!==year)return;
    const mi=getM(d);
    if(mi==null||mi<0||mi>11)return;
    const cats=l.tipo==='R'?recCats:despCats;
    const cat=cats.find(c=>c.nome===l.cat);
    if(!cat)return;
    const slug=cat.slug||slugify(cat.nome);
    const kCat=(l.tipo==='R'?'r_':'d_')+slug+'|'+mi;
    pendMap[kCat]=(pendMap[kCat]||0)+open;
    if(l.sub){
      const sub=(cat.subs||[]).find(s=>s.nome===l.sub);
      if(sub){
        const sslug=sub.slug||slugify(sub.nome);
        const kSub=(l.tipo==='R'?'rs_':'ds_')+sslug+'|'+mi;
        pendMap[kSub]=(pendMap[kSub]||0)+open;
      }
    }
  });

  // últimos N valores realizados não-nulos — APENAS meses já FECHADOS (exclui mês atual)
  function lastNVals(catKey,n){
    const vals=[];
    const topM=year===curY?curM-1:year<curY?11:-1;
    for(let m=topM;m>=0&&vals.length<n;m--){
      const v=real[m]?.[catKey]||0;
      if(v>0.005)vals.push(v);
    }
    if(vals.length<n){
      const py=calcFluxo(year-1);
      for(let m=11;m>=0&&vals.length<n;m--){
        const v=py[m]?.[catKey]||0;
        if(v>0.005)vals.push(v);
      }
    }
    return vals;
  }

  function recomputeTotals(mb){
    mb.entradasOp=recCats.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').reduce((s,c)=>s+(mb['r_'+(c.slug||slugify(c.nome))]||0),0);
    mb.saidasOp=despCats.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').reduce((s,c)=>s+(mb['d_'+(c.slug||slugify(c.nome))]||0),0);
    mb.resultadoOp=mb.entradasOp-mb.saidasOp;
    mb.entradasNaoOp=recCats.filter(c=>(c.fluxo||'operacional')==='nao_operacional').reduce((s,c)=>s+(mb['r_'+(c.slug||slugify(c.nome))]||0),0);
    mb.saidasNaoOp=despCats.filter(c=>(c.fluxo||'operacional')==='nao_operacional').reduce((s,c)=>s+(mb['d_'+(c.slug||slugify(c.nome))]||0),0);
    mb.resultadoNaoOp=mb.entradasNaoOp-mb.saidasNaoOp;
    mb.entradas=mb.entradasOp+mb.entradasNaoOp;
    mb.totSaidas=mb.saidasOp+mb.saidasNaoOp;
    mb.saldoOp=mb.entradas-mb.totSaidas;
  }

  const result=real.map((rm,mi)=>{
    const base={...rm,_sources:{},_isManual:{}};
    const isPast=year<curY||(year===curY&&mi<curM);
    const isCur=year===curY&&mi===curM;

    if(isPast){
      projItems.forEach(it=>{base._sources[it.key]='realizado';});
    } else if(isCur){
      // mês atual: realizados + pendentes (cat e sub)
      projItems.forEach(it=>{
        const pend=pendMap[it.key+'|'+mi]||0;
        if(pend>0.005){base[it.key]=(base[it.key]||0)+pend;base._sources[it.key]='pendentes_cur';}
        else base._sources[it.key]='realizado';
      });
      recomputeTotals(base);
    } else {
      // meses futuros: prioridade manual > pendentes > regra (cat e sub)
      // Loop processa pais antes das subs (graças à ordem em projItems)
      const comp=`${year}-${String(mi+1).padStart(2,'0')}-01`;
      projItems.forEach(it=>{
        // Sub com pai em override manual → zera para manter pai como fonte única de verdade
        if(it.isSub&&base._isManual[it.parentKey]){
          base[it.key]=0;
          base._sources[it.key]='parent_manual';
          base._isManual[it.key]=false;
          return;
        }
        const pend=pendMap[it.key+'|'+mi]||0;
        // Override manual: apenas em categoria-pai (não em sub)
        const override=it.isSub?null:(PROJECOES||[]).find(x=>x.catSlug===it.slug&&x.tipo===it.tipo&&x.comp===comp);
        let value=0,source='nao_projetar',isManual=false;
        if(override){
          value=override.valor;source='manual';isManual=true;
        } else if(pend>0.005){
          value=pend;source='pendentes';
        } else {
          const rule=it.rule;
          if(rule==='nao_projetar'||rule==='manual'){value=0;source=rule;}
          else if(rule==='ultimo_mes'){const vs=lastNVals(it.key,1);value=vs[0]||0;source='ultimo_mes';}
          else{const n=rule==='media_6'?6:3;const vs=lastNVals(it.key,n);value=vs.length?vs.reduce((s,v)=>s+v,0)/vs.length:0;source=rule;}
        }
        base[it.key]=value;
        base._sources[it.key]=source;
        base._isManual[it.key]=isManual;
      });
      recomputeTotals(base);
    }
    return base;
  });

  _calcFluxoProjCache[cacheKey]=result;
  return result;
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
const _fmtBRL=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(parseMoney(v));
const fmt=v=>_fmtBRL(v);
const fmtCard=v=>_getSaldoOcult()?'••••••':_fmtBRL(v);
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

let TAB='dashboard',prevTAB='',YEAR=new Date().getFullYear(),DASHBOARD_MONTH=new Date().getMonth(),editingId=null,_pickerYear=new Date().getFullYear();
let dreViewMes=new Date().getMonth();
let fluxoViewMes=new Date().getMonth();
let fluxoDrillDown=null;
let dreDrillDown=null;
const TABS=[
  {id:'dashboard',lbl:'Dashboard',ico:appIcon('dashboard'),sub:()=>`Visão consolidada do mês · ${MONTHS_FULL[getDashboardMonthIndex()]}/${YEAR}`},
  {id:'receber',lbl:'Contas a Receber',ico:appIcon('arrowDown'),sub:'Honorários, mensalidades e recebíveis em aberto'},
  {id:'pagar',lbl:'Contas a Pagar',ico:appIcon('arrowUp'),sub:'Compromissos com fornecedores e despesas operacionais'},
  {id:'clientes',lbl:'Clientes',ico:appIcon('clipboard'),sub:'Cadastro e gestão de clientes'},
  {id:'dre',lbl:'DRE',ico:appIcon('chart'),sub:()=>`Demonstração do Resultado do Exercício · ${YEAR}`},
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
  syncPeriodSelect();
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
      dbLoadProjecoes().catch(e=>{console.warn('Falha ao carregar projecoes_manuais',e);return[];}),
    ]);
    DATA=rows.map(fromRow);
    BAIXAS_DATA=(baixaRows||[]).map(fromBaixaRow);
    _invalidateBaixasCache();
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
  _updateGlobalEyeBtn();
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
    const exp=localStorage.getItem(key)==='1';
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
  syncPeriodSelect();
  render();
}
function syncPeriodSelect(){
  const btn=document.getElementById('yr-sel-btn');
  if(btn)btn.innerHTML=`${MONTHS[getDashboardMonthIndex()]}/${YEAR} <span style="opacity:.5;font-size:10px;margin-left:2px">▾</span>`;
}

// ── Month Picker ──────────────────────────────────────────
function toggleMonthPicker(){
  const panel=document.getElementById('yr-sel-panel');
  if(!panel)return;
  if(panel.style.display==='none'){
    _pickerYear=YEAR;
    panel.style.display='block';
    renderPickerGrid();
    setTimeout(()=>document.addEventListener('click',_monthPickerOutside),0);
  }else{
    closeMonthPicker();
  }
}
function closeMonthPicker(){
  const panel=document.getElementById('yr-sel-panel');
  if(panel)panel.style.display='none';
  document.removeEventListener('click',_monthPickerOutside);
}
function _monthPickerOutside(e){
  const wrap=document.getElementById('yr-sel-wrap');
  if(wrap&&!wrap.contains(e.target))closeMonthPicker();
}
function shiftPickerYear(delta){
  _pickerYear+=delta;
  renderPickerGrid();
}
function renderPickerGrid(){
  const yearEl=document.getElementById('yr-sel-year');
  const grid=document.getElementById('yr-sel-grid');
  if(!yearEl||!grid)return;
  yearEl.textContent=_pickerYear;
  const now=new Date();
  const todayY=now.getFullYear(),todayM=now.getMonth();
  grid.innerHTML=MONTHS.map((m,i)=>{
    const isSel=_pickerYear===YEAR&&i===getDashboardMonthIndex();
    const isToday=_pickerYear===todayY&&i===todayM;
    const cls='yr-sel-m'+(isSel?' sel':'')+(isToday?' today':'');
    return`<button class="${cls}" onclick="selectPickerMonth(${i})">${m}</button>`;
  }).join('');
}
function selectPickerMonth(mi){
  setDashboardPeriod(`${_pickerYear}-${String(mi+1).padStart(2,'0')}`);
  closeMonthPicker();
}
function setPickerToday(){
  const now=new Date();
  setDashboardPeriod(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  closeMonthPicker();
}
// ─────────────────────────────────────────────────────────
function renderKeepScroll(){
  const ls=document.querySelector('.lan-scroll');
  const st=ls?ls.scrollTop:0;
  render();
  if(st>0)requestAnimationFrame(()=>{const el=document.querySelector('.lan-scroll');if(el)el.scrollTop=st;});
}
function render(){
  if(TAB==='pendentes'||TAB==='lancamentos')TAB='receber';
  if(TAB!=='fluxo'){fluxoDrillDown=null;const p=document.getElementById('fluxo-drill');if(p)p.remove();}
  if(TAB!=='dre'){dreDrillDown=null;const p=document.getElementById('dre-drill');if(p)p.remove();}
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
    if(filterExtratoApenasTransf&&!(l.doc||'').startsWith('TRANSF#'))return false;
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
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2);cursor:pointer;white-space:nowrap">
      <input type="checkbox" ${filterExtratoApenasTransf?'checked':''} onchange="clearExtratoSelectionState();filterExtratoApenasTransf=this.checked;renderExtrato(document.getElementById('content'))" style="width:14px;height:14px"/>
      Transferências
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
        <div style="font-size:18px;font-weight:800;color:${c.atual>=0?'var(--teal)':'var(--red)'};white-space:nowrap">${fmtCard(c.atual)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:11px;color:var(--tx2)">
          <span>Projetado</span><strong style="color:${c.projetado>=0?'var(--tx2)':'var(--red)'};white-space:nowrap">${fmtCard(c.projetado)}</strong>
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
function _updateGlobalEyeBtn(){
  const ocultar=_getSaldoOcult();
  const btn=document.getElementById('global-eye');
  if(btn){btn.title=ocultar?'Mostrar valores':'Ocultar valores';btn.innerHTML=ocultar?_EYE_SHUT:_EYE_OPEN;btn.style.opacity=ocultar?'1':'.5';}
  document.body.classList.toggle('valores-ocultos',ocultar);
}
function toggleOcultarValores(){
  localStorage.setItem('skala_ocultar_valores',_getSaldoOcult()?'0':'1');
  _updateGlobalEyeBtn();
  render();
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
    {lbl:'A Receber',val:fmtCard(aReceber),sub:`${fmtCard(monthFluxo.entradas)} recebidos`,cls:'k-clean k-receber kpi-clickable',ico:'arrowDown',onclick:'navReceber()'},
    {lbl:'A Pagar',val:fmtCard(aPagar),sub:vencidosSub,cls:`k-clean k-pagar kpi-clickable${vencidosD>0?' kpi-venc-pulse':''}`,ico:'arrowUp',onclick:'navPagar(false)'},
    {lbl:'Variação de Caixa',val:`<span style="color:var(${varCaixa>=0?'--teal':'--red'})">${varCaixa>=0?'+':''}${fmtCard(varCaixa)}</span>`,sub:`Projeção: ${varProj>=0?'+':''}${fmtCard(varProj)}`,cls:'k-clean k-amber',ico:'chart'},
  ];
  let html='<div class="kpi-grid dashboard-kpis">'+saldoCardHtml;
  kpis.forEach(k=>{html+=`<div class="kpi ${k.cls}" style="align-self:start"${k.onclick?` onclick="${k.onclick}"`:''}>` +`${k.ico?`<div class="kpi-ico-wrap">${appIcon(k.ico)}</div>`:''}`+`<div class="kpi-lbl">${k.lbl}</div><div class="kpi-val">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`;});
  html+=`</div><div class="charts-row"><div class="card wide"><div class="card-ttl" style="display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:3px">Fluxo de Caixa</div><div style="font-size:16px;font-weight:700;color:var(--tx)">Entradas, Saídas e Resultado</div></div><div class="donut-seg-ctrl">${[3,6,12].map(n=>`<button id="chart-period-${n}" class="donut-seg-btn${graficoPeriodo===n?' on':''}" onclick="setGraficoPeriodo(${n})">${n}m</button>`).join('')}</div></div><div class="skala-kpi-strip" id="chart-main-kpis"></div><div id="chart-main-plot" style="position:relative"></div></div><div class="card" style="margin-bottom:0"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px"><div><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:3px">Distribuição</div><div class="card-ttl" id="pie-ttl" style="font-size:15px;margin-bottom:2px">${(window._pieMode||'D')==='D'?'Composição das Despesas':'Composição das Receitas'}</div><div style="font-size:12px;color:var(--tx2)">${monthLabel} · por categoria</div></div><div class="donut-seg-ctrl"><button class="donut-seg-btn${(window._pieMode||'D')==='D'?' on':''}" onclick="setPieMode('D')">Despesas</button><button class="donut-seg-btn${(window._pieMode||'D')==='R'?' on':''}" onclick="setPieMode('R')">Receitas</button></div></div><div class="donut-body"><div class="donut-wrap"><svg viewBox="0 0 200 200" id="chart-pie" style="display:block;width:100%;height:100%;transform:rotate(-90deg)"></svg><div class="donut-center" id="donut-center"></div></div><div class="donut-legend" id="pie-legend"></div></div></div></div>`;
  html+=`<div class="charts-row"><div class="card" style="margin-bottom:0"><div class="card-ttl" style="margin-bottom:4px"><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:3px">Fluxo de Caixa</div><div style="font-size:15px;font-weight:700;color:var(--tx)">Saldo Mensal <span class="yr-pill">Últimos 6 meses</span></div></div><div id="chart-fluxo-plot" style="position:relative;margin-top:6px"></div></div>`;
  if(pend.length>0){
    html+=`<div class="pend-card" style="margin-bottom:0"><div class="card-ttl">Contas Pendentes · ${monthLabel}</div><div class="pend-list">`;
    pend.slice(0,8).forEach(l=>{const isR=l.tipo==='R';html+=`<div class="pend-row"><span class="pt ${isR?'r':'d'}">${isR?appIcon('arrowDown','app-icon tp-icon'):appIcon('arrowUp','app-icon tp-icon')}</span><span class="pdesc">${esc(l.desc||l.sub||l.cat)}</span><span class="pcat">${esc(l.cat)}</span><span class="pdata">${effectiveVenc(l)||'—'}</span><span class="pval ${isR?'r':'d'}">${fmtCard(openAmount(l))}</span></div>`;});
    html+='</div></div>';
  }else{html+='<div></div>';}
  html+='</div>';
  const vPR=pendR.reduce((s,l)=>s+openAmount(l),0),vPD=pendD.reduce((s,l)=>s+openAmount(l),0);
  const ipts=[];
  if(totLL>0)ipts.push(`Resultado positivo de <strong>${fmtCard(totLL)}</strong> com margem de <strong>${fmtPct(margem)}</strong> em ${monthLabel}.`);
  else if(totLL<0)ipts.push(`Atenção: resultado negativo de <strong>${fmtCard(Math.abs(totLL))}</strong> no mês.`);
  if(pendR.length>0)ipts.push(`${pendR.length} recebível${pendR.length>1?'is':''} em aberto: <strong>${fmtCard(vPR)}</strong>.`);
  if(pendD.length>0)ipts.push(`${pendD.length} conta${pendD.length>1?'s':''} a pagar pendente${pendD.length>1?'s':''}: <strong>${fmtCard(vPD)}</strong>.`);
  if(ipts.length)html+=`<div class="insight-block"><div class="insight-lbl">${appIcon('chart')} Insight do Mês</div><p class="insight-txt${totLL<0?' neg':''}">${ipts.join(' ')}</p></div>`;
  c.innerHTML=html;
  setTimeout(()=>{
    drawLineChart('chart-main-plot',chartWindow);
    const pieMode=window._pieMode||'D';
    drawPieChart('chart-pie',_buildPieCategs(pieMode,monthIndex),pieMode);
    drawFluxoBarChart('chart-fluxo-plot',fluxoWindow);
  },0);
}

function _smoothPath(pts){
  if(pts.length<2)return'';
  const t=0.18;
  let d=`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    const cp1x=p1.x+(p2.x-p0.x)*t,cp1y=p1.y+(p2.y-p0.y)*t;
    const cp2x=p2.x-(p3.x-p1.x)*t,cp2y=p2.y-(p3.y-p1.y)*t;
    d+=` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
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

function drawFluxoBarChart(id,fluxoWindow){
  const plot=document.getElementById(id);if(!plot)return;
  let running=0;
  const data=fluxoWindow.map(m=>{
    const saldo=m.fluxo.saldoOp;running+=saldo;
    return{mes:m.label,year:m.year,month:m.month,entradas:m.fluxo.entradas,saidas:m.fluxo.totSaidas,saldo,acumulado:running};
  });
  const N=data.length;if(!N)return;
  const W=800,H=250,padT=22,padB=28,padL=44,padR=50;
  const innerW=W-padL-padR,innerH=H-padT-padB;
  const colW=innerW/N;
  // Dual-axis: shared zero, independent scales
  const sPosMax=Math.max(...data.map(d=>d.saldo),0)||1;
  const sNegMin=Math.min(...data.map(d=>d.saldo),0);
  const hasNeg=sNegMin<0;
  const aboveFrac=hasNeg?0.80:0.96;
  const y0=padT+innerH*aboveFrac;
  const aboveH=y0-padT,belowH=(padT+innerH)-y0;
  const sNegAbs=hasNeg?Math.abs(sNegMin):1;
  const yBar=v=>v>=0?y0-(v/sPosMax)*aboveH*0.90:y0+(Math.abs(v)/sNegAbs)*belowH*0.82;
  const aPosMax=Math.max(...data.map(d=>d.acumulado),0)||1;
  const aNegMin=Math.min(...data.map(d=>d.acumulado),0);
  const aNegAbs=aNegMin<0?Math.abs(aNegMin):1;
  const yAcc=v=>v>=0?y0-(v/aPosMax)*aboveH*0.90:y0+(Math.abs(v)/aNegAbs)*belowH*0.82;
  const fkax=v=>{const r=Math.round(v/1000);return r===0?'0':r.toLocaleString('pt-BR')+'k';};
  const fklbl=v=>(v<0?'-':'+')+'R$'+(Math.abs(v)/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k';
  // Grid + Y labels (left = bars, right = accumulated)
  let grid='',yLblsL='',yLblsR='';
  for(let t=0;t<=4;t++){
    const frac=t/4,yy=y0-frac*aboveH*0.90;
    grid+=`<line stroke="rgba(15,100,53,0.09)" stroke-width="1" stroke-dasharray="4 4" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W-padR}" y2="${yy.toFixed(1)}"/>`;
    yLblsL+=`<text class="bc-ylbl" x="${(padL-8).toFixed(1)}" y="${(yy+3).toFixed(1)}" text-anchor="end">${fkax(frac*sPosMax)}</text>`;
    yLblsR+=`<text class="bc-ylbl-r" x="${(W-padR+8).toFixed(1)}" y="${(yy+3).toFixed(1)}" text-anchor="start">${fkax(frac*aPosMax)}</text>`;
  }
  const caps=`<text class="bc-axis-cap l" x="${(padL-8).toFixed(1)}" y="${(padT-7).toFixed(1)}" text-anchor="end">Mês</text><text class="bc-axis-cap r" x="${(W-padR+8).toFixed(1)}" y="${(padT-7).toFixed(1)}" text-anchor="start">Acum.</text>`;
  const zeroLine=hasNeg?`<line stroke="rgba(15,100,53,0.30)" stroke-width="1.2" x1="${padL}" y1="${y0.toFixed(1)}" x2="${W-padR}" y2="${y0.toFixed(1)}"/>`:'' ;
  // Bars
  const bw=Math.min(40,colW*0.50);
  let cols='';
  data.forEach((d,i)=>{
    const cx=padL+colW*i+colW/2;
    const yv=yBar(d.saldo),top=Math.min(yv,y0),hgt=Math.max(2,Math.abs(yv-y0));
    const pos=d.saldo>=0;
    const lblY=pos?(top-7):(top+hgt+14);
    cols+=`<g class="bc-col" data-i="${i}">
      <rect class="bc-bar ${pos?'bc-pos':'bc-neg'}" x="${(cx-bw/2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="4" ry="4"/>
      <text class="bc-lbl ${pos?'pos':'neg'}" x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle">${fklbl(d.saldo)}</text>
      <text class="bc-xlbl" data-i="${i}" x="${cx.toFixed(1)}" y="${(H-8).toFixed(1)}" text-anchor="middle">${d.mes}</text>
      <rect class="bc-hit" data-i="${i}" x="${(padL+colW*i).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>
    </g>`;
  });
  // Accumulated trend line (yellow, right axis)
  const pts=data.map((d,i)=>({x:padL+colW*i+colW/2,y:yAcc(d.acumulado)}));
  const linePath=_smoothPath(pts);
  const accArea=`<path fill="url(#bcGrAcc)" d="${linePath} L${pts[pts.length-1].x.toFixed(1)},${y0.toFixed(1)} L${pts[0].x.toFixed(1)},${y0.toFixed(1)} Z"/>`;
  const accLine=`<path fill="none" stroke="#E0B80D" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" d="${linePath}"/>`;
  const accDots=pts.map(p=>`<circle fill="var(--s1)" stroke="#E0B80D" stroke-width="2.5" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/>`).join('');
  plot.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">
    <defs>
      <linearGradient id="bcGrPos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1A9C5A"/><stop offset="100%" stop-color="#007A48"/></linearGradient>
      <linearGradient id="bcGrNeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E15241"/><stop offset="100%" stop-color="#C0392B"/></linearGradient>
      <linearGradient id="bcGrAcc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(240,200,20,0.22)"/><stop offset="100%" stop-color="rgba(240,200,20,0)"/></linearGradient>
    </defs>
    ${grid}${yLblsL}${yLblsR}${caps}${accArea}${cols}${zeroLine}${accLine}${accDots}
  </svg><div id="bc-tip" class="lc-tip"></div>`;
  const svgEl=plot.querySelector('svg');
  const tipEl=plot.querySelector('#bc-tip');
  const colEls=[...svgEl.querySelectorAll('.bc-col')];
  const xlblEls=[...svgEl.querySelectorAll('.bc-xlbl')];
  const hasMultiYear=new Set(fluxoWindow.map(m=>m.year)).size>1;
  colEls.forEach(col=>{
    const i=+col.dataset.i;
    col.querySelector('.bc-hit').addEventListener('mouseenter',()=>{
      colEls.forEach(c=>c.classList.toggle('dim',c!==col));
      xlblEls.forEach(xl=>xl.classList.toggle('on',+xl.dataset.i===i));
      const d=data[i];
      const cx=padL+colW*i+colW/2;
      const svgRect=svgEl.getBoundingClientRect(),plotRect=plot.getBoundingClientRect();
      const scaleX=svgRect.width/W,scaleY=svgRect.height/H;
      const px=cx*scaleX+(svgRect.left-plotRect.left);
      const py=yBar(Math.max(d.saldo,0))*scaleY+(svgRect.top-plotRect.top);
      const lbl=hasMultiYear?`${d.mes}/${String(d.year).slice(2)}`:d.mes;
      tipEl.innerHTML=`<div class="lc-tt-mes">${lbl}</div>`+
        `<div class="lc-tt-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-ent"></span>Entradas</span><span class="lc-tt-v" style="color:var(--tx)">${fmtCard(d.entradas)}</span></div>`+
        `<div class="lc-tt-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-sai"></span>Saídas</span><span class="lc-tt-v" style="color:var(--tx)">${fmtCard(d.saidas)}</span></div>`+
        `<div class="lc-tt-row" style="border-top:1px solid var(--bd);margin-top:5px;padding-top:7px"><span class="lc-tt-k" style="font-weight:700;color:var(--tx)">Saldo do mês</span><span class="lc-tt-v" style="color:${d.saldo>=0?'#1A9C5A':'var(--red)'}">${fmtCard(d.saldo)}</span></div>`+
        `<div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:#C39A05;font-weight:700;margin-top:7px;font-variant-numeric:tabular-nums"><span style="width:9px;height:9px;border-radius:2px;background:#E0B80D;display:inline-block"></span>Acumulado: ${fmtCard(d.acumulado)}</div>`;
      tipEl.style.left=px+'px';tipEl.style.top=py+'px';tipEl.classList.add('show');
    });
    col.querySelector('.bc-hit').addEventListener('mouseleave',()=>{
      colEls.forEach(c=>c.classList.remove('dim'));xlblEls.forEach(xl=>xl.classList.remove('on'));tipEl.classList.remove('show');
    });
    col.querySelector('.bc-hit').addEventListener('click',()=>{
      const entry=fluxoWindow[i];if(!entry)return;
      const mm=String(entry.month+1).padStart(2,'0');
      const mesStr=`${entry.year}-${mm}-01`;
      filterExtratoInicio=mesStr;filterExtratoFim=new Date(entry.year,entry.month+1,0).toISOString().slice(0,10);
      TAB='extrato';pushTab('extrato');buildNav();render();
    });
  });
}

function drawFluxoMesChart(){
  const plot=document.getElementById('fluxo-mes-plot');if(!plot)return;
  const f=calcFluxo(YEAR);
  const startIdx=Math.max(0,fluxoViewMes-5);
  const months=[];for(let i=startIdx;i<=fluxoViewMes;i++)months.push(i);
  const data=months.map(i=>({mes:MONTHS[i],monthIdx:i,entradas:f[i].entradasOp||0,saidas:f[i].saidasOp||0,resultado:f[i].resultadoOp||0}));
  const N=data.length;if(!N)return;
  const W=760,H=280,padT=34,padB=28,padX=8;
  const innerW=W-padX*2,innerH=H-padT-padB,colW=innerW/N;
  const maxBar=Math.max(...data.map(d=>Math.max(d.entradas,d.saidas)),1);
  const resVals=data.map(d=>d.resultado);
  const resMax=Math.max(...resVals,0),resMin=Math.min(...resVals,0);
  const resRange=(resMax-resMin)||1;
  const barScale=v=>(v/maxBar)*innerH;
  const lineTop=padT+6,lineBot=padT+innerH*0.62;
  const resY=v=>lineBot-((v-resMin)/resRange)*(lineBot-lineTop);
  const baseY=padT+innerH;
  const bw=Math.min(16,colW*0.22),gap=4;
  const fmtK=v=>{const s=v<0?'-':'',a=Math.abs(v);return s+'R$'+(a>=1000?(a/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k':a.toLocaleString('pt-BR',{maximumFractionDigits:0}));};
  const fmtBRL=v=>'R$ '+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pts=data.map((d,i)=>({x:padX+colW*i+colW/2,y:resY(d.resultado),neg:d.resultado<0}));
  const linePath=N>1?pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '):'';
  const areaPath=N>1?linePath+` L${pts[N-1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`:'';
  let grid='';
  for(let g=0;g<4;g++){const y=padT+(innerH/4)*g;grid+=`<line x1="${padX}" y1="${y.toFixed(1)}" x2="${W-padX}" y2="${y.toFixed(1)}" stroke="rgba(15,100,53,0.10)" stroke-width="1" stroke-dasharray="4 4"/>`;}
  let cols='';
  data.forEach((d,i)=>{
    const cx=pts[i].x,entH=barScale(d.entradas),saiH=barScale(d.saidas);
    const entX=cx-bw-gap/2,saiX=cx+gap/2,isCur=i===N-1;
    cols+=`<g class="dre-col${isCur?' dre-col-on':''}" data-i="${i}">
      <rect x="${entX.toFixed(1)}" y="${(baseY-entH).toFixed(1)}" width="${bw.toFixed(1)}" height="${entH.toFixed(1)}" rx="4" fill="url(#fluxoGEnt)" class="dre-bar"/>
      <rect x="${saiX.toFixed(1)}" y="${(baseY-saiH).toFixed(1)}" width="${bw.toFixed(1)}" height="${saiH.toFixed(1)}" rx="4" fill="url(#fluxoGSai)" class="dre-bar"/>
      <circle cx="${pts[i].x.toFixed(1)}" cy="${pts[i].y.toFixed(1)}" r="4" class="dre-rdot${pts[i].neg?' dre-rdot-neg':''}"/>
      <text x="${pts[i].x.toFixed(1)}" y="${(pts[i].y-10).toFixed(1)}" text-anchor="middle" class="dre-rval${pts[i].neg?' dre-rval-neg':''}">${fmtK(d.resultado)}</text>
      <text x="${cx.toFixed(1)}" y="${(baseY+18).toFixed(1)}" text-anchor="middle" class="dre-xlbl${isCur?' dre-xlbl-on':''}">${d.mes}</text>
      <rect x="${(padX+colW*i).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer" class="dre-hit" data-i="${i}"/>
    </g>`;
  });
  let tip=document.getElementById('fluxo-mes-tip');
  if(!tip){tip=document.createElement('div');tip.id='fluxo-mes-tip';tip.style.cssText='position:fixed;pointer-events:none;background:#00532c;color:#fff;border-radius:8px;padding:10px 13px;opacity:0;transform:translate(-50%,calc(-100% - 10px));transition:opacity .12s;white-space:nowrap;z-index:1000;box-shadow:0 4px 20px rgba(0,83,44,.30)';document.body.appendChild(tip);}
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">
    <defs>
      <linearGradient id="fluxoGEnt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1A9C5A"/><stop offset="100%" stop-color="#007A48"/></linearGradient>
      <linearGradient id="fluxoGSai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F8D43D"/><stop offset="100%" stop-color="#E0B80D"/></linearGradient>
      <linearGradient id="fluxoGArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,83,44,0.10)"/><stop offset="100%" stop-color="rgba(0,83,44,0)"/></linearGradient>
    </defs>
    ${grid}
    ${areaPath?`<path fill="url(#fluxoGArea)" d="${areaPath}"/>`:''}
    ${linePath?`<path fill="none" stroke="#00532c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" d="${linePath}"/>`:''}
    ${cols}
  </svg>`;
  [...plot.querySelectorAll('svg')].forEach(s=>s.remove());
  plot.insertAdjacentHTML('afterbegin',svg);
  const colEls=[...plot.querySelectorAll('.dre-col')];
  colEls.forEach(col=>{
    const i=+col.dataset.i;
    col.querySelector('.dre-hit').addEventListener('mouseenter',()=>{
      colEls.forEach(c=>c.classList.toggle('dre-col-dim',c!==col));
      col.classList.add('dre-col-on');col.classList.remove('dre-col-dim');
      const svgEl=plot.querySelector('svg'),rect=svgEl.getBoundingClientRect();
      const d=data[i];
      tip.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#F8D43D;margin-bottom:6px">${MONTHS_FULL[d.monthIdx]}&nbsp;${YEAR}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#1A9C5A;display:inline-block;flex-shrink:0"></span>Entradas</span><span style="font-weight:700;font-size:12px">${fmtBRL(d.entradas)}</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#F8D43D;display:inline-block;flex-shrink:0"></span>Saídas</span><span style="font-weight:700;font-size:12px">${fmtBRL(d.saidas)}</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid rgba(255,255,255,.18);margin-top:4px;padding-top:6px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#fff;display:inline-block;flex-shrink:0"></span>Resultado</span><span style="font-weight:700;font-size:12px;color:${d.resultado<0?'#FF9B8E':'#fff'}">${d.resultado<0?'-':''}${fmtBRL(d.resultado)}</span></div>`;
      tip.style.left=(rect.left+pts[i].x*(rect.width/W))+'px';
      tip.style.top=(rect.top+window.scrollY+pts[i].y*(rect.height/H))+'px';
      tip.style.opacity='1';
    });
    col.querySelector('.dre-hit').addEventListener('mouseleave',()=>{
      colEls.forEach(c=>c.classList.remove('dre-col-dim'));tip.style.opacity='0';
    });
  });
}

function _getGraficoPeriodo(){return parseInt(localStorage.getItem('skala_grafico_periodo')||'6');}
function setGraficoPeriodo(n){
  localStorage.setItem('skala_grafico_periodo',String(n));
  [3,6,12].forEach(v=>{const btn=document.getElementById('chart-period-'+v);if(btn)btn.classList.toggle('on',v===n);});
  drawLineChart('chart-main-plot',dashboardMonthWindow(YEAR,getDashboardMonthIndex(),n));
}
function drawLineChart(id,chartWindow){
  window._dashChartWindow=chartWindow;
  if(window._chartMain){try{window._chartMain.destroy();}catch(e){}window._chartMain=null;}
  const plot=document.getElementById(id);if(!plot)return;
  const data=chartWindow.map(m=>({mes:m.label,year:m.year,month:m.month,entradas:m.fluxo.entradas,saidas:m.fluxo.totSaidas,resultado:m.fluxo.saldoOp}));
  const N=data.length;if(!N)return;
  const hasMultiYear=new Set(chartWindow.map(m=>m.year)).size>1;
  // KPI strip
  const kpiEl=document.getElementById('chart-main-kpis');
  if(kpiEl){
    const totEnt=data.reduce((s,d)=>s+d.entradas,0),totSai=data.reduce((s,d)=>s+d.saidas,0),totRes=totEnt-totSai;
    const fk=v=>(Math.abs(v)/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k';
    kpiEl.innerHTML=
      `<div class="skala-ks"><div class="skala-ks-lbl"><span class="skala-ks-dot ent"></span>Entradas</div><div class="skala-ks-val">R$ ${fk(totEnt)}</div></div>`+
      `<div class="skala-ks"><div class="skala-ks-lbl"><span class="skala-ks-dot sai"></span>Saídas</div><div class="skala-ks-val">R$ ${fk(totSai)}</div></div>`+
      `<div class="skala-ks"><div class="skala-ks-lbl"><span class="skala-ks-dot res"></span>Resultado</div><div class="skala-ks-val${totRes<0?' neg':''}">R$ ${totRes<0?'-':''}${fk(Math.abs(totRes))}</div></div>`;
  }
  // Geometry
  const W=800,H=210,padT=16,padB=26,padL=44,padR=12;
  const innerW=W-padL-padR,innerH=H-padT-padB;
  const colW=innerW/N;
  const allVals=data.flatMap(d=>[d.entradas,d.saidas,d.resultado]);
  let yMax=Math.max(...allVals,0),yMin=Math.min(...allVals,0);
  const span=(yMax-yMin)||1;yMax+=span*0.10;yMin-=span*0.06;
  const yRange=yMax-yMin;
  const xPos=i=>N<=1?padL+innerW/2:padL+(innerW/(N-1))*i;
  const yPos=v=>padT+innerH-((v-yMin)/yRange)*innerH;
  const fkax=v=>v===0?'0':(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:0})+'k';
  // Grid + Y labels
  let grid='',yLbls='';
  for(let t=0;t<=4;t++){
    const val=yMin+(yRange/4)*t,yy=yPos(val);
    grid+=`<line stroke="rgba(15,100,53,0.09)" stroke-width="1" stroke-dasharray="4 4" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W-padR}" y2="${yy.toFixed(1)}"/>`;
    yLbls+=`<text class="lc-ylbl" x="${(padL-6).toFixed(1)}" y="${(yy+3).toFixed(1)}" text-anchor="end">${fkax(val)}</text>`;
  }
  let zeroLine='';
  if(yMin<0&&yMax>0){const yz=yPos(0);zeroLine=`<line stroke="rgba(15,100,53,0.28)" stroke-width="1.2" x1="${padL}" y1="${yz.toFixed(1)}" x2="${W-padR}" y2="${yz.toFixed(1)}"/>`;}
  // Paths
  const ptsOf=key=>data.map((d,i)=>({x:xPos(i),y:yPos(d[key])}));
  const entPts=ptsOf('entradas'),saiPts=ptsOf('saidas'),resPts=ptsOf('resultado');
  const entPath=_smoothPath(entPts),saiPath=_smoothPath(saiPts),resPath=_smoothPath(resPts);
  const bottom=padT+innerH;
  const closeArea=(path,pts)=>path+` L${pts[pts.length-1].x.toFixed(1)},${bottom.toFixed(1)} L${pts[0].x.toFixed(1)},${bottom.toFixed(1)} Z`;
  const dotsFor=(key,col,negCol)=>data.map((d,i)=>`<circle stroke="${(key==='resultado'&&d[key]<0)?negCol:col}" stroke-width="2.5" fill="var(--s1)" cx="${xPos(i).toFixed(1)}" cy="${yPos(d[key]).toFixed(1)}" r="3.5"/>`).join('');
  // Labels + hover + hit
  let xLbls='',hovers='',hits='';
  data.forEach((d,i)=>{
    const lbl=hasMultiYear?`${d.mes}/${String(d.year).slice(2)}`:d.mes;
    xLbls+=`<text class="lc-xlbl" data-i="${i}" x="${xPos(i).toFixed(1)}" y="${(H-8).toFixed(1)}" text-anchor="middle">${lbl}</text>`;
    hovers+=`<line class="lc-hover" data-i="${i}" x1="${xPos(i).toFixed(1)}" y1="${padT}" x2="${xPos(i).toFixed(1)}" y2="${(padT+innerH).toFixed(1)}"/>`;
    const hx=i===0?padL:(xPos(i)+xPos(i-1))/2;
    const hx2=i===N-1?W-padR:(xPos(i)+xPos(i+1))/2;
    hits+=`<rect class="lc-hit" data-i="${i}" x="${hx.toFixed(1)}" y="0" width="${(hx2-hx).toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;
  });
  plot.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">
    <defs>
      <linearGradient id="lcGrEnt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(26,138,79,0.32)"/><stop offset="55%" stop-color="rgba(26,138,79,0.10)"/><stop offset="100%" stop-color="rgba(26,138,79,0)"/></linearGradient>
      <linearGradient id="lcGrSai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(240,200,20,0.36)"/><stop offset="55%" stop-color="rgba(240,200,20,0.12)"/><stop offset="100%" stop-color="rgba(240,200,20,0)"/></linearGradient>
    </defs>
    ${grid}${yLbls}${zeroLine}
    <path fill="url(#lcGrEnt)" d="${closeArea(entPath,entPts)}"/>
    <path fill="url(#lcGrSai)" d="${closeArea(saiPath,saiPts)}"/>
    ${hovers}
    <path fill="none" stroke="#00532C" stroke-width="1.8" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round" d="${resPath}"/>
    <path fill="none" stroke="#1A8A4F" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d="${entPath}"/>
    <path fill="none" stroke="#E0B80D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d="${saiPath}"/>
    ${dotsFor('resultado','#00532C','var(--red)')}${dotsFor('entradas','#1A9C5A','#1A9C5A')}${dotsFor('saidas','#E0B80D','#E0B80D')}
    ${xLbls}${hits}
  </svg><div id="lc-main-tip" class="lc-tip"></div>`;
  const svgEl=plot.querySelector('svg');
  const tipEl=plot.querySelector('#lc-main-tip');
  const hoverEls=[...svgEl.querySelectorAll('.lc-hover')];
  const xLblEls=[...svgEl.querySelectorAll('.lc-xlbl')];
  const hitEls=[...svgEl.querySelectorAll('.lc-hit')];
  const showTip=i=>{
    const d=data[i];
    const svgRect=svgEl.getBoundingClientRect(),plotRect=plot.getBoundingClientRect();
    const scaleX=svgRect.width/W,scaleY=svgRect.height/H;
    const topVal=Math.max(d.entradas,d.saidas);
    const px=xPos(i)*scaleX+(svgRect.left-plotRect.left);
    const py=yPos(topVal)*scaleY+(svgRect.top-plotRect.top);
    const entry=chartWindow[i];
    const lbl=entry?`${MONTHS_FULL[entry.month]} ${entry.year}`:(d.mes||'');
    tipEl.innerHTML=`<div class="lc-tt-mes">${lbl}</div>`+
      `<div class="lc-tt-row lc-ent-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-ent"></span>Entradas</span><span class="lc-tt-v">${fmtCard(d.entradas)}</span></div>`+
      `<div class="lc-tt-row lc-sai-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-sai"></span>Saídas</span><span class="lc-tt-v">${fmtCard(d.saidas)}</span></div>`+
      `<div class="lc-tt-row lc-res-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-res"></span>Resultado</span><span class="lc-tt-v${d.resultado<0?' lc-neg':''}">${fmtCard(d.resultado)}</span></div>`;
    tipEl.style.left=px+'px';tipEl.style.top=py+'px';tipEl.classList.add('show');
  };
  const hideTip=()=>tipEl.classList.remove('show');
  hitEls.forEach(h=>{
    const i=+h.dataset.i;
    h.addEventListener('mouseenter',()=>{hoverEls.forEach(hl=>hl.classList.toggle('show',+hl.dataset.i===i));xLblEls.forEach(xl=>xl.classList.toggle('on',+xl.dataset.i===i));showTip(i);});
    h.addEventListener('mouseleave',()=>{hoverEls.forEach(hl=>hl.classList.remove('show'));xLblEls.forEach(xl=>xl.classList.remove('on'));hideTip();});
    h.addEventListener('click',()=>{
      const entry=chartWindow[i];if(!entry)return;
      const{year,month}=entry;
      const mm=String(month+1).padStart(2,'0');
      const mesStr=`${year}-${mm}-01`;
      localStorage.setItem('skala_extrato_mes',mesStr);
      filterExtratoInicio=mesStr;filterExtratoFim=new Date(year,month+1,0).toISOString().slice(0,10);
      TAB='extrato';pushTab('extrato');buildNav();render();
    });
  });
}

function drawPieChart(id,data,mode){
  const svg=document.getElementById(id);if(!svg)return;
  const center=document.getElementById('donut-center');
  const leg=document.getElementById('pie-legend');
  const COLS=['#00532C','#007A48','#1A9C5A','#5BBE84','#F6CC0F','#F2DE8A','#BDE2C9','#FADE6B'];
  const R=70,CX=100,CY=100,C=2*Math.PI*R;
  const monthIndex=getDashboardMonthIndex();
  const fmtBRL=v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtK=v=>(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k';
  if(!data.length){
    svg.innerHTML=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--s2)" stroke-width="30"/>`;
    if(center)center.innerHTML=`<div class="dc-lbl">Sem dados</div>`;
    if(leg)leg.innerHTML='';return;
  }
  const total=data.reduce((s,d)=>s+d.val,0);
  const slices=data.map((d,i)=>({...d,color:COLS[i%COLS.length],pct:d.val/total}));

  function buildSVG(){
    let out=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--s2)" stroke-width="30"/>`;
    let offset=0;
    slices.forEach((s,i)=>{const len=s.pct*C;out+=`<circle class="donut-seg" data-i="${i}" cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;offset+=len;});
    return out;
  }
  function setCenter(i){
    if(!center)return;
    if(i==null){
      center.style.removeProperty('--seg-color');
      center.innerHTML=`<div class="dc-lbl">Total ${mode==='D'?'Despesas':'Receitas'}</div><div class="dc-val"><span class="dc-cur">R$</span>${fmtK(total)}</div><div class="dc-sub">${slices.length} categori${slices.length===1?'a':'as'}</div>`;
    } else {
      const s=slices[i];center.style.setProperty('--seg-color',s.color);
      center.innerHTML=`<div class="dc-lbl" style="color:var(--seg-color)">${esc(s.lbl)}</div><div class="dc-val"><span class="dc-cur">R$</span>${fmtK(s.val)}</div><div class="dc-sub">${(s.pct*100).toFixed(1)}% do total</div>`;
    }
  }

  svg.innerHTML=buildSVG();
  setCenter(null);

  if(leg){
    leg.innerHTML=slices.map((s,i)=>`<div class="donut-leg-item" data-i="${i}" onclick="pieClickCat(${JSON.stringify(s.lbl)},${JSON.stringify(mode||'D')})"><span class="donut-leg-dot" style="background:${s.color}"></span><span class="donut-leg-name">${esc(s.lbl)}</span><span class="donut-leg-val">${fmtBRL(s.val)}</span><span class="donut-leg-pct">${Math.round(s.pct*100)}%</span></div>`).join('');
  }

  const segs=[...svg.querySelectorAll('.donut-seg')];
  const items=leg?[...leg.querySelectorAll('.donut-leg-item')]:[];
  const enter=i=>{
    segs.forEach((s,j)=>{s.classList.toggle('donut-dim',j!==i);s.classList.toggle('donut-hot',j===i);});
    items.forEach((it,j)=>it.classList.toggle('donut-leg-dim',j!==i));
    setCenter(i);
  };
  const leave=()=>{
    segs.forEach(s=>{s.classList.remove('donut-dim');s.classList.remove('donut-hot');});
    items.forEach(it=>it.classList.remove('donut-leg-dim'));
    setCenter(null);
  };
  segs.forEach((s,i)=>{s.addEventListener('mouseenter',()=>enter(i));s.addEventListener('mouseleave',leave);});
  items.forEach((it,i)=>{it.addEventListener('mouseenter',()=>enter(i));it.addEventListener('mouseleave',leave);});
}

function _buildPieCategs(pieMode,monthIdx){
  const tipo=pieMode==='D'?'D':'R';
  return (pieMode==='D'?getDespCats():getRecCats()).map(cat=>{
    const val=DATA.filter(l=>
      l.tipo===tipo&&l.dataComp&&
      getY(l.dataComp)===YEAR&&getM(l.dataComp)===monthIdx&&
      l.status!=='Cancelado'&&l.cat===cat.nome&&!isTransfer(l)
    ).reduce((s,l)=>s+titleAmount(l),0);
    return{lbl:cat.nome,val};
  }).filter(d=>d.val>0);
}
function setPieMode(m){
  window._pieMode=m;
  const monthIndex=getDashboardMonthIndex();
  const cats=_buildPieCategs(m,monthIndex);
  const ttl=document.getElementById('pie-ttl');if(ttl)ttl.textContent='Composição das '+(m==='D'?'Despesas':'Receitas');
  document.querySelectorAll('.donut-seg-btn').forEach(btn=>btn.classList.toggle('on',(btn.textContent.trim()==='Despesas'&&m==='D')||(btn.textContent.trim()==='Receitas'&&m==='R')));
  drawPieChart('chart-pie',cats,m);
}

function pieClickCat(cat,tipo){
  filterTipos=new Set([tipo]);filterCats=new Set([cat]);filterSub='';
  TAB=tipo==='R'?'receber':'pagar';buildNav();render();
}

function toggleDREPct(){
  const show=localStorage.getItem('skala_dre_show_pct')==='1';
  localStorage.setItem('skala_dre_show_pct',show?'0':'1');
  renderDRE(document.getElementById('content'));
}

function setDREView(v){
  localStorage.setItem('skala_dre_view',v);
  renderDRE(document.getElementById('content'));
}

function navDREMes(delta){
  dreViewMes=Math.max(0,Math.min(11,dreViewMes+delta));
  renderDRE(document.getElementById('content'));
}

function setFluxoView(v){
  localStorage.setItem('skala_fluxo_view',v);
  renderFluxo(document.getElementById('content'));
}

function navFluxoMes(delta){
  fluxoViewMes=Math.max(0,Math.min(11,fluxoViewMes+delta));
  renderFluxo(document.getElementById('content'));
}

function exportDREPDF(){
  document.body.classList.add('printing');
  window.onafterprint=()=>document.body.classList.remove('printing');
  window.print();
}

function setDREChartPeriod(p){
  localStorage.setItem('skala_dre_chart_period',String(p));
  [6,12].forEach(n=>{const btn=document.getElementById('dre-period-'+n);if(btn){btn.className='dre-seg-btn'+(n===p?' on':'');}});
  drawDRELineChart();
}

function drawDRELineChart(){
  if(window._dreLineChart){try{window._dreLineChart.destroy();}catch(e){}window._dreLineChart=null;}
  const plot=document.getElementById('dre-line-plot');if(!plot)return;
  const period=parseInt(localStorage.getItem('skala_dre_chart_period')||'12');
  const dre=calcDRE(YEAR);
  const now=new Date();
  const lastIdx=YEAR<now.getFullYear()?11:Math.min(now.getMonth(),11);
  const startIdx=Math.max(0,lastIdx-period+1);
  const chartWin=dre.slice(startIdx,lastIdx+1).map((m,i)=>({label:MONTHS[startIdx+i],monthIdx:startIdx+i,recOpLiq:m.recOpLiq||0,totDesp:m.totDesp||0,ll:m.ll||0}));
  window._dreChartWin=chartWin;
  const data=chartWin.map(m=>({mes:m.label,monthIdx:m.monthIdx,entradas:m.recOpLiq,saidas:m.totDesp,resultado:m.ll}));
  const N=data.length;if(!N)return;
  // Geometry
  const W=800,H=220,padT=16,padB=28,padL=44,padR=12;
  const innerW=W-padL-padR,innerH=H-padT-padB;
  const colW=innerW/N;
  const allVals=data.flatMap(d=>[d.entradas,d.saidas,d.resultado]);
  let yMax=Math.max(...allVals,0),yMin=Math.min(...allVals,0);
  const span=(yMax-yMin)||1;yMax+=span*0.10;yMin-=span*0.06;
  const yRange=yMax-yMin;
  const xPos=i=>N<=1?padL+innerW/2:padL+(innerW/(N-1))*i;
  const yPos=v=>padT+innerH-((v-yMin)/yRange)*innerH;
  const fkax=v=>v===0?'0':(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:0})+'k';
  let grid='',yLbls='';
  for(let t=0;t<=3;t++){
    const val=yMin+(yRange/3)*t,yy=yPos(val);
    grid+=`<line stroke="rgba(15,100,53,0.09)" stroke-width="1" stroke-dasharray="4 4" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W-padR}" y2="${yy.toFixed(1)}"/>`;
    yLbls+=`<text class="lc-ylbl" x="${(padL-6).toFixed(1)}" y="${(yy+3).toFixed(1)}" text-anchor="end">${fkax(val)}</text>`;
  }
  let zeroLine='';
  if(yMin<0&&yMax>0){const yz=yPos(0);zeroLine=`<line stroke="rgba(15,100,53,0.28)" stroke-width="1.2" x1="${padL}" y1="${yz.toFixed(1)}" x2="${W-padR}" y2="${yz.toFixed(1)}"/>`;}
  const ptsOf=key=>data.map((d,i)=>({x:xPos(i),y:yPos(d[key])}));
  const entPts=ptsOf('entradas'),saiPts=ptsOf('saidas'),resPts=ptsOf('resultado');
  const entPath=_smoothPath(entPts),saiPath=_smoothPath(saiPts),resPath=_smoothPath(resPts);
  const bottom=padT+innerH;
  const closeArea=(path,pts)=>path+` L${pts[pts.length-1].x.toFixed(1)},${bottom.toFixed(1)} L${pts[0].x.toFixed(1)},${bottom.toFixed(1)} Z`;
  const dotsFor=(key,col,negCol)=>data.map((d,i)=>`<circle stroke="${(key==='resultado'&&d[key]<0)?negCol:col}" stroke-width="2.5" fill="var(--s1)" cx="${xPos(i).toFixed(1)}" cy="${yPos(d[key]).toFixed(1)}" r="3"/>`).join('');
  let xLbls='',hovers='',hits='';
  data.forEach((d,i)=>{
    xLbls+=`<text class="lc-xlbl" data-i="${i}" x="${xPos(i).toFixed(1)}" y="${(H-6).toFixed(1)}" text-anchor="middle">${d.mes}</text>`;
    hovers+=`<line class="lc-hover" data-i="${i}" x1="${xPos(i).toFixed(1)}" y1="${padT}" x2="${xPos(i).toFixed(1)}" y2="${(padT+innerH).toFixed(1)}"/>`;
    const hx=i===0?padL:(xPos(i)+xPos(i-1))/2;
    const hx2=i===N-1?W-padR:(xPos(i)+xPos(i+1))/2;
    hits+=`<rect class="lc-hit" data-i="${i}" x="${hx.toFixed(1)}" y="0" width="${(hx2-hx).toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;
  });
  plot.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:220px;overflow:visible">
    <defs>
      <linearGradient id="drcGrEnt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(26,138,79,0.28)"/><stop offset="55%" stop-color="rgba(26,138,79,0.08)"/><stop offset="100%" stop-color="rgba(26,138,79,0)"/></linearGradient>
      <linearGradient id="drcGrSai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(240,200,20,0.30)"/><stop offset="55%" stop-color="rgba(240,200,20,0.10)"/><stop offset="100%" stop-color="rgba(240,200,20,0)"/></linearGradient>
    </defs>
    ${grid}${yLbls}${zeroLine}
    <path fill="url(#drcGrEnt)" d="${closeArea(entPath,entPts)}"/>
    <path fill="url(#drcGrSai)" d="${closeArea(saiPath,saiPts)}"/>
    ${hovers}
    <path fill="none" stroke="#00532C" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round" d="${resPath}"/>
    <path fill="none" stroke="#1A8A4F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" d="${entPath}"/>
    <path fill="none" stroke="#E0B80D" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" d="${saiPath}"/>
    ${dotsFor('resultado','#00532C','var(--red)')}${dotsFor('entradas','#1A9C5A','#1A9C5A')}${dotsFor('saidas','#E0B80D','#E0B80D')}
    ${xLbls}${hits}
  </svg><div id="lc-dre-tip" class="lc-tip"></div>`;
  const svgEl=plot.querySelector('svg');
  const tipEl=plot.querySelector('#lc-dre-tip');
  const hoverEls=[...svgEl.querySelectorAll('.lc-hover')];
  const xLblEls=[...svgEl.querySelectorAll('.lc-xlbl')];
  const hitEls=[...svgEl.querySelectorAll('.lc-hit')];
  const showTip=i=>{
    const d=data[i];
    const svgRect=svgEl.getBoundingClientRect(),plotRect=plot.getBoundingClientRect();
    const scaleX=svgRect.width/W,scaleY=svgRect.height/H;
    const topVal=Math.max(d.entradas,d.saidas);
    const px=xPos(i)*scaleX+(svgRect.left-plotRect.left);
    const py=yPos(topVal)*scaleY+(svgRect.top-plotRect.top);
    const lbl=`${MONTHS_FULL[d.monthIdx]} ${YEAR}`;
    tipEl.innerHTML=`<div class="lc-tt-mes">${lbl}</div>`+
      `<div class="lc-tt-row lc-ent-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-ent"></span>Rec. Líquida</span><span class="lc-tt-v">${fmtCard(d.entradas)}</span></div>`+
      `<div class="lc-tt-row lc-sai-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-sai"></span>Despesas</span><span class="lc-tt-v">${fmtCard(d.saidas)}</span></div>`+
      `<div class="lc-tt-row lc-res-row"><span class="lc-tt-k"><span class="lc-tt-dot lc-res"></span>Resultado</span><span class="lc-tt-v${d.resultado<0?' lc-neg':''}">${fmtCard(d.resultado)}</span></div>`;
    tipEl.style.left=px+'px';tipEl.style.top=py+'px';tipEl.classList.add('show');
  };
  const hideTip=()=>tipEl.classList.remove('show');
  hitEls.forEach(h=>{
    const i=+h.dataset.i;
    h.addEventListener('mouseenter',()=>{hoverEls.forEach(hl=>hl.classList.toggle('show',+hl.dataset.i===i));xLblEls.forEach(xl=>xl.classList.toggle('on',+xl.dataset.i===i));showTip(i);});
    h.addEventListener('mouseleave',()=>{hoverEls.forEach(hl=>hl.classList.remove('show'));xLblEls.forEach(xl=>xl.classList.remove('on'));hideTip();});
    h.addEventListener('click',()=>{
      const entry=chartWin[i];if(!entry)return;
      const mm=String(entry.monthIdx+1).padStart(2,'0');
      const mesStr=`${YEAR}-${mm}-01`;
      filterExtratoInicio=mesStr;filterExtratoFim=new Date(YEAR,entry.monthIdx+1,0).toISOString().slice(0,10);
      TAB='extrato';pushTab('extrato');buildNav();render();
    });
  });
}

function drawDREMesChart(){
  const plot=document.getElementById('dre-mes-plot');
  if(!plot)return;
  if(window._dreBarChart){try{window._dreBarChart.destroy();}catch(e){}window._dreBarChart=null;}

  const dre=calcDRE(YEAR);
  const startIdx=Math.max(0,dreViewMes-5);
  const months=[];for(let i=startIdx;i<=dreViewMes;i++)months.push(i);
  const data=months.map(i=>({mes:MONTHS[i],monthIdx:i,receita:dre[i].recOpBruta||0,despesa:dre[i].totDesp||0,resultado:dre[i].ll||0}));
  const N=data.length;
  const W=760,H=280,padT=34,padB=28,padX=8;
  const innerW=W-padX*2,innerH=H-padT-padB,colW=innerW/N;
  const maxBar=Math.max(...data.map(d=>Math.max(d.receita,d.despesa)),1);
  const resVals=data.map(d=>d.resultado);
  const resMax=Math.max(...resVals,0),resMin=Math.min(...resVals,0);
  const resRange=(resMax-resMin)||1;
  const barScale=v=>(v/maxBar)*innerH;
  const lineTop=padT+6,lineBot=padT+innerH*0.62;
  const resY=v=>lineBot-((v-resMin)/resRange)*(lineBot-lineTop);
  const baseY=padT+innerH;
  const bw=Math.min(16,colW*0.22),gap=4;
  const fmtK=v=>{const s=v<0?'-':'',a=Math.abs(v);return s+'R$'+(a>=1000?(a/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k':a.toLocaleString('pt-BR',{maximumFractionDigits:0}));};
  const fmtBRL=v=>'R$ '+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const pts=data.map((d,i)=>({x:padX+colW*i+colW/2,y:resY(d.resultado),neg:d.resultado<0}));
  const linePath=N>1?pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '):'';
  const areaPath=N>1?linePath+` L${pts[N-1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`:'';

  let grid='';
  for(let g=0;g<4;g++){const y=padT+(innerH/4)*g;grid+=`<line x1="${padX}" y1="${y.toFixed(1)}" x2="${W-padX}" y2="${y.toFixed(1)}" stroke="rgba(15,100,53,0.10)" stroke-width="1" stroke-dasharray="4 4"/>`;}

  let cols='';
  data.forEach((d,i)=>{
    const cx=pts[i].x,recH=barScale(d.receita),despH=barScale(d.despesa);
    const recX=cx-bw-gap/2,despX=cx+gap/2,isCur=i===N-1;
    cols+=`<g class="dre-col${isCur?' dre-col-on':''}" data-i="${i}">
      <rect x="${recX.toFixed(1)}" y="${(baseY-recH).toFixed(1)}" width="${bw.toFixed(1)}" height="${recH.toFixed(1)}" rx="4" fill="url(#dreGRec)" class="dre-bar"/>
      <rect x="${despX.toFixed(1)}" y="${(baseY-despH).toFixed(1)}" width="${bw.toFixed(1)}" height="${despH.toFixed(1)}" rx="4" fill="url(#dreGDesp)" class="dre-bar"/>
      <circle cx="${pts[i].x.toFixed(1)}" cy="${pts[i].y.toFixed(1)}" r="4" class="dre-rdot${pts[i].neg?' dre-rdot-neg':''}"/>
      <text x="${pts[i].x.toFixed(1)}" y="${(pts[i].y-10).toFixed(1)}" text-anchor="middle" class="dre-rval${pts[i].neg?' dre-rval-neg':''}">${fmtK(d.resultado)}</text>
      <text x="${cx.toFixed(1)}" y="${(baseY+18).toFixed(1)}" text-anchor="middle" class="dre-xlbl${isCur?' dre-xlbl-on':''}">${d.mes}</text>
      <rect x="${(padX+colW*i).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer" class="dre-hit"/>
    </g>`;
  });

  let tip=document.getElementById('dre-mes-tip');
  if(!tip){tip=document.createElement('div');tip.id='dre-mes-tip';tip.style.cssText='position:fixed;pointer-events:none;background:#00532c;color:#fff;border-radius:8px;padding:10px 13px;opacity:0;transform:translate(-50%,calc(-100% - 10px));transition:opacity .12s;white-space:nowrap;z-index:1000;box-shadow:0 4px 20px rgba(0,83,44,.30)';document.body.appendChild(tip);}

  const svg=`<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">
    <defs>
      <linearGradient id="dreGRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1A9C5A"/><stop offset="100%" stop-color="#007A48"/></linearGradient>
      <linearGradient id="dreGDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F8D43D"/><stop offset="100%" stop-color="#E0B80D"/></linearGradient>
      <linearGradient id="dreGArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,83,44,0.10)"/><stop offset="100%" stop-color="rgba(0,83,44,0)"/></linearGradient>
    </defs>
    ${grid}
    ${areaPath?`<path fill="url(#dreGArea)" d="${areaPath}"/>`:''}
    ${linePath?`<path fill="none" stroke="#00532c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" d="${linePath}"/>`:''}
    ${cols}
  </svg>`;

  [...plot.querySelectorAll('svg')].forEach(s=>s.remove());
  plot.insertAdjacentHTML('afterbegin',svg);

  const colEls=[...plot.querySelectorAll('.dre-col')];
  colEls.forEach(col=>{
    const i=+col.dataset.i;
    col.querySelector('.dre-hit').addEventListener('mouseenter',()=>{
      colEls.forEach(c=>c.classList.toggle('dre-col-dim',c!==col));
      col.classList.add('dre-col-on');col.classList.remove('dre-col-dim');
      const svgEl=plot.querySelector('svg'),rect=svgEl.getBoundingClientRect();
      const scaleX=rect.width/W,scaleY=rect.height/H;
      const d=data[i];
      tip.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#F8D43D;margin-bottom:6px">${MONTHS_FULL[d.monthIdx]}&nbsp;${YEAR}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#1A9C5A;display:inline-block;flex-shrink:0"></span>Receita</span><span style="font-weight:700;font-size:12px">${fmtBRL(d.receita)}</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#F8D43D;display:inline-block;flex-shrink:0"></span>Despesa</span><span style="font-weight:700;font-size:12px">${fmtBRL(d.despesa)}</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid rgba(255,255,255,.18);margin-top:4px;padding-top:6px;line-height:1.7"><span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);font-size:12px"><span style="width:8px;height:8px;border-radius:2px;background:#fff;display:inline-block;flex-shrink:0"></span>Resultado</span><span style="font-weight:700;font-size:12px;color:${d.resultado<0?'#FF9B8E':'#fff'}">${d.resultado<0?'-':''}${fmtBRL(d.resultado)}</span></div>`;
      tip.style.left=(rect.left+pts[i].x*scaleX)+'px';
      tip.style.top=(rect.top+window.scrollY+pts[i].y*scaleY)+'px';
      tip.style.opacity='1';
    });
    col.querySelector('.dre-hit').addEventListener('mouseleave',()=>{
      colEls.forEach(c=>{c.classList.remove('dre-col-dim');c.classList.remove('dre-col-on');});
      if(colEls[N-1])colEls[N-1].classList.add('dre-col-on');
      tip.style.opacity='0';
    });
    col.querySelector('.dre-hit').addEventListener('click',()=>{
      const mm=String(data[i].monthIdx+1).padStart(2,'0');
      filterExtratoInicio=`${YEAR}-${mm}-01`;filterExtratoFim=new Date(YEAR,data[i].monthIdx+1,0).toISOString().slice(0,10);
      TAB='extrato';pushTab('extrato');buildNav();render();
    });
  });
}

function renderDRE(c){
  const dre=calcDRE(YEAR);
  const recCats=getRecCats().filter(c=>!isExclDRE(c));
  const despCats=getDespCats().filter(c=>!isExclDRE(c));
  const tot=k=>dre.reduce((s,m)=>s+(m[k]||0),0);

  const dreView=localStorage.getItem('skala_dre_view')||'anual';
  const dreM=dre[dreViewMes]||{};

  // #59 — Variação mês a mês (∆ Mensal)
  const showPct=localStorage.getItem('skala_dre_show_pct')==='1';

  // #53 — Destaque coluna mês atual
  const _now=new Date();
  const curMonthIdx=YEAR===_now.getFullYear()?_now.getMonth():-1;

  // Cards KPI anuais (visão anual) e mensais (visão mensal)
  const kpiRecLiq=tot('recOpLiq');
  const kpiDesp=tot('totDesp');
  const kpiLl=tot('ll');
  const kpiMargin=kpiRecLiq!==0?(kpiLl/kpiRecLiq*100):0;
  const llCol=kpiLl>=0?'var(--teal)':'var(--red)';
  const mCol=kpiMargin>=0?'var(--teal)':'var(--red)';
  const kpiCard=(lbl,val,sub,col,tip)=>`<div class="kpi" style="align-self:start"><div class="kpi-lbl" style="display:flex;align-items:center">${lbl}${tip?`<span class="kpi-info" data-tip="${tip}">?</span>`:''}</div><div class="kpi-val" style="color:${col}">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  const dreKpis=`<div class="dre-kpis">
    ${kpiCard('Receita Líquida',fmtCard(kpiRecLiq),`Acumulado ${YEAR}`,'var(--tx)','Receita Operacional Bruta menos Impostos e Taxas no ano.')}
    ${kpiCard('Total Despesas',fmtCard(kpiDesp),`Acumulado ${YEAR}`,'var(--tx)','Soma de todas as categorias de despesa lançadas no ano (regime de competência).')}
    ${kpiCard('Lucro Líquido',fmtCard(kpiLl),`Acumulado ${YEAR}`,llCol,'Resultado Operacional mais Receitas Não Operacionais menos Despesas Não Operacionais no ano.')}
    ${kpiCard('Margem Líquida',kpiRecLiq!==0?kpiMargin.toFixed(1)+'%':'—',`Acumulado ${YEAR}`,mCol,'Lucro Líquido ÷ Receita Líquida × 100.')}
  </div>`;
  // Cards KPI do mês selecionado (visão mensal)
  const mesKpiRecLiq=dreM.recOpLiq||0;
  const mesKpiDesp=dreM.totDesp||0;
  const mesKpiLl=dreM.ll||0;
  const mesKpiMargin=mesKpiRecLiq!==0?(mesKpiLl/mesKpiRecLiq*100):0;
  const mesLlCol=mesKpiLl>=0?'var(--teal)':'var(--red)';
  const mesMCol=mesKpiMargin>=0?'var(--teal)':'var(--red)';
  const mesMon=MONTHS_FULL[dreViewMes];
  const dreKpisMes=`<div class="dre-kpis">
    ${kpiCard('Receita Líquida',fmtCard(mesKpiRecLiq),mesMon,'var(--tx)','Receita Operacional Bruta menos Impostos e Taxas do mês.')}
    ${kpiCard('Total Despesas',fmtCard(mesKpiDesp),mesMon,'var(--tx)','Soma de todas as categorias de despesa lançadas no mês (regime de competência).')}
    ${kpiCard('Lucro Líquido',fmtCard(mesKpiLl),mesMon,mesLlCol,'Resultado Operacional mais Receitas Não Operacionais menos Despesas Não Operacionais.')}
    ${kpiCard('Margem Líquida',mesKpiRecLiq!==0?mesKpiMargin.toFixed(1)+'%':'—',mesMon,mesMCol,'Lucro Líquido ÷ Receita Líquida × 100.')}
  </div>`;

  // Estado de expansão
  if(!window._dreExpanded) window._dreExpanded={};
  window._dreDrillCells=[];

  function row(lbl,k,type='normal',groupId=null,parentId=null,neg=false,numSubs=0,drillInfo=null){
    const isTotal   = type==='total';
    const isSep     = type==='sep';
    const isGroup   = type==='group';
    const isSub     = type==='sub';
    const isResult  = type==='result';

    // #58 — sep: célula única, sticky com fundo opaco
    if(isSep) return `<tr class="sep"><td colspan="14" style="position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;

    const expanded = groupId ? (window._dreExpanded[groupId]===true) : true;
    const hasSubs  = groupId && !parentId && numSubs>0;

    // #53 + #59 — destaque mês atual + variação m/m opcional
    const cells=dre.map((m,i)=>{
      const v=(neg?-1:1)*(m[k]||0);
      const hlSt=i===curMonthIdx?';background:rgba(19,124,60,.06)':'';
      let varLine='';
      if(showPct&&i>0){
        const prev=(neg?-1:1)*(dre[i-1][k]||0);
        if(prev!==0){
          const vp=((v-prev)/Math.abs(prev))*100;
          const vCol=vp>=0?'var(--teal)':'var(--red)';
          varLine=`<span style="display:block;font-size:9.5px;color:${vCol};line-height:1.4;margin-top:1px">${vp>=0?'+':''}${vp.toFixed(1)}%</span>`;
        }else if(v!==0){
          varLine=`<span style="display:block;font-size:9.5px;color:var(--tx3);line-height:1.4;margin-top:1px">novo</span>`;
        }
      }
      if(drillInfo&&v!==0){
        const di=window._dreDrillCells.length;
        window._dreDrillCells.push({cat:drillInfo.cat,sub:drillInfo.sub,tipo:drillInfo.tipo,mes:i});
        return`<td class="${v<0?'neg':v>0?'pos':''}" style="cursor:pointer;font-size:11.5px${hlSt}" onclick="openDREDrillByIdx(${di})">${fmt(v)}${varLine}</td>`;
      }
      return`<td class="${v<0?'neg':v>0?'pos':''}" style="font-size:11.5px${hlSt}">${v!==0?fmt(v):'—'}${varLine}</td>`;
    }).join('');
    const tv=(neg?-1:1)*tot(k);

    let style='';
    // #58 — primeiro td sticky; background var(--s1) para ser opaco ao rolar horizontalmente
    let tdStyle=`padding-left:${isSub?40:isGroup?20:12}px;position:sticky;left:0;z-index:2;background:var(--s1)`;
    let cls='dr';
    if(isTotal||isResult) cls+=' bold';
    if(isResult) cls+=' hl';
    if(type==='lucro') cls+=' tot';

    // Linha oculta se for subcategoria de grupo fechado
    if(parentId&&window._dreExpanded[parentId]!==true) style='display:none';

    const toggleBtn = hasSubs ? `<span onclick="toggleDRE('${groupId}')" style="cursor:pointer;margin-right:6px;font-size:10px;display:inline-block;width:12px">${expanded?'▼':'▶'}</span>` : `<span style="display:inline-block;width:18px"></span>`;

    return`<tr class="${cls}" id="dre-row-${groupId||k}" style="${style}">
      <td style="${tdStyle}">${toggleBtn}${lbl}</td>${cells}
      <td class="${tv<0?'neg':tv>0?'pos':''} tc" style="font-weight:${isTotal||isResult||type==='lucro'?700:400}">${tv!==0?fmt(tv):'—'}</td>
    </tr>`;
  }

  function groupRows(cat, tipo){
    const neg = tipo==='D';
    const k = tipo==='R' ? 'r_'+(cat.slug||slugify(cat.nome)) : 'd_'+(cat.slug||slugify(cat.nome));
    const gid = k;
    const subs = (cat.subs||[]).sort((a,b)=>a.ordem-b.ordem);
    let html = row(cat.nome, k, 'group', gid, null, neg, subs.length, {cat:cat.nome,sub:'',tipo});
    subs.forEach(sub=>{
      const sk = tipo==='R' ? 'rs_'+(sub.slug||slugify(sub.nome)) : 'ds_'+(sub.slug||slugify(sub.nome));
      html += row(sub.nome, sk, 'sub', sk, gid, neg, 0, {cat:cat.nome,sub:sub.nome,tipo});
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

  const _today=new Date();
  const _emitido=`${String(_today.getDate()).padStart(2,'0')}/${String(_today.getMonth()+1).padStart(2,'0')}/${_today.getFullYear()}`;

  // ── Visão Mensal: DRE expandível do mês selecionado ─────────────
  const mBase=dreM.recOpBruta||0;
  const mPct=v=>mBase?`${(v/mBase*100).toFixed(1)}%`:'—';

  if(!window._dreExpandedMes) window._dreExpandedMes={};

  function rowMes(lbl,k,type='normal',groupId=null,parentId=null,neg=false,numSubs=0,drillInfo=null){
    const isSep=type==='sep';
    const isGroup=type==='group';
    const isSub=type==='sub';
    if(isSep) return`<tr class="sep"><td colspan="3" style="position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;
    const expanded=groupId?(window._dreExpandedMes[groupId]===true):true;
    const hasSubs=groupId&&!parentId&&numSubs>0;
    const v=(neg?-1:1)*(dreM[k]||0);
    const col=v<0?'var(--red)':(v>0?'var(--teal)':'var(--tx3)');
    let style='';
    if(parentId&&window._dreExpandedMes[parentId]!==true) style='display:none';
    let cls='dr';
    if(type==='total'||type==='result') cls+=' bold';
    if(type==='result') cls+=' hl';
    if(type==='lucro') cls+=' tot';
    const tdStyle=`padding-left:${isSub?40:isGroup?20:12}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
    const toggleBtn=hasSubs?`<span onclick="toggleDREMes('${groupId}')" style="cursor:pointer;margin-right:6px;font-size:10px;display:inline-block;width:12px;flex-shrink:0">${expanded?'▼':'▶'}</span>`:`<span style="display:inline-block;width:18px;flex-shrink:0"></span>`;
    let valTd;
    if(drillInfo&&v!==0){
      const di=window._dreDrillCells.length;
      window._dreDrillCells.push({cat:drillInfo.cat,sub:drillInfo.sub,tipo:drillInfo.tipo,mes:dreViewMes});
      valTd=`<td style="text-align:right;color:${col};font-size:12px;white-space:nowrap;cursor:pointer" onclick="openDREDrillByIdx(${di})">${fmt(v)}</td>`;
    } else {
      valTd=`<td style="text-align:right;color:${col};font-size:12px;white-space:nowrap">${v!==0?fmt(v):'—'}</td>`;
    }
    return`<tr class="${cls}" style="${style}">
      <td style="${tdStyle}">${toggleBtn}${lbl}</td>
      ${valTd}
      <td style="text-align:right;color:var(--tx2);font-size:11px;white-space:nowrap;padding-right:10px">${v!==0?mPct(Math.abs(v)):'—'}</td>
    </tr>`;
  }

  function groupRowsMes(cat,tipo){
    const neg=tipo==='D';
    const k=tipo==='R'?'r_'+(cat.slug||slugify(cat.nome)):'d_'+(cat.slug||slugify(cat.nome));
    const subs=(cat.subs||[]).sort((a,b)=>a.ordem-b.ordem);
    let html=rowMes(cat.nome,k,'group',k,null,neg,subs.length,{cat:cat.nome,sub:'',tipo});
    subs.forEach(sub=>{
      const sk=tipo==='R'?'rs_'+(sub.slug||slugify(sub.nome)):'ds_'+(sub.slug||slugify(sub.nome));
      html+=rowMes(sub.nome,sk,'sub',sk,k,neg,0,{cat:cat.nome,sub:sub.nome,tipo});
    });
    return html;
  }

  const gMes=(cat,tipo)=>cat?groupRowsMes(cat,tipo):'';

  const segBtn=(v,lbl)=>`<button class="dre-seg-btn${dreView===v?' on':''}" onclick="setDREView('${v}')">${lbl}</button>`;

  c.innerHTML=`
  <div class="print-hdr">
    <div class="print-hdr-main">
      <div class="print-hdr-name">Skala Contabilidade</div>
      <div class="print-hdr-doc">DRE — Regime de Competência · ${YEAR}</div>
    </div>
    <div class="print-hdr-date">Emitido em ${_emitido}</div>
  </div>
  <div class="tbl-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 116px);overflow:visible">
    <div class="tbl-hdr" style="display:flex;align-items:center;justify-content:space-between">
      <div class="sec-ttl">DRE — Regime de Competência <span class="yr-pill">${YEAR}</span></div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="dre-seg">${segBtn('anual','Anual')}${segBtn('mensal','Mensal')}</div>
        ${dreView==='anual'?`
          <button class="btn btn-ghost" style="font-size:12px;${showPct?'border-color:var(--brand);color:var(--brand);background:rgba(19,124,60,.06)':''}" onclick="toggleDREPct()">% Mensal</button>
          <button class="btn btn-ghost" style="font-size:12px" onclick="toggleAllDRE()">⊞ Expandir/Recolher tudo</button>
        `:`
          <button class="btn btn-ghost" style="font-size:12px" onclick="toggleAllDREMes()">⊞ Expandir/Recolher tudo</button>
        `}
        <button class="btn btn-ghost" style="font-size:12px" onclick="exportDREExcel()">${appIcon('download')}Exportar Excel</button>
        <button class="btn btn-ghost" style="font-size:12px" onclick="exportDREPDF()">${appIcon('print')}PDF</button>
      </div>
    </div>
    ${dreView==='anual'?dreKpis:''}

    ${dreView==='anual'?`
    <div class="tbl-scroll" style="flex:1;overflow:auto"><table class="fin-tbl resizable" id="dre-table">${renderFinColgroup()}<thead>${renderFinHead(curMonthIdx,true)}</thead>
      <tbody>
        ${row('RECEITAS OPERACIONAIS','','sep')}
        ${recOpCats.map(cat=>groupRows(cat,'R')).join('')}
        ${row('(=) RECEITA OPERACIONAL BRUTA','recOpBruta','result')}

        ${impostoCat?`${row('IMPOSTOS E TAXAS','','sep')}${g(impostoCat,'D')}`:''}
        ${row('(=) RECEITA OPERACIONAL LÍQUIDA','recOpLiq','result')}

        ${pessoalCat?`${row('CUSTO COM PESSOAL','','sep')}${g(pessoalCat,'D')}${row('(=) CUSTO COM PESSOAL','cusPessoal','total',null,null,true)}`:''}
        ${row('(=) LUCRO OPERACIONAL BRUTO','lucOpBruto','result')}

        ${despOpCats.length?`${row('DESPESAS OPERACIONAIS','','sep')}${despOpCats.map(cat=>g(cat,'D')).join('')}${row('(=) DESPESAS OPERACIONAIS','despOp','total',null,null,true)}`:''}
        ${row('(=) RESULTADO OPERACIONAL','resOp','result')}

        ${recNaoOpCats.length?`${row('RECEITAS NÃO OPERACIONAIS','','sep')}${recNaoOpCats.map(cat=>groupRows(cat,'R')).join('')}${row('(=) RECEITAS NÃO OPERACIONAIS','outrasRec','total')}`:''}
        ${despNaoOpCats.length?`${row('DESPESAS NÃO OPERACIONAIS','','sep')}${despNaoOpCats.map(cat=>groupRows(cat,'D')).join('')}${row('(=) DESPESAS NÃO OPERACIONAIS','despNaoOp','total',null,null,true)}`:''}

        ${row('RESULTADO FINAL','ll','lucro')}
      </tbody>
    </table>
    <div style="padding:20px 4px 16px">
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:13px;font-weight:700;color:var(--tx)">Evolução do Resultado <span class="yr-pill">${YEAR}</span></div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="display:flex;gap:10px;font-size:11px;color:var(--tx2)">
              <span><span style="color:#1A8A4F">●</span> Rec. Líquida</span>
              <span><span style="color:#E0B80D">●</span> Despesas</span>
              <span><span style="color:#00532C">●</span> Resultado</span>
            </div>
            <div class="dre-seg">
              <button id="dre-period-6"  class="dre-seg-btn" onclick="setDREChartPeriod(6)">6 meses</button>
              <button id="dre-period-12" class="dre-seg-btn" onclick="setDREChartPeriod(12)">12 meses</button>
            </div>
          </div>
        </div>
        <div id="dre-line-plot" style="height:220px;position:relative"></div>
      </div>
    </div>
    </div>
    `:`
    ${dreKpisMes}
    <div style="flex:1;overflow:hidden;padding:0 20px 16px;display:flex;gap:20px;min-height:0">
      <div style="flex:0 0 52%;display:flex;flex-direction:column;min-height:0">
        <div class="dre-mes-nav">
          <button onclick="navDREMes(-1)" ${dreViewMes===0?'disabled':''}>‹</button>
          <span>${MONTHS_FULL[dreViewMes]} ${YEAR}</span>
          <button onclick="navDREMes(1)" ${dreViewMes===11?'disabled':''}>›</button>
        </div>
        <div class="tbl-scroll" style="flex:1;overflow-y:auto">
          <table class="fin-tbl" style="width:100%;table-layout:fixed;min-width:0">
            <colgroup><col><col style="width:120px"><col style="width:70px"></colgroup>
            <thead><tr>
              <th style="text-align:left;padding-left:32px">Descrição</th>
              <th style="text-align:right">Valor</th>
              <th style="text-align:right;padding-right:10px">% Rec.</th>
            </tr></thead>
            <tbody>
              ${rowMes('RECEITAS OPERACIONAIS','','sep')}
              ${recOpCats.map(cat=>groupRowsMes(cat,'R')).join('')}
              ${rowMes('(=) RECEITA OPERACIONAL BRUTA','recOpBruta','result')}
              ${impostoCat?`${rowMes('IMPOSTOS E TAXAS','','sep')}${gMes(impostoCat,'D')}`:''}
              ${rowMes('(=) RECEITA OPERACIONAL LÍQUIDA','recOpLiq','result')}
              ${pessoalCat?`${rowMes('CUSTO COM PESSOAL','','sep')}${gMes(pessoalCat,'D')}${rowMes('(=) CUSTO COM PESSOAL','cusPessoal','total',null,null,true)}`:''}
              ${rowMes('(=) LUCRO OPERACIONAL BRUTO','lucOpBruto','result')}
              ${despOpCats.length?`${rowMes('DESPESAS OPERACIONAIS','','sep')}${despOpCats.map(cat=>gMes(cat,'D')).join('')}${rowMes('(=) DESPESAS OPERACIONAIS','despOp','total',null,null,true)}`:''}
              ${rowMes('(=) RESULTADO OPERACIONAL','resOp','result')}
              ${recNaoOpCats.length?`${rowMes('RECEITAS NÃO OPERACIONAIS','','sep')}${recNaoOpCats.map(cat=>groupRowsMes(cat,'R')).join('')}${rowMes('(=) RECEITAS NÃO OPERACIONAIS','outrasRec','total')}`:''}
              ${despNaoOpCats.length?`${rowMes('DESPESAS NÃO OPERACIONAIS','','sep')}${despNaoOpCats.map(cat=>groupRowsMes(cat,'D')).join('')}${rowMes('(=) DESPESAS NÃO OPERACIONAIS','despNaoOp','total',null,null,true)}`:''}
              ${rowMes('RESULTADO LÍQUIDO','ll','lucro')}
            </tbody>
          </table>
        </div>
      </div>
      <div id="dre-chart-mensal" style="flex:1;min-width:0;background:var(--s1);border:1px solid var(--bd);border-radius:12px;align-self:flex-start;margin-top:0">
        <div style="padding:16px 20px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:3px">Performance</div>
            <div style="font-size:15px;font-weight:700;color:var(--tx);line-height:1.2">Receita, Despesa e Resultado</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:2px">Regime de competência · últimos 6 meses</div>
          </div>
        </div>
        <div id="dre-mes-plot" style="position:relative;padding:0 12px 4px"></div>
        <div style="display:flex;gap:20px;padding:12px 20px 16px;border-top:1px solid var(--bd)">
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#1A9C5A,#007A48);display:inline-block;flex-shrink:0"></span>Receita</span>
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#F8D43D,#E0B80D);display:inline-block;flex-shrink:0"></span>Despesa</span>
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="position:relative;width:16px;height:2.5px;background:#00532c;display:inline-block;flex-shrink:0"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:7px;height:7px;border-radius:50%;background:#fff;border:2px solid #00532c;display:block"></span></span>Resultado</span>
        </div>
      </div>
    </div>
    `}
  </div>`;
  if(dreView==='anual') setTimeout(()=>drawDRELineChart(),0);
  else setTimeout(()=>drawDREMesChart(),0);

  // #67 — Drill-down panel
  const oldDreDrill=document.getElementById('dre-drill');if(oldDreDrill)oldDreDrill.remove();
  if(dreDrillDown){
    const d=dreDrillDown;
    const comp=`${YEAR}-${String(d.mes+1).padStart(2,'0')}-01`;
    const items=DATA.filter(l=>{
      if(l.status==='Cancelado')return false;
      if(l.tipo!==d.tipo||l.cat!==d.cat)return false;
      if(d.sub&&l.sub!==d.sub)return false;
      if(l.dataComp!==comp)return false;
      return true;
    }).sort((a,b)=>(a.dataPgto||a.dataVenc||'').localeCompare(b.dataPgto||b.dataVenc||''));
    const total=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
    const catTitle=d.sub?`${esc(d.cat)} › ${esc(d.sub)}`:esc(d.cat);
    const drillRows=items.map(l=>{
      const dt=l.dataPgto||l.dataVenc||l.dataComp||'';
      const stBadge=l.status==='Cancelado'?'':l.status==='Pendente'||l.status==='Parcial'?`<span style="font-size:9px;background:rgba(227,179,65,.18);color:var(--gold);border-radius:4px;padding:1px 5px;margin-left:4px">${l.status}</span>`:'';
      return`<tr style="cursor:pointer;border-bottom:1px solid var(--bd2)" onclick="openEdit('${l.id}')">
        <td style="font-size:11px;padding:7px 8px;white-space:nowrap">${dt?dateBR(dt):'—'}</td>
        <td style="font-size:11px;padding:7px 8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${esc(l.desc||l.sub||l.cat)}${stBadge}</td>
        <td style="font-size:11px;padding:7px 8px;color:var(--tx2);white-space:nowrap">${esc(l.conta||'—')}</td>
        <td style="font-size:11px;padding:7px 8px;text-align:right;white-space:nowrap;color:${l.tipo==='R'?'var(--teal)':'var(--red)'};font-weight:600">${fmt(l.valorLiq)}</td>
      </tr>`;
    }).join('');
    const panel=document.createElement('div');
    panel.id='dre-drill';
    panel.style.cssText='position:fixed;right:0;top:0;height:100vh;width:480px;background:var(--s1);border-left:1px solid var(--bd);box-shadow:-4px 0 24px rgba(0,0,0,.14);z-index:200;display:flex;flex-direction:column;overflow:hidden';
    panel.innerHTML=`
      <div style="padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--tx)">${catTitle}</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:3px">${MONTHS_FULL[d.mes]} ${YEAR} · ${items.length} lançamento${items.length!==1?'s':''}</div>
        </div>
        <button onclick="closeDREDrill()" style="background:none;border:none;cursor:pointer;color:var(--tx2);font-size:22px;line-height:1;padding:0 4px;flex-shrink:0;margin-top:-2px" title="Fechar">×</button>
      </div>
      ${items.length?`
      <div style="flex:1;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid var(--bd)">
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Data</th>
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Descrição</th>
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Conta</th>
            <th style="font-size:10px;font-weight:700;text-align:right;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Valor</th>
          </tr></thead>
          <tbody>${drillRows}</tbody>
        </table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--s2)">
        <span style="font-size:12px;color:var(--tx2);font-weight:600">Total</span>
        <strong style="font-size:14px;color:${d.tipo==='R'?'var(--teal)':'var(--red)'}">${fmt(total)}</strong>
      </div>`
      :`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:13px">Nenhum lançamento encontrado</div>`}
    `;
    document.body.appendChild(panel);
  }
}

function _saveScroll(renderFn){
  const sc=document.querySelector('.tbl-scroll');
  const st=sc?sc.scrollTop:0,sl=sc?sc.scrollLeft:0;
  const mainEl=document.getElementById('main');
  const mainTop=mainEl?mainEl.scrollTop:0;
  const winY=window.scrollY||window.pageYOffset||0;
  renderFn(document.getElementById('content'));
  requestAnimationFrame(()=>{
    const s=document.querySelector('.tbl-scroll');
    if(s){s.scrollTop=st;s.scrollLeft=sl;}
    if(mainEl)mainEl.scrollTop=mainTop;
    if(winY)window.scrollTo(0,winY);
  });
}

function toggleDREMes(groupId){
  if(!window._dreExpandedMes) window._dreExpandedMes={};
  window._dreExpandedMes[groupId]=window._dreExpandedMes[groupId]!==true;
  _saveScroll(renderDRE);
}

function toggleAllDREMes(){
  if(!window._dreExpandedMes) window._dreExpandedMes={};
  const recCats=getRecCats(),despCats=getDespCats();
  const allKeys=[...recCats,...despCats].map(c=>(c.tipo==='R'?'r_':'d_')+(c.slug||slugify(c.nome)));
  const allExpanded=allKeys.length>0&&allKeys.every(k=>window._dreExpandedMes[k]===true);
  allKeys.forEach(k=>{window._dreExpandedMes[k]=!allExpanded;});
  _saveScroll(renderDRE);
}

function toggleDRE(groupId){
  if(!window._dreExpanded) window._dreExpanded={};
  window._dreExpanded[groupId]=window._dreExpanded[groupId]!==true;
  _saveScroll(renderDRE);
}

function toggleAllDRE(){
  if(!window._dreExpanded) window._dreExpanded={};
  const recCats=getRecCats(), despCats=getDespCats();
  const allKeys=[...recCats,...despCats].map(c=>(c.tipo==='R'?'r_':'d_')+(c.slug||slugify(c.nome)));
  const allExpanded=allKeys.length>0&&allKeys.every(k=>window._dreExpanded[k]===true);
  allKeys.forEach(k=>{window._dreExpanded[k]=!allExpanded;});
  _saveScroll(renderDRE);
}

function renderFluxo(c){
  const fluxoView=localStorage.getItem('skala_fluxo_view')||'anual';
  const f=calcFluxo(YEAR);
  const recCats=getRecCats();
  const despCats=getDespCats();
  const tot=k=>f.reduce((s,m)=>s+(m[k]||0),0);
  const thisYear=new Date().getFullYear();
  const curMonthIdx=YEAR===thisYear?new Date().getMonth():-1;
  const proj=showFluxoProj&&fluxoView==='anual'?calcFluxoProj(YEAR):null;
  if(!window._fluxoExpanded)window._fluxoExpanded={};
  window._fluxoDrillCells=[];

  function row(lbl,k,type='normal',groupId=null,parentId=null,neg=false,numSubs=0,drillInfo=null){
    const isTotal=type==='total',isResult=type==='result',isGroup=type==='group',isSub=type==='sub',isTot=type==='tot';
    const bold=isTotal||isResult||isTot;
    const hasSubs=isGroup&&!parentId&&numSubs>0;
    const expanded=groupId?(window._fluxoExpanded[groupId]===true):true;
    let style='';
    if(parentId&&window._fluxoExpanded[parentId]!==true)style='display:none';
    const cells=f.map((m,i)=>{
      const isFuture=!!proj&&i>curMonthIdx&&YEAR>=thisYear;
      const isCurPend=!!proj&&i===curMonthIdx&&(!proj[i]._sources?.[k]||proj[i]._sources[k]==='pendentes_cur');
      const data=(isFuture||isCurPend)?proj[i]:m;
      const v=(neg?-1:1)*(data[k]||0);
      const hlSt=i===curMonthIdx?';background:rgba(19,124,60,.06)':'';
      const projColor=v<0?'var(--proj-out)':'var(--proj-in)';
      if(isFuture||isCurPend){
        const src=proj[i]._sources?.[k]||'';
        const manual=proj[i]._isManual?.[k];
        const tip=manual?'Valor editado manualmente — clique para editar':_projTooltip(src);
        const editable=isGroup&&isFuture;
        if(editable){
          const kTipo=k.startsWith('r_')?'R':'D';
          const kSlug=k.slice(2);
          const comp=`${YEAR}-${String(i+1).padStart(2,'0')}-01`;
          const rawVal=proj[i][k]||0;
          return`<td style="cursor:pointer;font-style:italic;color:${projColor};font-size:11.5px${hlSt}" data-proj="${esc(kSlug)}|${kTipo}|${comp}" data-proj-val="${rawVal}" data-proj-manual="${manual?'1':'0'}" onclick="openProjEdit(this)"${tip?` title="${tip}"`:''}>${v!==0?`${manual?'✏ ':'~'}${fmt(v)}`:'—'}</td>`;
        }
        return`<td style="font-style:italic;color:${projColor};font-size:11.5px${hlSt}"${tip?` title="${tip}"`:''}>${v!==0?`~${fmt(v)}`:'—'}</td>`;
      }
      if(drillInfo&&v!==0){
        const di=window._fluxoDrillCells.length;
        window._fluxoDrillCells.push({cat:drillInfo.cat,sub:drillInfo.sub,tipo:drillInfo.tipo,mes:i});
        return`<td class="${v<0?'neg':v>0?'pos':''}" style="cursor:pointer;font-size:11.5px${hlSt}" onclick="openFluxoDrillByIdx(${di})">${fmt(v)}</td>`;
      }
      return`<td class="${v<0?'neg':v>0?'pos':''}" style="font-size:11.5px${hlSt}">${v!==0?fmt(v):'—'}</td>`;
    }).join('');
    const tv=(neg?-1:1)*(proj
      ?f.reduce((s,m2,i)=>{
        if(i>curMonthIdx&&YEAR>=thisYear)return s+(proj[i][k]||0);
        if(i===curMonthIdx&&(!proj[i]._sources?.[k]||proj[i]._sources[k]==='pendentes_cur'))return s+(proj[i][k]||0);
        return s+(m2[k]||0);
      },0)
      :tot(k));
    let cls='dr';
    if(bold)cls+=' bold';
    if(isResult)cls+=' hl';
    if(isTot)cls+=' tot';
    const indent=isSub?40:isGroup?20:12;
    const tdSt=`padding-left:${indent}px;position:sticky;left:0;z-index:2;background:var(--s1)`;
    const toggleBtn=hasSubs
      ?`<span onclick="toggleFluxo('${groupId}')" style="cursor:pointer;margin-right:6px;font-size:10px;display:inline-block;width:12px">${expanded?'▼':'▶'}</span>`
      :`<span style="display:inline-block;width:18px"></span>`;
    const tvHasProj=!!proj&&curMonthIdx>=0&&curMonthIdx<11;
    const tcSt=`font-weight:${bold?700:400}${tvHasProj?`;font-style:italic;color:${tv<0?'var(--proj-out)':'var(--proj-in)'}`:''}`;
    return`<tr class="${cls}" style="${style}"><td style="${tdSt}">${toggleBtn}${lbl}</td>${cells}<td class="${tv<0?'neg':tv>0?'pos':''} tc" style="${tcSt}">${tv!==0?fmt(tv):'—'}</td></tr>`;
  }
  function groupRows(cat,tipo){
    const neg=tipo==='D';
    const k=(tipo==='R'?'r_':'d_')+(cat.slug||slugify(cat.nome));
    const gid=k;
    const subs=(cat.subs||[]).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    let html=row(cat.nome,k,'group',gid,null,neg,subs.length,{cat:cat.nome,sub:'',tipo});
    subs.forEach(sub=>{
      const sk=(tipo==='R'?'rs_':'ds_')+(sub.slug||slugify(sub.nome));
      html+=row(sub.nome,sk,'sub',sk,gid,neg,0,{cat:cat.nome,sub:sub.nome,tipo});
    });
    return html;
  }
  const sep=lbl=>`<tr class="sep"><td colspan="14" style="position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;
  const subSep=(lbl,color='var(--tx3)')=>`<tr class="sep"><td colspan="14" style="padding-left:28px;font-size:9px;color:${color};position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;

  const recCatsVis=recCats.filter(cat=>(cat.slug||slugify(cat.nome))!==TRANSF_SLUG);
  const despCatsVis=despCats.filter(cat=>(cat.slug||slugify(cat.nome))!==TRANSF_SLUG);
  const hasNaoOp=recCatsVis.some(c=>(c.fluxo||'operacional')==='nao_operacional')||despCatsVis.some(c=>(c.fluxo||'operacional')==='nao_operacional');

  // Per-account saldo calculation (needed for saldo final in both views)
  const allPaidData=cashMovements().filter(l=>l.dataPgto);
  const paidData=allPaidData.filter(l=>getY(l.dataPgto)===YEAR);
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
  const yearStart=`${YEAR}-01-01`;
  const contaSaldoFin={};
  contaSet.forEach(conta=>{
    const ini=parseFloat(CONTAS_DATA.find(c=>c.nome===conta)?.saldo_inicial)||0;
    const preYear=allPaidData.filter(l=>l.dataPgto<yearStart).reduce((s,l)=>{
      if((l.conta||'(Sem conta)')===conta)return s+(l.tipo==='R'?parseMoney(l.valorLiq):-parseMoney(l.valorLiq));
      if((l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')&&l.obs.slice(12)===conta&&!allPaidData.some(cr=>cr.doc===l.doc&&cr.conta===conta&&cr.tipo==='R'))return s+parseMoney(l.valorLiq);
      return s;
    },0);
    let cum=ini+preYear;
    contaSaldoFin[conta]=contaFlows[conta].map(v=>{cum+=v;return cum;});
  });
  const totalSaldoFinVals=Array(12).fill(0);
  contaSet.forEach(conta=>contaSaldoFin[conta].forEach((v,i)=>totalSaldoFinVals[i]+=v));

  // #66 — KPI Cards
  const lastMesData=f.reduce((b,m,i)=>(m.entradasOp>0||m.saidasOp>0)?i:b,-1);
  const kpiEnt=tot('entradasOp'),kpiSai=tot('saidasOp'),kpiRes=tot('resultadoOp');
  const kpiSF=lastMesData>=0?totalSaldoFinVals[lastMesData]:0;
  const kpiResCol=kpiRes>=0?'var(--teal)':'var(--red)';
  const kpiSFCol=kpiSF>=0?'var(--teal)':'var(--red)';
  const fKpi=(lbl,val,sub,col)=>`<div class="kpi" style="align-self:start"><div class="kpi-lbl">${lbl}</div><div class="kpi-val" style="color:${col}">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  const fluxoKpis=`<div class="dre-kpis">
    ${fKpi('Total Entradas',fmtCard(kpiEnt),`${YEAR} · regime de caixa`,'var(--tx)')}
    ${fKpi('Total Saídas',fmtCard(kpiSai),`${YEAR} · regime de caixa`,'var(--tx)')}
    ${fKpi('Resultado Operacional',fmtCard(kpiRes),`${YEAR} · acumulado`,kpiResCol)}
    ${fKpi('Saldo Final',fmtCard(kpiSF),lastMesData>=0?`${MONTHS_FULL[lastMesData]}/${YEAR}`:'—',kpiSFCol)}
  </div>`;

  const toolbar=`<div class="tbl-hdr" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="sec-ttl">Fluxo de Caixa — Regime de Caixa <span class="yr-pill">${YEAR}</span></div><div style="display:flex;gap:6px;align-items:center"><div class="dre-seg"><button class="dre-seg-btn${fluxoView==='anual'?' on':''}" onclick="setFluxoView('anual')">Anual</button><button class="dre-seg-btn${fluxoView==='mensal'?' on':''}" onclick="setFluxoView('mensal')">Mensal</button></div>${fluxoView==='anual'?`<button class="btn btn-ghost" style="font-size:12px" onclick="exportFluxoExcel()">${appIcon('download')}Exportar Excel</button><button class="btn btn-ghost" style="font-size:12px" onclick="toggleAllFluxo()">⊞ Expandir/Recolher tudo</button><button class="btn btn-ghost" style="font-size:12px;${showFluxoProj?'border-color:#58a6ff;color:#58a6ff':''}" onclick="toggleFluxoProj()">${appIcon('chart')} ${showFluxoProj?'Ocultar projetado':'Fluxo Projetado'}</button>`:`<button class="btn btn-ghost" style="font-size:12px" onclick="toggleAllFluxoMes()">⊞ Expandir/Recolher tudo</button>`}</div></div>`;

  if(fluxoView==='mensal'){
    const fluxoM=f[fluxoViewMes];
    if(!window._fluxoExpandedMes)window._fluxoExpandedMes={};

    function rowFluxoMes(lbl,k,type='normal',groupId=null,parentId=null,neg=false,numSubs=0,drillInfo=null){
      const isSep=type==='sep',isSubSep=type==='subsep';
      const isGroup=type==='group',isSub=type==='sub';
      if(isSep) return`<tr class="sep"><td colspan="2" style="position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;
      if(isSubSep) return`<tr class="sep"><td colspan="2" style="padding-left:28px;font-size:9px;color:${k||'var(--tx3)'};position:sticky;left:0;z-index:2;background:#eaf2e7">${lbl}</td></tr>`;
      const hasSubs=groupId&&!parentId&&numSubs>0;
      const expanded=groupId?(window._fluxoExpandedMes[groupId]===true):true;
      const v=(neg?-1:1)*(fluxoM[k]||0);
      const col=v<0?'var(--red)':(v>0?'var(--teal)':'var(--tx3)');
      let style='';
      if(parentId&&window._fluxoExpandedMes[parentId]!==true)style='display:none';
      let cls='dr';
      if(type==='total'||type==='result')cls+=' bold';
      if(type==='result')cls+=' hl';
      if(type==='tot'||type==='tot-bal')cls+=' tot';
      const indent=isSub?40:isGroup?20:12;
      const tdStyle=`padding-left:${indent}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
      const toggleBtn=hasSubs?`<span onclick="toggleFluxoMes('${groupId}')" style="cursor:pointer;margin-right:6px;font-size:10px;display:inline-block;width:12px;flex-shrink:0">${expanded?'▼':'▶'}</span>`:`<span style="display:inline-block;width:18px;flex-shrink:0"></span>`;
      let valTd;
      if(drillInfo&&v!==0){
        const di=window._fluxoDrillCells.length;
        window._fluxoDrillCells.push({cat:drillInfo.cat,sub:drillInfo.sub,tipo:drillInfo.tipo,mes:fluxoViewMes});
        valTd=`<td style="text-align:right;color:${col};font-size:12px;white-space:nowrap;padding-right:10px;cursor:pointer;text-decoration:underline dotted" onclick="openFluxoDrillByIdx(${di})">${fmt(v)}</td>`;
      } else {
        valTd=`<td style="text-align:right;color:${col};font-size:12px;white-space:nowrap;padding-right:10px">${v!==0?fmt(v):'—'}</td>`;
      }
      return`<tr class="${cls}" style="${style}">
        <td style="${tdStyle}">${toggleBtn}${lbl}</td>
        ${valTd}
      </tr>`;
    }

    function groupRowsFluxoMes(cat,tipo){
      const neg=tipo==='D';
      const k=(tipo==='R'?'r_':'d_')+(cat.slug||slugify(cat.nome));
      const subs=(cat.subs||[]).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      let html=rowFluxoMes(cat.nome,k,'group',k,null,neg,subs.length,{cat:cat.nome,sub:'',tipo});
      subs.forEach(sub=>{
        const sk=(tipo==='R'?'rs_':'ds_')+(sub.slug||slugify(sub.nome));
        html+=rowFluxoMes(sub.nome,sk,'sub',sk,k,neg,0,{cat:cat.nome,sub:sub.nome,tipo});
      });
      return html;
    }

    const entradasOpRowsMes=recCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>groupRowsFluxoMes(cat,'R')).join('');
    const saidasOpRowsMes=despCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>groupRowsFluxoMes(cat,'D')).join('');
    const entradasNaoOpRowsMes=recCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>groupRowsFluxoMes(cat,'R')).join('');
    const saidasNaoOpRowsMes=despCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>groupRowsFluxoMes(cat,'D')).join('');

    const contaRowsMes=contaSet.map(conta=>{
      const v=contaFlows[conta][fluxoViewMes];
      const col=v<0?'var(--red)':v>0?'var(--teal)':'var(--tx3)';
      return`<tr class="dr"><td style="padding-left:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="display:inline-block;width:18px;flex-shrink:0"></span>${esc(conta)}</td><td style="text-align:right;color:${col};font-size:12px;white-space:nowrap;padding-right:10px">${v!==0?fmt(v):'—'}</td></tr>`;
    }).join('');
    const contaSaldoFinRowsMes=contaSet.map(conta=>{
      const v=contaSaldoFin[conta][fluxoViewMes];
      const col=v<0?'var(--red)':v>0?'var(--teal)':'var(--tx3)';
      return`<tr class="dr"><td style="padding-left:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="display:inline-block;width:18px;flex-shrink:0"></span>${esc(conta)}</td><td style="text-align:right;color:${col};font-size:12px;white-space:nowrap;padding-right:10px">${v!==0?fmt(v):'—'}</td></tr>`;
    }).join('');
    const sfv=totalSaldoFinVals[fluxoViewMes];
    const sfCol=sfv<0?'var(--red)':sfv>0?'var(--teal)':'var(--tx3)';
    const totalSaldoFinRowMes=`<tr class="dr tot"><td style="padding-left:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="display:inline-block;width:18px;flex-shrink:0"></span>SALDO FINAL TOTAL</td><td style="text-align:right;color:${sfCol};font-size:12px;white-space:nowrap;padding-right:10px;font-weight:700">${sfv!==0?fmt(sfv):'—'}</td></tr>`;

    c.innerHTML=`<div class="tbl-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 116px);overflow:visible">${toolbar}
    <div style="flex:1;overflow:hidden;padding:0 20px 16px;display:flex;gap:20px;min-height:0">
      <div style="flex:0 0 52%;display:flex;flex-direction:column;min-height:0">
        <div class="dre-mes-nav">
          <button onclick="navFluxoMes(-1)" ${fluxoViewMes===0?'disabled':''}>‹</button>
          <span>${MONTHS_FULL[fluxoViewMes]} ${YEAR}</span>
          <button onclick="navFluxoMes(1)" ${fluxoViewMes===11?'disabled':''}>›</button>
        </div>
        <div class="tbl-scroll" style="flex:1;overflow-y:auto">
          <table class="fin-tbl" style="width:100%;table-layout:fixed;min-width:0">
            <colgroup><col><col style="width:140px"></colgroup>
            <thead><tr>
              <th style="text-align:left;padding-left:32px">Descrição</th>
              <th style="text-align:right;padding-right:10px">Valor</th>
            </tr></thead>
            <tbody>
              ${rowFluxoMes('FLUXO OPERACIONAL','','sep')}
              ${rowFluxoMes('ENTRADAS','','subsep')}
              ${entradasOpRowsMes}
              ${rowFluxoMes('TOTAL ENTRADAS OPERACIONAIS','entradasOp','result')}
              ${rowFluxoMes('SAÍDAS','','subsep')}
              ${saidasOpRowsMes}
              ${rowFluxoMes('TOTAL SAÍDAS OPERACIONAIS','saidasOp','result',null,null,true)}
              ${rowFluxoMes('(=) RESULTADO OPERACIONAL','resultadoOp','tot')}
              ${hasNaoOp?`
                ${rowFluxoMes('NÃO-OPERACIONAL','','sep')}
                ${entradasNaoOpRowsMes}
                ${saidasNaoOpRowsMes}
                ${rowFluxoMes('(=) RESULTADO NÃO-OPERACIONAL','resultadoNaoOp','tot')}
              `:''}
              ${rowFluxoMes('SALDOS','','sep')}
              ${rowFluxoMes('VARIAÇÃO NO PERÍODO','','subsep')}
              ${contaRowsMes}
              ${rowFluxoMes('VARIAÇÃO TOTAL DE CAIXA','saldoOp','tot')}
              ${rowFluxoMes('SALDO FINAL POR CONTA','var(--blue)','subsep')}
              ${contaSaldoFinRowsMes}
              ${totalSaldoFinRowMes}
            </tbody>
          </table>
        </div>
      </div>
      <div id="fluxo-chart-mensal" style="flex:1;min-width:0;background:var(--s1);border:1px solid var(--bd);border-radius:12px;align-self:flex-start;margin-top:0">
        <div style="padding:16px 20px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:3px">Performance</div>
            <div style="font-size:15px;font-weight:700;color:var(--tx);line-height:1.2">Entradas, Saídas e Resultado</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:2px">Regime de caixa · últimos 6 meses</div>
          </div>
        </div>
        <div id="fluxo-mes-plot" style="position:relative;padding:0 12px 4px"></div>
        <div style="display:flex;gap:20px;padding:12px 20px 16px;border-top:1px solid var(--bd)">
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#1A9C5A,#007A48);display:inline-block;flex-shrink:0"></span>Entradas</span>
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#F8D43D,#E0B80D);display:inline-block;flex-shrink:0"></span>Saídas</span>
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx2)"><span style="position:relative;width:16px;height:2.5px;background:#00532c;display:inline-block;flex-shrink:0"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:7px;height:7px;border-radius:50%;background:#fff;border:2px solid #00532c;display:block"></span></span>Resultado</span>
        </div>
      </div>
    </div></div>`;
    const oldDrillMes=document.getElementById('fluxo-drill');if(oldDrillMes)oldDrillMes.remove();
    if(fluxoDrillDown){
      const d=fluxoDrillDown;
      const items=cashMovements().filter(l=>{
        if((l.doc||'').startsWith('TRANSF#'))return false;
        if(l.tipo!==d.tipo||l.cat!==d.cat)return false;
        if(d.sub&&l.sub!==d.sub)return false;
        if(!l.dataPgto||getY(l.dataPgto)!==YEAR||getM(l.dataPgto)!==d.mes)return false;
        return true;
      }).sort((a,b)=>(a.dataPgto||'').localeCompare(b.dataPgto||''));
      const total=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
      const catTitle=d.sub?`${esc(d.cat)} › ${esc(d.sub)}`:esc(d.cat);
      const drillRows=items.map(l=>`<tr style="cursor:pointer;border-bottom:1px solid var(--bd2)" onclick="openEdit('${l.lancamentoId||l.id}')">
        <td style="font-size:11px;padding:7px 8px;white-space:nowrap">${dateBR(l.dataPgto)}</td>
        <td style="font-size:11px;padding:7px 8px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${esc(l.desc||l.sub||l.cat)}</td>
        <td style="font-size:11px;padding:7px 8px;color:var(--tx2);white-space:nowrap">${esc(l.conta||'—')}</td>
        <td style="font-size:11px;padding:7px 8px;text-align:right;white-space:nowrap;color:${l.tipo==='R'?'var(--teal)':'var(--red)'};font-weight:600">${fmt(l.valorLiq)}</td>
      </tr>`).join('');
      const panel=document.createElement('div');
      panel.id='fluxo-drill';
      panel.style.cssText='position:fixed;right:0;top:0;height:100vh;width:480px;background:var(--s1);border-left:1px solid var(--bd);box-shadow:-4px 0 24px rgba(0,0,0,.14);z-index:200;display:flex;flex-direction:column;overflow:hidden';
      panel.innerHTML=`
        <div style="padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--tx)">${catTitle}</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:3px">${MONTHS_FULL[d.mes]} ${YEAR} · ${items.length} lançamento${items.length!==1?'s':''}</div>
          </div>
          <button onclick="closeFluxoDrill()" style="background:none;border:none;cursor:pointer;color:var(--tx2);font-size:22px;line-height:1;padding:0 4px;flex-shrink:0;margin-top:-2px" title="Fechar">×</button>
        </div>
        ${items.length?`
        <div style="flex:1;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:2px solid var(--bd)">
              <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Data</th>
              <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Descrição</th>
              <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Conta</th>
              <th style="font-size:10px;font-weight:700;text-align:right;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Valor</th>
            </tr></thead>
            <tbody>${drillRows}</tbody>
          </table>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--s2)">
          <span style="font-size:12px;color:var(--tx2);font-weight:600">Total</span>
          <strong style="font-size:14px;color:${d.tipo==='R'?'var(--teal)':'var(--red)'}">${fmt(total)}</strong>
        </div>`
        :`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:13px">Nenhum lançamento encontrado</div>`}
      `;
      document.body.appendChild(panel);
    }
    setTimeout(()=>drawFluxoMesChart(),0);
    return;
  }

  // Anual view
  const entradasOpRows=recCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>groupRows(cat,'R')).join('');
  const saidasOpRows=despCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional').map(cat=>groupRows(cat,'D')).join('');
  const entradasNaoOpRows=recCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>groupRows(cat,'R')).join('');
  const saidasNaoOpRows=despCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional').map(cat=>groupRows(cat,'D')).join('');

  const contaRows=contaSet.map(conta=>{
    const vals=contaFlows[conta];
    const cells=vals.map((v,i)=>`<td class="${v<0?'neg':'pos'}"${i===curMonthIdx?' style="background:rgba(19,124,60,.06)"':''}>${fmt(v)}</td>`).join('');
    const tv=vals.reduce((s,v)=>s+v,0);
    return`<tr class="dr"><td style="padding-left:28px;position:sticky;left:0;z-index:2;background:var(--s1)">${esc(conta)}</td>${cells}<td class="${tv<0?'neg':'pos'} tc">${fmt(tv)}</td></tr>`;
  }).join('');
  const mkBalRow=(lbl,vals,bold,indent,cls='',projFromIdx=-1)=>{
    const cells=vals.map((v,i)=>{
      const isFut=projFromIdx>=0&&i>projFromIdx;
      const bg=i===curMonthIdx?'background:rgba(19,124,60,.06)':'';
      if(isFut)return`<td style="font-style:italic;color:${v<0?'var(--proj-out)':'var(--proj-in)'}${bg?';'+bg:''}">${v!==0?`~${fmt(v)}`:'—'}</td>`;
      return`<td class="${v<0?'neg':'pos'}"${bg?` style="${bg}"`:''}>${fmt(v)}</td>`;
    }).join('');
    const tv=vals[vals.length-1];
    const tvFut=projFromIdx>=0&&11>projFromIdx;
    const tcSt=`font-weight:${bold?700:400}${tvFut?`;font-style:italic;color:${tv<0?'var(--proj-out)':'var(--proj-in)'}`:''}`;
    return`<tr class="dr${bold?' bold':''} ${cls}"><td style="padding-left:${indent?28:12}px;position:sticky;left:0;z-index:2;background:var(--s1)">${lbl}</td>${cells}<td class="${tv<0?'neg':tv>0?'pos':''} tc" style="${tcSt}">${tv!==0?fmt(tv):'—'}</td></tr>`;
  };
  const contaSaldoFinRows=contaSet.map(conta=>mkBalRow(esc(conta),contaSaldoFin[conta],false,true)).join('');

  // saldo final projetado: saldo real do mês atual + saldoOp projetado acumulado
  const projTotalSaldoFin=proj&&curMonthIdx>=0?Array(12).fill(0).map((_,i)=>{
    if(i<=curMonthIdx)return totalSaldoFinVals[i];
    let s=totalSaldoFinVals[curMonthIdx];
    for(let j=curMonthIdx+1;j<=i;j++)s+=(proj[j]?.saldoOp||0);
    return s;
  }):null;

  const totalSaldoFinRow=mkBalRow('SALDO FINAL TOTAL',projTotalSaldoFin||totalSaldoFinVals,true,false,'tot-bal',projTotalSaldoFin?curMonthIdx:-1);
  const projSection='';

  const oldDrill=document.getElementById('fluxo-drill');if(oldDrill)oldDrill.remove();

  c.innerHTML=`<div class="tbl-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 116px)">${toolbar}
    ${fluxoKpis}
    <div class="tbl-scroll" style="flex:1;overflow:auto"><table class="fin-tbl resizable">${renderFinColgroup()}<thead>${renderFinHead(curMonthIdx,true)}</thead><tbody>
    ${sep('FLUXO OPERACIONAL')}
    ${subSep('ENTRADAS')}
    ${entradasOpRows}
    ${row('TOTAL ENTRADAS OPERACIONAIS','entradasOp','result')}
    ${subSep('SAÍDAS')}
    ${saidasOpRows}
    ${row('TOTAL SAÍDAS OPERACIONAIS','saidasOp','result',null,null,true)}
    ${row('(=) RESULTADO OPERACIONAL','resultadoOp','tot')}
    ${hasNaoOp?`
    ${sep('NÃO-OPERACIONAL')}
    ${entradasNaoOpRows}
    ${saidasNaoOpRows}
    ${row('(=) RESULTADO NÃO-OPERACIONAL','resultadoNaoOp','tot')}
    `:''}
    ${sep('SALDOS')}
    ${subSep('VARIAÇÃO NO PERÍODO')}
    ${contaRows}
    ${row('VARIAÇÃO TOTAL DE CAIXA','saldoOp','tot')}
    ${subSep('SALDO FINAL POR CONTA','var(--blue)')}
    ${contaSaldoFinRows}
    ${totalSaldoFinRow}
    ${projSection}
    </tbody></table></div></div>`;

  // #67 — Drill-down panel
  if(fluxoDrillDown){
    const d=fluxoDrillDown;
    const items=cashMovements().filter(l=>{
      if((l.doc||'').startsWith('TRANSF#'))return false;
      if(l.tipo!==d.tipo||l.cat!==d.cat)return false;
      if(d.sub&&l.sub!==d.sub)return false;
      if(!l.dataPgto||getY(l.dataPgto)!==YEAR||getM(l.dataPgto)!==d.mes)return false;
      return true;
    }).sort((a,b)=>(a.dataPgto||'').localeCompare(b.dataPgto||''));
    const total=items.reduce((s,l)=>s+parseMoney(l.valorLiq),0);
    const catTitle=d.sub?`${esc(d.cat)} › ${esc(d.sub)}`:esc(d.cat);
    const drillRows=items.map(l=>`<tr style="cursor:pointer;border-bottom:1px solid var(--bd2)" onclick="openEdit('${l.lancamentoId||l.id}')">
      <td style="font-size:11px;padding:7px 8px;white-space:nowrap">${dateBR(l.dataPgto)}</td>
      <td style="font-size:11px;padding:7px 8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${esc(l.desc||l.sub||l.cat)}</td>
      <td style="font-size:11px;padding:7px 8px;color:var(--tx2);white-space:nowrap">${esc(l.conta||'—')}</td>
      <td style="font-size:11px;padding:7px 8px;text-align:right;white-space:nowrap;color:${l.tipo==='R'?'var(--teal)':'var(--red)'};font-weight:600">${fmt(l.valorLiq)}</td>
    </tr>`).join('');
    const panel=document.createElement('div');
    panel.id='fluxo-drill';
    panel.style.cssText='position:fixed;right:0;top:0;height:100vh;width:480px;background:var(--s1);border-left:1px solid var(--bd);box-shadow:-4px 0 24px rgba(0,0,0,.14);z-index:200;display:flex;flex-direction:column;overflow:hidden';
    panel.innerHTML=`
      <div style="padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--tx)">${catTitle}</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:3px">${MONTHS_FULL[d.mes]} ${YEAR} · ${items.length} lançamento${items.length!==1?'s':''}</div>
        </div>
        <button onclick="closeFluxoDrill()" style="background:none;border:none;cursor:pointer;color:var(--tx2);font-size:22px;line-height:1;padding:0 4px;flex-shrink:0;margin-top:-2px" title="Fechar">×</button>
      </div>
      ${items.length?`
      <div style="flex:1;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid var(--bd)">
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Data</th>
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Descrição</th>
            <th style="font-size:10px;font-weight:700;text-align:left;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Conta</th>
            <th style="font-size:10px;font-weight:700;text-align:right;padding:7px 8px;color:var(--tx2);letter-spacing:.06em;text-transform:uppercase">Valor</th>
          </tr></thead>
          <tbody>${drillRows}</tbody>
        </table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--s2)">
        <span style="font-size:12px;color:var(--tx2);font-weight:600">Total</span>
        <strong style="font-size:14px;color:${d.tipo==='R'?'var(--teal)':'var(--red)'}">${fmt(total)}</strong>
      </div>`
      :`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:13px">Nenhum lançamento encontrado</div>`}
    `;
    document.body.appendChild(panel);
  }
}

function toggleFluxo(groupId){
  if(!window._fluxoExpanded)window._fluxoExpanded={};
  window._fluxoExpanded[groupId]=window._fluxoExpanded[groupId]!==true;
  _saveScroll(renderFluxo);
}
function toggleAllFluxo(){
  if(!window._fluxoExpanded)window._fluxoExpanded={};
  const recCats=getRecCats(),despCats=getDespCats();
  const allKeys=[...recCats,...despCats].map(c=>(c.tipo==='R'?'r_':'d_')+(c.slug||slugify(c.nome)));
  const allExpanded=allKeys.length>0&&allKeys.every(k=>window._fluxoExpanded[k]===true);
  allKeys.forEach(k=>{window._fluxoExpanded[k]=!allExpanded;});
  _saveScroll(renderFluxo);
}

function toggleFluxoMes(groupId){
  if(!window._fluxoExpandedMes)window._fluxoExpandedMes={};
  window._fluxoExpandedMes[groupId]=window._fluxoExpandedMes[groupId]!==true;
  _saveScroll(renderFluxo);
}

function toggleAllFluxoMes(){
  if(!window._fluxoExpandedMes)window._fluxoExpandedMes={};
  const recCats=getRecCats(),despCats=getDespCats();
  const allKeys=[...recCats,...despCats].map(c=>(c.tipo==='R'?'r_':'d_')+(c.slug||slugify(c.nome)));
  const allExpanded=allKeys.length>0&&allKeys.every(k=>window._fluxoExpandedMes[k]===true);
  allKeys.forEach(k=>{window._fluxoExpandedMes[k]=!allExpanded;});
  _saveScroll(renderFluxo);
}

function openFluxoDrillByIdx(idx){
  const d=(window._fluxoDrillCells||[])[idx];
  if(!d)return;
  fluxoDrillDown={cat:d.cat,sub:d.sub,tipo:d.tipo,mes:d.mes};
  renderFluxo(document.getElementById('content'));
}

function closeFluxoDrill(){
  fluxoDrillDown=null;
  const panel=document.getElementById('fluxo-drill');if(panel)panel.remove();
  renderFluxo(document.getElementById('content'));
}

function openProjEdit(td){
  const attr=td.dataset.proj;if(!attr)return;
  const[slug,tipo,comp]=attr.split('|');
  const cur=parseFloat(td.dataset.projVal)||0;
  const manual=td.dataset.projManual==='1';
  const orig=td.innerHTML;
  const input=document.createElement('input');
  input.type='number';input.min='0';input.step='0.01';
  input.value=cur?cur.toFixed(2):'';
  input.placeholder='0,00';
  input.style.cssText='width:80px;font-size:11.5px;padding:2px 4px;border:1px solid var(--blue);border-radius:3px;color:var(--blue);background:var(--s1);font-style:italic;text-align:right;outline:none';
  td.innerHTML='';td.onclick=null;
  td.appendChild(input);
  if(manual){
    const btn=document.createElement('button');
    btn.className='proj-reset-btn';btn.title='Remover override manual';btn.textContent='↺';
    btn.onclick=e=>{e.stopPropagation();resetProjOverride(slug,tipo,comp);};
    td.appendChild(btn);
  }
  function doSave(){
    const raw=input.value.replace(',','.');
    const val=parseFloat(raw);
    if(isNaN(val)||val<0){doCancel();return;}
    _saveProjOverride(slug,tipo,comp,val);
  }
  function doCancel(){td.innerHTML=orig;td.onclick=()=>openProjEdit(td);}
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();doSave();}
    if(e.key==='Escape'){e.preventDefault();doCancel();}
  });
  input.addEventListener('blur',()=>setTimeout(()=>{
    if(document.activeElement&&document.activeElement.closest('td')===td)return;
    doSave();
  },150));
  input.focus();input.select();
}

async function _saveProjOverride(slug,tipo,comp,val){
  try{
    if(val===0){
      await dbDeleteProjecao(slug,tipo,comp);
    }else{
      await dbUpsertProjecao({cat_slug:slug,tipo,comp,valor:val});
    }
    clearFinanceCalcCache();
    _reRenderFluxo();
  }catch(e){toast('Erro ao salvar projeção','err');console.error(e);}
}

async function resetProjOverride(slug,tipo,comp){
  if(!confirm('Remover override manual e voltar à projeção automática?'))return;
  try{
    await dbDeleteProjecao(slug,tipo,comp);
    clearFinanceCalcCache();
    _reRenderFluxo();
  }catch(e){toast('Erro ao remover override','err');console.error(e);}
}

function _reRenderFluxo(){
  const wrap=document.querySelector('.tbl-scroll');
  const scrollLeft=wrap?wrap.scrollLeft:0;
  renderKeepScroll();
  requestAnimationFrame(()=>{const w=document.querySelector('.tbl-scroll');if(w)w.scrollLeft=scrollLeft;});
}

function openDREDrillByIdx(idx){
  const d=(window._dreDrillCells||[])[idx];
  if(!d)return;
  dreDrillDown={cat:d.cat,sub:d.sub,tipo:d.tipo,mes:d.mes};
  renderDRE(document.getElementById('content'));
}

function closeDREDrill(){
  dreDrillDown=null;
  const panel=document.getElementById('dre-drill');if(panel)panel.remove();
  renderDRE(document.getElementById('content'));
}

