// salary-form.js
// Отримує дані з параметрів URL і підставляє у форму

let allEntries = [];
let filters = {};
let currentFilterMenu = null;

function computeSum(entry) {
    return Number(entry.hours_worked) * Number(entry.actual_hourly_rate) + (Number(entry.additional_cost) || 0);
}

function getColumnValue(entry, column) {
    const key = column.key;
    if (key === 'sum') {
        return computeSum(entry).toFixed(2);
    }
    let val = entry[key];
    if (val === undefined || val === null) return '';
    if (key === 'report_date') {
        return val ? val.replace('T', ' ') : '';
    }
    if (typeof val === 'boolean') {
        return val.toString();
    }
    return val.toString();
}

function getUniques(entries, column) {
    const values = entries.map(e => getColumnValue(e, column)).filter(v => v !== '');
    const uniqueValues = [...new Set(values)];
    if (column.type === 'number' || column.key === 'sum') {
        return uniqueValues.sort((a, b) => Number(a) - Number(b));
    } else {
        return uniqueValues.sort((a, b) => a.localeCompare(b));
    }
}

function getDisplayValue(val, column) {
    if (column.key === 'paid') {
        return val === 'true' ? 'Оплачено' : 'Не оплачено';
    }
    if (column.type === 'boolean') {
        return val === 'true' ? 'Так' : 'Ні';
    }
    return val;
}

function getFilteredEntries() {
    if (Object.keys(filters).length === 0) return allEntries;
    return allEntries.filter(entry => {
        for (const [colKey, selectedSet] of Object.entries(filters)) {
            const column = columns.find(c => c.key === colKey);
            if (!column) continue;
            const val = getColumnValue(entry, column);
            if (!selectedSet.has(val)) {
                return false;
            }
        }
        return true;
    });
}

const columns = [
    {index: 0, key: 'job_number', type: 'string'},
    {index: 1, key: 'worker_name', type: 'string'},
    {index: 2, key: 'sum', type: 'number'},
    {index: 3, key: 'paid', type: 'boolean'},
];

function showFilterMenu(th) {
    // Пропускаємо перший стовпець (чекбокс)
    const index = th.cellIndex - 1;
    const column = columns[index];
    if (!column) return;

    const colKey = column.key;
    const uniques = getUniques(allEntries, column);
    const selected = filters[colKey] ? new Set(filters[colKey]) : new Set(uniques);

    // Hide previous menu
    if (currentFilterMenu) {
        currentFilterMenu.remove();
    }

    const rect = th.getBoundingClientRect();
    currentFilterMenu = document.createElement('div');
    currentFilterMenu.className = 'filter-menu';
    currentFilterMenu.style.position = 'absolute';
    currentFilterMenu.style.top = `${rect.bottom + window.scrollY}px`;
    currentFilterMenu.style.left = `${rect.left + window.scrollX}px`;
    currentFilterMenu.style.background = 'white';
    currentFilterMenu.style.border = '1px solid #ccc';
    currentFilterMenu.style.padding = '10px';
    currentFilterMenu.style.zIndex = '1000';
    currentFilterMenu.style.maxHeight = '300px';
    currentFilterMenu.style.overflow = 'auto';
    currentFilterMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    currentFilterMenu.style.minWidth = `${rect.width}px`;

    let html = `<h4>Фільтр за ${th.textContent.trim()}</h4>`;
    html += `<label style="display: block;"><input type="checkbox" id="selectAll_${colKey.replace(/\W/g, '')}"> Вибрати всі</label>`;
    html += '<div class="options" style="max-height: 200px; overflow: auto;">';
    uniques.forEach(u => {
        const checked = selected.has(u) ? 'checked' : '';
        const display = getDisplayValue(u, column);
        html += `<label style="display: block; margin-bottom: 5px;"><input type="checkbox" value="${u}" class="filter-check" ${checked}> ${display}</label>`;
    });
    html += '</div>';
    currentFilterMenu.innerHTML = html;
    document.body.appendChild(currentFilterMenu);

    // Event listeners
    const selectAll = currentFilterMenu.querySelector(`#selectAll_${colKey.replace(/\W/g, '')}`);
    const checks = currentFilterMenu.querySelectorAll('.filter-check');

    function updateFilters() {
        const newSelected = new Set();
        checks.forEach(ch => {
            if (ch.checked) newSelected.add(ch.value);
        });
        if (newSelected.size === 0) {
            delete filters[colKey];
        } else {
            filters[colKey] = newSelected;
        }
        renderSalaryTable(getFilteredEntries());
    }

    checks.forEach(ch => ch.addEventListener('change', updateFilters));

    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const allChecked = e.target.checked;
            checks.forEach(ch => { ch.checked = allChecked; });
            updateFilters();
        });
    }

    // Close on outside click
    const closeListener = (e) => {
        if (!currentFilterMenu.contains(e.target) && !th.contains(e.target)) {
            currentFilterMenu.remove();
            document.removeEventListener('click', closeListener);
            currentFilterMenu = null;
        }
    };
    setTimeout(() => document.addEventListener('click', closeListener), 0);
}

function renderSalaryTable(entries) {
    const tbody = document.querySelector('#salary-table tbody');
    tbody.innerHTML = '';
    entries.forEach(entry => {
        const sum = computeSum(entry).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" data-id="${entry.id}"></td>
            <td>${entry.job_number}</td>
            <td>${entry.worker_name}</td>
            <td>${sum}</td>
            <td>${entry.paid ? 'Оплачено' : 'Не оплачено'}</td>
        `;
        tbody.appendChild(tr);
    });

    // Масові чекбокси
    const checkAll = document.getElementById('check-all');
    const rowChecks = tbody.querySelectorAll('.row-check');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.addEventListener('change', () => {
            rowChecks.forEach(cb => { cb.checked = checkAll.checked; });
        });
    }
    // Додаємо обробник видалення для кожного рядка
    tbody.querySelectorAll('.delete-entry-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const job = btn.dataset.job;
            if (confirm('Видалити цей запис?')) {
                await deleteSalaryEntry(id);
            }
        });
    });
}
// Helper to save entries to localStorage
function saveEntriesToStorage() {
    localStorage.setItem('approvedSalaryEntries', JSON.stringify(allEntries));
}

// Видалити один запис
async function deleteSalaryEntry(id) {
    try {
        // Спочатку видаляємо з сервера (якщо потрібно)
        // await fetch(`/salary-entries/${id}`, { method: 'DELETE' });
        
        allEntries = allEntries.filter(e => e.id != id);
        saveEntriesToStorage(); // Зберігаємо зміни
        renderSalaryTable(getFilteredEntries());
    } catch (err) {
        alert('Помилка при видаленні запису');
    }
}

// Масове видалення за job_number
async function deleteEntriesByJobNumber(jobNumber) {
    const ids = allEntries.filter(e => e.job_number === jobNumber).map(e => e.id);
    for (const id of ids) {
        await deleteSalaryEntry(id);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Кнопка скидання фільтрів
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            filters = {};
            renderSalaryTable(allEntries);
        });
    }

    // Масові кнопки
    const massDeleteBtn = document.getElementById('mass-delete-btn');
    const massPayBtn = document.getElementById('mass-pay-btn');

    if (massDeleteBtn) {
        massDeleteBtn.addEventListener('click', async () => {
            const checked = Array.from(document.querySelectorAll('.row-check:checked'));
            if (checked.length === 0) {
                alert('Оберіть хоча б один запис для видалення.');
                return;
            }
            if (!confirm('Видалити вибрані записи?')) return;
            for (const cb of checked) {
                await deleteSalaryEntry(cb.dataset.id);
            }
        });
    }

    if (massPayBtn) {
        massPayBtn.addEventListener('click', async () => {
            const checked = Array.from(document.querySelectorAll('.row-check:checked'));
            if (checked.length === 0) {
                alert('Оберіть хоча б один запис для оплати.');
                return;
            }
            if (!confirm('Позначити вибрані записи як "Оплачені"?')) return;
            for (const cb of checked) {
                await markSalaryEntryPaid(cb.dataset.id);
            }
            renderSalaryTable(getFilteredEntries());
        });
    }

    // Пропускаємо перший стовпець (чекбокс) для фільтрації
    const headers = document.querySelectorAll('#salary-table thead th');
    headers.forEach((th, i) => {
        if (i === 0) return; // skip checkbox column
        th.style.cursor = 'pointer';
        th.title = 'Натисніть для фільтрації';
        th.addEventListener('click', (e) => {
            e.stopPropagation();
            showFilterMenu(th);
        });
    });

    // Завантажуємо дані з localStorage
    const storedEntries = JSON.parse(localStorage.getItem('approvedSalaryEntries') || '[]');
    allEntries = storedEntries;
    renderSalaryTable(allEntries);

    // Слухач для оновлення даних з інших вкладок
    window.addEventListener('storage', (event) => {
        if (event.key === 'approvedSalaryEntries') {
            allEntries = JSON.parse(event.newValue || '[]');
            renderSalaryTable(allEntries);
        }
    });
});

// Масова оплата
async function markSalaryEntryPaid(id) {
    try {
        // Тут можна додати логіку для оновлення статусу на сервері, якщо потрібно
        // await fetch(`/salary-entries/${id}/pay`, { method: 'POST' });
        const entry = allEntries.find(e => e.id == id);
        if (entry) entry.paid = true;
        saveEntriesToStorage(); // Зберігаємо зміни
    } catch (err) {
        alert('Помилка при оплаті запису');
    }
}