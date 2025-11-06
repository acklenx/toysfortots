# Project: Toys for Tots Box Locator

## Quick Start: Running Tests

**Recommended:** Use the smart test runner for best results:
```bash
npm run test:smart
```
Or directly:
```bash
./run-tests-smart.sh
```

This runs a three-tier retry strategy:
- **Tier 1:** Fast parallel execution (4 workers)
- **Tier 2:** Automatic retry for transient failures
- **Tier 3:** Sequential retry to distinguish real bugs from contention

See `docs/TEST_DEBUGGING_GUIDE.md` and `docs/TEST_WRITING_GUIDE.md` for more details.

## Mission

To provide an easy-to-use, scalable system for Marine Corps Reserve detachments (like Detachment 1311) to efficiently register, track, and manage Toys for Tots donation boxes. This tool empowers local detachments to gather accurate location data, which can then be easily passed on to the centralized Marine Corps Reserve tracking systems.

## The Problem

While the Marine Corps Reserve maintains a national database, individual detachments often lack the tools to efficiently track their *own* box locations in real-time. This makes it difficult to coordinate box pickups, manage overflow, and share accurate drop-off locations with the community, volunteers, and the national program.

## The Solution: How It Works

This application is a simple, QR-code-based system that links a unique digital ID to a physical location.

1.  **Deployment:** A detachment prints a batch of **critically unique QR codes**. Each code points to a unique URL but is not yet assigned to a location.
2.  **On-Site Registration:** A volunteer takes a box and a unique QR sticker to a new donation site.
3.  **First Scan (Setup):** The authorized volunteer scans the code. This "setup scan" opens a private form where they register the box's location using their phone's GPS, add/correct the address, and log the host business name and a point of contact.
4.  **Public Scans (Reporting):** Once registered, any *future* scan of that *same code* by a donor or member of the public leads to a simple, branded webpage. From here, they can instantly report:
    * The box is full.
    * The box needs a pickup.
    * There is a problem with the box.

Because the QR code is unique, the report is automatically tied to that *exact* box and location, requiring no additional input from the donor.

## Key Features

* **Dynamic Box Registration:** Volunteers can register a new box's location *on-site* by scanning its unique QR code and capturing the phone's GPS coordinates and business details.
* **Public-Facing Map:** A public-facing map (available at the project's root domain, e.g., `toysfortots.mcl1311.com` or `/public/index.html`) displays all registered donation box locations, making it easy for donors to find a nearby drop-off site.
* **Instant Public Reporting:** Any donor can scan a box's QR code to immediately access a report page for that *specific* box to flag it for pickup or report a problem.
* **Secure Volunteer Dashboard:** A password-protected dashboard (`/index.html`) provides a real-time logistics view for authorized personnel.
    * **Authentication:** Access is secured via email/Google OAuth and requires a one-time detachment registration passcode for new volunteers.
    * **Logistics View:** Volunteers can see the live status of all boxes or filter to view only their assigned boxes.
    * **Box History:** Volunteers can click on any box to view its complete status history (e.g., when it was registered, when it was reported full, when it was picked up).
