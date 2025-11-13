(function() {
  async function updateFooterUser() {
    const loggedInUser = document.getElementById('logged-in-user');
    if (!loggedInUser) return;

    if (!window.auth || !window.auth.currentUser) {
      loggedInUser.style.visibility = 'hidden';
      return;
    }

    const user = window.auth.currentUser;

    // Hide for anonymous users
    if (user.isAnonymous) {
      loggedInUser.style.visibility = 'hidden';
      return;
    }

    // Get username
    let username = user.displayName || user.email || 'Unknown';
    if (username.includes('@')) {
      username = username.split('@')[0];
    }

    // Check authorization with session caching
    if (window.functions) {
      try {
        // Check session cache first
        const cacheKey = `t4t_auth_${user.uid}`;
        const cachedAuth = sessionStorage.getItem(cacheKey);

        let isAuthorized;
        if (cachedAuth !== null) {
          // Use cached result
          isAuthorized = cachedAuth === 'true';
        } else {
          // No cache - call function and cache result
          const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
          const checkAuth = httpsCallable(window.functions, 'isAuthorizedVolunteerV2');
          const result = await checkAuth();
          isAuthorized = result.data.isAuthorized;

          // Cache for this session
          sessionStorage.setItem(cacheKey, isAuthorized ? 'true' : 'false');
        }

        // Add asterisk if not authorized
        const suffix = isAuthorized ? '' : '*';
        loggedInUser.textContent = `${username}${suffix}`;
      } catch (err) {
        loggedInUser.textContent = username;
      }
    } else {
      loggedInUser.textContent = username;
    }

    loggedInUser.style.visibility = 'visible';
  }

  // Wait for Firebase to initialize
  let retryCount = 0;
  const maxRetries = 20;

  function initFooter() {
    if (window.auth && window.db) {
      window.auth.onAuthStateChanged(() => {
        updateFooterUser();
      });
      // Update immediately if user is already signed in
      if (window.auth.currentUser) {
        updateFooterUser();
      }
    } else if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(initFooter, 500);
    }
  }

  initFooter();
})();
