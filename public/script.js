document.addEventListener('DOMContentLoaded', () => {
  const animeListElement = document.getElementById('animeList');
  animeListElement.innerHTML = '<li>Đang tải dữ liệu từ server...</li>';

  // Use a placeholder for the production API URL.
  // When deployed, this should be the URL of your backend server.
  // ...existing code...


const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/animes'
  : 'https://myanimeranking.onrender.com/api/animes';
  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((animes) => {
      if (animes.length === 0) {
        animeListElement.innerHTML = '<li>Chưa có dữ liệu anime trong database.</li>';
        return;
      }

      const animeHTML = animes
        .map(
          (anime) => `
        <li class="anime-item">
          <div class="anime-details">
            <img class="anime-img" src="${anime.imgURL || ''}" alt="${anime.title}" style="max-width:120px;max-height:170px;object-fit:cover;margin-bottom:8px;"/>
            <h2 class="anime-title">${anime.title}</h2>
            <p class="anime-info"><strong>Điểm:</strong> ${anime.rating} ⭐</p>
            <p class="anime-info"><strong>Thể loại:</strong> ${anime.genre}</p>
            <p class="anime-description">${anime.description}</p>
          </div>
        </li>
      `
        )
        .join('');
      animeListElement.innerHTML = animeHTML;
    })
    .catch((error) => {
      console.error('Error fetching anime data:', error);
      animeListElement.innerHTML = '<li>Có lỗi xảy ra khi tải dữ liệu. Vui lòng kiểm tra console.</li>';
    });

  // Form thêm anime mới
  const addAnimeForm = document.getElementById('add-anime-form');
  const formMessage = document.getElementById('form-message');
  if (addAnimeForm) {
    addAnimeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      formMessage.textContent = '';
      const formData = new FormData(addAnimeForm);
      const animeData = {
        username: formData.get('username'),
        password: formData.get('password'),
        title: formData.get('title'),
        rating: formData.get('rating'),
        genre: formData.get('genre'),
        description: formData.get('description'),
        imgURL: formData.get('imgURL'),
      };
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(animeData),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Lỗi khi thêm anime');
        formMessage.style.color = '#0f0';
        formMessage.textContent = 'Thêm anime thành công!';
        addAnimeForm.reset();
        // Reload danh sách anime
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        formMessage.style.color = '#d9534f';
        formMessage.textContent = err.message;
      }
    });
  }

  // Login logic
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');
  const showFormBtn = document.getElementById('show-form-btn');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value.trim();
      if (username === 'a123' && password === 'a123') {
        loginMessage.style.color = '#0f0';
        loginMessage.textContent = 'Đăng nhập thành công!';
        setTimeout(() => {
          loginForm.style.display = 'none';
          showFormBtn.style.display = 'block';
        }, 500);
      } else {
        loginMessage.style.color = '#d9534f';
        loginMessage.textContent = 'Sai tài khoản hoặc mật khẩu!';
      }
    });
  }

  // Hiện/ẩn form thêm anime
  if (showFormBtn && addAnimeForm) {
    showFormBtn.addEventListener('click', () => {
      if (addAnimeForm.style.display === 'none') {
        addAnimeForm.style.display = 'flex';
        showFormBtn.style.display = 'none';
      }
    });
    addAnimeForm.addEventListener('submit', () => {
      showFormBtn.style.display = 'block';
      addAnimeForm.style.display = 'none';
    });
  }
});