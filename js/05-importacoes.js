function _getFilteredLancamentos(){
  let filtered=DATA.filter(l=>{
    if(currentTipoFilter){if(l.tipo!==currentTipoFilter||isTransfer(l))return false;}
    else if(filterTipos.size){const isT=isTransfer(l);if(!filterTipos.has(isT?'T':l.tipo))return false;}
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
  return sortData(filtered,sortLan.col,sortLan.dir);
}

let _xlsxLoadPromise=null;
function ensureXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(_xlsxLoadPromise)return _xlsxLoadPromise;
  _xlsxLoadPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Biblioteca XLSX não ficou disponível.'));
    s.onerror=()=>reject(new Error('Não foi possível carregar a biblioteca XLSX.'));
    document.head.appendChild(s);
  });
  return _xlsxLoadPromise;
}

async function exportLancamentosExcel(){
  await ensureXLSX();
  const rows=_getFilteredLancamentos();
  const header=['Nº','Tipo','Vencimento','Data Pgto','Competência','Categoria','Subcategoria','Descrição','Conta','Valor Bruto','Dedução','Valor Líquido','Status'];
  const data=[header,...rows.map(l=>{
    const isTransf=isTransfer(l);
    return[l.seq||'',isTransf?'Transferência':l.tipo==='R'?'Receita':'Despesa',effectiveVenc(l)?dateBR(effectiveVenc(l)):'',l.dataPgto?dateBR(l.dataPgto):'',compDisplay(l.dataComp)||'',l.cat||'',l.sub||'',l.desc||'',l.conta||'',parseMoney(l.valorBruto),parseMoney(l.ded)||0,titleAmount(l),computedStatus(l)||''];
  })];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Lançamentos');
  XLSX.writeFile(wb,`Lancamentos_${YEAR}.xlsx`);
  toast('Excel exportado!','ok');
}

async function exportExtratoExcel(){
  await ensureXLSX();
  const{rows,saldoAntes}=calcExtrato();
  const header=['Data','Competência','Tipo','Categoria','Subcategoria','Descrição','Valor','Saldo'];
  const data=[header,['—','—','Saldo Anterior','Abertura','','Saldo anterior ao período','',saldoAntes],...rows.map(r=>{
    const isTransf=isTransfer(r);
    return[(r.dataExtrato||r.dataPgto)?dateBR(r.dataExtrato||r.dataPgto):'',compDisplay(r.dataComp)||'',isTransf?'Transferência':r.tipo==='R'?'Receita':'Despesa',r.cat||'',r.sub||'',r.desc||'',(r.tipo==='R'?1:-1)*parseMoney(r.valorLiq),r.saldo];
  })];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Extrato');
  const conta=filterExtratoConta?`_${filterExtratoConta.replace(/[^a-zA-Z0-9]/g,'_')}`:'';
  XLSX.writeFile(wb,`Extrato${conta}_${YEAR}.xlsx`);
  toast('Excel exportado!','ok');
}

async function exportDREExcel(){
  await ensureXLSX();
  const dre=calcDRE(YEAR);
  const recCats=getRecCats().filter(c=>!isExclDRE(c));
  const despCats=getDespCats().filter(c=>!isExclDRE(c));
  const tot=k=>dre.reduce((s,m)=>s+(m[k]||0),0);

  const recOpCats   =recCats.filter(c=>!isNaoOpDRE(c));
  const recNaoOpCats=recCats.filter(c=>isNaoOpDRE(c));
  const despOpBase  =despCats.filter(c=>!isNaoOpDRE(c));
  const despNaoOpCats=despCats.filter(c=>isNaoOpDRE(c));
  const impostoCat  =despOpBase.find(c=>['impostos_e_taxas','impostos'].includes(dreCatSlug(c)));
  const custosOpCat =despOpBase.find(c=>dreCatSlug(c)==='custos_operacionais');
  const pessoalCats =despOpBase.filter(c=>DRE_PESSOAL_SLUGS.includes(dreCatSlug(c)));
  const EXCL_SLUGS  =[
    impostoCat  ?dreCatSlug(impostoCat) :null,
    custosOpCat ?dreCatSlug(custosOpCat):null,
    ...pessoalCats.map(dreCatSlug)
  ].filter(Boolean);
  const despOpCats  =despOpBase.filter(c=>!EXCL_SLUGS.includes(dreCatSlug(c)));

  // ── 1. Monta lista de "items" (cada um vira uma linha do Excel) ─────
  const items=[];
  const pushCatGroup=(cat,tipo,neg)=>{
    const k=tipo==='R'?'r_'+dreCatSlug(cat):'d_'+dreCatSlug(cat);
    items.push({type:'cat',lbl:cat.nome,key:k,neg});
    (cat.subs||[]).sort((a,b)=>a.ordem-b.ordem).forEach(sub=>{
      const sk=tipo==='R'?'rs_'+(sub.slug||slugify(sub.nome)):'ds_'+(sub.slug||slugify(sub.nome));
      items.push({type:'sub',lbl:sub.nome,key:sk,neg});
    });
  };

  items.push({type:'sep',lbl:'RECEITAS OPERACIONAIS'});
  recOpCats.forEach(cat=>pushCatGroup(cat,'R',false));
  items.push({type:'result',lbl:'(=) RECEITA OPERACIONAL BRUTA',key:'recOpBruta',neg:false});

  items.push({type:'sep',lbl:'DEDUÇÕES'});
  if(impostoCat) pushCatGroup(impostoCat,'D',true);
  if(custosOpCat) pushCatGroup(custosOpCat,'D',true);
  items.push({type:'result',lbl:'(=) RECEITA OPERACIONAL LÍQUIDA',key:'recOpLiq',neg:false});

  if(pessoalCats.length){
    items.push({type:'sep',lbl:'DESPESAS COM PESSOAL'});
    pessoalCats.forEach(cat=>pushCatGroup(cat,'D',true));
    items.push({type:'total',lbl:'(=) Total Pessoal',key:'cusPessoal',neg:true});
  }
  items.push({type:'result',lbl:'(=) LUCRO BRUTO',key:'lucOpBruto',neg:false});
  items.push({type:'pct',lbl:'(%) Margem Bruta',numKey:'lucOpBruto',denKey:'recOpBruta'});

  if(despOpCats.length){
    items.push({type:'sep',lbl:'DESPESAS OPERACIONAIS'});
    despOpCats.forEach(cat=>pushCatGroup(cat,'D',true));
    items.push({type:'total',lbl:'(=) Total Despesas Operacionais',key:'despOp',neg:true});
  }
  items.push({type:'result',lbl:'(=) RESULTADO OPERACIONAL',key:'resOp',neg:false});
  items.push({type:'pct',lbl:'(%) Margem Operacional',numKey:'resOp',denKey:'recOpLiq'});

  if(recNaoOpCats.length){
    items.push({type:'sep',lbl:'RECEITAS NÃO OPERACIONAIS'});
    recNaoOpCats.forEach(cat=>pushCatGroup(cat,'R',false));
    items.push({type:'total',lbl:'(=) RECEITAS NÃO OPERACIONAIS',key:'outrasRec',neg:false});
  }
  if(despNaoOpCats.length){
    items.push({type:'sep',lbl:'DESPESAS NÃO OPERACIONAIS'});
    despNaoOpCats.forEach(cat=>pushCatGroup(cat,'D',true));
    items.push({type:'total',lbl:'(=) DESPESAS NÃO OPERACIONAIS',key:'despNaoOp',neg:true});
  }

  items.push({type:'blank'});
  items.push({type:'lucro',lbl:'RESULTADO LÍQUIDO',key:'ll',neg:false});
  items.push({type:'pct',lbl:'(%) Margem Líquida',numKey:'ll',denKey:'recOpLiq'});

  // ── 2. Materializa em AoA ───────────────────────────────────────────
  const NCOLS=2+MONTHS.length; // Descrição + 12 meses + Total
  const aoa=[
    ['DRE — Regime de Competência '+YEAR],
    [],
    ['Descrição',...MONTHS,'Total']
  ];
  const itemRow=[]; // índice do item → índice da linha no sheet
  items.forEach(it=>{
    let row;
    if(it.type==='sep') row=[it.lbl];
    else if(it.type==='blank') row=[];
    else if(it.type==='pct'){
      const cells=dre.map(m=>{
        const n=m[it.numKey]||0,d=m[it.denKey]||0;
        return d!==0?n/d:null;
      });
      const tN=tot(it.numKey),tD=tot(it.denKey);
      const totPct=tD!==0?tN/tD:null;
      row=[it.lbl,...cells.map(v=>v===null?'—':v),totPct===null?'—':totPct];
    } else {
      const vals=dre.map(m=>(it.neg?-1:1)*(m[it.key]||0));
      const tv=vals.reduce((s,v)=>s+v,0);
      row=[it.lbl,...vals,tv];
    }
    itemRow.push(aoa.length);
    aoa.push(row);
  });

  const ws=XLSX.utils.aoa_to_sheet(aoa);

  // ── 3. Larguras, merges, freeze ─────────────────────────────────────
  ws['!cols']=[{wch:44},...MONTHS.map(()=>({wch:13})),{wch:14}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:NCOLS-1}}]; // título
  ws['!views']=[{state:'frozen',xSplit:1,ySplit:3}];
  ws['!rows']=[];
  ws['!rows'][0]={hpt:24};
  ws['!rows'][2]={hpt:20};
  ws['!outline']={above:true,summaryBelow:false}; // resumo (cat) acima do detalhe (subs)

  // ── 4. Helper de estilos ────────────────────────────────────────────
  const NUM_FMT='#,##0.00;[Red](#,##0.00);"—"';
  const PCT_FMT='0.0%;[Red]-0.0%;"—"';
  const BORDER_THIN={top:{style:'thin',color:{rgb:'D8E0D6'}},bottom:{style:'thin',color:{rgb:'D8E0D6'}},left:{style:'thin',color:{rgb:'D8E0D6'}},right:{style:'thin',color:{rgb:'D8E0D6'}}};
  const setStyle=(r,c,style,numFmt)=>{
    const addr=XLSX.utils.encode_cell({r,c});
    if(!ws[addr]) ws[addr]={t:'s',v:''};
    ws[addr].s=Object.assign({},ws[addr].s,style);
    if(numFmt) ws[addr].z=numFmt;
  };

  // Título
  setStyle(0,0,{font:{bold:true,sz:15,color:{rgb:'0B5A30'}},alignment:{horizontal:'left',vertical:'center'}});
  // Header
  for(let c=0;c<NCOLS;c++){
    setStyle(2,c,{
      font:{bold:true,color:{rgb:'FFFFFF'},sz:11},
      fill:{patternType:'solid',fgColor:{rgb:'137C3C'}},
      alignment:{horizontal:c===0?'left':'right',vertical:'center'},
      border:BORDER_THIN
    });
  }

  // ── 5. Estilos por item + outline ───────────────────────────────────
  items.forEach((it,i)=>{
    const r=itemRow[i];
    if(it.type==='blank') return;

    if(it.type==='sep'){
      ws['!merges'].push({s:{r,c:0},e:{r,c:NCOLS-1}});
      setStyle(r,0,{
        font:{bold:true,sz:11,color:{rgb:'0B5A30'}},
        fill:{patternType:'solid',fgColor:{rgb:'EAF2E7'}},
        alignment:{horizontal:'left',vertical:'center'},
        border:BORDER_THIN
      });
      ws['!rows'][r]={hpt:18};
      return;
    }

    let labelStyle, valueStyle, numFmt=NUM_FMT;

    if(it.type==='lucro'){
      labelStyle={font:{bold:true,sz:12,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'137C3C'}},alignment:{horizontal:'left',vertical:'center'},border:BORDER_THIN};
      valueStyle={font:{bold:true,sz:12,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'137C3C'}},alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
      ws['!rows'][r]={hpt:20};
    } else if(it.type==='result'){
      labelStyle={font:{bold:true,sz:11,color:{rgb:'0B5A30'}},fill:{patternType:'solid',fgColor:{rgb:'F0F7EE'}},alignment:{horizontal:'left',vertical:'center'},border:BORDER_THIN};
      valueStyle={font:{bold:true,sz:11,color:{rgb:'0B5A30'}},fill:{patternType:'solid',fgColor:{rgb:'F0F7EE'}},alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
    } else if(it.type==='total'){
      labelStyle={font:{bold:true},alignment:{horizontal:'left',vertical:'center'},border:BORDER_THIN};
      valueStyle={font:{bold:true},alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
    } else if(it.type==='pct'){
      labelStyle={font:{italic:true,color:{rgb:'606060'},sz:10},alignment:{horizontal:'left',indent:1,vertical:'center'},border:BORDER_THIN};
      valueStyle={font:{italic:true,color:{rgb:'606060'},sz:10},alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
      numFmt=PCT_FMT;
    } else if(it.type==='sub'){
      labelStyle={font:{color:{rgb:'606060'},sz:10},alignment:{horizontal:'left',indent:2,vertical:'center'},border:BORDER_THIN};
      valueStyle={font:{color:{rgb:'606060'},sz:10},alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
      ws['!rows'][r]={level:1}; // colapsável sob a categoria pai
    } else { // 'cat'
      labelStyle={alignment:{horizontal:'left',vertical:'center'},border:BORDER_THIN};
      valueStyle={alignment:{horizontal:'right',vertical:'center'},border:BORDER_THIN};
    }

    setStyle(r,0,labelStyle);
    for(let c=1;c<NCOLS;c++) setStyle(r,c,valueStyle,numFmt);
  });

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'DRE');
  XLSX.writeFile(wb,`DRE_${YEAR}.xlsx`);
  toast('Excel exportado!','ok');
}

async function exportFluxoExcel(){
  await ensureXLSX();
  const f=calcFluxo(YEAR);
  const recCats=getRecCats();
  const despCats=getDespCats();
  const tot=k=>f.reduce((s,m)=>s+(m[k]||0),0);
  const rows=[['Fluxo de Caixa — Regime de Caixa '+YEAR],[],['Descrição',...MONTHS,'Total']];
  const addRow=(lbl,k,neg=false)=>rows.push([lbl,...f.map(m=>(neg?-1:1)*(m[k]||0)),(neg?-1:1)*tot(k)]);
  const addSep=(lbl)=>rows.push([lbl]);
  const recCatsVis=recCats.filter(cat=>dreCatSlug(cat)!==TRANSF_SLUG);
  const despCatsVis=despCats.filter(cat=>dreCatSlug(cat)!==TRANSF_SLUG);
  const entradasOpCats=recCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional');
  const saidasOpCats=despCatsVis.filter(c=>(c.fluxo||'operacional')!=='nao_operacional');
  const entradasNaoOpCats=recCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional');
  const saidasNaoOpCats=despCatsVis.filter(c=>(c.fluxo||'operacional')==='nao_operacional');
  addSep('FLUXO OPERACIONAL — ENTRADAS');
  entradasOpCats.forEach(cat=>addRow(cat.nome,'r_'+dreCatSlug(cat)));
  addRow('TOTAL ENTRADAS OPERACIONAIS','entradasOp');
  addSep('FLUXO OPERACIONAL — SAÍDAS');
  saidasOpCats.forEach(cat=>addRow(cat.nome,'d_'+dreCatSlug(cat),true));
  addRow('TOTAL SAÍDAS OPERACIONAIS','saidasOp',true);
  addRow('(=) RESULTADO OPERACIONAL','resultadoOp');
  if(entradasNaoOpCats.length||saidasNaoOpCats.length){
    addSep('NÃO-OPERACIONAL');
    entradasNaoOpCats.forEach(cat=>addRow(cat.nome,'r_'+dreCatSlug(cat)));
    saidasNaoOpCats.forEach(cat=>addRow(cat.nome,'d_'+dreCatSlug(cat),true));
    addRow('(=) RESULTADO NÃO-OPERACIONAL','resultadoNaoOp');
  }
  addSep('SALDOS');
  addRow('VARIAÇÃO TOTAL DE CAIXA','saldoOp');
  const paidData=cashMovements().filter(l=>l.dataPgto&&getY(l.dataPgto)===YEAR);
  const contaFlows={};
  paidData.forEach(l=>{const c=l.conta||'(Sem conta)';if(!contaFlows[c])contaFlows[c]=Array(12).fill(0);});
  paidData.filter(l=>(l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')).forEach(l=>{const dest=l.obs.slice(12);if(dest&&!contaFlows[dest])contaFlows[dest]=Array(12).fill(0);});
  const contaOrder=CONTAS_DATA.map(c=>c.nome);
  const contaSet=[...new Set(Object.keys(contaFlows))].sort((a,b)=>{const ia=contaOrder.indexOf(a),ib=contaOrder.indexOf(b);if(ia<0&&ib<0)return a.localeCompare(b);if(ia<0)return 1;if(ib<0)return -1;return ia-ib;});
  paidData.forEach(l=>{const i=getM(l.dataPgto),v=parseMoney(l.valorLiq),conta=l.conta||'(Sem conta)';contaFlows[conta][i]+=(l.tipo==='R'?v:-v);if((l.doc||'').startsWith('TRANSF#')&&(l.obs||'').startsWith('TRANSF_DEST:')){const dest=l.obs.slice(12);if(dest&&!paidData.some(cr=>cr.doc===l.doc&&cr.conta===dest&&cr.tipo==='R'))contaFlows[dest][i]+=v;}});
  const contaSaldoFin={};
  contaSet.forEach(conta=>{const ini=parseFloat(CONTAS_DATA.find(c=>c.nome===conta)?.saldo_inicial)||0;let cum=ini;contaSaldoFin[conta]=contaFlows[conta].map(v=>{cum+=v;return cum;});});
  const totalSaldoFinVals=Array(12).fill(0);
  contaSet.forEach(conta=>contaSaldoFin[conta].forEach((v,i)=>totalSaldoFinVals[i]+=v));
  addSep('VARIAÇÃO NO PERÍODO');
  contaSet.forEach(conta=>{const vals=contaFlows[conta];rows.push([conta,...vals,vals.reduce((s,v)=>s+v,0)]);});
  addSep('SALDO FINAL POR CONTA');
  contaSet.forEach(conta=>{const vals=contaSaldoFin[conta];rows.push([conta,...vals,vals[vals.length-1]]);});
  rows.push(['SALDO FINAL TOTAL',...totalSaldoFinVals,totalSaldoFinVals[totalSaldoFinVals.length-1]]);
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Fluxo de Caixa');
  XLSX.writeFile(wb,`FluxoCaixa_${YEAR}.xlsx`);
  toast('Excel exportado!','ok');
}

function exportExcel(){
  const dre=calcDRE(YEAR),fluxo=calcFluxo(YEAR),sheets=[];
  sheets.push({name:'Lançamentos',rows:[['Data Comp.','Data Venc.','Data Pgto','Tipo','Categoria','Subcategoria','Descrição','Forma Pgto','Conta','Nº Doc','Valor Bruto','Deduções','Valor Líquido','Status','Centro Custo','Obs'],...DATA.map(l=>[l.dataComp,effectiveVenc(l),l.dataPgto,l.tipo==='R'?'Receita':'Despesa',l.cat,l.sub,l.desc,l.forma,l.conta,l.doc,parseMoney(l.valorBruto),parseMoney(l.ded),titleAmount(l),computedStatus(l),l.cc,l.obs])]});
  const dreKeys=[['Receita Bruta','recBruta'],['Deduções','ded'],['Receita Líquida','recLiq'],['Pessoal','pessoal'],['Impostos e Taxas','impostos'],['Infraestrutura','infra'],['Tecnologia','tec'],['Marketing','mkt'],['Administrativo','admin'],['Total Despesas','totDesp'],['EBITDA','ebitda'],['Rec. Financeira','recFin'],['Desp. Financeira','despFin'],['LAIR','lair'],['Lucro Líquido','ll']];
  sheets.push({name:'DRE',rows:[['Descrição',...MONTHS,'Total'],...dreKeys.map(([l,k])=>[l,...dre.map(m=>m[k]),dre.reduce((s,m)=>s+m[k],0)])]});
  const fcKeys=[['Honorários','hon'],['Rec. Financeiras','recFin'],['Outras Entradas','outras'],['Total Entradas','entradas'],['Pessoal','pessoal'],['Impostos','impostos'],['Infraestrutura','infra'],['Tecnologia','tec'],['Marketing','mkt'],['Administrativo','admin'],['Financeiro','fin'],['Total Saídas','saidas'],['Saldo Operacional','saldoOp'],['Saldo Inicial','saldoIni'],['Saldo Final','saldoFin']];
  sheets.push({name:'Fluxo de Caixa',rows:[['Descrição',...MONTHS,'Total'],...fcKeys.map(([l,k])=>[l,...fluxo.map(m=>m[k]),fluxo.reduce((s,m)=>s+m[k],0)])]});
  let xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`;
  sheets.forEach(s=>{xml+=`<Worksheet ss:Name="${s.name}"><Table>`;s.rows.forEach(row=>{xml+='<Row>';row.forEach(cell=>{const isNum=typeof cell==='number';xml+=`<Cell><Data ss:Type="${isNum?'Number':'String'}">${isNum?cell:String(cell||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`;});xml+='</Row>';});xml+='</Table></Worksheet>';});
  xml+='</Workbook>';
  const blob=new Blob([xml],{type:'application/vnd.ms-excel'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`Financeiro_${YEAR}.xls`;a.click();
  toast('Excel exportado!','ok');
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function badge(status){const m={Pago:'bg',Recebido:'bg',Pendente:'by',Cancelado:'br',Parcial:'bo'};return`<span class="badge ${m[status]||'bx'}">${status}</span>`;}
async function toggleStatus(id){
  const l=DATA.find(d=>d.id===id);
  if(!l||l.status==='Cancelado')return;
  if(openAmount(l)>0.005){openBaixaModal(id);return;}
  openEdit(id);
}
let toastTimeout;
const TOAST_LOG=[];
function toast(msg,type='ok'){
  clearTimeout(toastTimeout);
  TOAST_LOG.unshift({msg,type,time:new Date()});
  if(TOAST_LOG.length>100)TOAST_LOG.length=100;
  const existing=document.getElementById('toast-el');if(existing)existing.remove();
  const el=document.createElement('div');el.id='toast-el';el.className=`toast ${type}`;el.textContent=msg;document.body.appendChild(el);
  toastTimeout=setTimeout(()=>el.remove(),2800);
}
function openLogPanel(){
  const panel=document.getElementById('log-panel');if(!panel)return;
  const fmtT=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  const rows=TOAST_LOG.length
    ?TOAST_LOG.map(e=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--bd)"><div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;background:${e.type==='ok'?'var(--teal)':e.type==='err'?'var(--red)':'var(--orange)'}"></div><div style="flex:1;font-size:13px;color:var(--tx);line-height:1.4">${esc(e.msg)}</div><div style="font-size:11px;color:var(--tx3);white-space:nowrap;flex-shrink:0">${fmtT(e.time)}</div></div>`).join('')
    :'<div style="padding:24px 0;text-align:center;color:var(--tx3);font-size:13px">Nenhum evento registrado nesta sessão.</div>';
  document.getElementById('log-panel-body').innerHTML=rows;
  panel.style.display='flex';
}
function closeLogPanel(){
  const panel=document.getElementById('log-panel');if(panel)panel.style.display='none';
}

function _saveSession(d){
  localStorage.setItem('sb_token',d.access_token);
  localStorage.setItem('sb_refresh',d.refresh_token);
  localStorage.setItem('sb_expires',Date.now()+d.expires_in*1000);
  if(d.user){
    localStorage.setItem('sb_user',JSON.stringify({email:d.user.email||'',name:d.user.user_metadata?.full_name||d.user.email||'',role:d.user.user_metadata?.role||d.user.user_metadata?.cargo||''}));
    if(d.user.email)localStorage.setItem('sb_last_email',d.user.email);
  }
}
function _clearSession(){
  ['sb_token','sb_refresh','sb_expires','sb_user'].forEach(k=>localStorage.removeItem(k));
}
function _getUserData(){try{return JSON.parse(localStorage.getItem('sb_user')||'{}');}catch{return{};} }
function _showLogin(){document.getElementById('login-screen').style.display='flex';}
function _hideLogin(){document.getElementById('login-screen').style.display='none';}

async function _refreshToken(){
  const refresh=localStorage.getItem('sb_refresh');
  if(!refresh)return false;
  try{
    const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:refresh})
    });
    if(!res.ok){_clearSession();return false;}
    _saveSession(await res.json());
    return true;
  }catch{_clearSession();return false;}
}

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const errEl=document.getElementById('login-err');
  const btn=document.querySelector('.login-btn');
  errEl.textContent='';
  if(!email||!pass){errEl.textContent='Preencha e-mail e senha.';return;}
  btn.disabled=true;btn.textContent='Entrando...';
  try{
    const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password:pass})
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error_description||data.msg||'Credenciais inválidas.');
    _saveSession(data);
    sessionStorage.setItem('sb_session_active','1');
    _hideLogin();
    pushTab('dashboard');
    init();
  }catch(e){
    errEl.textContent=e.message;
    btn.disabled=false;btn.textContent='Entrar';
  }
}

async function doLogout(){
  const token=localStorage.getItem('sb_token');
  if(token){
    fetch(`${SUPABASE_URL}/auth/v1/logout`,{
      method:'POST',headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}
    }).catch(()=>{});
  }
  _clearSession();
  sessionStorage.removeItem('sb_session_active');
  _showLogin();
  history.pushState({},'',BASE_PATH);
}

async function startApp(){
  // Sessão "viva" só dentro da mesma aba: sessionStorage sobrevive ao F5
  // mas é descartado quando a aba é fechada. Assim o F5 não pede senha,
  // mas reabrir o app pede.
  const sessionAlive=sessionStorage.getItem('sb_session_active')==='1';
  const token=localStorage.getItem('sb_token');
  const lastEmail=localStorage.getItem('sb_last_email')||'';

  const showLoginPrefilled=()=>{
    _clearSession();
    sessionStorage.removeItem('sb_session_active');
    _showLogin();
    const emailEl=document.getElementById('login-email');
    const passEl=document.getElementById('login-pass');
    if(emailEl){
      emailEl.value=lastEmail;
      setTimeout(()=>{(lastEmail?passEl:emailEl)?.focus();},50);
    }
  };

  if(!sessionAlive||!token){showLoginPrefilled();return;}

  const expires=parseInt(localStorage.getItem('sb_expires')||'0');
  if(Date.now()>expires-60000){
    const ok=await _refreshToken();
    if(!ok){showLoginPrefilled();return;}
  }
  if(!localStorage.getItem('sb_user')){
    try{
      const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${localStorage.getItem('sb_token')}`}});
      if(res.ok){const u=await res.json();localStorage.setItem('sb_user',JSON.stringify({email:u.email||'',name:u.user_metadata?.full_name||u.email||'',role:u.user_metadata?.role||u.user_metadata?.cargo||''}));}
    }catch{}
  }
  _hideLogin();
  init();
  setInterval(async()=>{
    const exp=parseInt(localStorage.getItem('sb_expires')||'0');
    if(Date.now()>exp-300000){
      const ok=await _refreshToken();
      if(!ok){doLogout();}
    }
  },240000);
}

// ─── IMPORTAR FATURAMENTO ──────────────────────────────────────────────────

function parseValorBR(v){
  return parseMoney(v);
}

function parseDateBR(d){
  if(!d)return'';
  const m=String(d).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}

// ─── DETECÇÃO AUTOMÁTICA DE SUBCATEGORIA ───────────────────────────────
// Detecta subcategoria baseado na descrição comparando com subcategorias reais

// Regras fixas: [padrão na descrição] → subcategoria (parcial, sem acentos, case-insensitive)
// ─── REGRAS DE CATEGORIA/SUBCATEGORIA NA IMPORTAÇÃO ──────────────────────────
// Adicione novas regras aqui. cat:null = mantém categoria padrão.
const CAT_RULES = [
  {match: 'condominio online sgc',  cat: null,               sub: 'honorarios mensais'},
  {match: 'defis',                  cat: 'Serviços Extras',  sub: 'Declarações Anuais'},
  {match: 'baixa de empresa',       cat: 'Societário',       sub: 'Baixa de Empresas'},
  {match: 'certidao simplificada',  cat: 'Reembolso',        sub: 'Reembolso'},
  {match: 'certificado digital',    cat: 'Serviços Extras',  sub: 'Certificado Digital'},
];

function _norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();}

function detectCatAndSub(descricao, recCats, defaultCatName){
  const desc=_norm(descricao||'');
  for(const rule of CAT_RULES){
    if(!desc.includes(_norm(rule.match)))continue;
    let catName=defaultCatName,subName='';
    if(rule.cat){
      const fc=recCats.find(c=>_norm(c.nome).includes(_norm(rule.cat))||_norm(rule.cat).includes(_norm(c.nome)));
      if(fc){
        catName=fc.nome;
        if(rule.sub){const fs=(fc.subs||[]).find(s=>_norm(s.nome).includes(_norm(rule.sub))||_norm(rule.sub).includes(_norm(s.nome)));if(fs)subName=fs.nome;}
      }
    }else if(rule.sub){
      const dc=recCats.find(c=>c.nome===defaultCatName);
      if(dc){const fs=(dc.subs||[]).find(s=>_norm(s.nome).includes(_norm(rule.sub)));if(fs)subName=fs.nome;}
    }
    return{cat:catName,sub:subName};
  }
  const dc=recCats.find(c=>c.nome===defaultCatName);
  const subcats=(dc?.subs||[]).map(s=>s.nome);
  return{cat:defaultCatName,sub:_detectSubAuto(desc,subcats)};
}

function _detectSubAuto(desc,subcats){
  if(!desc||!subcats.length)return'';
  for(const s of subcats){const sn=_norm(s);if(desc.includes(sn)||sn.includes(desc.split(' ')[0]))return s;}
  const dw=desc.split(/\s+/);
  for(const s of subcats){
    const sn=_norm(s);
    for(const w of dw){if(w.length>3&&sn.includes(w))return s;}
    for(const w of sn.split(/\s+/)){if(w.length>3&&desc.includes(w))return s;}
  }
  return'';
}

let IMP_ENTRIES=[];
let IMP_SELECTED=new Set();

function onImpFatChange(event){
  const file=event.target.files[0];
  if(!file)return;
  event.target.value='';
  const reader=new FileReader();
  if(file.name.toLowerCase().endsWith('.csv')){
    reader.onload=e=>{
      try{
        const result=parseFaturamentoCSV(e.target.result);
        showImpModal(result);
      }catch(err){toast('Erro ao ler CSV: '+err.message,'err');}
    };
    reader.readAsText(file,'UTF-8');
  }else{
    reader.onload=async e=>{
      try{
        await ensureXLSX();
        const wb=readWorkbookCompat(e.target.result);
        const result=parseFaturamentoXLS(wb);
        showImpModal(result);
      }catch(err){toast('Erro ao ler arquivo: '+err.message,'err');}
    };
    reader.readAsArrayBuffer(file);
  }
}

function arrayBufferToBinaryString(buf){
  const bytes=new Uint8Array(buf);
  let out='';
  for(let i=0;i<bytes.length;i+=0x8000){
    out+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  }
  return out;
}

function workbookHasRows(wb){
  return (wb.SheetNames||[]).some(name=>{
    const ws=wb.Sheets[name];
    return !!(ws&&ws['!ref']);
  });
}

function readWorkbookCompat(buf){
  const attempts=[
    ()=>XLSX.read(buf,{type:'array',cellDates:false,codepage:1252,dense:false}),
    ()=>XLSX.read(new Uint8Array(buf),{type:'array',cellDates:false,codepage:1252,dense:false}),
    ()=>XLSX.read(arrayBufferToBinaryString(buf),{type:'binary',cellDates:false,codepage:1252,dense:false})
  ];
  let lastErr=null;
  for(const read of attempts){
    try{
      const wb=read();
      if(workbookHasRows(wb))return wb;
      lastErr=new Error(`este XLS antigo não pôde ser lido no navegador. Use "Rodar Converter Faturamento.bat" e importe o CSV gerado. Abas detectadas: ${(wb.SheetNames||[]).join(', ')||'sem abas'}`);
    }catch(e){lastErr=e;}
  }
  throw lastErr||new Error('não foi possível abrir a planilha');
}

function parseCSVLine(line, sep){
  const cols=[];
  let cur='', inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i], next=line[i+1];
    if(ch==='"'){
      if(inQuotes&&next==='"'){cur+='"';i++;}
      else inQuotes=!inQuotes;
    }else if(ch===sep&&!inQuotes){
      cols.push(cur.trim());
      cur='';
    }else{
      cur+=ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function detectCSVSeparator(line){
  let comma=0, semi=0, inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i], next=line[i+1];
    if(ch==='"'){
      if(inQuotes&&next==='"')i++;
      else inQuotes=!inQuotes;
    }else if(!inQuotes&&ch===',')comma++;
    else if(!inQuotes&&ch===';')semi++;
  }
  return semi>=comma?';':',';
}

function parseFaturamentoCSV(text){
  const lines=text.trim().split('\n').filter(l=>l.trim());
  if(lines.length<2)throw new Error('CSV sem dados');
  const sep=detectCSVSeparator(lines[0]);
  const headers=parseCSVLine(lines[0],sep).map(h=>h.replace(/^\uFEFF/,'').trim());
  const rows=lines.slice(1).map(l=>{
    const cols=parseCSVLine(l,sep);
    return headers.reduce((o,h,i)=>(o[h]=cols[i]||'',o),{});
  });
  const comp=rows[0]?.competencia||'';
  const m=comp.match(/(\d{2})\/(\d{4})/);
  const dataComp=m?`${m[2]}-${m[1]}-01`:'';
  const clientes=rows.map((r,idx)=>({
    evento:r.evento||String(idx+1),
    codigo:r.codigo||'',
    nome:r.nome||'',
    cpfCnpj:r.cnpj||r.cpf||r.cpf_cnpj||r.cpfcnpj||'',
    valorLiq:parseMoney(r.valor_liq)||Math.max(0,parseMoney(r.valor_bruto)-parseMoney(r.desconto)-parseMoney(r.retencoes)),
    valorBruto:parseMoney(r.valor_bruto),
    desconto:parseMoney(r.desconto),
    retencoes:parseMoney(r.retencoes),
    vencimento:r.vencimento||'',
    servicos:r.servicos||''
  }));
  if(!clientes.length)throw new Error('Nenhum cliente encontrado no CSV');
  const vencPorCliente=new Map();
  clientes.forEach(c=>{
    const key=`${c.codigo}__${c.nome}`;
    if(c.vencimento)vencPorCliente.set(key,c.vencimento);
  });
  clientes.forEach(c=>{
    if(!c.vencimento)c.vencimento=vencPorCliente.get(`${c.codigo}__${c.nome}`)||'';
  });
  return{dataComp,clientes};
}

function mergeFaturamentoClientes(clientes){
  const merged=[];
  const byClient=new Map();
  for(const cliente of clientes){
    const key=`${cliente.codigo}__${cliente.nome}__${cliente.valorLiq}`;
    const found=byClient.get(key);
    if(found){
      found.eventos.push(...(cliente.eventos||[]));
      if(cliente.vencimento&&!found.vencimento)found.vencimento=cliente.vencimento;
    }else{
      const clone={...cliente,eventos:[...(cliente.eventos||[])]};
      byClient.set(key,clone);
      merged.push(clone);
    }
  }
  return merged;
}

function parseFaturamentoXLS(wb){
  let rows=[], sheetName='';
  for(const name of wb.SheetNames||[]){
    const ws=wb.Sheets[name];
    if(!ws)continue;
    const candidate=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});
    if(candidate.length>rows.length){
      rows=candidate;
      sheetName=name;
    }
  }
  if(!rows.length){
    throw new Error(`Nenhuma linha encontrada nas abas do arquivo (${(wb.SheetNames||[]).join(', ')||'sem abas'}). Tente gerar o CSV pelo conversor ou salvar o XLS como XLSX.`);
  }
  console.log('[IMPORT XLS] Aba usada:',sheetName,'linhas:',rows.length);

  // helper: acha texto em qualquer célula da linha e retorna o índice
  const normCell=v=>String(v||'').trim().replace(/\s+/g,' ');
  const findCol=(row,txt)=>row.findIndex(c=>normCell(c).toLowerCase()===txt.toLowerCase());
  const findLike=(row,re)=>row.findIndex(c=>re.test(normCell(c)));
  const findNextValue=(row,start)=>{
    for(let j=Math.max(0,start+1);j<row.length;j++){
      const v=normCell(row[j]);
      if(v&&parseMoney(v)>0)return v;
    }
    return '';
  };
  const parseClienteRow=row=>{
    const cIdx=row.findIndex(c=>/^cliente:?$/i.test(normCell(c)));
    const cnpjIdx=row.findIndex(c=>/^cnpj:?$/i.test(normCell(c)));
    const end=cnpjIdx>cIdx?cnpjIdx:Math.min(row.length,cIdx+12);
    const parts=row.slice(cIdx+1,end).map(normCell).filter(Boolean);
    const codigoIdx=parts.findIndex(p=>/^\d+$/.test(p));
    const codigo=codigoIdx>=0?parts[codigoIdx]:'';
    const nome=parts.filter((_,idx)=>idx!==codigoIdx).join(' ').trim();
    let cpfCnpj='';
    if(cnpjIdx>=0){
      for(let j=cnpjIdx+1;j<row.length;j++){
        const v=normCell(row[j]);
        if(v&&/\d/.test(v)){cpfCnpj=v;break;}
      }
    }
    const vlIdx=findLike(row,/^valor\s*l[íi]quido:?$/i);
    return {codigo,nome,cpfCnpj,valorLiq:vlIdx>=0?parseMoney(findNextValue(row,vlIdx)):0};
  };

  // Competência: busca nas primeiras 6 linhas
  let dataComp='';
  for(let r=0;r<Math.min(6,rows.length);r++){
    for(const cell of rows[r]){
      const m=String(cell||'').match(/Compet[êe]ncia[:\s]+(\d{2})\/(\d{4})/i);
      if(m){dataComp=`${m[2]}-${m[1]}-01`;}
    }
    if(dataComp)break;
  }

  const clientes=[];
  let i=0;
  while(i<rows.length){
    const row=rows[i];
    const cIdx=row.findIndex(c=>/^cliente:?$/i.test(normCell(c)));
    if(cIdx>=0){
      // código e nome ficam a +3 e +7 colunas do "Cliente:"
      const parsedCliente=parseClienteRow(row);
      const codigo=parsedCliente.codigo;
      const nome=parsedCliente.nome;
      // valor líquido: busca "Valor líquido:" na mesma linha
      const valorLiq=parsedCliente.valorLiq;
      const cliente={codigo,nome,cpfCnpj:parsedCliente.cpfCnpj||'',valorLiq,eventos:[],vencimento:''};
      i++;
      // pula linha de cabeçalho dos eventos
      let eventIdx=1, descIdx=2, valorIdx=9, descontoIdx=17, retIdx=31;
      if(rows[i]&&findCol(rows[i],'Evento')>=0){
        const hdr=rows[i];
        eventIdx=findCol(hdr,'Evento');
        descIdx=findLike(hdr,/^descri/i);
        valorIdx=findLike(hdr,/^valor\s+lan/i);
        descontoIdx=findLike(hdr,/^desconto/i);
        retIdx=findLike(hdr,/^reten/i);
        if(eventIdx<0)eventIdx=1;
        if(descIdx<0)descIdx=2;
        if(valorIdx<0)valorIdx=9;
        if(descontoIdx<0)descontoIdx=17;
        if(retIdx<0)retIdx=31;
        i++;
      }
      // lê linhas de eventos
      while(i<rows.length){
        const r=rows[i];
        if(findCol(r,'Parcela')>=0||r.findIndex(c=>/^cliente:?$/i.test(normCell(c)))>=0)break;
        // evento: col B (idx 1) é um número
        const col1=normCell(r[eventIdx]);
        if(col1&&!isNaN(Number(col1))){
          // descrição sempre em col F (idx 5); valores em posições fixas
          cliente.eventos.push({
            evento:col1,
            descricao:normCell(r[descIdx]),
            valorLancado:parseValorBR(r[valorIdx]),
            desconto:parseValorBR(r[descontoIdx]),
            retencoes:parseValorBR(r[retIdx])
          });
        }
        i++;
      }
      // lê vencimento da linha Parcela — tenta col 31 primeiro, depois varre a linha toda
      // formatos aceitos: M/D/YY (US, ex: "5/20/26") e D/M/YYYY (BR, ex: "20/05/2026")
      if(rows[i]&&findCol(rows[i],'Parcela')>=0){
        const pr=rows[i];
        const tryParseVenc=raw=>{
          if(!raw)return'';
          // M/D/YY — formato US que o XLSX.js às vezes usa (ano 2 dígitos)
          const mdy2=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
          if(mdy2)return`${mdy2[2].padStart(2,'0')}/${mdy2[1].padStart(2,'0')}/20${mdy2[3]}`;
          // D/M/YYYY ou DD/MM/YYYY — formato BR (ano 4 dígitos), sem trocar dia e mês
          const dmy4=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if(dmy4)return`${dmy4[1].padStart(2,'0')}/${dmy4[2].padStart(2,'0')}/${dmy4[3]}`;
          return'';
        };
        // tenta col 31; se não achar, varre toda a linha
        let venc=tryParseVenc(normCell(pr[31]));
        if(!venc){
          for(let ci=0;ci<pr.length;ci++){
            if(ci===31)continue;
            venc=tryParseVenc(normCell(pr[ci]));
            if(venc)break;
          }
        }
        if(venc)cliente.vencimento=venc;
        console.log('[IMPORT XLS] Parcela row col31=',normCell(pr[31]),'→ venc=',venc||'(não encontrado)');
        i++;
      }
      if(cliente.nome||cliente.codigo)clientes.push(cliente);
    }else{i++;}
  }
  if(clientes.length===0){
    throw new Error(`Nenhum cliente encontrado no arquivo. Verifique se é o Extrato do Faturamento correto. (${rows.length} linhas lidas)`);
  }
  const merged=mergeFaturamentoClientes(clientes);
  // Propaga vencimento entre blocos do mesmo cliente (mesmo código+nome, valorLiq diferente)
  const vencPorCliente=new Map();
  merged.forEach(c=>{const k=`${c.codigo}__${c.nome}`;if(c.vencimento)vencPorCliente.set(k,c.vencimento);});
  merged.forEach(c=>{if(!c.vencimento)c.vencimento=vencPorCliente.get(`${c.codigo}__${c.nome}`)||'';});
  return{dataComp,clientes:merged};
}

const IMP_COL_WIDTHS_KEY='financeiro_imp_col_widths';
const IMP_COLS=[
  {id:'cliente',lbl:'Cliente',       sort:'cliente', w:160,min:80},
  {id:'servico',lbl:'Descrição',      sort:'servico', w:160,min:80},
  {id:'cat',    lbl:'Categoria',     sort:'cat',     w:150,min:100},
  {id:'sub',    lbl:'Subcategoria',  sort:'sub',     w:150,min:100},
  {id:'data',   lbl:'Vencimento',    sort:'data',    w:120,min:90},
  {id:'valor',  lbl:'Líquido',       sort:'valor',   w:100,min:80},
];
let impColWidths=(()=>{try{const s=localStorage.getItem(IMP_COL_WIDTHS_KEY);if(s){const p=JSON.parse(s);const o={};IMP_COLS.forEach(c=>{o[c.id]=p[c.id]||c.w;});return o;}}catch(e){}const o={};IMP_COLS.forEach(c=>o[c.id]=c.w);return o;})();
function saveImpColWidths(){try{localStorage.setItem(IMP_COL_WIDTHS_KEY,JSON.stringify(impColWidths));}catch(e){}}

const IMP_SORT={col:'',dir:'asc'};
const IMP_INP_BASE='font-size:11px;width:100%;background:var(--s2);color:var(--tx);color-scheme:dark;border:1px solid var(--bd);border-radius:5px;padding:2px 5px;box-sizing:border-box';

function _impClienteStatus(entry){
  const codigo=String(entry.cc||'').trim();
  if(!codigo)return {icon:'⚠️',title:'Sem código — não será vinculado'};
  const existing=(typeof _matchClienteByCodigo==='function')?_matchClienteByCodigo(codigo):null;
  if(existing)return {icon:'✅',title:`Vinculado a: ${existing.nome}`};
  if(!String(entry.desc||'').trim())return {icon:'⚠️',title:'Sem nome — não será criado'};
  return {icon:'🆕',title:'Será cadastrado automaticamente'};
}
function buildImpRows(){
  return IMP_ENTRIES.map((e,idx)=>{
    const catOpts=Object.keys(CATS['R']).map(c=>`<option value="${esc(c)}"${c===e.cat?' selected':''}>${esc(c)}</option>`).join('');
    const subOpts=(CATS['R'][e.cat]||[]).map(s=>`<option value="${esc(s)}"${s===e.sub?' selected':''}>${esc(s)}</option>`).join('');
    const warnSub=!e.sub?';border-color:var(--orange)':'';
    const warnDt=!e.dataVenc?';border-color:var(--orange)':'';
    const sel=IMP_SELECTED.has(idx);
    const cliSt=_impClienteStatus(e);
    return `
    <tr class="lr" style="${sel?'background:color-mix(in srgb,var(--blue) 10%,transparent)':''}">
      <td style="width:32px;text-align:center;padding:4px 2px;border-bottom:1px solid var(--bd)">
        <input type="checkbox" ${sel?'checked':''} onchange="impToggleRow(${idx},this.checked)">
      </td>
      <td class="ct" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px"><span title="${esc(cliSt.title)}" style="margin-right:6px">${cliSt.icon}</span>${esc(e.desc)}</td>
      <td style="font-size:12px;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((e.obs||'').replace(/^Servico:\s*/,'')||'—')}</td>
      <td style="padding:4px 8px;overflow:hidden">
        <select style="${IMP_INP_BASE}" onchange="impEditEntry(${idx},'cat',this.value)">${catOpts}</select>
      </td>
      <td style="padding:4px 8px;overflow:hidden">
        <select id="imp-sub-${idx}" style="${IMP_INP_BASE}${warnSub}" onchange="impEditEntry(${idx},'sub',this.value)">
          <option value="">—</option>${subOpts}
        </select>
      </td>
      <td style="padding:4px 8px;overflow:hidden">
        <input type="date" id="imp-dt-${idx}" value="${e.dataVenc||''}" style="${IMP_INP_BASE}${warnDt}" onchange="impEditEntry(${idx},'dataVenc',this.value)">
      </td>
      <td style="text-align:right;font-weight:600;color:var(--teal);font-size:12px;white-space:nowrap">${fmt(e.valorLiq)}</td>
    </tr>`;
  }).join('');
}

function impToggleRow(idx,checked){
  if(checked)IMP_SELECTED.add(idx);else IMP_SELECTED.delete(idx);
  impUpdateBulkBar();
  const rows=document.querySelectorAll('.imp-tbl tbody tr');
  if(rows[idx])rows[idx].style.background=checked?'color-mix(in srgb,var(--blue) 10%,transparent)':'';
}

function impToggleAll(checked){
  IMP_SELECTED.clear();
  if(checked)IMP_ENTRIES.forEach((_,i)=>IMP_SELECTED.add(i));
  impUpdateBulkBar();
  const tbody=document.querySelector('.imp-tbl tbody');
  if(tbody)tbody.innerHTML=buildImpRows();
}

function impUpdateBulkBar(){
  const bar=document.getElementById('imp-bulk-bar');
  const cnt=document.getElementById('imp-bulk-count');
  if(!bar)return;
  const n=IMP_SELECTED.size;
  bar.style.display=n>0?'flex':'none';
  if(cnt)cnt.textContent=`${n} selecionado${n>1?'s':''}`;
  const all=document.getElementById('imp-chk-all');
  if(all){all.indeterminate=n>0&&n<IMP_ENTRIES.length;all.checked=n===IMP_ENTRIES.length&&n>0;}
}

function impBulkCatChange(){
  const cat=document.getElementById('imp-bulk-cat').value;
  const subs=CATS['R'][cat]||[];
  const sel=document.getElementById('imp-bulk-sub');
  sel.innerHTML=`<option value="">— subcategoria —</option>`+subs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
}

function impApplyBulk(){
  const cat=document.getElementById('imp-bulk-cat').value;
  const sub=document.getElementById('imp-bulk-sub').value;
  const date=document.getElementById('imp-bulk-date').value;
  if(!cat&&!sub&&!date){toast('Selecione ao menos um campo para aplicar','err');return;}
  IMP_SELECTED.forEach(idx=>{
    if(cat){IMP_ENTRIES[idx].cat=cat;if(sub)IMP_ENTRIES[idx].sub=sub;else IMP_ENTRIES[idx].sub='';}
    else if(sub){IMP_ENTRIES[idx].sub=sub;}
    if(date)IMP_ENTRIES[idx].dataVenc=date;
  });
  const tbody=document.querySelector('.imp-tbl tbody');
  if(tbody)tbody.innerHTML=buildImpRows();
  toast(`Aplicado em ${IMP_SELECTED.size} lançamento(s)`,'ok');
}

function impClearSelection(){
  IMP_SELECTED.clear();
  impUpdateBulkBar();
  const tbody=document.querySelector('.imp-tbl tbody');
  if(tbody)tbody.innerHTML=buildImpRows();
}

function sortImpCol(col){
  if(IMP_SORT.col===col)IMP_SORT.dir=IMP_SORT.dir==='asc'?'desc':'asc';
  else{IMP_SORT.col=col;IMP_SORT.dir='asc';}
  const dir=IMP_SORT.dir==='asc'?1:-1;
  IMP_ENTRIES.sort((a,b)=>{
    let va,vb;
    if(col==='cliente'){va=a.desc||'';vb=b.desc||'';}
    else if(col==='servico'){va=(a.obs||'').replace(/^Servico:\s*/,'');vb=(b.obs||'').replace(/^Servico:\s*/,'');}
    else if(col==='cat'){va=a.cat||'';vb=b.cat||'';}
    else if(col==='sub'){va=a.sub||'';vb=b.sub||'';}
    else if(col==='data'){va=a.dataVenc||'';vb=b.dataVenc||'';}
    else if(col==='valor'){return(parseMoney(a.valorLiq)-parseMoney(b.valorLiq))*dir;}
    else return 0;
    return va.localeCompare(vb,'pt-BR')*dir;
  });
  const tbody=document.querySelector('.imp-tbl tbody');
  if(tbody)tbody.innerHTML=buildImpRows();
  IMP_COLS.forEach(c=>{
    const th=document.querySelector(`.imp-tbl th[data-col="${c.id}"]`);
    if(!th)return;
    th.classList.remove('asc','desc');
    if(c.id===col)th.classList.add(IMP_SORT.dir);
  });
}

function startImpColResize(e,colId){
  e.preventDefault();e.stopPropagation();
  const ci=IMP_COLS.findIndex(c=>c.id===colId);if(ci<0)return;
  const col=IMP_COLS[ci],nextCol=IMP_COLS[ci+1]||null;
  const startX=e.clientX,startW=impColWidths[colId]||col.w,startNextW=nextCol?(impColWidths[nextCol.id]||nextCol.w):null;
  document.body.classList.add('resizing-col');
  const onMove=ev=>{
    const n=Math.max(col.min,startW+(ev.clientX-startX));
    impColWidths[colId]=n;
    document.querySelectorAll(`.imp-tbl col[data-col="${colId}"],.imp-tbl th[data-col="${colId}"]`).forEach(el=>el.style.width=n+'px');
    if(nextCol){const nn=Math.max(nextCol.min,startNextW-(n-startW));impColWidths[nextCol.id]=nn;document.querySelectorAll(`.imp-tbl col[data-col="${nextCol.id}"],.imp-tbl th[data-col="${nextCol.id}"]`).forEach(el=>el.style.width=nn+'px');}
  };
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.body.classList.remove('resizing-col');saveImpColWidths();};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

function impEditEntry(idx, field, value) {
  IMP_ENTRIES[idx][field] = value;
  if (field === 'cat') {
    const subs = CATS['R'][value] || [];
    const sel = document.getElementById(`imp-sub-${idx}`);
    if (!sel) return;
    sel.innerHTML = `<option value="">—</option>` +
      subs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    IMP_ENTRIES[idx].sub = '';
    sel.style.borderColor = 'var(--orange)';
  }
  if (field === 'sub') {
    const el = document.getElementById(`imp-sub-${idx}`);
    if (el) el.style.borderColor = value ? '' : 'var(--orange)';
  }
  if (field === 'dataVenc') {
    const el = document.getElementById(`imp-dt-${idx}`);
    if (el) el.style.borderColor = value ? '' : 'var(--orange)';
  }
}

function showImpModal({dataComp,clientes}){
  const recCats=getRecCats();
  console.log('[IMPORT] Categorias de receita carregadas:', recCats);
  
  // Busca a categoria "Receita de Serviços" (ou a primeira categoria de receita disponível)
  let recServicos = recCats.find(c => c.nome === 'Receita de Serviços');
  if (!recServicos && recCats.length > 0) {
    recServicos = recCats[0]; // fallback para primeira categoria
  }
  const defaultRecCat = recServicos?.nome || recCats[0]?.nome || 'Receita de Servicos';
  IMP_SELECTED=new Set();

  IMP_ENTRIES=clientes.flatMap(c=>{
    // Suporta origem XLS (tem c.eventos) ou CSV (tem campos diretos)
    if(Array.isArray(c.eventos)&&c.eventos.length){
      return c.eventos.map((ev,idx)=>{
        const descs=ev.descricao||'';
        const valorBruto=parseMoney(ev.valorLancado);
        const totalDed=parseMoney(ev.desconto)+parseMoney(ev.retencoes);
        const valorLiq=Math.max(0,parseMoney(ev.valorLiq)||(valorBruto-totalDed));
        const {cat:detCat,sub:detSub}=detectCatAndSub(descs,recCats,defaultRecCat);
        const eventoId=ev.evento||String(idx+1).padStart(2,'0');
        return{
          tipo:'R',dataComp,dataVenc:parseDateBR(c.vencimento),dataPgto:'',
          desc:c.nome,sub:detSub,cc:c.codigo,cpfCnpj:c.cpfCnpj||'',
          doc:`FAT-${dataComp.slice(0,7)}-${c.codigo}-${eventoId}`,
          valorBruto,ded:totalDed,valorLiq,
          cat:detCat,forma:'Boleto',conta:'Dominio Conta Digital',status:'Pendente',
          obs:descs?`Servico: ${descs}`:''
        };
      });
    }

    const totalBruto=parseMoney(c.valorBruto);
    const totalDed=parseMoney(c.desconto)+parseMoney(c.retencoes);
    const descs=c.servicos||'';
    const eventoId=c.evento||'';
    const {cat:detCat,sub:detSub}=detectCatAndSub(descs,recCats,defaultRecCat);

    return{
      tipo:'R',dataComp,dataVenc:parseDateBR(c.vencimento),dataPgto:'',
      desc:c.nome,sub:detSub,cc:c.codigo,cpfCnpj:c.cpfCnpj||'',
      doc:`FAT-${dataComp.slice(0,7)}-${c.codigo}${eventoId?`-${eventoId}`:''}`,
      valorBruto:totalBruto,ded:totalDed,valorLiq:parseMoney(c.valorLiq),
      cat:detCat,forma:'Boleto',conta:'Caixa',status:'Pendente',
      obs:descs?`Servico: ${descs}`:''
    };
  }).filter(e=>parseMoney(e.valorLiq)>0);

  IMP_SORT.col='';IMP_SORT.dir='asc';
  const totalLiq=IMP_ENTRIES.reduce((s,e)=>s+parseMoney(e.valorLiq),0);
  const totalClientes=new Set(IMP_ENTRIES.map(e=>e.cc||e.desc)).size;

  document.getElementById('imp-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px">
      <div><div class="fl">Competência</div><div style="font-weight:700;color:var(--tx)">${dataComp?dataComp.slice(0,7):'Não encontrada'}</div></div>
      <div><div class="fl">Lançamentos</div><div style="font-weight:700;color:var(--tx)">${IMP_ENTRIES.length} <span style="font-size:11px;color:var(--tx3);font-weight:400">(${totalClientes} clientes)</span></div></div>
      <div><div class="fl">Total líquido</div><div style="font-weight:700;color:var(--teal)">${fmt(totalLiq)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:16px;max-width:360px">
      <div>
        <div class="fl">Forma de pagamento</div>
        <select id="imp-forma" style="width:100%">
          <option>Boleto</option><option>PIX</option><option>Transferência</option><option>Outro</option>
        </select>
      </div>
    </div>
    <div class="fl" style="margin-bottom:6px">Prévia (${IMP_ENTRIES.length} lançamentos)</div>
    <div id="imp-bulk-bar" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;background:color-mix(in srgb,var(--blue) 12%,var(--s1));border:1px solid color-mix(in srgb,var(--blue) 40%,transparent);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px">
      <span id="imp-bulk-count" style="font-weight:600;color:var(--tx);min-width:100px"></span>
      <select id="imp-bulk-cat" style="${IMP_INP_BASE};width:160px" onchange="impBulkCatChange()">
        <option value="">— categoria —</option>
        ${Object.keys(CATS['R']).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <select id="imp-bulk-sub" style="${IMP_INP_BASE};width:160px">
        <option value="">— subcategoria —</option>
      </select>
      <input type="date" id="imp-bulk-date" style="${IMP_INP_BASE};width:130px" placeholder="Vencimento">
      <button class="btn btn-pri" style="font-size:11px;padding:4px 12px" onclick="impApplyBulk()">Aplicar</button>
      <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px" onclick="impClearSelection()">Limpar seleção</button>
    </div>
    <div style="border:1px solid var(--bd);border-radius:10px;overflow-x:auto;overflow-y:auto;margin-bottom:14px;max-height:420px">
      <table class="imp-tbl" style="border-collapse:collapse;table-layout:fixed;min-width:${32+IMP_COLS.reduce((s,c)=>s+(impColWidths[c.id]||c.w),0)}px">
        <colgroup><col style="width:32px">${IMP_COLS.map(c=>`<col data-col="${c.id}" style="width:${impColWidths[c.id]||c.w}px">`).join('')}</colgroup>
        <thead style="position:sticky;top:0;z-index:2"><tr style="background:var(--s2)">
          <th style="width:32px;text-align:center;padding:8px 2px;border-bottom:1px solid var(--bd)">
            <input type="checkbox" id="imp-chk-all" title="Selecionar tudo" onchange="impToggleAll(this.checked)">
          </th>
          ${IMP_COLS.map(c=>{
            const align=c.id==='valor'?'right':'left';
            return `<th class="lan-th th-sort" data-col="${c.id}" style="padding:8px 12px;text-align:${align};font-size:11px;color:var(--tx2);border-bottom:1px solid var(--bd);width:${impColWidths[c.id]||c.w}px" onclick="sortImpCol('${c.id}')">${c.lbl}<span class="sort-ico"></span><span class="col-resize" onclick="event.stopPropagation()" onmousedown="startImpColResize(event,'${c.id}')"></span></th>`;
          }).join('')}
        </tr></thead>
        <tbody>${buildImpRows()}</tbody>
      </table>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:4px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--tx2);cursor:pointer">
        <input type="checkbox" id="imp-skip-dup" checked> Ignorar duplicados (mesmo Nº Doc)
      </label>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="closeImpModal()">Cancelar</button>
        <button class="btn btn-pri" onclick="confirmarImport()">${appIcon('upload')}Importar ${IMP_ENTRIES.length} registros</button>
      </div>
    </div>`;

  document.getElementById('imp-overlay').style.display='flex';
}

function closeImpModal(){
  document.getElementById('imp-overlay').style.display='none';
  IMP_ENTRIES=[];
  IMP_SELECTED=new Set();
}

function _matchClienteByCodigo(codigo){
  if(!codigo)return null;
  const c=String(codigo).trim();
  if(!c)return null;
  let m=CLIENTES.find(x=>String(x.codigo||'').trim()===c);
  if(m)return m;
  const stripped=c.replace(/^0+/,'');
  if(stripped&&stripped!==c){
    m=CLIENTES.find(x=>String(x.codigo||'').trim().replace(/^0+/,'')===stripped);
    if(m)return m;
  }
  return null;
}
async function _resolveClienteIdForEntry(entry,localCache){
  const codigo=String(entry.cc||'').trim();
  if(!codigo)return null;
  if(localCache.has(codigo))return localCache.get(codigo);
  const cpfCnpj=entry.cpfCnpj?maskCpfCnpj(entry.cpfCnpj):'';
  const nome=String(entry.desc||'').trim();
  const existing=_matchClienteByCodigo(codigo);
  if(existing){
    if(!existing.cpfCnpj&&cpfCnpj){
      try{
        await dbUpdateCliente({...existing,cpfCnpj});
        existing.cpfCnpj=cpfCnpj;
        existing.tipo=clienteTipoFromDoc(cpfCnpj);
      }catch(e){console.warn('Falha ao preencher CPF/CNPJ retroativo',codigo,e);}
    }
    localCache.set(codigo,existing.id);
    return existing.id;
  }
  if(!nome)return null;
  try{
    const novo={
      id:newId(),
      codigo,
      nome,
      cpfCnpj,
      recorrente:true,
      recorrenteDesde:new Date().toISOString().slice(0,10)
    };
    await dbInsertCliente(novo);
    const inMem={...novo,tipo:clienteTipoFromDoc(cpfCnpj),createdAt:new Date().toISOString()};
    CLIENTES.push(inMem);
    localCache.set(codigo,novo.id);
    return novo.id;
  }catch(e){
    console.warn('Falha ao criar cliente automaticamente',codigo,nome,e);
    return null;
  }
}

async function confirmarImport(){
  const forma=document.getElementById('imp-forma')?.value||'Boleto';
  const skipDup=document.getElementById('imp-skip-dup')?.checked;

  const entries=[...IMP_ENTRIES];
  for(const entry of entries){
    const validation=validateLancamentoCore({...entry,forma});
    if(validation.errors.length){toast(`${entry.desc||'Linha importada'}: ${firstValidationError(validation)}`,'err');return;}
  }
  closeImpModal();
  setSyncStatus('loading','Importando...');

  const _impProgWrap=document.createElement('div');
  _impProgWrap.id='imp-progress-wrap';
  _impProgWrap.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--s2);border-top:1px solid var(--bd);padding:10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 -2px 12px #0004';
  _impProgWrap.innerHTML=`<span style="font-size:12px;color:var(--tx2);white-space:nowrap">Importando faturamento</span><div style="flex:1;height:8px;background:var(--bd);border-radius:4px;overflow:hidden"><div id="imp-prog-bar" style="height:100%;width:0%;background:var(--brand);border-radius:4px;transition:width .15s ease"></div></div><span id="imp-prog-pct" style="font-size:12px;color:var(--brand);font-weight:700;min-width:36px;text-align:right">0%</span><span id="imp-prog-txt" style="font-size:12px;color:var(--tx3);white-space:nowrap">0 / ${entries.length}</span>`;
  document.body.appendChild(_impProgWrap);
  const _updImpProg=done=>{
    const pct=Math.round(done/entries.length*100);
    const bar=document.getElementById('imp-prog-bar'),pctEl=document.getElementById('imp-prog-pct'),txt=document.getElementById('imp-prog-txt');
    if(bar)bar.style.width=pct+'%';if(pctEl)pctEl.textContent=pct+'%';if(txt)txt.textContent=`${done} / ${entries.length}`;
  };

  let inserted=0,skipped=0,errors=0;
  const clienteCache=new Map();
  const clientesAntes=CLIENTES.length;
  for(const entry of entries){
    try{
      if(skipDup&&DATA.some(d=>d.doc===entry.doc)){skipped++;continue;}
      const id=newId();
      const clienteId=await _resolveClienteIdForEntry(entry,clienteCache);
      const item={...entry,id,forma,clienteId:clienteId||''};
      const saved=await dbInsert(item);
      DATA.unshift(fromRow({...toRow(item),id:saved?.id||id}));
      inserted++;
    }catch(e){errors++;console.error('Erro ao importar linha',entry?.desc,e);}
    _updImpProg(inserted+skipped+errors);
  }
  document.getElementById('imp-progress-wrap')?.remove();
  const createdClientes=CLIENTES.length-clientesAntes;

  setSyncStatus('ok',`${DATA.length} registros`);
  render();
  let msg=`${inserted} registro(s) importado(s)`;
  if(skipped)msg+=`, ${skipped} ignorado(s)`;
  if(errors)msg+=`, ${errors} erro(s)`;
  if(createdClientes)msg+=` · ${createdClientes} cliente(s) cadastrado(s)`;
  toast(msg,inserted>0?'ok':'err');
}

// ── BAIXAR POR RELATÓRIO DE RECEBIMENTOS ─────────────────────────────────────
let REL_MATCHED=[];
let REL_UNCERTAIN=[];
let REL_NOT_FOUND=[];
let REL_CONTA='';

function openBaixarRelModal(){
  REL_MATCHED=[];REL_UNCERTAIN=[];REL_NOT_FOUND=[];REL_CONTA='';
  document.getElementById('baixar-rel-overlay').style.display='flex';
  const contaOpts=CONTAS.map(c=>`<option value="${c}">${c}</option>`).join('');
  document.getElementById('baixar-rel-body').innerHTML=`
    <div style="margin-bottom:16px;color:var(--tx2);font-size:13.5px">
      Selecione o arquivo <strong>Relação de Recebimentos</strong> exportado do Domínio (XLSX).<br>
      O sistema identificará os lançamentos pendentes e apresentará uma prévia antes de confirmar.
    </div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
      <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:var(--blue);color:#fff;padding:9px 18px;border-radius:7px;font-size:13.5px;font-weight:600">
        📂 Selecionar XLSX
        <input type="file" accept=".xlsx" style="display:none" onchange="onRelChange(event)">
      </label>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;color:var(--tx2)">Conta de recebimento:</label>
        <select id="rel-conta-sel" style="padding:7px 10px;border-radius:6px;border:1px solid var(--br);background:var(--s2);color:var(--tx);font-size:13px" onchange="REL_CONTA=this.value">
          ${contaOpts}
        </select>
      </div>
    </div>
    <div id="rel-result"></div>
  `;
  // Set default conta
  const sel=document.getElementById('rel-conta-sel');
  if(sel){
    const sicoob=CONTAS.find(c=>c.toLowerCase().includes('sicoob'));
    sel.value=sicoob||CONTAS[0]||'';
    REL_CONTA=sel.value;
  }
}

function closeBaixarRelModal(){
  document.getElementById('baixar-rel-overlay').style.display='none';
  REL_MATCHED=[];REL_UNCERTAIN=[];REL_NOT_FOUND=[];
}

async function onRelChange(event){
  const file=event.target.files[0];
  if(!file)return;
  const div=document.getElementById('rel-result');
  div.innerHTML=`<div style="color:var(--tx2);padding:10px 0">⏳ Lendo arquivo...</div>`;
  try{
    await ensureXLSX();
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const entries=parseRelatorioXLSX(wb);
    if(!entries.length){
      div.innerHTML=`<div style="color:var(--red);padding:10px 0">Nenhum recebimento encontrado no arquivo. Verifique se é o arquivo correto.</div>`;
      return;
    }
    const {matched,uncertain,notFound}=matchRelatorio(entries);
    REL_MATCHED=matched;REL_UNCERTAIN=uncertain;REL_NOT_FOUND=notFound;
    renderRelPreview();
  }catch(e){
    div.innerHTML=`<div style="color:var(--red);padding:10px 0">Erro ao ler arquivo: ${e.message}</div>`;
    console.error(e);
  }
}

function _xlSerial(v){
  if(!v||isNaN(Number(v)))return null;
  return new Date(Math.round((Number(v)-25569)*86400000));
}
function _xlToISO(v){
  const d=_xlSerial(v);
  if(!d)return null;
  const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0'),dd=String(d.getUTCDate()).padStart(2,'0');
  return`${y}-${m}-${dd}`;
}
function _normName(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

// Sufixos societários comuns — não devem contribuir para similaridade de nome
const _NAME_STOPWORDS=new Set(['ltda','eireli','eirele','epp','eire','eire','me','sa','ss','sas','inc','lda','cia','co','the']);

function _nameScore(a,b){
  const na=_normName(a),nb=_normName(b);
  if(!na||!nb)return 0;
  if(na===nb)return 1;
  if(na.includes(nb)||nb.includes(na))return 0.9;
  // Filtra stopwords e palavras curtas para evitar falsos positivos por "LTDA", "ME", etc.
  const sig=w=>w.length>2&&!_NAME_STOPWORDS.has(w);
  const wa=new Set(na.split(' ').filter(sig));
  const wb2=nb.split(' ').filter(sig);
  if(!wa.size||!wb2.length)return 0;
  let hits=0;for(const w of wb2){if(wa.has(w))hits++;}
  return hits/Math.max(wa.size,wb2.length);
}

function _bestNameScore(cands,pDesc){
  return Math.max(0,...(cands||[]).map(n=>_nameScore(n,pDesc)));
}

function parseRelatorioXLSX(wb){
  // Estrutura do Domínio (colunas 1-indexed → 0-indexed para XLSX.js):
  // A(0)=código  C(2)=nome cliente  F(5)=competência  G(6)=sequencial
  // J(9)=vencimento  R(17)=data recebimento  U(20)=cód.evento  W(22)=descrição
  // AB(27)=juros  AK(36)=valor recebido
  //
  // Tipos de linha:
  //   Principal: tem A(0)=código numérico E J(9)=serial de data → salva contexto do cliente
  //   Sub-evento: tem U(20)=código numérico, sem A nem J → herda contexto do cliente atual
  //   Total/cabeçalho: demais linhas → ignoradas
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  const entries=[];
  let ctx=null; // contexto do cliente atual: {cod, name, competencia, vencimento, dataRec}

  const isNumId=v=>v&&!isNaN(Number(v))&&Number(v)>=1;
  const isDateSerial=v=>v&&!isNaN(Number(v))&&Number(v)>40000;
  const mkEntry=(ctx,desc,valorRec,juros,descontos,retencoes)=>{
    if(!ctx||!ctx.dataRec||valorRec<=0)return null;
    return{
      cod:ctx.cod, clientName:ctx.name, desc,
      nameCandidates:[ctx.name,desc].filter(Boolean),
      competencia:ctx.competencia, vencimento:ctx.vencimento,
      dataRec:ctx.dataRec, valorRec, juros, descontos, retencoes
    };
  };

  for(const r of rows){
    // ── Linha principal: tem código de cliente E vencimento ──
    if(isNumId(r[0])&&isDateSerial(r[9])){
      ctx={
        cod:Number(r[0]),
        name:String(r[2]||'').trim(),        // C(2) = nome do cliente
        competencia:_xlToISO(r[5]),
        vencimento:_xlToISO(Number(r[9])),
        dataRec:_xlToISO(r[17]),
      };
      const e=mkEntry(ctx,String(r[22]||'').trim(),Number(r[36])||0,Number(r[27])||0,Number(r[30])||0,Number(r[32])||0);
      if(e)entries.push(e);
      continue;
    }
    // ── Sub-evento: tem código de evento U(20), sem código de cliente ──
    // Herda nome/vencimento/data do contexto atual
    if(ctx&&isNumId(r[20])&&!r[0]&&!r[9]){
      const e=mkEntry(ctx,String(r[22]||'').trim(),Number(r[36])||0,Number(r[27])||0,Number(r[30])||0,Number(r[32])||0);
      if(e)entries.push(e);
    }
    // Demais linhas (totais, cabeçalhos de página): ignoradas
  }
  return entries;
}

function _scoreEntry(rel,p,looseVal){
  // REGRAS MÁXIMAS — se falhar qualquer uma: sem match
  const pVenc=effectiveVenc(p);
  const venMonthOk=!!(rel.vencimento&&pVenc&&rel.vencimento.slice(0,7)===pVenc.slice(0,7));
  if(!venMonthOk)return null; // mês de vencimento obrigatório
  // Nome deve ser idêntico (ambos vêm do Domínio — variações indicam clientes diferentes)
  const normDesc=_normName(p.desc||'');
  const nameExact=rel.nameCandidates.some(c=>_normName(c)===normDesc);
  if(!nameExact)return null;
  const ns=1;
  const venExact=rel.vencimento===pVenc;
  const pVal=openAmount(p)||titleAmount(p);
  const relBase=rel.valorRec-rel.juros;
  const diff=pVal>0?Math.abs(pVal-relBase)/pVal:1;
  // Em modo estrito (1ª passagem): ignora se valor difere >10%
  if(!looseVal&&diff>0.10)return null;
  let score=venExact?6:3; // venMonthOk já garantido acima
  score+=ns*5;
  if(pVal>0){
    if(diff<0.01)score+=3;else if(diff<0.05)score+=2;else if(diff<0.10)score+=1;
  }
  if(rel.competencia&&p.dataComp&&rel.competencia.slice(0,7)===p.dataComp.slice(0,7))score+=1;
  return{score,venMonthOk:true,ns};
}

function matchRelatorio(relEntries){
  const pending=DATA.filter(d=>d.tipo==='R'&&openAmount(d)>0.005);
  const matched=[],uncertain=[],notFound=[];
  const usedIds=new Set();
  const unmatchedRel=[]; // rel entries sem match de valor na 1ª passagem

  // ── 1ª passagem: valor próximo (≤10%) ─────────────────────────────────────
  for(const rel of relEntries){
    let best=null,bestScore=-999,bestVenExact=false;
    for(const p of pending){
      if(usedIds.has(p.id))continue;
      const r=_scoreEntry(rel,p,false);
      if(!r)continue; // mês/nome/valor falharam
      if(r.score>bestScore){bestScore=r.score;best=p;bestVenExact=(rel.vencimento===effectiveVenc(p));}
    }
    if(!best||bestScore<2){
      unmatchedRel.push(rel); // tenta na 2ª passagem
    }else if(bestScore>=8&&bestVenExact){
      usedIds.add(best.id);
      matched.push({rel,match:best,selected:true,manualSet:false});
    }else{
      usedIds.add(best.id);
      uncertain.push({rel,match:best,selected:false,manualSet:false,score:bestScore});
    }
  }

  // ── 2ª passagem: valor livre — apenas Incerto (pagamento parcial) ──────────
  for(const rel of unmatchedRel){
    let best=null,bestScore=-999;
    for(const p of pending){
      if(usedIds.has(p.id))continue;
      const r=_scoreEntry(rel,p,true);
      if(!r)continue;
      if(r.score>bestScore){bestScore=r.score;best=p;}
    }
    if(!best||bestScore<2){
      notFound.push({rel,match:null,selected:false,manualSet:false});
    }else{
      // Pagamento parcial → sempre Incerto, nunca Identificado
      usedIds.add(best.id);
      uncertain.push({rel,match:best,selected:false,manualSet:false,score:bestScore,isPartial:true});
    }
  }

  return{matched,uncertain,notFound};
}

function _relJurosCat(){
  const cats=(CATS_DATA&&CATS_DATA.R)||[];
  for(const c of cats){
    const n=_normName(c.nome);
    if(n.includes('financeira')||n.includes('juros')){
      const sub=(c.subs||[]).find(s=>{const sn=_normName(s.nome);return sn.includes('juros')||sn.includes('multa');});
      return{cat:c.nome,sub:sub?sub.nome:'Juros e Multas por Atrasos'};
    }
  }
  return{cat:'Receitas Financeiras',sub:'Juros e Multas por Atrasos'};
}

// ── SELECAO MANUAL ──────────────────────────────────────────────────────────
let REL_MANUAL_OPEN=null;

function relOpenManual(type,idx){
  if(REL_MANUAL_OPEN&&REL_MANUAL_OPEN.type===type&&REL_MANUAL_OPEN.idx===idx){
    REL_MANUAL_OPEN=null;
  }else{
    REL_MANUAL_OPEN={type,idx,filter:''};
  }
  renderRelPreview();
}

function relManualFilter(val){
  if(REL_MANUAL_OPEN)REL_MANUAL_OPEN.filter=val;
  const scroll=document.getElementById('rel-tbl-scroll');
  const st=scroll?scroll.scrollTop:0;
  renderRelPreview();
  // Devolve foco e cursor ao input após re-render
  const inp=document.querySelector('#rel-tbl-scroll input[placeholder="Buscar por nome..."]');
  if(inp){inp.focus();const l=val.length;inp.setSelectionRange(l,l);}
  if(scroll)scroll.scrollTop=st;
}

function relSetManual(pendingId){
  if(!REL_MANUAL_OPEN)return;
  const{type,idx}=REL_MANUAL_OPEN;
  const lists={matched:REL_MATCHED,uncertain:REL_UNCERTAIN,notfound:REL_NOT_FOUND};
  const item=lists[type]?.[idx];
  if(!item)return;
  const p=DATA.find(d=>d.id===pendingId);
  if(!p)return;
  item.match=p;item.selected=true;item.manualSet=true;
  if(type==='notfound'){REL_NOT_FOUND.splice(idx,1);REL_UNCERTAIN.push(item);}
  REL_MANUAL_OPEN=null;
  renderRelPreview();
}

function relClearManual(type,idx){
  const lists={matched:REL_MATCHED,uncertain:REL_UNCERTAIN};
  const item=lists[type]?.[idx];
  if(item){item.manualSet=false;item.selected=false;item.match=null;}
  renderRelPreview();
}

function _relManualPanel(type,idx){
  const usedIds=new Set([
    ...REL_MATCHED.map((r,i)=>(type==='matched'&&i===idx)?null:r.match?.id),
    ...REL_UNCERTAIN.map((r,i)=>(type==='uncertain'&&i===idx)?null:r.match?.id),
  ].filter(Boolean));
  const filter=_normName(REL_MANUAL_OPEN?.filter||'');
  const fmtD=iso=>iso?iso.split('-').reverse().join('/'):'?';
  const pending=DATA.filter(d=>d.tipo==='R'&&openAmount(d)>0.005&&!usedIds.has(d.id));
  const filtered=filter?pending.filter(p=>_normName(p.desc||'').includes(filter)||effectiveVenc(p).includes(REL_MANUAL_OPEN?.filter||'')):pending;
  const rows=filtered.slice(0,40).map(p=>`
    <div onclick="relSetManual('${p.id}')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--br);display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center" onmouseenter="this.style.background='var(--s3)'" onmouseleave="this.style.background=''">
      <div>
        <div style="font-size:12.5px;font-weight:600;color:var(--tx)">${p.desc||'?'}</div>
        <div style="font-size:11px;color:var(--tx2)">Venc: ${fmtD(effectiveVenc(p))} | Comp: ${(p.dataComp||'').slice(0,7)} | ${p.cat||''}${p.sub?` > ${p.sub}`:''}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--teal);white-space:nowrap">${fmt(openAmount(p))}</div>
    </div>`).join('');
  return`<div style="margin-top:6px;border:1px solid var(--blue);border-radius:7px;overflow:hidden">
    <div style="background:color-mix(in srgb,var(--blue) 12%,transparent);padding:7px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:700;color:var(--blue)">Selecionar lancamento</span>
      <input type="text" placeholder="Buscar por nome..." value="${REL_MANUAL_OPEN?.filter||''}" oninput="relManualFilter(this.value)" style="flex:1;padding:4px 8px;border-radius:5px;border:1px solid var(--br);background:var(--s2);color:var(--tx);font-size:12px">
      <button onclick="relOpenManual('${type}',${idx})" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:16px;line-height:1">&times;</button>
    </div>
    <div style="max-height:200px;overflow-y:auto;background:var(--s2)">
      ${rows||'<div style="padding:10px;color:var(--tx3);font-size:12px">Nenhum lancamento pendente encontrado</div>'}
      ${filtered.length>40?`<div style="padding:7px 10px;font-size:11px;color:var(--tx3)">...e mais ${filtered.length-40}. Refine a busca.</div>`:''}
    </div>
  </div>`;
}

// ── RENDER ──────────────────────────────────────────────────────────────────
function relScrollTo(secId){
  const el=document.getElementById(secId);
  const sc=document.getElementById('rel-tbl-scroll');
  if(el&&sc)sc.scrollTop=Math.max(0,el.offsetTop-sc.offsetTop-4);
}

function renderRelPreview(){
  const sc=document.getElementById('rel-tbl-scroll');
  const savedScroll=sc?sc.scrollTop:0;
  const selAll=[...REL_MATCHED,...REL_UNCERTAIN,...REL_NOT_FOUND].filter(r=>r.selected);
  const selCount=selAll.length;
  const totalVal=selAll.reduce((s,r)=>s+r.rel.valorRec,0);
  const totalJuros=selAll.reduce((s,r)=>s+r.rel.juros,0);
  const fmtD=iso=>iso?iso.split('-').reverse().join('/'):'?';

  const mkRows=(list,type)=>list.map((item,i)=>{
    const{rel,match,selected,manualSet}=item;
    const matchVenc=match?effectiveVenc(match):'';
    const venMismatch=match&&rel.vencimento&&matchVenc&&rel.vencimento.slice(0,7)!==matchVenc.slice(0,7);
    const pVal=match?openAmount(match):0;const relBase=rel.valorRec-rel.juros;
    const valMismatch=match&&pVal>0&&Math.abs(pVal-relBase)/pVal>0.05;
    // Pagamento parcial: cliente pagou menos que o lançamento
    const isPartial=match&&pVal>0&&relBase>0&&relBase<pVal*0.95;
    const restante=isPartial?pVal-relBase:0;
    const jurosTag=rel.juros>0?`<span style="font-size:10px;background:color-mix(in srgb,var(--orange) 18%,transparent);color:var(--orange);padding:1px 6px;border-radius:10px;margin-left:5px">+${fmt(rel.juros)} juros</span>`:'';
    const descLine=rel.desc&&rel.desc!==rel.clientName?`<div style="font-size:11.5px;color:var(--tx2);margin-top:1px">${rel.desc}</div>`:'';
    const partialNote=isPartial?`<div style="margin-top:4px;padding:4px 8px;border-radius:4px;background:color-mix(in srgb,var(--orange) 12%,transparent);font-size:11px;color:var(--orange)">
      Pagamento parcial: <b>${fmt(relBase)}</b> recebido de <b>${fmt(pVal)}</b> em aberto
    </div>`:'';
    const relBlock=`<div style="border-radius:5px;padding:5px 8px;margin-bottom:3px;background:color-mix(in srgb,var(--blue) 7%,transparent);border-left:2px solid var(--blue)">
      <div style="font-size:9.5px;font-weight:700;color:var(--blue);letter-spacing:.4px;margin-bottom:2px">RELATORIO DOMINIO</div>
      <div style="font-size:12.5px;font-weight:600;color:var(--tx)">${rel.clientName||'(sem nome)'}</div>
      ${descLine}
      <div style="font-size:11px;color:var(--tx2);margin-top:2px">Comp: <b>${rel.competencia?rel.competencia.slice(0,7):'?'}</b> | Venc: <b style="${venMismatch?'color:var(--red)':''}">${fmtD(rel.vencimento)}</b> | Rec: <b>${fmtD(rel.dataRec)}</b> | <b style="${valMismatch?'color:var(--orange)':''}">${fmt(rel.valorRec)}</b>${jurosTag}</div>
      ${partialNote}
    </div>`;
    const sysBlock=match?`<div style="border-radius:5px;padding:5px 8px;background:color-mix(in srgb,var(--teal) 7%,transparent);border-left:2px solid var(--teal)">
      <div style="font-size:9.5px;font-weight:700;color:var(--teal);letter-spacing:.4px;margin-bottom:2px">LANCAMENTO NO SISTEMA</div>
      <div style="font-size:12.5px;color:var(--tx)">${match.desc||'?'}</div>
      <div style="font-size:11px;color:var(--tx2);margin-top:1px">Comp: <b>${(match.dataComp||'').slice(0,7)||'?'}</b> | Venc: <b style="${venMismatch?'color:var(--red)':''}">${fmtD(matchVenc)}</b> | Aberto: <b style="${valMismatch?'color:var(--orange)':''}">${fmt(openAmount(match))}</b> | ${match.cat||''}${match.sub?` > ${match.sub}`:''}</div>
    </div>`
    :`<div style="border-radius:5px;padding:5px 8px;background:color-mix(in srgb,var(--red) 7%,transparent);border-left:2px solid var(--red)">
      <div style="font-size:9.5px;font-weight:700;color:var(--red);margin-bottom:2px">SISTEMA</div>
      <div style="font-size:12px;color:var(--tx3)">Nenhum lancamento encontrado automaticamente</div>
    </div>`;
    const manualOpen=REL_MANUAL_OPEN&&REL_MANUAL_OPEN.type===type&&REL_MANUAL_OPEN.idx===i;
    const manualPanel=manualOpen?_relManualPanel(type,i):'';
    const manualBtn=manualSet
      ?`<button onclick="relClearManual('${type}',${i})" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid var(--red);background:none;color:var(--red);cursor:pointer;margin-top:4px;display:block">x Remover selecao</button>`
      :`<button onclick="relOpenManual('${type}',${i})" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid var(--blue);background:none;color:var(--blue);cursor:pointer;margin-top:4px;display:block">${manualOpen?'Fechar':'Selecionar lancamento'}</button>`;
    const canCheck=type!=='notfound'||manualSet;
    const chkCell=canCheck
      ?`<td style="padding:8px 6px;text-align:center;vertical-align:top;padding-top:14px"><input type="checkbox" ${selected?'checked':''} onchange="relToggle('${type}',${i},this.checked)"></td>`
      :`<td style="padding:8px 6px;text-align:center;vertical-align:top;padding-top:14px;color:var(--tx3)">-</td>`;
    const badge=manualSet
      ?`<span style="font-size:10px;background:color-mix(in srgb,var(--blue) 15%,transparent);color:var(--blue);padding:1px 7px;border-radius:10px;display:inline-block;margin-bottom:4px">selecao manual</span><br>`
      :type==='uncertain'&&item.isPartial
        ?`<span style="font-size:10px;background:color-mix(in srgb,var(--orange) 15%,transparent);color:var(--orange);padding:1px 7px;border-radius:10px;display:inline-block;margin-bottom:4px">pag. parcial?</span><br>`
        :type==='uncertain'
          ?`<span style="font-size:10px;background:color-mix(in srgb,var(--orange) 15%,transparent);color:var(--orange);padding:1px 7px;border-radius:10px;display:inline-block;margin-bottom:4px">incerto</span><br>`
          :'';
    return`<tr style="border-bottom:1px solid var(--br);${selected?'background:color-mix(in srgb,var(--blue) 5%,transparent)':''}">
      ${chkCell}
      <td style="padding:8px 8px 8px 4px">${badge}${relBlock}${sysBlock}${manualBtn}${manualPanel}</td>
    </tr>`;
  }).join('');

  const section=(list,type,secId,label,color)=>!list.length?'':
    `<tr id="${secId}"><td colspan="2" style="padding:6px 10px;font-size:11px;font-weight:700;color:${color};background:color-mix(in srgb,${color} 10%,transparent)">${label} (${list.length})</td></tr>${mkRows(list,type)}`;

  const total=REL_MATCHED.length+REL_UNCERTAIN.length+REL_NOT_FOUND.length;
  document.getElementById('rel-result').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div onclick="relScrollTo('rel-sec-matched')" style="background:var(--s2);border-radius:8px;padding:11px 14px;cursor:pointer;border:1px solid transparent;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--teal)'" onmouseleave="this.style.borderColor='transparent'">
        <div style="font-size:11px;color:var(--tx3)">Identificados</div>
        <div style="font-weight:700;font-size:20px;color:var(--teal)">${REL_MATCHED.length}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:2px">clique para ir</div>
      </div>
      <div onclick="relScrollTo('rel-sec-uncertain')" style="background:var(--s2);border-radius:8px;padding:11px 14px;cursor:pointer;border:1px solid transparent;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--orange)'" onmouseleave="this.style.borderColor='transparent'">
        <div style="font-size:11px;color:var(--tx3)">Incertos</div>
        <div style="font-weight:700;font-size:20px;color:var(--orange)">${REL_UNCERTAIN.length}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:2px">clique para ir</div>
      </div>
      <div onclick="relScrollTo('rel-sec-notfound')" style="background:var(--s2);border-radius:8px;padding:11px 14px;cursor:pointer;border:1px solid transparent;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--red)'" onmouseleave="this.style.borderColor='transparent'">
        <div style="font-size:11px;color:var(--tx3)">Nao encontrados</div>
        <div style="font-weight:700;font-size:20px;color:var(--red)">${REL_NOT_FOUND.length}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:2px">clique para ir</div>
      </div>
    </div>
    ${total===0?`<div style="color:var(--tx2);padding:20px 0">Nenhum recebimento relacionado a lancamentos pendentes.</div>`:`
    <div id="rel-tbl-scroll" style="max-height:420px;overflow-y:auto;border:1px solid var(--br);border-radius:8px;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse">
        <thead style="position:sticky;top:0;background:var(--s3);z-index:2">
          <tr>
            <th style="padding:8px;text-align:center;font-size:12px;color:var(--tx3);width:36px">sel</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:var(--tx3)">Recebimento</th>
          </tr>
        </thead>
        <tbody>
          ${section(REL_MATCHED,'matched','rel-sec-matched','IDENTIFICADOS','var(--teal)')}
          ${section(REL_UNCERTAIN,'uncertain','rel-sec-uncertain','INCERTOS','var(--orange)')}
          ${section(REL_NOT_FOUND,'notfound','rel-sec-notfound','NAO ENCONTRADOS','var(--red)')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="font-size:13px;color:var(--tx2)">
        <strong>${selCount}</strong> selecionado(s) | Valor: <strong style="color:var(--teal)">${fmt(totalVal)}</strong>${totalJuros>0?` | Juros: <strong style="color:var(--orange)">${fmt(totalJuros)}</strong>`:''}
      </div>
      <button class="btn btn-pri" id="rel-confirm-btn" onclick="confirmarBaixarRel()" ${selCount===0?'disabled':''}>
        Baixar ${selCount} recebimento(s)
      </button>
    </div>
    `}
  `;
  const scNew=document.getElementById('rel-tbl-scroll');
  if(scNew)scNew.scrollTop=savedScroll;
}

function relToggle(type,idx,checked){
  const lists={matched:REL_MATCHED,uncertain:REL_UNCERTAIN,notfound:REL_NOT_FOUND};
  if(lists[type]?.[idx])lists[type][idx].selected=checked;
  renderRelPreview();
}

async function confirmarBaixarRel(){
  const toProcess=[...REL_MATCHED,...REL_UNCERTAIN,...REL_NOT_FOUND].filter(r=>r.selected&&r.match);
  if(!toProcess.length)return;
  const btn=document.getElementById('rel-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Processando...';}
  // Barra de progresso
  const progWrap=document.createElement('div');
  progWrap.id='rel-progress-wrap';
  progWrap.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--s2);border-top:1px solid var(--br);padding:10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 -2px 12px #0004';
  progWrap.innerHTML=`
    <span id="rel-prog-txt" style="font-size:12px;color:var(--tx2);white-space:nowrap">0 / ${toProcess.length}</span>
    <div style="flex:1;height:8px;background:var(--br);border-radius:4px;overflow:hidden">
      <div id="rel-prog-bar" style="height:100%;width:0%;background:var(--blue);border-radius:4px;transition:width 0.15s ease"></div>
    </div>
    <span id="rel-prog-pct" style="font-size:12px;color:var(--blue);font-weight:700;min-width:36px;text-align:right">0%</span>`;
  document.body.appendChild(progWrap);
  const updateProg=(done)=>{
    const pct=Math.round(done/toProcess.length*100);
    const bar=document.getElementById('rel-prog-bar');
    const txt=document.getElementById('rel-prog-txt');
    const pctEl=document.getElementById('rel-prog-pct');
    if(bar)bar.style.width=pct+'%';
    if(txt)txt.textContent=`${done} / ${toProcess.length}`;
    if(pctEl)pctEl.textContent=pct+'%';
  };
  const conta=REL_CONTA||CONTAS[0]||'Caixa';
  const{cat:jCat,sub:jSub}=_relJurosCat();
  let ok=0,err=0;
  for(const item of toProcess){
    const{rel,match}=item;
    try{
      const valorBase=rel.valorRec-rel.juros;
      const saldo=openAmount(match);
      if(valorBase<=0)throw new Error('Valor recebido invalido.');
      if(valorBase>saldo+0.01)throw new Error(`Valor recebido (${fmt(valorBase)}) excede o saldo em aberto (${fmt(saldo)}).`);
      // Vinculação retroativa ao cliente (item #51)
      let cliVinc=null;
      if(!match.clienteId&&rel.cod){
        cliVinc=_matchClienteByCodigo(rel.cod);
        if(cliVinc){
          try{
            await sbFetch('PATCH',`lancamentos?id=eq.${match.id}`,{cliente_id:cliVinc.id});
            match.clienteId=cliVinc.id;
            const inData=DATA.find(d=>d.id===match.id);
            if(inData)inData.clienteId=cliVinc.id;
          }catch(e){
            console.warn('Falha ao vincular cliente ao lançamento',match.id,rel.cod,e);
            cliVinc=null;
          }
        }
      }
      await registerBaixa(match,{valor:valorBase,dataPgto:rel.dataRec,conta,forma:match.forma||'PIX',origem:'importacao',obs:`Relatorio Dominio - ${rel.clientName||match.desc||''}`});
      if(rel.juros>0){
        const jAdj={
          id:newId(),tipo:'R',parentId:match.id,adjType:'juros',
          dataComp:rel.dataRec.slice(0,7)+'-01',
          dataVenc:rel.vencimento||rel.dataRec,dataPgto:rel.dataRec,
          desc:`${match.desc||rel.clientName} - Juros/Multa`,
          cat:jCat,sub:jSub,
          cc:match.cc||'',clienteId:match.clienteId||'',
          forma:match.forma||'PIX',conta,doc:match.doc||'',
          valorBruto:rel.juros,ded:0,valorLiq:rel.juros,
          status:'Recebido',
          obs:`Ref.: ${match.desc||rel.clientName} - venc. ${rel.vencimento||''}`
        };
        const savedAdj=await dbInsert(jAdj);
        DATA.unshift(savedAdj?fromRow(savedAdj):{...jAdj});
      }
      ok++;
    }catch(e){err++;console.error('Erro ao baixar:',e);}
    updateProg(ok+err);
  }
  progWrap.remove();
  setSyncStatus('ok',`${DATA.length} registros`);
  render();
  toast(`${ok} recebimento(s) baixado(s)${err?`, ${err} erro(s)`:''}`,ok>0?'ok':'err');
  closeBaixarRelModal();
}

// ─── PERFIL E CONFIGURAÇÕES (#41) ─────────────────────────────────────────

function toggleProfileDropdown(e){
  e.stopPropagation();
  const dd=document.getElementById('pf-options');
  if(!dd)return;
  const isOpen=dd.classList.contains('open');
  dd.classList.toggle('open',!isOpen);
  document.getElementById('pf-chevron')?.classList.toggle('open',!isOpen);
}

function openSettingsModal(){
  document.getElementById('pf-options')?.classList.remove('open');
  document.getElementById('pf-chevron')?.classList.remove('open');
  const u=_getUserData();
  document.getElementById('cfg-name').value=u.name||'';
  document.getElementById('cfg-email').value=u.email||'';
  document.getElementById('cfg-pass-cur').value='';
  document.getElementById('cfg-pass-new').value='';
  document.getElementById('cfg-pass-conf').value='';
  document.getElementById('cfg-pass-err').style.display='none';
  document.getElementById('settings-overlay').style.display='flex';
}

function closeSettingsModal(){
  document.getElementById('settings-overlay').style.display='none';
}

function checkPassMatch(){
  const np=document.getElementById('cfg-pass-new').value;
  const cp=document.getElementById('cfg-pass-conf').value;
  const err=document.getElementById('cfg-pass-err');
  if(cp&&np!==cp){err.textContent='As senhas não coincidem.';err.style.display='block';}
  else{err.style.display='none';}
}

async function saveProfile(){
  const name=document.getElementById('cfg-name').value.trim();
  const email=document.getElementById('cfg-email').value.trim();
  if(!email){toast('E-mail obrigatório.','err');return;}
  try{
    const token=localStorage.getItem('sb_token');
    const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      method:'PUT',
      headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({email,data:{full_name:name}})
    });
    if(!res.ok){const e=await res.json();throw new Error(e.message||'Erro ao salvar.');}
    const u=await res.json();
    localStorage.setItem('sb_user',JSON.stringify({email:u.email||email,name:u.user_metadata?.full_name||name,role:u.user_metadata?.role||u.user_metadata?.cargo||''}));
    renderProfileArea();
    toast('Perfil atualizado!','ok');
  }catch(e){toast(e.message,'err');}
}

async function changePassword(){
  const cur=document.getElementById('cfg-pass-cur').value;
  const np=document.getElementById('cfg-pass-new').value;
  const cp=document.getElementById('cfg-pass-conf').value;
  const err=document.getElementById('cfg-pass-err');
  if(!cur){toast('Informe a senha atual.','err');return;}
  if(!np){toast('Informe a nova senha.','err');return;}
  if(np!==cp){err.textContent='As senhas não coincidem.';err.style.display='block';return;}
  err.style.display='none';
  const u=_getUserData();
  try{
    const check=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email:u.email,password:cur})
    });
    if(!check.ok)throw new Error('Senha atual incorreta.');
  }catch(e){toast(e.message,'err');return;}
  try{
    const token=localStorage.getItem('sb_token');
    const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      method:'PUT',
      headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({password:np})
    });
    if(!res.ok){const e=await res.json();throw new Error(e.message||'Erro ao alterar senha.');}
    document.getElementById('cfg-pass-cur').value='';
    document.getElementById('cfg-pass-new').value='';
    document.getElementById('cfg-pass-conf').value='';
    toast('Senha alterada com sucesso!','ok');
  }catch(e){toast(e.message,'err');}
}
