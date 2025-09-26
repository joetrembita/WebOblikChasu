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
                'ADD_REPORT': 'Brakedown added',
                'DELETE_REPORT': 'Brakedown deleted',
                'ADD_WORKER': 'Mover added',
                'UPDATE_WORKER': 'Mover updated',
                'DELETE_WORKER': 'Mover deleted',
                'CLEAR_LOGS': 'Logs cleared'
            }[log.action] || log.action;

            row.innerHTML = `
                <td>${actionText}</td>
                <td>${log.details}</td>
                <td>${new Date(log.timestamp).toLocaleString('uk-UA')}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Logs loading error:', error);
        const tableBody = document.getElementById('logs-table-body');
        tableBody.innerHTML = '<tr><td colspan="3">Logs loading error.</td></tr>';
    }
}

async function clearLogs() {
    const confirmClear = confirm('Are you shure you want to clear log? It can not be undone.');
    if (!confirmClear) return;

    try {
        const response = await fetch(`${backendUrl}/logs`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        alert('Logs cleared!');
        loadLogs(); // Refresh the logs table
    } catch (error) {
        console.error('Logs clering error:', error);
        alert('Logs clering error.');
    }
}