<?php
declare(strict_types=1);

function user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    if (empty($_SESSION['user_id'])) return $u = null;
    $stmt = db()->prepare("SELECT * FROM users WHERE id=? AND is_active=1");
    $stmt->execute([(int)$_SESSION['user_id']]);
    return $u = ($stmt->fetch() ?: null);
}
function login_user(int $id): void {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    $_SESSION['login_at'] = time();
}
function logout_user(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
    }
    session_destroy();
}
function permissions_for_user(int $uid): array {
    $stmt = db()->prepare("SELECT p.permission_key
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id=p.id
        JOIN users u ON u.role_id=rp.role_id
        WHERE u.id=?");
    $stmt->execute([$uid]);
    return array_column($stmt->fetchAll(), 'permission_key');
}
function can(string $permission): bool {
    if (!user()) return false;
    if ((user()['role_name'] ?? '') === 'Administrator') return true;
    static $perms = null;
    if ($perms === null) $perms = permissions_for_user((int)$_SESSION['user_id']);
    return in_array($permission, $perms, true);
}
function require_login(): void {
    if (!user()) redirect('/index.php?page=login');
}
function require_permission(string $permission): void {
    require_login();
    if (!can($permission)) {
        http_response_code(403);
        exit('403 — You do not have permission to perform this action.');
    }
}
