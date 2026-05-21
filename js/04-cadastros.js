let formData={};
function openForm(id=null){
  editingId=id;
  const l=id?DATA.find(x=>x.id===id):null;
  if(l){
    formData={...l};
    formData.conta=normalizeConta(formData.conta);
    formData.dataCompView = compToView(l.dataComp || l.dataCompView || '');
    const bruto=parseMoney(formData.valorBruto);
    const ded=parseMoney(formData.ded);
    const liq=parseMoney(formData.valorLiq);
    if(!bruto&&liq)formData.valorBruto=liq;
    if(!liq&&bruto)formData.valorLiq=Math.max(0,bruto-ded);
    formData.valorJuros='';
  } else {
    formData={id:newId(),tipo:'R',dataComp:'',dataCompView:'',dataPgto:'',cat:'',sub:'',desc:'',cc:'',forma:'PIX',conta:'Dominio Conta Digital',doc:'',valorBruto:'',ded:'',valorLiq:'',valorJuros:'',status:'Pendente',obs:''};
  }
  document.getElementById('modal-ttl').textContent=id?'Editar Lançamento':'Novo Lançamento';
  const seqEl=document.getElementById('modal-seq');if(seqEl){const s=l?.seq;seqEl.textContent=s?`#${s}`:'';seqEl.style.display=s?'inline-block':'none';}
  buildForm();
  document.getElementById('overlay').style.display='flex';
}
function openEdit(id){openForm(id);}
function closeForm(){document.getElementById('overlay').style.display='none';}

function renderContas(c){
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
            <span style="color:var(--tx3);font-size:14px;margin-right:2px;cursor:grab">⠿</span>
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
  if(!confirm(`Remover conta "${conta.nome}"?`))return;
  try{
    await sbFetch('DELETE',`contas?id=eq.${id}`);
    await loadContasFromDB();
    render();toast(`Conta "${conta.nome}" removida.`);
  }catch(e){toast('Erro ao remover conta: '+e.message,'err');}
}

function buildForm(){
  const g=document.getElementById('fgrid');
  const catsData = CATS_DATA[formData.tipo] || [];
  const cats = catsData.map(c => c.nome);
  const catObj = catsData.find(c => c.nome === formData.cat);
  const subs = (catObj?.subs || []).map(s => s.nome);
  formData.conta=normalizeConta(formData.conta)||'Dominio Conta Digital';
  
  if(!['Recebido','Pendente','Pago','Parcial'].includes(formData.status)){
    formData.status = formData.tipo==='R' ? 'Recebido' : 'Pago';
  }
  g.innerHTML=`<div style="grid-column:span 2"><div class="fl">Tipo</div><div class="tt"><button type="button" class="tb ${formData.tipo==='R'?'ar':''}" onclick="setFormTipo('R')">${appIcon('arrowDown')}Receita / Entrada</button><button type="button" class="tb ${formData.tipo==='D'?'ad':''}" onclick="setFormTipo('D')">${appIcon('arrowUp')}Despesa / Saída</button></div></div>
    <div><div class="fl">Competência *</div><input id="f-comp" type="text" inputmode="numeric" placeholder="mm/aaaa" maxlength="7" value="${esc(formData.dataCompView||'')}" oninput="this.value=formData.dataCompView=formatCompInput(this.value)" onblur="onCompBlur(this)" required/></div>
    <div><div class="fl">Data Pagamento</div><input id="f-datapgto" type="date" value="${esc(formData.dataPgto)}" min="1900-01-01" max="2100-12-31" onchange="formData.dataPgto=this.value" onblur="onDataPgtoBlur(this)"/></div>
    <div><div class="fl">Categoria *</div><select id="f-cat" onchange="formData.cat=this.value;formData.sub='';buildForm()"><option value="">Selecione...</option>${cats.map(c=>`<option value="${esc(c)}"${formData.cat===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div><div class="fl">Subcategoria</div><select onchange="formData.sub=this.value"><option value="">Selecione...</option>${subs.map(s=>`<option value="${esc(s)}"${formData.sub===s?' selected':''}>${esc(s)}</option>`).join('')}</select></div>
    <div style="grid-column:span 2"><div class="fl">Descrição / Cliente / Fornecedor</div><input type="text" value="${esc(formData.desc)}" oninput="formData.desc=this.value" placeholder="Ex: Honorários — Empresa XYZ"/></div>
    <div><div class="fl">Valor bruto (R$) *</div><input id="f-vbruto" type="text" inputmode="decimal" value="${esc(moneyInputValue(formData.valorBruto))}" oninput="formData.valorBruto=this.value;syncFormValorLiq()" onblur="formatMoneyField(this,'valorBruto');syncFormValorLiq()" placeholder="0,00" required/></div>
    <div><div class="fl">Descontos / Deduções (R$)</div><input id="form-ded" type="text" inputmode="decimal" value="${esc(moneyInputValue(formData.ded))}" oninput="formData.ded=this.value;syncFormValorLiq()" onblur="formatMoneyField(this,'ded');syncFormValorLiq()" placeholder="0,00"/></div>
    <div><div class="fl">Valor líquido (R$)</div><input id="form-valor-liq" type="text" inputmode="decimal" value="${esc(moneyInputValue(formData.valorLiq))}" oninput="formData.valorLiq=this.value;syncFormDedFromLiq()" onblur="formatMoneyField(this,'valorLiq');syncFormDedFromLiq()" placeholder="0,00"/></div>
    <div><div class="fl">${formData.tipo==='R'?'Juros/Multas Recebidos (R$)':'Juros/Multas por Atraso (R$)'}</div><input type="text" inputmode="decimal" value="${esc(moneyInputValue(formData.valorJuros))}" oninput="formData.valorJuros=this.value;updateFormTotal()" onblur="formatMoneyField(this,'valorJuros');updateFormTotal()" placeholder="0,00"/><div style="font-size:10.5px;margin-top:1px;color:var(--tx2);line-height:1.25">${formData.tipo==='R'?'Lançado em Receitas Financeiras → Juros/Multas':'Lançado em Despesas Financeiras → Juros/Multas por Atrasos'}</div></div>
    <div style="grid-column:span 2"><div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:9px"><span style="font-size:11.5px;color:var(--tx2)">Total (Líquido + Juros/Multas)</span><span id="form-total" style="font-size:15px;font-weight:700;color:${formData.tipo==='R'?'var(--ok)':'var(--red)'}">${fmt(parseMoney(formData.valorLiq||0)+parseMoney(formData.valorJuros||0))}</span></div></div>
    <div><div class="fl">Status</div><select onchange="formData.status=this.value">${(formData.tipo==='R'?['Recebido','Pendente','Parcial']:['Pago','Pendente','Parcial']).map(s=>`<option value="${s}"${formData.status===s?' selected':''}>${s}</option>`).join('')}</select>${formData.status==='Parcial'?`<div style="font-size:10.5px;margin-top:4px;color:#ff8c00">◐ Pago: ${fmt(parseMoney(formData.valorLiq))} | Pendente: ${fmt(Math.max(0,parseMoney(formData.valorBruto)-parseMoney(formData.valorLiq)))}</div>`:''}</div>
    <div></div>
    <div><div class="fl">Conta Bancária</div><select id="f-conta" onchange="formData.conta=this.value">${CONTAS.map(c=>`<option value="${esc(c)}"${formData.conta===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div><div class="fl">Nº Doc / NF</div><input type="text" value="${esc(formData.doc)}" oninput="formData.doc=this.value"/></div>
    <div style="grid-column:span 2"><div class="fl">Observações</div><textarea rows="1" oninput="formData.obs=this.value">${esc(formData.obs)}</textarea></div>
    `;
  const footer=document.getElementById('modal-footer');
  if(footer)footer.innerHTML=`${editingId&&(formData.status==='Pendente'||formData.status==='Parcial')?`<button class="btn btn-ghost" style="color:#ff8c00;border-color:rgba(255,140,0,.35)" onclick="baixarParcial()">${appIcon('wallet')} ${formData.status==='Parcial'?'Registrar complemento':'Baixa parcial'}</button>`:''}<span style="margin-right:auto"></span>${editingId?`<button class="btn btn-ghost" title="Duplicar lançamento" onclick="duplicarEEditar('${editingId}')">${appIcon('copy')}Duplicar</button>`:''}<button class="btn btn-ghost" onclick="closeForm()">Cancelar</button><button class="btn btn-pri" id="save-btn" onclick="saveForm()">${appIcon('file')}Salvar Lançamento</button>`;
}

function setFormTipo(t){formData.tipo=t;formData.cat='';formData.sub='';buildForm();}
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
function updateFormTotal(){const el=document.getElementById('form-total');if(el)el.textContent=fmt(parseMoney(formData.valorLiq||0)+parseMoney(formData.valorJuros||0));}

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

// ── MODAL PAGAMENTO PARCIAL ────────────────────────────────────────────────
let _parcialCtx=null; // {original, totalOriginal, jaPago, pendente, canonicalComp, acaoTxt}
let _parcialRows=[]; // [{valor, conta, data}]

function closeParcialModal(){document.getElementById('parcial-overlay').style.display='none';}

function baixarParcial(){
  if(!editingId){toast('Salve o lançamento antes.','err');return;}
  const original=DATA.find(l=>l.id===editingId);
  if(!original){toast('Lançamento não encontrado.','err');return;}
  const canonicalComp=compFromView(formData.dataCompView)||formData.dataComp;
  if(!canonicalComp){toast('Informe a competência antes.','err');return;}
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
        ${_parcialRows.length>1?`<button onclick="_parcialRemRow(${i})" style="background:rgba(248,81,73,.1);color:var(--red);border:1px solid rgba(248,81,73,.2);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px">✕</button>`:'<span style="display:inline-block;width:32px"></span>'}
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
        <span style="margin-left:16px;color:var(--tx2)">Saldo após: </span><strong style="color:${saldoApos<=0.005?'var(--ok)':'#ff8c00'}">${saldoApos<=0.005?'Quitado ✓':fmt(saldoApos)}</strong>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-ghost" onclick="closeParcialModal()">Cancelar</button>
      <button class="btn btn-pri" id="parcial-confirm-btn" ${ok?'':'disabled'} onclick="confirmarParcialModal()" style="min-width:140px">
        ${appIcon('wallet')}${saldoApos<=0.005?'Quitar lançamento':'Confirmar pagamento'}
      </button>
    </div>`;
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
      <span style="margin-left:16px;color:var(--tx2)">Saldo após: </span><strong style="color:${saldoApos<=0.005?'var(--ok)':'#ff8c00'}">${saldoApos<=0.005?'Quitado ✓':fmt(saldoApos)}</strong>
    </div>`;
  }
  if(btn){btn.disabled=!ok;btn.innerHTML=appIcon('wallet')+(saldoApos<=0.005?'Quitar lançamento':'Confirmar pagamento');}
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
  const rows=_parcialRows.filter(r=>parseMoney(r.valor)>0);
  if(!rows.length){toast('Informe ao menos um valor.','err');return;}
  for(const r of rows){
    if(!r.data||!/^\d{4}-\d{2}-\d{2}$/.test(r.data)){toast('Verifique as datas.','err');return;}
    if(!r.conta||!CONTAS.includes(r.conta)){toast(`Conta inválida: ${r.conta}`,'err');return;}
  }
  const totalNovo=rows.reduce((s,r)=>s+parseMoney(r.valor),0);
  const novoTotalPago=+(jaPago+totalNovo).toFixed(2);
  const saldoApos=+(totalOriginal-novoTotalPago).toFixed(2);
  const quitado=saldoApos<=0.005;
  const novoStatus=quitado?(original.tipo==='R'?'Recebido':'Pago'):'Parcial';

  const btn=document.getElementById('parcial-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  setSyncStatus('loading','Salvando...');
  try{
    // Cria uma entrada "Recebido" para cada linha de pagamento
    const dataPrincipal=rows[rows.length-1].data; // data mais recente para o lançamento original
    const obsExtra=rows.map(r=>`${dateBR(r.data)} ${esc(r.conta)}: ${fmt(parseMoney(r.valor))}`).join(' + ');
    const prevHist=extractParcHist(original.obs||'');
    const newHist=[...prevHist,...rows.map(r=>({d:r.data,v:parseMoney(r.valor)}))];
    const cleanObs=stripParcHist(original.obs||'');
    const updated={
      ...original,
      dataComp:canonicalComp,
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

    // Se múltiplas contas: registra sub-entradas para rastrear cada conta no extrato
    if(rows.length>1){
      for(const r of rows){
        const sub={
          id:newId(),
          tipo:original.tipo,
          dataComp:canonicalComp,
          dataPgto:r.data,
          cat:original.cat,sub:original.sub,
          desc:`${original.desc||''} (parcial)`,
          forma:original.forma||'PIX',
          conta:r.conta,
          valorBruto:parseMoney(r.valor),ded:0,valorLiq:parseMoney(r.valor),
          status:original.tipo==='R'?'Recebido':'Pago',
          obs:`Receb. parcial vinculado a: ${original.desc||''} — ${dateBR(r.data)}`
        };
        const subRow=toRow(sub);
        const res=await sbFetch('POST',TABLE,subRow);
        const saved=Array.isArray(res)?res[0]:res;
        if(saved)DATA.unshift(fromRow(saved));
      }
    } else {
      // Conta única: apenas atualiza a conta no lançamento original
      updated.conta=rows[0].conta;
      await dbUpdate({...DATA.find(l=>l.id===original.id),...updated,conta:rows[0].conta});
      const i2=DATA.findIndex(l=>l.id===original.id);
      if(i2>=0)DATA[i2].conta=rows[0].conta;
    }

    setSyncStatus('ok',`${DATA.length} registros`);
    closeParcialModal();closeForm();buildNav();renderKeepScroll();
    toast(quitado?`Lançamento quitado ✓ (${fmt(novoTotalPago)} ${acaoTxt})`:`${fmt(totalNovo)} ${acaoTxt}. Pendente: ${fmt(saldoApos)}.`,'ok');
  }catch(e){
    setSyncStatus('err','Erro');
    toast('Erro: '+e.message,'err');
    if(btn){btn.disabled=false;btn.innerHTML=appIcon('wallet')+'Confirmar pagamento';}
  }
}

async function saveForm(){
  const canonicalComp = compFromView(formData.dataCompView)||formData.dataComp;
  const valorBruto = parseMoney(formData.valorBruto);
  const ded = parseMoney(formData.ded);
  const valorLiq = parseMoney(formData.valorLiq)||Math.max(0,valorBruto-ded);
  const valorJuros = parseMoney(formData.valorJuros||0);
  clearFormMarks();
  const _errs=[];
  if(!canonicalComp){_errs.push('Competência é obrigatória.');markInvalid('f-comp');}
  else{const e=validarAno(canonicalComp,'Competência');if(e){_errs.push(e);markInvalid('f-comp');}}
  if(formData.dataPgto){const e=validarAno(formData.dataPgto,'Data Pagamento');if(e){_errs.push(e);markInvalid('f-datapgto');}}
  if(!formData.cat){_errs.push('Categoria é obrigatória.');markInvalid('f-cat');}
  else{const ce=validateCatSub(formData.tipo,formData.cat,formData.sub);if(ce){_errs.push(ce);markInvalid('f-cat');}}
  if(valorBruto<=0){_errs.push('Valor bruto inválido.');markInvalid('f-vbruto');}
  if(valorLiq<=0){_errs.push('Valor líquido inválido.');markInvalid('form-valor-liq');}
  formData.conta=normalizeConta(formData.conta);
  if(!formData.conta||!CONTAS.includes(formData.conta)){_errs.push('Selecione uma conta bancária.');markInvalid('f-conta');}
  if(_errs.length){toast(_errs[0],'err');return;}

  // Resolve categoria/subcategoria de juros ANTES de salvar qualquer coisa
  let jurosCat=null, jurosSub=null;
  if(valorJuros>0){
    if(formData.tipo==='R'){
      const c=CATS_DATA['R'].find(x=>x.nome==='Receitas Financeiras');
      const s=(c?.subs||[]).find(x=>x.nome==='Juros/Multas');
      if(!c||!s){toast('Subcategoria "Juros/Multas" em "Receitas Financeiras" não encontrada.','err');return;}
      jurosCat=c.nome; jurosSub=s.nome;
    }else{
      const c=CATS_DATA['D'].find(x=>x.nome==='Despesas Financeiras');
      const s=(c?.subs||[]).find(x=>x.nome==='Juros/Multas por Atrasos');
      if(!c||!s){toast('Subcategoria "Juros/Multas por Atrasos" em "Despesas Financeiras" não encontrada.','err');return;}
      jurosCat=c.nome; jurosSub=s.nome;
    }
  }

  formData.dataComp = canonicalComp;
  formData.valorBruto = valorBruto;
  formData.ded = ded;
  formData.valorLiq = valorLiq;
  const btn=document.getElementById('save-btn');if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  setSyncStatus('loading','Salvando...');
  try{
    const exists=DATA.findIndex(x=>x.id===formData.id);
    if(exists>=0){await dbUpdate(formData);DATA[exists]={...formData};}
    else{const saved=await dbInsert(formData);DATA.unshift(saved?fromRow(saved):{...formData});}

    if(jurosCat&&jurosSub){
      const je={
        id:newId(), tipo:formData.tipo,
        dataComp:formData.dataPgto?(formData.dataPgto.slice(0,7)+'-01'):formData.dataComp, dataPgto:formData.dataPgto||'',
        cat:jurosCat, sub:jurosSub,
        desc:(formData.desc?formData.desc+' — Juros/Multas':'Juros/Multas'),
        cc:formData.cc||'', forma:formData.forma||'PIX', conta:formData.conta,
        doc:formData.doc||'', valorBruto:valorJuros, ded:0, valorLiq:valorJuros,
        status:formData.status, obs:formData.obs||''
      };
      const savedJe=await dbInsert(je);
      DATA.unshift(savedJe?fromRow(savedJe):{...je});
    }

    setSyncStatus('ok',`${DATA.length} registros`);closeForm();buildNav();renderKeepScroll();
    toast(jurosCat?'2 lançamentos salvos! ✓':'Lançamento salvo! ✓','ok');
  }catch(e){setSyncStatus('err','Erro ao salvar');toast('Erro ao salvar: '+e.message,'err');if(btn){btn.disabled=false;btn.innerHTML=appIcon('file')+'Salvar Lançamento';}}
}

async function duplicarLancamento(id){
  const orig=DATA.find(l=>l.id===id);
  if(!orig)return;
  const copia={...orig,id:newId(),status:'Pendente',dataPgto:''};
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
  try{
    const res=await dbInsert(copia);
    const novo=res?fromRow(res):copia;
    DATA.unshift(novo);
    buildNav();renderKeepScroll();
    openEdit(novo.id);
  }catch(e){toast('Erro ao duplicar: '+e.message,'err');}
}

async function deleteItem(id){
  const item=DATA.find(x=>x.id===id);
  const isTransf=(item?.doc||'').startsWith('TRANSF#');
  if(!confirm(isTransf?'Excluir esta transferência (ambos os lançamentos)?':'Excluir este lançamento?'))return;
  setSyncStatus('loading','Excluindo...');
  try{
    const pairIds=isTransf?DATA.filter(x=>x.doc===item.doc&&x.id!==id).map(x=>x.id):[];
    await dbDelete(id);
    for(const pid of pairIds)await dbDelete(pid);
    DATA=DATA.filter(x=>x.id!==id&&!pairIds.includes(x.id));
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();renderKeepScroll();
    toast(isTransf?'Transferência excluída.':'Lançamento excluído.','err');
  }catch(e){setSyncStatus('err','Erro ao excluir');toast('Erro ao excluir: '+e.message,'err');}
}

// ——— Transferência entre Contas ———
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
  if(!valor||valor<=0){toast('Informe um valor válido.','err');return;}
  setSyncStatus('loading','Salvando transferência...');
  try{
    await ensureTransfCat();
    const ref='TRANSF#'+newId();
    const descFinal=desc||`Transferência: ${origem} → ${destino}`;
    const recD={id:newId(),tipo:'D',dataComp:data,dataPgto:data,cat:TRANSF_CAT,sub:TRANSF_CAT,desc:descFinal,conta:origem,doc:ref,valorBruto:valor,ded:0,valorLiq:valor,status,obs:`TRANSF_DEST:${destino}`};
    const recR={id:newId(),tipo:'R',dataComp:data,dataPgto:data,cat:TRANSF_CAT,sub:TRANSF_CAT,desc:descFinal,conta:destino,doc:ref,valorBruto:valor,ded:0,valorLiq:valor,status,obs:`TRANSF_ORIG:${origem}`};
    const [savedD,savedR]=await Promise.all([dbInsert(recD),dbInsert(recR)]);
    DATA.unshift(fromRow(savedR||recR));
    DATA.unshift(fromRow(savedD||recD));
    setSyncStatus('ok',`${DATA.length} registros`);
    closeTransfModal();
    buildNav();renderKeepScroll();
    toast('Transferência registrada!','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro ao salvar: '+e.message,'err');}
}
// ——————————————————————————————————

let recData={};
function openEditRecorrente(id){
  const item=RECORRENTES_DESPESAS.find(r=>r.id===id)||{id:newId(),desc:'',cat:'',sub:'',valor:0,diaVenc:null,compOffset:0,conta:''};
  recData={...item,tipo:'D'};
  document.getElementById('modal-ttl').textContent=id?'Editar Despesa Recorrente':'Nova Despesa Recorrente';
  const seqEl=document.getElementById('modal-seq');if(seqEl){seqEl.textContent='';seqEl.style.display='none';}
  const footer=document.getElementById('modal-footer');if(footer)footer.innerHTML='';
  buildFormRecorrente();
  document.getElementById('overlay').style.display='flex';
}

function buildFormRecorrente(){
  const cats=Object.keys(CATS['D']||{});
  const subs=(CATS['D']?.[recData.cat])||[];
  const offsetOpts=[
    {v:-1,lbl:'-1 — Mês anterior ao vencimento (ex: salário)'},
    {v:0, lbl:'0 — Mesmo mês do vencimento'},
    {v:1, lbl:'+1 — Mês seguinte ao vencimento'},
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
  if(!recData.desc||!recData.cat||valor<=0){toast('Preencha os campos obrigatórios (*)','err');return;}
  const catErr=validateCatSub('D',recData.cat,recData.sub);
  if(catErr){toast(catErr,'err');return;}
  recData.valor=valor;
  const idx=RECORRENTES_DESPESAS.findIndex(r=>r.id===recData.id);
  try{
    if(idx>=0){
      await sbFetch('PATCH',`recorrentes?id=eq.${recData.id}`,toRecorrenteRow(recData));
      RECORRENTES_DESPESAS[idx]={...recData};
    } else {
      await sbFetch('POST','recorrentes',toRecorrenteRow(recData));
      RECORRENTES_DESPESAS.push({...recData});
    }
  }catch(e){toast('Erro ao salvar: '+e.message,'err');return;}
  closeForm();render();toast('Recorrente salvo! ✓','ok');
}

async function deleteRecorrente(id){
  if(!confirm('Excluir este recorrente permanentemente?'))return;
  try{
    await sbFetch('DELETE',`recorrentes?id=eq.${id}`);
    const idx=RECORRENTES_DESPESAS.findIndex(r=>r.id===id);
    if(idx>=0)RECORRENTES_DESPESAS.splice(idx,1);
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
      const va=a[sortRec.col]??999, vb=b[sortRec.col]??999;
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
          <button class="btn btn-pri" onclick="gerarRecorrentes()">⚡ Gerar Despesas do Mês</button>
        </div>
      </div>
    </div>
    <div class="tbl-wrap">
      <div class="tbl-hdr"><div class="sec-ttl">${appIcon('arrowUp')}Despesas Recorrentes <span class="yr-pill">${RECORRENTES_DESPESAS.length} itens</span></div><button class="btn btn-ghost" style="font-size:12px" onclick="openEditRecorrente('')">${appIcon('plus')}Nova</button></div>
      <div style="padding:10px 18px 0;display:flex;gap:10px;align-items:center">
        <input type="text" placeholder="Buscar descrição, categoria..." value="${esc(filterRecBusca)}"
          oninput="filterRecBusca=this.value;renderRecorrentes(document.getElementById('content'))"
          style="background:var(--s2);border:1px solid var(--bd2);color:var(--tx);border-radius:8px;padding:6px 12px;font-size:13px;width:280px"/>
        ${filterRecBusca?`<button class="btn btn-ghost" style="font-size:12px" onclick="filterRecBusca='';renderRecorrentes(document.getElementById('content'))">✕ Limpar</button>`:''}
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
            <td style="text-align:center">${r.diaVenc?'Dia '+r.diaVenc:'—'}</td>
            <td style="font-size:12px;color:var(--tx2)">${r.compOffset===-1?'-1 (mês ant.)':r.compOffset===1?'+1 (mês seg.)':'0 (mesmo mês)'}</td>
            <td>${esc(r.conta||'—')}</td>
            <td style="white-space:nowrap"><button class="btn btn-ghost" title="Editar" style="padding:4px 8px;font-size:12px" onclick="openEditRecorrente('${r.id}')">${appIcon('edit')}</button> <button class="btn btn-ghost" title="Excluir" style="padding:4px 8px;font-size:12px;color:var(--red)" onclick="deleteRecorrente('${r.id}')">${appIcon('trash')}</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
}

async function gerarRecorrentes(){
  const mesVal=document.getElementById('rec-mes').value;
  if(!mesVal){toast('Selecione o mês de vencimento','err');return;}
  const [anoStr,mesStr]=mesVal.split('-');
  const ano=parseInt(anoStr), mes=parseInt(mesStr);

  const semDia=RECORRENTES_DESPESAS.filter(r=>!r.diaVenc);
  if(semDia.length>0&&!confirm(`${semDia.length} despesa(s) sem dia de vencimento serão ignoradas. Continuar?`))return;

  const comDia=RECORRENTES_DESPESAS.filter(r=>r.diaVenc);
  if(!comDia.length){toast('Nenhuma despesa com dia de vencimento definido','err');return;}

  const anoMes=`${anoStr}-${mesStr}`;
  const jaExiste=DATA.filter(l=>l.dataPgto&&l.dataPgto.startsWith(anoMes)&&l.obs&&l.obs.includes('[recorrente]'));
  if(jaExiste.length>0&&!confirm(`Já existem ${jaExiste.length} lançamentos recorrentes para ${mesStr}/${anoStr}. Gerar novamente mesmo assim?`))return;

  const lista=comDia.map(r=>{
    const dataPgto=`${anoStr}-${mesStr}-${String(r.diaVenc).padStart(2,'0')}`;
    let compMes=mes+(r.compOffset||0), compAno=ano;
    if(compMes<1){compMes+=12;compAno--;}else if(compMes>12){compMes-=12;compAno++;}
    const dataComp=`${compAno}-${String(compMes).padStart(2,'0')}-01`;
    return{id:newId(),tipo:'D',dataComp,dataPgto,cat:r.cat,sub:r.sub,desc:r.desc,cc:'',forma:'PIX',conta:r.conta||'',doc:'',valorBruto:r.valor,ded:0,valorLiq:r.valor,status:'Pendente',obs:'[recorrente]'};
  });

  setSyncStatus('loading',`Gerando ${lista.length} lançamentos...`);
  try{
    for(let i=0;i<lista.length;i+=50){await sbFetch('POST',TABLE,lista.slice(i,i+50).map(toRow));}
    lista.forEach(l=>DATA.unshift(l));
    setSyncStatus('ok',`${DATA.length} registros`);
    buildNav();
    toast(`✓ ${lista.length} lançamentos gerados (venc. ${mesStr}/${anoStr})!`,'ok');
    render();
  }catch(e){setSyncStatus('err','Erro ao gerar');toast('Erro: '+e.message,'err');}
}

// ── Categorias (Supabase + Drag & Drop) ──────────────────────────
let _catTipo = 'R';
let _dragCat = null;
let _dragSub = null;

function renderCategorias(c){
  const recCats = CATS_DATA.R||[];
  const despCats = CATS_DATA.D||[];
  c.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
      <span style="font-size:11px;color:var(--tx3)">↕ Arraste para reordenar</span>
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
              ? `<span title="Excluído do DRE (sistema)" style="padding:2px 8px;font-size:10px;border-radius:99px;border:1px solid rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red);opacity:.6;cursor:default">✕ DRE</span>`
              : `<button onclick="toggleExcluirDRE('${cat.id}',${excluido})" title="${excluido?'Excluído do DRE — clique para incluir':'Incluído no DRE — clique para excluir'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${excluido?'rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red)':'rgba(57,211,83,.3);background:rgba(57,211,83,.1);color:var(--teal)'}">${excluido?'✕ DRE':'✓ DRE'}</button>`;
            const naoOp=(cat.fluxo||'operacional')==='nao_operacional';
            const fluxoBtn=`<button onclick="toggleFluxoCat('${cat.id}','${cat.fluxo||'operacional'}')" title="${naoOp?'Não-Operacional — clique para marcar como Operacional':'Operacional — clique para marcar como Não-Operacional'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${naoOp?'rgba(240,136,62,.3);background:rgba(240,136,62,.1);color:var(--orange)':'rgba(88,166,255,.3);background:rgba(88,166,255,.1);color:var(--blue)'}"> ${naoOp?'Não-Op.':'Op.'}</button>`;
            return `
            <div class="cat-card" id="cat-${cat.id}" draggable="true"
              ondragstart="onCatDragStart(event,'${cat.id}')"
              ondragover="onCatDragOver(event,'${cat.id}')"
              ondragleave="onCatDragLeave(event,'${cat.id}')"
              ondrop="onCatDrop(event,'${cat.id}')">
              <div class="cat-hdr">
                <div style="display:flex;align-items:center;gap:8px;flex:1">
                  <span class="drag-handle">⠿</span>
                  <span style="font-size:14px;font-weight:600;color:var(--tx)">${esc(cat.nome)}</span>
                  ${dreBtn}
                  ${fluxoBtn}
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
                      <span style="color:var(--tx3);font-size:12px">⠿</span>
                      <span style="font-size:12.5px;color:var(--tx)">${esc(sub.nome)}</span>
                    </div>
                    <div>
                      <button onclick="editarSub('${sub.id}','${esc(sub.nome)}')" title="Editar" style="background:none;border:none;color:var(--tx3);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('edit')}</button>
                      <button onclick="excluirSub('${sub.id}','${esc(sub.nome)}','${cat.id}')" style="background:none;border:none;color:var(--red);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">✕</button>
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
              ? `<span title="Excluído do DRE (sistema)" style="padding:2px 8px;font-size:10px;border-radius:99px;border:1px solid rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red);opacity:.6;cursor:default">✕ DRE</span>`
              : `<button onclick="toggleExcluirDRE('${cat.id}',${excluido})" title="${excluido?'Excluído do DRE — clique para incluir':'Incluído no DRE — clique para excluir'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${excluido?'rgba(248,81,73,.3);background:rgba(248,81,73,.1);color:var(--red)':'rgba(57,211,83,.3);background:rgba(57,211,83,.1);color:var(--teal)'}">${excluido?'✕ DRE':'✓ DRE'}</button>`;
            const naoOp=(cat.fluxo||'operacional')==='nao_operacional';
            const fluxoBtn=`<button onclick="toggleFluxoCat('${cat.id}','${cat.fluxo||'operacional'}')" title="${naoOp?'Não-Operacional — clique para marcar como Operacional':'Operacional — clique para marcar como Não-Operacional'}" style="padding:2px 8px;font-size:10px;border-radius:99px;cursor:pointer;border:1px solid ${naoOp?'rgba(240,136,62,.3);background:rgba(240,136,62,.1);color:var(--orange)':'rgba(88,166,255,.3);background:rgba(88,166,255,.1);color:var(--blue)'}"> ${naoOp?'Não-Op.':'Op.'}</button>`;
            return `
            <div class="cat-card" id="cat-${cat.id}" draggable="true"
              ondragstart="onCatDragStart(event,'${cat.id}')"
              ondragover="onCatDragOver(event,'${cat.id}')"
              ondragleave="onCatDragLeave(event,'${cat.id}')"
              ondrop="onCatDrop(event,'${cat.id}')">
              <div class="cat-hdr">
                <div style="display:flex;align-items:center;gap:8px;flex:1">
                  <span class="drag-handle">⠿</span>
                  <span style="font-size:14px;font-weight:600;color:var(--tx)">${esc(cat.nome)}</span>
                  ${dreBtn}
                  ${fluxoBtn}
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
                      <span style="color:var(--tx3);font-size:12px">⠿</span>
                      <span style="font-size:12.5px;color:var(--tx)">${esc(sub.nome)}</span>
                    </div>
                    <div>
                      <button onclick="editarSub('${sub.id}','${esc(sub.nome)}')" title="Editar" style="background:none;border:none;color:var(--tx3);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">${appIcon('edit')}</button>
                      <button onclick="excluirSub('${sub.id}','${esc(sub.nome)}','${cat.id}')" style="background:none;border:none;color:var(--red);font-size:11px;padding:0 2px;cursor:pointer;line-height:1">✕</button>
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

// ── Drag & Drop — Categorias ──────────────────────────────────────
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

// ── Drag & Drop — Subcategorias ───────────────────────────────────
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

// ── CRUD Categorias ───────────────────────────────────────────────
async function adicionarCategoria(){
  const nome=prompt('Nome da nova categoria:');
  if(!nome||!nome.trim())return;
  const n=nome.trim();
  if(CATS_DATA[_catTipo].find(c=>c.nome===n)){toast('Categoria já existe!','err');return;}
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
    toast(novo==='nao_operacional'?'Marcada como Não-Operacional':'Marcada como Operacional','ok');
  }catch(e){setSyncStatus('err','Erro');toast('Erro ao salvar: '+e.message,'err');}
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
  if(!confirm(`Excluir "${nome}" e todas as subcategorias?`))return;
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
  if((cat.subs||[]).find(s=>s.nome===n)){toast('Subcategoria já existe!','err');return;}
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
  if(!confirm(`Excluir "${nome}"?`))return;
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

