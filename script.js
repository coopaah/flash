document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const suggestionsContainer = document.getElementById('suggestions');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const siteInfo = document.getElementById('site-info');
  const header = document.getElementById('header');

  // Toast notifications
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Header behavior
  function moveHeaderUp() {
    if (header.classList.contains('centered')) {
      header.classList.remove('centered');
      header.classList.add('top');
    }
  }

  function revertHeader() {
    if (header.classList.contains('top') && !searchBar.value.trim()) {
      header.classList.remove('top');
      header.classList.add('centered');
    }
  }

  searchBar.addEventListener('focus', moveHeaderUp);
  searchBar.addEventListener('input', moveHeaderUp);

  searchBar.addEventListener('blur', () => {
    setTimeout(() => {
      revertHeader();
    }, 100);
  });

  // Search functionality
  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  }

  fetch('/sites.json')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load sites');
      return response.json();
    })
    .then(sites => {
      // Perform search
      const performSearch = (query, useAI = false) => {
        query = query.trim();
        if (!query) {
          showToast('Please enter a search term', 'error');
          return;
        }

        const [searchTerm, alias] = query.split(/ !(.*)/).slice(0, 2);

        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          if (site) {
            window.location.href = `${site.site}${encodeURIComponent(searchTerm)}`;
            return;
          } else {
            showToast(`Flashtag "${alias}" not found`, 'error');
            return;
          }
        }

        if (useAI) {
          window.location.href = `/results?f=${encodeURIComponent(query)}&ai=true`;
        } else {
          window.location.href = `/results?f=${encodeURIComponent(query)}`;
        }
      };

      // Event listeners
      const handleSearch = (useAI = false) => {
        performSearch(searchBar.value, useAI);
      };

      searchBar?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
      });

      searchIcon?.addEventListener('click', () => handleSearch());
      aiIcon?.addEventListener('click', () => handleSearch(true));

      // Suggestions
      const updateSuggestions = debounce(() => {
        const query = searchBar.value;
        if (!query) {
          suggestionsContainer.innerHTML = '';
          return;
        }

        fetch(`https://api.coopr.tech:8148/suggestions?q=${encodeURIComponent(query)}`)
          .then(response => response.json())
          .then(data => {
            suggestionsContainer.innerHTML = data.suggestions
              .map(s => `<div class="suggestion">${s}</div>`)
              .join('');
          })
          .catch(error => {
            console.error('Error fetching suggestions:', error);
          });
      });

      searchBar?.addEventListener('input', updateSuggestions);

      // Flashtag detection
      const checkFlashtag = debounce(() => {
        const query = searchBar.value;
        const [, alias] = query.split(/ !(.*)/);
        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          siteInfo.textContent = site ? `Searching ${site.title}` : '';
          siteInfo.style.display = 'block';
        } else {
          siteInfo.style.display = 'none';
        }
      }, 100);

      searchBar?.addEventListener('input', checkFlashtag);
    })
    .catch(error => {
      console.error('Error loading sites:', error);
      showToast('Failed to load search providers', 'error');
    });
});
