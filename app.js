const STORAGE_KEY = 'vao-crm-contacts';

const state = {
  contacts: loadContacts(),
  selectedId: null
};

const views = {
  dashboard: document.getElementById('dashboard-view'),
  contacts: document.getElementById('contacts-view'),
  'new-contact': document.getElementById('new-contact-view')
};

const titles = {
  dashboard: 'Panel comercial',
  contacts: 'Contactos',
  'new-contact': 'Nueva consulta'
};

const statusLabels = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  seguimiento: 'En seguimiento',
  presupuesto: 'Presupuesto',
  cerrado: 'Cerrado'
};

const form = document.getElementById('contact-form');
const saveStatus = document.getElementById('save-status');
const search = document.getElementById('search');
const statusFilter = document.getElementById('status-filter');

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    showView(link.dataset.view);
  });
});

document.getElementById('open-new-contact').addEventListener('click', () => {
  showView('new-contact');
});

document.getElementById('seed-demo').addEventListener('click', () => {
  if (state.contacts.length && !confirm('Esto agregará contactos de ejemplo. ¿Continuar?')) return;

  state.contacts = [
    {
      id: crypto.randomUUID(),
      name: 'Mariana Perez',
      company: 'Laboratorio Sur',
      email: 'mariana@laboratoriosur.com',
      phone: '5491130961544',
      source: 'Web',
      status: 'nuevo',
      message: 'Necesitamos asesoramiento para ISO/IEC 17025 y calibración de equipos.',
      note: 'Enviar propuesta inicial esta semana.',
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: 'Diego Alvarez',
      company: 'Industrias Norte',
      email: 'diego@industriasnorte.com',
      phone: '5491167891234',
      source: 'WhatsApp',
      status: 'seguimiento',
      message: 'Consulta por auditoría interna ISO 9001.',
      note: 'Pidió llamada el viernes.',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  saveContacts();
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  const contact = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    company: data.company.trim(),
    email: data.email.trim(),
    phone: normalizePhone(data.phone),
    source: data.source,
    status: data.status,
    message: data.message.trim(),
    note: data.note.trim(),
    createdAt: new Date().toISOString()
  };

  state.contacts.unshift(contact);
  state.selectedId = contact.id;
  saveContacts();
  form.reset();
  saveStatus.textContent = 'Consulta guardada correctamente.';
  render();

  setTimeout(() => {
    saveStatus.textContent = '';
    showView('contacts');
  }, 700);
});

search.addEventListener('input', renderContacts);
statusFilter.addEventListener('change', renderContacts);

function showView(viewName) {
  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle('active', name === viewName);
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  document.getElementById('view-title').textContent = titles[viewName];
  window.location.hash = viewName;
}

function render() {
  renderMetrics();
  renderRecent();
  renderContacts();
}

function renderMetrics() {
  setText('metric-total', state.contacts.length);
  setText('metric-new', countByStatus('nuevo'));
  setText('metric-follow', countByStatus('seguimiento'));
  setText('metric-closed', countByStatus('cerrado'));
}

function renderRecent() {
  const recentList = document.getElementById('recent-list');
  const rows = state.contacts.slice(0, 6).map(contact => `
    <tr>
      <td>${escapeHTML(contact.name)}</td>
      <td>${escapeHTML(contact.phone)}</td>
      <td>${escapeHTML(contact.source)}</td>
      <td><span class="status">${statusLabels[contact.status]}</span></td>
      <td>${formatDate(contact.createdAt)}</td>
    </tr>
  `);

  recentList.innerHTML = rows.length ? rows.join('') : `
    <tr>
      <td colspan="5">Todavía no hay consultas cargadas.</td>
    </tr>
  `;
}

function renderContacts() {
  const list = document.getElementById('contact-list');
  const query = search.value.trim().toLowerCase();
  const status = statusFilter.value;

  const filtered = state.contacts.filter(contact => {
    const haystack = [
      contact.name,
      contact.company,
      contact.email,
      contact.phone,
      contact.source,
      contact.message
    ].join(' ').toLowerCase();

    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = status === 'todos' || contact.status === status;

    return matchesSearch && matchesStatus;
  });

  list.innerHTML = filtered.length ? filtered.map(contact => `
    <button class="contact-card ${contact.id === state.selectedId ? 'active' : ''}" type="button" data-id="${contact.id}">
      <strong>${escapeHTML(contact.name)}</strong>
      <span>${escapeHTML(contact.company || 'Sin empresa')}</span>
      <span>${escapeHTML(contact.phone)}</span>
      <span class="status">${statusLabels[contact.status]}</span>
    </button>
  `).join('') : `
    <div class="empty-state">
      <strong>Sin resultados</strong>
      <span>Probá con otra búsqueda o estado.</span>
    </div>
  `;

  list.querySelectorAll('.contact-card').forEach(card => {
    card.addEventListener('click', () => {
      state.selectedId = card.dataset.id;
      renderContacts();
    });
  });

  renderDetail();
}

function renderDetail() {
  const detail = document.getElementById('contact-detail');
  const contact = state.contacts.find(item => item.id === state.selectedId);

  if (!contact) {
    detail.innerHTML = `
      <div class="empty-state">
        <strong>Seleccioná un contacto</strong>
        <span>Acá vas a ver datos, mensaje, notas y accesos rápidos.</span>
      </div>
    `;
    return;
  }

  detail.innerHTML = `
    <h2>${escapeHTML(contact.name)}</h2>
    <span class="status">${statusLabels[contact.status]}</span>

    <div class="detail-grid">
      <div class="detail-item"><span>Empresa</span>${escapeHTML(contact.company || 'Sin dato')}</div>
      <div class="detail-item"><span>Origen</span>${escapeHTML(contact.source)}</div>
      <div class="detail-item"><span>Email</span>${escapeHTML(contact.email || 'Sin dato')}</div>
      <div class="detail-item"><span>Teléfono</span>${escapeHTML(contact.phone)}</div>
      <div class="detail-item"><span>Fecha</span>${formatDate(contact.createdAt)}</div>
      <div class="detail-item">
        <span>Cambiar estado</span>
        <select id="detail-status">
          ${Object.entries(statusLabels).map(([value, label]) => `
            <option value="${value}" ${value === contact.status ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <div class="detail-actions">
      <a class="primary-button" target="_blank" rel="noopener" href="${whatsAppURL(contact)}">Abrir WhatsApp</a>
      <a class="ghost-button" href="mailto:${encodeURIComponent(contact.email)}">Enviar email</a>
      <button class="danger-button" id="delete-contact" type="button">Eliminar</button>
    </div>

    <h3>Mensaje</h3>
    <p class="message-box">${escapeHTML(contact.message)}</p>

    <h3>Nota interna</h3>
    <textarea id="detail-note" rows="5">${escapeHTML(contact.note || '')}</textarea>
  `;

  document.getElementById('detail-status').addEventListener('change', event => {
    contact.status = event.target.value;
    saveContacts();
    render();
  });

  document.getElementById('detail-note').addEventListener('input', event => {
    contact.note = event.target.value;
    saveContacts();
  });

  document.getElementById('delete-contact').addEventListener('click', () => {
    if (!confirm('¿Eliminar este contacto?')) return;
    state.contacts = state.contacts.filter(item => item.id !== contact.id);
    state.selectedId = null;
    saveContacts();
    render();
  });
}

function loadContacts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveContacts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
}

function countByStatus(status) {
  return state.contacts.filter(contact => contact.status === status).length;
}

function normalizePhone(phone) {
  return phone.replace(/[^\d]/g, '');
}

function whatsAppURL(contact) {
  const message = `Hola ${contact.name}, te escribimos de VAO Consultoría por tu consulta.`;
  return `https://wa.me/${contact.phone}?text=${encodeURIComponent(message)}`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const initialView = location.hash.replace('#', '') || 'dashboard';
showView(views[initialView] ? initialView : 'dashboard');
render();
