const apps = [
  {
    id: 'taxplus-dfe',
    name: 'TaxPlus DFE STG',
    url: 'https://taxplus-dfe-stg.invent.app.br/',
    appId: 'taxplus-dfe'
  },
  {
    id: 'taxplus-dfe-eventos',
    name: 'TaxPlus DFE Eventos STG',
    url: 'https://taxplus-dfe-eventos-stg.invent.app.br/',
    appId: 'taxplus-dfe-eventos'
  }
];

const CHECK_INTERVAL_MS = 30000;
const cardsContainer = document.getElementById('cards');

function createCard(app) {
  const article = document.createElement('article');
  article.className = 'card';
  article.innerHTML = `
    <h2>${app.name}</h2>
    <div class="row">
      <span class="label">Status</span>
      <span id="status-${app.id}" class="status">Verificando...</span>
    </div>
    <div class="row">
      <span class="label">URL</span>
      <a href="${app.url}" target="_blank" rel="noreferrer">Acessar</a>
    </div>
  `;

  cardsContainer.appendChild(article);
  return {
    cardElement: article,
    statusElement: document.getElementById(`status-${app.id}`)
  };
}

const appViews = apps.map((app) => ({
  ...app,
  ...createCard(app)
}));

function setStatus(app, text, mode) {
  app.statusElement.textContent = text;
  app.statusElement.className = `status ${mode === 'ok' ? 'status-ok' : 'status-error'}`;
  app.cardElement.className = `card card-${mode}`;
}

async function checkStatus(app) {
  try {
    const response = await fetch(`/api/check?appId=${encodeURIComponent(app.appId)}`, {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) {
      setStatus(app, `Erro API ${response.status}`, 'error');
      return;
    }

    const data = await response.json();
    if (data.status === 'ok') {
      setStatus(app, data.label || 'Ativo', 'ok');
      return;
    }

    if (data.status === 'error') {
      setStatus(app, data.label || 'Erro', 'error');
      return;
    }

    setStatus(app, 'Resposta inválida', 'error');
  } catch (_) {
    setStatus(app, 'Falha de conexão local', 'error');
  }
}

function checkAllStatuses() {
  if (!navigator.onLine) {
    appViews.forEach((app) => {
      app.statusElement.textContent = 'Sem internet';
      app.statusElement.className = 'status';
      app.cardElement.className = 'card card-offline';
    });
    return;
  }

  appViews.forEach((app) => {
    checkStatus(app);
  });
}

checkAllStatuses();
setInterval(checkAllStatuses, CHECK_INTERVAL_MS);
window.addEventListener('online', checkAllStatuses);
window.addEventListener('offline', checkAllStatuses);
