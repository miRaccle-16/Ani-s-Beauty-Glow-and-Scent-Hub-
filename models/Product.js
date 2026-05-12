// This is a model layer for when you want to organize database queries
// Currently, queries are in routes/products.js for simplicity

class Product {
    constructor(db) {
        this.db = db;
    }
    
    getAll(callback) {
        this.db.query('SELECT * FROM products ORDER BY created_at DESC', callback);
    }
    
    getById(id, callback) {
        this.db.query('SELECT * FROM products WHERE id = ?', [id], callback);
    }
    
    getByCategory(category, callback) {
        this.db.query('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC', [category], callback);
    }
    
    create(data, callback) {
        const { name, brand, price, category, affiliate_link, image_url, description, is_featured } = data;
        this.db.query(`INSERT INTO products (name, brand, price, category, affiliate_link, image_url, description, is_featured) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, brand, price, category, affiliate_link, image_url, description, is_featured ? 1 : 0],
            callback);
    }
    
    update(id, data, callback) {
        const { name, brand, price, category, affiliate_link, image_url, description, is_featured } = data;
        this.db.query(`UPDATE products SET name=?, brand=?, price=?, category=?, affiliate_link=?, image_url=?, description=?, is_featured=? WHERE id=?`,
            [name, brand, price, category, affiliate_link, image_url, description, is_featured ? 1 : 0, id],
            callback);
    }
    
    delete(id, callback) {
        this.db.query('DELETE FROM products WHERE id = ?', [id], callback);
    }
}

module.exports = Product;