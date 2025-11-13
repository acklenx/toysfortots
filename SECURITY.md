# Security Policy

## Reporting a Vulnerability

We take the security of the Toys for Tots donation tracking system seriously. If you've discovered a security vulnerability, we appreciate your help in disclosing it to us responsibly.

### 🔒 How to Report

**Please DO NOT create a public GitHub issue for security vulnerabilities.**

Instead, report security issues via:

1. **GitHub Security Advisories** (preferred):
   - Navigate to the [Security tab](../../security/advisories)
   - Click "Report a vulnerability"
   - Fill out the form with vulnerability details

2. **Email** (alternative):
   - Send details to: `toysfortots@qlamail.com`
   - Subject line: `[SECURITY] Brief description`
   - Use PGP if desired (key available on request)

### 📋 What to Include

Please provide as much information as possible:

- **Type of vulnerability** (XSS, SQL injection, authentication bypass, etc.)
- **Location** (URL, file path, function name)
- **Step-by-step reproduction instructions**
- **Proof of concept** (if applicable)
- **Potential impact**
- **Suggested fix** (if you have one)

### ⏱️ Response Timeline

- **Initial Response**: Within 3 business days
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium/Low: 30-90 days

### 🤝 Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service interruption
- Only interact with accounts you own or have explicit permission to access
- Do not exploit vulnerabilities beyond the minimum necessary to demonstrate the issue
- Give us reasonable time to fix issues before public disclosure
- Comply with all applicable laws and regulations

**We will not pursue legal action or contact law enforcement** for good faith security research conducted under these guidelines.

### ⚠️ Out of Scope

The following are **out of scope** and should not be reported:

- Social engineering attacks (phishing, etc.)
- Physical attacks on facilities or personnel
- Denial of Service (DoS/DDoS) attacks
- Spam or social media attacks
- Reports from automated tools without validation
- Issues in third-party services (Firebase, Google Maps, etc.)
- Publicly known vulnerabilities in dependencies (unless actively exploited)

### 📢 Disclosure Policy

- We prefer **coordinated disclosure**
- Please wait for our fix before public disclosure
- We aim to fix critical issues within 7 days
- We'll credit you in our changelog/release notes (if desired)
- After the fix is deployed, we may publish a security advisory

### 🏆 Recognition

While we don't have a bug bounty program, we will:

- Publicly thank you in our security acknowledgments (unless you prefer anonymity)
- Credit you in the CVE if one is filed
- Give you early access to the fix for verification
- Provide a reference letter if requested

### 📜 Security Best Practices

This project follows security best practices including:

- XSS prevention with HTML escaping
- Rate limiting on authentication endpoints
- CORS restrictions
- Input validation and sanitization
- Firestore security rules with RBAC
- Regular dependency updates

### 📞 Contact

For general security questions (not vulnerability reports):
- Email: `toysfortots@qlamail.com`
- GitHub Discussions: [Security category](../../discussions/categories/security)

---

**Thank you for helping keep the Toys for Tots donation system safe!**

*This project serves Marine Corps Reserve Toys for Tots and Marine Corps League Detachment 1311 in North Metro Atlanta.*
