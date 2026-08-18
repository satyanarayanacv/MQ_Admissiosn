<?php
declare(strict_types=1);

function e(mixed $v): string {
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}
function redirect(string $url): never {
    header('Location: ' . BASE_URL . $url);
    exit;
}
function csrf_token(): string {
    if (empty($_SESSION['_csrf'])) $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['_csrf'];
}
function csrf_field(): string {
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}
function verify_csrf(): void {
    if (!hash_equals($_SESSION['_csrf'] ?? '', $_POST['_csrf'] ?? '')) {
        http_response_code(419);
        exit('Invalid CSRF token.');
    }
}
function flash(string $type, string $message): void {
    $_SESSION['_flash'][] = [$type, $message];
}
function flashes(): array {
    $x = $_SESSION['_flash'] ?? [];
    unset($_SESSION['_flash']);
    return $x;
}
function old(string $key, string $default=''): string {
    return e($_POST[$key] ?? $default);
}
function money(float|int|string|null $n): string {
    return '₹' . number_format((float)$n, 2);
}
function now_sql(): string { return date('Y-m-d H:i:s'); }

function audit(string $action, string $entity, ?int $entityId, string $description='', array $old=[], array $new=[]): void {
    $stmt = db()->prepare("INSERT INTO audit_logs
        (user_id, action, entity_type, entity_id, description, old_values, new_values, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $uid = $_SESSION['user_id'] ?? null;
    $stmt->execute([
        $uid, $action, $entity, $entityId, $description,
        $old ? json_encode($old, JSON_UNESCAPED_UNICODE) : null,
        $new ? json_encode($new, JSON_UNESCAPED_UNICODE) : null,
        $_SERVER['REMOTE_ADDR'] ?? null,
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
    ]);
}

function query_param(string $key, mixed $default=null): mixed {
    return $_GET[$key] ?? $default;
}

function selected(string $a, string $b): string { return $a === $b ? 'selected' : ''; }

function page_url(string $page, array $params=[]): string {
    return BASE_URL . '/index.php?' . http_build_query(array_merge(['page'=>$page], $params));
}

function app_setting(string $key, string $default=''): string {
    $stmt = db()->prepare("SELECT setting_value FROM settings WHERE setting_key=? LIMIT 1");
    $stmt->execute([$key]);
    $v = $stmt->fetchColumn();
    return $v === false ? $default : (string)$v;
}

function int_post(string $key, int $default=0): int {
    return isset($_POST[$key]) && $_POST[$key] !== '' ? (int)$_POST[$key] : $default;
}

function float_post(string $key, float $default=0): float {
    return isset($_POST[$key]) && $_POST[$key] !== '' ? (float)$_POST[$key] : $default;
}
