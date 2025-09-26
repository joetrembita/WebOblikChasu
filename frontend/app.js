const backendUrl = 'http://localhost:3000';
let tempReports = [];

document.addEventListener('DOMContentLoaded', () => {
    loadWorkers();
    renderTempReports();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('report-date-input').value = now.toISOString().slice(0,16);
});

async function loadWorkers() {
    try {
        const response = await fetch(`${backendUrl}/workers`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const workers = await response.json();
        const workerSelect = document.getElementById('worker-select');
        
        workerSelect.innerHTML = '';
        
        if (workers.length > 0) {
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = worker.name;
                workerSelect.appendChild(option);
            });
            document.getElementById('rate-input').value = workers[0].default_hourly_rate;
        } else {
            const option = document.createElement('option');
            option.textContent = "No movers";
            workerSelect.appendChild(option);
        }

        workerSelect.addEventListener('change', (event) => {
            const selectedWorker = workers.find(w => w.id == event.target.value);
            if (selectedWorker) {
                document.getElementById('rate-input').value = selectedWorker.default_hourly_rate;
            }
        });
    } catch (error) {
        console.error('Error occured during movers loading:', error);
    }
}

function renderTempReports() {
    const tempTableBody = document.querySelector('#temp-reports-table tbody');
    tempTableBody.innerHTML = '';

    if (tempReports.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8">There is no added movers</td>';
        tempTableBody.appendChild(tr);
        return;
    }

    const heavySum = parseFloat(document.getElementById('heavy-input-final')?.value) || 0;
    const tipsSum = parseFloat(document.getElementById('tips-input-final')?.value) || 0;
    const gasSum = parseFloat(document.getElementById('gas-input-final')?.value) || 0;
    const heavyWorkersCount = tempReports.filter(r => r.heavy).length;
    const tipsWorkersCount = tempReports.filter(r => r.tips).length;
    const gasWorkersCount = tempReports.filter(r => r.gas).length;
    const heavyPerWorker = heavyWorkersCount > 0 ? heavySum / (heavyWorkersCount + 1) : 0;
    const tipsPerWorker = tipsWorkersCount > 0 ? tipsSum / tipsWorkersCount : 0;
    const gasPerWorker = gasWorkersCount > 0 ? gasSum / gasWorkersCount : 0;


    tempReports.forEach((report, index) => {
    const workerName = document.querySelector(`#worker-select option[value=\"${report.worker_id}\"]`)?.textContent || 'Unknown mover';
    let additional_cost = 0;
    if (report.heavy) additional_cost += heavyPerWorker;
    if (report.tips) additional_cost += tipsPerWorker;
    if (report.gas) additional_cost += gasPerWorker;
    const totalPay = (report.hours_worked * report.actual_hourly_rate) + additional_cost;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${workerName}</td>
        <td><input type="number" min="0" step="0.25" value="${report.hours_worked}" class="edit-hours" data-index="${index}"></td>
        <td><input type="number" min="0" step="0.01" value="${report.actual_hourly_rate}" class="edit-rate" data-index="${index}"></td>
        <td><input type="checkbox" class="edit-heavy" data-index="${index}" ${report.heavy ? 'checked' : ''}></td>
        <td><input type="checkbox" class="edit-tips" data-index="${index}" ${report.tips ? 'checked' : ''}></td>
        <td><input type="checkbox" class="edit-gas" data-index="${index}" ${report.gas ? 'checked' : ''}></td>
        <td class="sum-cell">${totalPay.toFixed(2)}</td>
        <td><button class="remove-temp-report-btn" data-index="${index}">Delete</button></td>
    `;
    tempTableBody.appendChild(tr);
});
    // (зайва дужка видалена)

    // Обробники редагування
    tempTableBody.querySelectorAll('.edit-hours').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            tempReports[idx].hours_worked = parseFloat(e.target.value);
            renderTempReports();
        });
    });
    tempTableBody.querySelectorAll('.edit-rate').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            tempReports[idx].actual_hourly_rate = parseFloat(e.target.value);
            renderTempReports();
        });
    });
    tempTableBody.querySelectorAll('.edit-heavy').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            tempReports[idx].heavy = e.target.checked;
            renderTempReports();
        });
    });
    tempTableBody.querySelectorAll('.edit-tips').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            tempReports[idx].tips = e.target.checked;
            renderTempReports();
        });
    });
    tempTableBody.querySelectorAll('.edit-gas').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.index;
            tempReports[idx].gas = e.target.checked;
            renderTempReports();
        });
    });
    

    document.querySelectorAll('.remove-temp-report-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const index = event.target.dataset.index;
            tempReports.splice(index, 1);
            renderTempReports();
        });
    });
}

document.getElementById('add-to-report-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const form = document.getElementById('add-to-report-form');
    const workerId = form.worker_id.value;
    if (!workerId) {
        alert('Choose mover.');
        return;
    }
    // Додаємо працівника з дефолтними значеннями
    tempReports.push({
        worker_id: workerId,
        hours_worked: 0,
        actual_hourly_rate: 0,
        heavy: false,
        tips: false,
        gas: false
    });
    renderTempReports();
    form.reset();
    loadWorkers();
});

document.getElementById('final-report-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (tempReports.length === 0) {
        alert('Please, add at least one mover to brakedown.');
        return;
    }

    const jobNumber = document.getElementById('job-number-input').value;
    const reportDate = document.getElementById('report-date-input').value;

    if (!reportDate) {
        alert('Please, set date of work.');
        return;
    }
    const parsedDate = new Date(reportDate);
    if (isNaN(parsedDate)) {
        alert('Invalid date format. Please set correct date.');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/final-reports`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const reports = await response.json();
        if (reports.some(report => report.job_number === jobNumber)) {
            alert(`Brakedown for job #'${jobNumber}' already exist.`);
            return;
        }
    } catch (error) {
        console.error('Job number check error:', error);
        alert('Job number check error.');
        return;
    }

    const cashSum = parseFloat(document.getElementById('cash-input').value) || 0;
    const zelleSum = parseFloat(document.getElementById('zelle-input').value) || 0;
    const ccSum = parseFloat(document.getElementById('cc-input').value) || 0;
    const venmoSum = parseFloat(document.getElementById('venmo-input').value) || 0;
    const heavySum = parseFloat(document.getElementById('heavy-input-final').value) || 0;
    const tipsSum = parseFloat(document.getElementById('tips-input-final').value) || 0;
    const gasSum = parseFloat(document.getElementById('gas-input-final').value) || 0;

    const heavyWorkersCount = tempReports.filter(report => report.heavy).length;
    const tipsWorkersCount = tempReports.filter(report => report.tips).length;
    const gasWorkersCount = tempReports.filter(report => report.gas).length;
    
    const heavyPerWorker = heavyWorkersCount > 0 ? heavySum / (heavyWorkersCount + 1) : 0;
    const tipsPerWorker = tipsWorkersCount > 0 ? tipsSum / tipsWorkersCount : 0;
    const gasPerWorker = gasWorkersCount > 0 ? gasSum / gasWorkersCount : 0;

    const updatedReports = tempReports.map(report => {
        const newReport = { 
            ...report,
            additional_cost: 0
        };
        if (newReport.heavy) {
            newReport.additional_cost += heavyPerWorker;
        }
        if (newReport.tips) {
            newReport.additional_cost += tipsPerWorker;
        }
        if (newReport.gas) {
            newReport.additional_cost += gasPerWorker;
        }
        return newReport;
    });

    const totalLaborCost = updatedReports.reduce((sum, report) => {
        return sum + (report.hours_worked * report.actual_hourly_rate) + report.additional_cost;
    }, 0) + (heavyWorkersCount > 0 ? heavyPerWorker : 0);

    const finalReport = {
        job_number: jobNumber,
        report_date: reportDate,
        cash_sum: cashSum,
        zelle_sum: zelleSum,
        cc_sum: ccSum,
        venmo_sum: venmoSum,
        heavy_sum: heavySum,
        tips_sum: tipsSum,
        gas_sum: gasSum,
        total_labor_cost: totalLaborCost,
        reports: updatedReports
    };

    try {
        const response = await fetch(`${backendUrl}/final-reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(finalReport)
        });

        if (response.ok) {
            alert('Brakedown sucsessfully saved!');
            tempReports = [];
            renderTempReports();
            window.location.href = 'reports.html';
        } else {
            const errorData = await response.json();
            alert(`Brakedown saving error: ${errorData.error || 'unknown error'}`);
        }
    } catch (error) {
        console.error('Brakedown sending error:', error);
        alert('Brakedown sending error.');
    }
});