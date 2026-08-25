const analyzeBtn = document.getElementById('analyzeBtn');
const saveEditedBriefBtn = document.getElementById('saveEditedBriefBtn');
const briefOutput = document.getElementById('briefOutput');
const currentMeta = document.getElementById('currentMeta');
const briefList = document.getElementById('briefList');
const auditLog = document.getElementById('auditLog');
const refreshBtn = document.getElementById('refreshBtn');
const resetBriefsBtn = document.getElementById('resetBriefsBtn');
const resetAuditBtn = document.getElementById('resetAuditBtn');
const clientRequestList = document.getElementById('clientRequestList');
const selectionWarning = document.getElementById('selectionWarning');

const clientRequests = [
  {
    id: 'client-1',
    clientName: 'Abdulrahman Hamed',
    company: 'Prototype',
    email: 'abdulrahman2002hamed@gmail.com',
    projectIdea: 'We want to build an AI assistant for our real estate company that can answer customer questions, recommend properties, and connect with our CRM.',
    editable: false,
    note: ''
  },
  {
    id: 'client-2',
    clientName: 'test',
    company: 'test',
    email: 'test@gmail.com',
    projectIdea: 'Edit this test project idea before analysis.',
    editable: true,
    note: 'Editable test request for Elchai team trial'
  }
];

let selectedClientId = null;
let currentBriefId = null;

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function updateCurrentMeta(brief) {
  currentMeta.innerHTML = `
    Saved Brief ID: <strong>${escapeHtml(brief.id)}</strong><br/>
    Created: <strong>${formatDate(brief.createdAt)}</strong><br/>
    Modified: <strong>${formatDate(brief.updatedAt || brief.createdAt)}</strong><br/>
    Reviewer Status: <strong>${escapeHtml(brief.reviewerStatus)}</strong><br/>
    Model: <strong>${escapeHtml(brief.model)}</strong>
  `;
}

function renderClientRequests() {
  clientRequestList.innerHTML = clientRequests.map((client, index) => {
    const isSelected = selectedClientId === client.id;
    const isEditableTrial = Boolean(client.editable);
    const readonlyAttr = isEditableTrial ? '' : 'readonly';
    const testBadge = isEditableTrial ? '<span class="test-badge">Editable test request</span>' : '';
    const editNote = isEditableTrial
      ? '<p class="edit-note">This sample request is editable for Elchai team testing. Modify the fields, select this request, then analyze it from the AI section.</p>'
      : '';

    return `
      <article class="client-card ${isSelected ? 'selected' : ''} ${isEditableTrial ? 'testing-card' : ''}" data-client-id="${escapeHtml(client.id)}">
        <button class="client-summary" type="button" data-client-id="${escapeHtml(client.id)}" aria-expanded="${isSelected}">
          <div>
            <span class="client-count">Client ${index + 1}</span>
            ${testBadge}
            <strong>${escapeHtml(client.company)}</strong>
            <small>${escapeHtml(client.clientName)} • ${escapeHtml(client.email)}</small>
          </div>
          <span class="arrow">${isSelected ? '▲' : '▼'}</span>
        </button>

        <div class="client-details ${isSelected ? 'open' : ''}">
          ${editNote}

          <label>
            Client Name
            <input data-field="clientName" value="${escapeHtml(client.clientName)}" ${readonlyAttr} />
          </label>

          <label>
            Company
            <input data-field="company" value="${escapeHtml(client.company)}" ${readonlyAttr} />
          </label>

          <label>
            Email
            <input data-field="email" value="${escapeHtml(client.email)}" ${readonlyAttr} />
          </label>

          <label>
            Project Idea
            <textarea data-field="projectIdea" rows="5" ${readonlyAttr}>${escapeHtml(client.projectIdea)}</textarea>
          </label>
        </div>
      </article>
    `;
  }).join('');
}

clientRequestList.addEventListener('click', (event) => {
  const button = event.target.closest('.client-summary');
  if (!button) return;

  const clientId = button.dataset.clientId;
  selectedClientId = selectedClientId === clientId ? null : clientId;
  selectionWarning.classList.add('hidden');
  renderClientRequests();
});

clientRequestList.addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  const clientCard = event.target.closest('.client-card');
  if (!field || !clientCard) return;

  const client = clientRequests.find(item => item.id === clientCard.dataset.clientId);
  if (!client || !client.editable) return;

  client[field] = event.target.value;
});

analyzeBtn.addEventListener('click', async () => {
  const selectedClient = clientRequests.find(client => client.id === selectedClientId);

  if (!selectedClient) {
    selectionWarning.classList.remove('hidden');
    currentMeta.innerHTML = '<span class="error">No client request selected.</span>';
    briefOutput.value = 'Pick one client request from the Connected Clients section before running the AI analysis.';
    return;
  }

  selectionWarning.classList.add('hidden');
  analyzeBtn.disabled = true;
  saveEditedBriefBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  briefOutput.value = `Calling the OpenRouter API for ${selectedClient.company} and saving the generated brief...`;
  currentMeta.textContent = 'Processing selected request...';

  try {
    const { brief } = await api('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(selectedClient)
    });

    currentBriefId = brief.id;
    saveEditedBriefBtn.disabled = false;
    updateCurrentMeta(brief);
    briefOutput.value = brief.generatedBrief;
    await refreshData();
  } catch (err) {
    currentBriefId = null;
    saveEditedBriefBtn.disabled = true;
    currentMeta.innerHTML = '<span class="error">Generation failed</span>';
    briefOutput.value = err.message;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Selected Request';
  }
});

async function saveEditedBrief() {
  if (!currentBriefId) {
    selectionWarning.classList.remove('hidden');
    selectionWarning.textContent = 'Generate a brief before saving edits.';
    return;
  }

  const editedBrief = briefOutput.value.trim();
  if (editedBrief.length < 20) {
    selectionWarning.classList.remove('hidden');
    selectionWarning.textContent = 'Edited brief is too short to save.';
    return;
  }

  selectionWarning.classList.add('hidden');
  saveEditedBriefBtn.disabled = true;
  saveEditedBriefBtn.textContent = 'Saving...';

  try {
    const { brief } = await api(`/api/briefs/${currentBriefId}/content`, {
      method: 'PATCH',
      body: JSON.stringify({
        generatedBrief: editedBrief,
        reviewerName: 'Elchai Reviewer'
      })
    });

    updateCurrentMeta(brief);
    briefOutput.value = brief.generatedBrief;
    await refreshData();
  } catch (err) {
    selectionWarning.classList.remove('hidden');
    selectionWarning.textContent = err.message;
  } finally {
    saveEditedBriefBtn.disabled = false;
    saveEditedBriefBtn.textContent = 'Save Edited Brief';
  }
}

async function updateStatus(id, status) {
  const { brief } = await api(`/api/briefs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewerStatus: status, reviewerName: 'Elchai Reviewer' })
  });

  if (currentBriefId === id) updateCurrentMeta(brief);
  await refreshData();
}

function renderBriefs(briefs) {
  if (!briefs.length) {
    briefList.innerHTML = '<p class="hint">No saved briefs yet.</p>';
    return;
  }

  briefList.innerHTML = briefs.map(brief => {
    const projectPreview = brief.input.projectIdea.length > 180
      ? `${brief.input.projectIdea.slice(0, 180)}...`
      : brief.input.projectIdea;

    return `
      <article class="brief-item">
        <div class="brief-item-header">
          <div>
            <strong>${escapeHtml(brief.input.company || brief.input.clientName || 'Potential Client')}</strong>
            <p>${escapeHtml(projectPreview)}</p>
            <p>
              Created: ${formatDate(brief.createdAt)}<br/>
              Modified: ${formatDate(brief.updatedAt || brief.createdAt)}<br/>
              Status: <strong>${escapeHtml(brief.reviewerStatus)}</strong>
            </p>
          </div>
          <div class="status-row">
            <select id="status-${brief.id}">
              ${['Pending Review', 'In Review', 'Modified', 'Approved', 'Rejected'].map(status =>
                `<option value="${status}" ${brief.reviewerStatus === status ? 'selected' : ''}>${status}</option>`
              ).join('')}
            </select>
            <button type="button" onclick="updateStatus('${brief.id}', document.getElementById('status-${brief.id}').value)">Save Status</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderAudit(entries) {
  if (!entries.length) {
    auditLog.innerHTML = '<p class="hint">No audit activity yet.</p>';
    return;
  }

  auditLog.innerHTML = entries.slice(0, 25).map(entry => `
    <div class="audit-entry">
      <span>${formatDate(entry.timestamp)}</span>
      <strong>${escapeHtml(entry.event)}</strong>
      <span>${escapeHtml(entry.details || '')}</span>
    </div>
  `).join('');
}

async function refreshData() {
  const [{ briefs }, { auditLog: entries }] = await Promise.all([
    api('/api/briefs'),
    api('/api/audit')
  ]);
  renderBriefs(briefs);
  renderAudit(entries);
}

async function resetBriefs() {
  if (!confirm('Reset all saved briefs?')) return;
  await api('/api/briefs', { method: 'DELETE' });
  currentBriefId = null;
  saveEditedBriefBtn.disabled = true;
  currentMeta.textContent = 'No brief generated yet.';
  briefOutput.value = 'Saved briefs were reset. Select a client request, then click Analyze Selected Request.';
  await refreshData();
}

async function resetAuditLog() {
  if (!confirm('Reset the audit log?')) return;
  await api('/api/audit', { method: 'DELETE' });
  await refreshData();
}

refreshBtn.addEventListener('click', refreshData);
saveEditedBriefBtn.addEventListener('click', saveEditedBrief);
resetBriefsBtn.addEventListener('click', resetBriefs);
resetAuditBtn.addEventListener('click', resetAuditLog);
window.updateStatus = updateStatus;

renderClientRequests();
refreshData().catch(err => {
  briefList.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
});
