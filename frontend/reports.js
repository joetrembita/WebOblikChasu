const backendUrl = 'http://localhost:3000';

function formatDate(dateString) {
    console.log('Inscomig dateString:', dateString);
    let date = new Date(dateString);
    if (dateString.endsWith('Z')) {
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        date = new Date(date.getTime() - offsetMs);
    }
    if (isNaN(date)) {
        return 'Invalid data';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedDate = `${day}.${month}.${year} ${hours}:${minutes}`;
    console.log('Formated date:', formattedDate);
    return formattedDate;
}

document.addEventListener('DOMContentLoaded', () => {
    const backToReportsLink = document.getElementById('back-to-reports-link');
    if (backToReportsLink) {
        backToReportsLink.addEventListener('click', () => {
            document.getElementById('main-reports-view').style.display = 'block';
            document.getElementById('report-details-view').style.display = 'none';
        });
    } else {
        console.error("Element 'back-to-reports-link' not found.");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const openId = urlParams.get('open');
    if (openId) {
        showReportDetails(openId);
    } else {
        loadReports();
    }

    const createBtn = document.getElementById('create-report-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            window.location.href = 'edit-report.html';
        });
    }
});

async function loadReports() {
    try {
        const response = await fetch(`${backendUrl}/final-reports`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const finalReports = await response.json();
        console.log('Brakedowns:', finalReports);

        const table = document.querySelector('#reports-table-container table');
        const reportsTableBody = table ? table.querySelector('tbody') : null;

        if (!reportsTableBody) {
            console.error("Element 'reports-table-container tbody' not found.");
            return;
        }

        reportsTableBody.innerHTML = '';
        if (finalReports.length === 0) {
            reportsTableBody.innerHTML = '<tr><td colspan="6">Saved brakedowns not found.</td></tr>';
            return;
        }

        finalReports.forEach(report => {
            const totalCost = report.total_cost == null ? 0 : report.total_cost;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.job_number}</td>
                <td>${report.worker_count}</td>
                <td>${(totalCost).toFixed(2)}</td>
                <td>${report.cash_sum != null ? report.cash_sum.toFixed(2) : '0.00'}</td>
                <td>${formatDate(report.report_date)}</td>
                <td class="action-buttons">
                    <button class="view-details-btn" data-id="${report.id}">View/Edit</button>
                    <button class="delete-btn" data-id="${report.id}">Delete</button>
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
        console.error('Brakedown loading error:', error);
    }
}

async function showReportDetails(reportId) {
    try {
        const response = await fetch(`${backendUrl}/final-reports/${reportId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const reportData = await response.json();
        console.log('Brakedown data:', reportData);
        
        const report = reportData.report;
        const entries = reportData.entries.filter(entry => entry.worker_name);
        
        document.getElementById('main-reports-view').style.display = 'none';
        document.getElementById('report-details-view').style.display = 'block';

        document.getElementById('report-details-title').textContent = `Brakedown No. ${report.job_number} dated ${formatDate(report.report_date)}`;

        const heavyWorkersCount = entries.filter(e => e.heavy).length;
        const companyHeavy = heavyWorkersCount > 0 ? report.heavy_sum / (heavyWorkersCount + 1) : 0;
        const tipsWorkersCount = entries.filter(e => e.tips).length;
        const perTips = tipsWorkersCount > 0 ? report.tips_sum / tipsWorkersCount : 0;
        const gasWorkersCount = entries.filter(e => e.gas).length;
        const perGas = gasWorkersCount > 0 ? report.gas_sum / gasWorkersCount : 0;
        const perHeavy = companyHeavy;

        const totalPayment = (report.cash_sum + report.zelle_sum + report.cc_sum + report.venmo_sum).toFixed(2);
        const paymentBreakdown = `Cash: ${report.cash_sum.toFixed(2)}, Zelle: ${report.zelle_sum.toFixed(2)}, CC: ${report.cc_sum.toFixed(2)}, Venmo: ${report.venmo_sum.toFixed(2)}`;

        document.getElementById('report-summary-info').innerHTML = `
            <p><strong>Job number:</strong> ${report.job_number}</p>
            <p><strong>Total labor cost:</strong> ${report.total_labor_cost.toFixed(2)}</p>
            <p><strong>Total payments:</strong> ${totalPayment} (${paymentBreakdown})</p>
            <p><strong>Heavy:</strong> ${report.heavy_sum.toFixed(2)}</p>
            <p><strong>Tips:</strong> ${report.tips_sum.toFixed(2)}</p>
            <p><strong>Gas:</strong> ${report.gas_sum.toFixed(2)}</p>
            <p><strong>Дохід компанії (Heavy):</strong> ${companyHeavy.toFixed(2)}</p>
        `;

        const entriesTableBody = document.querySelector('#report-entries-table tbody');
        entriesTableBody.innerHTML = '';

        entries.forEach(entry => {
            const row = document.createElement('tr');
            const workerName = entry.worker_name;
            const workerPhone = entry.phone_number || 'Not specified';
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

        const editBtn = document.getElementById('edit-detailed-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                window.location.href = `edit-report.html?id=${reportId}`;
            };
        }

        const approveBtn = document.getElementById('approve-detailed-btn');
        if (approveBtn) {
            approveBtn.onclick = async () => {
                try {
                    const logResponse = await fetch(`${backendUrl}/logs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'APPROVE_REPORT',
                            details: `approved №${report.job_number}`
                        })
                    });
                    if (!logResponse.ok) {
                        const errorData = await logResponse.json();
                        throw new Error(`HTTP error! Status: ${logResponse.status}, Message: ${errorData.error || 'Unknown error'}`);
                    }
                    console.log('Log saved for APPROVE_REPORT');
                } catch (error) {
                    console.error('Approving log error:', error);
                    alert('Log saving error. Brakedown sucsessfully approved');
                }

                const existingEntries = JSON.parse(localStorage.getItem('approvedSalaryEntries') || '[]');
                const existingJobNumbers = new Set(existingEntries.map(e => e.job_number));

                if (existingJobNumbers.has(report.job_number)) {
                    alert(`Brakedown for job ${report.job_number} was already approved.`);
                    return;
                }

                const existingIds = new Set(existingEntries.map(e => e.id));
                const newEntries = reportData.entries
                    .filter(entry => entry.worker_name && !existingIds.has(entry.id))
                    .map(entry => ({
                        ...entry,
                        job_number: report.job_number,
                        sum: (entry.hours_worked * entry.actual_hourly_rate + (entry.heavy ? perHeavy : 0) + (entry.tips ? perTips : 0) + (entry.gas ? perGas : 0)).toFixed(2)
                    }));

                const updatedEntries = newEntries.concat(existingEntries);
                localStorage.setItem('approvedSalaryEntries', JSON.stringify(updatedEntries));
                window.open('salary-form.html', '_blank');
            };
        }
    } catch (error) {
        console.error('Loading brakedown datails error:', error);
    }
}

async function deleteReport(event) {
    const reportId = event.target.dataset.id;
    const confirmDelete = confirm('Are you shure you want to delete brakedown?');

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
                alert(`Brakedown deleting error: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Brakedown deleting error:', error);
            alert('Brakedown deleting error.');
        }
    }
}