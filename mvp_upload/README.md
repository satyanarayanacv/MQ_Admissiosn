# Admission Management System — MVP

A responsive PHP 8.2+ / MySQL 8.0+ admission-management MVP for managing:
- Convener Quota (CQ): Phase-I, Phase-II, Phase-III
- Management Quota (MQ)
- Student admission records and application numbers
- CQ ↔ MQ transfers with reason, user and timestamp
- Courses, academic years, intake/strength, quota-wise fees and phase dates
- Fee payments and balances
- Role-based users and permissions
- Detailed audit logs
- Standard reports and CSV export
- Custom report builder
- Responsive desktop/laptop/tablet/mobile UI

## Compatibility
Recommended:
- PHP 8.2+ (tested for syntax with PHP 8.4)
- MySQL 8.0+ or MariaDB 10.6+
- Apache 2.4+ with mod_rewrite
- PDO MySQL extension
- PHP extensions: mbstring, json, fileinfo, openssl

No framework or external CDN is required. CSS and JS are local.

## Installation
1. Create a MySQL database, for example `admission_mvp`.
2. Edit `config/config.php` with database host, name, user and password.
3. Open `/install.php` in a browser.
4. Create the first administrator.
5. Delete or rename `install.php` after installation.
6. Point the web server document root to the `public/` directory for best security.
7. If the host requires the project root as document root, the included `.htaccess` and PHP routing still support the MVP, but `public/` is recommended.

## Default navigation
Dashboard | Students | Admissions | Courses | Fees | Reports | Users | Audit Logs

## MVP permissions
- dashboard.view
- student.view / student.create / student.edit / student.delete
- admission.view / admission.create / admission.edit / admission.change_quota
- course.view / course.manage
- fee.view / fee.manage / fee.payment
- report.view / report.export / report.custom
- user.view / user.manage
- audit.view
- settings.manage

Admin receives all permissions.

## Important production hardening
Before public deployment:
- Enable HTTPS.
- Change database credentials from defaults.
- Delete install.php.
- Put storage/uploads outside public web root where possible.
- Configure automated database backups.
- Add server-level rate limiting/WAF.
- Add institution-specific privacy/retention policy.
- Review permissions before giving non-admin access.
