// Load data from config.json
async function loadData() {
    try {
        const response = await fetch('config.json');
        const data = await response.json();
        
        renderCompetencies(data.competencies);
        renderCases(data.cases);
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('competenciesList').innerHTML = '<p>Error loading content</p>';
        document.getElementById('casesList').innerHTML = '<p>Error loading content</p>';
    }
}

function renderCompetencies(competencies) {
    const container = document.getElementById('competenciesList');
    container.innerHTML = '';

    competencies.forEach(comp => {
        const div = document.createElement('div');
        div.className = 'competency';
        div.innerHTML = `
            <h3>${comp.title}</h3>
            <p>${comp.description}</p>
        `;
        container.appendChild(div);
    });
}

async function renderCases(cases) {
    const container = document.getElementById('casesList');
    container.innerHTML = '';

    for (const caseItem of cases) {
        const card = document.createElement('div');
        card.className = 'case-card';
        card.onclick = () => openCase(caseItem);

        // Try to get first image from folder
        let imageUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect fill="%231a1a1a" width="400" height="250"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
        
        try {
            const response = await fetch(`https://api.github.com/repos/vdmtx/${caseItem.folder}`);
            if (response.ok) {
                const files = await response.json();
                const images = files.filter(f => f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                if (images.length > 0) {
                    imageUrl = images[0].download_url;
                }
            }
        } catch (e) {
            console.log('No images found for', caseItem.slug);
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${caseItem.title}" class="case-image" onerror="this.style.display='none'">
            <div class="case-info">
                <div class="case-category">${caseItem.category}</div>
                <div class="case-title">${caseItem.title}</div>
            </div>
        `;
        container.appendChild(card);
    }
}

function openCase(caseItem) {
    // Create case detail page dynamically or redirect
    window.location.href = `case.html?slug=${caseItem.slug}`;
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadData);
