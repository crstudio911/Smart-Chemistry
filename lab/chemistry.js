window.LabChemistry = (() => {
  const MAX_VOLUME = 100;
  const concentration = 0.1;
  function evaluate(additions) {
    const volume = additions.reduce((sum,a) => sum+a.volume,0);
    const amounts = {};
    additions.forEach(a => { amounts[a.id] = (amounts[a.id] || 0) + a.volume*concentration; });
    const ids = Object.keys(amounts);
    const initial = {volume,amounts,precipitate:0,massMg:0,gasMl:0,ph:null,color:'clear',solutionColor:'clear',extent:0,dissolved:0};
    if (!ids.length) return {...initial,status:'empty'};
    const remainingColor = () => window.LabCatalog.reagents.find(r => r.id === ids[0])?.color || 'clear';
    if (ids.length === 1) return {...initial,status:'single',solutionColor:remainingColor()};
    const reaction = window.LabCatalog.reactions.find(r => ids.length === 2 && ids.includes(r.a) && ids.includes(r.b));
    if (!reaction) return {...initial,status:'unsupported'};
    if (reaction.id === 'carbonate-gas' && amounts[reaction.b] < amounts[reaction.a]*2-1e-9) return {...initial,status:'partial-carbonate',reaction};
    const extent = Math.min(amounts[reaction.a]/reaction.ratio[0],amounts[reaction.b]/reaction.ratio[1]);
    const excessA = Math.max(0,amounts[reaction.a]-extent*reaction.ratio[0]);
    let excessB = Math.max(0,amounts[reaction.b]-extent*reaction.ratio[1]);
    const dissolved = reaction.extraOH ? Math.min(extent,excessB/reaction.extraOH) : 0;
    excessB -= dissolved*(reaction.extraOH || 0);
    const precipitate = reaction.type === 'precipitation' ? Math.max(0,extent-dissolved) : 0;
    const reagent = window.LabCatalog.reagents.find(r => r.id === reaction.a);
    const solutionColor = excessA > 1e-9 ? reagent.color : 'clear';
    let ph = null;
    if (reaction.type === 'neutralization') {
      const net = (amounts.hcl-amounts.naoh)/volume;
      ph = Math.abs(net) < 1e-12 ? 7 : net>0 ? -Math.log10(net) : 14+Math.log10(-net);
    }
    return {...initial,status:'known',reaction,extent,precipitate,dissolved,massMg:precipitate*reaction.mass,gasMl:reaction.type==='gas'?extent*24.47:0,ph,color:reaction.color,solutionColor,excessA,excessB};
  }
  function add(additions,id,volume) {
    if (!window.LabCatalog.reagents.some(r => r.id === id)) return {ok:false,error:'المادة غير موجودة.'};
    if (!Number.isFinite(volume) || volume<1 || volume>50) return {ok:false,error:'اختار كمية من 1 إلى 50 مل.'};
    if (additions.reduce((sum,a)=>sum+a.volume,0)+volume>MAX_VOLUME) return {ok:false,error:'الكأس ممتلئ؛ أقصى حجم 100 مل.'};
    const unique = new Set([...additions.map(a=>a.id),id]);
    if (unique.size>2) return {ok:false,error:'هذه النسخة تدعم مادتين فقط في التجربة؛ فرّغ الكأس قبل خليط جديد.'};
    return {ok:true,additions:[...additions,{id,volume}]};
  }
  return Object.freeze({evaluate,add,MAX_VOLUME,concentration});
})();
