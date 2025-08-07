document.addEventListener('DOMContentLoaded', () => {
  const animeListElement = document.getElementById('animeList');
  animeListElement.innerHTML = '<li>Đang tải dữ liệu từ server...</li>';

  const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api/animes'
    : 'https://myanimeranking.onrender.com/api/animes';

  // Load danh sách anime
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

  // Hiện/ẩn form thêm anime
  const showFormBtn = document.getElementById('show-form-btn');
  const formContainer = document.getElementById('form-container');
  
  if (showFormBtn && formContainer) {
    console.log('Đã tìm thấy nút và form container');
    showFormBtn.onclick = function() {
      console.log('Nút được click');
      const isVisible = formContainer.style.display === 'block';
      formContainer.style.display = isVisible ? 'none' : 'block';
      showFormBtn.textContent = isVisible ? '+ Thêm Anime' : '− Đóng Form';
      console.log('Form container display:', formContainer.style.display);
    };
  } else {
    console.error('Không tìm thấy các phần tử:', {
      showFormBtn: showFormBtn ? 'Tìm thấy' : 'Không tìm thấy',
      formContainer: formContainer ? 'Tìm thấy' : 'Không tìm thấy'
    });
  }
});