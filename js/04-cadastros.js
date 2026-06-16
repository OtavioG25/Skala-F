let formData={};
let _saveAndNew=false;
async function saveFormAndNew(){_saveAndNew=true;await saveForm();}
function openForm(id=null){
  editingId=id;
  const l=id?DATA.find(x=>x.id===id):null;
  if(l&&isTransfer(l)){
    toast('Transferencias devem ser ajustadas pelo lancamento pareado. Exclua e recrie a transferencia se precisar corrigir.','err');
    return;
  }
  if(l){
    formData={...l};
    formData.conta=normalizeConta(formData.conta);
    formData.dataCompView = compToView(l.dataComp || l.dataCompView || '');
    const bruto=parseMoney(formData.valorBruto);
    const ded=parseMoney(formData.ded);
    const liq=parseMoney(formData.valorLiq);
    if(!bruto&&liq)formData.valorBruto=liq;
    if(!liq&&bruto)formData.valorLiq=Math.max(0,bruto-ded);
    const adjChld=DATA.filter(x=>x.parentId===id);
    const adjJ=adjChld.find(x=>x.adjType==='juros'),adjM=adjChld.find(x=>x.adjType==='multa'),adjD=adjChld.find(x=>x.adjType==='desconto');
    const _jm=(adjJ?.valorLiq||0)+(adjM?.valorLiq||0);
    formData.valorJuros=_jm>0?fmtMoneyInput(_jm):'';
    formData.valorMulta='';
    formData.valorDesconto=adjD?.valorLiq>0?fmtMoneyInput(adjD.valorLiq):'';
  } else {
    const _now=new Date();
    const _compDefault=String(_now.getMonth()+1).padStart(2,'0')+'/'+_now.getFullYear();
    const _lastConta=localStorage.getItem('skala_last_conta')||'Dominio Conta Digital';
    formData={id:newId(),tipo:'R',dataComp:'',dataCompView:_compDefault,dataVenc:'',dataPgto:'',cat:'',sub:'',desc:'',cc:'',clienteId:'',forma:'PIX',conta:_lastConta,doc:'',valorBruto:'',ded:'',valorLiq:'',valorJuros:'',valorMulta:'',valorDesconto:'',status:'Pendente',obs:''};
  }
  document.getElementById('modal-ttl').textContent=id?(formData.tipo==='R'?'Editar Recebimento':'Editar Despesa'):'Novo Lançamento';
  const seqEl=document.getElementById('modal-seq');if(seqEl){const s=l?.seq;seqEl.textContent=s?`#${s}`:'';seqEl.style.display=s?'inline-block':'none';}
  const _mEl=document.querySelector('.modal-lancamento');if(_mEl){_mEl.classList.remove('modal-tipo-r','modal-tipo-d');_mEl.classList.add(formData.tipo==='R'?'modal-tipo-r':'modal-tipo-d');}
  const _hdrEl=document.querySelector('.modal-lancamento .modal-hdr');if(_hdrEl)_hdrEl.style.background=formData.tipo==='R'?'rgba(19,124,60,.06)':'rgba(217,74,56,.06)';
  buildTipoSwitch();
  buildDraftBanner();
  buildForm();
  document.getElementById('overlay').style.display='flex';
  setTimeout(()=>document.getElementById('f-comp')?.focus(),60);
}
function openEdit(id){openForm(id);}

function _isDraftWorthy(){
  if(editingId)return false;
  return !!(formData.dataVenc||formData.dataPgto||formData.cat||formData.desc||
    parseMoney(formData.valorBruto)||parseMoney(formData.ded)||parseMoney(formData.valorLiq)||
    formData.doc||formData.obs||parseMoney(formData.valorJuros)||parseMoney(formData.valorMulta)||parseMoney(formData.valorDesconto));
}

function closeForm(clearDraft=false){
  if(clearDraft){
    localStorage.removeItem('skala_draft_lancamento');
  } else if(_isDraftWorthy()){
    localStorage.setItem('skala_draft_lancamento',JSON.stringify(formData));
  }
  document.getElementById('overlay').style.display='none';
}

function buildDraftBanner(){
  const el=document.getElementById('draft-banner');
  if(!el)return;
  const hasDraft=!editingId&&!!localStorage.getItem('skala_draft_lancamento');
  if(hasDraft){
    el.style.display='flex';
    el.innerHTML=`<span style="flex:1;font-size:12.5px;color:var(--tx2)">Você tem um lançamento não salvo.</span><button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="restoreDraft()">Continuar de onde parei</button><button class="btn btn-ghost" style="font-size:12px;padding:4px 10px;color:var(--red);border-color:rgba(217,74,56,.25)" onclick="discardDraft()">Descartar</button>`;
  } else {
    el.style.display='none';
  }
}

function restoreDraft(){
  try{
    const draft=JSON.parse(localStorage.getItem('skala_draft_lancamento'));
    if(draft){formData={...draft,id:newId()};buildTipoSwitch();buildForm();}
  }catch(e){}
  const el=document.getElementById('draft-banner');
  if(el)el.style.display='none';
}

function discardDraft(){
  localStorage.removeItem('skala_draft_lancamento');
  const el=document.getElementById('draft-banner');
  if(el)el.style.display='none';
}

function renderContas(c){
  const closed=getClosedPeriods();
  const months=MONTHS.map((m,i)=>`${YEAR}-${String(i+1).padStart(2,'0')}`);
  c.innerHTML=`
    <div class="card" style="padding:18px 20px">
      <div class="card-ttl">Contas Bancárias</div>
      <div style="margin-top:12px;display:grid;gap:10px" id="accounts-list">
        ${CONTAS_DATA.map((conta,idx)=>`
          <div id="conta-row-${conta.id}" draggable="true"
            ondragstart="onContaDragStart(event,${conta.id})"
            ondragover="onContaDragOver(event,${conta.id})"
            ondragleave="onContaDragLeave(event,${conta.id})"
            ondrop="onContaDrop(event,${conta.id})"
            ondragend="onContaDragEnd()"
            style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--bd);border-radius:12px;background:var(--s2);cursor:grab;transition:opacity .15s">
            <span style="color:var(--tx3);font-size:14px;margin-right:2px;cursor:grab">?</span>
            <span style="min-width:160px;font-weight:500">${esc(conta.nome)}</span>
            <span style="font-size:12px;color:var(--tx2);white-space:nowrap">Saldo inicial (R$)</span>
            <input type="text" id="si-${idx}" value="${conta.saldo_inicial?String(conta.saldo_inicial).replace('.',','):''}" placeholder="0,00" style="width:110px;background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:5px 8px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')salvarSaldoIni(${conta.id},this.value)"/>
            <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" title="Salvar saldo inicial" onclick="salvarSaldoIni(${conta.id},document.getElementById('si-${idx}').value)">${appIcon('file')}</button>
            <select onchange="salvarTipoConta(${conta.id},this.value)" style="background:var(--s1);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:5px 8px;font-size:12px;outline:none">
              <option value="corrente" ${(conta.tipo||'corrente')==='corrente'?'selected':''}>Corrente</option>
              <option value="investimento" ${conta.tipo==='investimento'?'selected':''}>Investimento</option>
            </select>
            <button class="btn" style="padding:4px 8px;font-size:12px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2);margin-left:auto" onclick="removerConta(${conta.id})">Remover</button>
          </div>`).join('')}
      </div>
      <button class="btn btn-pri" style="margin-top:16px" onclick="adicionarConta()">${appIcon('plus')}Nova Conta</button>
    </div>
    <div class="card" style="padding:18px 20px">
      <div class="card-ttl">${appIcon('lock')}Fechamento mensal <span class="yr-pill">${YEAR}</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:8px">
        ${months.map((p,i)=>`<button class="btn ${closed.has(p)?'btn-pri':'btn-ghost'}" style="justify-content:center;font-size:12px" onclick="toggleClosedPeriod('${p}')" title="${closed.has(p)?'Mes fechado - clique para reabrir':'Mes aberto - clique para fechar'}">${MONTHS[i]}</button>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--tx2)">Meses fechados bloqueiam criacao, edicao, baixa e exclusao de lancamentos naquela competencia ou data de pagamento.</div>
    </div>
  `;
}

let _dragConta=null;
function onContaDragStart(e,id){_dragConta=id;e.currentTarget.style.opacity='0.4';e.dataTransfer.effectAllowed='move';}
function onContaDragOver(e,id){e.preventDefault();if(_dragConta&&_dragConta!==id)document.getElementById('conta-row-'+id)?.style.setProperty('border-color','var(--teal)');}
function onContaDragLeave(e,id){document.getElementById('conta-row-'+id)?.style.setProperty('border-color','var(--bd)');}
function onContaDragEnd(){document.querySelectorAll('[id^="conta-row-"]').forEach(el=>{el.style.opacity='';el.style.borderColor='';});}
async function onContaDrop(e,targetId){
  e.preventDefault();
  onContaDragEnd();
  if(!_dragConta||_dragConta===targetId){_dragConta=null;return;}
  const fromIdx=CONTAS_DATA.findIndex(c=>c.id===_dragConta);
  const toIdx=CONTAS_DATA.findIndex(c=>c.id===targetId);
  if(fromIdx<0||toIdx<0){_dragConta=null;return;}
  const [moved]=CONTAS_DATA.splice(fromIdx,1);
  CONTAS_DATA.splice(toIdx,0,moved);
  CONTAS_DATA.forEach((c,i)=>c.ordem=i);
  _dragConta=null;
  renderContas(document.getElementById('content'));
  try{
    await Promise.all(CONTAS_DATA.map(c=>sbFetch('PATCH',`contas?id=eq.${c.id}`,{ordem:c.ordem})));
    toast('Ordem salva!','ok');
  }catch(err){toast('Erro ao salvar ordem','err');}
}

async function adicionarConta(){
  const nome=prompt('Nome da nova conta bancária:');
  if(!nome||!nome.trim())return;
  const n=nome.trim()==='Conta Corrente'?'Caixa':nome.trim();
  if(CONTAS.includes(n)){toast('Conta já existe!','err');return;}
  try{
    await sbFetch('POST','contas',{nome:n,saldo_inicial:0,ordem:CONTAS_DATA.length});
    await loadContasFromDB();
    render();toast(`Conta "${n}" adicionada!`,'ok');
  }catch(e){toast('Erro ao adicionar conta: '+e.message,'err');}
}

async function removerConta(id){
  const conta=CONTAS_DATA.find(c=>c.id===id);
  if(!conta)return;
  if(conta.nome==='Caixa'){toast('A conta Caixa é padrão e não pode ser removida.','err');return;}
  if(DATA.some(l=>l.conta===conta.nome)){toast(`A conta "${conta.nome}" possui lancamentos vinculados. Reclassifique antes de remover.`,'err');return;}
  if(DATA.some(l=>(l.obs||'').includes(`TRANSF_DEST:${conta.nome}`)||(l.obs||'').includes(`TRANSF_ORIG:${conta.nome}`))){toast(`A conta "${conta.nome}" possui transferencias vinculadas.`,'err');return;}
  if(parseMoney(conta.saldo_inicial)!==0&&!await openConfirmModal(`A conta "${conta.nome}" tem saldo inicial diferente de zero. Remover mesmo assim?`,{danger:true,confirmLabel:'Remover mesmo assim'}))return;
  if(!await openConfirmModal(`Remover conta "${conta.nome}"?`,{danger:true,confirmLabel:'Remover'}))return;
  try{
    await sbFetch('DELETE',`contas?id=eq.${id}`);
    await loadContasFromDB();
    render();toast(`Conta "${conta.nome}" removida.`);
  }catch(e){toast('Erro ao remover conta: '+e.message,'err');}
}

async function deleteBaixaRow(baixaId){
  const b=BAIXAS_DATA.find(x=>x.id===baixaId);
  if(!b||!await openConfirmModal('Remover este pagamento registrado?',{danger:true,confirmLabel:'Remover'}))return;
  setSyncStatus('loading','Removendo...');
  try{
    await dbDeleteBaixa(baixaId);
    BAIXAS_DATA=BAIXAS_DATA.filter(x=>x.id!==baixaId);
    _invalidateBaixasCache();
    const item=DATA.find(x=>x.id===b.lancamentoId);
    if(item){item.status=computedStatus(item);item.dataPgto=paidAmount(item)>0?latestBaixaDate(item):'';await dbUpdate(item);}
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();buildForm();
    toast('Pagamento removido.','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}
function renderBaixasSection(lancamentoId){
  if(!lancamentoId)return'';
  const l=DATA.find(x=>x.id===lancamentoId);
  if(!l)return'';
  const baixas=getBaixas(lancamentoId).map(b=>({...b,_juros:false}));
  // Inclui baixas dos filhos de juros/multa
  const jurosFilhos=DATA.filter(x=>x.parentId===lancamentoId&&(x.adjType==='juros'||x.adjType==='multa'));
  const jurosBaixas=jurosFilhos.flatMap(jf=>getBaixas(jf.id).map(b=>({...b,_juros:true})));
  // Inclui filhos de juros com pagamento legacy (sem baixa formal mas já recebidos)
  const jurosLegacy=jurosFilhos.filter(jf=>!getBaixas(jf.id).length&&paidAmount(jf)>0&&jf.dataPgto).map(jf=>({
    id:`leg-${jf.id}`,dataPgto:jf.dataPgto,conta:jf.conta,forma:jf.forma,valor:titleAmount(jf),_juros:true,_legacy:true
  }));
  const allBaixas=[...baixas,...jurosBaixas,...jurosLegacy].sort((a,b)=>(a.dataPgto||'').localeCompare(b.dataPgto||''));
  if(!allBaixas.length)return'';
  const label=l.tipo==='R'?'Recebimentos':'Pagamentos';
  const total=allBaixas.reduce((s,b)=>s+parseMoney(b.valor),0);
  const cor=l.tipo==='R'?'var(--teal)':'var(--red)';
  return`<div style="grid-column:span 2;border:1px solid var(--bd);border-radius:10px;background:var(--s2);padding:10px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:var(--tx)">${label} <span style="color:var(--tx3);font-weight:500">(${fmt(total)})</span></div>
      ${openAmount(l)>0.005?`<button type="button" class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="openBaixaModal('${l.id}')">${appIcon('wallet')}${l.tipo==='R'?'Receber':'Pagar'}</button>`:''}
    </div>
    <div style="display:grid;gap:5px">
      ${allBaixas.map(b=>`<div style="display:grid;grid-template-columns:86px 1fr 86px 94px 28px;gap:8px;align-items:center;font-size:12px;color:var(--tx2)">
        <span>${dateBR(b.dataPgto)||'-'}</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.conta||'-')}${b._juros?`<span style="margin-left:4px;font-size:10px;background:rgba(224,184,13,.18);color:#a07800;border-radius:4px;padding:1px 5px">Juros</span>`:''}</span>
        <span>${esc(b.forma||'-')}</span>
        <strong style="text-align:right;color:${cor}">${fmt(b.valor)}</strong>
        ${!b._legacy?`<button type="button" title="Remover pagamento" onclick="deleteBaixaRow('${b.id}')" style="background:none;border:none;cursor:pointer;color:var(--tx3);padding:0;line-height:1;font-size:13px" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--tx3)'">${appIcon('trash')}</button>`:'<span></span>'}
      </div>`).join('')}
    </div>
  </div>`;
}

function buildForm(){
  const g=document.getElementById('fgrid');
  const catsData = CATS_DATA[formData.tipo] || [];
  const cats = catsData.map(c => c.nome);
  const catObj = catsData.find(c => c.nome === formData.cat);
  const subs = (catObj?.subs || []).map(s => s.nome);
  formData.conta=normalizeConta(formData.conta)||'Dominio Conta Digital';
  const currentItem=editingId?(DATA.find(x=>x.id===editingId)||formData):formData;
  const statusView=formData.status;
  const canBaixar=editingId&&openAmount(currentItem)>0.005;
  const baixaActionLabel=formData.tipo==='R'?'Receber':'Pagar';
  
  if(!['Recebido','Pendente','Pago','Parcial','Cancelado'].includes(formData.status)){
    formData.status = formData.tipo==='R' ? 'Recebido' : 'Pago';
  }
  g.innerHTML=`
    ${formData.status==='Cancelado'?`<div style="grid-column:span 2;background:rgba(217,74,56,.06);border:1px solid rgba(217,74,56,.18);border-radius:8px;padding:9px 12px;display:flex;align-items:center;gap:10px;font-size:12px"><span style="flex:1;color:var(--tx2)">Este lançamento está cancelado.</span><button type="button" onclick="formData.status='Pendente';buildForm()" style="font-size:12px;color:var(--brand-dark);background:none;border:none;cursor:pointer;font-weight:600;padding:0;white-space:nowrap">Reativar como Pendente</button></div>`:''}
    <div><div class="fl">Competência *</div><input id="f-comp" type="text" tabindex="1" inputmode="numeric" placeholder="mm/aaaa" maxlength="7" value="${esc(formData.dataCompView||'')}" oninput="this.value=formData.dataCompView=formatCompInput(this.value)" onblur="onCompBlur(this)" required/></div>
    <div><div class="fl">Vencimento *</div><input id="f-datavenc" type="date" tabindex="2" value="${esc(effectiveVenc(formData))}" min="1900-01-01" max="2100-12-31" onchange="formData.dataVenc=this.value" onblur="onDataVencBlur(this)" required/></div>
    <div><div class="fl">Categoria *</div><select id="f-cat" tabindex="3" onchange="formData.cat=this.value;formData.sub='';buildForm()"><option value="">Selecione...</option>${cats.map(c=>`<option value="${esc(c)}"${formData.cat===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div><div class="fl">Subcategoria</div><select tabindex="4" onchange="formData.sub=this.value"><option value="">Selecione...</option>${subs.map(s=>`<option value="${esc(s)}"${formData.sub===s?' selected':''}>${esc(s)}</option>`).join('')}</select></div>
    <div style="grid-column:span 2"><div class="fl">Descrição</div><div style="position:relative"><input id="f-desc" tabindex="5" type="text" autocomplete="off" value="${esc(formData.desc)}" oninput="formData.desc=this.value;showDescSugg(this)" onkeydown="onDescKeydown(event)" onblur="onDescBlur()" placeholder="Ex: Honorários - Empresa XYZ"/><div id="desc-sugg" class="desc-sugg" style="display:none"></div></div></div>
    ${formData.tipo==='R'?`<div style="grid-column:span 2"><div class="fl">Vincular Cliente <span style="font-weight:400;opacity:.5">(opcional)</span></div><div style="position:relative"><input id="f-cliente" type="text" autocomplete="off" value="${esc(_clienteNomeFromId(formData.clienteId))}" oninput="onClienteInput(this)" onkeydown="onClienteSuggKeydown(event)" onblur="onClienteSuggBlur()" placeholder="Buscar por nome ou código Domínio..."/><div id="cliente-sugg" class="desc-sugg" style="display:none"></div></div></div>`:''}
    <div style="grid-column:span 2;border-top:1px solid var(--bd);margin:2px 0 1px"></div>
    <div><div class="fl">Valor bruto (R$) *</div><input id="f-vbruto" type="text" tabindex="6" inputmode="decimal" value="${esc(moneyInputValue(formData.valorBruto))}" oninput="formData.valorBruto=this.value;syncFormValorLiq()" onblur="formatMoneyField(this,'valorBruto');syncFormValorLiq()" placeholder="0,00" required/></div>
    <div><div class="fl">Desconto (R$)</div><input type="text" tabindex="7" inputmode="decimal" value="${esc(moneyInputValue(formData.valorDesconto))}" oninput="formData.valorDesconto=this.value;updateFormTotal()" onblur="formatMoneyField(this,'valorDesconto');updateFormTotal()" placeholder="0,00"/></div>
    <div><div class="fl">Juros / Multa (R$)</div><input type="text" tabindex="8" inputmode="decimal" value="${esc(moneyInputValue(formData.valorJuros))}" oninput="formData.valorJuros=this.value;updateFormTotal()" onblur="formatMoneyField(this,'valorJuros');updateFormTotal()" placeholder="0,00"/></div>
    <div><div class="fl">Total</div><input id="form-total" type="text" readonly tabindex="-1" value="${fmt(parseMoney(formData.valorLiq||0)+parseMoney(formData.valorJuros||0)-parseMoney(formData.valorDesconto||0))}" style="background:${formData.tipo==='R'?'rgba(19,124,60,.1)':'rgba(217,74,56,.08)'};border-color:${formData.tipo==='R'?'rgba(19,124,60,.25)':'rgba(217,74,56,.25)'};color:${formData.tipo==='R'?'var(--ok)':'var(--red)'};font-weight:700;text-align:right;cursor:default"/></div>
    <div style="grid-column:span 2;border-top:1px solid var(--bd);margin:2px 0 1px"></div>
    <div><div class="fl">Status</div><div class="status-sw">${(formData.tipo==='R'?[['Pendente','ss-pend'],['Recebido','ss-ok']]:[['Pendente','ss-pend'],['Pago','ss-ok']]).map(([s,cls])=>`<button type="button" data-status="${s}" class="${statusView===s?cls:''}" onclick="setFormStatus('${s}')">${s}</button>`).join('')}</div>${statusView==='Parcial'?`<div style="font-size:11px;margin-top:5px;color:#ff8c00">Baixado: ${fmt(paidAmount(currentItem))} | Em aberto: ${fmt(openAmount(currentItem))}</div>`:''}${editingId&&formData.status!=='Cancelado'?`<button type="button" onclick="openConfirmModal('Cancelar este lançamento? O status será alterado para Cancelado.',{danger:true,confirmLabel:'Cancelar lançamento'}).then(ok=>{if(ok){formData.status='Cancelado';buildForm();}})" style="font-size:11px;color:var(--tx3);background:none;border:none;cursor:pointer;padding:3px 0 0;display:block">Cancelar lan?amento</button>`:''}</div>
    <div><div class="fl">Data Pagamento</div><input id="f-datapgto" type="date" tabindex="10" value="${esc(formData.dataPgto)}" min="1900-01-01" max="2100-12-31" onchange="formData.dataPgto=this.value" onblur="onDataPgtoBlur(this)"/></div>
    <div><div class="fl">Conta Bancária</div><select id="f-conta" tabindex="11" onchange="formData.conta=this.value">${CONTAS.map(c=>`<option value="${esc(c)}"${formData.conta===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div><div class="fl">Nº Doc / NF</div><input tabindex="12" type="text" value="${esc(formData.doc)}" oninput="formData.doc=this.value"/></div>
    <div style="grid-column:span 2;border-top:1px solid var(--bd);margin:2px 0 1px"></div>
    <div style="grid-column:span 2"><div class="fl">Observações</div><textarea tabindex="13" rows="1" oninput="formData.obs=this.value">${esc(formData.obs)}</textarea></div>
    ${renderBaixasSection(editingId)}
    `;
  const footer=document.getElementById('modal-footer');
  if(footer)footer.innerHTML=`${canBaixar?`<button class="btn btn-ghost" onclick="openBaixaModal('${editingId}')">${appIcon('wallet')} ${baixaActionLabel}</button>`:''}<span style="margin-right:auto"></span>${editingId&&formData.tipo==='D'?`<button class="btn btn-ghost" style="font-size:12px" onclick="cadastrarComoRecorrente()">${appIcon('repeat')}Cadastrar como Recorrente</button>`:''} ${editingId?`<button class="btn btn-ghost" title="Duplicar lan?amento" onclick="duplicarEEditar('${editingId}')">${appIcon('copy')}Duplicar</button>`:''}<button class="btn btn-ghost" onclick="closeForm()">Cancelar</button>${!editingId?`<button class="btn btn-ghost" style="color:var(--brand);border-color:var(--brand)" onclick="saveFormAndNew()">${appIcon('plus')}Salvar e Novo</button>`:''}<button class="btn btn-pri" id="save-btn" onclick="saveForm()">${appIcon('file')}Salvar</button>`;
}

function buildTipoSwitch(){
  const w=document.getElementById('tipo-switch-wrap');
  if(!w)return;
  if(editingId){w.innerHTML='';return;}
  w.innerHTML=`<div class="fl" style="margin-bottom:4px">Tipo</div><div class="tipo-switch"><div id="tipo-pill" class="tipo-pill ${formData.tipo==='R'?'r':'d'}"></div><button type="button" id="ts-btn-r" class="${formData.tipo==='R'?'tsR':''}" onclick="setFormTipo('R')">${appIcon('arrowDown')}Receita</button><button type="button" id="ts-btn-d" class="${formData.tipo==='D'?'tsD':''}" onclick="setFormTipo('D')">${appIcon('arrowUp')}Despesa</button></div>`;
}

function setFormTipo(t){
  if(formData.tipo===t)return;
  formData.tipo=t;formData.cat='';formData.sub='';
  const _mEl=document.querySelector('.modal-lancamento');if(_mEl){_mEl.classList.remove('modal-tipo-r','modal-tipo-d');_mEl.classList.add(t==='R'?'modal-tipo-r':'modal-tipo-d');}
  const _hdrEl=document.querySelector('.modal-lancamento .modal-hdr');if(_hdrEl)_hdrEl.style.background=t==='R'?'rgba(19,124,60,.06)':'rgba(217,74,56,.06)';
  const pill=document.getElementById('tipo-pill');
  const btnR=document.getElementById('ts-btn-r');
  const btnD=document.getElementById('ts-btn-d');
  if(pill)pill.className='tipo-pill '+(t==='R'?'r':'d');
  if(btnR)btnR.className=t==='R'?'tsR':'';
  if(btnD)btnD.className=t==='D'?'tsD':'';
  const g=document.getElementById('fgrid');
  if(g){g.style.transition='opacity .1s';g.style.opacity='0';}
  setTimeout(()=>{buildForm();if(g){g.offsetHeight;g.style.transition='opacity .2s';g.style.opacity='1';}},130);
}
function showDescSugg(inp){
  const q=inp.value.trim();
  const el=document.getElementById('desc-sugg');
  if(!el)return;
  if(q.length<2){el.style.display='none';return;}
  const qn=_norm(q);
  const seen=new Set();
  const sugg=[];
  for(const l of DATA){
    if(!l.desc||isTransfer(l)||seen.has(l.desc))continue;
    if(!_norm(l.desc).includes(qn))continue;
    seen.add(l.desc);sugg.push(l.desc);
    if(sugg.length>=5)break;
  }
  if(!sugg.length){el.style.display='none';return;}
  const escapedQ=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('('+escapedQ+')','gi');
  el.style.display='block';
  el.innerHTML=sugg.map(s=>`<div class="desc-sugg-item" data-val="${esc(s)}" onmousedown="event.preventDefault()" onclick="pickDescSugg(this.dataset.val)">${esc(s).replace(re,'<strong>$1</strong>')}</div>`).join('');
}
function pickDescSugg(val){
  formData.desc=val;
  const inp=document.getElementById('f-desc');
  if(inp)inp.value=val;
  const el=document.getElementById('desc-sugg');
  if(el)el.style.display='none';
}
function onDescKeydown(e){
  const el=document.getElementById('desc-sugg');
  if(!el||el.style.display==='none')return;
  const items=[...el.querySelectorAll('.desc-sugg-item')];
  const cur=el.querySelector('.desc-sugg-item.ac');
  if(e.key==='Escape'){el.style.display='none';e.stopPropagation();}
  else if(e.key==='ArrowDown'){e.preventDefault();const next=cur?items[items.indexOf(cur)+1]:items[0];if(cur)cur.classList.remove('ac');if(next)next.classList.add('ac');}
  else if(e.key==='ArrowUp'){e.preventDefault();const prev=cur?items[items.indexOf(cur)-1]:items[items.length-1];if(cur)cur.classList.remove('ac');if(prev)prev.classList.add('ac');}
  else if(e.key==='Enter'&&cur){e.preventDefault();pickDescSugg(cur.dataset.val);}
}
function onDescBlur(){setTimeout(()=>{const el=document.getElementById('desc-sugg');if(el)el.style.display='none';},150);}

function _clienteNomeFromId(id){if(!id)return'';const c=CLIENTES.find(x=>x.id===id);if(!c)return'';return c.codigo?`${c.nome} · ${c.codigo}`:c.nome;}
function onClienteInput(inp){if(!inp.value.trim())formData.clienteId='';showClienteSugg(inp);}
function showClienteSugg(inp){
  const el=document.getElementById('cliente-sugg');if(!el)return;
  const q=inp.value.trim();
  if(!q){el.style.display='none';return;}
  const qn=_norm(q);
  const matches=CLIENTES.filter(c=>_norm(c.nome).includes(qn)||_norm(c.codigo||'').includes(qn)).slice(0,6);
  if(!matches.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=matches.map(c=>`<div class="desc-sugg-item" data-id="${c.id}" data-nome="${esc(c.nome)}" data-codigo="${esc(c.codigo||'')}" onmousedown="event.preventDefault()" onclick="pickClienteSugg('${c.id}','${esc(c.nome)}','${esc(c.codigo||'')}')">${esc(c.nome)}${c.codigo?` <span style="opacity:.45;font-size:11px">${esc(c.codigo)}</span>`:''}</div>`).join('');
}
function pickClienteSugg(id,nome,codigo){
  formData.clienteId=id;
  const inp=document.getElementById('f-cliente');if(inp)inp.value=codigo?`${nome} · ${codigo}`:nome;
  const el=document.getElementById('cliente-sugg');if(el)el.style.display='none';
}
function onClienteSuggBlur(){
  setTimeout(()=>{
    const el=document.getElementById('cliente-sugg');if(el)el.style.display='none';
    const inp=document.getElementById('f-cliente');
    if(inp&&inp.value&&!formData.clienteId)inp.value='';
  },150);
}
function onClienteSuggKeydown(e){
  const el=document.getElementById('cliente-sugg');
  if(!el||el.style.display==='none')return;
  const items=[...el.querySelectorAll('.desc-sugg-item')];
  const cur=el.querySelector('.desc-sugg-item.ac');
  if(e.key==='Escape'){el.style.display='none';e.stopPropagation();}
  else if(e.key==='ArrowDown'){e.preventDefault();const next=cur?items[items.indexOf(cur)+1]:items[0];if(cur)cur.classList.remove('ac');if(next)next.classList.add('ac');}
  else if(e.key==='ArrowUp'){e.preventDefault();const prev=cur?items[items.indexOf(cur)-1]:items[items.length-1];if(cur)cur.classList.remove('ac');if(prev)prev.classList.add('ac');}
  else if(e.key==='Enter'&&cur){e.preventDefault();pickClienteSugg(cur.dataset.id||'',cur.dataset.nome||'',cur.dataset.codigo||'');}
}

function syncFormValorLiq(){
  const bruto=parseMoney(formData.valorBruto);
  const ded=parseMoney(formData.ded);
  formData.valorLiq=fmtMoneyInput(Math.max(0,bruto-ded));
  const liqEl=document.getElementById('form-valor-liq');
  if(liqEl)liqEl.value=formData.valorLiq;
  updateFormTotal();
}
function syncFormDedFromLiq(){
  const bruto=parseMoney(formData.valorBruto);
  const liq=parseMoney(formData.valorLiq);
  if(bruto>0){
    formData.ded=fmtMoneyInput(Math.max(0,bruto-liq));
    const dedEl=document.getElementById('form-ded');
    if(dedEl)dedEl.value=formData.ded;
  }
  updateFormTotal();
}
function updateFormTotal(){const el=document.getElementById('form-total');if(el)el.value=fmt(parseMoney(formData.valorLiq||0)+parseMoney(formData.valorJuros||0)-parseMoney(formData.valorDesconto||0));}
function setFormStatus(s){
  formData.status=s;
  if(s==='Pendente'){
    formData.dataPgto='';
    const pg=document.getElementById('f-datapgto');
    if(pg)pg.value='';
  }
  document.querySelectorAll('.status-sw button').forEach(btn=>{
    const v=btn.dataset.status;
    btn.className=v===s?(s==='Pendente'?'ss-pend':s==='Cancelado'?'ss-err':'ss-ok'):'';
  });
}

function validateCatSub(tipo, cat, sub){
  const cats = CATS_DATA[tipo]||[];
  const catObj = cats.find(c=>c.nome===cat);
  if(!cat) return 'Selecione uma categoria.';
  if(!catObj) return `Categoria "${cat}" não está cadastrada.`;
  if(sub){
    const subObj=(catObj.subs||[]).find(s=>s.nome===sub);
    if(!subObj) return `Subcategoria "${sub}" não está cadastrada em "${cat}".`;
  }
  return null;
}

// ?? MODAL PAGAMENTO PARCIAL ????????????????????????????????????????????????
let _parcialCtx=null; // {original, totalOriginal, jaPago, pendente, canonicalComp, acaoTxt}
let _parcialRows=[]; // [{valor, conta, data}]

function closeParcialModal(){document.getElementById('parcial-overlay').style.display='none';}

function baixarParcial(){
  if(!editingId){toast('Salve o lan?amento antes.','err');return;}
  const original=DATA.find(l=>l.id===editingId);
  if(!original){toast('Lançamento não encontrado.','err');return;}
  const canonicalComp=compFromView(formData.dataCompView)||formData.dataComp;
  if(!canonicalComp){toast('Informe a compet?ncia antes.','err');return;}
  const catErr=validateCatSub(formData.tipo,formData.cat,formData.sub);
  if(catErr){toast(catErr,'err');return;}
  const totalOriginal=parseMoney(formData.status==='Parcial'?formData.valorBruto:formData.valorLiq);
  const jaPago=parseMoney(formData.status==='Parcial'?formData.valorLiq:0);
  const pendente=+(totalOriginal-jaPago).toFixed(2);
  if(pendente<=0){toast('Não há saldo pendente.','err');return;}
  _parcialCtx={original,totalOriginal,jaPago,pendente,canonicalComp,acaoTxt:formData.tipo==='R'?'recebido':'pago'};
  const hoje=new Date().toISOString().slice(0,10);
  const contaPadrao=normalizeConta(formData.conta)||CONTAS[0]||'';
  _parcialRows=[{valor:fmtMoneyInput(pendente),conta:contaPadrao,data:hoje}];
  renderParcialModal();
  document.getElementById('parcial-overlay').style.display='flex';
}

function renderParcialModal(){
  const{totalOriginal,jaPago,pendente}=_parcialCtx;
  const totalNovo=_parcialRows.reduce((s,r)=>s+parseMoney(r.valor),0);
  const saldoApos=+(pendente-totalNovo).toFixed(2);
  const ok=totalNovo>0&&totalNovo<=pendente+0.005;
  const contaOpts=CONTAS.map(c=>`<option value="${esc(c)}">{C}</option>`);

  const rowsHtml=_parcialRows.map((r,i)=>`
    <tr>
      <td style="padding:6px 4px">
        <input type="text" inputmode="decimal" value="${esc(r.valor)}"
          style="width:110px;background:var(--s1);border:1px solid var(--bd2);border-radius:7px;color:var(--tx);padding:6px 8px;font-size:13px"
          oninput="_parcialRows[${i}].valor=this.value;_parcialUpdateTotals()"
          onblur="this.value=fmtMoneyInput(parseMoney(this.value));_parcialRows[${i}].valor=this.value;_parcialUpdateTotals()"
          placeholder="0,00"/>
      </td>
      <td style="padding:6px 4px">
        <select style="background:var(--s1);border:1px solid var(--bd2);border-radius:7px;color:var(--tx);padding:6px 8px;font-size:13px;width:100%"
          onchange="_parcialRows[${i}].conta=this.value">
          ${CONTAS.map(c=>`<option value="${esc(c)}"${r.conta===c?' selected':''}>${esc(c)}</option>`).join('')}
        </select>
      </td>
      <td style="padding:6px 4px">
        <input type="date" value="${r.data}"
          style="background:var(--s1);border:1px solid var(--bd2);border-radius:7px;color:var(--tx);padding:6px 8px;font-size:13px"
          onchange="_parcialRows[${i}].data=this.value"/>
      </td>
      <td style="padding:6px 4px;text-align:center">
        ${_parcialRows.length>1?`<button onclick="_parcialRemRow(${i})" style="background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px">?</button>`:'<span style="display:inline-block;width:32px"></span>'}
      </td>
    </tr>`).join('');

  document.getElementById('parcial-body').innerHTML=`
    <div style="background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px">
      <div style="font-weight:600;margin-bottom:6px;color:var(--tx)">${esc(_parcialCtx.original.desc||'')}</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <span style="color:var(--tx2)">Total original: <strong style="color:var(--tx)">${fmt(totalOriginal)}</strong></span>
        ${jaPago>0?`<span style="color:var(--tx2)">Já recebido: <strong style="color:var(--ok)">${fmt(jaPago)}</strong></span>`:''}
        <span style="color:var(--tx2)">Pendente: <strong style="color:#ff8c00">${fmt(pendente)}</strong></span>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:4px 4px 8px;text-align:left;font-weight:600">Valor (R$)</th>
          <th style="padding:4px 4px 8px;text-align:left;font-weight:600">Conta</th>
          <th style="padding:4px 4px 8px;text-align:left;font-weight:600">Data</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="parcial-rows-tbody">${rowsHtml}</tbody>
    </table>
    <button onclick="_parcialAddRow()" style="margin-top:8px;background:none;border:1px dashed var(--bd2);color:var(--tx3);border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;width:100%">${appIcon('plus')} Adicionar outra conta</button>
    <div id="parcial-totals" style="margin-top:16px;padding:12px 16px;background:var(--s2);border:1px solid ${ok?'var(--bd)':'rgba(248,81,73,.3)'};border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div style="font-size:13px">
        <span style="color:var(--tx2)">Recebendo agora: </span><strong style="color:${ok?'var(--ok)':'var(--red)'};font-size:15px">${fmt(totalNovo)}</strong>
        <span style="margin-left:16px;color:var(--tx2)">Saldo ap?s: </span><strong style="color:${saldoApos<=0.005?'var(--ok)':'#ff8c00'}">${saldoApos<=0.005?'Quitado ?':fmt(saldoApos)}</strong>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-ghost" onclick="closeParcialModal()">Cancelar</button>
      <button class="btn btn-pri" id="parcial-confirm-btn" ${ok?'':'disabled'} onclick="confirmarParcialModal()" style="min-width:140px">
        ${appIcon('wallet')}${saldoApos<=0.005?'Quitar lan?amento':'Confirmar pagamento'}
      </button>
  `;
}

function _parcialUpdateTotals(){
  const{pendente}=_parcialCtx;
  const totalNovo=_parcialRows.reduce((s,r)=>s+parseMoney(r.valor),0);
  const saldoApos=+(pendente-totalNovo).toFixed(2);
  const ok=totalNovo>0&&totalNovo<=pendente+0.005;
  const totDiv=document.getElementById('parcial-totals');
  const btn=document.getElementById('parcial-confirm-btn');
  if(totDiv){
    totDiv.style.borderColor=ok?'var(--bd)':'rgba(248,81,73,.3)';
    totDiv.innerHTML=`<div style="font-size:13px">
      <span style="color:var(--tx2)">Recebendo agora: </span><strong style="color:${ok?'var(--ok)':'var(--red)'};font-size:15px">${fmt(totalNovo)}</strong>
      <span style="margin-left:16px;color:var(--tx2)">Saldo ap?s: </span><strong style="color:${saldoApos<=0.005?'var(--ok)':'#ff8c00'}">${saldoApos<=0.005?'Quitado ?':fmt(saldoApos)}</strong>
    </div>`;
  }
  if(btn){btn.disabled=!ok;btn.innerHTML=appIcon('wallet')+(saldoApos<=0.005?'Quitar lan?amento':'Confirmar pagamento');}
}

function _parcialAddRow(){
  const hoje=new Date().toISOString().slice(0,10);
  _parcialRows.push({valor:'',conta:CONTAS[0]||'',data:hoje});
  renderParcialModal();
}

function _parcialRemRow(i){
  _parcialRows.splice(i,1);
  renderParcialModal();
}

async function confirmarParcialModal(){
  const{original,totalOriginal,jaPago,canonicalComp,acaoTxt}=_parcialCtx;
  if(original.status!=='Pendente'&&original.status!=='Parcial'){toast('Este lancamento ja esta quitado ou cancelado.','err');return;}
  const rows=_parcialRows.filter(r=>parseMoney(r.valor)>0);
  if(!rows.length){toast('Informe ao menos um valor.','err');return;}
  for(const r of rows){
    if(!r.data||!/^\d{4}-\d{2}-\d{2}$/.test(r.data)){toast('Verifique as datas.','err');return;}
    if(!r.conta||!CONTAS.includes(r.conta)){toast(`Conta inv?lida: ${r.conta}`,'err');return;}
  }
  for(const r of rows){
    const pgClosed=assertOpenPeriod(r.data,'Data de pagamento');
    if(pgClosed){toast(pgClosed,'err');return;}
  }
  const histTotal=extractParcHist(original.obs||'').reduce((s,p)=>s+parseMoney(p.v),0);
  if(original.status==='Parcial'&&Math.abs(histTotal-jaPago)>0.01&&!await openConfirmModal(`Histórico parcial (${fmt(histTotal)}) difere do valor pago (${fmt(jaPago)}). Continuar mesmo assim?`,{title:'Atenção'}))return;
  const totalNovo=rows.reduce((s,r)=>s+parseMoney(r.valor),0);
  const novoTotalPago=+(jaPago+totalNovo).toFixed(2);
  const saldoApos=+(totalOriginal-novoTotalPago).toFixed(2);
  if(totalNovo<=0||saldoApos<-0.005){toast('Valor da baixa parcial excede o saldo pendente.','err');return;}
  const quitado=saldoApos<=0.005;
  const novoStatus=quitado?(original.tipo==='R'?'Recebido':'Pago'):'Parcial';

  const btn=document.getElementById('parcial-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  setSyncStatus('loading','Salvando...');
  try{
    // Cria uma entrada "Recebido" para cada linha de pagamento
    const dataPrincipal=rows[rows.length-1].data; // data mais recente para o lan?amento original
    const obsExtra=rows.map(r=>`${dateBR(r.data)} ${esc(r.conta)}: ${fmt(parseMoney(r.valor))}`).join(' + ');
    const prevHist=extractParcHist(original.obs||'');
    const newHist=[...prevHist,...rows.map(r=>({d:r.data,v:parseMoney(r.valor)}))];
    const cleanObs=stripParcHist(original.obs||'');
    const updated={
      ...original,
      dataComp:canonicalComp,
      dataVenc:effectiveVenc(original)||dataPrincipal,
      dataPgto:dataPrincipal,
      valorBruto:totalOriginal,
      ded:0,
      valorLiq:novoTotalPago,
      status:novoStatus,
      obs:[cleanObs,`[${quitado?'Quitado':'Parcial'} ${obsExtra}]`].filter(Boolean).join(' ')+`~~P:${JSON.stringify(newHist)}~~`
    };
    await dbUpdate(updated);
    const idx=DATA.findIndex(l=>l.id===original.id);
    if(idx>=0)DATA[idx]={...DATA[idx],...updated};

    // Se m?ltiplas contas: registra sub-entradas para rastrear cada conta no extrato
    if(rows.length>1){
      for(const r of rows){
        const sub={
          id:newId(),
          tipo:original.tipo,
          dataComp:canonicalComp,
          dataVenc:effectiveVenc(original)||r.data,
          dataPgto:r.data,
          cat:original.cat,sub:original.sub,
          desc:`${original.desc||''} (parcial)`,
          forma:original.forma||'PIX',
          conta:r.conta,
          valorBruto:parseMoney(r.valor),ded:0,valorLiq:parseMoney(r.valor),
          status:original.tipo==='R'?'Recebido':'Pago',
          obs:`Receb. parcial vinculado a: ${original.desc||''} - ${dateBR(r.data)}`
        };
        const subRow=toRow(sub);
        const res=await sbFetch('POST',TABLE,subRow);
        const saved=Array.isArray(res)?res[0]:res;
        if(saved)DATA.unshift(fromRow(saved));
      }
    } else {
      // Conta ?nica: apenas atualiza a conta no lan?amento original
      updated.conta=rows[0].conta;
      await dbUpdate({...DATA.find(l=>l.id===original.id),...updated,conta:rows[0].conta});
      const i2=DATA.findIndex(l=>l.id===original.id);
      if(i2>=0)DATA[i2].conta=rows[0].conta;
    }

    setSyncStatus('ok',`${DATA.length} registros`);
    closeParcialModal();closeForm();buildNav();renderKeepScroll();
    toast(quitado?`Lançamento quitado (${fmt(novoTotalPago)} ${acaoTxt})`:`${fmt(totalNovo)} ${acaoTxt}. Pendente: ${fmt(saldoApos)}.`,'ok');
  }catch(e){
    setSyncStatus('err','Erro');
    toast('Erro: '+e.message,'err');
    if(btn){btn.disabled=false;btn.innerHTML=appIcon('wallet')+'Confirmar pagamento';}
  }
}

// Modal unico de baixa: o valor informado decide se sera parcial ou quitacao.
let _baixaCtx=null;
let _baixaForm=null;

function closeParcialModal(){document.getElementById('parcial-overlay').style.display='none';}
function baixarParcial(){if(editingId)openBaixaModal(editingId);}

function openBaixaModal(id){
  const l=DATA.find(x=>x.id===id);
  if(!l){toast('Lancamento nao encontrado.','err');return;}
  if(l.status==='Cancelado'){toast('Lancamento cancelado nao aceita baixa.','err');return;}
  const saldo=openAmount(l);
  if(saldo<=0.005){toast('Este lancamento ja esta quitado.','ok');return;}
  const hoje=new Date().toISOString().slice(0,10);
  const jurosFilhos=DATA.filter(x=>x.parentId===id&&(x.adjType==='juros'||x.adjType==='multa')&&openAmount(x)>0.005);
  const jurosTotal=+jurosFilhos.reduce((s,x)=>s+openAmount(x),0).toFixed(2);
  _baixaCtx={lancamentoId:id,acao:l.tipo==='R'?'Receber':'Pagar',acaoFeita:l.tipo==='R'?'recebido':'pago',jurosFilhos,jurosTotal,saldo};
  _baixaForm={valor:fmtMoneyInput(saldo),valorJuros:jurosTotal>0?fmtMoneyInput(jurosTotal):'',dataPgto:hoje,conta:normalizeConta(l.conta)||CONTAS[0]||'',forma:l.forma||'PIX',obs:''};
  renderBaixaModal();
  document.getElementById('parcial-overlay').style.display='flex';
  setTimeout(()=>document.getElementById('baixa-valor')?.focus(),50);
}

function renderBaixaModal(){
  const l=DATA.find(x=>x.id===_baixaCtx.lancamentoId);
  if(!l)return;
  const total=titleAmount(l),ja=paidAmount(l),saldo=openAmount(l);
  const acao=_baixaCtx.acao,acaoLow=acao.toLowerCase();
  const title=document.getElementById('baixa-modal-title');
  if(title)title.innerHTML=`${appIcon('wallet')}${acao}`;
  const valor=parseMoney(_baixaForm.valor||0);
  const valorJuros=parseMoney(_baixaForm.valorJuros||0);
  const totalBaixa=+(valor+valorJuros).toFixed(2);
  const saldoAposMain=+(saldo-valor).toFixed(2);
  const jurosExistente=_baixaCtx.jurosTotal||0;
  const saldoAposJuros=+Math.max(0,jurosExistente-valorJuros).toFixed(2);
  const saldoApos=+(saldoAposMain+saldoAposJuros).toFixed(2);
  const ok=valor>0&&valor<=saldo+0.005&&valorJuros>=0;
  document.getElementById('parcial-body').innerHTML=`
    <div style="background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--tx)">${esc(l.desc||l.cat||'Lancamento')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <div><div style="font-size:11px;color:var(--tx3)">Valor original</div><strong>${fmt(total)}</strong></div>
        <div><div style="font-size:11px;color:var(--tx3)">${l.tipo==='R'?'Ja recebido':'Ja pago'}</div><strong style="color:var(--teal)">${fmt(ja)}</strong></div>
        <div><div style="font-size:11px;color:var(--tx3)">Saldo em aberto</div><strong style="color:#ff8c00">${fmt(saldo)}</strong></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div class="fl">Valor ${acaoLow} agora *</div><input id="baixa-valor" type="text" inputmode="decimal" value="${esc(_baixaForm.valor)}" oninput="_baixaForm.valor=this.value;_baixaUpdateTotals()" onblur="this.value=fmtMoneyInput(parseMoney(this.value));_baixaForm.valor=this.value;_baixaUpdateTotals()"/></div>
      <div><div class="fl">Juros / Multa (R$)</div><input id="baixa-juros" type="text" inputmode="decimal" value="${esc(_baixaForm.valorJuros||'')}" oninput="_baixaForm.valorJuros=this.value;_baixaUpdateTotals()" onblur="this.value=parseMoney(this.value)>0?fmtMoneyInput(parseMoney(this.value)):'';_baixaForm.valorJuros=this.value;_baixaUpdateTotals()" placeholder="0,00"/></div>
      <div><div class="fl">Data *</div><input id="baixa-data" type="date" value="${esc(_baixaForm.dataPgto)}" onchange="_baixaForm.dataPgto=this.value"/></div>
      <div><div class="fl">Conta *</div><select id="baixa-conta" onchange="_baixaForm.conta=this.value">${CONTAS.map(c=>`<option value="${esc(c)}"${_baixaForm.conta===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
      <div><div class="fl">Forma</div><select id="baixa-forma" onchange="_baixaForm.forma=this.value">${FORMAS.map(f=>`<option value="${esc(f)}"${_baixaForm.forma===f?' selected':''}>${esc(f)}</option>`).join('')}</select></div>
      <div style="grid-column:span 2"><div class="fl">Observacao</div><textarea rows="2" oninput="_baixaForm.obs=this.value" placeholder="Opcional">${esc(_baixaForm.obs)}</textarea></div>
    </div>
    <div id="baixa-totals" style="margin-top:14px;padding:11px 14px;background:var(--s2);border:1px solid ${ok?'var(--bd)':'rgba(248,81,73,.3)'};border-radius:10px;font-size:13px">
      ${totalBaixa>valor?`<div style="color:var(--tx2);margin-bottom:4px;font-size:12px">Total desta baixa: <strong style="color:var(--tx)">${fmt(totalBaixa)}</strong> <span style="color:var(--tx3)">(${fmt(valor)} + ${fmt(valorJuros)} juros)</span></div>`:''}
      <span style="color:var(--tx2)">Saldo apos esta baixa: </span><strong style="color:${saldoApos<=0.005?'var(--teal)':'#ff8c00'}">${saldoApos<=0.005?'Quitado':fmt(Math.max(0,saldoApos))}</strong>
      ${valor>saldo+0.005?`<div style="color:var(--red);font-size:12px;margin-top:4px">Valor acima do saldo em aberto (max ${fmt(saldo)}).</div>`:''}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-ghost" onclick="closeParcialModal()">Cancelar</button>
      <button class="btn btn-pri" id="parcial-confirm-btn" ${ok?'':'disabled'} onclick="confirmarParcialModal()" style="min-width:140px">${appIcon('wallet')}${saldoApos<=0.005?'Quitar':acao}</button>
    </div>`;
}

function _baixaUpdateTotals(){
  const l=DATA.find(x=>x.id===_baixaCtx?.lancamentoId);
  if(!l)return;
  const saldo=openAmount(l);
  const valor=parseMoney(_baixaForm.valor||0);
  const valorJuros=parseMoney(_baixaForm.valorJuros||0);
  const totalBaixa=+(valor+valorJuros).toFixed(2);
  const jurosExistente=_baixaCtx.jurosTotal||0;
  const saldoAposMain=+(saldo-valor).toFixed(2);
  const saldoAposJuros=+Math.max(0,jurosExistente-valorJuros).toFixed(2);
  const saldoApos=+(saldoAposMain+saldoAposJuros).toFixed(2);
  const ok=valor>0&&valor<=saldo+0.005&&valorJuros>=0;
  const totals=document.getElementById('baixa-totals');
  if(totals){
    totals.style.borderColor=ok?'var(--bd)':'rgba(248,81,73,.3)';
    totals.innerHTML=`${totalBaixa>valor?`<div style="color:var(--tx2);margin-bottom:4px;font-size:12px">Total desta baixa: <strong style="color:var(--tx)">${fmt(totalBaixa)}</strong> <span style="color:var(--tx3)">(${fmt(valor)} + ${fmt(valorJuros)} juros)</span></div>`:''}<span style="color:var(--tx2)">Saldo apos esta baixa: </span><strong style="color:${saldoApos<=0.005?'var(--teal)':'#ff8c00'}">${saldoApos<=0.005?'Quitado':fmt(Math.max(0,saldoApos))}</strong>${valor>saldo+0.005?`<div style="color:var(--red);font-size:12px;margin-top:4px">Valor acima do saldo em aberto (max ${fmt(saldo)}).</div>`:''}`;
  }
  const btn=document.getElementById('parcial-confirm-btn');
  if(btn){btn.disabled=!ok;btn.innerHTML=appIcon('wallet')+(saldoApos<=0.005?'Quitar':_baixaCtx.acao);}
}

async function confirmarParcialModal(){
  const l=DATA.find(x=>x.id===_baixaCtx?.lancamentoId);
  if(!l)return;
  const valor=parseMoney(_baixaForm.valor||0);
  const valorJuros=parseMoney(_baixaForm.valorJuros||0);
  const saldo=openAmount(l);
  if(valor<=0){toast('Informe um valor maior que zero.','err');return;}
  if(valor>saldo+0.005){toast('Valor acima do saldo em aberto.','err');return;}
  const btn=document.getElementById('parcial-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  setSyncStatus('loading','Salvando baixa...');
  const baixaBase={dataPgto:_baixaForm.dataPgto,conta:_baixaForm.conta,forma:_baixaForm.forma,origem:'manual',obs:_baixaForm.obs};
  try{
    const result=await registerBaixa(l,{valor,... baixaBase});
    const updated=result.lancamento;
    if(editingId===updated.id){
      formData={...formData,...updated,dataCompView:compToView(updated.dataComp||'')};
      buildForm();
    }
    // Processar juros/multa se o usuário informou valor
    if(valorJuros>0.005){
      let restanteJuros=valorJuros;
      // Primeiro tenta baixar filhos existentes
      for(const jf of (_baixaCtx.jurosFilhos||[])){
        if(restanteJuros<=0.005)break;
        const jfSaldo=openAmount(jf);
        const jfValor=+Math.min(restanteJuros,jfSaldo).toFixed(2);
        if(jfValor>0.005){await registerBaixa(jf,{valor:jfValor,...baixaBase});restanteJuros=+(restanteJuros-jfValor).toFixed(2);}
      }
      // Se sobrou valor de juros sem filho existente, cria novo filho e baixa
      if(restanteJuros>0.005){
        const adjCatNome=l.tipo==='R'?'Receitas Financeiras':'Despesas Financeiras';
        const adjSubNome=l.tipo==='R'?'Juros/Multas':'Juros/Multas por Atrasos';
        const adjCObj=CATS_DATA[l.tipo]?.find(x=>x.nome===adjCatNome);
        const adjSObj=(adjCObj?.subs||[]).find(x=>x.nome===adjSubNome);
        if(!adjCObj||!adjSObj){toast(`Categoria "${adjSubNome}" não encontrada. Cadastre-a antes de registrar juros.`,'err');}
        else{
          const ae={id:newId(),tipo:l.tipo,parentId:l.id,adjType:'juros',
            dataComp:baixaBase.dataPgto?.slice(0,7)+'-01'||l.dataComp,
            dataVenc:l.dataVenc||effectiveVenc(l)||baixaBase.dataPgto,
            dataPgto:'',cat:adjCatNome,sub:adjSubNome,
            desc:(l.desc?l.desc+' - Juros/Multa':'Juros/Multa'),
            cc:l.cc||'',forma:baixaBase.forma||l.forma||'PIX',
            conta:baixaBase.conta||l.conta,doc:l.doc||'',
            valorBruto:restanteJuros,ded:0,valorLiq:restanteJuros,status:'Pendente',obs:''};
          const savedAe=await dbInsert(ae);
          const aeApp=savedAe?fromRow(savedAe):{...ae};
          DATA.unshift(aeApp);
          await registerBaixa(aeApp,{valor:restanteJuros,...baixaBase});
        }
      }
    }
    setSyncStatus('ok',`${DATA.length} registros`);
    closeParcialModal();buildNav();renderKeepScroll();
    const updatedMain=DATA.find(x=>x.id===updated.id)||updated;
    const tudo=openAmount(updatedMain)<=0.005;
    const total=+(valor+valorJuros).toFixed(2);
    toast(tudo?`Lancamento quitado (${fmt(total)})`:`${fmt(total)} ${_baixaCtx.acaoFeita}. Saldo: ${fmt(Math.max(0,saldo-valor))}.`,'ok');
  }catch(e){
    setSyncStatus('err','Erro');
    toast('Erro ao registrar baixa: '+e.message,'err');
    if(btn){btn.disabled=false;btn.innerHTML=appIcon('wallet')+_baixaCtx.acao;}
  }
}

async function saveForm(){
  const canonicalComp = compFromView(formData.dataCompView)||formData.dataComp;
  const valorBruto = parseMoney(formData.valorBruto);
  const ded = parseMoney(formData.ded);
  const valorLiq = parseMoney(formData.valorLiq)||Math.max(0,valorBruto-ded);
  const valorJuros = parseMoney(formData.valorJuros||0);
  const valorMulta = parseMoney(formData.valorMulta||0);
  const valorDesconto = parseMoney(formData.valorDesconto||0);
  const existingBefore=DATA.find(x=>x.id===formData.id);
  const reverseBaixasOnSave=!!(existingBefore&&formData.status==='Pendente'&&getBaixas(existingBefore.id).length);
  const baixasToReverse=reverseBaixasOnSave?getBaixas(existingBefore.id):[];
  const baixaOnSave=formData.status===expectedRealizedStatus(formData.tipo)&&(!existingBefore||openAmount(existingBefore)>0.005);
  // Captura baixas existentes antes de qualquer alteração, para ajuste de valor
  const _existingBaixas=existingBefore&&!reverseBaixasOnSave&&!baixaOnSave?getBaixas(existingBefore.id):[];
  const _totalPago=+_existingBaixas.reduce((s,b)=>s+parseMoney(b.valor),0).toFixed(2);
  const _oldTitle=existingBefore?titleAmount(existingBefore):0;
  const _valorMudou=_existingBaixas.length>0&&Math.abs(valorLiq-_oldTitle)>0.005;
  const baixaOnSavePayload=baixaOnSave?{
    valor:existingBefore?openAmount({...existingBefore,valorBruto,ded,valorLiq}):valorLiq,
    dataPgto:formData.dataPgto,
    conta:formData.conta,
    forma:formData.forma||'PIX',
    origem:'manual',
    obs:''
  }:null;
  clearFormMarks();
  formData.conta=normalizeConta(formData.conta);
  if(formData.status==='Pendente')formData.dataPgto='';
  const candidato={...formData,dataComp:canonicalComp,dataVenc:formData.dataVenc||effectiveVenc(formData)||formData.dataPgto,valorBruto,ded,valorLiq};
  const validation=validateLancamentoCore(candidato);
  if(validation.errors.length){
    const msg=firstValidationError(validation);
    if(msg.includes('Competencia'))markInvalid('f-comp');
    if(msg.includes('vencimento'))markInvalid('f-datavenc');
    else if(msg.includes('Data'))markInvalid('f-datapgto');
    if(msg.includes('Categoria'))markInvalid('f-cat');
    if(msg.includes('bruto'))markInvalid('f-vbruto');
    if(msg.includes('liquido'))markInvalid('form-valor-liq');
    if(msg.includes('conta'))markInvalid('f-conta');
    toast(msg,'err');
    return;
  }
  if(!await confirmValidationWarnings(validation))return;
  if(!await confirmProbableDuplicate(candidato))return;
  if(reverseBaixasOnSave){
    for(const b of baixasToReverse){
      const baixaClosed=assertOpenPeriod(b.dataPgto,'Data da baixa');
      if(baixaClosed){toast(baixaClosed,'err');return;}
    }
    const totalBaixas=baixasToReverse.reduce((s,b)=>s+parseMoney(b.valor),0);
    if(!await openConfirmModal(`Reverter para Pendente vai remover ${baixasToReverse.length} baixa(s) registrada(s), total ${fmt(totalBaixas)}. Continuar?`,{danger:true,confirmLabel:'Reverter'}))return;
  }

  // Resolve categoria/subcategoria financeira para ajustes (juros/multa/desconto)
  let adjCat=null, adjSub=null;
  const hasAdj=valorJuros>0||valorMulta>0||valorDesconto>0;
  if(hasAdj){
    if(formData.tipo==='R'){
      const c=CATS_DATA['R'].find(x=>x.nome==='Receitas Financeiras');
      const s=(c?.subs||[]).find(x=>x.nome==='Juros/Multas');
      if(!c||!s){toast('Subcategoria "Juros/Multas" em "Receitas Financeiras" não encontrada.','err');return;}
      adjCat=c.nome; adjSub=s.nome;
    }else{
      const c=CATS_DATA['D'].find(x=>x.nome==='Despesas Financeiras');
      const s=(c?.subs||[]).find(x=>x.nome==='Juros/Multas por Atrasos');
      if(!c||!s){toast('Subcategoria "Juros/Multas por Atrasos" em "Despesas Financeiras" não encontrada.','err');return;}
      adjCat=c.nome; adjSub=s.nome;
    }
  }

  formData={...formData,...validation.item,dataComp:canonicalComp,dataVenc:validation.item.dataVenc||effectiveVenc(validation.item),valorBruto,ded,valorLiq};
  const _adjStatus=formData.status;
  const _adjDataPgto=formData.dataPgto;
  if(baixaOnSave){formData.status='Pendente';formData.dataPgto='';}
  // Se valor aumentou além do que foi pago, rebaixar status para não ficar como "pago" incorretamente
  if(_valorMudou&&_totalPago>0&&_totalPago<valorLiq-0.005){
    formData.status=_totalPago>0.005?'Parcial':'Pendente';
    if(formData.status==='Pendente')formData.dataPgto='';
  }
  const btn=document.getElementById('save-btn');if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  setSyncStatus('loading','Salvando...');
  try{
    const exists=DATA.findIndex(x=>x.id===formData.id);
    let mainSaved;
    if(exists>=0){
      await dbUpdate(formData);
      if(reverseBaixasOnSave)await clearBaixasForLancamento(formData.id);
      DATA[exists]=refreshLancamentoComputed({...formData});
      mainSaved=DATA[exists];
    }
    else{const saved=await dbInsert(formData);mainSaved=refreshLancamentoComputed(saved?fromRow(saved):{...formData});DATA.unshift(mainSaved);}

    // Remove ajustes existentes vinculados e recria
    const existingAdjs=DATA.filter(x=>x.parentId===formData.id);
    for(const a of existingAdjs)await dbDelete(a.id);
    DATA=DATA.filter(x=>x.parentId!==formData.id);
    BAIXAS_DATA=BAIXAS_DATA.filter(b=>!existingAdjs.some(a=>a.id===b.lancamentoId));
    _invalidateBaixasCache();
    let adjCount=0;
    if(adjCat&&adjSub){
      const adjDataComp=_adjDataPgto?(_adjDataPgto.slice(0,7)+'-01'):formData.dataComp;
      for(const adj of [{v:valorJuros,t:'juros',lbl:'Juros/Multa'},{v:valorDesconto,t:'desconto',lbl:'Desconto'}]){
        if(adj.v<=0)continue;
        const ae={id:newId(),tipo:formData.tipo,parentId:formData.id,adjType:adj.t,dataComp:adjDataComp,dataVenc:formData.dataVenc||effectiveVenc(formData),dataPgto:_adjDataPgto||'',cat:adjCat,sub:adjSub,desc:(formData.desc?formData.desc+' - '+adj.lbl:adj.lbl),cc:formData.cc||'',forma:formData.forma||'PIX',conta:formData.conta,doc:formData.doc||'',valorBruto:adj.v,ded:0,valorLiq:adj.v,status:_adjStatus,obs:''};
        const savedAe=await dbInsert(ae);
        DATA.unshift(savedAe?fromRow(savedAe):{...ae});
        adjCount++;
      }
    }

    if(baixaOnSavePayload){
      const target=DATA.find(x=>x.id===formData.id)||mainSaved;
      await registerBaixa(target,baixaOnSavePayload);
    }

    // Se valor foi reduzido, trimmar a(s) última(s) baixa(s) para não exceder o novo valor
    if(_valorMudou&&_totalPago>valorLiq+0.005){
      let excess=+(_totalPago-valorLiq).toFixed(2);
      for(let i=_existingBaixas.length-1;i>=0&&excess>0.005;i--){
        const bv=parseMoney(_existingBaixas[i].valor);
        await dbDeleteBaixa(_existingBaixas[i].id);
        BAIXAS_DATA=BAIXAS_DATA.filter(x=>x.id!==_existingBaixas[i].id);
        _invalidateBaixasCache();
        const novoValor=+(bv-excess).toFixed(2);
        if(novoValor>0.005){
          const newRow={..._existingBaixas[i],id:newId(),valor:novoValor};
          const savedB=await dbInsertBaixa(newRow);
          BAIXAS_DATA.push(savedB?fromBaixaRow(savedB):newRow);
          _invalidateBaixasCache();
          excess=0;
        }else{excess=+(excess-bv).toFixed(2);}
      }
      const trimItem=DATA.find(x=>x.id===formData.id);
      if(trimItem){trimItem.status=computedStatus(trimItem);trimItem.dataPgto=paidAmount(trimItem)>0?latestBaixaDate(trimItem):'';await dbUpdate(trimItem);formData.status=trimItem.status;}
    }

    // Sync baixa when editing a fully paid/received lancamento with a single baixa
    if(!reverseBaixasOnSave&&!baixaOnSave&&existingBefore){
      const syncBaixas=getBaixas(formData.id);
      const syncLan=DATA.find(x=>x.id===formData.id);
      if(syncBaixas.length===1&&syncLan&&openAmount(syncLan)<=0.005){
        const b=syncBaixas[0];
        const nc=normalizeConta(formData.conta)||formData.conta;
        const nf=formData.forma||b.forma;
        const nd=formData.dataPgto||b.dataPgto;
        if(b.conta!==nc||b.forma!==nf||b.dataPgto!==nd){
          const updated={...b,conta:nc,forma:nf,dataPgto:nd};
          await dbUpdateBaixa(updated);
          const bi=BAIXAS_DATA.findIndex(x=>x.id===b.id);
          if(bi>=0){BAIXAS_DATA[bi]=updated;_invalidateBaixasCache();}
          const li=DATA.findIndex(x=>x.id===formData.id);
          if(li>=0){DATA[li]=refreshLancamentoComputed(DATA[li]);await dbUpdate(DATA[li]);}
        }
      }
    }

    const _tipo=formData.tipo;
    localStorage.setItem('skala_last_conta',formData.conta);
    setSyncStatus('ok',`${DATA.length} registros`);closeForm(true);buildNav();renderKeepScroll();
    toast('Lançamento salvo!','ok');
    if(_saveAndNew){_saveAndNew=false;openForm();setFormTipo(_tipo);}
  }catch(e){setSyncStatus('err','Erro ao salvar');toast('Erro ao salvar: '+e.message,'err');if(btn){btn.disabled=false;btn.innerHTML=appIcon('file')+'Salvar Lançamento';}}
}

async function duplicarLancamento(id){
  const orig=DATA.find(l=>l.id===id);
  if(!orig)return;
  const copia={...orig,id:newId(),status:'Pendente',dataPgto:''};
  const validation=validateLancamentoCore(copia);
  if(validation.errors.length){toast(firstValidationError(validation),'err');return;}
  if(!await confirmProbableDuplicate(copia))return;
  try{
    const res=await dbInsert(copia);
    DATA.unshift(res?fromRow(res):copia);
    buildNav();renderKeepScroll();
    toast('Lançamento duplicado','ok');
  }catch(e){toast('Erro ao duplicar: '+e.message,'err');}
}

async function duplicarEEditar(id){
  const orig=DATA.find(l=>l.id===id);
  if(!orig)return;
  const copia={...orig,id:newId(),status:'Pendente',dataPgto:''};
  const validation=validateLancamentoCore(copia);
  if(validation.errors.length){toast(firstValidationError(validation),'err');return;}
  if(!await confirmProbableDuplicate(copia))return;
  try{
    const res=await dbInsert(copia);
    const novo=res?fromRow(res):copia;
    DATA.unshift(novo);
    buildNav();renderKeepScroll();
    openEdit(novo.id);
  }catch(e){toast('Erro ao duplicar: '+e.message,'err');}
}

function cadastrarComoRecorrente(){
  const {desc,cat,sub,conta}=formData;
  const valor=parseMoney(formData.valorBruto);
  closeForm();
  pushTab('recorrentes');
  recData={id:newId(),tipo:'D',desc,cat,sub,valor,diaVenc:null,compOffset:0,conta};
  document.getElementById('modal-ttl').textContent='Nova Despesa Recorrente';
  const seqEl=document.getElementById('modal-seq');if(seqEl){seqEl.textContent='';seqEl.style.display='none';}
  const footer=document.getElementById('modal-footer');if(footer)footer.innerHTML='';
  buildFormRecorrente();
  document.getElementById('overlay').style.display='flex';
}

async function deleteItem(id){
  const item=DATA.find(x=>x.id===id);
  if(!item)return;
  const isTransf=isTransfer(item);
  if(isTransf){
    const pairErr=validateTransferPair(item.doc);
    if(pairErr&&!await openConfirmModal(`${pairErr}\n\nExcluir todos os registros encontrados desta transferência mesmo assim?`,{danger:true,confirmLabel:'Excluir mesmo assim'}))return;
  }
  const idsToDelete=getRelatedDeleteIds(item);
  const itemsToDelete=DATA.filter(x=>idsToDelete.includes(x.id));
  const delErr=canDeleteLancamentos(itemsToDelete);
  if(delErr){toast(delErr,'err');return;}
  const adjChildren=DATA.filter(x=>x.parentId===id);
  const hasAdj=adjChildren.length>0;
  const msg=isTransf?'Excluir esta transferência (ambos os lançamentos)?':hasAdj?`Excluir este lançamento e ${adjChildren.length} ajuste(s) vinculado(s)?`:'Excluir este lançamento?';
  if(!await openConfirmModal(msg,{danger:true,confirmLabel:'Excluir'}))return;
  setSyncStatus('loading','Excluindo...');
  try{
    const pairIds=isTransf?DATA.filter(x=>x.doc===item.doc&&x.id!==id).map(x=>x.id):[];
    const adjIds=adjChildren.map(x=>x.id);
    await dbDelete(id);
    for(const pid of pairIds)await dbDelete(pid);
    for(const aid of adjIds)await dbDelete(aid);
    DATA=DATA.filter(x=>x.id!==id&&!pairIds.includes(x.id)&&!adjIds.includes(x.id));
    BAIXAS_DATA=BAIXAS_DATA.filter(b=>![id,...pairIds,...adjIds].includes(b.lancamentoId));
    _invalidateBaixasCache();
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();renderKeepScroll();
    toast(isTransf?'Transferência excluída.':'Lançamento excluído.','err');
  }catch(e){setSyncStatus('err','Erro ao excluir');toast('Erro ao excluir: '+e.message,'err');}
}

// Transferência entre Contas
const TRANSF_CAT='Transferência entre Contas';
const TRANSF_SLUG='transferencia';

async function ensureTransfCat(){
  for(const tipo of ['R','D']){
    if((CATS_DATA[tipo]||[]).find(c=>c.nome===TRANSF_CAT))continue;
    const id=newId();
    const ordem=(CATS_DATA[tipo]||[]).length;
    await sbFetch('POST','categorias',[{id,tipo,nome:TRANSF_CAT,slug:TRANSF_SLUG,ordem}]);
    const subId=newId();
    const sub={id:subId,categoria_id:id,nome:TRANSF_CAT,slug:TRANSF_SLUG,ordem:0};
    await sbFetch('POST','subcategorias',[sub]);
    if(!CATS_DATA[tipo])CATS_DATA[tipo]=[];
    CATS_DATA[tipo].push({id,tipo,nome:TRANSF_CAT,slug:TRANSF_SLUG,ordem,subs:[sub]});
  }
  rebuildCatsObj();
}

function openTransfModal(){
  const today=new Date().toISOString().slice(0,10);
  const opts=CONTAS.filter(Boolean).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  document.getElementById('transf-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div class="fl">Data *</div><input type="date" id="transf-data" value="${today}" style="width:100%"/></div>
      <div><div class="fl">Valor (R$) *</div><input type="text" id="transf-valor" inputmode="decimal" placeholder="0,00" onblur="this.value=fmtMoneyInput(this.value)" style="width:100%"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div class="fl">Conta Origem *</div><select id="transf-origem" style="width:100%"><option value="">Selecione...</option>${opts}</select></div>
      <div><div class="fl">Conta Destino *</div><select id="transf-destino" style="width:100%"><option value="">Selecione...</option>${opts}</select></div>
    </div>
    <div><div class="fl">Descrição</div><input type="text" id="transf-desc" placeholder="Ex: Reserva mensal" style="width:100%"/></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid var(--bd);margin-top:4px">
      <button class="btn btn-ghost" onclick="closeTransfModal()">Cancelar</button>
      <button class="btn btn-pri" onclick="saveTransferencia()">${appIcon('transfer')}Registrar Transferência</button>
    </div>`;
  document.getElementById('transf-overlay').style.display='flex';
}

function closeTransfModal(){
  document.getElementById('transf-overlay').style.display='none';
}

async function saveTransferencia(){
  const data=document.getElementById('transf-data').value;
  const origem=document.getElementById('transf-origem').value;
  const destino=document.getElementById('transf-destino').value;
  const valor=parseMoney(document.getElementById('transf-valor').value);
  const desc=document.getElementById('transf-desc').value.trim();
  const status='Pago';
  if(!data){toast('Informe a data.','err');return;}
  if(!origem){toast('Informe a conta de origem.','err');return;}
  if(!destino){toast('Informe a conta de destino.','err');return;}
  if(origem===destino){toast('Origem e destino devem ser contas diferentes.','err');return;}
  if(!valor||valor<=0){toast('Informe um valor v?lido.','err');return;}
  const pgClosed=assertOpenPeriod(data,'Data da transferencia');
  if(pgClosed){toast(pgClosed,'err');return;}
  if(!CONTAS.includes(origem)||!CONTAS.includes(destino)){toast('Origem e destino precisam ser contas cadastradas.','err');return;}
  setSyncStatus('loading','Salvando transfer?ncia...');
  try{
    await ensureTransfCat();
    const ref='TRANSF#'+newId();
    const descFinal=desc||`Transferência: ${origem} -> ${destino}`;
    const recD={id:newId(),tipo:'D',dataComp:data,dataVenc:data,dataPgto:data,cat:TRANSF_CAT,sub:TRANSF_CAT,desc:descFinal,conta:origem,doc:ref,valorBruto:valor,ded:0,valorLiq:valor,status,obs:`TRANSF_DEST:${destino}`};
    const recR={id:newId(),tipo:'R',dataComp:data,dataVenc:data,dataPgto:data,cat:TRANSF_CAT,sub:TRANSF_CAT,desc:descFinal,conta:destino,doc:ref,valorBruto:valor,ded:0,valorLiq:valor,status,obs:`TRANSF_ORIG:${origem}`};
    const [savedD,savedR]=await Promise.all([dbInsert(recD),dbInsert(recR)]);
    DATA.unshift(fromRow(savedR||recR));
    DATA.unshift(fromRow(savedD||recD));
    setSyncStatus('ok',`${DATA.length} registros`);
    closeTransfModal();
    buildNav();renderKeepScroll();
    toast('Transferência registrada!','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro ao salvar: '+e.message,'err');}
}
// ??????????????????????????????????

let recData={};
function openEditRecorrente(id,tipo='D'){
  const lista=tipo==='R'?RECORRENTES_RECEITAS:RECORRENTES_DESPESAS;
  const item=lista.find(r=>r.id===id)||{id:newId(),desc:'',cat:'',sub:'',valor:0,diaVenc:null,compOffset:0,conta:''};
  recData={...item,tipo};
  document.getElementById('modal-ttl').textContent=id?'Editar Despesa Recorrente':'Nova Despesa Recorrente';
  const seqEl=document.getElementById('modal-seq');if(seqEl){seqEl.textContent='';seqEl.style.display='none';}
  const footer=document.getElementById('modal-footer');if(footer)footer.innerHTML='';
  buildFormRecorrente();
  document.getElementById('overlay').style.display='flex';
}

function buildFormRecorrente(){
  const cats=Object.keys(CATS[recData.tipo]||{});
  const subs=(CATS[recData.tipo]?.[recData.cat])||[];
  const offsetOpts=[
    {v:-1,lbl:'-1 - Mês anterior ao vencimento (ex: salário)'},
    {v:0, lbl:'0 - Mesmo mês do vencimento'},
    {v:1, lbl:'+1 - Mês seguinte ao vencimento'},
  ];
  document.getElementById('fgrid').innerHTML=`
    <div style="grid-column:span 2"><div class="fl">Descrição *</div><input type="text" value="${esc(recData.desc)}" oninput="recData.desc=this.value"/></div>
    <div><div class="fl">Categoria *</div><select onchange="recData.cat=this.value;recData.sub='';buildFormRecorrente()"><option value="">Selecione...</option>${cats.map(c=>`<option value="${esc(c)}"${recData.cat===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div><div class="fl">Subcategoria</div><select onchange="recData.sub=this.value"><option value="">Selecione...</option>${subs.map(s=>`<option value="${esc(s)}"${recData.sub===s?' selected':''}>${esc(s)}</option>`).join('')}</select></div>
    <div><div class="fl">Valor (R$) *</div><input type="text" inputmode="decimal" value="${esc(moneyInputValue(recData.valor))}" oninput="recData.valor=this.value" onblur="formatMoneyField(this,'valor',recData)" placeholder="0,00"/></div>
    <div><div class="fl">Dia de Vencimento *</div><input type="text" inputmode="numeric" maxlength="2" value="${recData.diaVenc||''}" oninput="recData.diaVenc=parseInt(this.value)||null" placeholder="Ex: 10"/></div>
    <div><div class="fl">Competência</div><select onchange="recData.compOffset=parseInt(this.value)">${offsetOpts.map(o=>`<option value="${o.v}"${recData.compOffset===o.v?' selected':''}>${o.lbl}</option>`).join('')}</select></div>
    <div><div class="fl">Conta</div><select onchange="recData.conta=this.value"><option value="">Nenhuma</option>${CONTAS.map(c=>`<option value="${esc(c)}"${recData.conta===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div style="grid-column:span 2" class="fa"><button class="btn btn-ghost" onclick="closeForm()">Cancelar</button><button class="btn btn-pri" onclick="saveRecorrente()">${appIcon('file')}Salvar</button></div>`;
}

async function saveRecorrente(){
  const valor=parseMoney(recData.valor);
  if(!Number.isInteger(recData.diaVenc)||recData.diaVenc<1||recData.diaVenc>31){toast('Dia de vencimento deve estar entre 1 e 31.','err');return;}
  if(recData.conta&&(!normalizeConta(recData.conta)||!CONTAS.includes(normalizeConta(recData.conta)))){toast('Conta do recorrente nao esta cadastrada.','err');return;}
  if(!recData.desc||!recData.cat||valor<=0){toast('Preencha os campos obrigatórios (*)','err');return;}
  const catErr=validateCatSub(recData.tipo,recData.cat,recData.sub);
  if(catErr){toast(catErr,'err');return;}
  recData.valor=valor;
  const lista=recData.tipo==='R'?RECORRENTES_RECEITAS:RECORRENTES_DESPESAS;
  const idx=lista.findIndex(r=>r.id===recData.id);
  try{
    if(idx>=0){
      await sbFetch('PATCH',`recorrentes?id=eq.${recData.id}`,toRecorrenteRow(recData));
      lista[idx]={...recData};
    } else {
      await sbFetch('POST','recorrentes',toRecorrenteRow(recData));
      lista.push({...recData});
    }
  }catch(e){toast('Erro ao salvar: '+e.message,'err');return;}
  closeForm();render();toast('Recorrente salvo!','ok');
}

async function deleteRecorrente(id){
  if(!await openConfirmModal('Excluir esta despesa recorrente permanentemente?',{danger:true,confirmLabel:'Excluir'}))return;
  try{
    await sbFetch('DELETE',`recorrentes?id=eq.${id}`);
    for(const lista of [RECORRENTES_DESPESAS,RECORRENTES_RECEITAS]){
      const idx=lista.findIndex(r=>r.id===id);
      if(idx>=0){lista.splice(idx,1);break;}
    }
    render();toast('Recorrente excluído','ok');
  }catch(e){toast('Erro ao excluir: '+e.message,'err');}
}

let RECORRENTES_RECEITAS=[];
let RECORRENTES_DESPESAS=[];

function renderRecorrentes(c){
  const totDesp=RECORRENTES_DESPESAS.reduce((s,r)=>s+r.valor,0);
  const hoje=new Date();
  const mesAtual=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

  let lista=[...RECORRENTES_DESPESAS];
  if(filterRecBusca){const b=filterRecBusca.toLowerCase();lista=lista.filter(r=>`${r.desc} ${r.cat} ${r.sub}`.toLowerCase().includes(b));}
  if(sortRec.col==='diaVenc'||sortRec.col==='compOffset'){
    lista=[...lista].sort((a,b)=>{
      const va=a[sortRec.col] ?? 999;
      const vb=b[sortRec.col] ?? 999;
      return sortRec.dir==='asc'?va-vb:vb-va;
    });
  } else {
    lista=sortData(lista,sortRec.col==='valor'?'valor':sortRec.col,sortRec.dir);
  }

  c.innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap">
      <div class="kpi k-red" style="max-width:280px"><div class="kpi-lbl">Total Despesas Recorrentes</div><div class="kpi-val">${fmt(totDesp)}</div><div class="kpi-sub">${RECORRENTES_DESPESAS.length} itens</div></div>
      <div class="card" style="flex:1;min-width:280px;margin-bottom:0">
        <div class="card-ttl">${appIcon('repeat')}Gerar Lançamentos do Mês</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px">
          <input type="month" id="rec-mes" value="${mesAtual}" style="background:var(--s2);border:1px solid var(--bd2);border-radius:8px;color:var(--tx);padding:7px 10px;font-size:13px;outline:none"/>
          <button class="btn btn-pri" onclick="gerarRecorrentes()">Gerar Despesas do Mês</button>
        </div>
      </div>
    </div>
    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="sec-ttl">${appIcon('arrowUp')}Despesas Recorrentes <span class="yr-pill">${RECORRENTES_DESPESAS.length} itens</span></div><button class="btn btn-ghost" style="font-size:12px" onclick="openEditRecorrente('','D')">${appIcon('plus')}Nova</button></div>
      <div style="padding:10px 18px 0;display:flex;gap:10px;align-items:center">
        <input type="text" placeholder="Buscar descrição, categoria..." value="${esc(filterRecBusca)}"
          oninput="filterRecBusca=this.value;renderRecorrentes(document.getElementById('content'))"
          style="background:var(--s2);border:1px solid var(--bd2);color:var(--tx);border-radius:8px;padding:6px 12px;font-size:13px;width:280px"/>
        ${filterRecBusca?`<button class="btn btn-ghost" style="font-size:12px" onclick="filterRecBusca='';renderRecorrentes(document.getElementById('content'))">Limpar</button>`:''}
        <span style="font-size:12px;color:var(--tx3);margin-left:auto">${lista.length} de ${RECORRENTES_DESPESAS.length} item(s)</span>
      </div>
      <div class="tbl-scroll"><table class="lan-tbl rec-tbl resizable">${renderRecColgroup()}
        <thead><tr>${REC_COLS.map(renderRecHeadCell).join('')}</tr></thead>
        <tbody>
          ${lista.length===0?`<tr><td colspan="${REC_COLS.length}" style="text-align:center;padding:24px;color:var(--tx3)">Nenhum resultado</td></tr>`:
          lista.map(r=>`<tr class="lr">
            <td>${esc(r.desc)}</td>
            <td><span class="cs">${esc(r.cat)}</span></td>
            <td><span class="cs">${esc(r.sub)}</span></td>
            <td class="vc d">${fmt(r.valor)}</td>
            <td style="text-align:center">${r.diaVenc?'Dia '+r.diaVenc:'-'}</td>
            <td style="font-size:12px;color:var(--tx2)">${r.compOffset===-1?'-1 (mês ant.)':r.compOffset===1?'+1 (mês seg.)':'0 (mesmo mês)'}</td>
            <td>${esc(r.conta||'-')}</td>
            <td style="white-space:nowrap"><button class="btn btn-ghost" title="Editar" style="padding:4px 8px;font-size:12px" onclick="openEditRecorrente('${r.id}','D')">${appIcon('edit')}</button> <button class="btn btn-ghost" title="Excluir" style="padding:4px 8px;font-size:12px;color:var(--red)" onclick="deleteRecorrente('${r.id}')">${appIcon('trash')}</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `;
}

async function gerarRecorrentes(){
  const mesVal=document.getElementById('rec-mes').value;
  if(!mesVal){toast('Selecione o mês de vencimento','err');return;}
  const [anoStr,mesStr]=mesVal.split('-');
  const ano=parseInt(anoStr), mes=parseInt(mesStr);

  const semDia=RECORRENTES_DESPESAS.filter(r=>!r.diaVenc);
  if(semDia.length>0&&!await openConfirmModal(`${semDia.length} despesa(s) sem dia de vencimento serão ignoradas. Continuar?`,{title:'Atenção',confirmLabel:'Continuar'}))return;

  const comDia=RECORRENTES_DESPESAS.filter(r=>r.diaVenc);
  if(!comDia.length){toast('Nenhuma despesa com dia de vencimento definido','err');return;}
  const lastDay=new Date(ano,mes,0).getDate();
  const invalidDia=comDia.find(r=>r.diaVenc<1||r.diaVenc>31||r.diaVenc>lastDay);
  if(invalidDia){toast(`Recorrente "${invalidDia.desc}" tem vencimento dia ${invalidDia.diaVenc}, invalido para ${mesStr}/${anoStr}.`,'err');return;}
  const pgClosed=assertOpenPeriod(`${anoStr}-${mesStr}-01`,'Mes de vencimento');
  if(pgClosed){toast(pgClosed,'err');return;}
  for(const r of comDia){
    let compMes=mes+(r.compOffset||0), compAno=ano;
    if(compMes<1){compMes+=12;compAno--;}else if(compMes>12){compMes-=12;compAno++;}
    const compClosed=assertOpenPeriod(`${compAno}-${String(compMes).padStart(2,'0')}-01`,'Competencia');
    if(compClosed){toast(compClosed,'err');return;}
  }

  const anoMes=`${anoStr}-${mesStr}`;
  const jaExiste=DATA.filter(l=>effectiveVenc(l).startsWith(anoMes)&&l.obs&&l.obs.includes('[recorrente]'));
  if(jaExiste.length>0&&!await openConfirmModal(`Já existem ${jaExiste.length} lançamentos recorrentes para ${mesStr}/${anoStr}. Gerar novamente mesmo assim?`,{title:'Atenção',confirmLabel:'Gerar mesmo assim'}))return;

  const lista=comDia.map(r=>{
    const dataPgto=`${anoStr}-${mesStr}-${String(r.diaVenc).padStart(2,'0')}`;
    let compMes=mes+(r.compOffset||0), compAno=ano;
    if(compMes<1){compMes+=12;compAno--;}else if(compMes>12){compMes-=12;compAno++;}
    const dataComp=`${compAno}-${String(compMes).padStart(2,'0')}-01`;
    return{id:newId(),tipo:'D',dataComp,dataVenc:dataPgto,dataPgto:'',cat:r.cat,sub:r.sub,desc:r.desc,cc:'',forma:'PIX',conta:r.conta||'',doc:'',valorBruto:r.valor,ded:0,valorLiq:r.valor,status:'Pendente',obs:'[recorrente]'};
  });

  setSyncStatus('loading',`Gerando ${lista.length} lançamentos...`);
  try{
    const inserted=[];
    for(let i=0;i<lista.length;i+=50){const res=await sbFetch('POST',TABLE,lista.slice(i,i+50).map(toRow));if(Array.isArray(res))inserted.push(...res.map(fromRow));}
    inserted.forEach(l=>DATA.unshift(l));
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();
    toast(`${lista.length} lançamentos gerados (venc. ${mesStr}/${anoStr})!`,'ok');
    render();
  }catch(e){setSyncStatus('err','Erro ao gerar');toast('Erro: '+e.message,'err');}
}

// ?? Categorias (Supabase + Drag & Drop) ??????????????????????????
let _catTipo = 'R';
let _dragCat = null;
let _dragSub = null;

function projectionRuleSelect(cat){
  const rule=cat.projection_rule||'media_3';
  const opts=[
    ['ultimo_mes','Projecao: Ultimo mes'],
    ['media_3','Projecao: Media 3 meses'],
    ['nao_projetar','Projecao: Nao projetar'],
    ['manual','Projecao: Manual']
  ];
  return `<span style="display:inline-flex;align-items:center;gap:5px">
    <select onchange="saveProjectionRule('${cat.id}', this.value, this)" style="font-size:10px;padding:2px 6px;border-radius:6px;border:1px solid var(--bd);background:var(--s2);color:var(--tx2);max-width:145px">
      ${opts.map(([v,l])=>`<option value="${v}"${rule===v?' selected':''}>${l}</option>`).join('')}
    </select>
    <span id="proj-ok-${cat.id}" style="display:none;font-size:10px;color:var(--teal);font-weight:700">Salvo</span>
  </span>`;
}

function renderCategorias(c){
  const recCats = CATS_DATA.R||[];
  const despCats = CATS_DATA.D||[];
  c.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
      <span style="font-size:11px;color:var(--tx3);display:flex;align-items:center;gap:4px">${appIcon('grip')} Arraste para reordenar</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button class="btn btn-pri">${appIcon('arrowDown')}Receitas</button>
          <button class="btn btn-ghost" onclick="_catTipo='R';render()">Editar</button>
        </div>
        <div id="rec-cats-list">
          ${recCats.sort((a,b)=>a.ordem-b.ordem).map((cat)=>{
            const slugLocked=EXCL_DRE_SLUGS.has(cat.slug||slugify(cat.nome));
            const excluido=slugLocked||!!cat.excluir_dre;
            const dreBtn=slugLocked
              ? `<span title="Excluido do DRE (sistema)" style="padding:2px 8px;font-size:10px;border-radius:99px;border:1px solid rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red);opacity:.6;cursor:default">Fora DRE</span>`
              : `<button onclick="toggleExcluirDRE('${cat.id}',${excluido})" title="${excluido?'Excluido do DRE - clique para incluir':'Incluido no DRE - clique para excluir'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${excluido?'rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red)':'rgba(57,211,83,.3);background:rgba(57,211,83,.1);color:var(--teal)'}">${excluido?'Fora DRE':'DRE'}</button>`;
            const naoOp=(cat.fluxo||'operacional')==='nao_operacional';
            const fluxoBtn=`<button onclick="toggleFluxoCat('${cat.id}','${cat.fluxo||'operacional'}')" title="${naoOp?'Nao-Operacional - clique para marcar como Operacional':'Operacional - clique para marcar como Nao-Operacional'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${naoOp?'rgba(240,136,62,.3);background:rgba(240,136,62,.1);color:var(--orange)':'rgba(88,166,255,.3);background:rgba(88,166,255,.1);color:var(--blue)'}"> ${naoOp?'Nao-Op.':'Op.'}</button>`;
            const projSelect=projectionRuleSelect(cat);
            return `
            <div class="cat-card" id="cat-${cat.id}" draggable="true"
              ondragstart="onCatDragStart(event,'${cat.id}')"
              ondragover="onCatDragOver(event,'${cat.id}')"
              ondragleave="onCatDragLeave(event,'${cat.id}')"
              ondrop="onCatDrop(event,'${cat.id}')">
              <div class="cat-hdr">
                <div style="display:flex;align-items:center;gap:8px;flex:1">
                  <span class="drag-handle">${appIcon('grip')}</span>
                  <span style="font-size:14px;font-weight:600;color:var(--tx)">${esc(cat.nome)}</span>
                  ${dreBtn}
                  ${fluxoBtn}
                  ${projSelect}
                  <button class="btn btn-ghost" title="Editar" style="padding:2px 7px;font-size:11px" onclick="editarCategoria('${cat.id}','${esc(cat.nome)}')">${appIcon('edit')}</button>
                  <button class="btn" title="Excluir" style="padding:2px 7px;font-size:11px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="excluirCategoria('${cat.id}','${esc(cat.nome)}')">${appIcon('trash')}</button>
                </div>
                <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="adicionarSub('${cat.id}','${esc(cat.nome)}')">${appIcon('plus')}Sub</button>
              </div>
              <div id="subs-${cat.id}">
                ${(cat.subs||[]).sort((a,b)=>a.ordem-b.ordem).map(sub=>`
                  <div class="sub-item" id="sub-${sub.id}" draggable="true"
                    ondragstart="onSubDragStart(event,'${sub.id}','${cat.id}')"
                    ondragover="onSubDragOver(event,'${sub.id}')"
                    ondragleave="onSubDragLeave(event,'${sub.id}')"
                    ondrop="onSubDrop(event,'${sub.id}','${cat.id}')">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="color:var(--tx3);font-size:12px;display:flex">${appIcon('grip')}</span>
                      <span style="font-size:12.5px;color:var(--tx)">${esc(sub.nome)}</span>
                    </div>
                    <div>
                      <button onclick="editarSub('${sub.id}','${esc(sub.nome)}')" title="Editar" style="background:none;border:none;color:var(--tx3);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('edit')}</button>
                      <button onclick="excluirSub('${sub.id}','${esc(sub.nome)}','${cat.id}')" title="Excluir" style="background:none;border:none;color:var(--red);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('trash')}</button>
                    </div>
                  </div>`).join('')}
                ${!(cat.subs||[]).length?`<div style="padding:12px 16px;color:var(--tx3);font-size:12px">Nenhuma subcategoria</div>`:''}
              </div>
            </div>`;}).join('')}
        </div>
        <button class="btn btn-pri" onclick="_catTipo='R';adicionarCategoria()" style="margin-top:8px">${appIcon('plus')}Nova Categoria (Receitas)</button>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button class="btn btn-pri">${appIcon('arrowUp')}Despesas</button>
          <button class="btn btn-ghost" onclick="_catTipo='D';render()">Editar</button>
        </div>
        <div id="desp-cats-list">
          ${despCats.sort((a,b)=>a.ordem-b.ordem).map((cat)=>{
            const slugLocked=EXCL_DRE_SLUGS.has(cat.slug||slugify(cat.nome));
            const excluido=slugLocked||!!cat.excluir_dre;
            const dreBtn=slugLocked
              ? `<span title="Excluido do DRE (sistema)" style="padding:2px 8px;font-size:10px;border-radius:99px;border:1px solid rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red);opacity:.6;cursor:default">Fora DRE</span>`
              : `<button onclick="toggleExcluirDRE('${cat.id}',${excluido})" title="${excluido?'Excluido do DRE - clique para incluir':'Incluido no DRE - clique para excluir'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${excluido?'rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red)':'rgba(57,211,83,.3);background:rgba(57,211,83,.1);color:var(--teal)'}">${excluido?'Fora DRE':'DRE'}</button>`;
            const naoOp=(cat.fluxo||'operacional')==='nao_operacional';
            const fluxoBtn=`<button onclick="toggleFluxoCat('${cat.id}','${cat.fluxo||'operacional'}')" title="${naoOp?'Nao-Operacional - clique para marcar como Operacional':'Operacional - clique para marcar como Nao-Operacional'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${naoOp?'rgba(240,136,62,.3);background:rgba(240,136,62,.1);color:var(--orange)':'rgba(88,166,255,.3);background:rgba(88,166,255,.1);color:var(--blue)'}"> ${naoOp?'Nao-Op.':'Op.'}</button>`;
            const projSelect=projectionRuleSelect(cat);
            return `
            <div class="cat-card" id="cat-${cat.id}" draggable="true"
              ondragstart="onCatDragStart(event,'${cat.id}')"
              ondragover="onCatDragOver(event,'${cat.id}')"
              ondragleave="onCatDragLeave(event,'${cat.id}')"
              ondrop="onCatDrop(event,'${cat.id}')">
              <div class="cat-hdr">
                <div style="display:flex;align-items:center;gap:8px;flex:1">
                  <span class="drag-handle">${appIcon('grip')}</span>
                  <span style="font-size:14px;font-weight:600;color:var(--tx)">${esc(cat.nome)}</span>
                  ${dreBtn}
                  ${fluxoBtn}
                  ${projSelect}
                  <button class="btn btn-ghost" title="Editar" style="padding:2px 7px;font-size:11px" onclick="editarCategoria('${cat.id}','${esc(cat.nome)}')">${appIcon('edit')}</button>
                  <button class="btn" title="Excluir" style="padding:2px 7px;font-size:11px;background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2)" onclick="excluirCategoria('${cat.id}','${esc(cat.nome)}')">${appIcon('trash')}</button>
                </div>
                <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="adicionarSub('${cat.id}','${esc(cat.nome)}')">${appIcon('plus')}Sub</button>
              </div>
              <div id="subs-${cat.id}">
                ${(cat.subs||[]).sort((a,b)=>a.ordem-b.ordem).map(sub=>`
                  <div class="sub-item" id="sub-${sub.id}" draggable="true"
                    ondragstart="onSubDragStart(event,'${sub.id}','${cat.id}')"
                    ondragover="onSubDragOver(event,'${sub.id}')"
                    ondragleave="onSubDragLeave(event,'${sub.id}')"
                    ondrop="onSubDrop(event,'${sub.id}','${cat.id}')">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="color:var(--tx3);font-size:12px;display:flex">${appIcon('grip')}</span>
                      <span style="font-size:12.5px;color:var(--tx)">${esc(sub.nome)}</span>
                    </div>
                    <div>
                      <button onclick="editarSub('${sub.id}','${esc(sub.nome)}')" title="Editar" style="background:none;border:none;color:var(--tx3);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('edit')}</button>
                      <button onclick="excluirSub('${sub.id}','${esc(sub.nome)}','${cat.id}')" title="Excluir" style="background:none;border:none;color:var(--red);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('trash')}</button>
                    </div>
                  </div>`).join('')}
                ${!(cat.subs||[]).length?`<div style="padding:12px 16px;color:var(--tx3);font-size:12px">Nenhuma subcategoria</div>`:''}
              </div>
            </div>`;}).join('')}
        </div>
        <button class="btn btn-pri" onclick="_catTipo='D';adicionarCategoria()" style="margin-top:8px">${appIcon('plus')}Nova Categoria (Despesas)</button>
      </div>
    </div>`;
}

// ?? Drag & Drop ? Categorias ??????????????????????????????????????
function onCatDragStart(e,id){_dragCat=id;e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
function onCatDragOver(e,id){e.preventDefault();if(_dragCat&&_dragCat!==id)document.getElementById('cat-'+id)?.classList.add('drag-over');}
function onCatDragLeave(e,id){document.getElementById('cat-'+id)?.classList.remove('drag-over');}
async function onCatDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.cat-card').forEach(el=>{el.classList.remove('drag-over','dragging');});
  if(!_dragCat||_dragCat===targetId){_dragCat=null;return;}
  const tipoR = (CATS_DATA.R||[]).find(c=>c.id===targetId) ? 'R' : null;
  const tipoD = (CATS_DATA.D||[]).find(c=>c.id===targetId) ? 'D' : null;
  const tipo = tipoR || tipoD;
  if(!tipo){_dragCat=null;return;}
  const cats=CATS_DATA[tipo];
  const fromIdx=cats.findIndex(c=>c.id===_dragCat);
  const toIdx=cats.findIndex(c=>c.id===targetId);
  if(fromIdx<0||toIdx<0){_dragCat=null;return;}
  const [moved]=cats.splice(fromIdx,1);
  cats.splice(toIdx,0,moved);
  cats.forEach((c,i)=>c.ordem=i);
  _dragCat=null;
  rebuildCatsObj();
  renderCategorias(document.getElementById('content'));
  // Save orders
  try{
    await Promise.all(cats.map(c=>sbFetch('PATCH',`categorias?id=eq.${c.id}`,{ordem:c.ordem})));
    toast('Ordem salva!','ok');
  }catch(e){toast('Erro ao salvar ordem','err');}
}

// ?? Drag & Drop ? Subcategorias ???????????????????????????????????
function onSubDragStart(e,id,catId){_dragSub={id,catId};e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.stopPropagation();}
function onSubDragOver(e,id){e.preventDefault();e.stopPropagation();if(_dragSub&&_dragSub.id!==id)document.getElementById('sub-'+id)?.classList.add('drag-over');}
function onSubDragLeave(e,id){document.getElementById('sub-'+id)?.classList.remove('drag-over');}
async function onSubDrop(e,targetId,catId){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.sub-pill').forEach(el=>{el.classList.remove('drag-over','dragging');});
  if(!_dragSub||_dragSub.id===targetId){_dragSub=null;return;}
  const tipoR = (CATS_DATA.R||[]).find(c=>c.id===catId) ? 'R' : null;
  const tipoD = (CATS_DATA.D||[]).find(c=>c.id===catId) ? 'D' : null;
  const tipo = tipoR || tipoD;
  if(!tipo){_dragSub=null;return;}
  const cat=CATS_DATA[tipo].find(c=>c.id===catId);
  if(!cat){_dragSub=null;return;}
  const subs=cat.subs||[];
  const fromIdx=subs.findIndex(s=>s.id===_dragSub.id);
  const toIdx=subs.findIndex(s=>s.id===targetId);
  if(fromIdx<0||toIdx<0){_dragSub=null;return;}
  const [moved]=subs.splice(fromIdx,1);
  subs.splice(toIdx,0,moved);
  subs.forEach((s,i)=>s.ordem=i);
  _dragSub=null;
  rebuildCatsObj();
  renderCategorias(document.getElementById('content'));
  try{
    await Promise.all(subs.map(s=>sbFetch('PATCH',`subcategorias?id=eq.${s.id}`,{ordem:s.ordem})));
    toast('Ordem salva!','ok');
  }catch(e){toast('Erro ao salvar ordem','err');}
}

// ?? CRUD Categorias ???????????????????????????????????????????????
async function adicionarCategoria(){
  const nome=prompt('Nome da nova categoria:');
  if(!nome||!nome.trim())return;
  const n=nome.trim();
  if(CATS_DATA[_catTipo].find(c=>c.nome===n)){toast('Categoria j? existe!','err');return;}
  const id=newId(), slug=slugify(n), ordem=CATS_DATA[_catTipo].length;
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('POST','categorias',[{id,tipo:_catTipo,nome:n,slug,ordem}]);
    CATS_DATA[_catTipo].push({id,tipo:_catTipo,nome:n,slug,ordem,subs:[]});
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast(`Categoria "${n}" criada!`,'ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function toggleExcluirDRE(id, currentVal){
  const newVal=!currentVal;
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('PATCH',`categorias?id=eq.${id}`,{excluir_dre:newVal});
    for(const tipo of ['R','D']){
      const cat=(CATS_DATA[tipo]||[]).find(c=>c.id===id);
      if(cat){cat.excluir_dre=newVal;break;}
    }
    setSyncStatus('ok',`${DATA.length} registros`);
    renderCategorias(document.getElementById('content'));
    toast(newVal?'Categoria excluída do DRE':'Categoria incluída no DRE','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro ao salvar: '+e.message,'err');}
}

async function toggleFluxoCat(id, current){
  const novo=current==='nao_operacional'?'operacional':'nao_operacional';
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('PATCH',`categorias?id=eq.${id}`,{fluxo:novo});
    for(const tipo of ['R','D']){const cat=(CATS_DATA[tipo]||[]).find(c=>c.id===id);if(cat){cat.fluxo=novo;break;}}
    setSyncStatus('ok',`${DATA.length} registros`);
    renderCategorias(document.getElementById('content'));
    toast(novo==='nao_operacional'?'Marcada como N?o-Operacional':'Marcada como Operacional','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro ao salvar: '+e.message,'err');}
}

async function saveProjectionRule(catId, rule, el=null){
  setSyncStatus('loading','Salvando...');
  const okEl=document.getElementById('proj-ok-'+catId);
  const oldBorder=el?.style.borderColor||'';
  if(okEl)okEl.style.display='none';
  try{
    await sbFetch('PATCH',`categorias?id=eq.${catId}`,{projection_rule:rule});
    for(const tipo of ['R','D']){
      const cat=(CATS_DATA[tipo]||[]).find(c=>c.id===catId);
      if(cat){cat.projection_rule=rule;break;}
    }
    if(typeof clearFinanceCalcCache==='function')clearFinanceCalcCache();
    setSyncStatus('ok',`${DATA.length} registros`);
    if(el)el.style.borderColor='var(--teal)';
    if(okEl)okEl.style.display='inline';
    if(typeof toast==='function')toast('Regra de projecao salva','ok');
    setTimeout(()=>{
      if(el)el.style.borderColor=oldBorder;
      if(okEl)okEl.style.display='none';
    },1600);
  }catch(e){
    setSyncStatus('err','Erro');
    if(typeof toast==='function')toast('Erro ao salvar regra: '+e.message,'err');
  }
}

async function editarCategoria(id, nomeAtual){
  const novo=prompt('Novo nome:',nomeAtual);
  if(!novo||!novo.trim()||novo.trim()===nomeAtual)return;
  const n=novo.trim();
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('PATCH',`categorias?id=eq.${id}`,{nome:n,slug:slugify(n)});
    await sbFetch('PATCH',`lancamentos?cat=eq.${encodeURIComponent(nomeAtual)}`,{cat:n});
    DATA.forEach(l=>{if(l.cat===nomeAtual)l.cat=n;});
    const cat=(CATS_DATA.R||[]).find(c=>c.id===id)||(CATS_DATA.D||[]).find(c=>c.id===id);
    if(cat){cat.nome=n;cat.slug=slugify(n);}
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast(`Renomeada para "${n}"!`,'ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function excluirCategoria(id, nome){
  if(DATA.some(l=>l.cat===nome)){toast(`A categoria "${nome}" possui lancamentos vinculados. Reclassifique antes de excluir.`,'err');return;}
  if(RECORRENTES_DESPESAS.some(r=>r.cat===nome)||RECORRENTES_RECEITAS.some(r=>r.cat===nome)){toast(`A categoria "${nome}" possui recorrentes vinculados.`,'err');return;}
  if(!await openConfirmModal(`Excluir a categoria "${nome}" e todas as suas subcategorias?`,{danger:true,confirmLabel:'Excluir'}))return;
  setSyncStatus('loading','Excluindo...');
  try{
    await sbFetch('DELETE',`categorias?id=eq.${id}`);
    const tipoR = (CATS_DATA.R||[]).find(c=>c.id===id) ? 'R' : null;
    const tipoD = (CATS_DATA.D||[]).find(c=>c.id===id) ? 'D' : null;
    const tipo = tipoR || tipoD;
    if(tipo) CATS_DATA[tipo]=CATS_DATA[tipo].filter(c=>c.id!==id);
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast(`"${nome}" excluída.`,'err');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function adicionarSub(catId, catNome){
  const nome=prompt(`Nova subcategoria em "${catNome}":`);
  if(!nome||!nome.trim())return;
  const n=nome.trim();
  const tipoR = (CATS_DATA.R||[]).find(c=>c.id===catId) ? 'R' : null;
  const tipoD = (CATS_DATA.D||[]).find(c=>c.id===catId) ? 'D' : null;
  const tipo = tipoR || tipoD;
  if(!tipo)return;
  const cat=CATS_DATA[tipo].find(c=>c.id===catId);
  if(!cat)return;
  if((cat.subs||[]).find(s=>s.nome===n)){toast('Subcategoria j? existe!','err');return;}
  const id=newId(), ordem=(cat.subs||[]).length;
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('POST','subcategorias',[{id,categoria_id:catId,nome:n,slug:slugify(n),ordem}]);
    if(!cat.subs)cat.subs=[];
    cat.subs.push({id,categoria_id:catId,nome:n,slug:slugify(n),ordem});
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast(`"${n}" adicionada!`,'ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function editarSub(id, nomeAtual){
  const novo=prompt('Novo nome:',nomeAtual);
  if(!novo||!novo.trim()||novo.trim()===nomeAtual)return;
  const n=novo.trim();
  setSyncStatus('loading','Salvando...');
  try{
    await sbFetch('PATCH',`subcategorias?id=eq.${id}`,{nome:n,slug:slugify(n)});
    let catNome=null;
    for(const tipo of ['R','D']){
      for(const cat of CATS_DATA[tipo]||[]){
        const sub=(cat.subs||[]).find(s=>s.id===id);
        if(sub){catNome=cat.nome;sub.nome=n;sub.slug=slugify(n);break;}
      }
      if(catNome)break;
    }
    const subFilter=catNome
      ?`lancamentos?sub=eq.${encodeURIComponent(nomeAtual)}&cat=eq.${encodeURIComponent(catNome)}`
      :`lancamentos?sub=eq.${encodeURIComponent(nomeAtual)}`;
    await sbFetch('PATCH',subFilter,{sub:n});
    DATA.forEach(l=>{if(l.sub===nomeAtual&&(!catNome||l.cat===catNome))l.sub=n;});
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast('Subcategoria atualizada!','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

async function excluirSub(id, nome, catId){
  const cat=[...(CATS_DATA.R||[]),...(CATS_DATA.D||[])].find(c=>c.id===catId);
  if(DATA.some(l=>l.sub===nome&&(!cat||l.cat===cat.nome))){toast(`A subcategoria "${nome}" possui lancamentos vinculados. Reclassifique antes de excluir.`,'err');return;}
  if(RECORRENTES_DESPESAS.some(r=>r.sub===nome&&(!cat||r.cat===cat.nome))||RECORRENTES_RECEITAS.some(r=>r.sub===nome&&(!cat||r.cat===cat.nome))){toast(`A subcategoria "${nome}" possui recorrentes vinculados.`,'err');return;}
  if(!await openConfirmModal(`Excluir a subcategoria "${nome}"?`,{danger:true,confirmLabel:'Excluir'}))return;
  setSyncStatus('loading','Excluindo...');
  try{
    await sbFetch('DELETE',`subcategorias?id=eq.${id}`);
    const tipoR = (CATS_DATA.R||[]).find(c=>c.id===catId) ? 'R' : null;
    const tipoD = (CATS_DATA.D||[]).find(c=>c.id===catId) ? 'D' : null;
    const tipo = tipoR || tipoD;
    if(tipo){
      const cat=CATS_DATA[tipo].find(c=>c.id===catId);
      if(cat)cat.subs=(cat.subs||[]).filter(s=>s.id!==id);
    }
    rebuildCatsObj();
    setSyncStatus('ok',`${DATA.length} registros`);
    render();toast(`"${nome}" excluída.`,'err');
  }catch(e){setSyncStatus('err','Erro');toast('Erro: '+e.message,'err');}
}

