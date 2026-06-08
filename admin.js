let imageOrder = [];

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
    
    grid.innerHTML = images.map(function(img, index) {
        return '<div class="gallery-item" data-name="' + img.name + '">' +
            '<div class="gallery-number">' + (index + 1) + '</div>' +
            '<img src="' + img.download_url + '" alt="' + img.name + '" style="width:100%;height:150px;object-fit:cover;border-radius:4px;">' +
            '<div class="gallery-info">' +
            '<p style="color:#fff;font-size:12px;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + img.name + '</p>' +
            '<div style="display:flex;gap:5px;margin-top:8px;">' +
            '<button class="btn-secondary" style="padding:6px 10px;font-size:14px;" onclick="moveImage(' + index + ',-1)" ' + (index === 0 ? 'disabled style="opacity:0.3;padding:6px 10px;font-size:14px;"' : '') + '>↑</button>' +
            '<button class="btn-secondary" style="padding:6px 10px;font-size:14px;" onclick="moveImage(' + index + ',1)" ' + (index === images.length - 1 ? 'disabled style="opacity:0.3;padding:6px 10px;font-size:14px;"' : '') + '>↓</button>' +
            '<button class="btn-danger" style="padding:6px 12px;font-size:11px;" onclick="deleteImage(\'' + img.path + '\',\'' + img.sha + '\')">Remover</button>' +
            '</div>' +
            '</div>' +
            '</div>';
    }).join('');

    saveBtn.style.display = 'block';
}

function moveImage(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= imageOrder.length) return;
    
    const moved = imageOrder.splice(fromIndex, 1)[0];
    imageOrder.splice(toIndex, 0, moved);
    
    // Re-renderizar com nova ordem
    const url = 'https://api.github.com/repos/' + config.username + '/' + config.repo + '/contents/' + selectedCase.folder;
    fetch(url, {
        headers: {
            'Authorization': 'token ' + config.token,
            'Accept': 'application/vnd.github.v3+json'
        }
    }).then(function(res) { return res.json(); })
    .then(function(files) {
        const images = files.filter(function(f) {
            return f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        });
        
        // Reordenar conforme imageOrder
        images.sort(function(a, b) {
            const orderA = imageOrder.indexOf(a.name);
            const orderB = imageOrder.indexOf(b.name);
            if (orderA === -1 && orderB === -1) return a.name.localeCompare(b.name);
            if (orderA === -1) return 1;
            if (orderB === -1) return -1;
            return orderA - orderB;
        });
        
        renderGallery(images);
    });
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
