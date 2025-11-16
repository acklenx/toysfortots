# Website Performance Improvement Plan

Based on an analysis of `public/index.html` and the project structure, here are several opportunities to improve site performance, reduce code redundancy, and enhance maintainability.

## Analysis of `public/index.html`

### Strengths

*   **Asset Minification:** The site correctly uses minified CSS (`style.min.css`), which reduces file size.
*   **Modern Image Formats:** The use of `.webp` for map icons is efficient.
*   **Connection Pre-warming:** `preconnect` and `dns-prefetch` are correctly used to speed up connections to critical third-party domains.
*   **Service Worker:** A service worker is implemented (`sw.js`), enabling advanced caching and potential offline capabilities.
*   **Non-blocking Scripts:** The `loader.min.js` script uses the `defer` attribute to prevent it from blocking page rendering.

### Areas for Improvement

1.  **Large Inline Script:** The primary performance bottleneck is the large `<script type="module">` block directly within `index.html`.
    *   **Impact:** This code, which contains all the core logic for the homepage map, is not effectively cached by browsers compared to external files. It increases the size of the initial HTML document and must be downloaded and parsed on every page visit.

2.  **Unused/Dead Code:** The inline script contains a significant amount of code that is never executed because the `initFirebase()` function call is commented out.
    *   **Impact:** The browser wastes time and resources downloading and parsing unused Firebase imports (`firebase-auth`, `firebase-firestore`) and the `initFirebase` and `loadRealtimeLocations` functions.

3.  **Duplicated Utility Function:** The `escapeHtml` function is defined locally within the inline script.
    *   **Impact:** This is a common utility. If needed on other pages, it would have to be duplicated, violating the Don't Repeat Yourself (DRY) principle and leading to potential maintenance issues.

## Proposed Improvements

### 1. Extract Inline Script to an External File

*   **Action:** Move the entire content of the `<script type="module">` block from `index.html` into a new file: `public/js/home-map.js`.
*   **Replacement:** Replace the inline script in `index.html` with a single line:
    ```html
    <script type="module" src="/js/home-map.js"></script>
    ```
*   **Benefit:** This change will allow the browser to cache the main JavaScript file, significantly speeding up subsequent page loads. It also makes the HTML cleaner and more maintainable.

### 2. Remove Dead Code from the Script

*   **Action:** Once the script is moved to `public/js/home-map.js`, remove the following unused code:
    *   The `import` statements for `firebase-auth` and `firebase-firestore`.
    *   The `initFirebase()` function.
    *   The `loadRealtimeLocations()` function.
*   **Benefit:** This will reduce the script's file size, leading to faster downloads and quicker parsing and execution.

### 3. Centralize the `escapeHtml` Utility Function

*   **Action:**
    1.  Check if an equivalent function already exists in `public/js/utils.js`.
    2.  If not, move the `escapeHtml` function from the inline script to `public/js/utils.js`.
    3.  Export it from `utils.js` and import it into `home-map.js`.
*   **Benefit:** Promotes code reuse, simplifies maintenance, and ensures consistent behavior across the application.
