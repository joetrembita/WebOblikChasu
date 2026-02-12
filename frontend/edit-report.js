// edit-report.js
// Логіка для створення/редагування звіту: заповнення, розрахунки, збереження

const backendUrl = '';

// --- Заповнення списку працівників ---
async function loadWorkers() {
    const select = document.getElementById('worker-select');
    if (!select) return;
    try {
        const res = await fetch(`${backendUrl}/workers`);
        const workers = await res.json();
        select.innerHTML = workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    } catch (e) {
        select.innerHTML = '<option disabled>Loading error</option>';
    }
}

// --- Тимчасова таблиця працівників у звіті ---
let tempEntries = [];

function renderTempTable() {
    const tbody = document.querySelector('#temp-reports-table tbody');
    tbody.innerHTML = '';
    tempEntries.forEach((entry, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.workerName}</td>
            <td><input type="number" min="0" step="0.25" value="${entry.hours}" data-idx="${idx}" class="hours-input"></td>
            <td><input type="number" min="0" step="0.01" value="${entry.rate}" data-idx="${idx}" class="rate-input"></td>
            <td><input type="checkbox" data-idx="${idx}" class="heavy-input" ${entry.heavy ? 'checked' : ''}></td>
            <td><input type="checkbox" data-idx="${idx}" class="tips-input" ${entry.tips ? 'checked' : ''}></td>
            <td><input type="checkbox" data-idx="${idx}" class="gas-input" ${entry.gas ? 'checked' : ''}></td>
            <td class="sum-cell">0.00</td>
            <td><button type="button" class="remove-btn" data-idx="${idx}">Delete</button></td>
        `;
        tbody.appendChild(row);
    });
    recalcSums();
}

function recalcSums() {
    // Додаткові суми
    const heavySum = parseFloat(document.getElementById('heavy-input-final').value) || 0;
    const tipsSum = parseFloat(document.getElementById('tips-input-final').value) || 0;
    const gasSum = parseFloat(document.getElementById('gas-input-final').value) || 0;
    const heavyCount = tempEntries.filter(e => e.heavy).length;
    const tipsCount = tempEntries.filter(e => e.tips).length;
    const gasCount = tempEntries.filter(e => e.gas).length;
    const perHeavy = heavyCount > 0 ? heavySum / (heavyCount + 1) : 0;
    const perTips = tipsCount > 0 ? tipsSum / tipsCount : 0;
    const perGas = gasCount > 0 ? gasSum / gasCount : 0;
    document.querySelectorAll('#temp-reports-table tbody tr').forEach((row, idx) => {
        const entry = tempEntries[idx];
        const base = entry.hours * entry.rate;
        const heavy = entry.heavy ? perHeavy : 0;
        const tips = entry.tips ? perTips : 0;
        const gas = entry.gas ? perGas : 0;
        row.querySelector('.sum-cell').textContent = (base + heavy + tips + gas).toFixed(2);
    });
}

// --- Додавання працівника ---
document.addEventListener('DOMContentLoaded', () => {

    loadWorkers().then(() => {
        // Якщо є id у URL — редагування
        const params = new URLSearchParams(window.location.search);
        const reportId = params.get('id');
        if (reportId) {
            document.getElementById('edit-report-title').textContent = 'Edit brakedown';
            fetch(`${backendUrl}/final-reports/${reportId}`)
                .then(r => r.json())
                .then(data => {
                    const report = data.report;
                    document.getElementById('job-number-input').value = report.job_number;
                    document.getElementById('report-date-input').value = report.report_date.slice(0,16);
                    document.getElementById('cash-input').value = report.cash_sum;
                    document.getElementById('zelle-input').value = report.zelle_sum;
                    document.getElementById('cc-input').value = report.cc_sum;
                    document.getElementById('venmo-input').value = report.venmo_sum;
                    document.getElementById('heavy-input-final').value = report.heavy_sum;
                    document.getElementById('tips-input-final').value = report.tips_sum;
                    document.getElementById('gas-input-final').value = report.gas_sum;
                    // entries
                    tempEntries = data.entries.filter(e => e.worker_name).map(e => ({
                        workerId: e.worker_id,
                        workerName: e.worker_name,
                        hours: e.hours_worked,
                        rate: e.actual_hourly_rate,
                        heavy: !!e.heavy,
                        tips: !!e.tips,
                        gas: !!e.gas
                    }));
                    renderTempTable();
                });
        } else {
            renderTempTable();
        }
    });

    document.getElementById('add-to-report-form').addEventListener('submit', e => {
        e.preventDefault();
        const select = document.getElementById('worker-select');
        const workerName = select.options[select.selectedIndex].text;
        tempEntries.push({
            workerId: select.value,
            workerName,
            hours: 0,
            rate: 0,
            heavy: false,
            tips: false,
            gas: false
        });
        renderTempTable();
    });

    document.querySelector('#temp-reports-table tbody').addEventListener('input', e => {
        const idx = e.target.dataset.idx;
        if (e.target.classList.contains('hours-input')) tempEntries[idx].hours = parseFloat(e.target.value) || 0;
        if (e.target.classList.contains('rate-input')) tempEntries[idx].rate = parseFloat(e.target.value) || 0;
        recalcSums();
    });
    document.querySelector('#temp-reports-table tbody').addEventListener('change', e => {
        const idx = e.target.dataset.idx;
        if (e.target.classList.contains('heavy-input')) tempEntries[idx].heavy = e.target.checked;
        if (e.target.classList.contains('tips-input')) tempEntries[idx].tips = e.target.checked;
        if (e.target.classList.contains('gas-input')) tempEntries[idx].gas = e.target.checked;
        recalcSums();
    });
    document.querySelector('#temp-reports-table tbody').addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
            tempEntries.splice(e.target.dataset.idx, 1);
            renderTempTable();
        }
    });

    // Оновлення сум при зміні додаткових полів
    ['heavy-input-final','tips-input-final','gas-input-final'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalcSums);
    });

    // Збереження звіту (POST/PUT)
    document.getElementById('edit-report-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const params = new URLSearchParams(window.location.search);
        const reportId = params.get('id');
        const body = {
            job_number: document.getElementById('job-number-input').value,
            report_date: document.getElementById('report-date-input').value,
            cash_sum: parseFloat(document.getElementById('cash-input').value) || 0,
            zelle_sum: parseFloat(document.getElementById('zelle-input').value) || 0,
            cc_sum: parseFloat(document.getElementById('cc-input').value) || 0,
            venmo_sum: parseFloat(document.getElementById('venmo-input').value) || 0,
            heavy_sum: parseFloat(document.getElementById('heavy-input-final').value) || 0,
            tips_sum: parseFloat(document.getElementById('tips-input-final').value) || 0,
            gas_sum: parseFloat(document.getElementById('gas-input-final').value) || 0,
            reports: tempEntries.map(e => ({
                worker_id: e.workerId,
                hours_worked: e.hours,
                actual_hourly_rate: e.rate,
                heavy: !!e.heavy,
                tips: !!e.tips,
                gas: !!e.gas
            }))
        };
        try {
            let res, savedId;
            if (reportId) {
                res = await fetch(`${backendUrl}/final-reports/${reportId}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body)
                });
                savedId = reportId;
            } else {
                res = await fetch(`${backendUrl}/final-reports`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    const data = await res.json();
                    savedId = data.id;
                }
            }
            if (res.ok && savedId) {
                window.location.href = `reports.html?open=${encodeURIComponent(savedId)}`;
            } else {
                alert('Brakedown saving error');
            }
        } catch (err) {
            alert('Brakedown saving error');
        }
    });
});
