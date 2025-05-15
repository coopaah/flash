document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const searchBar = document.getElementById('search-bar');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const suggestionsContainer = document.getElementById('suggestions');
  const siteInfoTooltip = document.getElementById('site-info-tooltip');
  const resultsContainer = document.getElementById('results');
  const aiSummary = document.getElementById('ai-summary');
  const navTabs = document.querySelector('.nav-tabs');
  const header = document.getElementById('header');
  
  // State management
  let currentView = 'search'; // 'search' or 'images'
  let currentResults = null;
  let currentImageResults = null;
  let conversationHistory = [];
  let followupCount = 0;
  const MAX_FOLLOWUPS = 3;
  let hasLoadedImages = false;
  let hasLoadedSearch = false;
  
  // Helper function for delayed execution
  const debounce = (func, timeout = 150) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  };
  
  // Initialize thinking toggle
  if (document.getElementById('thinking-toggle') && document.getElementById('thinking-container')) {
    const thinkingToggle = document.getElementById('thinking-toggle');
    const thinkingContainer = document.getElementById('thinking-container');
    
    thinkingToggle.addEventListener('click', () => {
      thinkingContainer.classList.toggle('visible');
      thinkingToggle.classList.toggle('open');
      
      const spanEl = thinkingToggle.querySelector('span');
      if (spanEl) {
        spanEl.textContent = thinkingContainer.classList.contains('visible') 
          ? 'Hide thinking' : 'Show thinking';
      }
    });
  }
  
  // Fetch search suggestions
  const fetchSuggestions = async (query) => {
    try {
      const response = await fetch(`https://api.coopr.tech:8148/flashtag-ai/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };
  
  // Update suggestions UI
  const updateSuggestions = debounce(async () => {
    if (!searchBar || !suggestionsContainer) return;
    
    const query = searchBar.value.trim();
    if (!query) {
      suggestionsContainer.innerHTML = '';
      return;
    }
    
    const suggestions = await fetchSuggestions(query);
    suggestionsContainer.innerHTML = '';
    
    if (suggestions.length > 0) {
      suggestions.forEach(suggestion => {
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'suggestion';
        suggestionEl.textContent = suggestion;
        suggestionEl.addEventListener('click', () => {
          searchBar.value = suggestion;
          suggestionsContainer.innerHTML = '';
          performSearch(suggestion);
        });
        suggestionsContainer.appendChild(suggestionEl);
      });
    }
  }, 300);
  
  // Process URL query parameters
  const checkUrlQueryParam = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('f');

if (window.location.pathname === '/' && urlParams.get('f')) {
  performSearch(decodeURIComponent(urlParams.get('f')));
  return;
}
    
    if (queryParam) {
      const query = decodeURIComponent(queryParam);
      if (searchBar) searchBar.value = query;
      
      if (window.location.pathname === '/') {
        window.location.href = `/results?f=${encodeURIComponent(query)}`;
        return;
      }
      
      const flashtagMatch = query.match(/^(.*?)\s+!(\w+)$/);
      if (flashtagMatch) {
        handleFlashTagSearch(query, flashtagMatch);
      } else if (window.location.pathname === '/results') {
        const viewParam = urlParams.get('view');
        if (viewParam === 'images') {
          updateTabSelection('images');
          if (!hasLoadedImages) fetchAndDisplayImages(query);
        } else {
          updateTabSelection('search');
          if (!hasLoadedSearch) performSearch(query);
        }
      }
    }
  };
  
  // Main search function
  const performSearch = (query, view = currentView) => {
    if (suggestionsContainer) suggestionsContainer.innerHTML = '';
    
    const flashtagMatch = query.match(/^(.*?)\s+!(\w+)$/);
    if (flashtagMatch) return handleFlashTagSearch(query, flashtagMatch);
    
    if (view === 'images') {
      fetchAndDisplayImages(query);
      updateTabSelection('images');
      return;
    }
    
    conversationHistory = [];
    followupCount = 0;
    
    if (window.location.pathname !== '/results') {
      window.location.href = `/results?f=${encodeURIComponent(query)}`;
    } else {
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.set('f', query);
      window.history.pushState({}, '', `${window.location.pathname}?${queryParams}`);
      
      if (!hasLoadedSearch) {
        handleStreamingResponse(query);
        hasLoadedSearch = true;
      }
    }
  };
  
  // Handle Flashtag searches
  const handleFlashTagSearch = (query, match) => {
    const searchTerm = match[1].trim();
    const tag = match[2].toLowerCase();
    
    fetch('/sites.json')
      .then(response => response.json())
      .then(sites => {
        const site = sites.find(s => s.alias && s.alias.includes(tag));
        
        if (site) {
          window.location.href = `${site.site}${encodeURIComponent(searchTerm)}`;
        } else {
          const cleanQuery = query.replace(/\s+!\w+$/, '');
          performSearch(cleanQuery);
        }
      })
      .catch(error => {
        console.error('Error loading sites:', error);
        const cleanQuery = query.replace(/\s+!\w+$/, '');
        performSearch(cleanQuery);
      });
  };
  
  // Parse markdown in AI responses
  const parseMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<span class="highlight">$1</span>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/\n/g, '<br>');
  };
  
  // Animate words in the response
  const animateWords = (element, newWords) => {
    if (!newWords || newWords.length === 0) return;
    
    const container = document.createElement('span');
    container.className = 'animated-word-container';
    
    newWords.forEach((word, index) => {
      const wordSpan = document.createElement('span');
      wordSpan.innerHTML = word + ' ';
      wordSpan.className = 'animated-word';
      wordSpan.style.opacity = '0';
      wordSpan.style.transition = `opacity 0.2s ease ${index * 0.05}s`;
      container.appendChild(wordSpan);
      
      setTimeout(() => { wordSpan.style.opacity = '1'; }, 10);
    });
    
    element.appendChild(container);
  };
  
  // Generate thought for thinking section
  const generateThought = (text, query, existingThoughts) => {
    const thoughts = [
      `Analyzing information about "${query}"...`,
      `Identifying key points related to "${query}"...`,
      `Finding supporting evidence for this claim...`,
      `Cross-referencing data from multiple sources...`,
      `Evaluating the credibility of this information...`,
      `Considering alternative perspectives on this topic...`,
      `Looking for recent updates or changes to this information...`,
      `Summarizing the main findings about "${query}"...`,
      `Checking if this addresses the user's search intent...`,
      `Determining the most relevant details to include...`
    ];
    
    const availableThoughts = thoughts.filter(t => !existingThoughts.includes(t));
    return availableThoughts.length > 0 
      ? availableThoughts[Math.floor(Math.random() * availableThoughts.length)] 
      : thoughts[Math.floor(Math.random() * thoughts.length)];
  };
  
  // Display search results
  const displayResults = (results, isCurated = false, curatedFor = '') => {
    if (!results || !resultsContainer) return;
    
    if (!isCurated && !followupCount) currentResults = results;
    
    results.forEach(result => {
      if (!result || !result.result_url) return;
      
      const resultElement = document.createElement('div');
      resultElement.className = isCurated ? 'result curated' : 'result';
      resultElement.style.opacity = '0';
      resultElement.style.transform = 'translateY(20px)';
      
      let faviconHtml = '';
      try {
        const domain = new URL(result.result_url).hostname;
        faviconHtml = `<img class="favicon-img" src="/favicon/${encodeURIComponent(domain)}" alt="" />`;
      } catch (err) {
        console.error('Error parsing URL for favicon:', err);
      }
      
      const curatedBadge = isCurated ? 
        `<div class="curated-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          AI Curated
        </div>` : '';
      
      const curatedForHtml = isCurated && curatedFor ? 
        `<div class="curated-for">For search: "${curatedFor}"</div>` : '';
      
      resultElement.innerHTML = `
        ${curatedBadge}
        <a href="${result.result_url}" class="result-title" target="_blank">${result.result_title || 'Untitled'}</a>
        <div class="result-url">${faviconHtml}${new URL(result.result_url).hostname}</div>
        <div class="result-description">${result.result_og_description || ''}</div>
        ${curatedForHtml}
      `;
      
      resultsContainer.appendChild(resultElement);
      
      setTimeout(() => {
        resultElement.style.opacity = '1';
        resultElement.style.transform = 'translateY(0)';
      }, 50);
    });
  };
  
  // Handle AI streaming response
  window.handleStreamingResponse = async (query, isFollowup = false) => {
    const resultsElement = document.getElementById('results');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    const thinkingContent = document.getElementById('thinking-content');
    const refinedQueries = document.getElementById('refined-queries');
    const queryChips = document.getElementById('query-chips');
    
    if (!resultsElement || !aiSummaryContent) return;
    
    // Clear existing content
    aiSummaryContent.innerHTML = '';
    if (thinkingContent) thinkingContent.innerHTML = '';
    if (queryChips && !isFollowup) queryChips.innerHTML = '';
    if (refinedQueries && !isFollowup) refinedQueries.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'flex';
    
    if (!isFollowup) resultsElement.innerHTML = '';
    
    try {
      let historyParam = '';
      if (isFollowup && conversationHistory.length > 0) {
        historyParam = `&history=${encodeURIComponent(JSON.stringify(conversationHistory))}`;
      }
      
      const eventSource = new EventSource(
        `https://api.coopr.tech:8148/flashtag-ai/stream?f=${encodeURIComponent(query)}${historyParam}${isFollowup ? '&followup=true' : ''}`
      );
      
      // Stream processing state
      let summaryText = '';
      let hasResults = false;
      let newWords = [];
      let animationQueue = [];
      let isProcessing = false;
      let allThoughts = [];
      let curatedResults = [];
      
      if (isFollowup) {
        const followupQuestion = document.createElement('div');
        followupQuestion.className = 'followup-question';
        followupQuestion.innerHTML = `
          <div class="user-query">
            <strong>You:</strong> ${query}
          </div>
        `;
        aiSummaryContent.appendChild(followupQuestion);
        
        const followupResponse = document.createElement('div');
        followupResponse.className = 'followup-response';
        followupResponse.innerHTML = `<strong>AI:</strong> `;
        aiSummaryContent.appendChild(followupResponse);
        
        aiSummaryContent = followupResponse;
      }
      
      // Process animation queue
      const processAnimationQueue = async () => {
        if (isProcessing || animationQueue.length === 0) return;
        
        isProcessing = true;
        const batch = animationQueue.shift();
        
        const formattedWords = parseMarkdown(batch.join(' ')).split(' ');
        animateWords(aiSummaryContent, formattedWords);
        
        if (thinkingContent) {
          const thought = generateThought(batch.join(' '), query, allThoughts);
          allThoughts.push(thought);
          
          const thoughtEl = document.createElement('div');
          thoughtEl.className = 'thinking-item';
          thoughtEl.textContent = thought;
          thinkingContent.appendChild(thoughtEl);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
        isProcessing = false;
        processAnimationQueue();
      };
      
      // Event handlers for SSE
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'results':
              if (data.results && data.results.length > 0 && !isFollowup) {
                displayResults(data.results);
                hasResults = true;
              }
              break;
              
            case 'content':
              if (data.text) {
                summaryText += data.text;
                newWords = data.text.trim().split(' ').filter(w => w);
                
                if (newWords.length > 0) {
                  animationQueue.push(newWords);
                  if (!isProcessing) processAnimationQueue();
                }
              }
              break;
              
            case 'curated_queries':
              if (!isFollowup && data.queries && data.queries.length > 0 && queryChips && refinedQueries) {
                queryChips.innerHTML = '';
                
                data.queries.forEach(refinedQuery => {
                  const chipEl = document.createElement('div');
                  chipEl.className = 'query-chip';
                  chipEl.textContent = refinedQuery;
                  chipEl.addEventListener('click', () => {
                    performSearch(refinedQuery);
                  });
                  queryChips.appendChild(chipEl);
                });
                
                refinedQueries.style.display = 'block';
              }
              break;
              
            case 'curated_results':
              if (!isFollowup && data.results && data.results.length > 0) {
                curatedResults.push({
                  query: data.query,
                  results: data.results
                });
              }
              break;
              
            case 'end':
              if (loadingElement) loadingElement.style.display = 'none';
              
              if (!isFollowup) {
                setTimeout(() => {
                  if (curatedResults.length > 0) {
                    const curatedHeader = document.createElement('h3');
                    curatedHeader.className = 'curated-results-header';
                    curatedHeader.textContent = 'AI Curated Results';
                    resultsElement.appendChild(curatedHeader);
                    
                    curatedResults.forEach(set => {
                      displayResults(set.results, true, set.query);
                    });
                  }
                }, 1000);
              }
              
              if (summaryText) {
                conversationHistory.push({
                  role: 'user',
                  content: query
                });
                conversationHistory.push({
                  role: 'assistant',
                  content: summaryText
                });
                
                if (isFollowup) {
                  followupCount++;
                  if (followupCount < MAX_FOLLOWUPS) setTimeout(addFollowupUI, 500);
                } else {
                  setTimeout(addFollowupUI, 500);
                }
              }
              
              eventSource.close();
              break;
              
            case 'error':
              if (loadingElement) loadingElement.style.display = 'none';
              if (aiSummaryContent) {
                aiSummaryContent.innerHTML = `<p>Sorry, I encountered an issue: ${data.message || 'Unknown error'}</p>`;
              }
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error processing stream data:', error);
        }
      };
      
      // Error handling
      eventSource.onerror = () => {
        console.error('EventSource failed');
        if (loadingElement) loadingElement.style.display = 'none';
        eventSource.close();
        
        if (aiSummaryContent && !aiSummaryContent.textContent) {
          aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
        }
      };
      
    } catch (error) {
      console.error('Error:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      if (aiSummaryContent) {
        aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
      }
    }
  };
  
  // Add followup UI
  const addFollowupUI = () => {
    const aiSummaryContent = document.getElementById('ai-summary-content');
    if (!aiSummaryContent) return;
    
    let followupContainer = document.querySelector('.followup-container');
    
    if (!followupContainer) {
      followupContainer = document.createElement('div');
      followupContainer.className = 'followup-container';
      
      followupContainer.innerHTML = `
        <div class="followup-header">Ask a follow-up question (${followupCount}/${MAX_FOLLOWUPS})</div>
        <div class="followup-input-container">
          <input type="text" class="followup-input" placeholder="Ask a follow-up question..." />
          <button class="followup-button">Ask</button>
        </div>
      `;
      
      aiSummaryContent.appendChild(followupContainer);
      
      const followupInput = followupContainer.querySelector('.followup-input');
      const followupButton = followupContainer.querySelector('.followup-button');
      
      followupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const followupQuery = followupInput.value.trim();
          if (followupQuery) {
            handleFollowup(followupQuery);
            followupInput.value = '';
            followupContainer.remove();
          }
        }
      });
      
      followupButton.addEventListener('click', () => {
        const followupQuery = followupInput.value.trim();
        if (followupQuery) {
          handleFollowup(followupQuery);
          followupInput.value = '';
          followupContainer.remove();
        }
      });
      
      setTimeout(() => followupInput.focus(), 100);
    } else {
      const header = followupContainer.querySelector('.followup-header');
      if (header) {
        header.textContent = `Ask a follow-up question (${followupCount}/${MAX_FOLLOWUPS})`;
      }
    }
  };
  
  // Handle followup question
  const handleFollowup = (query) => {
    handleStreamingResponse(query, true);
  };
  
  // Fetch and display images
  const fetchAndDisplayImages = async (query) => {
    const resultsElement = document.getElementById('results');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    
    if (!resultsElement) return;
    
    if (currentImageResults && currentImageResults.query === query) {
      if (loadingElement) loadingElement.style.display = 'none';
      if (aiSummaryElement) aiSummaryElement.style.display = 'none';
      
      resultsElement.innerHTML = '';
      displayImageResults(currentImageResults.images);
      return;
    }
    
    resultsElement.innerHTML = '';
    if (loadingElement) loadingElement.style.display = 'flex';
    if (aiSummaryElement) aiSummaryElement.style.display = 'none';
    
    try {
      const response = await fetch(`https://api.coopr.tech:8148/flashtag-ai/images?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (loadingElement) loadingElement.style.display = 'none';
      
      currentImageResults = {
        query: query,
        images: data.images || []
      };
      
      displayImageResults(data.images || []);
      
    } catch (error) {
      console.error('Error fetching images:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      resultsElement.innerHTML = '<div class="error-message">Sorry, there was an error loading images. Please try again later.</div>';
    }
  };
  
  // Display image results
  const displayImageResults = (images) => {
    const resultsElement = document.getElementById('results');
    if (!resultsElement) return;
    
    if (images && images.length > 0) {
      const imageGrid = document.createElement('div');
      imageGrid.className = 'image-grid';
      
      const attribution = document.createElement('div');
      attribution.className = 'google-attribution';
      attribution.innerHTML = 'Images powered by Google Images';
      resultsElement.appendChild(attribution);
      
      // Preload first batch of images
      const initialBatchSize = 12;
      images.slice(0, initialBatchSize).forEach(image => {
        const img = new Image();
        img.src = image.thumbnail;
      });
      
      images.forEach((image, index) => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.style.animationDelay = `${index * 50}ms`;
        
        imageCard.innerHTML = `
          <div class="image-container">
            <img src="${image.thumbnail}" alt="${image.title}" loading="${index < initialBatchSize ? 'eager' : 'lazy'}" />
          </div>
          <div class="image-title">${image.title}</div>
          <div class="image-source">${image.source}</div>
        `;
        
        imageCard.addEventListener('click', () => {
          openImageModal(image.url, image.title);
        });
        
        imageGrid.appendChild(imageCard);
      });
      
      resultsElement.appendChild(imageGrid);
      
      // Preload remaining images after initial batch
      setTimeout(() => {
        images.slice(initialBatchSize).forEach(image => {
          const img = new Image();
          img.src = image.thumbnail;
        });
      }, 1000);
    } else {
      resultsElement.innerHTML = '<div class="no-results">No images found for your query. Try a different search term.</div>';
    }
  };
  
  // Image modal functionality
  const openImageModal = (imageUrl, title) => {
    const modal = document.getElementById('image-modal') || createImageModal();
    const modalImg = modal.querySelector('.modal-image');
    const modalTitle = modal.querySelector('.modal-title');
    
    modalImg.src = imageUrl;
    modalTitle.textContent = title;
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  };
  
  // Create image modal if it doesn't exist
  const createImageModal = () => {
    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-modal">&times;</span>
        <img class="modal-image" src="" alt="" />
        <div class="modal-title"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', closeImageModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeImageModal();
    });
    
    return modal;
  };
  
  // Close image modal
  const closeImageModal = () => {
    const modal = document.getElementById('image-modal');
    if (modal) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    }
  };
  
  // Update tab selection
  const updateTabSelection = (tab) => {
    if (!navTabs) return;
    
    const tabs = navTabs.querySelectorAll('.nav-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    
    if (currentView !== tab) {
      currentView = tab;
      
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-content`);
      });
      
      const aiSummaryElement = document.getElementById('ai-summary');
      
      if (tab === 'images') {
        if (aiSummaryElement) aiSummaryElement.style.display = 'none';
        
        const query = searchBar?.value.trim() || new URLSearchParams(window.location.search).get('f');
        if (query) {
          if (currentImageResults && currentImageResults.query === query) {
            const resultsElement = document.getElementById('results');
            if (resultsElement) {
              resultsElement.innerHTML = '';
              displayImageResults(currentImageResults.images);
            }
          } else {
            fetchAndDisplayImages(query);
          }
        }
      } else {
        if (aiSummaryElement) aiSummaryElement.style.display = 'block';
        
        if (currentResults) {
          const resultsElement = document.getElementById('results');
          if (resultsElement) {
            resultsElement.innerHTML = '';
            displayResults(currentResults);
          }
        }
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('view', tab);
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);
    }
  };
  
  // Initialize navigation tabs
  const initNavTabs = () => {
    if (!navTabs) {
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'nav-tabs';
      tabsContainer.innerHTML = `
        <div class="nav-tab active" data-tab="search">Search</div>
        <div class="nav-tab" data-tab="images">Images</div>
      `;
      
      const header = document.querySelector('.header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(tabsContainer, header.nextSibling);
      }
      
      tabsContainer.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => updateTabSelection(tab.dataset.tab));
      });
    } else {
      navTabs.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => updateTabSelection(tab.dataset.tab));
      });
    }
  };
  
  // Check for Flashtag pattern
  const checkForFlashTag = () => {
    if (!searchBar || !siteInfoTooltip) return;
    
    const query = searchBar.value.trim();
    if (!query) {
      siteInfoTooltip.classList.remove('visible');
      return;
    }
    
    const match = query.match(/^(.*?)\s+!(\w+)$/);
    if (!match) {
      siteInfoTooltip.classList.remove('visible');
      return;
    }

    const tag = match[2].toLowerCase();
    
    fetch('/sites.json')
      .then(response => response.json())
      .then(sites => {
        const site = sites.find(s => s.alias && s.alias.includes(tag));
        
        if (site && site.title) {
          let favicon = '';
          try {
            const domain = new URL(site.site).hostname;
            favicon = `<img class="favicon-img" src="/favicon/${encodeURIComponent(domain)}" alt="" />`;
          } catch (err) {
            console.error('Error parsing URL for favicon:', err);
          }
          
          siteInfoTooltip.innerHTML = `${favicon}Searching on ${site.title}`;
          siteInfoTooltip.classList.add('visible');
        } else {
          siteInfoTooltip.classList.remove('visible');
        }
      })
      .catch(error => {
        console.error('Error loading sites:', error);
        siteInfoTooltip.classList.remove('visible');
      });
  };
  
  // Add styles for followup components
  const addStyles = () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* Followup styles */
      .followup-container {
        margin-top: 20px;
        padding: 15px;
        background-color: #f9fafb;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
      }
      
      .followup-header {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      
      .followup-input-container {
        display: flex;
      }
      
      .followup-input {
        flex: 1;
        padding: 10px 15px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
      }
      
      .followup-button {
        margin-left: 10px;
        padding: 10px 15px;
        background-color: #6366f1;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .followup-button:hover {
        background-color: #4f46e5;
      }
      
      .followup-question {
        margin-top: 20px;
        padding: 10px 15px;
        background-color: #f3f4f6;
        border-radius: 8px;
        border-left: 3px solid #6366f1;
      }
      
      .followup-response {
        margin-top: 10px;
      }
      
      .user-query {
        color: #374151;
      }
      
      /* Image styles */
      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      
      .google-attribution {
        text-align: right;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      
      .image-card {
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        background-color: white;
        animation: fadeInUp 0.5s forwards;
        opacity: 0;
      }
      
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .image-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }
      
      .image-container {
        height: 150px;
        overflow: hidden;
      }
      
      .image-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .image-card:hover .image-container img {
        transform: scale(1.05);
      }
      
      .image-title {
        padding: 10px;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .image-source {
        padding: 0 10px 10px;
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .image-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      
      .image-modal.visible {
        opacity: 1;
        pointer-events: auto;
      }
      
      .modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .modal-image {
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
      }
      
      .modal-title {
        margin-top: 15px;
        color: white;
        text-align: center;
        max-width: 100%;
        font-size: 16px;
      }
      
      .close-modal {
        position: absolute;
        top: -30px;
        right: -30px;
        font-size: 30px;
        color: white;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.5);
      }
    `;
    document.head.appendChild(styleElement);
  };
  
  // Event listeners setup
  const setupEventListeners = () => {
    // Search bar events
    if (searchBar) {
      searchBar.addEventListener('input', () => {
        updateSuggestions();
        checkForFlashTag();
      });
      
      searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = searchBar.value.trim();
          if (query) performSearch(query, currentView);
        }
      });
      
      // Hide suggestions when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (e.target !== searchBar && suggestionsContainer) {
          suggestionsContainer.innerHTML = '';
        }
      });
    }
    
    // Search icon events
    if (searchIcon) {
      searchIcon.addEventListener('click', () => {
        const query = searchBar.value.trim();
        if (query) performSearch(query, currentView);
      });
    }
    
    // AI icon events
    if (aiIcon) {
      aiIcon.addEventListener('click', () => {
        const query = searchBar.value.trim();
        if (query) performSearch(query, 'search');
      });
    }
    
    // Keyboard navigation for image modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('image-modal');
        if (modal && modal.classList.contains('visible')) {
          closeImageModal();
        }
      }
    });
  };
  
  // Register service worker
  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    }
  };
  
  // Initialize the page
  const init = () => {
    // Add styles
    addStyles();
    
    // Check URL parameters
    checkUrlQueryParam();
    
    // If we're on the home page and the header is centered
    if (header && header.classList.contains('centered')) {
      if (searchBar) {
        searchBar.addEventListener('focus', () => {
          header.classList.remove('centered');
          header.classList.add('top');
        });
      }
    }
    
    // Initialize navigation tabs
    initNavTabs();
    
    // Set up event listeners
    setupEventListeners();
    
    // Register service worker
    registerServiceWorker();
    
    // If we're on the results page, process query param
    if (window.location.pathname === '/results') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      const viewParam = urlParams.get('view') || 'search';
      const isResearch = urlParams.get('research') === 'true';
      
      if (queryParam) {
        if (searchBar) searchBar.value = decodeURIComponent(queryParam);
        
        currentView = viewParam;
        updateTabSelection(currentView);
        
        if (currentView === 'images') {
          fetchAndDisplayImages(decodeURIComponent(queryParam));
        } else if (!document.referrer.includes('/results') || isResearch) {
          handleStreamingResponse(decodeURIComponent(queryParam));
        }
      }
    }
  };
  
  // Start the application
  init();
});
