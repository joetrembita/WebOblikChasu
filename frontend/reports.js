const backendUrl = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const backToReportsLink = document.getElementById('back-to-reports-link');
    if (backToReportsLink) {
        backToReportsLink.addEventListener('click', () => {
            document.getElementById('main-reports-view').style.display = 'block';
            document.getElementById('report-details-view').style.display = 'none';
        });
    } else {
        console.error("Елемент 'back-to-reports-link' не знайдено.");
    }

    loadReports();
});

async function loadReports() {
    try {
        const response = await fetch(`${backendUrl}/final-reports`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const finalReports = await response.json();

        const table = document.querySelector('#reports-table-container table');
        const reportsTableBody = table ? table.querySelector('tbody') : null;

        if (!reportsTableBody) {
            console.error("Елемент 'reports-table-container tbody' не знайдено.");
            return;
        }

        reportsTableBody.innerHTML = '';
        if (finalReports.length === 0) {
            reportsTableBody.innerHTML = '<tr><td colspan="6">Поки що немає збережених звітів.</td></tr>';
            return;
        }

        finalReports.forEach(report => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.job_number}</td>
                <td>${report.worker_count}</td>
                <td>${(report.total_cost).toFixed(2)}</td>
                <td>${(report.total_payment).toFixed(2)}</td>
                <td>${report.report_date}</td>
                <td class="action-buttons">
                    <button class="view-details-btn" data-id="${report.id}">Переглянути</button>
                    <button class="delete-btn" data-id="${report.id}">Видалити</button>
                </td>
            `;
            reportsTableBody.appendChild(row);
        });

        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (event) => showReportDetails(event.target.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', deleteReport);
        });
    } catch (error) {
        console.error('Помилка при завантаженні звітів:', error);
    }
}

async function showReportDetails(reportId) {
    try {
        const response = await fetch(`${backendUrl}/final-reports/${reportId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const reportData = await response.json();
        
        const report = reportData.report;
        const entries = reportData.entries.filter(entry => entry.worker_name); // Exclude "Дохід компанії"
        
        document.getElementById('main-reports-view').style.display = 'none';
        document.getElementById('report-details-view').style.display = 'block';

        document.getElementById('report-details-title').textContent = `Звіт ${report.job_number} від ${report.report_date}`;

        const heavyWorkersCount = entries.filter(e => e.heavy).length;
        const companyHeavy = heavyWorkersCount > 0 ? report.heavy_sum / (heavyWorkersCount + 1) : 0;
        const tipsWorkersCount = entries.filter(e => e.tips).length;
        const perTips = tipsWorkersCount > 0 ? report.tips_sum / tipsWorkersCount : 0;
        const gasWorkersCount = entries.filter(e => e.gas).length;
        const perGas = gasWorkersCount > 0 ? report.gas_sum / gasWorkersCount : 0;
        const perHeavy = companyHeavy; // Same value as company share

        document.getElementById('report-summary-info').innerHTML = `
            <p><strong>Номер роботи:</strong> ${report.job_number}</p>
            <p><strong>Оплата праці:</strong> ${report.total_labor_cost.toFixed(2)}</p>
            <p><strong>Загальна оплата:</strong> ${report.total_payment.toFixed(2)}</p>
            <p><strong>Сума Heavy:</strong> ${report.heavy_sum.toFixed(2)}</p>
            <p><strong>Сума Tips:</strong> ${report.tips_sum.toFixed(2)}</p>
            <p><strong>Сума Gas:</strong> ${report.gas_sum.toFixed(2)}</p>
            <p><strong>Дохід компанії (Heavy):</strong> ${companyHeavy.toFixed(2)}</p>
        `;

        const entriesTableBody = document.querySelector('#report-entries-table tbody');
        entriesTableBody.innerHTML = '';

        entries.forEach(entry => {
            const row = document.createElement('tr');
            const workerName = entry.worker_name;
            const workerPhone = entry.phone_number || 'Не вказано';
            const basePay = entry.hours_worked * entry.actual_hourly_rate;
            
            const heavyValue = entry.heavy ? perHeavy : 0;
            const tipsValue = entry.tips ? perTips : 0;
            const gasValue = entry.gas ? perGas : 0;
            const totalEntryCost = basePay + heavyValue + tipsValue + gasValue;

            row.innerHTML = `
                <td>${workerName}</td>
                <td>${workerPhone}</td>
                <td>${entry.hours_worked}</td>
                <td>${entry.actual_hourly_rate}</td>
                <td>${heavyValue.toFixed(2)}</td>
                <td>${tipsValue.toFixed(2)}</td>
                <td>${gasValue.toFixed(2)}</td>
                <td>${totalEntryCost.toFixed(2)}</td>
            `;
            entriesTableBody.appendChild(row);
        });
        
        document.getElementById('delete-detailed-btn').dataset.id = reportId;
        document.getElementById('delete-detailed-btn').addEventListener('click', deleteReport);
    } catch (error) {
        console.error('Помилка при завантаженні деталей звіту:', error);
    }
}

async function deleteReport(event) {
    const reportId = event.target.dataset.id;
    const confirmDelete = confirm('Ви впевнені, що хочете видалити цей звіт?');

    if (confirmDelete) {
        try {
            const response = await fetch(`${backendUrl}/final-reports/${reportId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                document.getElementById('main-reports-view').style.display = 'block';
                document.getElementById('report-details-view').style.display = 'none';
                loadReports();
            } else {
                const errorData = await response.json();
                alert(`Помилка при видаленні звіту: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка при видаленні звіту:', error);
            alert('Помилка при видаленні звіту.');
        }
    }
}