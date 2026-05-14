// ============================================================
//  FORO — LumenCare
//  Profesionales publican (con imágenes) · Alumnos comentan y reaccionan
// ============================================================

const CLOUDINARY_CLOUD  = 'dsdw8f4ly';
const CLOUDINARY_PRESET = 'Lumencare';
const CLOUDINARY_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

let currentUser   = null;
let esProfesional = false;
let selectedImage = null;   // File object de la imagen seleccionada

document.addEventListener('DOMContentLoaded', () => {
    if (!AuthSystem.requireAuth()) return;

    currentUser   = AuthSystem.getUser();
    if (!currentUser) { window.location.href = 'index.html'; return; }

    esProfesional = currentUser.tipo_cuenta === 'profesional';

    updateUserUI();
    setupEventListeners();
    updateForumUI();
    loadPosts();
});

function updateUserUI() {
    const n = document.getElementById('userName');
    const a = document.getElementById('userAvatar');
    if (n) n.textContent = currentUser.name.split(' ')[0];
    if (a) a.textContent = currentUser.avatar;
}

function updateForumUI() {
    const btnNewPost = document.getElementById('btnNewPost');
    const subtitle   = document.getElementById('forumSubtitle');

    if (esProfesional) {
        btnNewPost?.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Comparte recursos, consejos y orientación con la comunidad';
    } else {
        btnNewPost?.classList.add('hidden');
        if (subtitle) subtitle.textContent = 'Lee, comenta y apoya a la comunidad. Las publicaciones son creadas por profesionales.';
    }
}

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => { AuthSystem.logout(); window.location.href = 'index.html'; });
    document.getElementById('btnNewPost')?.addEventListener('click', showPostForm);
    document.getElementById('btnClosePostForm')?.addEventListener('click', hidePostForm);
    document.getElementById('btnCancelPost')?.addEventListener('click', hidePostForm);
    document.getElementById('postForm')?.addEventListener('submit', handleCreatePost);
    document.getElementById('postContent')?.addEventListener('input', (e) => {
        const counter = document.getElementById('postCharCount');
        if (counter) counter.textContent = e.target.value.length;
    });
    document.getElementById('categoryFilter')?.addEventListener('change', loadPosts);
    document.getElementById('sortFilter')?.addEventListener('change', loadPosts);

    // Drag & drop en el área de imagen
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover',  (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', ()  => { uploadArea.classList.remove('drag-over'); });
        uploadArea.addEventListener('drop',      (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                document.getElementById('postImage').files = e.dataTransfer.files;
                previewImage({ files: [file] });
            }
        });
        uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.image-preview')) return;
            document.getElementById('postImage')?.click();
        });
    }
}

// ─── IMAGEN ──────────────────────────────────────────────────────────────────

function previewImage(input) {
    const file = input.files?.[0] || input;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        Utils.showToast('La imagen no puede pesar más de 5MB', 'error');
        return;
    }

    selectedImage = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePlaceholder')?.classList.add('hidden');
        document.getElementById('imagePreview')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImage = null;
    document.getElementById('postImage').value = '';
    document.getElementById('previewImg').src  = '';
    document.getElementById('imagePlaceholder')?.classList.remove('hidden');
    document.getElementById('imagePreview')?.classList.add('hidden');
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file',          file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('folder',        'lumencare/foro');

    const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Error subiendo imagen a Cloudinary');
    const data = await response.json();
    return data.secure_url;   // URL HTTPS de la imagen
}

// ─── FORMULARIO ───────────────────────────────────────────────────────────────

function showPostForm() {
    if (!esProfesional) { Utils.showToast('Solo los profesionales pueden publicar', 'error'); return; }
    document.getElementById('postFormContainer')?.classList.remove('hidden');
    document.getElementById('postFormContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function hidePostForm() {
    document.getElementById('postFormContainer')?.classList.add('hidden');
    document.getElementById('postForm')?.reset();
    removeImage();
    const counter = document.getElementById('postCharCount');
    if (counter) counter.textContent = '0';
}

async function handleCreatePost(e) {
    e.preventDefault();

    if (!esProfesional) { Utils.showToast('Solo los profesionales pueden publicar', 'error'); return; }

    const titulo    = document.getElementById('postTitle')?.value.trim();
    const categoria = document.getElementById('postCategory')?.value;
    const contenido = document.getElementById('postContent')?.value.trim();

    if (!titulo || !categoria || !contenido) { Utils.showToast('Completa todos los campos', 'error'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Publicando...'; }

    try {
        // 1. Subir imagen a Cloudinary si hay una seleccionada
        let imagen_url = null;
        if (selectedImage) {
            Utils.showToast('Subiendo imagen...', 'info', 2000);
            imagen_url = await uploadToCloudinary(selectedImage);
        }

        // 2. Crear el post en el servidor con la URL de la imagen
        const response = await fetch('/api/foro', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AuthSystem.getToken()}` },
            body:    JSON.stringify({ titulo, categoria, contenido, imagen_url })
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Publicación creada ✨', 'success');
            hidePostForm();
            loadPosts();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        Utils.showToast('Error al crear la publicación', 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Publicar'; }
    }
}

// ─── POSTS ────────────────────────────────────────────────────────────────────

async function loadPosts() {
    try {
        const response = await fetch('/api/foro', { headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` } });
        const data     = await response.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }

        let posts = data.posts;
        const categoryFilter = document.getElementById('categoryFilter')?.value;
        if (categoryFilter) posts = posts.filter(p => p.categoria === categoryFilter);
        posts = sortPosts(posts, document.getElementById('sortFilter')?.value || 'recent');
        renderPosts(posts);
    } catch { Utils.showToast('Error cargando publicaciones', 'error'); }
}

function sortPosts(posts, sortBy) {
    switch (sortBy) {
        case 'recent':   return [...posts].sort((a,b) => new Date(b.fecha_post) - new Date(a.fecha_post));
        case 'popular':  return [...posts].sort((a,b) => b.total_likes - a.total_likes);
        case 'comments': return [...posts].sort((a,b) => b.total_comentarios - a.total_comentarios);
        default:         return posts;
    }
}

function renderPosts(posts) {
    const feed       = document.getElementById('postsFeed');
    const emptyState = document.getElementById('emptyState');
    if (!feed || !emptyState) return;

    if (posts.length === 0) { feed.classList.add('hidden'); emptyState.classList.remove('hidden'); return; }
    feed.classList.remove('hidden'); emptyState.classList.add('hidden');

    feed.innerHTML = posts.map(post => {
        const esMiPost  = post.boleta === currentUser.userId;
        const esProPost = post.tipo_autor === 'profesional';

        const authorBadge = esProPost
            ? `<span class="post-prof-badge">
                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                       <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                       <polyline points="22 4 12 14.01 9 11.01"/>
                   </svg>Profesional
               </span>` : '';

        // Imagen del post (si existe)
        const postImage = post.imagen_url
            ? `<div class="post-image-wrapper">
                   <img src="${post.imagen_url}" alt="Imagen del post" class="post-image"
                        onclick="openImageModal('${post.imagen_url}')"
                        loading="lazy">
               </div>` : '';

        const commentInput = !esProfesional
            ? `<div class="comment-input-wrapper">
                   <div class="author-avatar">${currentUser.avatar}</div>
                   <input type="text" class="comment-input" placeholder="Escribe un comentario..."
                          onkeypress="if(event.key==='Enter') addComment(${post.id_post}, this)">
               </div>` : '';

        const likeBtn = !esProfesional
            ? `<button class="action-btn ${post.yo_di_like ? 'active' : ''}" onclick="toggleLike(${post.id_post}, this)">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.yo_di_like ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                       <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                   </svg>
                   <span id="likes-count-${post.id_post}">${post.total_likes}</span>
               </button>`
            : `<span class="action-info">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                   </svg>
                   ${post.total_likes}
               </span>`;

        return `
        <div class="post-card cat-${post.categoria}" data-id="${post.id_post}">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar ${esProPost ? 'author-avatar--prof' : ''}">${post.avatar_autor}</div>
                    <div class="author-info">
                        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                            <span class="author-name">${Utils.escapeHtml(post.nombre_autor)}</span>
                            ${authorBadge}
                        </div>
                        <span class="post-date">${Utils.formatDate(post.fecha_post)}</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span class="post-category">${getCategoryName(post.categoria)}</span>
                    ${esMiPost ? `
                        <button class="entry-btn delete" onclick="deletePost(${post.id_post})" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>` : ''}
                </div>
            </div>

            <h3 class="post-title">${Utils.escapeHtml(post.titulo)}</h3>
            <p class="post-content">${Utils.escapeHtml(post.contenido)}</p>

            ${postImage}

            <div class="post-actions">
                ${likeBtn}
                <button class="action-btn" onclick="toggleComments(${post.id_post})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>${post.total_comentarios}</span>
                </button>
            </div>

            <div class="comments-section hidden" id="comments-${post.id_post}">
                ${commentInput}
                <div class="comments-list" id="comments-list-${post.id_post}">
                    <p style="text-align:center;color:var(--color-text-muted);padding:1rem;">Cargando comentarios...</p>
                </div>
            </div>
        </div>`;
    }).join('');

    feed.querySelectorAll('.post-card').forEach((card, i) => Utils.animateIn(card, i * 50));
}

// ─── MODAL DE IMAGEN ──────────────────────────────────────────────────────────

function openImageModal(url) {
    const existing = document.getElementById('imageModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    modal.innerHTML = `<img src="${url}" style="max-width:92vw;max-height:92vh;border-radius:12px;object-fit:contain;box-shadow:0 0 60px rgba(0,0,0,0.5);">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

// ─── LIKES ────────────────────────────────────────────────────────────────────

async function toggleLike(postId, btn) {
    if (esProfesional) { Utils.showToast('Solo los alumnos pueden dar like', 'info'); return; }
    try {
        const response = await fetch(`/api/foro/${postId}/like`, { method:'POST', headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data     = await response.json();
        if (!data.success) return;
        const svg     = btn.querySelector('svg');
        const countEl = document.getElementById(`likes-count-${postId}`);
        if (data.liked) { btn.classList.add('active'); svg.setAttribute('fill','currentColor'); if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1; }
        else            { btn.classList.remove('active'); svg.setAttribute('fill','none');        if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1; }
    } catch { Utils.showToast('Error al procesar like', 'error'); }
}

// ─── COMENTARIOS ──────────────────────────────────────────────────────────────

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    const isHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden');
    if (isHidden) { await loadComments(postId); section.querySelector('.comment-input')?.focus(); }
}

async function loadComments(postId) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    if (!listEl) return;
    try {
        const response = await fetch(`/api/foro/${postId}/comentarios`, { headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data     = await response.json();
        if (!data.success) return;
        listEl.innerHTML = renderComments(data.comentarios);
    } catch { listEl.innerHTML = '<p style="text-align:center;color:var(--color-text-muted)">Error cargando comentarios</p>'; }
}

async function addComment(postId, inputEl) {
    if (esProfesional) { Utils.showToast('Solo los alumnos pueden comentar', 'info'); return; }
    const text = inputEl.value.trim();
    if (!text) return;
    try {
        const response = await fetch(`/api/foro/${postId}/comentarios`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${AuthSystem.getToken()}`}, body:JSON.stringify({ contenido: text }) });
        const data     = await response.json();
        if (data.success) { inputEl.value = ''; await loadComments(postId); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error al enviar comentario', 'error'); }
}

async function deletePost(postId) {
    if (!confirm('¿Eliminar esta publicación? No se puede deshacer.')) return;
    try {
        const response = await fetch(`/api/foro/${postId}`, { method:'DELETE', headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data     = await response.json();
        if (data.success) { Utils.showToast('Publicación eliminada', 'info'); loadPosts(); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error al eliminar publicación', 'error'); }
}

function renderComments(comentarios) {
    if (comentarios.length === 0) return '<p style="text-align:center;color:var(--color-text-muted);padding:1rem;">Sé el primero en comentar</p>';
    return comentarios.map(c => `
        <div class="comment">
            <div class="author-avatar">${c.avatar_autor}</div>
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${Utils.escapeHtml(c.nombre_autor)}</span>
                    <span class="comment-date">${Utils.formatDate(c.fecha_comentario)}</span>
                </div>
                <p class="comment-text">${Utils.escapeHtml(c.contenido)}</p>
            </div>
        </div>`).join('');
}

function getCategoryName(category) {
    const categories = { stress:'😰 Manejo del estrés', anxiety:'🧠 Ansiedad académica', motivation:'💪 Motivación y metas', relationships:'🤝 Relaciones sociales', selfcare:'🌱 Autocuidado', success:'🎉 Historias de éxito', general:'💬 General' };
    return categories[category] || category;
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.toggleLike     = toggleLike;
window.toggleComments = toggleComments;
window.addComment     = addComment;
window.deletePost     = deletePost;
window.previewImage   = previewImage;
window.removeImage    = removeImage;
window.openImageModal = openImageModal;
