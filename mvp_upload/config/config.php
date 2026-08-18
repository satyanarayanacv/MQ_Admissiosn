<?php
declare(strict_types=1);

const APP_NAME = 'Admission Management System';
const APP_VERSION = '1.0.0-MVP';
const BASE_URL = ''; // Example: '/admission' if installed in a subfolder.

const DB_HOST = '127.0.0.1';
const DB_NAME = 'admission_mvp';
const DB_USER = 'root';
const DB_PASS = '';

date_default_timezone_set('Asia/Kolkata');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('admission_mvp_session');
    session_start();
}

require_once __DIR__ . '/../app/helpers.php';
require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/auth.php';
