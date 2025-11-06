// Display logged-in username in footer
(function() {
  function displayUser() {
    const userDisplay = document.getElementById('logged-in-user');
    if (!userDisplay) return;

    if (window.auth && window.auth.currentUser) {
      const user = window.auth.currentUser;
      let username = user.displayName || user.email || 'Unknown';

      // Strip @domain.com from email if present
      if (username.includes('@')) {
        username = username.split('@')[0];
      }

      // Check if user is authorized by checking Firestore
      if (window.db) {
        window.db.collection('volunteers').doc(user.uid).get()
          .then(doc => {
            const isAuthorized = doc.exists;
            const suffix = isAuthorized ? '' : '*';
            userDisplay.textContent = `${username}${suffix}`;
            userDisplay.style.display = 'block';
          })
          .catch(err => {
            // If can't check authorization, just show username
            userDisplay.textContent = username;
            userDisplay.style.display = 'block';
          });
      } else {
        // No Firestore access, just show username
        userDisplay.textContent = username;
        userDisplay.style.display = 'block';
      }
    } else {
      userDisplay.style.display = 'none';
    }
  }

  // Wait for auth to be ready
  if (window.auth) {
    window.auth.onAuthStateChanged(() => {
      displayUser();
    });
  } else {
    // Retry if auth isn't loaded yet
    setTimeout(displayUser, 1000);
  }
})();
