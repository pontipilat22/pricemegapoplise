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
app.use(cors({
    credentials: true,
    origin: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 часа
        secure: false, // Временно отключаем для тестирования локально
        httpOnly: true,
        sameSite: 'lax' // Добавляем для безопасности
    },
    // Отключаем предупреждение о MemoryStore
    name: 'sessionId'
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
        if (!row || row.count === 0) {
            // Добавляем категории
            const categories = [
                'HEETS', 'L&M', 'FIIT', 'DELIA', 'LD', 'Parliament', 
                'Philip Morris', 'Marlboro', 'Richmond', 'Sobranie', 
                'Sovereign', 'TEREA', 'Winston', 'Camel', 'Captain Black', 'Зажигалки BIC'
            ];

            categories.forEach((name, index) => {
                const image = name === 'Winston' ? '/images/winston.jpg' :
                             name === 'Parliament' ? '/images/parliament.jpg' :
                             name === 'Marlboro' ? '/images/marlboro.jpg' :
                             name === 'Captain Black' ? '/images/capitanblack.jpg' :
                             name === 'L&M' || name === 'LD' ? '/images/LD.jpg' :
                             '/images/nophoto.jpg';
                
                db.run("INSERT INTO categories (name, image) VALUES (?, ?)", [name, image]);
            });

            // Добавляем товары
            setTimeout(() => {
                const allProducts = [
                    // HEETS (category_id: 1) - умножаем на 10
                    { cat: 'HEETS', name: 'HEETS YELLOW SELECT', price: 9688.00 },
                    { cat: 'HEETS', name: 'HEETS AMBER SELECT', price: 9688.00 },
                    { cat: 'HEETS', name: 'HEETS BRONZE SELECT', price: 9688.00 },
                    { cat: 'HEETS', name: 'HEETS RUBY FUSE', price: 9688.00 },

                    // L&M (category_id: 2) - умножаем на 10
                    { cat: 'L&M', name: 'L&M LIG LOFTMIX', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LIG LOUNGEMIX', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LOFT', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LOFT BLUE', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LOFT SEA BLUE', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LOU SUM SPLASH', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M LOUNGE BLUE', price: 9058.00 },
                    { cat: 'L&M', name: 'L&M SUNNY BEACH', price: 9058.00 },

                    // FIIT (category_id: 3) - умножаем на 10
                    { cat: 'FIIT', name: 'FIIT REGULAR SKY', price: 9212.00 },
                    { cat: 'FIIT', name: 'FIIT TROPIC', price: 9212.00 },
                    { cat: 'FIIT', name: 'FIIT CRISP', price: 9212.00 },
                    { cat: 'FIIT', name: 'FIIT REGULAR', price: 9212.00 },

                    // DELIA (category_id: 4) - умножаем на 10
                    { cat: 'DELIA', name: 'DELIA CORAL', price: 9212.00 },
                    { cat: 'DELIA', name: 'DELIA GOLD', price: 9212.00 },
                    { cat: 'DELIA', name: 'DELIA GREEN', price: 9212.00 },
                    { cat: 'DELIA', name: 'DELIA BURGUNDY', price: 9212.00 },

                    // LD (category_id: 5) - умножаем на 10
                    { cat: 'LD', name: 'LD AMBER SSL', price: 9058.00 },
                    { cat: 'LD', name: 'LD CLUB SILVER', price: 9058.00 },
                    { cat: 'LD', name: 'LD COMP100S SILVER', price: 9058.00 },
                    { cat: 'LD', name: 'LD COMPACT BLUE', price: 9058.00 },
                    { cat: 'LD', name: 'LD COMPACT SILVER', price: 9058.00 },
                    { cat: 'LD', name: 'LD SL VIR PLUSBLUE', price: 9058.00 },
                    { cat: 'LD', name: 'LD STATE LINE BLUE', price: 9058.00 },
                    { cat: 'LD', name: 'LD STATE LINE RED', price: 9058.00 },
                    { cat: 'LD', name: 'LD SUPSLIMS LOUNGE', price: 9058.00 },
                    { cat: 'LD', name: 'LD VIOLET SSL', price: 9058.00 },
                    { cat: 'LD', name: 'LD VIRGINIA SLIMS', price: 9058.00 },

                    // Parliament (category_id: 6) - умножаем на 10
                    { cat: 'Parliament', name: 'PARLIAMENT PLATIN', price: 10458.00 },
                    { cat: 'Parliament', name: 'PARLIAMENT RES 100', price: 9982.00 },
                    { cat: 'Parliament', name: 'PARLIAMENT RESERVE', price: 9982.00 },
                    { cat: 'Parliament', name: 'PARLIAMENT SILVER', price: 10458.00 },
                    { cat: 'Parliament', name: 'PARLIAMENT AQUA', price: 10458.00 },
                    { cat: 'Parliament', name: 'PARLIAMENT NIGHT', price: 10458.00 },
                    { cat: 'Parliament', name: 'PRL SOH COMP BLUE', price: 9982.00 },
                    { cat: 'Parliament', name: 'PRL SOH COMP SILVE', price: 9982.00 },
                    { cat: 'Parliament', name: 'PRL SSL SUMMER FUS', price: 9982.00 },
                    { cat: 'Parliament', name: 'PRL SSL WINTER FUS', price: 9982.00 },

                    // Philip Morris (category_id: 7) - умножаем на 10
                    { cat: 'Philip Morris', name: 'PHIL MOR BLUE', price: 9058.00 },
                    { cat: 'Philip Morris', name: 'PHIL MOR RED', price: 9058.00 },
                    { cat: 'Philip Morris', name: 'PHIL MOR SILVER', price: 9058.00 },
                    { cat: 'Philip Morris', name: 'PHIL MORR COM BLUE', price: 9058.00 },
                    { cat: 'Philip Morris', name: 'PHIL MORR COM SILV', price: 9058.00 },

                    // Marlboro (category_id: 8) - умножаем на 10
                    { cat: 'Marlboro', name: 'MARLBORO FINETOUCH', price: 9618.00 },
                    { cat: 'Marlboro', name: 'MARLBORO GOLD', price: 9996.00 },
                    { cat: 'Marlboro', name: 'MARLBORO TOUCH', price: 9618.00 },
                    { cat: 'Marlboro', name: 'MARLB GOLD SPECIAL', price: 9702.00 },
                    { cat: 'Marlboro', name: 'MARLB RED SPECIAL', price: 9702.00 },
                    { cat: 'Marlboro', name: 'MARLBORO', price: 9996.00 },
                    { cat: 'Marlboro', name: 'MARLBORO DOUBLE MI', price: 9618.00 },

                    // Richmond (category_id: 9) - умножаем на 10
                    { cat: 'Richmond', name: 'RICH.BLUE EDIT.100', price: 10290.00 },
                    { cat: 'Richmond', name: 'RICH.GRAND EDITION', price: 10640.00 },
                    { cat: 'Richmond', name: 'RICHMOND BLACK', price: 10640.00 },
                    { cat: 'Richmond', name: 'RICHMOND BLUE EDIT', price: 10290.00 },
                    { cat: 'Richmond', name: 'RICHMOND BRONZE', price: 10640.00 },
                    { cat: 'Richmond', name: 'RICHMOND EMPEROR', price: 10290.00 },
                    { cat: 'Richmond', name: 'RICHMOND GOLD EDIT', price: 10640.00 },
                    { cat: 'Richmond', name: 'RICHMOND RED', price: 10640.00 },
                    { cat: 'Richmond', name: 'RICHMOND ROYAL', price: 10640.00 },

                    // Sobranie (category_id: 10) - умножаем на 10
                    { cat: 'Sobranie', name: 'SOBRANREFCHR100\'S', price: 10192.00 },

                    // Sovereign (category_id: 11) - умножаем на 10
                    { cat: 'Sovereign', name: 'SOVEREIGN CM 100\'S', price: 9058.00 },
                    { cat: 'Sovereign', name: 'SOVEREIGN CMPT BL', price: 9058.00 },

                    // TEREA (category_id: 12) - умножаем на 10
                    { cat: 'TEREA', name: 'TEREA AMBER', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA BLUE', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA PROVEN PEARL', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA PURPLE WAVE', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA SILVER', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA STARL PEARL', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA SUMMER WAVE', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA SUN PEARL', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA TIDAL PEARL', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA TURQUOISE', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA TWILIGHT PRL', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA YELLOW', price: 9674.00 },
                    { cat: 'TEREA', name: 'TEREA ZING WAVE', price: 9674.00 },

                    // Winston (category_id: 13) - умножаем на 10
                    { cat: 'Winston', name: 'WIN PURPLE OPTION', price: 9716.00 },
                    { cat: 'Winston', name: 'WINST BAIZE OPTION', price: 9716.00 },
                    { cat: 'Winston', name: 'WINST GREEN OPTION', price: 9716.00 },
                    { cat: 'Winston', name: 'WINST XSTYLE 100\'S', price: 9520.00 },
                    { cat: 'Winston', name: 'WINST. LEGEND', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON AMARILLO', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON BLUE SSL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON SUMMER MIX', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON WHITESSL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON XSTYLE BL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON XSTYLE SIL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON XSTYLEDUAL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON ECRU', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON FLUO', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON GOLD', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON PINKOPTION', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON PURPLE MIX', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON RUBY', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON RUBYOPTION', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON SILVER SSL', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON SSL GREEN', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON SSL VIOLET', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON BRONZE', price: 9716.00 },
                    { cat: 'Winston', name: 'WINSTON CAST+DREAM', price: 9520.00 },
                    { cat: 'Winston', name: 'WINSTON COMP 100\'S', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON COMPACT BL', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTON COMPACT SI', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTONSSEXPRBLUE', price: 9142.00 },
                    { cat: 'Winston', name: 'WINSTONSSEXPURPLE', price: 9142.00 },
                    { cat: 'Winston', name: 'WINXSTYLE CAST+100', price: 9520.00 },

                    // Camel (category_id: 14) - умножаем на 10
                    { cat: 'Camel', name: 'CAMEL YELLOW', price: 10010.00 },

                    // Captain Black (category_id: 15) - умножаем на 10
                    { cat: 'Captain Black', name: 'CAPTAIN CHERISE', price: 17920.00 },
                    { cat: 'Captain Black', name: 'CAPTAIN CLASSIC', price: 17920.00 },
                    { cat: 'Captain Black', name: 'CAPTAIN DARK CREMA', price: 17920.00 },
                    { cat: 'Captain Black', name: 'CAPTAIN GRAPE', price: 17920.00 },

                    // Зажигалки BIC (цены за единицу - НЕ умножаем!)
                    { cat: 'Зажигалки BIC', name: 'ЗАЖ BIC J6 МАКСИ', price: 350.00 },
                    { cat: 'Зажигалки BIC', name: 'ЗАЖ БИКJ3 ЛУНА Т50', price: 287.00 },
                    { cat: 'Зажигалки BIC', name: 'BIC 3 КАРТА 24', price: 385.00 },
                    { cat: 'Зажигалки BIC', name: 'BIC 3 СЕНСАТИВ 4Ш', price: 1302.00 },
                    { cat: 'Зажигалки BIC', name: 'BIC МЕТАЛ КАРТА 36', price: 210.00 },
                    { cat: 'Зажигалки BIC', name: 'BIC ТВИН ЛЕДИ 5Ш', price: 868.00 }
                ];

                // Добавляем товары в правильные категории
                allProducts.forEach(prod => {
                    // Находим ID категории по названию
                    db.get("SELECT id FROM categories WHERE name = ?", [prod.cat], (err, category) => {
                        if (category) {
                            db.run("INSERT INTO products (category_id, name, price) VALUES (?, ?, ?)", 
                                [category.id, prod.name, prod.price]);
                        }
                    });
                });

                console.log(`Добавлено ${categories.length} категорий и ${allProducts.length} товаров`);
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
    console.log('Login attempt:', username);
    
    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!admin) {
            console.log('Admin not found:', username);
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        if (!bcrypt.compareSync(password, admin.password)) {
            console.log('Invalid password for:', username);
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        
        req.session.isAuthenticated = true;
        req.session.adminId = admin.id;
        req.session.username = admin.username;
        
        // Сохраняем сессию явно
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Ошибка сохранения сессии' });
            }
            console.log('Login successful:', username, 'Session ID:', req.sessionID);
            res.json({ success: true, username: admin.username });
        });
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
    
    // Информация о среде выполнения
    console.log('\n=== Информация о среде ===');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH || 'не установлен');
    console.log('База данных:', dbPath);
    console.log('Папка uploads:', uploadsPath);
    console.log('========================\n');
});

// Обработка graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM получен, закрываем сервер...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка при закрытии базы данных:', err);
        } else {
            console.log('База данных закрыта');
        }
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT получен, закрываем сервер...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка при закрытии базы данных:', err);
        } else {
            console.log('База данных закрыта');
        }
        process.exit(0);
    });
});