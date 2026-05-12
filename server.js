const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'ani-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,           // Must be false for localhost/HTTP
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'          // Add this for better compatibility
    }
}));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ani_beauty_db',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error('❌ DB error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to MariaDB');

    db.query(`CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        price DECIMAL(10,2),
        category VARCHAR(50) DEFAULT 'skincare',
        affiliate_link TEXT NOT NULL,
        image_url TEXT,
        description TEXT,
        is_featured BOOLEAN DEFAULT FALSE,
        likes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS product_comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        client_id INT,
        client_name VARCHAR(100),
        comment TEXT NOT NULL,
        reply_to INT DEFAULT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS dm_conversations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user1_id INT NOT NULL,
        user2_id INT NOT NULL,
        last_message TEXT,
        last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_conversation (user1_id, user2_id)
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS dm_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_type ENUM('admin', 'client') NOT NULL,
        message TEXT NOT NULL,
        image_url TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        profile_pic VARCHAR(255),
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS clients (
        id INT PRIMARY KEY AUTO_INCREMENT,
        fullname VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        bio TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    )`);

    db.query(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        message TEXT NOT NULL,
        is_from_admin BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('✅ All tables ready');
});

function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

// ========== ADMIN AUTH ==========
app.get("/api/admin/exists", (req, res) => {
    db.query("SELECT COUNT(*) as count FROM admin_users", (err, results) => {
        if (err) return res.json({ exists: false });
        const count = results && results[0] ? results[0].count : 0;
        res.json({ exists: count > 0 });
    });
});

app.post("/api/admin/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    db.query("SELECT id FROM admin_users WHERE username = ?", [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results && results.length > 0) {
            return res.status(400).json({ error: "Username already exists" });
        }
        const hash = await bcrypt.hash(password, 10);
        db.query("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", [username, hash], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Admin account created! Please login." });
        });
    });
});

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM admin_users WHERE username = ?", [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const valid = await bcrypt.compare(password, results[0].password_hash);
        if (!valid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        req.session.adminId = results[0].id;
        req.session.adminUsername = results[0].username;
        res.json({ success: true });
    });
});

app.post("/api/admin/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get("/api/admin/check", (req, res) => {
    res.json({ loggedIn: !!req.session.adminId, username: req.session.adminUsername });
});

app.post("/api/admin/forgot-password", (req, res) => {
    const { username } = req.body;
    db.query("SELECT id FROM admin_users WHERE username = ?", [username], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Admin not found" });
        }
        res.json({ success: true, message: "Use password 'admin123' to login, or contact super admin." });
    });
});


// GET admin profile
app.get("/api/admin/profile", (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    db.query("SELECT id, username, profile_pic, bio, created_at FROM admin_users WHERE id=?", 
        [req.session.adminId], 
        (err, results) => {
            if (err) {
                console.error('Profile fetch error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!results || results.length === 0) {
                return res.status(404).json({ error: "Not found" });
            }
            res.json(results[0]);
        });
});

// UPDATE admin profile
app.put("/api/admin/profile", requireAdmin, upload.single("profile_pic"), (req, res) => {
    const { bio } = req.body;
    let query = "UPDATE admin_users SET bio=?";
    let params = [bio];
    
    if (req.file) {
        query += ", profile_pic=?";
        params.push(`/uploads/${req.file.filename}`);
    }
    query += " WHERE id=?";
    params.push(req.session.adminId);
    
    db.query(query, params, (err) => {
        if (err) {
            console.error('Profile update error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});
// ========== CLIENT AUTH ==========

app.post("/api/client/signup", upload.single("profile_pic"), async (req, res) => {
    const { fullname, email, phone, password } = req.body;
    let profile_pic = null;
    if (req.file) profile_pic = `/uploads/${req.file.filename}`;
    
    console.log('Signup attempt:', { fullname, email, phone, hasProfilePic: !!req.file });
    
    if (!fullname || !email || !password) {
        return res.status(400).json({ error: "Full name, email, and password required" });
    }
    
    if (password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    
    // Check if email exists
    db.query("SELECT id FROM clients WHERE email = ?", [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: "Server error" });
        }
        
        if (results && results.length > 0) {
            return res.status(400).json({ error: "Email already registered" });
        }
        
        const hash = await bcrypt.hash(password, 10);
        
        db.query(
            "INSERT INTO clients (fullname, email, phone, password_hash) VALUES (?, ?, ?, ?)",
            [fullname, email, phone || null, hash],
            (err, result) => {
                if (err) {
                    console.error('Insert error:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                // If profile_pic was uploaded, update it separately
                if (profile_pic) {
                    db.query("UPDATE clients SET profile_pic = ? WHERE id = ?", [profile_pic, result.insertId]);
                }
                
                // Set session AFTER user is created
                req.session.clientId = result.insertId;
                req.session.clientName = fullname;
                
                console.log('✅ User created and logged in:', { id: result.insertId, email });
                
                // Return success with client info
                res.json({ 
                    success: true, 
                    message: "Account created successfully!",
                    client: { id: result.insertId, fullname, email }
                });
            });
    });
});

app.post("/api/client/login", (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    db.query("SELECT * FROM clients WHERE email = ?", [email], async (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: "Server error" });
        }
        
        if (!results || results.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: "Invalid email or password" });
        }
        
        const valid = await bcrypt.compare(password, results[0].password_hash);
        if (!valid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: "Invalid email or password" });
        }
        
        // Set session
        req.session.clientId = results[0].id;
        req.session.clientName = results[0].fullname;
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: "Session error" });
            }
            
            console.log('✅ Login successful! Session ID:', req.session.id);
            console.log('✅ Session data:', { clientId: req.session.clientId, clientName: req.session.clientName });
            
            res.json({ 
                success: true, 
                message: "Login successful!",
                client: { id: results[0].id, fullname: results[0].fullname, email: results[0].email }
            });
        });
    });
});

app.post("/api/client/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get("/api/client/check", (req, res) => {
    if (req.session.clientId) {
        res.json({ loggedIn: true, clientId: req.session.clientId, clientName: req.session.clientName });
    } else if (req.session.adminId) {
        res.json({ loggedIn: true, adminId: req.session.adminId, adminName: req.session.adminUsername });
    } else {
        res.json({ loggedIn: false });
    }
});

// ========== CLIENT PROFILE ==========
app.get("/api/client/profile/me", (req, res) => {
    if (!req.session.clientId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    db.query("SELECT id, fullname, email, phone, bio, created_at FROM clients WHERE id=?",
        [req.session.clientId],
        (err, results) => {
            if (err || !results || results.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            res.json(results[0]);
        });
});

app.get("/api/client/profile/:id", (req, res) => {
    const userId = req.params.id;
    db.query("SELECT id, fullname, email, profile_pic, bio, created_at FROM clients WHERE id=?",
        [userId],
        (err, results) => {
            if (err || !results || results.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            res.json(results[0]);
        });
});

app.put("/api/client/profile", upload.single("profile_pic"), (req, res) => {
    if (!req.session.clientId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    const { fullname, phone, bio } = req.body;
    let query = "UPDATE clients SET fullname=?, phone=?, bio=?";
    let params = [fullname, phone, bio];
    if (req.file) {
        query += ", profile_pic=?";
        params.push(`/uploads/${req.file.filename}`);
    }
    query += " WHERE id=?";
    params.push(req.session.clientId);
    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        req.session.clientName = fullname;
        res.json({ success: true });
    });
});

// ========== CHAT MESSAGES ==========
app.post("/api/client/messages/send", (req, res) => {
    if (!req.session.clientId) {
        return res.status(401).json({ error: "Please login first" });
    }
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message required" });
    }
    db.query("INSERT INTO chat_messages (client_id, message) VALUES (?,?)",
        [req.session.clientId, message],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get("/api/client/messages", (req, res) => {
    if (!req.session.clientId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    db.query("SELECT * FROM chat_messages WHERE client_id=? ORDER BY created_at ASC",
        [req.session.clientId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results || []);
        });
});

app.put("/api/client/messages/read", (req, res) => {
    if (!req.session.clientId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    db.query("UPDATE chat_messages SET is_read=TRUE WHERE client_id=? AND is_from_admin=TRUE AND is_read=FALSE",
        [req.session.clientId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get("/api/client/messages/unread-count", (req, res) => {
    if (!req.session.clientId) return res.json({ count: 0 });
    db.query("SELECT COUNT(*) as count FROM chat_messages WHERE client_id=? AND is_from_admin=TRUE AND is_read=FALSE",
        [req.session.clientId],
        (err, results) => {
            if (err) return res.json({ count: 0 });
            const count = results && results[0] ? results[0].count : 0;
            res.json({ count: count });
        });
});

// ========== DM SYSTEM ==========
function getConversationId(user1Id, user2Id, callback) {
    db.query("SELECT id FROM dm_conversations WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)",
        [user1Id, user2Id, user2Id, user1Id],
        (err, results) => {
            if (err) return callback(err);
            if (results && results.length > 0) {
                return callback(null, results[0].id);
            }
            db.query("INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)",
                [user1Id, user2Id],
                (err, result) => {
                    if (err) return callback(err);
                    callback(null, result.insertId);
                });
        });
}

app.post("/api/dm/send", async (req, res) => {
    const { toUserId, message, imageUrl, conversationId } = req.body;
    const fromUserId = req.session.clientId || req.session.adminId;
    const fromType = req.session.clientId ? "client" : "admin";

    if (!fromUserId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    if (!message && !imageUrl) {
        return res.status(400).json({ error: "Message or image required" });
    }

    if (conversationId) {
        db.query("INSERT INTO dm_messages (conversation_id, sender_id, sender_type, message, image_url) VALUES (?, ?, ?, ?, ?)",
            [conversationId, fromUserId, fromType, message || "", imageUrl || null],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.query("UPDATE dm_conversations SET last_message=?, last_message_time=NOW() WHERE id=?",
                    [message || "📷 Image", conversationId]);
                res.json({ success: true });
            });
    } else if (toUserId) {
        getConversationId(fromUserId, toUserId, (err, convId) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query("INSERT INTO dm_messages (conversation_id, sender_id, sender_type, message, image_url) VALUES (?, ?, ?, ?, ?)",
                [convId, fromUserId, fromType, message || "", imageUrl || null],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    db.query("UPDATE dm_conversations SET last_message=?, last_message_time=NOW() WHERE id=?",
                        [message || "📷 Image", convId]);
                    res.json({ success: true });
                });
        });
    } else {
        res.status(400).json({ error: "Missing recipient or conversation ID" });
    }
});

app.get("/api/dm/conversations", (req, res) => {
    const userId = req.session.clientId || req.session.adminId;
    if (!userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    db.query(`
        SELECT c.id,
               CASE WHEN c.user1_id=? THEN c.user2_id ELSE c.user1_id END as other_user_id,
               CASE WHEN c.user1_id=? THEN
                    (SELECT fullname FROM clients WHERE id=c.user2_id)
               ELSE
                    (SELECT fullname FROM clients WHERE id=c.user1_id)
               END as other_user_name,
               c.last_message, c.last_message_time,
               (SELECT COUNT(*) FROM dm_messages WHERE conversation_id=c.id AND is_read=FALSE AND sender_id!=?) as unread_count
        FROM dm_conversations c
        WHERE c.user1_id=? OR c.user2_id=?
        ORDER BY c.last_message_time DESC
    `, [userId, userId, userId, userId, userId],
    (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.get("/api/dm/messages/:conversationId", (req, res) => {
    const userId = req.session.clientId || req.session.adminId;
    if (!userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    db.query("SELECT * FROM dm_messages WHERE conversation_id=? ORDER BY created_at ASC",
        [req.params.conversationId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query("UPDATE dm_messages SET is_read=TRUE WHERE conversation_id=? AND sender_id!=?",
                [req.params.conversationId, userId]);
            res.json(results || []);
        });
});

app.get("/api/users/search", (req, res) => {
    const search = req.query.q || "";
    db.query("SELECT id, fullname, email FROM clients WHERE fullname LIKE ? OR email LIKE ? LIMIT 20",
        [`%${search}%`, `%${search}%`],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results || []);
        });
});

// ========== ADMIN CLIENTS ==========

app.get('/api/admin/clients', requireAdmin, (req, res) => {
    console.log('📋 Fetching clients for admin...');
    
    db.query(`
        SELECT c.id, c.fullname, c.email, c.phone, 
               c.profile_pic, 
               COALESCE(c.bio, '') as bio,
               c.created_at, c.last_login,
               COALESCE((SELECT COUNT(*) FROM chat_messages WHERE client_id=c.id AND is_from_admin=FALSE AND is_read=FALSE), 0) as unread_count
        FROM clients c
        ORDER BY c.created_at DESC
    `, (err, results) => {
        if (err) {
            console.error('❌ Error fetching clients:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Found ${results ? results.length : 0} clients`);
        res.json(results || []);
    });
});
app.get('/api/admin/clients/:clientId/messages', requireAdmin, (req, res) => {
    db.query('SELECT * FROM chat_messages WHERE client_id=? ORDER BY created_at ASC',
        [req.params.clientId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results || []);
        });
});

app.post('/api/admin/messages/reply', requireAdmin, (req, res) => {
    const { clientId, message } = req.body;
    console.log('Replying to client:', clientId, 'Message:', message);
    
    if (!clientId || !message) {
        return res.status(400).json({ error: 'Client ID and message required' });
    }
    
    db.query('INSERT INTO chat_messages (client_id, message, is_from_admin) VALUES (?, ?, TRUE)',
        [clientId, message],
        (err, result) => {
            if (err) {
                console.error('Reply error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
});

// ========== PRODUCTS & COMMENTS ==========
app.get("/api/products", (req, res) => {
    let query = "SELECT *, (SELECT COUNT(*) FROM product_comments WHERE product_id=products.id) as comment_count FROM products";
    if (req.query.category && req.query.category !== "all") {
        query += ` WHERE category='${req.query.category}'`;
    }
    query += " ORDER BY created_at DESC";
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.post("/api/products/:id/like", (req, res) => {
    const productId = req.params.id;
    db.query("UPDATE products SET likes = likes + 1 WHERE id = ?", [productId], (err, result) => {
        if (err) {
            console.error('Like error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.post("/api/products/:id/comment", upload.single("commentImage"), (req, res) => {
    const { comment, clientName, replyTo } = req.body;
    const clientId = req.session.clientId || null;
    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    db.query("INSERT INTO product_comments (product_id, client_id, client_name, comment, reply_to, image_url) VALUES (?,?,?,?,?,?)",
        [req.params.id, clientId, clientName || 'Guest', comment, replyTo || null, imageUrl],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get("/api/products/:id/comments", (req, res) => {
    db.query(`
        SELECT c.*, 
               cl.profile_pic 
        FROM product_comments c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.product_id = ?
        ORDER BY c.created_at ASC
    `, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

// ========== ADMIN PRODUCTS ==========
app.post("/api/admin/products", requireAdmin, upload.single("productImage"), (req, res) => {
    const { name, brand, price, category, affiliate_link, description, is_featured, image_url } = req.body;
    let finalImageUrl = image_url || null;
    if (req.file) finalImageUrl = `/uploads/${req.file.filename}`;
    
    console.log('Adding product:', { name, price, category, affiliate_link, hasFile: !!req.file });
    
    if (!name || !affiliate_link) {
        return res.status(400).json({ error: "Name and affiliate link required" });
    }
    
    db.query(`INSERT INTO products (name, brand, price, category, affiliate_link, image_url, description, is_featured) VALUES (?,?,?,?,?,?,?,?)`,
        [name, brand || '', price, category, affiliate_link, finalImageUrl, description || '', is_featured === 'true' ? 1 : 0],
        (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Product added, ID:', result.insertId);
            res.json({ success: true, id: result.insertId });
        });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
    db.query("DELETE FROM products WHERE id=?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== RESET DATABASE ==========
app.post("/api/admin/reset-database", requireAdmin, (req, res) => {
    const queries = [
        "DELETE FROM dm_messages",
        "DELETE FROM dm_conversations",
        "DELETE FROM chat_messages",
        "DELETE FROM product_comments",
        "DELETE FROM clients",
        "DELETE FROM products"
    ];
    let completed = 0;
    queries.forEach(q => {
        db.query(q, (err) => {
            completed++;
            if (completed === queries.length) {
                res.json({ success: true, message: "Database reset!" });
            }
        });
    });
});

// ========== SERVE FRONTEND ==========
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
    console.log(`💡 First time? Go to /admin and create your admin account!\n`);
});