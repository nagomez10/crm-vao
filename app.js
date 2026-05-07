const isConfigured = Boolean(
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_URL.includes('PEGAR_ACA')
);

const db = isConfigured
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

const state = {
  contacts: [],
  selectedId: null,
  session: null
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

const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutButton = document.getElementById('logout');
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

document.getElementById('seed-demo').addEventListener('click', async () => {
  if (state.contacts.length && !confirm('Esto agregará contactos de ejemplo. ¿Continuar?')) return;

  const demoContacts = [
    {
      name: 'Mariana Perez',
      company: 'Laboratorio Sur',
      email: 'mariana@laboratoriosur.com',
      phone: '5491130961544',
      source: 'Web',
      status: 'nuevo',
      message: 'Necesitamos asesoramiento para ISO/IEC 17025 y calibración de equipos.',
      note: 'Enviar propuesta inicial esta semana.'
    },
    {
      name: 'Diego Alvarez',
      company: 'Industrias Norte',
      email: 'diego@industriasnorte.com',
      phone: '5491167891234',
      source: 'WhatsApp',
      status: 'seguimiento',
      message: 'Consulta por auditoría interna ISO 9001.',
      note: 'Pidió llamada el viernes.'
    }
  ];

  const { error } = await db.from('contacts').insert(demoContacts);
  if (error) {
    alert(error.message);
    return;
  }

  await loadContacts();
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();

  if (!db) {
    loginStatus.textContent = 'Falta configurar Supabase en config.js.';
    return;
  }

  const data = Object.fromEntries(new FormData(loginForm));
  loginStatus.textContent = '';

  const { data: authData, error } = await db.auth.signInWithPassword({
    email: data.email,
    password: data.password
  });

  if (error) {
    loginStatus.textContent = 'No se pudo iniciar sesión. Revisá email y contraseña.';
    return;
  }

  state.session = authData.session;
  document.body.classList.add('is-authenticated');
  loginForm.reset();
  await loadContacts();
});

logoutButton.addEventListener('click', async () => {
  await db.auth.signOut();
  state.session = null;
  state.contacts = [];
  state.selectedId = null;
  document.body.classList.remove('is-authenticated');
});

form.addEventListener('submit', async event => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  const contact = {
    name: data.name.trim(),
    company: data.company.trim(),
    email: data.email.trim(),
    phone: normalizePhone(data.phone),
    source: data.source,
    status: data.status,
    message: data.message.trim(),
    note: data.note.trim()
  };

  const { data: inserted, error } = await db
    .from('contacts')
    .insert(contact)
    .select()
    .single();

  if (error) {
    saveStatus.textContent = `No se pudo guardar: ${error.message}`;
    saveStatus.classList.add('error-text');
    return;
  }

  form.reset();
  saveStatus.textContent = 'Consulta guardada correctamente.';
  saveStatus.classList.remove('error-text');
  state.selectedId = inserted.id;
  await loadContacts();

  setTimeout(() => {
    saveStatus.textContent = '';
    showView('contacts');
  }, 700);
});

search.addEventListener('input', renderContacts);
statusFilter.addEventListener('change', renderContacts);

async function boot() {
  if (!db) {
    loginStatus.textContent = 'Pegá tu SUPABASE_URL y SUPABASE_ANON_KEY en config.js.';
    return;
  }

  const { data } = await db.auth.getSession();
  state.session = data.session;

  if (state.session) {
    document.body.classList.add('is-authenticated');
    await loadContacts();
  }

  db.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    document.body.classList.toggle('is-authenticated', Boolean(session));
    if (session) await loadContacts();
  });
}

async function loadContacts() {
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    alert(`Error cargando contactos: ${error.message}`);
    return;
  }

  state.contacts = data.map(fromDatabase);
  render();
}

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

  document.getElementById('detail-status').addEventListener('change', async event => {
    const { error } = await db
      .from('contacts')
      .update({ status: event.target.value, updated_at: new Date().toISOString() })
      .eq('id', contact.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadContacts();
  });

  document.getElementById('detail-note').addEventListener('change', async event => {
    const { error } = await db
      .from('contacts')
      .update({ note: event.target.value, updated_at: new Date().toISOString() })
      .eq('id', contact.id);

    if (error) alert(error.message);
  });

  document.getElementById('delete-contact').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este contacto?')) return;

    const { error } = await db.from('contacts').delete().eq('id', contact.id);
    if (error) {
      alert(error.message);
      return;
    }

    state.selectedId = null;
    await loadContacts();
  });
}

function fromDatabase(contact) {
  return {
    id: contact.id,
    name: contact.name,
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    source: contact.source,
    status: contact.status,
    message: contact.message,
    note: contact.note,
    createdAt: contact.created_at
  };
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
boot();
