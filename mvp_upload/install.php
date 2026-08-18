<?php
declare(strict_types=1);
require_once __DIR__ . '/config/config.php';

$done=false;$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
  verify_csrf();
  try{
    $pdo=db();
    $sql=file_get_contents(__DIR__.'/database/schema.sql');
    $pdo->exec($sql);
    $roleId=(int)$pdo->query("SELECT id FROM roles WHERE role_name='Administrator' LIMIT 1")->fetchColumn();
    $username=trim($_POST['username']??'admin');$name=trim($_POST['full_name']??'Administrator');$password=$_POST['password']??'';
    if(!$username||!$name||strlen($password)<8) throw new RuntimeException('Username, name and password (minimum 8 characters) are required.');
    $check=$pdo->prepare("SELECT COUNT(*) FROM users WHERE username=?");$check->execute([$username]);
    if($check->fetchColumn()) throw new RuntimeException('That username already exists.');
    $pdo->prepare("INSERT INTO users(username,full_name,password_hash,role_id,role_name,is_active) VALUES(?,?,?,?,?,1)")
      ->execute([$username,$name,password_hash($password,PASSWORD_DEFAULT),$roleId,'Administrator']);
    audit('CREATE','user',(int)$pdo->lastInsertId(),'Initial administrator created');
    $done=true;
  }catch(Throwable $e){$error=$e->getMessage();}
}
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install · Admission Management</title><link rel="stylesheet" href="public/assets/css/app.css"></head><body class="login-page"><div class="login-card">
<div class="login-logo">Admission Management</div><p class="muted">One-time installer. Configure DB in config/config.php first.</p>
<?php if($done):?><div class="notice notice-success">Installation completed. Sign in using the administrator account. Delete <strong>install.php</strong> after successful setup.</div><a class="btn btn-primary" href="public/index.php?page=login">Open Login</a>
<?php else:?><?php if($error):?><div class="notice notice-error"><?=htmlspecialchars($error)?></div><?php endif;?><form method="post"><?=csrf_field()?><div class="field"><label>Administrator Username</label><input name="username" value="admin" required></div><div class="field"><label>Administrator Name</label><input name="full_name" value="Administrator" required></div><div class="field"><label>Password</label><input type="password" name="password" minlength="8" required></div><button class="btn btn-primary">Install Application</button></form><?php endif;?>
</div></body></html>
