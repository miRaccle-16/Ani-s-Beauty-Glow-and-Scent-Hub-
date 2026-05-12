let currentCategory = 'all';
let currentClient = null;
let messageInterval = null;

async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '<div style="text-align:center;padding:40px;">Loading...</div>';
    let url = '/api/products';
    if (currentCategory !== 'all') url += `?category=${currentCategory}`;
    
    try {
        const response = await fetch(url);
        const products = await response.json();
        if (products.length === 0) {
            grid.innerHTML = '<div style="text-align:center;padding:40px;">✨ No products yet ✨</div>';
            return;
        }
        grid.innerHTML = products.map(product => {
            let shopLink = product.affiliate_link;
            if (!shopLink || shopLink === '#') shopLink = 'https://www.amazon.com/s?k=beauty';
            return `
                <div class="product-card">
                    <img class="product-img" src="${product.image_url || 'https://placehold.co/400x400/f5c8bf/fff?text=Beauty'}">
                    <div class="product-info">
                        <div class="product-brand">${product.brand || 'Premium'}</div>
                        <div class="product-name">${escapeHtml(product.name)}</div>
                        <div class="product-price">₦${(product.price * 600).toLocaleString()}</div>
                        <a href="${shopLink}" target="_blank" class="affiliate-btn">Shop Now →</a>
                    </div>
                </div>
            `;
        }).join('');
    } catch(error) { grid.innerHTML = '<div style="text-align:center;padding:40px;">Error loading products</div>'; }
}

function filterProducts(category) { currentCategory = category; loadProducts(); }

async function checkClientSession() {
    const response = await fetch('/api/client/check');
    const data = await response.json();
    if (data.loggedIn) {
        currentClient = { id: data.clientId, name: data.clientName };
        document.getElementById('authNavLink').innerHTML = `👤 ${escapeHtml(data.clientName)}`;
        document.getElementById('chatButton').style.display = 'flex';
        loadChatMessages();
        startMessagePolling();
    } else {
        document.getElementById('authNavLink').innerHTML = '👤 Sign Up / Login';
        document.getElementById('chatButton').style.display = 'none';
    }
}

function openAuthModal() {
    if (currentClient) { logout(); }
    else { document.getElementById('authModal').classList.add('show'); }
}

async function clientLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const response = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
        document.getElementById('authModal').classList.remove('show');
        checkClientSession();
    } else { document.getElementById('authError').innerText = data.error; }
}

async function clientSignup() {
    const fullname = document.getElementById('signupFullname').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;
    const response = await fetch('/api/client/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname, email, phone, password })
    });
    const data = await response.json();
    if (data.success) {
        document.getElementById('authModal').classList.remove('show');
        checkClientSession();
    } else { document.getElementById('signupError').innerText = data.error; }
}

async function logout() {
    await fetch('/api/client/logout', { method: 'POST' });
    currentClient = null;
    if (messageInterval) clearInterval(messageInterval);
    checkClientSession();
}

function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
}
function showLogin() {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

async function loadChatMessages() {
    if (!currentClient) return;
    const response = await fetch('/api/client/messages');
    const messages = await response.json();
    const container = document.getElementById('chatMessages');
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No messages yet. Say hello! 💕</div>';
        return;
    }
    container.innerHTML = messages.map(msg => `
        <div class="message-bubble ${msg.is_from_admin ? 'message-admin' : 'message-client'}">
            <div>${escapeHtml(msg.message)}</div>
            <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
    await fetch('/api/client/messages/read', { method: 'PUT' });
    updateUnreadBadge();
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    await fetch('/api/client/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    input.value = '';
    loadChatMessages();
}

async function updateUnreadBadge() {
    const response = await fetch('/api/client/messages/unread-count');
    const data = await response.json();
    const badge = document.getElementById('unreadChatBadge');
    if (data.count > 0) { badge.innerText = data.count; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
}

function startMessagePolling() {
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => {
        if (currentClient && document.getElementById('chatModal').classList.contains('show')) { loadChatMessages(); }
        else if (currentClient) { updateUnreadBadge(); }
    }, 5000);
}

function toggleChat() {
    const modal = document.getElementById('chatModal');
    modal.classList.toggle('show');
    if (modal.classList.contains('show') && currentClient) loadChatMessages();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

loadProducts();
checkClientSession();