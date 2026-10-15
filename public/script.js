document.addEventListener('DOMContentLoaded', () => {
  // GitHub Pages hosts only the frontend; Vercel and npm start also serve the API.
  const apiUrl = window.location.hostname.endsWith('.github.io')
    ? 'https://my-anime-ranking-lime.vercel.app/api/animes'
    : '/api/animes';

  const root = document.documentElement;
  const animeListElement = document.getElementById('animeList');
  const listStatus = document.getElementById('list-status');
  const searchInput = document.getElementById('search-input');
  const genreFilter = document.getElementById('genre-filter');
  const sortSelect = document.getElementById('sort-select');
  const themeToggle = document.getElementById('theme-toggle');
  const showFormBtn = document.getElementById('show-form-btn');
  const formContainer = document.getElementById('form-container');
  const addAnimeForm = document.getElementById('add-anime-form');
  const formMessage = document.getElementById('form-message');

  let animes = [];

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  const splitGenres = (genre) => String(genre || '').split(/[,/|]/).map((g) => g.trim()).filter(Boolean);

  // Theme
  const syncThemeIcon = () => {
    themeToggle.textContent = root.classList.contains('dark-theme') ? '☀️' : '🌙';
  };
  themeToggle.addEventListener('click', () => {
    const dark = root.classList.toggle('dark-theme');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    syncThemeIcon();
  });
  syncThemeIcon();

  // Rendering
  const setStatus = (text) => {
    listStatus.textContent = text;
    listStatus.hidden = !text;
  };

  const renderSkeleton = () => {
    animeListElement.innerHTML = Array.from({ length: 6 }, () => '<li class="anime-item skeleton"></li>').join('');
  };

  const renderStats = () => {
    const ratings = animes.map((a) => Number(a.rating)).filter((r) => !Number.isNaN(r));
    document.getElementById('stat-count').textContent = animes.length;
    document.getElementById('stat-avg').textContent = ratings.length
      ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
      : '–';
    document.getElementById('stat-top').textContent = ratings.length ? Math.max(...ratings).toFixed(1) : '–';
  };

  const renderGenreOptions = () => {
    const current = genreFilter.value;
    const genres = [...new Set(animes.flatMap((a) => splitGenres(a.genre)))].sort((a, b) => a.localeCompare(b));
    genreFilter.innerHTML = '<option value="">Tất cả thể loại</option>'
      + genres.map((g) => `<option value="${escapeHTML(g)}">${escapeHTML(g)}</option>`).join('');
    if (genres.includes(current)) genreFilter.value = current;
  };

  const renderList = () => {
    const rankByAnime = new Map(
      [...animes].sort((a, b) => Number(b.rating) - Number(a.rating)).map((a, i) => [a, i + 1])
    );
    const query = searchInput.value.trim().toLowerCase();
    const genre = genreFilter.value;
    const sorters = {
      'rating-desc': (a, b) => Number(b.rating) - Number(a.rating),
      'rating-asc': (a, b) => Number(a.rating) - Number(b.rating),
      'title-asc': (a, b) => String(a.title).localeCompare(String(b.title)),
    };

    const visible = animes
      .filter((a) => !query || String(a.title).toLowerCase().includes(query))
      .filter((a) => !genre || splitGenres(a.genre).includes(genre))
      .sort(sorters[sortSelect.value]);

    if (!animes.length) {
      animeListElement.innerHTML = '';
      setStatus('Chưa có dữ liệu anime trong database.');
      return;
    }
    if (!visible.length) {
      animeListElement.innerHTML = '';
      setStatus('Không tìm thấy anime phù hợp.');
      return;
    }
    setStatus('');

    animeListElement.innerHTML = visible.map((anime) => {
      const rank = rankByAnime.get(anime);
      const rankClass = rank <= 3 ? ` rank-${rank}` : '';
      const rating = Number(anime.rating);
      const chips = splitGenres(anime.genre).map((g) => `<span class="chip">${escapeHTML(g)}</span>`).join('');
      return `
        <li class="anime-item${rankClass}">
          <div class="anime-poster">
            <img class="anime-img" src="${escapeHTML(anime.imgURL)}" alt="${escapeHTML(anime.title)}" loading="lazy" />
            <span class="rank-badge">#${rank}</span>
            <span class="rating-badge">⭐ ${Number.isNaN(rating) ? escapeHTML(anime.rating) : rating.toFixed(1)}</span>
          </div>
          <div class="anime-details">
            <h2 class="anime-title">${escapeHTML(anime.title)}</h2>
            <div class="chips">${chips}</div>
            <p class="anime-description">${escapeHTML(anime.description)}</p>
          </div>
        </li>`;
    }).join('');

    animeListElement.querySelectorAll('.anime-img').forEach((img) => {
      img.addEventListener('error', () => img.closest('.anime-poster').classList.add('no-image'), { once: true });
    });
  };

  const loadAnimes = async () => {
    renderSkeleton();
    setStatus('');
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      animes = await response.json();
      renderStats();
      renderGenreOptions();
      renderList();
    } catch (error) {
      console.error('Error fetching anime data:', error);
      animeListElement.innerHTML = '';
      setStatus('Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại sau.');
    }
  };

  searchInput.addEventListener('input', renderList);
  genreFilter.addEventListener('change', renderList);
  sortSelect.addEventListener('change', renderList);

  // Modal
  const openForm = () => {
    formContainer.hidden = false;
    document.body.classList.add('modal-open');
    formMessage.textContent = '';
    addAnimeForm.querySelector('input').focus();
  };
  const closeForm = () => {
    formContainer.hidden = true;
    document.body.classList.remove('modal-open');
    showFormBtn.focus();
  };
  showFormBtn.addEventListener('click', openForm);
  formContainer.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeForm));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !formContainer.hidden) closeForm();
  });

  addAnimeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.className = '';
    formMessage.textContent = '';
    const submitBtn = addAnimeForm.querySelector('button[type="submit"]');
    const formData = new FormData(addAnimeForm);
    const animeData = {
      title: formData.get('title'),
      rating: formData.get('rating'),
      genre: formData.get('genre'),
      description: formData.get('description'),
      imgURL: formData.get('imgURL'),
    };
    submitBtn.disabled = true;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(animeData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Lỗi khi thêm anime');
      formMessage.className = 'success';
      formMessage.textContent = 'Thêm anime thành công!';
      addAnimeForm.reset();
      await loadAnimes();
      setTimeout(closeForm, 700);
    } catch (err) {
      formMessage.className = 'error';
      formMessage.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadAnimes();
});
