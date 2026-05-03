let allComponents = [];
let filteredComponents = [];
let buildComponents = [];
let favoriteComponentIds = [];
let savedBuilds = [];

let currentPage = 1;
const itemsPerPage = 6;

const LOCAL_STORAGE_KEY = 'pc-builder-build';
const FAVORITE_STORAGE_KEY = 'pc-builder-favorites';
const SAVED_BUILDS_STORAGE_KEY = 'pc-builder-saved-builds';
const COMPONENTS_URL = 'assets/data/components.json';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    helpers.fixAria();
    helpers.footerText();
    setupEventListeners();

    if (document.getElementById('components-holder')) {
        loadComponents();
    }
});

// ==================== DATA LOADING ====================
function loadComponents() {
    fetch(COMPONENTS_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load components: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            allComponents = data;
            filteredComponents = data;
            loadSavedState();
            applyCategoryFromUrl();
            performFiltering();
            updateBuildDisplay();
        })
        .catch(error => {
            console.error(error);
            const componentsHolder = document.getElementById('components-holder');
            if (componentsHolder) {
                componentsHolder.innerHTML = '<div class="col-12"><div class="alert alert-danger">Components could not be loaded.</div></div>';
            }
        });
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    document.querySelectorAll('#search-desktop, #search-mobile').forEach(input => {
        input.addEventListener('input', performFiltering);
    });

    document.querySelectorAll('.form-check-input[name="category"]').forEach(checkbox => {
        checkbox.addEventListener('change', performFiltering);
    });

    document.querySelectorAll('#sort-desktop, #sort-mobile').forEach(select => {
        select.addEventListener('change', performFiltering);
    });

    document.querySelectorAll('.build-name-input').forEach(input => {
        input.addEventListener('input', function () {
            syncBuildNameInputs(this.value);
            updateBuildNameStatus(this.value);
        });
    });

    const componentModal = document.getElementById('componentModal');
    if (componentModal) {
        componentModal.addEventListener('show.bs.modal', function (event) {
            const componentId = event.relatedTarget?.getAttribute('data-component-id');
            showComponentDetails(componentId);
        });
    }

    document.addEventListener('click', function (event) {
        const addButton = event.target.closest('.add-to-build-btn');
        if (addButton) {
            const component = findComponentById(addButton.dataset.componentId);
            if (component) {
                toggleBuildComponent(component);
            }
            return;
        }

        const removeButton = event.target.closest('.remove-from-build-btn');
        if (removeButton) {
            removeFromBuild(removeButton.dataset.componentId);
            return;
        }

        const favoriteButton = event.target.closest('.favorite-icon');
        if (favoriteButton) {
            const componentId = favoriteButton.dataset.componentId;
            if (componentId) {
                toggleFavorite(componentId);
            }
            return;
        }

        const favoriteAddButton = event.target.closest('.add-favorite-to-build-btn');
        if (favoriteAddButton) {
            const component = findComponentById(favoriteAddButton.dataset.componentId);
            if (component) {
                addComponentToBuild(component);
            }
            return;
        }

        const favoriteRemoveButton = event.target.closest('.remove-favorite-btn');
        if (favoriteRemoveButton) {
            toggleFavorite(favoriteRemoveButton.dataset.componentId);
            return;
        }

        const saveBuildButton = event.target.closest('.save-build-btn');
        if (saveBuildButton) {
            saveCurrentBuild();
            return;
        }

        const loadSavedBuildButton = event.target.closest('.load-saved-build-btn');
        if (loadSavedBuildButton) {
            loadSavedBuild(loadSavedBuildButton.dataset.buildId);
            return;
        }

        const deleteSavedBuildButton = event.target.closest('.delete-saved-build-btn');
        if (deleteSavedBuildButton) {
            deleteSavedBuild(deleteSavedBuildButton.dataset.buildId);
            return;
        }

        const modalBuildButton = event.target.closest('#modal-build-button');
        if (modalBuildButton) {
            const component = findComponentById(modalBuildButton.dataset.componentId);
            if (component) {
                toggleBuildComponent(component);
                populateModal(component);
            }
        }
    });
}

// ==================== FILTERING & SORTING ====================
function applyCategoryFromUrl() {
    const category = new URLSearchParams(window.location.search).get('category');
    if (!category) return;

    document.querySelectorAll(`.form-check-input[name="category"][value="${CSS.escape(category)}"]`).forEach(checkbox => {
        checkbox.checked = true;
    });
}

function performFiltering() {
    currentPage = 1;

    const searchValue = getCurrentSearchValue();
    const checkedCategories = getCheckedCategories();
    const sortValue = getCurrentSortValue();

    filteredComponents = allComponents.filter(component => {
        const matchesSearch = !searchValue || component.name.toLowerCase().includes(searchValue);
        const matchesCategory = checkedCategories.length === 0 || checkedCategories.includes(component.category);
        return matchesSearch && matchesCategory;
    });

    filteredComponents = sortComponents(filteredComponents, sortValue);
    renderWithPagination();
}

function getCurrentSearchValue() {
    const desktopSearch = document.getElementById('search-desktop')?.value.trim();
    const mobileSearch = document.getElementById('search-mobile')?.value.trim();
    return (desktopSearch || mobileSearch || '').toLowerCase();
}

function getCheckedCategories() {
    return [...document.querySelectorAll('.form-check-input[name="category"]:checked')]
        .map(checkbox => checkbox.value);
}

function getCurrentSortValue() {
    const desktopSort = document.getElementById('sort-desktop')?.value;
    const mobileSort = document.getElementById('sort-mobile')?.value;

    if (window.matchMedia('(max-width: 767.98px)').matches) {
        return mobileSort || desktopSort || 'price-low-high';
    }

    return desktopSort || mobileSort || 'price-low-high';
}

function sortComponents(components, sortBy) {
    const sortedComponents = [...components];

    switch (sortBy) {
        case 'price-low-high':
            return sortedComponents.sort((a, b) => a.price - b.price);
        case 'price-high-low':
            return sortedComponents.sort((a, b) => b.price - a.price);
        case 'a-z':
            return sortedComponents.sort((a, b) => a.name.localeCompare(b.name));
        case 'z-a':
            return sortedComponents.sort((a, b) => b.name.localeCompare(a.name));
        case 'newest':
            return sortedComponents.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
        case 'oldest':
            return sortedComponents.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
        default:
            return sortedComponents;
    }
}

// ==================== COMPONENT RENDERING ====================
function renderWithPagination() {
    const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);

    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPageComponents = filteredComponents.slice(startIndex, startIndex + itemsPerPage);

    renderComponents(currentPageComponents);
    renderPaginationControls(totalPages);
}

function renderComponents(components) {
    const componentsHolder = document.getElementById('components-holder');
    if (!componentsHolder) return;

    if (components.length === 0) {
        componentsHolder.innerHTML = '<div class="col-12"><div class="alert alert-secondary">No components match your filters.</div></div>';
        return;
    }

    componentsHolder.innerHTML = components.map(component => {
        const isInBuild = buildComponents.some(comp => comp.id === component.id);
        const sameCategoryComponent = buildComponents.find(comp => comp.category === component.category);
        const willReplace = sameCategoryComponent && sameCategoryComponent.id !== component.id;
        const isFavorite = favoriteComponentIds.includes(component.id);
        const buttonClass = isInBuild
            ? 'btn btn-danger btn-sm flex-grow-1 fw-bold add-to-build-btn'
            : 'btn btn-outline-success btn-sm flex-grow-1 fw-bold add-to-build-btn';
        const buttonText = getBuildButtonText(component, isInBuild, willReplace);
        const favoriteClass = isFavorite ? 'fa-solid fa-heart favorite-icon active' : 'fa-regular fa-heart favorite-icon';

        return `
            <div class="col-12 col-lg-6 col-xl-4">
                <div class="card component-card h-100 position-relative">
                    <i class="${favoriteClass}" title="Toggle favorite" data-component-id="${helpers.escapeHTML(component.id)}"></i>
                    <div class="card-img-wrapper">
                        <img src="${helpers.normalizeImagePath(component.image_path)}" alt="${helpers.escapeHTML(component.name)}">
                    </div>
                    <div class="card-body d-flex flex-column">
                        <div class="mb-2 d-flex flex-wrap gap-1">
                            <span class="badge bg-primary">${helpers.prettyText(component.category)}</span>
                            <span class="badge bg-secondary">${helpers.prettyText(component.brand)}</span>
                        </div>
                        <h6 class="card-title fw-bold">${helpers.escapeHTML(component.name)}</h6>
                        <h4 class="text-success mt-auto pt-3">${helpers.formatPrice(component.price)}</h4>
                        <div class="d-flex gap-2 mt-3">
                            <button class="${buttonClass}" data-component-id="${helpers.escapeHTML(component.id)}">
                                ${buttonText}
                            </button>
                            <button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#componentModal" data-component-id="${helpers.escapeHTML(component.id)}">
                                <i class="fa-solid fa-circle-info me-1"></i> Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getBuildButtonText(component, isInBuild, willReplace) {
    if (isInBuild) {
        return '<i class="fa-solid fa-trash me-1"></i> Remove';
    }

    if (willReplace) {
        return `<i class="fa-solid fa-arrows-rotate me-1"></i> Replace ${helpers.prettyCategory(component.category)}`;
    }

    return '<i class="fa-solid fa-plus me-1"></i> Add';
}

function renderPaginationControls(totalPages) {
    const paginationBars = document.querySelectorAll('.pagination');
    if (paginationBars.length === 0) return;

    if (totalPages <= 1) {
        paginationBars.forEach(pagination => {
            pagination.innerHTML = '';
        });
        return;
    }

    let paginationHTML = '';

    paginationHTML += currentPage === 1
        ? '<li class="page-item disabled"><span class="page-link">Previous</span></li>'
        : `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;

    getPagesToShow(currentPage, totalPages).forEach(page => {
        if (page === '...') {
            paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        } else if (page === currentPage) {
            paginationHTML += `<li class="page-item active"><span class="page-link">${page}</span></li>`;
        } else {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${page}">${page}</a></li>`;
        }
    });

    paginationHTML += currentPage === totalPages
        ? '<li class="page-item disabled"><span class="page-link">Next</span></li>'
        : `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;

    paginationBars.forEach(pagination => {
        pagination.innerHTML = paginationHTML;
    });

    document.querySelectorAll('.pagination .page-link[data-page]').forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            currentPage = Number(this.dataset.page);
            renderWithPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function getPagesToShow(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages = [1];

    if (current <= 4) {
        for (let page = 2; page <= Math.min(5, total - 1); page++) {
            pages.push(page);
        }
        pages.push('...', total);
    } else if (current >= total - 3) {
        pages.push('...');
        for (let page = Math.max(total - 4, 2); page <= total; page++) {
            pages.push(page);
        }
    } else {
        pages.push('...', current - 1, current, current + 1, '...', total);
    }

    return pages;
}

// ==================== MODAL DETAILS ====================
function showComponentDetails(componentId) {
    const component = findComponentById(componentId);
    if (!component) return;
    populateModal(component);
}

function populateModal(component) {
    const modalTitle = document.querySelector('#componentModal .modal-title');
    const modalDisplayTitle = document.querySelector('#modal-title');
    const modalImage = document.querySelector('#modal-image');
    const modalSpecs = document.querySelector('#modal-specs');
    const modalPrice = document.querySelector('#modal-price');
    const modalCategory = document.querySelector('#modal-category');
    const modalBrand = document.querySelector('#modal-brand');
    const modalBuildButton = document.querySelector('#modal-build-button');

    if (modalTitle) modalTitle.textContent = component.name;
    if (modalDisplayTitle) modalDisplayTitle.textContent = component.name;
    if (modalImage) {
        modalImage.src = helpers.normalizeImagePath(component.image_path);
        modalImage.alt = component.name;
    }
    if (modalPrice) modalPrice.textContent = helpers.formatPrice(component.price);
    if (modalCategory) modalCategory.textContent = helpers.prettyText(component.category);
    if (modalBrand) modalBrand.textContent = helpers.prettyText(component.brand);
    if (modalSpecs) modalSpecs.innerHTML = formatComponentSpecsRecursive(component.specs || {});

    if (modalBuildButton) {
        const isInBuild = buildComponents.some(comp => comp.id === component.id);
        const sameCategoryComponent = buildComponents.find(comp => comp.category === component.category);
        const willReplace = sameCategoryComponent && sameCategoryComponent.id !== component.id;
        modalBuildButton.dataset.componentId = component.id;
        modalBuildButton.className = getModalBuildButtonClass(isInBuild, willReplace);
        modalBuildButton.innerHTML = getModalBuildButtonText(component, isInBuild, willReplace);
    }
}

function getModalBuildButtonClass(isInBuild, willReplace) {
    if (isInBuild) return 'btn btn-danger fw-bold';
    if (willReplace) return 'btn btn-warning fw-bold';
    return 'btn btn-success fw-bold';
}

function getModalBuildButtonText(component, isInBuild, willReplace) {
    if (isInBuild) {
        return '<i class="fa-solid fa-trash me-1"></i> Remove from Build';
    }

    if (willReplace) {
        return `<i class="fa-solid fa-arrows-rotate me-1"></i> Replace ${helpers.prettyCategory(component.category)} in Build`;
    }

    return '<i class="fa-solid fa-plus me-1"></i> Add to Build';
}

function formatComponentSpecsRecursive(specs, level = 0) {
    return Object.entries(specs).map(([key, value]) => {
        const prettyKey = helpers.prettyText(key);

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return `
                <div class="mb-3 ${level > 0 ? 'ps-3' : ''}">
                    <h6 class="text-uppercase fw-bold ${level === 0 ? 'text-primary' : 'text-secondary'}">${prettyKey}</h6>
                    <div class="${level > 0 ? 'ps-3' : ''}">
                        ${formatComponentSpecsRecursive(value, level + 1)}
                    </div>
                </div>
            `;
        }

        const displayValue = Array.isArray(value) ? value.join(', ') : value;
        return `
            <div class="d-flex justify-content-between gap-3 py-2 border-bottom ${level > 0 ? 'ps-3' : ''}">
                <span class="text-muted">${prettyKey}:</span>
                <span class="fw-medium text-end">${helpers.escapeHTML(String(displayValue))}</span>
            </div>
        `;
    }).join('');
}

// ==================== BUILD STATE ====================
function toggleBuildComponent(component) {
    const existingIndex = buildComponents.findIndex(comp => comp.id === component.id);

    if (existingIndex !== -1) {
        buildComponents.splice(existingIndex, 1);
    } else {
        addOrReplaceBuildComponent(component);
    }

    saveBuildState();
    updateBuildDisplay();
    updateAllButtonStates();
}

function addComponentToBuild(component) {
    addOrReplaceBuildComponent(component);
    saveBuildState();

    updateBuildDisplay();
    updateAllButtonStates();
}

function addOrReplaceBuildComponent(component) {
    buildComponents = buildComponents.filter(existingComponent => existingComponent.category !== component.category);
    buildComponents.push(component);
}

function removeFromBuild(componentId) {
    buildComponents = buildComponents.filter(comp => comp.id !== componentId);
    saveBuildState();
    updateBuildDisplay();
    updateAllButtonStates();
}

function updateAllButtonStates() {
    document.querySelectorAll('.add-to-build-btn').forEach(button => {
        const component = findComponentById(button.dataset.componentId);
        if (!component) return;

        const isInBuild = buildComponents.some(comp => comp.id === component.id);
        const sameCategoryComponent = buildComponents.find(comp => comp.category === component.category);
        const willReplace = sameCategoryComponent && sameCategoryComponent.id !== component.id;
        button.className = isInBuild
            ? 'btn btn-danger btn-sm flex-grow-1 fw-bold add-to-build-btn'
            : 'btn btn-outline-success btn-sm flex-grow-1 fw-bold add-to-build-btn';
        button.innerHTML = getBuildButtonText(component, isInBuild, willReplace);
    });
}

// ==================== SIDEBAR RENDERING ====================
function updateBuildDisplay() {
    renderBuildList('desktop-build-list', 'mb-2');
    renderBuildList('mobile-build-list', 'mb-3');
    renderCompatibilityAlerts('desktop-compatibility-alerts');
    renderCompatibilityAlerts('mobile-compatibility-alerts');
    renderFavoritesList('desktop-favorites-list', 'mb-2');
    renderFavoritesList('mobile-favorites-list', 'mb-3');
    renderSavedBuildsList('desktop-saved-builds-list', 'mb-2');
    renderSavedBuildsList('mobile-saved-builds-list', 'mb-3');
    updateBuildTotals();
    updateFavoriteCounts();
    updateSavedBuildCounts();
}

function renderBuildList(containerId, marginClass) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (buildComponents.length === 0) {
        container.innerHTML = '<p class="small text-white-50 mb-0">No components selected.</p>';
        return;
    }

    container.innerHTML = buildComponents.map(component => `
        <div class="card bg-dark border-secondary ${marginClass} build-component">
            <div class="card-body p-2 d-flex justify-content-between align-items-center gap-2">
                <div class="overflow-hidden">
                    <div class="small fw-bold text-truncate" title="${helpers.escapeHTML(component.name)}">${helpers.escapeHTML(component.name)}</div>
                    <div class="text-success small">${helpers.formatPrice(component.price)}</div>
                </div>
                <button class="btn btn-sm text-danger px-1 remove-from-build-btn" data-component-id="${helpers.escapeHTML(component.id)}" title="Remove">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==================== COMPATIBILITY ====================
function renderCompatibilityAlerts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alerts = getCompatibilityAlerts();
    if (alerts.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.type} py-2 px-2 small mb-2">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>${helpers.escapeHTML(alert.message)}
        </div>
    `).join('');
}

function getCompatibilityAlerts() {
    const alerts = [];
    const processor = buildComponents.find(component => component.category === 'processor');
    const motherboard = buildComponents.find(component => component.category === 'motherboard');
    const memory = buildComponents.find(component => component.category === 'memory');
    const storage = buildComponents.find(component => component.category === 'storage');
    const powerSupply = buildComponents.find(component => component.category === 'power_supply');
    const power = calculatePowerSummary();

    if (processor && motherboard) {
        const cpuSocket = processor.specs?.socket;
        const motherboardSocket = motherboard.specs?.socket;
        if (cpuSocket && motherboardSocket && cpuSocket !== motherboardSocket) {
            alerts.push({
                type: 'danger',
                message: `CPU socket ${cpuSocket} does not match motherboard socket ${motherboardSocket}.`
            });
        }
    }

    if (motherboard && memory) {
        const motherboardMemoryType = motherboard.specs?.memory_type;
        const memoryType = memory.specs?.type;
        if (motherboardMemoryType && memoryType && motherboardMemoryType !== memoryType) {
            alerts.push({
                type: 'danger',
                message: `Motherboard supports ${motherboardMemoryType}, but selected RAM is ${memoryType}.`
            });
        }
    }

    if (motherboard && storage) {
        const storageSupport = getStorageCompatibility(motherboard, storage);
        if (!storageSupport.compatible) {
            alerts.push({
                type: 'danger',
                message: storageSupport.message
            });
        }
    }

    if (powerSupply) {
        const psuWattage = helpers.extractPsuWattage(powerSupply);
        if (psuWattage > 0 && psuWattage < power.requiredPower) {
            alerts.push({
                type: 'warning',
                message: `Selected PSU capacity is ${psuWattage}W. Estimated draw is ${power.currentPower}W; recommended PSU is ${power.requiredPower}W.`
            });
        }
    }

    return alerts;
}

function getStorageCompatibility(motherboard, storage) {
    const connectors = motherboard.specs?.storage_connectors || {};
    const formFactor = String(storage.specs?.form_factor || '');
    const storageInterface = String(storage.specs?.interface || '');
    const isM2 = formFactor.toLowerCase().includes('m.2') || storageInterface.toLowerCase().includes('pcie');
    const isSata = storageInterface.toLowerCase().includes('sata');

    if (isM2 && Number(connectors.m2 || 0) <= 0) {
        return {
            compatible: false,
            message: `Selected storage needs M.2/PCIe, but motherboard has no M.2 slots.`
        };
    }

    if (isSata && Number(connectors.sata || 0) <= 0) {
        return {
            compatible: false,
            message: `Selected storage needs SATA, but motherboard has no SATA connectors.`
        };
    }

    return { compatible: true, message: '' };
}

function renderFavoritesList(containerId, marginClass) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const favoriteComponents = favoriteComponentIds
        .map(componentId => findComponentById(componentId))
        .filter(Boolean);

    if (favoriteComponents.length === 0) {
        container.innerHTML = '<p class="small text-white-50 mb-0">No favorite components.</p>';
        return;
    }

    container.innerHTML = favoriteComponents.map(component => {
        const isInBuild = buildComponents.some(comp => comp.id === component.id);
        return `
            <div class="card bg-dark border-secondary ${marginClass}">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div class="overflow-hidden">
                            <div class="small fw-bold text-truncate" title="${helpers.escapeHTML(component.name)}">${helpers.escapeHTML(component.name)}</div>
                            <div class="text-success small">${helpers.formatPrice(component.price)}</div>
                        </div>
                        <button class="btn btn-sm text-danger px-1 remove-favorite-btn" data-component-id="${helpers.escapeHTML(component.id)}" title="Remove favorite">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <button class="btn btn-outline-success btn-sm w-100 mt-2 add-favorite-to-build-btn" data-component-id="${helpers.escapeHTML(component.id)}" ${isInBuild ? 'disabled' : ''}>
                        ${isInBuild ? '<i class="fa-solid fa-check me-1"></i> Added to Build' : '<i class="fa-solid fa-plus me-1"></i> Add to Build'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderSavedBuildsList(containerId, marginClass) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (savedBuilds.length === 0) {
        container.innerHTML = '<p class="small text-white-50 mb-0">No saved builds.</p>';
        return;
    }

    container.innerHTML = savedBuilds.map(build => {
        const components = build.componentIds
            .map(componentId => findComponentById(componentId))
            .filter(Boolean);
        const totalPrice = components.reduce((sum, component) => sum + Number(component.price || 0), 0);

        return `
            <div class="card bg-dark border-secondary ${marginClass}">
                <div class="card-body p-2">
                    <div class="small fw-bold text-truncate" title="${helpers.escapeHTML(build.name)}">${helpers.escapeHTML(build.name)}</div>
                    <div class="small text-white-50">${components.length} components</div>
                    <div class="small text-success">${helpers.formatPrice(totalPrice)}</div>
                    <div class="d-flex gap-2 mt-2">
                        <button class="btn btn-outline-primary btn-sm flex-grow-1 load-saved-build-btn" data-build-id="${helpers.escapeHTML(build.id)}">
                            <i class="fa-solid fa-rotate me-1"></i> Load
                        </button>
                        <button class="btn btn-outline-danger btn-sm delete-saved-build-btn" data-build-id="${helpers.escapeHTML(build.id)}" title="Delete saved build">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateBuildTotals() {
    const totalPrice = buildComponents.reduce((sum, comp) => sum + Number(comp.price || 0), 0);
    const power = calculatePowerSummary();

    setText('desktop-total-price', helpers.formatPrice(totalPrice));
    setText('desktop-current-power', `${power.currentPower}W`);
    setText('desktop-required-power', `${power.requiredPower}W`);
    setText('mobile-total-price', helpers.formatPrice(totalPrice));
    setText('mobile-current-power', `${power.currentPower}W`);
    setText('mobile-required-power', `${power.requiredPower}W`);
}

function calculatePowerSummary() {
    const currentPower = buildComponents.reduce((sum, component) => {
        return sum + helpers.estimateComponentPower(component);
    }, 0);

    const requiredPower = currentPower === 0 ? 0 : Math.ceil((currentPower * 1.3) / 50) * 50;

    return {
        currentPower,
        requiredPower
    };
}

// ==================== FAVORITES ====================
function toggleFavorite(componentId) {
    if (favoriteComponentIds.includes(componentId)) {
        favoriteComponentIds = favoriteComponentIds.filter(id => id !== componentId);
    } else {
        favoriteComponentIds.push(componentId);
    }

    saveFavorites();
    renderWithPagination();
    updateBuildDisplay();
}

function updateFavoriteCounts() {
    setText('desktop-favorite-count', favoriteComponentIds.length);
    setText('mobile-favorite-count', favoriteComponentIds.length);
}

function updateSavedBuildCounts() {
    setText('desktop-saved-build-count', savedBuilds.length);
    setText('mobile-saved-build-count', savedBuilds.length);
}

// ==================== STORAGE ====================
function loadSavedState() {
    const savedBuildIds = readStorageArray(LOCAL_STORAGE_KEY);
    favoriteComponentIds = readStorageArray(FAVORITE_STORAGE_KEY);
    savedBuilds = readStorageArray(SAVED_BUILDS_STORAGE_KEY).filter(build => {
        return build && typeof build.id === 'string' && typeof build.name === 'string' && Array.isArray(build.componentIds);
    });
    buildComponents = savedBuildIds
        .map(componentId => findComponentById(componentId))
        .filter(Boolean);
}

function saveBuildState() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(buildComponents.map(component => component.id)));
}

function saveFavorites() {
    localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(favoriteComponentIds));
}

function saveSavedBuilds() {
    localStorage.setItem(SAVED_BUILDS_STORAGE_KEY, JSON.stringify(savedBuilds));
}

// ==================== SAVED BUILDS ====================
function saveCurrentBuild() {
    const buildName = getBuildName();

    if (!buildName) {
        setSaveBuildStatus('Enter a build name first.', true);
        return;
    }

    if (buildComponents.length === 0) {
        setSaveBuildStatus('Add at least one component before saving.', true);
        return;
    }

    const existingBuild = savedBuilds.find(build => build.name.toLowerCase() === buildName.toLowerCase());
    const componentIds = buildComponents.map(component => component.id);

    if (existingBuild) {
        existingBuild.componentIds = componentIds;
        existingBuild.updatedAt = new Date().toISOString();
    } else {
        savedBuilds.push({
            id: `build-${Date.now()}`,
            name: buildName,
            componentIds,
            updatedAt: new Date().toISOString()
        });
    }

    saveSavedBuilds();
    updateBuildDisplay();
    setSaveBuildStatus(existingBuild ? 'Saved build updated.' : 'Build saved.');
}

function loadSavedBuild(buildId) {
    const savedBuild = savedBuilds.find(build => build.id === buildId);
    if (!savedBuild) return;

    buildComponents = savedBuild.componentIds
        .map(componentId => findComponentById(componentId))
        .filter(Boolean);

    saveBuildState();
    setBuildName(savedBuild.name);
    updateBuildDisplay();
    renderWithPagination();
    setSaveBuildStatus(`Loaded "${savedBuild.name}".`);
}

function deleteSavedBuild(buildId) {
    savedBuilds = savedBuilds.filter(build => build.id !== buildId);
    saveSavedBuilds();
    updateBuildDisplay();
}

function getBuildName() {
    const input = [...document.querySelectorAll('.build-name-input')]
        .find(element => element.value.trim());
    return input ? input.value.trim() : '';
}

function setBuildName(name) {
    syncBuildNameInputs(name);
}

function syncBuildNameInputs(name) {
    document.querySelectorAll('.build-name-input').forEach(input => {
        input.value = name;
    });
}

function updateBuildNameStatus(name) {
    const buildName = String(name || '').trim();
    if (!buildName) {
        setSaveBuildStatus('');
        return;
    }

    const existingBuild = savedBuilds.find(build => build.name.toLowerCase() === buildName.toLowerCase());
    setSaveBuildStatus(existingBuild ? 'A saved build with this name will be updated.' : '', false, 'warning');
}

function setSaveBuildStatus(message, isError = false, tone = 'success') {
    document.querySelectorAll('.save-build-status').forEach(status => {
        status.textContent = message;
        status.classList.toggle('text-danger', isError);
        status.classList.toggle('text-warning', !isError && tone === 'warning' && Boolean(message));
        status.classList.toggle('text-success', !isError && tone === 'success' && Boolean(message));
        status.classList.toggle('text-white-50', !isError && !message);
    });
}

// ==================== UTILITIES ====================
function readStorageArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function findComponentById(componentId) {
    return allComponents.find(component => component.id === componentId);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatComponentSpecs(specs) {
    return formatComponentSpecsRecursive(specs);
}

const helpers = {
    fixAria: function () {
        function handleHideFocus() {
            if (document.activeElement) {
                document.activeElement.blur();
            }
        }

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('hide.bs.modal', handleHideFocus);
        });

        document.querySelectorAll('.offcanvas').forEach(offcanvas => {
            offcanvas.addEventListener('hide.bs.offcanvas', handleHideFocus);
        });
    },

    prettyText: function (text) {
        return String(text || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    },

    prettyCategory: function (category) {
        const labels = {
            processor: 'CPU',
            graphics_card: 'GPU',
            power_supply: 'PSU'
        };

        return labels[category] || this.prettyText(category);
    },

    formatPrice: function (price) {
        return `$${Number(price || 0).toFixed(2)}`;
    },

    normalizeImagePath: function (path) {
        return String(path || '').replace(/^\/+/, '');
    },

    extractWattage: function (component) {
        const tdp = component?.specs?.tdp;
        if (!tdp) return 0;

        const wattage = parseInt(String(tdp).replace('W', ''), 10);
        return Number.isNaN(wattage) ? 0 : wattage;
    },

    extractPsuWattage: function (component) {
        const wattage = component?.specs?.wattage;
        if (!wattage) return 0;

        const parsedWattage = parseInt(String(wattage).replace('W', ''), 10);
        return Number.isNaN(parsedWattage) ? 0 : parsedWattage;
    },

    estimateComponentPower: function (component) {
        const tdp = this.extractWattage(component);
        if (tdp > 0) return tdp;

        const estimatesByCategory = {
            motherboard: 50,
            memory: 8,
            storage: 8,
            monitor: 0,
            mouse: 2,
            keyboard: 3,
            headset: 3,
            power_supply: 0
        };

        return estimatesByCategory[component.category] || 0;
    },

    escapeHTML: function (value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    footerText: function () {
        const footer = document.getElementById('footer-text');
        if (footer) {
            footer.innerHTML = `&copy; ${new Date().getFullYear()} PC Builder. All rights reserved.`;
        }
    }
};
