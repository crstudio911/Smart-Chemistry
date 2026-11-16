(() => {
  const $ = s => document.querySelector(s);
  const catalog = window.LabCatalog;
  let selected = catalog.reagents[0];
  let additions = [], journal = [], filtered = false, pouring = false;
  let mode='guided', progress=window.LabAnions.initial('chloride'), guidedBusy=false;
  const experiment = $('#experiment');
  catalog.reactions.forEach(r => { const o = document.createElement('option'); o.value=r.id; o.textContent=r.name; experiment.append(o); });
  function log(text) {
    const time = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
    journal.push({time,text});
    const li=document.createElement('li'),span=document.createElement('span'),stamp=document.createElement('time');
    span.textContent=text; stamp.textContent=time;li.append(span,stamp);$('#journal').prepend(li);
  }
  function select(id) {
    selected=catalog.reagents.find(r=>r.id===id) || selected;
    $('#selected-name').textContent=selected.name;$('#selected-formula').textContent=selected.formula;
    document.querySelectorAll('.reagent').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===selected.id)));
  }
  function renderReagents() {
    const q=$('#reagent-search').value.trim().toLowerCase();$('#reagents').replaceChildren();
    catalog.reagents.filter(r=>r.name.includes(q)||r.formula.toLowerCase().includes(q)||r.id.includes(q)).forEach(r=>{
      const b=document.createElement('button');b.className='reagent';b.type='button';b.dataset.id=r.id;b.dataset.color=r.color;b.setAttribute('aria-label',r.name);b.setAttribute('aria-pressed',String(r.id===selected.id));
      b.innerHTML='<svg viewBox="0 0 24 36" aria-hidden="true"><path d="M8 2h8v6l3 4v20H5V12l3-4Z"/><path d="M5 18h14M8 2v6h8"/></svg>';
      const div=document.createElement('div'),name=document.createElement('strong'),formula=document.createElement('small');name.textContent=r.name;formula.textContent=r.formula;formula.dir='ltr';div.append(name,formula);b.append(div);b.addEventListener('click',()=>select(r.id));$('#reagents').append(b);
    });
  }
  function updateFree() {
    const result=window.LabChemistry.evaluate(additions);
    $('#bench-volume').textContent=`${result.volume} / 100 mL`;
    const known=result.status==='known';
    const titles={empty:'الكأس جاهز',single:'المادة في الكأس',unsupported:'النتيجة غير معروفة', 'partial-carbonate':'تحتاج نموذج اتزان'};
    $('#result-title').textContent=known?result.reaction.name:titles[result.status];
    let observation={empty:'لم تُضف أي مادة بعد.',single:'محلول منفرد؛ أضف المادة الثانية لمتابعة التجربة.',unsupported:'الخليط غير موجود في التفاعلات المدعومة؛ لا نقدر نؤكد اللون أو وجود راسب أو حدوث تفاعل.', 'partial-carbonate':'الحمض غير كافٍ لتحويل كل الكربونات إلى CO₂. تكوّن البيكربونات والاتزان غير ممثّلين؛ أضف حمضًا حتى نسبة 2:1 مولية أو فرّغ الكأس.'}[result.status];
    if(known) {
      observation=result.reaction.observation;
      if(result.dissolved>0) observation+=result.precipitate<1e-9?' اختفى الراسب مع فائض القاعدة.':' ذاب جزء من الراسب مع فائض القاعدة.';
      if(filtered&&result.precipitate>0) observation+=' تم فصل الراسب على ورقة الترشيح.';
      if($('#indicator').checked&&result.ph!==null) observation+=result.ph>=8.2?' الدليل يظهر ورديًا في الوسط القاعدي.':' الدليل عديم اللون.';
    }
    $('#result-observation').textContent=observation;
    $('#reaction-equation').hidden=!known;$('#ionic-equation').hidden=!known;
    if(known) {$('#reaction-equation').textContent=result.reaction.equation;$('#ionic-equation').textContent=result.dissolved>0?result.reaction.dissolution:result.reaction.ionic;}
    $('#precipitate-reading').textContent=known?`${result.massMg.toFixed(1)} mg`:'—';$('#precipitate-label').textContent=known&&result.precipitate>0?result.reaction.product:'';
    $('#gas-reading').textContent=known?`${result.gasMl.toFixed(2)} mL`:'—';$('#ph-reading').textContent=result.ph===null?'—':result.ph.toFixed(2);
    $('#lab-readings').hidden=false;
    $('#filter-action').disabled=!known||result.precipitate<1e-9||filtered||pouring;
    $('#stir').disabled=!result.volume||pouring;$('#indicator').disabled=!known||result.ph===null;
    $('#add-reagent').disabled=pouring||filtered||result.volume>=100;$('#reset-lab').disabled=pouring;
    $('#lab-scene-description').textContent=observation;
    $('#lab-stage').dataset.reactionId=known?result.reaction.id:result.status;
    window.dispatchEvent(new CustomEvent('lab-state',{detail:{...result,filtered,indicator:$('#indicator').checked}}));
    return result;
  }
  function updateGuided() {
    const r=window.LabAnions.result(progress);
    const next=progress.completed===0?'ضع العينة على الطاولة':r.test.steps[progress.completed-1]?.action||'اكتملت التجربة';
    $('#guided-next-label').textContent=next;$('#guided-next').disabled=guidedBusy||r.done;
    $('#guided-restart').disabled=guidedBusy;$('#guided-test').disabled=guidedBusy;
    $('#free-mode').disabled=guidedBusy;
    $('#guided-name').textContent=r.test.name;$('#guided-formula').textContent=r.test.formula;$('#guided-count').textContent=`${progress.completed} / ${r.test.steps.length+1}`;
    $('#result-title').textContent=r.done?'اكتملت الملاحظات · '+r.test.name:r.current?'ملاحظة الخطوة':'عينة '+r.test.name;
    $('#result-observation').textContent=r.observation;
    $('#reaction-equation').textContent=r.equation;$('#reaction-equation').hidden=!r.equation;$('#ionic-equation').hidden=true;
    $('#lab-readings').hidden=true;$('#bench-volume').textContent=r.test.formula;
    $('#result-foot').textContent='كشف نوعي لعينة منفردة؛ لا تُحسب كتلة الراسب أو حجم الغاز. التداخلات مذكورة مع كل اختبار.';
    $('#filter-action').disabled=true;$('#stir').disabled=!r.volume||guidedBusy;$('#reset-lab').disabled=guidedBusy;
    $('#lab-stage').dataset.reactionId=r.test.id;$('#lab-scene-description').textContent=r.observation;
    window.dispatchEvent(new CustomEvent('lab-state',{detail:{...r,filtered:false,indicator:false}}));return r;
  }
  function update(){return mode==='guided'?updateGuided():updateFree();}
  function changeMode(next){mode=next;$('#content').dataset.mode=mode;$('.reagent-shelf').hidden=mode==='guided';$('#guided-action').hidden=mode!=='guided';$('#guided-progress').hidden=mode!=='guided';$('#guided-test').closest('.field').hidden=mode!=='guided';$('#guided-mode').setAttribute('aria-pressed',String(mode==='guided'));$('#free-mode').setAttribute('aria-pressed',String(mode==='free'));$('#guided-mode').className='btn '+(mode==='guided'?'primary':'outline');$('#free-mode').className='btn '+(mode==='free'?'primary':'outline');$('#lab-readings').hidden=mode==='guided';update();}
  window.LabAnions.tests.forEach(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=t.name+' · '+t.formula;$('#guided-test').append(option);});
  $('#guided-mode').addEventListener('click',()=>changeMode('guided'));$('#free-mode').addEventListener('click',()=>changeMode('free'));
  $('#guided-test').addEventListener('change',()=>{progress=window.LabAnions.initial($('#guided-test').value);log('تجربة جديدة: '+window.LabAnions.result(progress).test.name);update();});
  $('#guided-restart').addEventListener('click',()=>{progress=window.LabAnions.initial(progress.id);update();});
  $('#guided-next').addEventListener('click',async()=>{if(guidedBusy)return;guidedBusy=true;update();if(window.LabScene)await window.LabScene.pour('clear');progress=window.LabAnions.advance(progress);guidedBusy=false;const r=update();log(r.current?r.current.action+' · '+r.observation:'وضعت عينة '+r.test.name+' على الطاولة.');});
  function reset() { if(mode==='guided'){progress=window.LabAnions.initial(progress.id);update();return;} additions=[];filtered=false;$('#indicator').checked=false;$('#lab-feedback').hidden=true;log('تم تفريغ الكأس وتجهيزه لتجربة جديدة.');update(); }
  async function add() {
    const amount=Number($('#dose').value),check=window.LabChemistry.add(additions,selected.id,amount);
    if(!check.ok){$('#lab-feedback').textContent=check.error;$('#lab-feedback').hidden=false;return;}
    $('#lab-feedback').hidden=true;pouring=true;update();
    const reagent=selected;
    if(window.LabScene) await window.LabScene.pour(reagent.color);
    additions=check.additions;pouring=false;log(`أضفت ${amount} مل من ${reagent.name} (${reagent.formula}).`);update();
  }
  $('#dose').addEventListener('input',()=>{$('#dose-value').textContent=`${$('#dose').value} mL`;});
  $('#reagent-search').addEventListener('input',renderReagents);$('#add-reagent').addEventListener('click',add);$('#reset-lab').addEventListener('click',reset);
  experiment.addEventListener('change',()=>{
    reset();const r=catalog.reactions.find(r=>r.id===experiment.value);
    $('#recipe-description').textContent=r?`${catalog.reagents.find(a=>a.id===r.a).name} + ${catalog.reagents.find(a=>a.id===r.b).name} · النسبة المولية ${r.ratio.join(' : ')}`:'اختار المواد من الرف.';
    $('#choose-first').disabled=!r;$('#choose-second').disabled=!r;if(r)select(r.a);
  });
  $('#choose-first').addEventListener('click',()=>{const r=catalog.reactions.find(r=>r.id===experiment.value);if(r)select(r.a);});
  $('#choose-second').addEventListener('click',()=>{const r=catalog.reactions.find(r=>r.id===experiment.value);if(r)select(r.b);});
  $('#stir').addEventListener('click',()=>{window.LabScene?.stir();log('قلّبت المحلول لتوزيع الراسب؛ الحساب الكيميائي لم يتغيّر.');});
  $('#filter-action').addEventListener('click',()=>{filtered=true;log('رشّحت الراسب وفصلته على ورقة الترشيح.');update();});
  $('#indicator').addEventListener('change',()=>{log($('#indicator').checked?'أضفت دليل الفينولفثالين.':'ألغيت عرض الدليل.');update();});
  $('#lab-info-open').addEventListener('click',()=>$('#lab-info').showModal());$('#lab-info-close').addEventListener('click',()=>$('#lab-info').close());
  $('#export-lab').addEventListener('click',()=>{
    const r=update();const readings=r.qualitative?['كشف نوعي؛ الكتلة وحجم الغاز وpH غير محسوبة.']:['النتائج النظرية:',$('#precipitate-reading').textContent,$('#gas-reading').textContent,'pH: '+$('#ph-reading').textContent];const text=['Smart Chemistry — سجل المعمل',new Date().toLocaleString('ar-EG'),...journal.map(j=>`${j.time} | ${j.text}`),$('#result-observation').textContent,r.equation||r.reaction?.equation||'',...readings,'محاكاة تعليمية تقريبية؛ ليست نتائج معملية مضمونة.'].join('\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Smart_Chemistry_Lab.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  renderReagents();select(selected.id);$('#choose-first').disabled=true;$('#choose-second').disabled=true;changeMode('guided');
  window.addEventListener('lab-scene-ready',update);
  if(['localhost','127.0.0.1'].includes(location.hostname)) window.LabDebug={getState:()=>({...update(),mode,progress,additions:[...additions],filtered}),reset,add:(id,volume)=>{select(id);$('#dose').value=volume;return add();}};
})();
