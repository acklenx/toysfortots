// Display logged-in username in footer
(function() {
  async function displayUser() {
    const userDisplay = document.getElementById('logged-in-user');
    if (!userDisplay) return;

    if (window.auth && window.auth.currentUser) {
      const user = window.auth.currentUser;
      let username = user.displayName || user.email || 'Unknown';

      // Strip @domain.com from email if present
      if (username.includes('@')) {
        username = username.split('@')[0];
      }

      // Check authorization using Cloud Function
      if (window.functions) {
        try {
          const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js');
          const checkAuth = httpsCallable(window.functions, 'isAuthorizedVolunteerV2');
          const result = await checkAuth();
          const isAuthorized = result.data.isAuthorized;

          // Add asterisk if not authorized (for debugging)
          const suffix = isAuthorized ? '' : '*';
          userDisplay.textContent = `${username}${suffix}`;
        } catch (err) {
          // If authorization check fails, just show username without suffix
          userDisplay.textContent = username;
        }
      } else {
        // Functions not available, just show username
        userDisplay.textContent = username;
      }

      userDisplay.style.display = 'block';
    } else {
      userDisplay.style.display = 'none';
    }
  }

  // Wait for auth and db to be ready
  let retryCount = 0;
  const maxRetries = 20; // 10 seconds total (500ms * 20)

  function initDisplayUser() {
    if (window.auth && window.db) {
      window.auth.onAuthStateChanged(() => {
        displayUser();
      });
      // Also call immediately in case user is already signed in
      if (window.auth.currentUser) {
        displayUser();
      }
    } else if (retryCount < maxRetries) {
      // Retry if auth/db isn't loaded yet
      retryCount++;
      setTimeout(initDisplayUser, 500);
    }
  }

  initDisplayUser();
})();
