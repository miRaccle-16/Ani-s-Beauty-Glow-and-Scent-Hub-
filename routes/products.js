const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// Middleware to check admin login
function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// GET all products (public)
router.get('/products', (req, res) => {
    const db = req.app.get('db');
    let query = 'SELECT * FROM products';
    const params = [];
    
    if (req.query.category && req.query.category !== 'all') {
        query += ' WHERE category = ?';
        params.push(req.query.category);
    }
    query += ' ORDER BY created_at DESC';
    
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// GET single product
router.get('/products/:id', (req, res) => {
    const db = req.app.get('db');
    db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(results[0]);
    });
});

// Admin login
router.post('/admin/login', (req, res) => {
    const db = req.app.get('db');
    const { username, password } = req.body;
    
    db.query('SELECT * FROM admin_users WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const valid = await bcrypt.compare(password, results[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        req.session.adminId = results[0].id;
        res.json({ success: true });
    });
});

// Admin logout
router.post('/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// CREATE product (admin only)
router.post('/admin/products', requireAdmin, upload.single('image'), (req, res) => {
    const db = req.app.get('db');
    const { name, brand, price, category, affiliate_link, description, is_featured } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!name || !affiliate_link) {
        return res.status(400).json({ error: 'Name and affiliate link are required' });
    }
    
    db.query(`INSERT INTO products (name, brand, price, category, affiliate_link, image_url, description, is_featured) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, brand, price, category, affiliate_link, image_url, description, is_featured === 'true' ? 1 : 0],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        });
});

// UPDATE product
router.put('/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
    const db = req.app.get('db');
    const { name, brand, price, category, affiliate_link, description, is_featured } = req.body;
    
    if (req.file) {
        db.query(`UPDATE products SET name=?, brand=?, price=?, category=?, affiliate_link=?, description=?, is_featured=?, image_url=? WHERE id=?`,
            [name, brand, price, category, affiliate_link, description, is_featured === 'true' ? 1 : 0, `/uploads/${req.file.filename}`, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    } else {
        db.query(`UPDATE products SET name=?, brand=?, price=?, category=?, affiliate_link=?, description=?, is_featured=? WHERE id=?`,
            [name, brand, price, category, affiliate_link, description, is_featured === 'true' ? 1 : 0, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    }
});

// DELETE product
router.delete('/admin/products/:id', requireAdmin, (req, res) => {
    const db = req.app.get('db');
    db.query('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;