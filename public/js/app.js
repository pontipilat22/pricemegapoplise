// Глобальные переменные
let cart = [];
let categories = [];
let products = [];
let currentCategory = null;

// Функции для управления загрузчиком
function showLoader() {
    document.getElementById('loader').classList.add('active');
}

function hideLoader() {
    document.getElementById('loader').classList.remove('active');
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем класс для отключения анимаций при загрузке
    document.body.classList.add('preload');
    
    loadCategories();
    updateCartUI();
    
    // Восстановление корзины из localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
    
    // Включаем анимации после загрузки
    setTimeout(() => {
        document.body.classList.remove('preload');
    }, 100);
});

// Загрузка категорий
async function loadCategories() {
    showLoader();
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();
        displayCategories();
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        showModal('Ошибка', 'Не удалось загрузить категории товаров');
    } finally {
        hideLoader();
    }
}

// Отображение категорий
function displayCategories() {
    const container = document.getElementById('categories-container');
    const currentHeight = container.offsetHeight;
    container.style.minHeight = currentHeight + 'px';
    
    container.innerHTML = '';
    
    categories.forEach((category, index) => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.onclick = () => selectCategory(category);
        categoryCard.style.opacity = '0';
        
        categoryCard.innerHTML = `
            <img src="${category.image && !category.image.includes('/') ? `/uploads/${category.image}` : `/images/${category.image || 'default-category.jpg'}`}" 
                 alt="${category.name}" 
                 onerror="this.src='/images/default-category.jpg'">
            <h3>${category.name}</h3>
        `;
        
        container.appendChild(categoryCard);
        
        // Плавное появление категорий
        setTimeout(() => {
            categoryCard.style.transition = 'opacity 0.3s ease';
            categoryCard.style.opacity = '1';
        }, index * 50);
    });
    
    // Убираем минимальную высоту после загрузки
    setTimeout(() => {
        container.style.minHeight = '';
    }, categories.length * 50 + 300);
}

// Выбор категории
async function selectCategory(category) {
    currentCategory = category;
    showLoader();
    
    try {
        const response = await fetch(`/api/products/${category.id}`);
        products = await response.json();
        
        // Плавный переход к товарам
        const categoriesSection = document.getElementById('categories');
        const productsSection = document.getElementById('products');
        
        categoriesSection.style.display = 'none';
        productsSection.style.display = 'block';
        document.getElementById('category-title').textContent = category.name;
        
        displayProducts();
        
        // Прокручиваем к товарам
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showModal('Ошибка', 'Не удалось загрузить товары');
    } finally {
        hideLoader();
    }
}

// Вернуться к категориям
function backToCategories() {
    const categoriesSection = document.getElementById('categories');
    const productsSection = document.getElementById('products');
    
    categoriesSection.style.display = 'block';
    productsSection.style.display = 'none';
    
    // Плавная прокрутка к категориям
    categoriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Отображение товаров
function displayProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    products.forEach((product, index) => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.id = `product-${product.id}`;
        productCard.style.opacity = '0';
        
        productCard.innerHTML = `
            <img src="${product.image && !product.image.includes('/') ? `/uploads/${product.image}` : `/images/${product.image || 'default-product.jpg'}`}" 
                 alt="${product.name}"
                 onerror="this.src='/images/default-product.jpg'">
            <h4>${product.name}</h4>
            <p class="price">${product.price} KZT</p>
            <div class="product-controls">
                <div class="quantity-controls">
                    <button onclick="changeQuantity(${product.id}, -1)">-</button>
                    <input type="number" id="qty-${product.id}" value="0" min="0" readonly>
                    <button onclick="changeQuantity(${product.id}, 1)">+</button>
                </div>
            </div>
            <button class="btn-add" onclick="addToCart(${product.id})">В корзину</button>
        `;
        
        container.appendChild(productCard);
        
        // Плавное появление с задержкой
        setTimeout(() => {
            productCard.style.transition = 'opacity 0.3s ease';
            productCard.style.opacity = '1';
        }, index * 50);
        
        // Обновляем количество, если товар уже в корзине
        const cartItem = cart.find(item => item.productId === product.id);
        if (cartItem) {
            document.getElementById(`qty-${product.id}`).value = cartItem.quantity;
        }
    });
}

// Изменение количества товара
let quantityTimeouts = {};
function changeQuantity(productId, delta) {
    const input = document.getElementById(`qty-${productId}`);
    const currentValue = parseInt(input.value) || 0;
    const newValue = Math.max(0, currentValue + delta);
    input.value = newValue;
    
    // Отменяем предыдущий таймаут для этого товара
    if (quantityTimeouts[productId]) {
        clearTimeout(quantityTimeouts[productId]);
    }
    
    // Добавляем небольшую задержку для предотвращения дерганий
    quantityTimeouts[productId] = setTimeout(() => {
        // Можно добавить дополнительную логику здесь
        delete quantityTimeouts[productId];
    }, 100);
}

// Добавление товара в корзину
let addToCartInProgress = {};
function addToCart(productId) {
    // Предотвращаем двойные клики
    if (addToCartInProgress[productId]) {
        return;
    }
    
    addToCartInProgress[productId] = true;
    
    const quantity = parseInt(document.getElementById(`qty-${productId}`).value) || 0;
    
    if (quantity === 0) {
        showModal('Внимание', 'Укажите количество товара');
        delete addToCartInProgress[productId];
        return;
    }
    
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
        existingItem.quantity = quantity;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartUI();
    showModal('Успешно', `${product.name} добавлен в корзину`);
    
    // Разблокируем кнопку через небольшую задержку
    setTimeout(() => {
        delete addToCartInProgress[productId];
    }, 500);
}

// Сохранение корзины в localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Обновление интерфейса корзины
function updateCartUI() {
    const emptyCart = document.getElementById('cart-empty');
    const cartItems = document.getElementById('cart-items');
    const cartTbody = document.getElementById('cart-tbody');
    const cartTotal = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        emptyCart.style.display = 'block';
        cartItems.style.display = 'none';
        return;
    }
    
    emptyCart.style.display = 'none';
    cartItems.style.display = 'block';
    
    cartTbody.innerHTML = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const row = document.createElement('tr');
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.price} KZT</td>
            <td>${item.quantity}</td>
            <td>${itemTotal} KZT</td>
            <td><span class="remove-item" onclick="removeFromCart(${index})">✕</span></td>
        `;
        
        cartTbody.appendChild(row);
    });
    
    cartTotal.textContent = `${total} KZT`;
}

// Удаление товара из корзины
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
    
    // Обновляем количество в карточке товара, если она отображается
    products.forEach(product => {
        const input = document.getElementById(`qty-${product.id}`);
        if (input) {
            const cartItem = cart.find(item => item.productId === product.id);
            input.value = cartItem ? cartItem.quantity : 0;
        }
    });
}

// Очистка корзины
function clearCart() {
    if (confirm('Вы уверены, что хотите очистить корзину?')) {
        cart = [];
        saveCart();
        updateCartUI();
        
        // Сбрасываем все счетчики товаров
        products.forEach(product => {
            const input = document.getElementById(`qty-${product.id}`);
            if (input) input.value = 0;
        });
    }
}

// Оформление заказа
async function submitOrder() {
    // Проверка корзины
    if (cart.length === 0) {
        showModal('Ошибка', 'Корзина пуста');
        return;
    }
    
    // Проверка формы магазина
    const shopName = document.getElementById('shop-name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (!shopName) {
        showModal('Ошибка', 'Введите название магазина');
        document.getElementById('shop-name').focus();
        return;
    }
    
    showLoader();
    
    // Подсчет общей суммы
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Подготовка данных заказа
    const orderData = {
        shopName,
        phone,
        email,
        totalAmount,
        items: cart
    };
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при отправке заказа');
        }
        
        const result = await response.json();
        
        // Очищаем корзину и форму
        cart = [];
        saveCart();
        updateCartUI();
        document.getElementById('shop-form').reset();
        
        // Сбрасываем счетчики товаров
        products.forEach(product => {
            const input = document.getElementById(`qty-${product.id}`);
            if (input) input.value = 0;
        });
        
        // Показываем успешное сообщение
        showModal('Заказ оформлен!', `
            <p>Ваш заказ №${result.id} успешно оформлен!</p>
            <p>Магазин: ${shopName}</p>
            <p>Сумма заказа: ${totalAmount} KZT</p>
            <p>Мы свяжемся с вами в ближайшее время.</p>
        `);
        
        // Возвращаемся к категориям
        backToCategories();
        
    } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        showModal('Ошибка', 'Не удалось отправить заказ. Попробуйте позже.');
    } finally {
        hideLoader();
    }
}

// Модальное окно
function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h3>${title}</h3>
        <div>${content}</div>
    `;
    
    // Плавное появление
    modal.style.display = 'block';
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '1';
    }, 10);
    
    // Автоматически закрываем через 3 секунды для простых сообщений
    if (!content.includes('<')) {
        setTimeout(() => {
            closeModal();
        }, 3000);
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
        modal.style.transition = '';
    }, 300);
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}