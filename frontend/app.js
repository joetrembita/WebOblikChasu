const backendUrl = 'http://localhost:3000';
let tempReports = [];

document.addEventListener('DOMContentLoaded', () => {
    loadWorkers();
    renderTempReports();
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
            option.textContent = "Немає працівників";
            workerSelect.appendChild(option);
        }

        workerSelect.addEventListener('change', (event) => {
            const selectedWorker = workers.find(w => w.id == event.target.value);
            if (selectedWorker) {
                document.getElementById('rate-input').value = selectedWorker.default_hourly_rate;
            }
        });
    } catch (error) {
        console.error('Помилка при завантаженні працівників:', error);
    }
}

function renderTempReports() {
    const tempTableBody = document.querySelector('#temp-reports-table tbody');
    tempTableBody.innerHTML = '';

    if (tempReports.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8">Поки що немає доданих робітників.</td>';
        tempTableBody.appendChild(tr);
        return;
    }

    tempReports.forEach((report, index) => {
        const workerName = document.querySelector(`#worker-select option[value="${report.worker_id}"]`)?.textContent || 'Невідомий працівник';
        const totalPay = (report.hours_worked * report.actual_hourly_rate);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${workerName}</td>
            <td>${report.hours_worked}</td>
            <td>${report.actual_hourly_rate}</td>
            <td>${report.heavy ? '✅' : '❌'}</td>
            <td>${report.tips ? '✅' : '❌'}</td>
            <td>${report.gas ? '✅' : '❌'}</td>
            <td>${totalPay.toFixed(2)}</td>
            <td><button class="remove-temp-report-btn" data-index="${index}">Видалити</button></td>
        `;
        tempTableBody.appendChild(tr);
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
    const formData = {
        worker_id: form.worker_id.value,
        hours_worked: parseFloat(form.hours_worked.value),
        actual_hourly_rate: parseFloat(form.actual_hourly_rate.value),
        heavy: form.querySelector('input[name="heavy"]').checked,
        tips: form.querySelector('input[name="tips"]').checked,
        gas: form.querySelector('input[name="gas"]').checked
    };

    if (!formData.worker_id || !formData.hours_worked || !formData.actual_hourly_rate) {
        alert('Будь ласка, заповніть усі обов’язкові поля.');
        return;
    }

    tempReports.push(formData);
    renderTempReports();
    form.reset();
    loadWorkers();
});

document.getElementById('final-report-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (tempReports.length === 0) {
        alert('Будь ласка, додайте хоча б одного працівника до звіту.');
        return;
    }

    const jobNumber = document.getElementById('job-number-input').value;
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
            additional_cost: 0 // Set to 0 to ignore additional_cost
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

    // Розрахунок total_labor_cost
    const totalLaborCost = updatedReports.reduce((sum, report) => {
        return sum + (report.hours_worked * report.actual_hourly_rate) + report.additional_cost;
    }, 0) + (heavyWorkersCount > 0 ? heavyPerWorker : 0);

    const finalReport = {
        job_number: jobNumber,
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
            alert('Звіт успішно сформовано!');
            tempReports = [];
            renderTempReports();
            window.location.href = 'reports.html';
        } else {
            const errorData = await response.json();
            alert(`Помилка при формуванні звіту: ${errorData.error || 'Невідома помилка'}`);
        }
    } catch (error) {
        console.error('Помилка при відправці звіту:', error);
        alert('Помилка при відправці звіту.');
    }
});