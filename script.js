// ==========================================
// 1. LÓGICA DE IDIOMA (HARD-FIX)
// ==========================================
let currentLang = localStorage.getItem('vdmtx-lang') || 'en';

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.body.className = document.body.className.replace(/lang-\w+/, `lang-${lang}`);
  localStorage.setItem('vdmtx-lang', lang);

  // Percorre e substitui textContent
  document.querySelectorAll('.translate').forEach(el => {
    const newText = el.getAttribute(`data-${lang}`);
    if (newText !== null) el.textContent = newText;
  });

  // Atualiza estado dos botões
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.dataset.langTarget === lang;
    btn.classList.toggle('active', isActive);
  });
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLanguage(btn.dataset.langTarget));
});

// Inicializa idioma
applyLanguage(currentLang);

// ==========================================
// 2. CARREGAMENTO DINÂMICO + MODAL
// ==========================================
const projectsGrid = document.getElementById('projects-grid');
const modal = document.getElementById('case-modal');
const modalStack = document.getElementById('case-stack');
const closeModalBtn = document.getElementById('case-close');
const progressBar = document.getElementById('case-progress');
let projectsData = [];

async function loadProjects() {
  try {
    const res = await fetch('projects.json');
    projectsData = await res.json();
    renderGrid();
  } catch (err) {
    projectsGrid.innerHTML = '<p class="translate" data-en="Failed to load projects." data-pt="Falha ao carregar projetos." style="grid-column:1/-1;text-align:center;">Failed to load projects.</p>';
  }
}

function renderGrid() {
  projectsGrid.innerHTML = projectsData.map(p => `
    <div class="project-card" data-id="${p.id}">
      <div class="project-thumbnail">
        <img src="${p.images[0]}" alt="${p.title}" loading="lazy">
      </div>
      <div class="project-caption-top translate" data-en="${p.title}" data-pt="${p.title}">${p.title}</div>
      <div class="project-caption-bottom translate" data-en="${p.category}" data-pt="${p.category}">${p.category}</div>
    </div>
  `).join('');

  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function openModal(id) {
  const project = projectsData.find(p => p.id === id);
  if (!project) return;

  // Imersão visual
  modal.style.backgroundColor = project.bgColor;
  const isDark = ['#1A1A1A', '#0F172A', '#000000'].includes(project.bgColor.toUpperCase());
  const textColor = isDark ? '#FFFFFF' : '#1A1A1A';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

  closeModalBtn.style.background = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)';
  closeModalBtn.style.color = textColor;
  closeModalBtn.style.borderColor = borderColor;
  closeModalBtn.setAttribute('data-en', 'CLOSE');
  closeModalBtn.setAttribute('data-pt', 'FECHAR');
  closeModalBtn.textContent = currentLang === 'en' ? 'CLOSE' : 'FECHAR';
  closeModalBtn.classList.add('translate');

  // Injeção do conteúdo com atributos de tradução
  let html = `
    <div class="case-header" style="border-bottom-color:${borderColor}">
      <h2 style="color:${textColor}">${project.title}</h2>
      <div class="category translate" data-en="${project.category}" data-pt="${project.category}" style="color:${isDark?'rgba(255,255,255,0.7)':'#4A4A4A'}">${project.category}</div>
      <p class="translate" data-en="${project.description}" data-pt="${project.description}" style="color:${isDark?'rgba(255,255,255,0.8)':'#4A4A4A'}">${project.description}</p>
    </div>
  `;

  project.images.forEach((src, i) => {
    html += `<img class="slide-image" src="${src}" alt="${project.title} - Slide ${i+1}" loading="lazy" style="background:${project.bgColor}">`;
  });

  modalStack.innerHTML = html;
  
  // Reaplica tradução no conteúdo injetado
  applyLanguage(currentLang);

  // Controle de estado
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  history.pushState({ modal: true }, '');
  modal.scrollTop = 0;
  progressBar.style.width = '0%';
}

function closeModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  modal.style.backgroundColor = '';
  if (history.state?.modal) history.back();
}

// Event Listeners
closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('popstate', () => { if (modal.classList.contains('active')) closeModal(); });
modal.addEventListener('scroll', () => {
  const h = modal.scrollHeight - modal.clientHeight;
  progressBar.style.width = h > 0 ? `${(modal.scrollTop / h) * 100}%` : '0%';
});

// Inicializa
loadProjects();
