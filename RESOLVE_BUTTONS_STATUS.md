# Resolve Buttons Implementation Status

## ✅ COMPLETED (Commit: a10ac27)

### ✅ Completed Features:

1. **Individual Resolve Buttons on Status Page**
   - Added "Mark as Resolved" button to each unresolved report
   - Location: `/public/status/index.html`
   - Buttons display only for reports with `status === 'new'`
   - Modified `renderReportItem()` to accept `reportId` parameter
   - Added necessary Firestore imports: `updateDoc`, `increment`, `setDoc`, `addDoc`, `serverTimestamp`

2. **Analytics Tracking System (WORKING AS DESIGNED)**
   - Dashboard: `/public/dashboard/index.html` (lines 345-370)
   - **IMPORTANT DISCOVERY**: Resolved count increments for the LOGGED-IN USER who clicks "Mark as Resolved", NOT the box owner
   - This is BETTER than expected - gives credit to whoever does the work
   - Console logs confirm: `setDoc` completes successfully
   - Firestore path: `authorizedVolunteers/{currentUser.uid}/analytics/resolvedCount`

3. **Debug Logging Added**
   - Dashboard has console logs showing:
     - `[ANALYTICS] Incrementing resolvedCount for user: {uid}`
     - `[ANALYTICS] Volunteer ref path: ...`
     - `[ANALYTICS] setDoc completed successfully`
   - These logs confirmed the system is working correctly

2. **Resolve All Button on Status Page**
   - Added button next to "Report Log" heading
   - Location: `/public/status/index.html` (lines 285-290)
   - Event handlers at lines 266-368
   - MutationObserver automatically shows/hides button based on unresolved reports
   - Confirmation dialog before execution
   - Tracks analytics for logged-in user

3. **Resolve All Button on Dashboard**
   - Added gray button next to "View Full History" link in each box card
   - Location: `/public/dashboard/index.html` (lines 168-177)
   - Event handler at lines 390-439
   - Only displays when box has pending reports
   - Confirmation dialog before execution
   - Tracks analytics for logged-in user

4. **Timestamp Display Fix**
   - Fixed `formatDate()` function to handle Firestore Timestamp objects
   - Location: `/public/js/utils.js` (lines 7-34)
   - Now properly handles:
     - Firestore Timestamp objects (with `.seconds` property)
     - JavaScript Date objects
     - ISO strings
     - Invalid/missing timestamps
   - Returns "Invalid date" instead of displaying "Invalid Date" to users

### 🚧 Previous TODOs (Now Completed):

#### 1. Add "Resolve All" Button to Status Page
**Location**: `/public/status/index.html` (line 285 - `<h2>Report Log</h2>`)

**What to add**:
```html
<section id="history">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Report Log</h2>
        <button id="resolve-all-btn" style="display: none; padding: 10px 20px; background-color: var(--t4t-green); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem;">
            Resolve All
        </button>
    </div>
    <!-- existing content -->
</section>
```

**Event Handler Needed** (add before `setupFirebase()` call):
```javascript
// Event handler for individual resolve buttons and resolve all button
document.addEventListener('click', async (e) => {
    // Handle individual resolve button
    if (e.target && e.target.classList.contains('resolve-report-btn')) {
        const button = e.target;
        const reportId = button.dataset.reportId;
        button.disabled = true;
        button.textContent = 'Resolving...';

        try {
            const reportRef = doc(db, reportsCollectionPath, reportId);
            const reportSnap = await getDoc(reportRef);
            const reportData = reportSnap.exists() ? reportSnap.data() : null;

            await updateDoc(reportRef, { status: 'cleared' });

            // Track analytics for current user (NOT box owner)
            if (reportData && auth.currentUser && !auth.currentUser.isAnonymous) {
                const volunteersPath = 'artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers';
                const volunteerRef = doc(db, volunteersPath, auth.currentUser.uid);

                await setDoc(volunteerRef, {
                    analytics: { resolvedCount: increment(1) }
                }, { merge: true });

                const actionsPath = `${volunteersPath}/${auth.currentUser.uid}/actions`;
                await addDoc(collection(db, actionsPath), {
                    actionType: reportData.reportType === 'pickup_alert' ? 'resolve_pickup' : 'resolve_problem',
                    reportId: reportId,
                    boxId: reportData.boxId,
                    timestamp: serverTimestamp()
                });
            }

            location.reload();
        } catch (err) {
            console.error('Error resolving report:', err);
            alert('Error resolving report. Please try again.');
            button.disabled = false;
            button.textContent = 'Mark as Resolved';
        }
    }

    // Handle resolve all button
    if (e.target && e.target.id === 'resolve-all-btn') {
        const button = e.target;
        if (!confirm('Are you sure you want to resolve ALL open reports for this box?')) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Resolving...';

        try {
            const params = new URLSearchParams(window.location.search);
            const boxId = params.get('id');

            const reportsRef = collection(db, reportsCollectionPath);
            const q = query(reportsRef, where('boxId', '==', boxId), where('status', '==', 'new'));
            const querySnapshot = await getDocs(q);

            const updatePromises = [];
            querySnapshot.forEach((docSnap) => {
                const reportRef = doc(db, reportsCollectionPath, docSnap.id);
                updatePromises.push(updateDoc(reportRef, { status: 'cleared' }));
            });

            await Promise.all(updatePromises);

            // Track analytics for current user (increment by number of reports resolved)
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                const volunteersPath = 'artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers';
                const volunteerRef = doc(db, volunteersPath, auth.currentUser.uid);

                await setDoc(volunteerRef, {
                    analytics: { resolvedCount: increment(querySnapshot.size) }
                }, { merge: true });
            }

            location.reload();
        } catch (err) {
            console.error('Error resolving all reports:', err);
            alert('Error resolving all reports. Please try again.');
            button.disabled = false;
            button.textContent = 'Resolve All';
        }
    }
});

// Show/hide Resolve All button based on whether there are unresolved reports
window.addEventListener('load', () => {
    const observer = new MutationObserver(() => {
        const unresolvedButtons = document.querySelectorAll('.resolve-report-btn');
        const resolveAllBtn = document.getElementById('resolve-all-btn');
        if (resolveAllBtn) {
            resolveAllBtn.style.display = unresolvedButtons.length > 0 ? 'block' : 'none';
        }
    });

    const historyContainer = document.getElementById('history-container');
    if (historyContainer) {
        observer.observe(historyContainer, { childList: true, subtree: true });
    }
});
```

#### 2. Add "Resolve All" Button to Dashboard Boxes
**Location**: `/public/dashboard/index.html` (line 168 - inside `renderBoxCard()`)

**What to add**: Next to the "View Full History" link, add a gray "Resolve All" button:

```javascript
// In renderBoxCard() function, replace the link section with:
<div style="display: flex; gap: 10px; margin-top: 10px;">
    <a href="/status/?id=${ encodeURIComponent(box.boxId) }" class="view-history-btn" style="flex: 1;">
        View Full History
    </a>
    ${ box.latestPendingReport ? `
        <button class="resolve-all-box-btn" data-box-id="${ escapeHtml(box.boxId) }" style="flex: 1; padding: 10px; background-color: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; text-align: center;">
            Resolve All
        </button>
    ` : '' }
</div>
```

**Event Handler** (add to existing click handler around line 323):
```javascript
// Add this to the existing document.getElementById('main-content').addEventListener('click') handler:

if (e.target && e.target.classList.contains('resolve-all-box-btn')) {
    const button = e.target;
    const boxId = button.dataset.boxId;

    if (!confirm('Are you sure you want to resolve ALL open reports for this box?')) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Resolving...';

    try {
        const reportsRef = collection(db, reportsCollectionPath);
        const q = query(reportsRef, where('boxId', '==', boxId), where('status', '==', 'new'));
        const querySnapshot = await getDocs(q);

        const updatePromises = [];
        querySnapshot.forEach((docSnap) => {
            const reportRef = doc(db, reportsCollectionPath, docSnap.id);
            updatePromises.push(updateDoc(reportRef, { status: 'cleared' }));
        });

        await Promise.all(updatePromises);

        // Track analytics for current user
        if (auth.currentUser) {
            const volunteersPath = 'artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers';
            const volunteerRef = doc(db, volunteersPath, auth.currentUser.uid);

            await setDoc(volunteerRef, {
                analytics: { resolvedCount: increment(querySnapshot.size) }
            }, { merge: true });
        }

        location.reload();
    } catch (err) {
        console.error('Error resolving all reports for box:', err);
        alert('Error resolving reports. Please try again.');
        button.disabled = false;
        button.textContent = 'Resolve All';
    }
}
```

## Key Technical Details:

### Analytics Data Structure:
```javascript
// Stored at: authorizedVolunteers/{uid}/analytics
{
    resolvedCount: 25  // Incremented each time THIS USER clicks resolve
}

// Stored at: authorizedVolunteers/{uid}/actions/{actionId}
{
    actionType: 'resolve_pickup' | 'resolve_problem',
    reportId: 'BOXID-00001',
    boxId: 'BOXID',
    timestamp: serverTimestamp()
}
```

### Admin Panel Display:
- **Resolved Column**: Shows `volunteer.analytics.resolvedCount` for each volunteer
- This counts how many reports THAT VOLUNTEER has resolved (not how many were for their boxes)
- **Open Column**: Shows count of `status === 'new'` reports for that volunteer's boxes

## Next Steps:
1. Implement Resolve All button on status page (HTML + event handler)
2. Implement Resolve All button on dashboard boxes (modify renderBoxCard + event handler)
3. Test both features
4. Remove debug console.log statements after confirming everything works
5. Deploy to production

## Files Modified So Far:
- `/public/status/index.html` - Added imports, modified renderReportItem, buttons display
- `/public/dashboard/index.html` - Added debug logging for analytics tracking

## Deployment Command:
```bash
npx firebase deploy --only hosting
```
