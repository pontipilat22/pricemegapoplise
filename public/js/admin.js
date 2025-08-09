// Глобальные переменные
let allOrders = [];
let filteredOrders = [];
let categories = [];
let products = [];
let currentTab = 'orders';

// Функция для fetch с правильными настройками для работы с сессиями
async function fetchWithCredentials(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем авторизацию
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'same-origin'
        });
        const data = await response.json();
        
        if (!data.isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = '/login.html';
        return;
    }
    
    // Если авторизован, загружаем данные
    loadOrders();
    loadCategories();
    loadProducts();
    setInterval(loadOrders, 30000); // Обновляем каждые 30 секунд
    
    // Обработчики форм
    document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    
    // Предпросмотр изображений
    document.getElementById('category-image').addEventListener('change', (e) => previewImage(e, 'category-image-preview'));
    document.getElementById('product-image').addEventListener('change', (e) => previewImage(e, 'product-image-preview'));
});

// Загрузка заказов
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        allOrders = await response.json();
        updateStats();
        filterOrders();
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

// Обновление статистики
function updateStats() {
    const totalOrders = allOrders.length;
    const newOrders = allOrders.filter(order => order.status === 'new').length;
    const totalAmount = allOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    // Сегодняшние заказы
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = allOrders.filter(order => 
        order.created_at.split('T')[0] === today
    ).length;
    
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('new-orders').textContent = newOrders;
    document.getElementById('total-amount').textContent = `${totalAmount.toFixed(2)} KZT`;
    document.getElementById('today-orders').textContent = todayOrders;
}

// Фильтрация заказов
function filterOrders() {
    const statusFilter = document.getElementById('filter-status').value;
    const dateFilter = document.getElementById('filter-date').value;
    const searchFilter = document.getElementById('filter-search').value.toLowerCase();
    
    filteredOrders = allOrders.filter(order => {
        // Фильтр по статусу
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }
        
        // Фильтр по дате
        if (dateFilter && order.created_at.split('T')[0] !== dateFilter) {
            return false;
        }
        
        // Фильтр по поиску
        if (searchFilter && !order.shop_name.toLowerCase().includes(searchFilter)) {
            return false;
        }
        
        return true;
    });
    
    displayOrders();
}

// Отображение заказов
function displayOrders() {
    const tbody = document.getElementById('orders-tbody');
    const noOrders = document.getElementById('no-orders');
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = '';
        noOrders.style.display = 'block';
        return;
    }
    
    noOrders.style.display = 'none';
    tbody.innerHTML = '';
    
    filteredOrders.forEach(order => {
        const row = document.createElement('tr');
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + 
                             date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${formattedDate}</td>
            <td>${order.shop_name}</td>
            <td>${order.phone || '-'}</td>
            <td>${order.items_count || 0}</td>
            <td>${order.total_amount.toFixed(2)} KZT</td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-small btn-view" onclick="viewOrder(${order.id})">Просмотр</button>
                    <button class="btn-small btn-status" onclick="changeStatus(${order.id})">Статус</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Получение текста статуса
function getStatusText(status) {
    const statusTexts = {
        'new': 'Новый',
        'processing': 'В обработке',
        'completed': 'Выполнен'
    };
    return statusTexts[status] || status;
}

// Просмотр деталей заказа
async function viewOrder(orderId) {
    try {
        const response = await fetch(`/api/orders/${orderId}`);
        const order = await response.json();
        
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + 
                             date.toLocaleTimeString('ru-RU');
        
        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${item.product_name}</td>
                    <td>${item.price.toFixed(2)} KZT</td>
                    <td>${item.quantity}</td>
                    <td>${(item.price * item.quantity).toFixed(2)} KZT</td>
                </tr>
            `;
        });
        
        const detailsHtml = `
            <div class="order-header">
                <h2>Заказ #${order.id}</h2>
                <p>от ${formattedDate}</p>
            </div>
            
            <div class="order-info">
                <div>
                    <div class="info-group">
                        <div class="info-label">Магазин:</div>
                        <div class="info-value">${order.shop_name}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Телефон:</div>
                        <div class="info-value">${order.phone || 'Не указан'}</div>
                    </div>
                </div>
                <div>
                    <div class="info-group">
                        <div class="info-label">Email:</div>
                        <div class="info-value">${order.email || 'Не указан'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Статус:</div>
                        <div class="info-value">
                            <span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <h3>Товары в заказе:</h3>
            <table class="order-items-table">
                <thead>
                    <tr>
                        <th>Товар</th>
                        <th>Цена</th>
                        <th>Количество</th>
                        <th>Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="order-total">
                Итого: ${order.total_amount.toFixed(2)} KZT
            </div>
            
            <div class="order-actions">
                <button class="btn-primary" onclick="printOrder(${order.id})">Печать</button>
                <button class="btn-secondary" onclick="closeOrderModal()">Закрыть</button>
            </div>
        `;
        
        document.getElementById('order-details').innerHTML = detailsHtml;
        document.getElementById('order-modal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки деталей заказа:', error);
        alert('Не удалось загрузить детали заказа');
    }
}

// Изменение статуса заказа
async function changeStatus(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const statuses = ['new', 'processing', 'completed'];
    const currentIndex = statuses.indexOf(order.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const newStatus = statuses[nextIndex];
    
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            // Обновляем локальный статус
            order.status = newStatus;
            // Обновляем отображение
            filterOrders();
            updateStats();
        } else {
            if (response.status === 401) {
                alert('Сессия истекла. Пожалуйста, войдите снова.');
                window.location.href = '/admin';
            } else {
                alert('Ошибка при обновлении статуса');
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при обновлении статуса');
    }
}

// Печать заказа
function printOrder(orderId) {
    window.print();
}

// Закрытие модального окна
function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-search').value = '';
    filterOrders();
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const orderModal = document.getElementById('order-modal');
    const categoryModal = document.getElementById('category-modal');
    const productModal = document.getElementById('product-modal');
    
    if (event.target === orderModal) {
        closeOrderModal();
    } else if (event.target === categoryModal) {
        closeCategoryModal();
    } else if (event.target === productModal) {
        closeProductModal();
    }
}

// Переключение вкладок
function switchTab(tabName) {
    currentTab = tabName;
    
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    document.getElementById(`${tabName}-tab`).style.display = 'block';
    
    // Добавляем активный класс к кнопке
    event.target.classList.add('active');
}

// Загрузка категорий
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        categories = await response.json();
        displayCategories();
        updateCategorySelect();
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

// Отображение категорий
function displayCategories() {
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = '';
    
    categories.forEach(category => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${category.id}</td>
            <td>
                <img src="${category.image ? `/uploads/${category.image}` : '/images/default-category.jpg'}" 
                     alt="${category.name}" 
                     onerror="this.src='/images/default-category.jpg'">
            </td>
            <td>${category.name}</td>
            <td>
                <button class="btn-edit" onclick="editCategory(${category.id})">Редактировать</button>
                <button class="btn-delete" onclick="deleteCategory(${category.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Обновление списка категорий в селекте
function updateCategorySelect() {
    const select = document.getElementById('product-category');
    select.innerHTML = '<option value="">Выберите категорию</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });
}

// Загрузка товаров
async function loadProducts() {
    try {
        const response = await fetch('/api/all-products');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        products = await response.json();
        displayProducts();
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// Отображение товаров
function displayProducts() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '';
    
    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.id}</td>
            <td>
                <img src="${product.image ? `/uploads/${product.image}` : '/images/default-product.jpg'}" 
                     alt="${product.name}" 
                     onerror="this.src='/images/default-product.jpg'">
            </td>
            <td>${product.name}</td>
            <td>${product.category_name}</td>
            <td>${product.price} KZT</td>
            <td>
                <button class="btn-edit" onclick="editProduct(${product.id})">Редактировать</button>
                <button class="btn-delete" onclick="deleteProduct(${product.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Показать форму категории
function showCategoryForm(categoryId = null) {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    const title = document.getElementById('category-modal-title');
    const preview = document.getElementById('category-image-preview');
    
    form.reset();
    preview.innerHTML = '';
    
    if (categoryId) {
        // Редактирование
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            title.textContent = 'Редактировать категорию';
            document.getElementById('category-id').value = category.id;
            document.getElementById('category-name').value = category.name;
            
            if (category.image) {
                preview.innerHTML = `<img src="/uploads/${category.image}" alt="${category.name}">`;
            }
        }
    } else {
        // Создание
        title.textContent = 'Добавить категорию';
        document.getElementById('category-id').value = '';
    }
    
    modal.style.display = 'block';
}

// Закрыть модальное окно категории
function closeCategoryModal() {
    document.getElementById('category-modal').style.display = 'none';
}

// Редактировать категорию
function editCategory(id) {
    showCategoryForm(id);
}

// Удалить категорию
async function deleteCategory(id) {
    if (!confirm('Вы уверены? Все товары в этой категории также будут удалены!')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/categories/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCategories();
            loadProducts();
            alert('Категория удалена');
        } else {
            alert('Ошибка при удалении категории');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении категории');
    }
}

// Обработка отправки формы категории
async function handleCategorySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value;
    const imageFile = document.getElementById('category-image').files[0];
    
    formData.append('name', name);
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = id ? `/api/categories/${id}` : '/api/categories';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            closeCategoryModal();
            loadCategories();
            alert(id ? 'Категория обновлена' : 'Категория добавлена');
        } else {
            alert('Ошибка при сохранении категории');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении категории');
    }
}

// Показать форму товара
function showProductForm(productId = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = document.getElementById('product-modal-title');
    const preview = document.getElementById('product-image-preview');
    
    form.reset();
    preview.innerHTML = '';
    
    if (productId) {
        // Редактирование
        const product = products.find(p => p.id === productId);
        if (product) {
            title.textContent = 'Редактировать товар';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-category').value = product.category_id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price').value = product.price;
            
            if (product.image) {
                preview.innerHTML = `<img src="/uploads/${product.image}" alt="${product.name}">`;
            }
        }
    } else {
        // Создание
        title.textContent = 'Добавить товар';
        document.getElementById('product-id').value = '';
    }
    
    modal.style.display = 'block';
}

// Закрыть модальное окно товара
function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

// Редактировать товар
function editProduct(id) {
    showProductForm(id);
}

// Удалить товар
async function deleteProduct(id) {
    if (!confirm('Вы уверены?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadProducts();
            alert('Товар удален');
        } else {
            alert('Ошибка при удалении товара');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении товара');
    }
}

// Обработка отправки формы товара
async function handleProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const id = document.getElementById('product-id').value;
    const categoryId = document.getElementById('product-category').value;
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const imageFile = document.getElementById('product-image').files[0];
    
    formData.append('category_id', categoryId);
    formData.append('name', name);
    formData.append('price', price);
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = id ? `/api/products/${id}` : '/api/products';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            closeProductModal();
            loadProducts();
            alert(id ? 'Товар обновлен' : 'Товар добавлен');
        } else {
            alert('Ошибка при сохранении товара');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении товара');
    }
}

// Предпросмотр изображения
function previewImage(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Выход из системы
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        // В любом случае перенаправляем на логин
        window.location.href = '/login.html';
    }
}