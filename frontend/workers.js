const backendUrl = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    loadWorkers();
});

async function loadWorkers() {
    try {
        const response = await fetch(`${backendUrl}/workers`);
        const workers = await response.json();
        const workersTableBody = document.querySelector('#workers-table tbody');

        workersTableBody.innerHTML = '';

        if (workers.length === 0) {
            workersTableBody.innerHTML = '<tr><td colspan="5">Saved movers not found.</td></tr>';
            return;
        }

        workers.forEach(worker => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span class="worker-display name">${worker.name}</span>
                    <input type="text" class="edit-name-input hidden" value="${worker.name}" readonly>
                </td>
                <td>
                    <span class="worker-display rate">${worker.default_hourly_rate}</span>
                    <input type="number" class="edit-rate-input hidden" value="${worker.default_hourly_rate}" readonly>
                </td>
                <td>
                    <span class="worker-display phone">${worker.phone_number || 'Not specified'}</span>
                    <input type="text" class="edit-phone-input hidden" value="${worker.phone_number || ''}" readonly>
                </td>
                <td>
                    <span class="worker-display email">${worker.email || 'Not specified'}</span>
                    <input type="email" class="edit-email-input hidden" value="${worker.email || ''}" readonly>
                </td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${worker.id}">Edit</button>
                    <button class="save-btn hidden" data-id="${worker.id}">Save</button>
                    <button class="cancel-btn hidden" data-id="${worker.id}">Cancel</button>
                    <button class="delete-btn" data-id="${worker.id}">Delete</button>
                </td>
            `;
            workersTableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', toggleEditMode));
        document.querySelectorAll('.save-btn').forEach(btn => btn.addEventListener('click', updateWorker));
        document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', toggleEditMode));
        document.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', deleteWorker));
    } catch (error) {
        console.error('Movers loading error:', error);
    }
}

document.getElementById('add-worker-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.target;
    const formData = {
        name: form.name.value,
        phone_number: form.phone_number.value || null,
        email: form.email.value || null,
        default_hourly_rate: parseFloat(form.default_hourly_rate.value)
    };

    try {
        const response = await fetch(`${backendUrl}/workers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            form.reset();
            loadWorkers();
        } else {
            alert('Mover adding error.');
        }
    } catch (error) {
        console.error('Mover adding error:', error);
    }
});

async function deleteWorker(event) {
    const workerId = event.target.dataset.id;

    if (!confirm('Are you shure you want to delete this mover?')) {
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/workers/${workerId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadWorkers();
        } else {
            alert('Mover deleting error.');
        }
    } catch (error) {
        console.error('Mover deleting error:', error);
    }
}

function toggleEditMode(event) {
    const row = event.target.closest('tr');
    const isEdit = !row.querySelector('.edit-btn').classList.contains('hidden');
    // Всі поля readonly, поки не редагуємо
    row.querySelectorAll('.worker-display').forEach(el => el.classList.toggle('hidden', isEdit));
    row.querySelectorAll('.edit-name-input, .edit-rate-input, .edit-phone-input, .edit-email-input').forEach(el => {
        el.classList.toggle('hidden', !isEdit);
        el.readOnly = !isEdit;
    });
    row.querySelector('.edit-btn').classList.toggle('hidden', isEdit);
    row.querySelector('.save-btn').classList.toggle('hidden', !isEdit);
    row.querySelector('.cancel-btn').classList.toggle('hidden', !isEdit);
    row.querySelector('.delete-btn').classList.toggle('hidden', isEdit);
}

async function updateWorker(event) {
    const workerId = event.target.dataset.id;
    const row = event.target.closest('tr');
    const name = row.querySelector('.edit-name-input').value;
    const rate = row.querySelector('.edit-rate-input').value;
    const phone = row.querySelector('.edit-phone-input').value || null;
    const email = row.querySelector('.edit-email-input').value || null;

    try {
        const response = await fetch(`${backendUrl}/workers/${workerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, default_hourly_rate: parseFloat(rate), phone_number: phone, email })
        });
        
        if (response.ok) {
            loadWorkers();
        } else {
            alert('Mover editing error.');
        }
    } catch (error) {
        console.error('Mover editing error:', error);
    }
}