/**
 * projects.js
 *
 * Saved-projects feature: save the current flow field as a named project
 * (with a rendered thumbnail), browse all saved projects in a gallery,
 * and reopen one to keep editing. Projects are persisted server-side as
 * JSON files via the /api/projects endpoints.
 */

(function () {
    'use strict';

    const STATE_VERSION = 1;

    // Identity of the project currently being edited (null = unsaved/new).
    let currentProjectId = null;
    let currentProjectName = null;

    // ---------------------------------------------------------------------
    // Serialization
    // ---------------------------------------------------------------------

    /**
     * Capture everything needed to fully restore the current canvas.
     * Per-layer settings already mirror the global generator parameters,
     * so the layers + active selection + interactive magnets are the
     * complete persistent state.
     */
    function serializeProjectState() {
        if (typeof persistSettingsToActiveLayer === 'function') {
            // Make sure the active layer's settings reflect the live UI.
            persistSettingsToActiveLayer();
        }
        const clone = (v) => JSON.parse(JSON.stringify(v));
        return {
            version: STATE_VERSION,
            layers: clone(flowState.layers),
            activeLayerId: flowState.activeLayerId,
            syncAllLayers: !!flowState.syncAllLayers,
            magnets: clone(flowState.magnets || []),
            magnetConfig: clone(flowState.magnetConfig || {}),
            // Stored for forward-compatibility / safety even though the active
            // layer's settings already carry these.
            widthMm: flowState.widthMm,
            heightMm: flowState.heightMm
        };
    }

    /**
     * Restore a previously serialized state into flowState and the UI.
     */
    function applyProjectState(state) {
        if (!state || !Array.isArray(state.layers) || state.layers.length === 0) {
            throw new Error('Project data is empty or corrupt.');
        }

        const clone = (v) => JSON.parse(JSON.stringify(v));

        flowState.layers = clone(state.layers);
        flowState.layers.forEach((layer) => {
            if (typeof ensureLayerDefaults === 'function') ensureLayerDefaults(layer);
        });

        // Resolve active layer, falling back to the first if the id is missing.
        const hasActive = flowState.layers.some(l => l.id === state.activeLayerId);
        flowState.activeLayerId = hasActive ? state.activeLayerId : flowState.layers[0].id;

        flowState.syncAllLayers = !!state.syncAllLayers;
        flowState.magnets = clone(state.magnets || []);
        flowState.magnetConfig = Object.assign(
            { strength: 50, radius: 100, rotation: 0, enabled: true, visible: true },
            clone(state.magnetConfig || {})
        );

        // Apply the active layer's settings to the global state + controls.
        const activeLayer = (typeof getActiveLayer === 'function')
            ? getActiveLayer()
            : flowState.layers.find(l => l.id === flowState.activeLayerId);

        if (activeLayer && typeof applySettingsToFlowState === 'function') {
            applySettingsToFlowState(activeLayer.settings);
        }
        // applySettingsToFlowState re-inits the canvas only when paper size
        // changes; do it unconditionally so pxPerMm is always correct.
        if (typeof initCanvas === 'function') initCanvas();
        if (activeLayer && typeof applySettingsToUI === 'function') {
            applySettingsToUI(activeLayer.settings);
        }

        // Reflect global-only controls that aren't part of layer settings.
        const syncEl = document.getElementById('sync-all-layers');
        if (syncEl) syncEl.checked = flowState.syncAllLayers;
        const magnetsEnabledEl = document.getElementById('magnets-enabled');
        if (magnetsEnabledEl) magnetsEnabledEl.checked = !!flowState.magnetConfig.enabled;
        const magnetsVisibleEl = document.getElementById('magnets-visible');
        if (magnetsVisibleEl) magnetsVisibleEl.checked = !!flowState.magnetConfig.visible;

        if (typeof syncPathsFromLayers === 'function') syncPathsFromLayers();
        if (typeof renderLayerList === 'function') renderLayerList();
        if (typeof renderCanvas === 'function') renderCanvas();
        if (typeof updateStatistics === 'function') updateStatistics();
    }

    // ---------------------------------------------------------------------
    // Thumbnail
    // ---------------------------------------------------------------------

    /**
     * Render a clean thumbnail (white background, no zoom/pan/magnets) of all
     * visible layers and return it as a PNG data URL.
     */
    function generateThumbnail(maxDim = 360) {
        const w = flowState.widthMm || 297;
        const h = flowState.heightMm || 420;
        const aspect = w / h;

        let tw, th;
        if (aspect >= 1) {
            tw = maxDim;
            th = Math.round(maxDim / aspect);
        } else {
            th = maxDim;
            tw = Math.round(maxDim * aspect);
        }

        const c = document.createElement('canvas');
        c.width = tw;
        c.height = th;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tw, th);

        const scale = tw / w; // px per mm
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const layer of flowState.layers) {
            if (!layer.visible) continue;
            const layerStroke = (layer.settings && layer.settings.strokeWidth) || flowState.strokeWidth || 0.4;
            ctx.lineWidth = Math.max(0.35, layerStroke * scale);
            for (const path of layer.paths) {
                const coords = path.coords;
                if (!coords || coords.length < 2) continue;
                ctx.strokeStyle = path.color || layer.color || '#000000';
                ctx.beginPath();
                ctx.moveTo(coords[0][0] * scale, coords[0][1] * scale);
                for (let i = 1; i < coords.length; i++) {
                    ctx.lineTo(coords[i][0] * scale, coords[i][1] * scale);
                }
                ctx.stroke();
            }
        }

        return c.toDataURL('image/png');
    }

    function countLines() {
        let n = 0;
        for (const layer of flowState.layers) {
            if (!layer.visible) continue;
            for (const path of layer.paths) {
                if (path.coords && path.coords.length >= 2) n++;
            }
        }
        return n;
    }

    // ---------------------------------------------------------------------
    // API
    // ---------------------------------------------------------------------

    async function apiListProjects() {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to load projects');
        const data = await res.json();
        return data.projects || [];
    }

    async function apiGetProject(id) {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error('Failed to load project');
        return res.json();
    }

    function buildPayload(name) {
        return {
            name: name,
            thumbnail: generateThumbnail(),
            lineCount: countLines(),
            layerCount: flowState.layers.length,
            state: serializeProjectState()
        };
    }

    async function apiCreateProject(name) {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(name))
        });
        if (!res.ok) throw new Error('Failed to create project');
        const data = await res.json();
        return data.project;
    }

    async function apiUpdateProject(id, name) {
        const res = await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(name))
        });
        if (!res.ok) throw new Error('Failed to save project');
        const data = await res.json();
        return data.project;
    }

    async function apiRenameProject(id, name) {
        const res = await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Failed to rename project');
        const data = await res.json();
        return data.project;
    }

    async function apiDeleteProject(id) {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete project');
    }

    // ---------------------------------------------------------------------
    // Save flow
    // ---------------------------------------------------------------------

    function setCurrentProject(project) {
        currentProjectId = project ? project.id : null;
        currentProjectName = project ? project.name : null;
        updateCurrentProjectLabel();
    }

    function updateCurrentProjectLabel() {
        const el = document.getElementById('current-project-name');
        if (!el) return;
        if (currentProjectName) {
            el.textContent = currentProjectName;
            el.classList.add('has-project');
        } else {
            el.textContent = 'Unsaved project';
            el.classList.remove('has-project');
        }
    }

    /** Quick-save: update the open project, or prompt for a name when new. */
    async function saveCurrentProject() {
        if (countLines() === 0) {
            showToast('Nothing to save yet — generate a flow field first.', 'error');
            return;
        }
        if (currentProjectId) {
            try {
                const updated = await apiUpdateProject(currentProjectId, currentProjectName);
                setCurrentProject(updated);
                showToast('Project saved.');
            } catch (err) {
                showToast(err.message, 'error');
            }
        } else {
            openNameDialog({
                title: 'Save project',
                defaultValue: '',
                confirmLabel: 'Save',
                onConfirm: async (name) => {
                    try {
                        const project = await apiCreateProject(name);
                        setCurrentProject(project);
                        showToast('Project saved.');
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            });
        }
    }

    /** Always create a brand-new project from the current state. */
    function saveAsNewProject() {
        if (countLines() === 0) {
            showToast('Nothing to save yet — generate a flow field first.', 'error');
            return;
        }
        const base = currentProjectName ? `${currentProjectName} copy` : '';
        openNameDialog({
            title: 'Save as new project',
            defaultValue: base,
            confirmLabel: 'Save copy',
            onConfirm: async (name) => {
                try {
                    const project = await apiCreateProject(name);
                    setCurrentProject(project);
                    showToast('Saved as new project.');
                    refreshGalleryIfOpen();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    }

    async function openProject(id) {
        try {
            const project = await apiGetProject(id);
            applyProjectState(project.state);
            setCurrentProject(project);
            closeModal();
            showToast(`Opened “${project.name}”.`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ---------------------------------------------------------------------
    // UI: modal gallery
    // ---------------------------------------------------------------------

    let overlayEl = null;

    function ensureOverlay() {
        if (overlayEl) return overlayEl;
        overlayEl = document.createElement('div');
        overlayEl.className = 'projects-overlay';
        overlayEl.addEventListener('mousedown', (e) => {
            if (e.target === overlayEl) closeModal();
        });
        document.body.appendChild(overlayEl);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlayEl.classList.contains('open')) closeModal();
        });
        return overlayEl;
    }

    function closeModal() {
        if (overlayEl) overlayEl.classList.remove('open');
    }

    function isModalOpen() {
        return overlayEl && overlayEl.classList.contains('open');
    }

    async function openProjectsMenu() {
        const overlay = ensureOverlay();
        overlay.innerHTML = '';

        const modal = document.createElement('div');
        modal.className = 'projects-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'projects-modal-header';
        header.innerHTML = `
            <div>
                <h2>Projects</h2>
                <p class="projects-modal-sub">Saved flow fields — click a card to keep editing</p>
            </div>`;
        const headerActions = document.createElement('div');
        headerActions.className = 'projects-modal-header-actions';
        const saveNewBtn = document.createElement('button');
        saveNewBtn.className = 'btn btn-primary btn-compact';
        saveNewBtn.textContent = '+ Save current as new';
        saveNewBtn.addEventListener('click', saveAsNewProject);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'projects-close-btn';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeModal);
        headerActions.appendChild(saveNewBtn);
        headerActions.appendChild(closeBtn);
        header.appendChild(headerActions);

        const body = document.createElement('div');
        body.className = 'projects-modal-body';
        body.innerHTML = '<div class="projects-loading">Loading…</div>';

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        overlay.classList.add('open');

        await renderGallery(body);
    }

    function refreshGalleryIfOpen() {
        if (!isModalOpen()) return;
        const body = overlayEl.querySelector('.projects-modal-body');
        if (body) renderGallery(body);
    }

    async function renderGallery(body) {
        let projects;
        try {
            projects = await apiListProjects();
        } catch (err) {
            body.innerHTML = `<div class="projects-empty">${err.message}</div>`;
            return;
        }

        if (!projects.length) {
            body.innerHTML = `
                <div class="projects-empty">
                    <p>No saved projects yet.</p>
                    <p class="projects-empty-hint">Use “Save current as new” to store this flow field.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'projects-grid';

        for (const project of projects) {
            grid.appendChild(buildProjectCard(project));
        }

        body.innerHTML = '';
        body.appendChild(grid);
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function buildProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        if (project.id === currentProjectId) card.classList.add('is-current');

        // Thumbnail (click to open)
        const thumb = document.createElement('div');
        thumb.className = 'project-thumb';
        if (project.thumbnail) {
            const img = document.createElement('img');
            img.src = project.thumbnail;
            img.alt = project.name;
            thumb.appendChild(img);
        } else {
            thumb.classList.add('no-thumb');
            thumb.textContent = 'No preview';
        }
        thumb.addEventListener('click', () => openProject(project.id));

        // Info
        const info = document.createElement('div');
        info.className = 'project-info';

        const nameRow = document.createElement('div');
        nameRow.className = 'project-name-row';
        const name = document.createElement('span');
        name.className = 'project-name';
        name.textContent = project.name;
        if (project.id === currentProjectId) {
            const badge = document.createElement('span');
            badge.className = 'project-current-badge';
            badge.textContent = 'Open';
            nameRow.appendChild(name);
            nameRow.appendChild(badge);
        } else {
            nameRow.appendChild(name);
        }

        const meta = document.createElement('div');
        meta.className = 'project-meta';
        const lc = project.lineCount != null ? `${project.lineCount.toLocaleString()} lines` : '';
        const layc = project.layerCount != null ? `${project.layerCount} layer${project.layerCount === 1 ? '' : 's'}` : '';
        meta.textContent = [lc, layc].filter(Boolean).join(' · ');

        const date = document.createElement('div');
        date.className = 'project-date';
        date.textContent = formatDate(project.updatedAt);

        info.appendChild(nameRow);
        info.appendChild(meta);
        info.appendChild(date);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'project-actions';

        const openBtn = document.createElement('button');
        openBtn.className = 'project-action-btn open';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => openProject(project.id));

        const renameBtn = document.createElement('button');
        renameBtn.className = 'project-action-btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => {
            openNameDialog({
                title: 'Rename project',
                defaultValue: project.name,
                confirmLabel: 'Rename',
                onConfirm: async (newName) => {
                    try {
                        const updated = await apiRenameProject(project.id, newName);
                        if (project.id === currentProjectId) setCurrentProject(updated);
                        showToast('Project renamed.');
                        refreshGalleryIfOpen();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'project-action-btn danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            openConfirmDialog({
                title: 'Delete project',
                message: `Delete “${project.name}”? This cannot be undone.`,
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    try {
                        await apiDeleteProject(project.id);
                        if (project.id === currentProjectId) setCurrentProject(null);
                        showToast('Project deleted.');
                        refreshGalleryIfOpen();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            });
        });

        actions.appendChild(openBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(actions);
        return card;
    }

    // ---------------------------------------------------------------------
    // UI: name + confirm dialogs
    // ---------------------------------------------------------------------

    function openNameDialog({ title, defaultValue, confirmLabel, onConfirm }) {
        const dialog = createDialog(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'dialog-input';
        input.placeholder = 'Project name';
        input.value = defaultValue || '';
        input.maxLength = 80;
        dialog.bodyEl.appendChild(input);

        const submit = () => {
            const name = input.value.trim();
            if (!name) {
                input.classList.add('invalid');
                input.focus();
                return;
            }
            dialog.close();
            onConfirm(name);
        };

        dialog.addButton('Cancel', 'secondary', dialog.close);
        dialog.addButton(confirmLabel || 'OK', 'primary', submit);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            input.classList.remove('invalid');
        });

        dialog.open();
        setTimeout(() => { input.focus(); input.select(); }, 30);
    }

    function openConfirmDialog({ title, message, confirmLabel, onConfirm }) {
        const dialog = createDialog(title);
        const p = document.createElement('p');
        p.className = 'dialog-message';
        p.textContent = message;
        dialog.bodyEl.appendChild(p);
        dialog.addButton('Cancel', 'secondary', dialog.close);
        dialog.addButton(confirmLabel || 'Confirm', 'danger', () => {
            dialog.close();
            onConfirm();
        });
        dialog.open();
    }

    /** Lightweight modal dialog, layered above the projects overlay. */
    function createDialog(title) {
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';

        const box = document.createElement('div');
        box.className = 'dialog-box';

        const head = document.createElement('div');
        head.className = 'dialog-title';
        head.textContent = title;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'dialog-body';

        const footer = document.createElement('div');
        footer.className = 'dialog-footer';

        box.appendChild(head);
        box.appendChild(bodyEl);
        box.appendChild(footer);
        backdrop.appendChild(box);

        function close() {
            backdrop.remove();
        }

        backdrop.addEventListener('mousedown', (e) => {
            if (e.target === backdrop) close();
        });

        function addButton(label, kind, handler) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-' + (kind === 'primary' ? 'primary' : kind === 'danger' ? 'danger' : 'secondary');
            btn.textContent = label;
            btn.addEventListener('click', handler);
            footer.appendChild(btn);
            return btn;
        }

        function open() {
            document.body.appendChild(backdrop);
            requestAnimationFrame(() => backdrop.classList.add('open'));
        }

        return { backdrop, bodyEl, addButton, open, close };
    }

    // ---------------------------------------------------------------------
    // UI: toast
    // ---------------------------------------------------------------------

    let toastTimer = null;
    function showToast(message, kind = 'success') {
        let toast = document.getElementById('projects-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'projects-toast';
            toast.className = 'projects-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'projects-toast ' + (kind === 'error' ? 'error' : 'success');
        requestAnimationFrame(() => toast.classList.add('show'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    function init() {
        const saveBtn = document.getElementById('btn-save-project');
        if (saveBtn) saveBtn.addEventListener('click', saveCurrentProject);

        const openBtn = document.getElementById('btn-open-projects');
        if (openBtn) openBtn.addEventListener('click', openProjectsMenu);

        updateCurrentProjectLabel();

        // Cmd/Ctrl+S saves the current project.
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveCurrentProject();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose a couple of helpers for debugging / external use.
    window.flowProjects = {
        save: saveCurrentProject,
        saveAsNew: saveAsNewProject,
        open: openProjectsMenu,
        serialize: serializeProjectState
    };
})();
