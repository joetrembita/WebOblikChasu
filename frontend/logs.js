const backendUrl = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    loadLogs();
    document.getElementById('clear-logs-btn').addEventListener('click', clearLogs);
});

async function loadLogs() {
    try {
        const response = await fetch(`${backendUrl}/logs`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const logs = await response.json();

        const tableBody = document.getElementById('logs-table-body');
        tableBody.innerHTML = '';

        if (logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">Поки що немає записів у лозі.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const row = document.createElement('tr');
            const actionText = {
                'ADD_REPORT': 'Додавання звіту',
                'DELETE_REPORT': 'Видалення звіту',
                'ADD_WORKER': 'Додавання працівника',
                'UPDATE_WORKER': 'Оновлення працівника',
                'DELETE_WORKER': 'Видалення працівника',
                'CLEAR_LOGS': 'Очищення логу'
            }[log.action] || log.action;

            row.innerHTML = `
                <td>${actionText}</td>
                <td>${log.details}</td>
                <td>${new Date(log.timestamp).toLocaleString('uk-UA')}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Помилка при завантаженні логу:', error);
        const tableBody = document.getElementById('logs-table-body');
        tableBody.innerHTML = '<tr><td colspan="3">Помилка завантаження логу.</td></tr>';
    }
}

async function clearLogs() {
    const confirmClear = confirm('Ви впевнені, що хочете очистити весь лог?');
    if (!confirmClear) return;

    try {
        const response = await fetch(`${backendUrl}/logs`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        alert('Лог успішно очищено!');
        loadLogs(); // Refresh the logs table
    } catch (error) {
        console.error('Помилка при очищенні логу:', error);
        alert('Помилка при очищенні логу.');
    }
}