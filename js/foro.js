

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!AuthSystem.requireAuth()) return;

    currentUser = AuthSystem.getUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    updateUserUI();
    setupEventListeners();
    loadPosts();
});

function updateUserUI() {
    const userName   = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    if (userName)   userName.textContent   = currentUser.name.split(' ')[0];
    if (userAvatar) userAvatar.textContent = currentUser.avatar;
}

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        AuthSystem.logout();
        window.location.href = 'index.html';
    });

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
}

function showPostForm() {
    document.getElementById('postFormContainer')?.classList.remove('hidden');
    document.getElementById('postFormContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function hidePostForm() {
    document.getElementById('postFormContainer')?.classList.add('hidden');
    document.getElementById('postForm')?.reset();
    const counter = document.getElementById('postCharCount');
    if (counter) counter.textContent = '0';
}

async function handleCreatePost(e) {
    e.preventDefault();

    const titulo    = document.getElementById('postTitle')?.value.trim();
    const categoria = document.getElementById('postCategory')?.value;
    const contenido = document.getElementById('postContent')?.value.trim();

    if (!titulo || !categoria || !contenido) {
        Utils.showToast('Completa todos los campos', 'error');
        return;
    }

    try {
        const response = await fetch('/api/foro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({ titulo, categoria, contenido })
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Publicación creada ✨', 'success');
            hidePostForm();
            loadPosts();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch (error) {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

async function loadPosts() {
    try {
        const response = await fetch('/api/foro', {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });

        const data = await response.json();
        if (!data.success) {
            Utils.showToast(data.message, 'error');
            return;
        }

        let posts = data.posts;

        
        const categoryFilter = document.getElementById('categoryFilter')?.value;
        if (categoryFilter) {
            posts = posts.filter(p => p.categoria === categoryFilter);
        }

        
        const sortFilter = document.getElementById('sortFilter')?.value || 'recent';
        posts = sortPosts(posts, sortFilter);

        renderPosts(posts);

    } catch (error) {
        Utils.showToast('Error cargando publicaciones', 'error');
    }
}

function sortPosts(posts, sortBy) {
    switch (sortBy) {
        case 'recent':
            return [...posts].sort((a, b) => new Date(b.fecha_post) - new Date(a.fecha_post));
        case 'popular':
            return [...posts].sort((a, b) => b.total_likes - a.total_likes);
        case 'comments':
            return [...posts].sort((a, b) => b.total_comentarios - a.total_comentarios);
        default:
            return posts;
    }
}

function renderPosts(posts) {
    const feed       = document.getElementById('postsFeed');
    const emptyState = document.getElementById('emptyState');

    if (!feed || !emptyState) return;

    if (posts.length === 0) {
        feed.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    feed.classList.remove('hidden');
    emptyState.classList.add('hidden');

    feed.innerHTML = posts.map(post => `
        <div class="post-card cat-${post.categoria}" data-id="${post.id_post}">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${post.avatar_autor}</div>
                    <div class="author-info">
                        <span class="author-name">${Utils.escapeHtml(post.nombre_autor)}</span>
                        <span class="post-date">${Utils.formatDate(post.fecha_post)}</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span class="post-category">${getCategoryName(post.categoria)}</span>
                    ${post.boleta === currentUser.userId ? `
                        <button class="entry-btn delete" onclick="deletePost(${post.id_post})" title="Eliminar publicación">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>` : ''}
                </div>
            </div>

            <h3 class="post-title">${Utils.escapeHtml(post.titulo)}</h3>
            <p class="post-content">${Utils.escapeHtml(post.contenido)}</p>

            <div class="post-actions">
                <button class="action-btn ${post.yo_di_like ? 'active' : ''}" onclick="toggleLike(${post.id_post}, this)">
                    <svg width="20" height="20" viewBox="0 0 24 24"
                         fill="${post.yo_di_like ? 'currentColor' : 'none'}"
                         stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span id="likes-count-${post.id_post}">${post.total_likes}</span>
                </button>
                <button class="action-btn" onclick="toggleComments(${post.id_post})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>${post.total_comentarios}</span>
                </button>
            </div>

            <div class="comments-section hidden" id="comments-${post.id_post}">
                <div class="comment-input-wrapper">
                    <div class="author-avatar">${currentUser.avatar}</div>
                    <input
                        type="text"
                        class="comment-input"
                        placeholder="Escribe un comentario..."
                        onkeypress="if(event.key==='Enter') addComment(${post.id_post}, this)"
                    >
                </div>
                <div class="comments-list" id="comments-list-${post.id_post}">
                    <p style="text-align:center;color:var(--color-text-muted);padding:1rem;">Cargando comentarios...</p>
                </div>
            </div>
        </div>
    `).join('');

    feed.querySelectorAll('.post-card').forEach((card, index) => {
        Utils.animateIn(card, index * 50);
    });
}

async function toggleLike(postId, btn) {
    try {
        const response = await fetch(`/api/foro/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });

        const data = await response.json();
        if (!data.success) return;

        
        const svg = btn.querySelector('svg');
        const countEl = document.getElementById(`likes-count-${postId}`);

        if (data.liked) {
            btn.classList.add('active');
            svg.setAttribute('fill', 'currentColor');
            if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
        } else {
            btn.classList.remove('active');
            svg.setAttribute('fill', 'none');
            if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1;
        }

    } catch (error) {
        Utils.showToast('Error al procesar like', 'error');
    }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;

    const isHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden');

    
    if (isHidden) {
        await loadComments(postId);
        section.querySelector('.comment-input')?.focus();
    }
}

async function loadComments(postId) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    if (!listEl) return;

    try {
        const response = await fetch(`/api/foro/${postId}/comentarios`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });

        const data = await response.json();
        if (!data.success) return;

        listEl.innerHTML = renderComments(data.comentarios);

    } catch (error) {
        listEl.innerHTML = '<p style="text-align:center;color:var(--color-text-muted)">Error cargando comentarios</p>';
    }
}

async function addComment(postId, inputEl) {
    const text = inputEl.value.trim();
    if (!text) return;

    try {
        const response = await fetch(`/api/foro/${postId}/comentarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({ contenido: text })
        });

        const data = await response.json();

        if (data.success) {
            inputEl.value = '';
            
            await loadComments(postId);
        } else {
            Utils.showToast(data.message, 'error');
        }

    } catch (error) {
        Utils.showToast('Error al enviar comentario', 'error');
    }
}

async function deletePost(postId) {
    if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;

    try {
        const response = await fetch(`/api/foro/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Publicación eliminada', 'info');
            loadPosts();
        } else {
            Utils.showToast(data.message, 'error');
        }

    } catch (error) {
        Utils.showToast('Error al eliminar publicación', 'error');
    }
}

function renderComments(comentarios) {
    if (comentarios.length === 0) {
        return '<p style="text-align:center;color:var(--color-text-muted);padding:1rem;">Sé el primero en comentar</p>';
    }

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
        </div>
    `).join('');
}

function getCategoryName(category) {
    const categories = {
        stress:        '😰 Manejo del estrés',
        anxiety:       '🧠 Ansiedad académica',
        motivation:    '💪 Motivación y metas',
        relationships: '🤝 Relaciones sociales',
        selfcare:      '🌱 Autocuidado',
        success:       '🎉 Historias de éxito',
        general:       '💬 General'
    };
    return categories[category] || category;
}

window.toggleLike     = toggleLike;
window.toggleComments = toggleComments;
window.addComment     = addComment;
window.deletePost     = deletePost;
