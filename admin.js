'use strict';

const REPO = 'art-director-portfolio';
const BRANCH = 'main';
const DRAFT_KEY = 'vdmtx-portfolio-draft-v2';
const SITE_FIELDS = [
  ['heroTitle','Título principal'],['heroText','Texto principal'],['aboutLead','Destaque sobre você'],
  ['aboutText','Texto sobre você'],['contactTitle','Título de contato'],['contactText','Texto de contato']
];
const DEFAULT_STYLE = {bgColor:'#fafafa',textColor:'#1a1a1a',textLightColor:'#666666',borderColor:'#e5e5e5',imageLayout:'full',imageSize:'large',imageSpacing:1,imageAlign:'center'};

let auth = {username:'',token:''};
let publishedData = null;
let draftData = null;
let configSha = '';
let selectedSlug = '';
let selectedFiles = [];
let remoteImages = [];

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const apiHeaders = () => ({Authorization:'Bearer '+auth.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
const api = path => `https://api.github.com/repos/${encodeURIComponent(auth.username)}/${REPO}${path}`;

function showAlert(id,message,type='warning'){
  const el=$(id); if(!el)return;
  el.innerHTML=`<div class="alert ${type}">${esc(message)}</div>`;
}
function clearAlert(id){const el=$(id);if(el)el.innerHTML=''}
function openModal(id){$(id).classList.add('open')}
function closeModal(id){$(id).classList.remove('open')}
function localText(value,lang='pt'){
  if(value && typeof value==='object') return value[lang] || value.en || value.pt || Object.values(value)[0] || '';
  return value || '';
}
function normalizeSlug(value){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function setDirty(isDirty=true){
  $('publishDot').classList.toggle('published',!isDirty);
  $('draftStatus').textContent=isDirty?'Rascunho com alterações':'Publicado';
  if(isDirty && draftData)localStorage.setItem(DRAFT_KEY,JSON.stringify(draftData));
  renderStats();
}
function hasDraft(){return JSON.stringify(draftData)!==JSON.stringify(publishedData)}

function migrate(data){
  const out=clone(data||{}); out.schemaVersion=2;
  out.site=out.site||{}; out.site.translations=out.site.translations||{};
  out.competencies=(Array.isArray(out.competencies)?out.competencies:[]).map(c=>({
    title:typeof c.title==='object'?c.title:{pt:c.title||'',en:c.title||''},
    description:typeof c.description==='object'?c.description:{pt:c.description||'',en:c.description||''}
  }));
  out.cases=(Array.isArray(out.cases)?out.cases:[]).map((c,i)=>{
    c.style={...DEFAULT_STYLE,...(c.style||{})};
    c.folder=c.folder||`img/${c.slug}`;
    c.imageOrder=Array.isArray(c.imageOrder)?c.imageOrder:[];
    c.hiddenImages=Array.isArray(c.hiddenImages)?c.hiddenImages:[];
    c.translations=c.translations||{};
    c.translations.pt={...(c.translations.pt||{}),category:c.translations.pt?.category||c.category||''};
    c.translations.en={...(c.translations.en||{}),category:c.translations.en?.category||c.category||''};
    c.services=typeof c.services==='object'&&c.services?c.services:{pt:c.services||'',en:c.services||''};
    c.intro=typeof c.intro==='object'&&c.intro?c.intro:{pt:c.introText||'',en:c.introText||''};
    c.published=c.published!==false; c.featured=c.featured!==false && i<3;
    return c;
  });
  return out;
}

async function request(url,options={}){
  const res=await fetch(url,{...options,headers:{...apiHeaders(),...(options.headers||{})}});
  let body=null; try{body=await res.json()}catch(e){}
  if(!res.ok)throw new Error(body?.message||`Erro ${res.status}`);
  return body;
}

async function login(){
  clearAlert('loginAlert'); auth.username=$('githubUsername').value.trim(); auth.token=$('githubToken').value.trim();
  if(!auth.username||!auth.token){showAlert('loginAlert','Preencha o usuário e o token.','error');return}
  $('loginBtn').disabled=true; $('loginBtn').textContent='Entrando...';
  try{
    const user=await request('https://api.github.com/user');
    const file=await request(api('/contents/config.json?ref='+BRANCH));
    publishedData=migrate(JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g,'')))))); configSha=file.sha;
    const saved=localStorage.getItem(DRAFT_KEY);
    if(saved){try{draftData=migrate(JSON.parse(saved))}catch(e){draftData=clone(publishedData)}} else draftData=clone(publishedData);
    $('loginSection').classList.add('hidden'); $('adminPanel').classList.remove('hidden');
    bindWorkspace(); renderAll(); setDirty(hasDraft());
    showAlert('dashboardAlert',`Conectado como ${user.login}. O site público ainda não foi alterado.`,'success');
  }catch(e){showAlert('loginAlert','Não foi possível entrar: '+e.message,'error')}
  finally{$('loginBtn').disabled=false;$('loginBtn').textContent='Entrar'}
}

function bindWorkspace(){
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.view));
  $('newCaseBtn').onclick=()=>openCaseEditor(-1); $('closeCaseModal').onclick=()=>closeModal('caseModal');
  $('saveCaseBtn').onclick=saveCaseDraft; $('removeCaseBtn').onclick=removeCaseDraft; $('previewCaseBtn').onclick=previewEditingCase;
  $('publishBtn').onclick=preparePublish; $('closePublishModal').onclick=()=>closeModal('publishModal'); $('confirmPublishBtn').onclick=publish;
  $('previewCurrentBtn').onclick=()=>previewCase(selectedSlug||draftData.cases[0]?.slug);
  $('saveSiteBtn').onclick=saveSiteDraft; $('addCompetencyBtn').onclick=()=>addCompetency();
  $('caseSelect').onchange=e=>{selectedSlug=e.target.value;loadImages()};
  $('uploadArea').onclick=()=>$('fileInput').click(); $('fileInput').onchange=e=>queueFiles(e.target.files);
  $('uploadArea').ondragover=e=>{e.preventDefault();$('uploadArea').classList.add('drag')};
  $('uploadArea').ondragleave=()=>$('uploadArea').classList.remove('drag');
  $('uploadArea').ondrop=e=>{e.preventDefault();$('uploadArea').classList.remove('drag');queueFiles(e.dataTransfer.files)};
  $('uploadBtn').onclick=uploadImages; $('refreshVersionsBtn').onclick=loadVersions;
  window.onbeforeunload=()=>hasDraft()?'Há alterações ainda não publicadas.':'';
}
function switchView(name){
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); $(name+'View').classList.add('active');
  if(name==='versions')loadVersions(); if(name==='images'&&selectedSlug)loadImages();
}

function renderAll(){renderCases();renderCaseSelect();renderSiteFields();renderCompetencies();renderStats()}
function renderStats(){
  if(!draftData)return; const live=draftData.cases.filter(c=>c.published!==false).length,images=draftData.cases.reduce((n,c)=>n+c.imageOrder.length,0),draft=hasDraft();
  $('stats').innerHTML=`<div class="card"><div class="eyebrow">Cases visíveis</div><h2>${live}</h2></div><div class="card"><div class="eyebrow">Imagens ordenadas</div><h2>${images}</h2></div><div class="card"><div class="eyebrow">Situação</div><h2>${draft?'Rascunho':'Publicado'}</h2></div>`;
}
function renderCases(){
  const list=$('casesList'); if(!draftData.cases.length){list.innerHTML='<div class="empty">Nenhum case cadastrado.</div>';return}
  list.innerHTML=draftData.cases.map((c,i)=>`<div class="case-item" draggable="true" data-index="${i}"><div class="handle">⋮⋮</div><div><h3>${esc(c.title)}${c.published===false?'<span class="badge off">oculto</span>':''}${c.featured?'<span class="badge">destaque</span>':''}</h3><p>${esc(localText(c.translations?.pt?.category||c.category))} · ${esc(c.folder)}</p></div><div class="actions"><button class="btn btn-small" data-edit="${i}">Editar</button><button class="btn btn-small" data-images="${esc(c.slug)}">Imagens</button><button class="btn btn-small" data-preview="${esc(c.slug)}">Prévia</button></div></div>`).join('');
  list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openCaseEditor(Number(b.dataset.edit)));
  list.querySelectorAll('[data-images]').forEach(b=>b.onclick=()=>{selectedSlug=b.dataset.images;renderCaseSelect();switchView('images');loadImages()});
  list.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>previewCase(b.dataset.preview)); bindCaseDrag();
}
function bindCaseDrag(){let from=null;document.querySelectorAll('.case-item').forEach(el=>{el.ondragstart=()=>{from=Number(el.dataset.index);el.classList.add('dragging')};el.ondragend=()=>el.classList.remove('dragging');el.ondragover=e=>e.preventDefault();el.ondrop=()=>{const to=Number(el.dataset.index);if(from===null||from===to)return;const [item]=draftData.cases.splice(from,1);draftData.cases.splice(to,0,item);setDirty();renderCases();renderCaseSelect()}})}
function renderCaseSelect(){
  $('caseSelect').innerHTML='<option value="">Selecione um case</option>'+draftData.cases.map(c=>`<option value="${esc(c.slug)}" ${c.slug===selectedSlug?'selected':''}>${esc(c.title)}</option>`).join('');
}

function openCaseEditor(index){
  clearAlert('caseModalAlert'); const isNew=index<0; const c=isNew?{slug:'',title:'',folder:'',client:'',year:'',services:{pt:'',en:''},intro:{pt:'',en:''},translations:{pt:{category:''},en:{category:''}},style:{...DEFAULT_STYLE},published:true,featured:false,imageOrder:[],hiddenImages:[]}:draftData.cases[index];
  $('caseModalTitle').textContent=isNew?'Novo case':'Editar case'; $('editCaseIndex').value=index; $('editTitle').value=c.title||''; $('editSlug').value=c.slug||''; $('editSlug').disabled=!isNew;
  $('editCategoryPt').value=c.translations?.pt?.category||c.category||''; $('editCategoryEn').value=c.translations?.en?.category||c.category||'';
  $('editClient').value=c.client||''; $('editYear').value=c.year||''; $('editServicesPt').value=localText(c.services,'pt'); $('editServicesEn').value=localText(c.services,'en');
  $('editIntroPt').value=localText(c.intro,'pt')||c.introText||''; $('editIntroEn').value=localText(c.intro,'en')||''; $('editFolder').value=c.folder||''; $('editCover').value=c.cover||'';
  $('editBgColor').value=c.style?.bgColor||DEFAULT_STYLE.bgColor; $('editTextColor').value=c.style?.textColor||DEFAULT_STYLE.textColor; $('editTextLightColor').value=c.style?.textLightColor||DEFAULT_STYLE.textLightColor;
  $('editImageLayout').value=c.style?.imageLayout||'full'; $('editImageSize').value=c.style?.imageSize||'large'; $('editImageSpacing').value=c.style?.imageSpacing??1; $('editPublished').checked=c.published!==false; $('editFeatured').checked=!!c.featured;
  $('removeCaseBtn').classList.toggle('hidden',isNew); openModal('caseModal');
}
function readEditor(){
  const slug=normalizeSlug($('editSlug').value||$('editTitle').value); return {slug,title:$('editTitle').value.trim(),category:$('editCategoryEn').value.trim()||$('editCategoryPt').value.trim(),folder:$('editFolder').value.trim()||`img/${slug}`,client:$('editClient').value.trim(),year:$('editYear').value.trim(),services:{pt:$('editServicesPt').value.trim(),en:$('editServicesEn').value.trim()},intro:{pt:$('editIntroPt').value.trim(),en:$('editIntroEn').value.trim()},translations:{pt:{category:$('editCategoryPt').value.trim()},en:{category:$('editCategoryEn').value.trim()}},style:{bgColor:$('editBgColor').value,textColor:$('editTextColor').value,textLightColor:$('editTextLightColor').value,borderColor:'#e5e5e5',imageLayout:$('editImageLayout').value,imageSize:$('editImageSize').value,imageSpacing:Number($('editImageSpacing').value)||0,imageAlign:'center'},published:$('editPublished').checked,featured:$('editFeatured').checked,cover:$('editCover').value.trim(),imageOrder:[],hiddenImages:[]};
}
function saveCaseDraft(){
  const index=Number($('editCaseIndex').value),incoming=readEditor();
  if(!incoming.title||!incoming.slug){showAlert('caseModalAlert','Título e slug são obrigatórios.','error');return}
  if(draftData.cases.some((c,i)=>c.slug===incoming.slug&&i!==index)){showAlert('caseModalAlert','Já existe um case com esse slug.','error');return}
  if(index<0)draftData.cases.push(incoming);else{incoming.imageOrder=draftData.cases[index].imageOrder||[];incoming.hiddenImages=draftData.cases[index].hiddenImages||[];incoming.cover=incoming.cover||draftData.cases[index].cover||'';draftData.cases[index]=incoming}
  selectedSlug=incoming.slug; setDirty();renderAll();closeModal('caseModal');showAlert('casesAlert','Alterações salvas no rascunho. O site público não mudou.','success')
}
function removeCaseDraft(){
  const i=Number($('editCaseIndex').value),c=draftData.cases[i]; if(!c||!confirm(`Retirar “${c.title}” do portfólio? As imagens continuarão guardadas no repositório.`))return;
  draftData.cases.splice(i,1); if(selectedSlug===c.slug)selectedSlug='';setDirty();renderAll();closeModal('caseModal');showAlert('casesAlert','Case removido apenas do rascunho.','warning')
}
function previewEditingCase(){const i=Number($('editCaseIndex').value);if(i<0){showAlert('caseModalAlert','Salve o novo case no rascunho antes da prévia.','warning');return}saveCaseDraft();previewCase(selectedSlug)}
function previewCase(slug){if(!slug){showAlert('dashboardAlert','Selecione um case para visualizar.','warning');return}localStorage.setItem(DRAFT_KEY,JSON.stringify(draftData));window.open(`case.html?slug=${encodeURIComponent(slug)}&preview=1`,'_blank','noopener')}

function renderSiteFields(){
  ['pt','en'].forEach(lang=>{$('siteFields'+(lang==='pt'?'Pt':'En')).innerHTML=SITE_FIELDS.map(([key,label])=>`<label for="site_${lang}_${key}">${esc(label)}</label>${key.endsWith('Title')?`<input id="site_${lang}_${key}" value="${esc(draftData.site.translations?.[lang]?.[key]||'')}">`:`<textarea id="site_${lang}_${key}">${esc(draftData.site.translations?.[lang]?.[key]||'')}</textarea>`}`).join('')})
}
function saveSiteDraft(){
  draftData.site.translations=draftData.site.translations||{};
  ['pt','en'].forEach(lang=>{draftData.site.translations[lang]=draftData.site.translations[lang]||{};SITE_FIELDS.forEach(([key])=>draftData.site.translations[lang][key]=$(`site_${lang}_${key}`).value.trim())});
  readCompetencies();setDirty();showAlert('siteAlert','Textos salvos no rascunho.','success')
}
function renderCompetencies(){
  $('competenciesEditor').innerHTML=draftData.competencies.map((c,i)=>`<div class="card" data-comp="${i}"><div class="grid2"><div><label>Título em português</label><input data-field="titlePt" value="${esc(localText(c.title,'pt'))}"><label>Descrição em português</label><textarea data-field="descriptionPt">${esc(localText(c.description,'pt'))}</textarea></div><div><label>Title in English</label><input data-field="titleEn" value="${esc(localText(c.title,'en'))}"><label>Description in English</label><textarea data-field="descriptionEn">${esc(localText(c.description,'en'))}</textarea></div></div><button class="btn btn-danger btn-small" data-remove-comp="${i}">Remover</button></div>`).join('');
  document.querySelectorAll('[data-remove-comp]').forEach(b=>b.onclick=()=>{readCompetencies();draftData.competencies.splice(Number(b.dataset.removeComp),1);setDirty();renderCompetencies()})
}
function readCompetencies(){draftData.competencies=[...document.querySelectorAll('[data-comp]')].map(el=>({title:{pt:el.querySelector('[data-field=titlePt]').value.trim(),en:el.querySelector('[data-field=titleEn]').value.trim()},description:{pt:el.querySelector('[data-field=descriptionPt]').value.trim(),en:el.querySelector('[data-field=descriptionEn]').value.trim()}})).filter(c=>localText(c.title,'pt')||localText(c.title,'en')||localText(c.description,'pt')||localText(c.description,'en'))}
function addCompetency(){readCompetencies();draftData.competencies.push({title:{pt:'',en:''},description:{pt:'',en:''}});setDirty();renderCompetencies()}

function queueFiles(fileList){selectedFiles=[...fileList].filter(f=>/^image\//.test(f.type));$('uploadQueue').innerHTML=selectedFiles.map(f=>`<div><img src="${URL.createObjectURL(f)}" alt=""><div class="image-name">${esc(f.name)}</div></div>`).join('');$('uploadBtn').classList.toggle('hidden',!selectedFiles.length)}
async function loadImages(){
  clearAlert('imagesAlert');const c=draftData.cases.find(x=>x.slug===selectedSlug);if(!c){$('galleryGrid').innerHTML='<div class="empty">Selecione um case.</div>';return}
  $('galleryGrid').innerHTML='<div class="empty">Carregando imagens...</div>';
  try{const files=await request(api('/contents/'+c.folder+'?ref='+BRANCH));remoteImages=(Array.isArray(files)?files:[]).filter(f=>/\.(jpe?g|png|gif|webp)$/i.test(f.name));sortRemote(c);renderGallery(c)}catch(e){remoteImages=[];$('galleryGrid').innerHTML='<div class="empty">Ainda não há imagens nesta pasta.</div>'}
}
function sortRemote(c){const order=c.imageOrder||[];remoteImages.sort((a,b)=>{const ai=order.indexOf(a.name),bi=order.indexOf(b.name);if(ai<0&&bi<0)return a.name.localeCompare(b.name,undefined,{numeric:true});if(ai<0)return 1;if(bi<0)return-1;return ai-bi})}
function renderGallery(c){
  if(!remoteImages.length){$('galleryGrid').innerHTML='<div class="empty">Ainda não há imagens.</div>';return}
  $('galleryGrid').innerHTML=remoteImages.map((img,i)=>{const hidden=c.hiddenImages.includes(img.name),cover=c.cover===img.name||(!c.cover&&c.imageOrder[0]===img.name);return `<div class="image-card ${cover?'cover':''}" draggable="true" data-image="${esc(img.name)}"><img src="${esc(img.download_url)}" alt=""><div class="image-info"><div class="image-name">${esc(img.name)} ${hidden?'· oculta':''}</div><div class="image-actions"><button class="btn btn-small" data-cover="${esc(img.name)}">${cover?'Capa atual':'Definir capa'}</button><button class="btn btn-small" data-up="${i}">↑</button><button class="btn btn-small" data-down="${i}">↓</button><button class="btn btn-small ${hidden?'btn-ok':'btn-danger'}" data-hide="${esc(img.name)}">${hidden?'Mostrar':'Ocultar'}</button></div></div></div>`}).join('');
  document.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{c.cover=b.dataset.cover;c.hiddenImages=c.hiddenImages.filter(x=>x!==c.cover);saveImageDraft(c)});
  document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>moveImage(c,Number(b.dataset.up),-1));document.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>moveImage(c,Number(b.dataset.down),1));
  document.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{const n=b.dataset.hide;c.hiddenImages=c.hiddenImages.includes(n)?c.hiddenImages.filter(x=>x!==n):[...c.hiddenImages,n];if(c.cover===n)c.cover='';saveImageDraft(c)});bindImageDrag(c)
}
function moveImage(c,i,d){const j=i+d;if(j<0||j>=remoteImages.length)return;[remoteImages[i],remoteImages[j]]=[remoteImages[j],remoteImages[i]];saveImageDraft(c)}
function bindImageDrag(c){let name='';document.querySelectorAll('.image-card').forEach(el=>{el.ondragstart=()=>name=el.dataset.image;el.ondragover=e=>e.preventDefault();el.ondrop=()=>{const from=remoteImages.findIndex(x=>x.name===name),to=remoteImages.findIndex(x=>x.name===el.dataset.image);if(from<0||to<0||from===to)return;const [item]=remoteImages.splice(from,1);remoteImages.splice(to,0,item);saveImageDraft(c)}})}
function saveImageDraft(c){c.imageOrder=remoteImages.map(x=>x.name);setDirty();renderGallery(c);showAlert('imagesAlert','Ordem e seleção salvas no rascunho.','success')}
async function uploadImages(){
  const c=draftData.cases.find(x=>x.slug===selectedSlug);if(!c||!selectedFiles.length)return;
  $('uploadBtn').disabled=true;$('uploadProgress').classList.remove('hidden');const bar=$('uploadProgress').firstElementChild;let done=0,failed=[];
  for(const file of selectedFiles){
    try{const path=c.folder+'/'+file.name;let sha;try{sha=(await request(api('/contents/'+path+'?ref='+BRANCH))).sha}catch(e){}
      if(sha){failed.push(`${file.name}: já existe; renomeie o novo arquivo para evitar substituir uma imagem pública`);done++;bar.style.width=(done/selectedFiles.length*100)+'%';continue}
      const content=await fileToBase64(file);const body={message:`CMS: enviar ${file.name}`,content,branch:BRANCH};if(sha)body.sha=sha;
      await request(api('/contents/'+path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }catch(e){failed.push(file.name+': '+e.message)}done++;bar.style.width=(done/selectedFiles.length*100)+'%';
  }
  selectedFiles=[];$('fileInput').value='';$('uploadQueue').innerHTML='';$('uploadBtn').classList.add('hidden');$('uploadBtn').disabled=false;setTimeout(()=>$('uploadProgress').classList.add('hidden'),700);await loadImages();
  const caseData=draftData.cases.find(x=>x.slug===selectedSlug);remoteImages.forEach(img=>{if(!caseData.imageOrder.includes(img.name))caseData.imageOrder.push(img.name)});setDirty();renderGallery(caseData);
  showAlert('imagesAlert',failed.length?'Alguns arquivos falharam: '+failed.join(' | '):'Upload concluído e incluído no rascunho.',failed.length?'error':'success')
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file)})}

function validate(){
  const errors=[],warnings=[],slugs=new Set();if(!draftData.cases.length)errors.push('O portfólio precisa ter ao menos um case.');
  draftData.cases.forEach((c,i)=>{const n=i+1;if(!c.title)errors.push(`Case ${n}: título ausente.`);if(!c.slug)errors.push(`Case ${n}: slug ausente.`);if(slugs.has(c.slug))errors.push(`Slug duplicado: ${c.slug}.`);slugs.add(c.slug);if(!/^[a-z0-9-]+$/.test(c.slug))errors.push(`${c.title}: slug contém caracteres inválidos.`);if(!c.folder)errors.push(`${c.title}: pasta ausente.`);if(c.published!==false&&!c.imageOrder.length)errors.push(`${c.title}: nenhuma imagem ordenada.`);if(c.cover&&!c.imageOrder.includes(c.cover))errors.push(`${c.title}: a capa não está na galeria.`);if(!c.client)warnings.push(`${c.title}: cliente não informado.`);if(!c.year)warnings.push(`${c.title}: ano não informado.`);if(!localText(c.services,'pt')&&!localText(c.services,'en'))warnings.push(`${c.title}: serviços não informados.`)});
  return {errors,warnings};
}
async function validateRemote(result){
  for(const c of draftData.cases.filter(x=>x.published!==false)){
    try{const files=await request(api('/contents/'+c.folder+'?ref='+BRANCH));const names=new Set((Array.isArray(files)?files:[]).filter(f=>/\.(jpe?g|png|gif|webp)$/i.test(f.name)).map(f=>f.name));
      if(!names.size)result.errors.push(`${c.title}: a pasta não contém imagens.`);
      const missing=(c.imageOrder||[]).filter(name=>!names.has(name));if(missing.length)result.errors.push(`${c.title}: arquivos ausentes — ${missing.join(', ')}.`);
      if(c.cover&&!names.has(c.cover))result.errors.push(`${c.title}: o arquivo de capa não existe.`);
      const unlisted=[...names].filter(name=>!c.imageOrder.includes(name)&&!(c.hiddenImages||[]).includes(name));if(unlisted.length)result.warnings.push(`${c.title}: ${unlisted.length} imagem(ns) enviada(s) ainda não está(ão) na ordem publicada.`);
    }catch(e){result.errors.push(`${c.title}: não foi possível acessar a pasta “${c.folder}”.`)}
  }
  return result;
}
function renderValidation(result){$('validationResult').innerHTML=(result.errors.length?`<div class="alert error"><strong>Publicação bloqueada</strong><ul class="validation-list">${result.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:`<div class="alert success"><strong>Estrutura e arquivos aprovados.</strong> Nenhum erro que possa quebrar o site foi encontrado.</div>`)+(result.warnings.length?`<div class="alert warning"><strong>Avisos editoriais</strong><ul>${result.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'');$('confirmPublishBtn').disabled=!!result.errors.length}
async function preparePublish(){readCompetencies();openModal('publishModal');$('confirmPublishBtn').disabled=true;$('validationResult').innerHTML='<div class="alert warning">Verificando estrutura, pastas, capas e imagens...</div>';let result=validate();if(!result.errors.length)result=await validateRemote(result);renderValidation(result)}
async function publish(){
  const result=validate();if(result.errors.length)return;$('confirmPublishBtn').disabled=true;$('confirmPublishBtn').textContent='Publicando...';
  try{const latest=await request(api('/contents/config.json?ref='+BRANCH));if(latest.sha!==configSha)throw new Error('O arquivo público mudou desde que o painel foi aberto. Recarregue a página para evitar sobrescrever alterações recentes.');
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(draftData,null,2))));const saved=await request(api('/contents/config.json'),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'CMS: publicar portfólio '+new Date().toISOString(),content,branch:BRANCH,sha:configSha})});
    configSha=saved.content.sha;publishedData=clone(draftData);localStorage.removeItem(DRAFT_KEY);setDirty(false);closeModal('publishModal');showAlert('dashboardAlert','Publicação enviada. O GitHub Pages pode levar alguns minutos para atualizar.','success');switchView('dashboard')
  }catch(e){showAlert('validationResult','Publicação interrompida: '+e.message,'error')}
  finally{$('confirmPublishBtn').disabled=false;$('confirmPublishBtn').textContent='Publicar agora'}
}

async function loadVersions(){
  $('versionsList').innerHTML='<div class="empty">Carregando versões...</div>';
  try{const commits=await request(api('/commits?path=config.json&sha='+BRANCH+'&per_page=12'));$('versionsList').innerHTML=commits.map((c,i)=>`<div class="version"><div><strong>${i===0?'Versão atual':esc(c.commit.message.split('\n')[0])}</strong><small>${new Date(c.commit.author.date).toLocaleString('pt-BR')} · ${esc(c.sha.slice(0,7))}</small></div><button class="btn btn-small" data-restore="${esc(c.sha)}" ${i===0?'disabled':''}>Carregar como rascunho</button></div>`).join('');document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreVersion(b.dataset.restore))}catch(e){$('versionsList').innerHTML=`<div class="alert error">${esc(e.message)}</div>`}
}
async function restoreVersion(sha){
  if(!confirm('Carregar esta versão como rascunho? O site público não será alterado.'))return;
  try{const file=await request(api('/contents/config.json?ref='+sha));draftData=migrate(JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g,''))))));setDirty();renderAll();showAlert('dashboardAlert','Versão anterior carregada como rascunho. Confira antes de publicar.','warning');switchView('dashboard')}catch(e){showAlert('dashboardAlert','Não foi possível carregar: '+e.message,'error')}
}

$('loginBtn').onclick=login;$('githubToken').onkeydown=e=>{if(e.key==='Enter')login()};
