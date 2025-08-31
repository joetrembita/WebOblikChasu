const backendUrl = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    loadPaytypes();
});

// Функція для завантаження та відображення типів оплати
async function loadPaytypes() {
    try {
        const response = await fetch(`${backendUrl}/paytypes`);
        const paytypes = await response.json();
        const paytypesTableBody = document.querySelector('#paytypes-table tbody');

        paytypesTableBody.innerHTML = '';

        if (paytypes.length === 0) {
            paytypesTableBody.innerHTML = '<tr><td colspan="2">Немає збережених типів оплати.</td></tr>';
            return;
        }

        paytypes.forEach(paytype => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span class="paytype-display">${paytype.name}</span>
                    <input type="text" class="edit-name-input hidden" value="${paytype.name}">
                </td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${paytype.id}">Редагувати</button>
                    <button class="save-btn hidden" data-id="${paytype.id}">Зберегти</button>
                    <button class="cancel-btn hidden">Скасувати</button>
                    <button class="delete-btn" data-id="${paytype.id}">Видалити</button>
                </td>
            `;
            paytypesTableBody.appendChild(tr);
        });
        // Додаємо обробники подій
        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', toggleEditMode));
        document.querySelectorAll('.save-btn').forEach(btn => btn.addEventListener('click', updatePaytype));
        document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', toggleEditMode));
        document.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', deletePaytype));
    } catch (error) {
        console.error('Помилка при завантаженні типів оплати:', error);
    }
}

// Функція для додавання нового типу оплати
document.getElementById('add-paytype-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('paytypeName-input');
    const paytypeName = nameInput.value.trim();

    if (!paytypeName) {
        alert('Будь ласка, введіть назву типу оплати.');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/paytypes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: paytypeName })
        });

        if (response.ok) {
            nameInput.value = ''; // Очищаємо поле вводу
            loadPaytypes(); // Оновлюємо список
        } else {
            alert('Помилка при додаванні типу оплати.');
        }
    } catch (error) {
        console.error('Помилка при відправці:', error);
    }
});

// Функція для видалення типу оплати
async function deletePaytype(event) {
    const paytypeId = event.target.dataset.id;

    if (!confirm('Ви впевнені, що хочете видалити цей тип оплати?')) {
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/paytypes/${paytypeId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadPaytypes(); // Оновлюємо список
        } else {
            alert('Помилка при видаленні типу оплати.');
        }
    } catch (error) {
        console.error('Помилка при видаленні:', error);
    }
}

// Перемикає режим редагування
function toggleEditMode(event) {
    const li = event.target.closest('li');
    li.querySelector('.paytype-display').classList.toggle('hidden');
    li.querySelector('.edit-input').classList.toggle('hidden');
    li.querySelector('.edit-btn').classList.toggle('hidden');
    li.querySelector('.save-btn').classList.toggle('hidden');
    li.querySelector('.cancel-btn').classList.toggle('hidden');
    li.querySelector('.delete-btn').classList.toggle('hidden');
}

// Функція для оновлення типу оплати
async function updatePaytype(event) {
    const paytypeId = event.target.dataset.id;
    const li = event.target.closest('li');
    const input = li.querySelector('.edit-input');

    const updatedData = {
        name: input.value.trim()
    };

    if (!updatedData.name) {
        alert('Будь ласка, введіть назву типу оплати.');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/paytypes/${paytypeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            loadPaytypes(); // Оновлюємо список
        } else {
            alert('Помилка при оновленні типу оплати.');
        }
    } catch (error) {
        console.error('Помилка при оновленні:', error);
    }
}