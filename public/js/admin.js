let selectedClientId = null;
let adminMessageInterval = null;

// ========== AUTH FUNCTIONS ==========
async function handleAdminLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('authMessage');
    
    if (!username || !password) {
        messageDiv.innerHTML = '<div class="message error">❌ Username and password required</div>';
        return;
    }
    
    messageDiv.innerHTML = '<div class="message">Logging in...</div>';
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<div class="message success">✅ Login successful! Redirecting...</div>';
            window.location.href = '/admin';
        } else {
            messageDiv.innerHTML = '<div class="message error">❌ ' + (data.error || 'Invalid credentials') + '</div>';
        }
    } catch (error) {
        messageDiv.innerHTML = '<div class="message error">❌ Connection error</div>';
    }
}

async function handleAdminSignup() {
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const messageDiv = document.getElementById('authMessage');
    
    if (!username || !password) {
        messageDiv.innerHTML = '<div class="message error">❌ Username and password required</div>';
        return;
    }
    
    if (password.length < 4) {
        messageDiv.innerHTML = '<div class="message error">❌ Password must be at least 4 characters</div>';
        return;
    }
    
    messageDiv.innerHTML = '<div class="message">Creating account...</div>';
    
    try {
        const response = await fetch('/api/admin/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<div class="message success">✅ Account created! Please login.</div>';
            document.getElementById('signupUsername').value = '';
            document.getElementById('signupPassword').value = '';
            showLoginForm();
        } else {
            messageDiv.innerHTML = '<div class="message error">❌ ' + (data.error || 'Failed') + '</div>';
        }
    } catch (error) {
        messageDiv.innerHTML = '<div class="message error">❌ Connection error</div>';
    }
}

async function handleAdminLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('authMessage').innerHTML = '';
}

function showLoginForm() {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('authMessage').innerHTML = '';
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'block';
    document.getElementById('authMessage').innerHTML = '';
}

async function sendResetLink() {
    const username = document.getElementById('resetUsername').value;
    const messageDiv = document.getElementById('resetMessage');
    
    if (!username) {
        messageDiv.innerHTML = '<span style="color:red;">❌ Username required</span>';
        return;
    }
    
    messageDiv.innerHTML = '<span>Checking...</span>';
    
    try {
        const response = await fetch('/api/admin/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<span style="color:green;">✅ ' + data.message + '</span>';
            setTimeout(() => showLoginForm(), 3000);
        } else {
            messageDiv.innerHTML = '<span style="color:red;">❌ ' + (data.error || 'Admin not found') + '</span>';
        }
    } catch (error) {
        messageDiv.innerHTML = '<span style="color:red;">❌ Connection error</span>';
    }
}

async function checkAdminSession() {
    try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();
        if (data.loggedIn) {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            loadProducts();
            loadStats();
            loadClients();
            loadAdminProfile();
            startAdminMessagePolling();
        }
    } catch (error) { 
        console.log('Not logged in');
    }
}

// ========== PROFILE FUNCTIONS ==========
async function loadAdminProfile() {
    try {
        const response = await fetch('/api/admin/profile');
        const profile = await response.json();
        const container = document.getElementById('adminProfileInfo');
        if (container) {
            let profilePicHtml = '';
            if (profile.profile_pic) {
                profilePicHtml = `<img src="${profile.profile_pic}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">`;
            } else {
                profilePicHtml = `<div style="background:#c97b6b;width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;">👑</div>`;
            }
            
            container.innerHTML = `
                <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;">
                    ${profilePicHtml}
                    <div>
                        <strong>${escapeHtml(profile.username)}</strong>
                        <span style="background:gold;color:#333;padding:2px 8px;border-radius:20px;font-size:11px;margin-left:8px;">⭐ ADMIN</span>
                        <div style="font-size:12px;color:#666;">${profile.bio || 'Beauty curator & founder'}</div>
                        <div style="font-size:10px;color:#999;">Admin since ${new Date(profile.created_at).toLocaleDateString()}</div>
                    </div>
                    <button onclick="showAdminProfileEdit()" style="background:#f0e2de;color:#c97b6b;padding:6px 12px;">Edit Profile</button>
                </div>
            `;
        }
    } catch (error) { console.error('Error:', error); }
}

function showAdminProfileEdit() { 
    document.getElementById('adminProfileModal').style.display = 'block'; 
}

function closeAdminProfileModal() { 
    document.getElementById('adminProfileModal').style.display = 'none'; 
}

async function updateAdminProfile() {
    const bio = document.getElementById('adminBio').value;
    const formData = new FormData();
    formData.append('bio', bio);
    const fileInput = document.getElementById('adminProfilePic');
    if (fileInput.files[0]) {
        formData.append('profile_pic', fileInput.files[0]);
    }
    
    try {
        const response = await fetch('/api/admin/profile', { 
            method: 'PUT', 
            body: formData 
        });
        const data = await response.json();
        
        if (data.success) { 
            closeAdminProfileModal(); 
            loadAdminProfile(); 
            alert('Profile updated!'); 
        } else { 
            alert('Update failed: ' + (data.error || 'Unknown error')); 
        }
    } catch (error) {
        console.error('Update error:', error);
        alert('Connection error');
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    if (tabName === 'clients') loadClients();
    if (tabName === 'profile') loadAdminProfile();
}

// ========== PRODUCT FUNCTIONS ==========
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        const container = document.getElementById('productsList');
        if (products.length === 0) { 
            container.innerHTML = '<div class="empty-state">✨ No products yet</div>'; 
            return; 
        }
        container.innerHTML = products.map(p => `
            <div class="product-item">
                <div><strong>${escapeHtml(p.name)}</strong><br><small>$${p.price} | ${p.category}</small>${p.is_featured ? '<br><span style="color:#c97b6b;">⭐ Featured</span>' : ''}</div>
                <button class="delete-btn" onclick="deleteProduct(${p.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) { 
        document.getElementById('productsList').innerHTML = '<div class="empty-state">Error loading products</div>'; 
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        document.getElementById('statsContainer').innerHTML = `
            <div class="stat-card"><div class="stat-number">${products.length}</div><div>Products</div></div>
            <div class="stat-card"><div class="stat-number">${products.filter(p => p.category === 'skincare').length}</div><div>Skincare</div></div>
            <div class="stat-card"><div class="stat-number">${products.filter(p => p.category === 'fragrance').length}</div><div>Fragrance</div></div>
            <div class="stat-card"><div class="stat-number">${products.filter(p => p.is_featured).length}</div><div>Featured</div></div>
        `;
    } catch (error) { console.error('Error:', error); }
}

async function addProduct() {
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const affiliateLink = document.getElementById('productAffiliateLink').value;
    const messageDiv = document.getElementById('addMessage');
    
    if (!name || !price || !affiliateLink) {
        messageDiv.innerHTML = '<div class="message error">❌ Please fill required fields</div>';
        setTimeout(() => messageDiv.innerHTML = '', 3000);
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('brand', document.getElementById('productBrand').value);
    formData.append('price', price);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('affiliate_link', affiliateLink);
    formData.append('description', document.getElementById('productDescription').value);
    formData.append('is_featured', document.getElementById('productFeatured').checked);
    
    const imageFile = document.getElementById('productImageFile').files[0];
    const imageUrl = document.getElementById('productImageUrl').value;
    if (imageFile) formData.append('productImage', imageFile);
    else if (imageUrl) formData.append('image_url', imageUrl);
    
    messageDiv.innerHTML = '<div class="message">Adding product...</div>';
    
    try {
        const response = await fetch('/api/admin/products', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            messageDiv.innerHTML = '<div class="message success">✅ Product added!</div>';
            document.getElementById('productName').value = '';
            document.getElementById('productBrand').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productAffiliateLink').value = '';
            document.getElementById('productImageUrl').value = '';
            document.getElementById('productImageFile').value = '';
            document.getElementById('productDescription').value = '';
            document.getElementById('productFeatured').checked = false;
            loadProducts(); 
            loadStats();
            setTimeout(() => messageDiv.innerHTML = '', 2000);
        } else { 
            messageDiv.innerHTML = '<div class="message error">❌ Failed</div>'; 
        }
    } catch (error) { 
        messageDiv.innerHTML = '<div class="message error">❌ Connection error</div>'; 
    }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    loadProducts(); 
    loadStats();
}

// ========== CLIENT FUNCTIONS ==========
async function loadClients() {
    try {
        const response = await fetch('/api/admin/clients');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const clients = await response.json();
        const container = document.getElementById('clientsList');
        
        if (!clients || clients.length === 0) {
            container.innerHTML = '<div class="empty-state">👥 No clients yet. Tell people to sign up!</div>';
            return;
        }
        
        container.innerHTML = clients.map(c => `
            <div class="client-item" onclick="selectClient(${c.id}, '${escapeHtml(c.fullname)}')">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:45px; height:45px; border-radius:50%; background:#c97b6b; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:18px;">
                        ${c.fullname ? c.fullname.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div style="flex:1;">
                        <div class="client-name">
                            ${escapeHtml(c.fullname)} 
                            ${c.unread_count > 0 ? `<span class="unread-indicator">${c.unread_count} new</span>` : ''}
                        </div>
                        <div class="client-email">${escapeHtml(c.email)}</div>
                        <div class="client-last">Joined: ${new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading clients:', error);
        document.getElementById('clientsList').innerHTML = '<div class="empty-state">Error loading clients</div>';
    }
}

async function selectClient(clientId, clientName) {
    selectedClientId = clientId;
    document.getElementById('selectedClientName').innerHTML = `💬 Chat with ${escapeHtml(clientName)}`;
    await refreshChatMessages(clientId, clientName);
}

async function refreshChatMessages(clientId, clientName) {
    try {
        const response = await fetch(`/api/admin/clients/${clientId}/messages`);
        const messages = await response.json();
        const chatArea = document.getElementById('chatArea');
        
        if (!messages || messages.length === 0) {
            chatArea.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:50px; color:#999;">💬 No messages yet. Start a conversation!</div>
                <div class="reply-area" style="display:flex; gap:10px; padding:16px; border-top:1px solid #f0d7d0; background:white; border-radius:0 0 16px 16px;">
                    <input type="text" id="replyInput" placeholder="Type your reply..." style="flex:1; padding:12px; border-radius:40px; border:1px solid #f0d7d0;" onkeypress="if(event.key==='Enter') sendReply()">
                    <button onclick="sendReply()" style="background:#c97b6b; color:white; padding:12px 20px; border:none; border-radius:40px; cursor:pointer;">Send Reply</button>
                </div>
            `;
            return;
        }
        
        const sortedMessages = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        chatArea.innerHTML = `
            <div class="chat-messages" id="chatMessages" style="flex:1; padding:20px; max-height:400px; overflow-y:auto; background:#fff9f7; border-radius:20px 20px 0 0;">
                ${sortedMessages.map(msg => `
                    <div style="margin-bottom:15px; display:flex; justify-content:${msg.is_from_admin ? 'flex-end' : 'flex-start'};">
                        <div style="max-width:70%; padding:12px 18px; border-radius:20px; ${msg.is_from_admin ? 'background:#c97b6b; color:white; border-bottom-right-radius:5px;' : 'background:white; color:#333; border-bottom-left-radius:5px; box-shadow:0 1px 2px rgba(0,0,0,0.05);'}">
                            <div>${escapeHtml(msg.message)}</div>
                            <div style="font-size:10px; opacity:0.7; margin-top:5px;">${new Date(msg.created_at).toLocaleString()}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="reply-area" style="display:flex; gap:10px; padding:16px; border-top:1px solid #f0d7d0; background:white; border-radius:0 0 16px 16px;">
                <input type="text" id="replyInput" placeholder="Type your reply..." style="flex:1; padding:12px; border-radius:40px; border:1px solid #f0d7d0;" onkeypress="if(event.key==='Enter') sendReply()">
                <button onclick="sendReply()" style="background:#c97b6b; color:white; padding:12px 20px; border:none; border-radius:40px; cursor:pointer;">Send Reply</button>
            </div>
        `;
        
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) { 
        console.error('Error loading messages:', error);
        document.getElementById('chatArea').innerHTML = '<div class="empty-state">Error loading conversation</div>';
    }
}

function startAdminMessagePolling() {
    if (adminMessageInterval) clearInterval(adminMessageInterval);
    adminMessageInterval = setInterval(() => {
        loadClients();
        if (selectedClientId) {
            const clientName = document.getElementById('selectedClientName')?.innerText.replace('💬 Chat with ', '') || '';
            refreshChatMessages(selectedClientId, clientName);
        }
    }, 5000);
}
async function sendReply() {
    const replyInput = document.getElementById('replyInput');
    const message = replyInput.value.trim();
    
    if (!message || !selectedClientId) {
        alert('Please enter a message');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/messages/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: selectedClientId, message: message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            replyInput.value = '';
            await refreshChatMessages(selectedClientId, '');
            loadClients();
        } else {
            alert('Failed to send reply: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Reply error:', error);
        alert('Connection error: ' + error.message);
    }
}

async function resetDatabase() {
    if (confirm('⚠️ WARNING: This will delete ALL clients, products, and messages! This cannot be undone. Are you sure?')) {
        const response = await fetch('/api/admin/reset-database', { method: 'POST' });
        const data = await response.json();
        if (data.success) { 
            alert(data.message); 
            loadProducts(); 
            loadStats(); 
            loadClients(); 
        } else { 
            alert('Reset failed'); 
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== INITIALIZE ==========
checkAdminSession();