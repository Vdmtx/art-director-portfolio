// admin.js - Painel Administrativo VDMTX (com ordenação por botões)
let config = {
    username: '',
    token: '',
    repo: 'art-director-portfolio',
    branch: 'main'
};

let currentData = { competencies: [], cases: [] };
let selectedCase = null;
let filesToUpload = [];
let imageOrder = [];
let allCaseImages = [];

async function login() {
    const username = document.getElementById('githubUsername').value.trim();
    const token = document.getElementById('githubToken').value.trim();

    if (!username || !token) {
        showAlert('loginAlert', 'Preencha username e token', 'error');
        return;
    }

    config.username = username;
    config.token = token;

    try {
        const testRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!testRes.ok) throw new Error('Token inválido (' + testRes.status + ')');

        const user = await testRes.json();
        console.log('Token válido para:', user.login);

        await loadOrCreateConfig();

        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');

        loadCompetencies();
        loadCases();
        updateCaseSelect();

        showAlert('loginAlert', 'Login realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no login:', error);
        let msg = 'Erro: ' + error.message;
        if (error.message.includes('401')) msg = 'Token inválido. Verifique se está correto e tem permissão "repo".';
        else if (error.message.includes('403')) msg = 'Acesso negado. Token precisa de permissão "repo".';
        else if (error.message.includes('404')) msg = 'Repositório não encontrado.';
        showAlert('loginAlert', msg, 'error');
    }
}

async function loadOrCreateConfig() {
    const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/config.json';

    try {
        const res = await fetch(url + '?ref=' + config.branch, {
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            currentData = JSON.parse(atob(data.content));
            console.log('Config carregado:', currentData);
            return;
        }
    } catch (e) {
        console.log('Config não existe, criando...');
    }

    currentData = {
        competencies: [
            {
                title: 'Visual Identity Engineering',
                description: 'Brand design focused on longevity, scalability, and technical rigor.'
            }
        ],
        cases: []
    };

    await saveConfig();
    console.log('Config inicial criado!');
}

async function saveConfig() {
    const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/config.json';

    let sha = null;
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (res.ok) {
            const data = await res.json();
            sha = data.sha;
        }
    } catch (e) {}

    const body = {
        message: 'Update config via admin panel',
        content: btoa(JSON.stringify(currentData, null, 2)),
        branch: config.branch
    };

    if (sha) body.sha = sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'token ' + config.token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
    }

    console.log('Config salvo!');
}

async function loadCompetencies() {
    const list = document.getElementById('competenciesList');
    if (currentData.competencies.length === 0) {
        list.innerHTML = '<p style="color:#999;padding:20px;">Nenhuma competência cadastrada</p>';
        return;
    }

    list.innerHTML = currentData.competencies.map(function(comp, i) {
        return '<div class="item">' +
            '<div class="item-info">' +
            '<h3>' + comp.title + '</h3>' +
            '<p>' + comp.description + '</p>' +
            '</div>' +
            '<button class="btn-danger" onclick="deleteCompetency(' + i + ')">Remover</button>' +
            '</div>';
    }).join('');
}

async function addCompetency() {
    const title = document.getElementById('compTitle').value.trim();
    const desc = document.getElementById('compDescription').value.trim();

    if (!title || !desc) {
        showAlert('competenciesAlert', 'Preencha título e descrição', 'error');
        return;
    }

    currentData.competencies.push({ title: title, description: desc });

    try {
        await saveConfig();
        document.getElementById('compTitle').value = '';
        document.getElementById('compDescription').value = '';
        loadCompetencies();
        showAlert('competenciesAlert', 'Competência adicionada!', 'success');
    } catch (error) {
        showAlert('competenciesAlert', 'Erro: ' + error.message, 'error');
    }
}

async function deleteCompetency(index) {
    if (!confirm('Confirmar remoção?')) return;
    currentData.competencies.splice(index, 1);
    try {
        await saveConfig();
        loadCompetencies();
        showAlert('competenciesAlert', 'Removido!', 'success');
    } catch (e) {
        showAlert('competenciesAlert', 'Erro: ' + e.message, 'error');
    }
}

async function loadCases() {
    const list = document.getElementById('casesList');
    if (currentData.cases.length === 0) {
        list.innerHTML = '<p style="color:#999;padding:20px;">Nenhum case cadastrado</p>';
        return;
    }

    list.innerHTML = currentData.cases.map(function(c, i) {
        return '<div class="item">' +
            '<div class="item-info">' +
            '<h3>' + c.title + '</h3>' +
            '<p>' + c.category + ' — ' + c.folder + '</p>' +
            '</div>' +
            '<div>' +
            '<button class="btn-secondary" onclick="viewCaseImages(' + i + ')">Imagens</button>' +
            '<button class="btn-danger" onclick="deleteCase(' + i + ')">Remover</button>' +
            '</div>' +
            '</div>';
    }).join('');
}

async function addCase() {
    const title = document.getElementById('caseTitle').value.trim();
    const category = document.getElementById('caseCategory').value.trim();
    const slug = document.getElementById('caseSlug').value.trim().toLowerCase().replace(/\s+/g, '-');

    if (!title || !slug) {
        showAlert('casesAlert', 'Preencha título e slug', 'error');
        return;
    }

    const folder = 'img/' + slug;
    currentData.cases.push({ slug: slug, title: title, category: category || 'General', folder: folder });

    try {
        const folderUrl = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/' + folder + '/.gitkeep';
        await fetch(folderUrl, {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Create ' + folder,
                content: '',
                branch: config.branch
            })
        });

        await saveConfig();

        document.getElementById('caseTitle').value = '';
        document.getElementById('caseCategory').value = '';
        document.getElementById('caseSlug').value = '';

        loadCases();
        updateCaseSelect();
        showAlert('casesAlert', 'Case adicionado!', 'success');
    } catch (error) {
        showAlert('casesAlert', 'Erro: ' + error.message, 'error');
    }
}

async function deleteCase(index) {
    if (!confirm('Confirmar remoção do case?')) return;
    currentData.cases.splice(index, 1);
    try {
        await saveConfig();
        loadCases();
        updateCaseSelect();
        showAlert('casesAlert', 'Case removido!', 'success');
    } catch (e) {
        showAlert('casesAlert', 'Erro: ' + e.message, 'error');
    }
}

function updateCaseSelect() {
    const select = document.getElementById('caseSelect');
    select.innerHTML = '<option value="">Selecione um case...</option>' +
        currentData.cases.map(function(c, i) {
            return '<option value="' + i + '">' + c.title + '</option>';
        }).join('');

    select.onchange = function(e) {
        if (e.target.value) {
            selectedCase = currentData.cases[e.target.value];
            loadCaseImages();
        }
    };
}

// ===== IMAGENS COM ORDENAÇÃO POR BOTÕES =====

async function loadCaseImages() {
    if (!selectedCase) return;
    
    const grid = document.getElementById('galleryGrid');
    const saveBtn = document.getElementById('saveOrderBtn');
    grid.innerHTML = '<p style="color:#888;grid-column:1/-1;">Carregando...</p>';
    saveBtn.style.display = 'none';

    try {
        const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/' + selectedCase.folder;
        const res = await fetch(url, {
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            grid.innerHTML = '<p style="color:#888;grid-column:1/-1;">Nenhuma imagem encontrada</p>';
            return;
        }

        const files = await res.json();
        let images = files.filter(function(f) {
            return f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        });

        if (images.length === 0) {
            grid.innerHTML = '<p style="color:#888;grid-column:1/-1;">Nenhuma imagem encontrada</p>';
            return;
        }

        // Aplicar ordem salva
        const savedOrder = getImageOrderFromConfig();
        if (savedOrder.length > 0) {
            images.sort(function(a, b) {
                const orderA = savedOrder.indexOf(a.name);
                const orderB = savedOrder.indexOf(b.name);
                if (orderA === -1 && orderB === -1) return a.name.localeCompare(b.name);
                if (orderA === -1) return 1;
                if (orderB === -1) return -1;
                return orderA - orderB;
            });
        } else {
            images.sort(function(a, b) { return a.name.localeCompare(b.name); });
        }

        imageOrder = images.map(function(img) { return img.name; });
        allCaseImages = images;
        renderGallery(images);
    } catch (e) {
        grid.innerHTML = '<p style="color:#888;grid-column:1/-1;">Erro ao carregar</p>';
    }
}

function getImageOrderFromConfig() {
    if (!currentData.cases) return [];
    const caseData = currentData.cases.find(function(c) { return c.slug === selectedCase.slug; });
    if (caseData && caseData.imageOrder) return caseData.imageOrder;
    return [];
}

function renderGallery(images) {
    const grid = document.getElementById('galleryGrid');
    const saveBtn = document.getElementById('saveOrderBtn');
    
    var html = '';
    for (var i = 0; i < images.length; i++) {
        var img = images[i];
        var isFirst = (i === 0);
        var isLast = (i === images.length - 1);
        
        html += '<div class="gallery-item" data-name="' + img.name + '">';
        html += '<div class="gallery-number">' + (i + 1) + '</div>';
        html += '<img src="' + img.download_url + '" alt="' + img.name + '" style="width:100%;height:150px;object-fit:cover;border-radius:4px;">';
        html += '<div class="gallery-info">';
        html += '<p style="color:#fff;font-size:12px;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + img.name + '</p>';
        html += '<div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">';
        
        // Botão subir
        if (isFirst) {
            html += '<button style="padding:6px 10px;font-size:14px;background:#333;color:#666;border:none;border-radius:4px;cursor:not-allowed;" disabled>↑</button>';
        } else {
            html += '<button class="btn-secondary" style="padding:6px 10px;font-size:14px;" onclick="moveImage(' + i + ',-1)">↑</button>';
        }
        
        // Botão descer
        if (isLast) {
            html += '<button style="padding:6px 10px;font-size:14px;background:#333;color:#666;border:none;border-radius:4px;cursor:not-allowed;" disabled>↓</button>';
        } else {
            html += '<button class="btn-secondary" style="padding:6px 10px;font-size:14px;" onclick="moveImage(' + i + ',1)">↓</button>';
        }
        
        // Botão remover
        html += '<button class="btn-danger" style="padding:6px 12px;font-size:11px;" onclick="deleteImage(\'' + img.path + '\',\'' + img.sha + '\')">Remover</button>';
        
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }
    
    grid.innerHTML = html;
    saveBtn.style.display = 'block';
}

function moveImage(fromIndex, direction) {
    var toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= imageOrder.length) return;
    
    // Trocar posições no array
    var temp = imageOrder[fromIndex];
    imageOrder[fromIndex] = imageOrder[toIndex];
    imageOrder[toIndex] = temp;
    
    // Reordenar as imagens completas
    var reordered = [];
    for (var i = 0; i < imageOrder.length; i++) {
        for (var j = 0; j < allCaseImages.length; j++) {
            if (allCaseImages[j].name === imageOrder[i]) {
                reordered.push(allCaseImages[j]);
                break;
            }
        }
    }
    
    allCaseImages = reordered;
    renderGallery(reordered);
}

async function saveImageOrder() {
    try {
        const caseIndex = currentData.cases.findIndex(function(c) { return c.slug === selectedCase.slug; });
        if (caseIndex === -1) {
            showAlert('imagesAlert', 'Case não encontrado', 'error');
            return;
        }
        
        currentData.cases[caseIndex].imageOrder = imageOrder;
        await saveConfig();
        
        showAlert('imagesAlert', '✅ Ordem salva com sucesso!', 'success');
    } catch (error) {
        showAlert('imagesAlert', '❌ Erro ao salvar: ' + error.message, 'error');
    }
}

async function deleteImage(path, sha) {
    if (!confirm('Remover esta imagem?')) return;
    const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/' + path;

    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': 'token ' + config.token,
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            message: 'Delete ' + path,
            sha: sha,
            branch: config.branch
        })
    });

    if (res.ok) {
        loadCaseImages();
        showAlert('imagesAlert', 'Imagem removida!', 'success');
    } else {
        showAlert('imagesAlert', 'Erro ao remover', 'error');
    }
}

// Upload handlers
document.getElementById('uploadArea').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

document.getElementById('uploadArea').addEventListener('dragover', function(e) {
    e.preventDefault();
    this.style.borderColor = '#00d4ff';
});

document.getElementById('uploadArea').addEventListener('dragleave', function() {
    this.style.borderColor = '#333';
});

document.getElementById('uploadArea').addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.borderColor = '#333';
    handleFiles(e.dataTransfer.files);
});

document.getElementById('fileInput').onchange = function(e) {
    handleFiles(e.target.files);
};

function handleFiles(files) {
    filesToUpload = Array.from(files).filter(function(f) {
        return f.type.startsWith('image/');
    });

    const preview = document.getElementById('imagePreview');
    preview.innerHTML = filesToUpload.map(function(f, i) {
        return '<div class="image-item">' +
            '<img src="' + URL.createObjectURL(f) + '">' +
            '<button onclick="removeFile(' + i + ')">×</button>' +
            '</div>';
    }).join('');

    document.getElementById('uploadBtn').style.display = filesToUpload.length > 0 ? 'inline-block' : 'none';
}

function removeFile(index) {
    filesToUpload.splice(index, 1);
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = filesToUpload.map(function(f, i) {
        return '<div class="image-item">' +
            '<img src="' + URL.createObjectURL(f) + '">' +
            '<button onclick="removeFile(' + i + ')">×</button>' +
            '</div>';
    }).join('');
    document.getElementById('uploadBtn').style.display = filesToUpload.length > 0 ? 'inline-block' : 'none';
}

async function uploadImages() {
    if (!selectedCase) {
        showAlert('imagesAlert', 'Selecione um case primeiro', 'error');
        return;
    }
    if (filesToUpload.length === 0) {
        showAlert('imagesAlert', 'Selecione arquivos para upload', 'error');
        return;
    }

    showAlert('imagesAlert', 'Enviando imagens...', 'success');

    for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const path = selectedCase.folder + '/' + file.name;

        const base64 = await new Promise(function(resolve) {
            const reader = new FileReader();
            reader.onload = function() {
                resolve(reader.result.split(',')[1]);
            };
            reader.readAsDataURL(file);
        });

        const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/' + path;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + config.token,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Upload ' + file.name,
                content: base64,
                branch: config.branch
            })
        });

        if (!res.ok) {
            console.error('Erro ao enviar ' + file.name);
        }
    }

    filesToUpload = [];
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('uploadBtn').style.display = 'none';
    loadCaseImages();
    showAlert('imagesAlert', 'Imagens enviadas com sucesso!', 'success');
}

function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
    setTimeout(function() {
        container.innerHTML = '';
    }, 5000);
}

function viewCaseImages(index) {
    document.getElementById('caseSelect').value = index;
    selectedCase = currentData.cases[index];
    loadCaseImages();
    document.getElementById('caseSelect').scrollIntoView({ behavior: 'smooth' });
}

function switchTab(tabName, btn) {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}
