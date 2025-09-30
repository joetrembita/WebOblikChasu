const API = (window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE_URL) || "";

// === helpers ===
const num = (v) => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toMoney = (v) => num(v).toFixed(2);
const toInt = (v) => parseInt(v, 10) || 0;
const bool = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';


function formatDate(dateString) {
    console.log('Inscomig dateString:', dateString);
    if (!dateString) {
        return 'Invalid data';
    }
    const normalizedDateString = String(dateString);
    let date = new Date(normalizedDateString);
    if (normalizedDateString.endsWith('Z')) {
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
        const response = await fetch(`${API}/final-reports`);
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${report.job_number}</td>
            <td>${toInt(report.worker_count)}</td>
            <td>${toMoney(report.total_cost)}</td>
            <td>${toMoney(report.cash_sum)}</td>
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
        const response = await fetch(`${API}/final-reports/${reportId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const reportData = await response.json();
        console.log('Brakedown data:', reportData);
        
       const report = reportData.report;
        const entries = reportData.entries.filter(e => e.worker_name);

        // суми
        const cashSum   = num(report.cash_sum);
        const zelleSum  = num(report.zelle_sum);
        const ccSum     = num(report.cc_sum);
        const venmoSum  = num(report.venmo_sum);
        const heavySum  = num(report.heavy_sum);
        const tipsSum   = num(report.tips_sum);
        const gasSum    = num(report.gas_sum);
        const totalLaborCost = num(report.total_labor_cost);

        const heavyWorkersCount = entries.filter(e => bool(e.heavy)).length;
        const tipsWorkersCount  = entries.filter(e => bool(e.tips)).length;
        const gasWorkersCount   = entries.filter(e => bool(e.gas)).length;

        const companyHeavy = heavyWorkersCount > 0 ? heavySum / (heavyWorkersCount + 1) : 0;
        const perTips      = tipsWorkersCount  > 0 ? tipsSum  / tipsWorkersCount       : 0;
        const perGas       = gasWorkersCount   > 0 ? gasSum   / gasWorkersCount        : 0;

        const totalPayment = cashSum + zelleSum + ccSum + venmoSum;
        const paymentBreakdown = `Cash: ${toMoney(cashSum)}, Zelle: ${toMoney(zelleSum)}, CC: ${toMoney(ccSum)}, Venmo: ${toMoney(venmoSum)}`;

        document.getElementById('report-summary-info').innerHTML = `
        <p><strong>Job number:</strong> ${report.job_number}</p>
        <p><strong>Total labor cost:</strong> ${toMoney(totalLaborCost)}</p>
        <p><strong>Total payments:</strong> ${toMoney(totalPayment)} (${paymentBreakdown})</p>
        <p><strong>Heavy:</strong> ${toMoney(heavySum)}</p>
        <p><strong>Tips:</strong> ${toMoney(tipsSum)}</p>
        <p><strong>Gas:</strong> ${toMoney(gasSum)}</p>
        <p><strong>Дохід компанії (Heavy):</strong> ${toMoney(companyHeavy)}</p>
        `;

        const entriesTableBody = document.querySelector('#report-entries-table tbody');
        entriesTableBody.innerHTML = '';

        entries.forEach(entry => {
        const hoursWorked = num(entry.hours_worked);
        const hourlyRate  = num(entry.actual_hourly_rate);
        const basePay     = hoursWorked * hourlyRate;

        const heavyValue  = bool(entry.heavy) ? companyHeavy : 0;
        const tipsValue   = bool(entry.tips)  ? perTips      : 0;
        const gasValue    = bool(entry.gas)   ? perGas       : 0;

        const totalEntryCost = basePay + heavyValue + tipsValue + gasValue;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.worker_name}</td>
            <td>${entry.phone_number || 'Not specified'}</td>
            <td>${hoursWorked}</td>
            <td>${hourlyRate}</td>
            <td>${toMoney(heavyValue)}</td>
            <td>${toMoney(tipsValue)}</td>
            <td>${toMoney(gasValue)}</td>
            <td>${toMoney(totalEntryCost)}</td>
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
                    const logResponse = await fetch(`${API}/logs`, {
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
                        sum: (Number(entry.hours_worked ?? 0) * Number(entry.actual_hourly_rate ?? 0) + (entry.heavy ? perHeavy : 0) + (entry.tips ? perTips : 0) + (entry.gas ? perGas : 0)).toFixed(2)
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
            const response = await fetch(`${API}/final-reports/${reportId}`, {
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