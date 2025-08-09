const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));
app.use(express.static('public'));

// Создание папки для загрузок
const fs = require('fs');
const uploadsPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : 'uploads';

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

// Настройка статической папки для загруженных файлов
app.use('/uploads', express.static(uploadsPath));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsPath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// Определяем путь к базе данных
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'database.db')
    : './database.db';

// Инициализация базы данных
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Таблица категорий
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image TEXT
    )`);

    // Таблица товаров
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`);

    // Таблица заказов
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        total_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'new'
    )`);

    // Таблица элементов заказа
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    // Таблица администраторов
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Создаем дефолтного админа если его нет
    db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (row && row.count === 0) {
            const defaultPassword = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', defaultPassword], (err) => {
                if (!err) {
                    console.log('Создан дефолтный администратор: admin / admin123');
                    console.log('База данных создана в:', dbPath);
                }
            });
        }
    });

    // Добавляем тестовые данные, если база пустая
    db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
        if (row.count === 0) {
            // Добавляем категории
            const categories = [
                { name: 'Winston', image: 'winston.jpg' },
                { name: 'LD', image: 'LD.jpg' },
                { name: 'Parliament', image: 'parliament.jpg' },
                { name: 'Marlboro', image: 'marlboro.jpg' },
                { name: 'Captain Black', image: 'capitanblack.jpg' }
            ];

            categories.forEach(cat => {
                db.run("INSERT INTO categories (name, image) VALUES (?, ?)", [cat.name, cat.image]);
            });

            // Добавляем товары
            setTimeout(() => {
                const products = [
                    { category_id: 1, name: 'Winston Blue', price: 150 },
                    { category_id: 1, name: 'Winston Red', price: 150 },
                    { category_id: 1, name: 'Winston Silver', price: 145 },
                    { category_id: 2, name: 'LD Blue', price: 130 },
                    { category_id: 2, name: 'LD Red', price: 130 },
                    { category_id: 3, name: 'Parliament Aqua Blue', price: 180 },
                    { category_id: 3, name: 'Parliament Night Blue', price: 180 },
                    { category_id: 4, name: 'Marlboro Red', price: 170 },
                    { category_id: 4, name: 'Marlboro Gold', price: 170 },
                    { category_id: 5, name: 'Captain Black Dark Crema', price: 200 },
                    { category_id: 5, name: 'Captain Black Cherry', price: 200 }
                ];

                products.forEach(prod => {
                    db.run("INSERT INTO products (category_id, name, price, image) VALUES (?, ?, ?, ?)", 
                        [prod.category_id, prod.name, prod.price, 'nophoto.jpg']);
                });
            }, 1000);
        }
    });
});

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
}

// API маршруты

// Логин администратора
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!admin) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        if (!bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        req.session.isAuthenticated = true;
        req.session.adminId = admin.id;
        req.session.username = admin.username;
        
        res.json({ success: true, username: admin.username });
    });
});

// Проверка авторизации
app.get('/api/check-auth', (req, res) => {
    res.json({ isAuthenticated: !!req.session.isAuthenticated });
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Получить все категории
app.get('/api/categories', (req, res) => {
    db.all("SELECT * FROM categories ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Создать новую категорию
app.post('/api/categories', requireAuth, upload.single('image'), (req, res) => {
    const { name } = req.body;
    const image = req.file ? req.file.filename : null;
    
    db.run("INSERT INTO categories (name, image) VALUES (?, ?)", [name, image], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, name, image });
    });
});

// Обновить категорию
app.put('/api/categories/:id', requireAuth, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (req.file) {
        // Если загружено новое изображение
        const image = req.file.filename;
        db.run("UPDATE categories SET name = ?, image = ? WHERE id = ?", [name, image, id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
    } else {
        // Если изображение не изменялось
        db.run("UPDATE categories SET name = ? WHERE id = ?", [name, id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
    }
});

// Удалить категорию
app.delete('/api/categories/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    // Сначала удаляем все товары в этой категории
    db.run("DELETE FROM products WHERE category_id = ?", [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Затем удаляем саму категорию
        db.run("DELETE FROM categories WHERE id = ?", [id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
    });
});

// Получить товары по категории
app.get('/api/products/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    db.all("SELECT * FROM products WHERE category_id = ? ORDER BY name", [categoryId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все товары для админки
app.get('/api/all-products', requireAuth, (req, res) => {
    db.all(`SELECT p.*, c.name as category_name 
            FROM products p 
            JOIN categories c ON p.category_id = c.id 
            ORDER BY c.name, p.name`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Создать новый товар
app.post('/api/products', requireAuth, upload.single('image'), (req, res) => {
    const { category_id, name, price } = req.body;
    const image = req.file ? req.file.filename : null;
    
    db.run("INSERT INTO products (category_id, name, price, image) VALUES (?, ?, ?, ?)", 
        [category_id, name, price, image], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, category_id, name, price, image });
    });
});

// Обновить товар
app.put('/api/products/:id', requireAuth, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { category_id, name, price } = req.body;
    
    if (req.file) {
        // Если загружено новое изображение
        const image = req.file.filename;
        db.run("UPDATE products SET category_id = ?, name = ?, price = ?, image = ? WHERE id = ?", 
            [category_id, name, price, image, id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
    } else {
        // Если изображение не изменялось
        db.run("UPDATE products SET category_id = ?, name = ?, price = ? WHERE id = ?", 
            [category_id, name, price, id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
    }
});

// Удалить товар
app.delete('/api/products/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM products WHERE id = ?", [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Создать заказ
app.post('/api/orders', async (req, res) => {
    const { shopName, phone, email, items, totalAmount } = req.body;
    
    db.run("INSERT INTO orders (shop_name, phone, email, total_amount) VALUES (?, ?, ?, ?)",
        [shopName, phone, email, totalAmount], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const orderId = this.lastID;
        
        // Добавляем товары в заказ
        items.forEach(item => {
            db.run("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                [orderId, item.productId, item.quantity, item.price]);
        });
        
        // Отправляем email уведомление
        sendOrderEmail(orderId, shopName, phone, email, items, totalAmount);
        
        res.json({ id: orderId, message: 'Заказ успешно создан' });
    });
});

// Получить все заказы (для админа)
app.get('/api/orders', requireAuth, (req, res) => {
    db.all(`SELECT o.*, COUNT(oi.id) as items_count 
            FROM orders o 
            LEFT JOIN order_items oi ON o.id = oi.order_id 
            GROUP BY o.id 
            ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить детали заказа
app.get('/api/orders/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    db.get("SELECT * FROM orders WHERE id = ?", [id], (err, order) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.all(`SELECT oi.*, p.name as product_name 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?`, [id], (err, items) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ ...order, items });
        });
    });
});

// Обновить статус заказа
app.put('/api/orders/:id/status', requireAuth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const allowedStatuses = ['new', 'processing', 'completed'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
    }
    
    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, status });
    });
});

// Функция отправки email
function sendOrderEmail(orderId, shopName, phone, email, items, totalAmount) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Email не настроен. Заказ #' + orderId + ' от ' + shopName);
        return;
    }
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    let itemsList = items.map(item => `${item.name} - ${item.quantity} шт. x ${item.price} руб.`).join('\n');
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `Новый заказ #${orderId} от ${shopName}`,
        text: `
Новый заказ #${orderId}

Магазин: ${shopName}
Телефон: ${phone || 'Не указан'}
Email: ${email || 'Не указан'}

Товары:
${itemsList}

Общая сумма: ${totalAmount} руб.

Время заказа: ${new Date().toLocaleString('ru-RU')}
        `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Ошибка отправки email:', error);
        } else {
            console.log('Email отправлен:', info.response);
        }
    });
}

// Маршруты для страниц
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} для доступа к сайту`);
    console.log(`Админ-панель доступна по адресу http://localhost:${PORT}/admin`);
});