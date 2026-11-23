const summary = document.querySelector('#summary');
const users = document.querySelector('#users');
const cancel = document.querySelector('#cancel');

function setSummary(state, message) {
  summary.dataset.state = state;
  summary.textContent = message;
}

function readParameters() {
  const params = new URLSearchParams(location.search);
  const ids = (params.get('ids') ?? '1,2,3').split(',');
  const delay = params.get('delay') ?? '0';

  if (ids.length > 5 || ids.some(id => !/^0*[1-9]\d*$/.test(id))) {
    throw new Error('Укажите в ids от 1 до 5 положительных целых чисел через запятую.');
  }
  if (!/^\d+$/.test(delay) || Number(delay) > 5000) {
    throw new Error('Укажите в delay целое число от 0 до 5000 мс.');
  }

  return { ids: ids.map(id => id.replace(/^0+/, '')), delay: Number(delay) };
}

async function fetchUser(id, delay, signal) {
  const response = await fetch(`https://dummyjson.com/users/${id}?delay=${delay}`, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

function element(tag, text, className = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function addDetail(details, label, className, value) {
  const row = document.createElement('div');
  const description = document.createElement('dd');
  description.append(element('span', value, className));
  row.append(element('dt', label), description);
  details.append(row);
}

function renderCard(id, state, data) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = id;
  card.dataset.state = state;
  card.append(element('p', `ID ${id}`, 'card-id'));

  if (state === 'success') {
    const email = element('a', data.email, 'email');
    email.href = `mailto:${data.email}`;
    const details = document.createElement('dl');
    details.className = 'details';
    addDetail(details, 'Город', 'city', data.address.city);
    addDetail(details, 'Компания', 'company', data.company.name);
    card.append(element('h2', `${data.firstName} ${data.lastName}`, 'name'), email, details);
  } else {
    card.append(element('span', data, 'message'));
  }
  return card;
}

async function loadUsers() {
  let params;
  try {
    params = readParameters();
  } catch (error) {
    setSummary('error', error.message);
    cancel.disabled = true;
    users.setAttribute('aria-busy', 'false');
    return;
  }

  const { ids, delay } = params;
  const controller = new AbortController();
  cancel.addEventListener('click', () => {
    controller.abort();
    cancel.disabled = true;
  }, { once: true });

  users.append(...ids.map(id => renderCard(id, 'loading', 'Загрузка...')));
  const requests = ids.map(id => fetchUser(id, delay, controller.signal));
  const results = await Promise.allSettled(requests);

  let loaded = 0;
  let errors = 0;
  let aborted = 0;
  const cards = results.map((result, index) => {
    const id = ids[index];
    if (result.status === 'fulfilled') {
      loaded++;
      return renderCard(id, 'success', result.value);
    }
    if (result.reason?.name === 'AbortError') {
      aborted++;
      return renderCard(id, 'aborted', 'Запрос отменён');
    }
    errors++;
    const message = result.reason instanceof TypeError
      ? 'Ошибка сети'
      : result.reason?.message || 'Ошибка запроса';
    return renderCard(id, 'error', message);
  });

  users.replaceChildren(...cards);
  users.setAttribute('aria-busy', 'false');
  cancel.disabled = true;

  const message = `Загружено: ${loaded}; ошибок: ${errors}`;
  if (aborted) {
    setSummary('aborted', `Запросы отменены. ${message}; отменено: ${aborted}`);
  } else if (loaded === ids.length) {
    setSummary('success', message);
  } else {
    setSummary(loaded ? 'partial' : 'error', message);
  }
}

loadUsers();
