<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/config.php';

$page = $_GET['page'] ?? 'dashboard';

if ($page === 'login') {
    if (user()) redirect('/index.php?page=dashboard');
    $error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        verify_csrf();
        $stmt = db()->prepare("SELECT u.*, r.role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=? AND u.is_active=1");
        $stmt->execute([trim($_POST['username'] ?? '')]);
        $u = $stmt->fetch();
        if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
            login_user((int)$u['id']);
            db()->prepare("UPDATE users SET last_login_at=NOW() WHERE id=?")->execute([$u['id']]);
            audit('LOGIN','user',(int)$u['id'],'Successful login');
            redirect('/index.php?page=dashboard');
        }
        $error='Invalid username or password.';
    }
    ?>
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?=e(APP_NAME)?></title><link rel="stylesheet" href="<?=BASE_URL?>/assets/css/app.css"></head>
    <body class="login-page"><div class="login-card">
      <div class="login-logo"><?=e(app_setting('institution_name','College Admission Office'))?></div>
      <div class="muted" style="text-align:center">Admission Management System · <?=e(APP_VERSION)?></div>
      <?php if($error):?><div class="notice notice-error" style="margin-top:16px"><?=e($error)?></div><?php endif;?>
      <form method="post"><input type="hidden" name="_csrf" value="<?=e(csrf_token())?>">
        <div class="field"><label>Username</label><input name="username" autocomplete="username" required></div>
        <div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>
      <div class="small muted" style="text-align:center;margin-top:18px">Minimal · Responsive · Role-based</div>
    </div></body></html>
    <?php exit;
}
if ($page === 'logout') {
    if (user()) audit('LOGOUT','user',(int)$_SESSION['user_id'],'Logout');
    logout_user(); redirect('/index.php?page=login');
}

require_login();

function layout_start(string $title): void {
    $flashes=flashes(); $u=user();
    $links=[
      ['dashboard','Dashboard','dashboard.view'],
      ['students','Students','student.view'],
      ['admissions','Admissions','admission.view'],
      ['courses','Courses','course.view'],
      ['fees','Fees','fee.view'],
      ['reports','Reports','report.view'],
      ['users','Users','user.view'],
      ['audit','Audit Logs','audit.view'],
    ];
    ?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?=e($title)?> · <?=e(APP_NAME)?></title><link rel="stylesheet" href="<?=BASE_URL?>/assets/css/app.css"></head><body>
    <div class="app"><aside class="sidebar"><div class="brand">● <?=e(APP_NAME)?></div><nav class="nav">
    <?php foreach($links as $l): if(can($l[2])): ?><a class="<?=($_GET['page']??'dashboard')===$l[0]?'active':''?>" href="<?=page_url($l[0])?>"><?=e($l[1])?></a><?php endif; endforeach;?>
    </nav></aside><main class="main"><header class="topbar"><button class="btn btn-light mobile-menu" data-mobile-toggle>☰</button><div><strong><?=e($title)?></strong></div>
    <div class="userbox"><?=e($u['full_name']??'User')?> · <a href="<?=page_url('logout')?>">Sign out</a></div></header><section class="content">
    <?php foreach($flashes as $f):?><div class="notice <?=$f[0]==='success'?'notice-success':'notice-error'?>"><?=e($f[1])?></div><?php endforeach;
}
function layout_end(): void { echo '<div class="footer">Admission Management System · MVP · '.e(APP_VERSION).'</div></section></main></div></body></html>'; }

try {
switch ($page) {
case 'dashboard':
    require_permission('dashboard.view');
    $students=(int)db()->query("SELECT COUNT(*) FROM students")->fetchColumn();
    $admitted=(int)db()->query("SELECT COUNT(*) FROM admissions WHERE admission_status='Admitted'")->fetchColumn();
    $cq=(int)db()->query("SELECT COUNT(*) FROM admissions WHERE quota='CQ'")->fetchColumn();
    $mq=(int)db()->query("SELECT COUNT(*) FROM admissions WHERE quota='MQ'")->fetchColumn();
    $fees=(float)db()->query("SELECT COALESCE(SUM(amount),0) FROM fee_payments")->fetchColumn();
    layout_start('Dashboard'); ?>
    <div class="section-title"><div><h1>Admission dashboard</h1><div class="muted">CQ Phase-I / II / III and Management Quota in one workspace.</div></div><a class="btn btn-primary" href="<?=page_url('student_edit')?>">+ New Student</a></div>
    <div class="grid grid-4">
      <div class="card stat"><div class="label">Students</div><div class="value"><?=$students?></div></div>
      <div class="card stat"><div class="label">Admitted</div><div class="value"><?=$admitted?></div></div>
      <div class="card stat"><div class="label">CQ / MQ</div><div class="value"><?=$cq?> / <?=$mq?></div></div>
      <div class="card stat"><div class="label">Fees Collected</div><div class="value"><?=money($fees)?></div></div>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card"><h2>Quick actions</h2><div class="actions">
        <?php if(can('student.create')):?><a class="btn btn-primary" href="<?=page_url('student_edit')?>">Add student</a><?php endif;?>
        <?php if(can('admission.create')):?><a class="btn btn-light" href="<?=page_url('admission_edit')?>">Create admission</a><?php endif;?>
        <?php if(can('fee.payment')):?><a class="btn btn-light" href="<?=page_url('fee_payment')?>">Record fee payment</a><?php endif;?>
        <a class="btn btn-light" href="<?=page_url('reports')?>">Open reports</a>
      </div></div>
      <div class="card"><h2>System controls</h2><p class="muted">Admin can define courses, academic years, strength, CQ/MQ fees, CQ phase dates, users, permissions and audit access.</p></div>
    </div>
    <?php layout_end(); break;

case 'students':
    require_permission('student.view');
    $q=trim($_GET['q']??'');
    $sql="SELECT s.*,c.course_code,c.course_name,y.year_label,a.quota,a.cq_phase,a.admission_date
          FROM students s JOIN courses c ON c.id=s.course_id JOIN academic_years y ON y.id=s.academic_year_id
          LEFT JOIN admissions a ON a.student_id=s.id";
    $params=[];
    if($q!==''){ $sql.=" WHERE s.application_no LIKE ? OR s.admission_no LIKE ? OR CONCAT(s.first_name,' ',COALESCE(s.last_name,'')) LIKE ? OR s.mobile LIKE ?"; $params=["%$q%","%$q%","%$q%","%$q%"]; }
    $sql.=" ORDER BY s.id DESC LIMIT 500";
    $st=db()->prepare($sql);$st->execute($params);$rows=$st->fetchAll();
    layout_start('Students'); ?>
    <div class="section-title"><div><h1>Students</h1><div class="muted">Application and personal records.</div></div>
      <?php if(can('student.create')):?><a class="btn btn-primary" href="<?=page_url('student_edit')?>">+ Add student</a><?php endif;?></div>
    <div class="card"><form class="report-toolbar" method="get"><input type="hidden" name="page" value="students"><div class="field"><label>Search</label><input name="q" value="<?=e($q)?>" placeholder="Application, admission no, name, mobile"></div><button class="btn btn-light">Search</button></form></div>
    <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="table"><thead><tr><th>Application</th><th>Student</th><th>Course</th><th>Year</th><th>Quota</th><th>Admission</th><th></th></tr></thead><tbody>
    <?php foreach($rows as $r):?><tr><td class="mono"><?=e($r['application_no'])?><br><span class="muted small"><?=e($r['admission_no']??'')?></span></td><td><strong><?=e(trim($r['first_name'].' '.$r['middle_name'].' '.$r['last_name']))?></strong><br><span class="small muted"><?=e($r['mobile']??'')?></span></td><td><?=e($r['course_code'].' — '.$r['course_name'])?></td><td><?=e($r['year_label'])?></td><td><?= $r['quota'] ? '<span class="badge '.($r['quota']==='CQ'?'badge-cq':'badge-mq').'">'.e($r['quota']).($r['cq_phase']?' · P'.e($r['cq_phase']):'').'</span>':'—'?></td><td><?=e($r['admission_date']??'—')?></td><td><?php if(can('student.edit')):?><a class="btn btn-light btn-small" href="<?=page_url('student_edit',['id'=>$r['id']])?>">Edit</a><?php endif;?></td></tr><?php endforeach;?></tbody></table></div></div>
    <?php layout_end(); break;

case 'student_edit':
    $id=(int)($_GET['id']??0);
    if($id) require_permission('student.edit'); else require_permission('student.create');
    $student=$id?db()->query("SELECT * FROM students WHERE id=$id")->fetch():null;
    if($id&&!$student) exit('Student not found');
    $years=db()->query("SELECT * FROM academic_years WHERE is_active=1 ORDER BY year_label DESC")->fetchAll();
    $courses=db()->query("SELECT * FROM courses WHERE is_active=1 ORDER BY course_code")->fetchAll();
    if($_SERVER['REQUEST_METHOD']==='POST'){
      verify_csrf();
      $data=[
       trim($_POST['application_no']??''), trim($_POST['admission_no']??'')?:null, int_post('academic_year_id'), int_post('course_id'),
       trim($_POST['first_name']??''), trim($_POST['middle_name']??'')?:null, trim($_POST['last_name']??'')?:null,
       $_POST['gender']??null, $_POST['dob']?:null, trim($_POST['mobile']??'')?:null, trim($_POST['alternate_mobile']??'')?:null,
       trim($_POST['email']??'')?:null, trim($_POST['father_name']??'')?:null, trim($_POST['mother_name']??'')?:null,
       trim($_POST['guardian_name']??'')?:null, trim($_POST['address']??'')?:null, trim($_POST['category']??'')?:null,
       trim($_POST['caste']??'')?:null, trim($_POST['qualifying_exam']??'')?:null, trim($_POST['qualifying_year']??'')?:null,
       $_POST['qualifying_percentage']!==''?float_post('qualifying_percentage'):null, trim($_POST['remarks']??'')?:null
      ];
      if(!$data[0]||!$data[2]||!$data[3]||!$data[4]){flash('error','Application number, academic year, course and first name are required.');redirect(page_url('student_edit',$id?['id'=>$id]:[]));}
      if($id){
        $old=db()->query("SELECT * FROM students WHERE id=$id")->fetch();
        $sql="UPDATE students SET application_no=?,admission_no=?,academic_year_id=?,course_id=?,first_name=?,middle_name=?,last_name=?,gender=?,dob=?,mobile=?,alternate_mobile=?,email=?,father_name=?,mother_name=?,guardian_name=?,address=?,category=?,caste=?,qualifying_exam=?,qualifying_year=?,qualifying_percentage=?,remarks=?,updated_by=? WHERE id=?";
        $data[]=$_SESSION['user_id'];$data[]=$id;db()->prepare($sql)->execute($data);
        audit('UPDATE','student',$id,'Student record updated',$old,db()->query("SELECT * FROM students WHERE id=$id")->fetch());
        flash('success','Student updated.');
      }else{
        $sql="INSERT INTO students(application_no,admission_no,academic_year_id,course_id,first_name,middle_name,last_name,gender,dob,mobile,alternate_mobile,email,father_name,mother_name,guardian_name,address,category,caste,qualifying_exam,qualifying_year,qualifying_percentage,remarks,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
        $data[]=$_SESSION['user_id'];db()->prepare($sql)->execute($data);$newId=(int)db()->lastInsertId();
        audit('CREATE','student',$newId,'Student record created',[],db()->query("SELECT * FROM students WHERE id=$newId")->fetch());
        flash('success','Student created.');
      }
      redirect(page_url('students'));
    }
    layout_start($id?'Edit Student':'Add Student'); ?>
    <div class="section-title"><div><h1><?=$id?'Edit':'Add'?> student</h1><div class="muted">Core student/application information.</div></div></div>
    <form method="post" class="card"><?=csrf_field()?><div class="form-grid">
      <div class="field"><label>Application No *</label><input name="application_no" required value="<?=old('application_no',$student['application_no']??'')?>"></div>
      <div class="field"><label>Admission No</label><input name="admission_no" value="<?=old('admission_no',$student['admission_no']??'')?>"></div>
      <div class="field"><label>Academic Year *</label><select name="academic_year_id" required><?php foreach($years as $y):?><option value="<?=$y['id']?>" <?=selected((string)($student['academic_year_id']??''),(string)$y['id'])?>><?=e($y['year_label'])?></option><?php endforeach;?></select></div>
      <div class="field"><label>Course *</label><select name="course_id" required><option value="">Select</option><?php foreach($courses as $c):?><option value="<?=$c['id']?>" <?=selected((string)($student['course_id']??''),(string)$c['id'])?>><?=e($c['course_code'].' — '.$c['course_name'])?></option><?php endforeach;?></select></div>
      <div class="field"><label>First Name *</label><input name="first_name" required value="<?=old('first_name',$student['first_name']??'')?>"></div>
      <div class="field"><label>Middle Name</label><input name="middle_name" value="<?=old('middle_name',$student['middle_name']??'')?>"></div>
      <div class="field"><label>Last Name</label><input name="last_name" value="<?=old('last_name',$student['last_name']??'')?>"></div>
      <div class="field"><label>Gender</label><select name="gender"><option value="">Select</option><?php foreach(['Male','Female','Other'] as $g):?><option <?=selected($student['gender']??'', $g)?>><?=$g?></option><?php endforeach;?></select></div>
      <div class="field"><label>Date of Birth</label><input type="date" name="dob" value="<?=old('dob',$student['dob']??'')?>"></div>
      <div class="field"><label>Mobile</label><input name="mobile" value="<?=old('mobile',$student['mobile']??'')?>"></div>
      <div class="field"><label>Alternate Mobile</label><input name="alternate_mobile" value="<?=old('alternate_mobile',$student['alternate_mobile']??'')?>"></div>
      <div class="field"><label>Email</label><input type="email" name="email" value="<?=old('email',$student['email']??'')?>"></div>
      <div class="field"><label>Father Name</label><input name="father_name" value="<?=old('father_name',$student['father_name']??'')?>"></div>
      <div class="field"><label>Mother Name</label><input name="mother_name" value="<?=old('mother_name',$student['mother_name']??'')?>"></div>
      <div class="field"><label>Guardian Name</label><input name="guardian_name" value="<?=old('guardian_name',$student['guardian_name']??'')?>"></div>
      <div class="field"><label>Category</label><input name="category" placeholder="OC / BC / SC / ST / EWS..." value="<?=old('category',$student['category']??'')?>"></div>
      <div class="field"><label>Caste</label><input name="caste" value="<?=old('caste',$student['caste']??'')?>"></div>
      <div class="field"><label>Qualifying Exam</label><input name="qualifying_exam" value="<?=old('qualifying_exam',$student['qualifying_exam']??'')?>"></div>
      <div class="field"><label>Qualifying Year</label><input name="qualifying_year" value="<?=old('qualifying_year',$student['qualifying_year']??'')?>"></div>
      <div class="field"><label>Qualifying %</label><input type="number" step="0.01" name="qualifying_percentage" value="<?=old('qualifying_percentage',$student['qualifying_percentage']??'')?>"></div>
      <div class="field field-full"><label>Address</label><textarea name="address"><?=old('address',$student['address']??'')?></textarea></div>
      <div class="field field-full"><label>Remarks</label><textarea name="remarks"><?=old('remarks',$student['remarks']??'')?></textarea></div>
    </div><div class="actions" style="margin-top:15px"><button class="btn btn-primary">Save Student</button><a class="btn btn-light" href="<?=page_url('students')?>">Cancel</a></div></form>
    <?php layout_end(); break;

case 'admissions':
    require_permission('admission.view');
    $q=trim($_GET['q']??'');$quota=$_GET['quota']??'';$phase=$_GET['phase']??'';
    $sql="SELECT a.*,s.application_no,s.admission_no,s.first_name,s.middle_name,s.last_name,s.mobile,c.course_code,c.course_name,y.year_label,
          (SELECT COALESCE(SUM(fp.amount),0) FROM fee_payments fp WHERE fp.admission_id=a.id) paid
          FROM admissions a JOIN students s ON s.id=a.student_id JOIN courses c ON c.id=s.course_id JOIN academic_years y ON y.id=s.academic_year_id WHERE 1=1";
    $p=[];
    if($q!==''){ $sql.=" AND (s.application_no LIKE ? OR s.admission_no LIKE ? OR s.first_name LIKE ? OR s.mobile LIKE ?)";$p=["%$q%","%$q%","%$q%","%$q%"]; }
    if(in_array($quota,['CQ','MQ'],true)){ $sql.=" AND a.quota=?";$p[]=$quota; }
    if(in_array($phase,['1','2','3'],true)){ $sql.=" AND a.cq_phase=?";$p[]=(int)$phase; }
    $sql.=" ORDER BY a.id DESC LIMIT 500";$st=db()->prepare($sql);$st->execute($p);$rows=$st->fetchAll();
    layout_start('Admissions'); ?>
    <div class="section-title"><div><h1>Admissions</h1><div class="muted">Quota, phase, date, fee structure and transfer history.</div></div><?php if(can('admission.create')):?><a class="btn btn-primary" href="<?=page_url('admission_edit')?>">+ New admission</a><?php endif;?></div>
    <div class="card"><form class="report-toolbar" method="get"><input type="hidden" name="page" value="admissions"><div class="field"><label>Search</label><input name="q" value="<?=e($q)?>" placeholder="Application/name/mobile"></div><div class="field"><label>Quota</label><select name="quota"><option value="">All</option><option value="CQ" <?=selected($quota,'CQ')?>>CQ</option><option value="MQ" <?=selected($quota,'MQ')?>>MQ</option></select></div><div class="field"><label>CQ Phase</label><select name="phase"><option value="">All</option><?php for($i=1;$i<=3;$i++):?><option value="<?=$i?>" <?=selected($phase,(string)$i)?>>Phase-<?=$i?></option><?php endfor;?></select></div><button class="btn btn-light">Filter</button></form></div>
    <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="table"><thead><tr><th>Application</th><th>Student</th><th>Course</th><th>Quota</th><th>Date</th><th>Fee / Paid</th><th></th></tr></thead><tbody>
    <?php foreach($rows as $r):?><tr><td class="mono"><?=e($r['application_no'])?></td><td><?=e(trim($r['first_name'].' '.$r['middle_name'].' '.$r['last_name']))?><br><span class="small muted"><?=e($r['mobile'])?></span></td><td><?=e($r['course_code'])?></td><td><span class="badge <?=$r['quota']==='CQ'?'badge-cq':'badge-mq'?>"><?=e($r['quota'])?><?= $r['cq_phase']?' · P'.e($r['cq_phase']):''?></span></td><td><?=e($r['admission_date'])?></td><td><?=money($r['total_fee'])?><br><span class="small muted">Paid <?=money($r['paid'])?></span></td><td><a class="btn btn-light btn-small" href="<?=page_url('admission_edit',['id'=>$r['id']])?>">Open</a></td></tr><?php endforeach;?></tbody></table></div></div>
    <?php layout_end(); break;

case 'admission_edit':
    $id=(int)($_GET['id']??0);
    if($id) require_permission('admission.edit'); else require_permission('admission.create');
    $ad=$id?db()->query("SELECT a.*,s.application_no,s.first_name,s.last_name,s.course_id,s.academic_year_id FROM admissions a JOIN students s ON s.id=a.student_id WHERE a.id=$id")->fetch():null;
    if($id&&!$ad) exit('Admission not found');
    $students=db()->query("SELECT s.id,s.application_no,s.first_name,s.last_name,c.course_code,c.course_name FROM students s JOIN courses c ON c.id=s.course_id LEFT JOIN admissions a ON a.student_id=s.id WHERE a.id IS NULL OR a.id=".($id?:0)." ORDER BY s.id DESC LIMIT 1000")->fetchAll();
    $years=db()->query("SELECT * FROM academic_years WHERE is_active=1 ORDER BY year_label DESC")->fetchAll();
    $history=$id?db()->query("SELECT q.*,u.full_name FROM quota_change_history q LEFT JOIN users u ON u.id=q.changed_by WHERE q.admission_id=$id ORDER BY q.changed_at DESC")->fetchAll():[];
    if($_SERVER['REQUEST_METHOD']==='POST'){
      verify_csrf();
      $studentId=int_post('student_id');$quota=$_POST['quota']??'';$phase=($quota==='CQ'&&$_POST['cq_phase']!=='')?(int)$_POST['cq_phase']:null;$date=$_POST['admission_date']??date('Y-m-d');$fee=float_post('total_fee');
      if(!$studentId||!in_array($quota,['CQ','MQ'],true)){flash('error','Student and quota are required.');redirect(page_url('admission_edit',$id?['id'=>$id]:[]));}
      $pdo=db();$pdo->beginTransaction();
      try{
        if($id){
          $old=$pdo->query("SELECT * FROM admissions WHERE id=$id")->fetch();
          $pdo->prepare("UPDATE admissions SET student_id=?,quota=?,cq_phase=?,admission_date=?,seat_no=?,admission_status=?,total_fee=?,updated_by=? WHERE id=?")
              ->execute([$studentId,$quota,$phase,$date,trim($_POST['seat_no']??'')?:null,$_POST['admission_status']??'Admitted',$fee,$_SESSION['user_id'],$id]);
          if(($old['quota']??null)!==$quota || ($old['cq_phase']??null)!==$phase){
             if(!can('admission.change_quota')) throw new RuntimeException('You do not have permission to change quota.');
             $reason=trim($_POST['change_reason']??'');
             if($reason==='') throw new RuntimeException('A reason is required when changing quota or CQ phase.');
             $pdo->prepare("INSERT INTO quota_change_history(admission_id,old_quota,old_phase,new_quota,new_phase,reason,changed_by) VALUES(?,?,?,?,?,?,?)")
                 ->execute([$id,$old['quota'],$old['cq_phase'],$quota,$phase,$reason,$_SESSION['user_id']]);
             audit('QUOTA_CHANGE','admission',$id,'CQ/MQ or phase changed',['quota'=>$old['quota'],'phase'=>$old['cq_phase']],['quota'=>$quota,'phase'=>$phase,'reason'=>$reason]);
          } else {
             audit('UPDATE','admission',$id,'Admission updated',$old,$pdo->query("SELECT * FROM admissions WHERE id=$id")->fetch());
          }
          $pdo->commit();flash('success','Admission updated.');
        }else{
          $pdo->prepare("INSERT INTO admissions(student_id,quota,cq_phase,admission_date,seat_no,admission_status,total_fee,created_by) VALUES(?,?,?,?,?,?,?,?)")
             ->execute([$studentId,$quota,$phase,$date,trim($_POST['seat_no']??'')?:null,$_POST['admission_status']??'Admitted',$fee,$_SESSION['user_id']]);
          $newId=(int)$pdo->lastInsertId();$pdo->commit();
          audit('CREATE','admission',$newId,'Admission created',[], $pdo->query("SELECT * FROM admissions WHERE id=$newId")->fetch());
          flash('success','Admission created.');
        }
      }catch(Throwable $ex){$pdo->rollBack();flash('error',$ex->getMessage());redirect(page_url('admission_edit',$id?['id'=>$id]:[]));}
      redirect(page_url('admissions'));
    }
    layout_start($id?'Edit Admission':'Create Admission'); ?>
    <div class="section-title"><div><h1><?=$id?'Edit':'Create'?> admission</h1><div class="muted">Changing CQ ↔ MQ requires the appropriate permission and a reason.</div></div></div>
    <form method="post" class="card"><?=csrf_field()?><div class="form-grid">
      <div class="field field-full"><label>Student *</label><select name="student_id" required><option value="">Select student</option><?php foreach($students as $s):?><option value="<?=$s['id']?>" <?=selected((string)($ad['student_id']??''),(string)$s['id'])?>><?=e($s['application_no'].' — '.trim($s['first_name'].' '.$s['last_name']).' — '.$s['course_code'])?></option><?php endforeach;?></select></div>
      <div class="field"><label>Quota *</label><select name="quota" required><option value="CQ" <?=selected($ad['quota']??'','CQ')?>>Convener Quota (CQ)</option><option value="MQ" <?=selected($ad['quota']??'','MQ')?>>Management Quota (MQ)</option></select></div>
      <div class="field"><label>CQ Phase</label><select name="cq_phase"><option value="">Not applicable</option><?php for($i=1;$i<=3;$i++):?><option value="<?=$i?>" <?=selected((string)($ad['cq_phase']??''),(string)$i)?>>Phase-<?=$i?></option><?php endfor;?></select></div>
      <div class="field"><label>Admission Date *</label><input type="date" name="admission_date" value="<?=old('admission_date',$ad['admission_date']??date('Y-m-d'))?>" required></div>
      <div class="field"><label>Seat No</label><input name="seat_no" value="<?=old('seat_no',$ad['seat_no']??'')?>"></div>
      <div class="field"><label>Status</label><select name="admission_status"><?php foreach(['Admitted','Provisional','Cancelled','Withdrawn'] as $s):?><option <?=selected($ad['admission_status']??'Admitted',$s)?>><?=$s?></option><?php endforeach;?></select></div>
      <div class="field"><label>Total Fee</label><input type="number" step="0.01" name="total_fee" value="<?=old('total_fee',$ad['total_fee']??'0')?>"></div>
      <?php if($id):?><div class="field field-full"><label>Reason for CQ/MQ or phase change</label><input name="change_reason" placeholder="Required only when quota/phase changes"></div><?php endif;?>
    </div><div class="actions" style="margin-top:15px"><button class="btn btn-primary">Save Admission</button><a class="btn btn-light" href="<?=page_url('admissions')?>">Cancel</a></div></form>
    <?php if($id):?><div class="card" style="margin-top:16px"><h2>Quota change history</h2><div class="table-wrap"><table class="table"><thead><tr><th>From</th><th>To</th><th>Reason</th><th>Changed By</th><th>When</th></tr></thead><tbody><?php foreach($history as $h):?><tr><td><?=e($h['old_quota'].' '.($h['old_phase']?'P'.$h['old_phase']:''))?></td><td><?=e($h['new_quota'].' '.($h['new_phase']?'P'.$h['new_phase']:''))?></td><td><?=e($h['reason'])?></td><td><?=e($h['full_name']??'System')?></td><td><?=e($h['changed_at'])?></td></tr><?php endforeach;?></tbody></table></div></div><?php endif;?>
    <?php layout_end(); break;

case 'courses':
    require_permission('course.view');
    $courses=db()->query("SELECT c.*,COUNT(DISTINCT s.id) students FROM courses c LEFT JOIN students s ON s.course_id=c.id GROUP BY c.id ORDER BY c.course_code")->fetchAll();
    $years=db()->query("SELECT * FROM academic_years ORDER BY year_label DESC")->fetchAll();
    layout_start('Courses & Intake'); ?>
    <div class="section-title"><div><h1>Courses, strength & fees</h1><div class="muted">Define course master data and quota-specific intake.</div></div><?php if(can('course.manage')):?><a class="btn btn-primary" href="<?=page_url('course_edit')?>">+ Add course</a><?php endif;?></div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Course</th><th>Department</th><th>Students</th><th>Action</th></tr></thead><tbody><?php foreach($courses as $c):?><tr><td class="mono"><?=e($c['course_code'])?></td><td><?=e($c['course_name'])?></td><td><?=e($c['department'])?></td><td><?=e($c['students'])?></td><td><?php if(can('course.manage')):?><a class="btn btn-light btn-small" href="<?=page_url('course_edit',['id'=>$c['id']])?>">Manage</a><?php endif;?></td></tr><?php endforeach;?></tbody></table></div></div>
    <div class="card" style="margin-top:16px"><h2>Academic years</h2><?php if(can('course.manage')):?><a class="btn btn-light btn-small" href="<?=page_url('year_edit')?>">+ Add academic year</a><?php endif;?><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Year</th><th>Start</th><th>End</th><th>Active</th><th></th></tr></thead><tbody><?php foreach($years as $y):?><tr><td><?=e($y['year_label'])?></td><td><?=e($y['start_date'])?></td><td><?=e($y['end_date'])?></td><td><?= $y['is_active']?'Yes':'No'?></td><td><?php if(can('course.manage')):?><a class="btn btn-light btn-small" href="<?=page_url('year_edit',['id'=>$y['id']])?>">Edit</a><?php endif;?></td></tr><?php endforeach;?></tbody></table></div></div>
    <?php layout_end(); break;

case 'course_edit':
    require_permission('course.manage');$id=(int)($_GET['id']??0);$c=$id?db()->query("SELECT * FROM courses WHERE id=$id")->fetch():null;
    $years=db()->query("SELECT * FROM academic_years ORDER BY year_label DESC")->fetchAll();
    $intakes=$id?db()->query("SELECT ci.*,y.year_label FROM course_intakes ci JOIN academic_years y ON y.id=ci.academic_year_id WHERE ci.course_id=$id ORDER BY y.year_label DESC")->fetchAll():[];
    if($_SERVER['REQUEST_METHOD']==='POST'){verify_csrf();$code=trim($_POST['course_code']??'');$name=trim($_POST['course_name']??'');$dept=trim($_POST['department']??'')?:null;$dur=float_post('duration_years',3);
      if(!$code||!$name){flash('error','Course code and name are required.');redirect(page_url('course_edit',$id?['id'=>$id]:[]));}
      if($id){$old=$c;db()->prepare("UPDATE courses SET course_code=?,course_name=?,department=?,duration_years=? WHERE id=?")->execute([$code,$name,$dept,$dur,$id]);audit('UPDATE','course',$id,'Course updated',$old,db()->query("SELECT * FROM courses WHERE id=$id")->fetch());}
      else{db()->prepare("INSERT INTO courses(course_code,course_name,department,duration_years) VALUES(?,?,?,?)")->execute([$code,$name,$dept,$dur]);$id=(int)db()->lastInsertId();audit('CREATE','course',$id,'Course created');}
      if(isset($_POST['intake_year'])){ $yid=(int)$_POST['intake_year'];$vals=[$yid,$id,int_post('total_strength'),int_post('cq_strength'),int_post('mq_strength'),float_post('cq_fee'),float_post('mq_fee')];
        db()->prepare("INSERT INTO course_intakes(academic_year_id,course_id,total_strength,cq_strength,mq_strength,cq_fee,mq_fee) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE total_strength=VALUES(total_strength),cq_strength=VALUES(cq_strength),mq_strength=VALUES(mq_strength),cq_fee=VALUES(cq_fee),mq_fee=VALUES(mq_fee)")->execute($vals);
        audit('UPSERT','course_intake',$id,'Course intake/fee structure updated',[],['academic_year_id'=>$yid,'total_strength'=>$vals[2],'cq_strength'=>$vals[3],'mq_strength'=>$vals[4],'cq_fee'=>$vals[5],'mq_fee'=>$vals[6]]);
      }
      flash('success','Course saved.');redirect(page_url('course_edit',['id'=>$id]));
    }
    layout_start($id?'Manage Course':'Add Course'); ?>
    <div class="section-title"><div><h1><?=$id?'Manage':'Add'?> course</h1></div></div>
    <form method="post" class="card"><?=csrf_field()?><div class="form-grid"><div class="field"><label>Course Code *</label><input name="course_code" required value="<?=old('course_code',$c['course_code']??'')?>"></div><div class="field field-full"><label>Course Name *</label><input name="course_name" required value="<?=old('course_name',$c['course_name']??'')?>"></div><div class="field"><label>Department</label><input name="department" value="<?=old('department',$c['department']??'')?>"></div><div class="field"><label>Duration (years)</label><input type="number" step="0.5" name="duration_years" value="<?=old('duration_years',$c['duration_years']??3)?>"></div></div><div class="actions" style="margin-top:15px"><button class="btn btn-primary">Save Course</button><a class="btn btn-light" href="<?=page_url('courses')?>">Back</a></div></form>
    <?php if($id):?><form method="post" class="card" style="margin-top:16px"><?=csrf_field()?><h2>Quota-wise strength & fees</h2><div class="form-grid"><div class="field"><label>Academic Year</label><select name="intake_year" required><?php foreach($years as $y):?><option value="<?=$y['id']?>"><?=e($y['year_label'])?></option><?php endforeach;?></select></div><div class="field"><label>Total Strength</label><input type="number" name="total_strength" value="0"></div><div class="field"><label>CQ Strength</label><input type="number" name="cq_strength" value="0"></div><div class="field"><label>MQ Strength</label><input type="number" name="mq_strength" value="0"></div><div class="field"><label>CQ Fee</label><input type="number" step="0.01" name="cq_fee" value="0"></div><div class="field"><label>MQ Fee</label><input type="number" step="0.01" name="mq_fee" value="0"></div></div><button class="btn btn-primary" style="margin-top:15px">Save Intake / Fees</button></form>
    <div class="card" style="margin-top:16px"><h2>Configured intakes</h2><div class="table-wrap"><table class="table"><thead><tr><th>Year</th><th>Total</th><th>CQ</th><th>MQ</th><th>CQ Fee</th><th>MQ Fee</th></tr></thead><tbody><?php foreach($intakes as $i):?><tr><td><?=e($i['year_label'])?></td><td><?=e($i['total_strength'])?></td><td><?=e($i['cq_strength'])?></td><td><?=e($i['mq_strength'])?></td><td><?=money($i['cq_fee'])?></td><td><?=money($i['mq_fee'])?></td></tr><?php endforeach;?></tbody></table></div></div><?php endif;?>
    <?php layout_end(); break;

case 'year_edit':
    require_permission('course.manage');$id=(int)($_GET['id']??0);$y=$id?db()->query("SELECT * FROM academic_years WHERE id=$id")->fetch():null;
    if($_SERVER['REQUEST_METHOD']==='POST'){verify_csrf();$label=trim($_POST['year_label']??'');if(!$label){flash('error','Year label is required.');redirect(page_url('year_edit',$id?['id'=>$id]:[]));}
      if($id){$old=$y;db()->prepare("UPDATE academic_years SET year_label=?,start_date=?,end_date=?,is_active=? WHERE id=?")->execute([$label,$_POST['start_date']?:null,$_POST['end_date']?:null,isset($_POST['is_active'])?1:0,$id]);audit('UPDATE','academic_year',$id,'Academic year updated',$old,db()->query("SELECT * FROM academic_years WHERE id=$id")->fetch());}
      else{db()->prepare("INSERT INTO academic_years(year_label,start_date,end_date,is_active) VALUES(?,?,?,?)")->execute([$label,$_POST['start_date']?:null,$_POST['end_date']?:null,1]);$id=(int)db()->lastInsertId();audit('CREATE','academic_year',$id,'Academic year created');}
      flash('success','Academic year saved.');redirect(page_url('courses'));
    }
    layout_start($id?'Edit Academic Year':'Add Academic Year');?><form method="post" class="card"><?=csrf_field()?><div class="form-grid"><div class="field"><label>Year Label *</label><input name="year_label" required value="<?=old('year_label',$y['year_label']??'2026-27')?>"></div><div class="field"><label>Start Date</label><input type="date" name="start_date" value="<?=old('start_date',$y['start_date']??'')?>"></div><div class="field"><label>End Date</label><input type="date" name="end_date" value="<?=old('end_date',$y['end_date']??'')?>"></div><div class="field"><label>Active</label><input type="checkbox" name="is_active" <?=($y['is_active']??1)?'checked':''?> style="width:auto"></div></div><button class="btn btn-primary" style="margin-top:15px">Save</button></form><?php layout_end(); break;

case 'fees':
    require_permission('fee.view');
    $rows=db()->query("SELECT ci.*,c.course_code,c.course_name,y.year_label FROM course_intakes ci JOIN courses c ON c.id=ci.course_id JOIN academic_years y ON y.id=ci.academic_year_id ORDER BY y.year_label DESC,c.course_code")->fetchAll();
    $payments=db()->query("SELECT fp.*,s.application_no,s.first_name,s.last_name FROM fee_payments fp JOIN admissions a ON a.id=fp.admission_id JOIN students s ON s.id=a.student_id ORDER BY fp.id DESC LIMIT 100")->fetchAll();
    layout_start('Fees'); ?><div class="section-title"><div><h1>Fees</h1><div class="muted">CQ/MQ fee definitions and payment register.</div></div><?php if(can('fee.payment')):?><a class="btn btn-primary" href="<?=page_url('fee_payment')?>">+ Record payment</a><?php endif;?></div>
    <div class="card"><h2>Fee structures</h2><div class="table-wrap"><table class="table"><thead><tr><th>Year</th><th>Course</th><th>Strength</th><th>CQ Fee</th><th>MQ Fee</th></tr></thead><tbody><?php foreach($rows as $r):?><tr><td><?=e($r['year_label'])?></td><td><?=e($r['course_code'].' — '.$r['course_name'])?></td><td><?=e($r['total_strength'])?> (CQ <?=e($r['cq_strength'])?> / MQ <?=e($r['mq_strength'])?>)</td><td><?=money($r['cq_fee'])?></td><td><?=money($r['mq_fee'])?></td></tr><?php endforeach;?></tbody></table></div></div>
    <div class="card" style="margin-top:16px"><h2>Recent payments</h2><div class="table-wrap"><table class="table"><thead><tr><th>Receipt</th><th>Student</th><th>Date</th><th>Amount</th><th>Mode</th><th>Entered</th></tr></thead><tbody><?php foreach($payments as $p):?><tr><td class="mono"><?=e($p['receipt_no'])?></td><td><?=e($p['application_no'].' — '.trim($p['first_name'].' '.$p['last_name']))?></td><td><?=e($p['payment_date'])?></td><td><?=money($p['amount'])?></td><td><?=e($p['payment_mode'])?></td><td><?=e($p['created_at'])?></td></tr><?php endforeach;?></tbody></table></div></div>
    <?php layout_end(); break;

case 'fee_payment':
    require_permission('fee.payment');
    $ads=db()->query("SELECT a.id,a.total_fee,s.application_no,s.first_name,s.last_name,c.course_code FROM admissions a JOIN students s ON s.id=a.student_id JOIN courses c ON c.id=s.course_id ORDER BY a.id DESC LIMIT 1000")->fetchAll();
    if($_SERVER['REQUEST_METHOD']==='POST'){verify_csrf();$adid=int_post('admission_id');$amount=float_post('amount');$receipt=trim($_POST['receipt_no']??'');if(!$adid||$amount<=0||!$receipt){flash('error','Admission, positive amount and receipt number are required.');redirect(page_url('fee_payment'));}
      db()->prepare("INSERT INTO fee_payments(admission_id,receipt_no,payment_date,amount,payment_mode,reference_no,remarks,entered_by) VALUES(?,?,?,?,?,?,?,?)")
        ->execute([$adid,$receipt,$_POST['payment_date']?:date('Y-m-d'),$amount,$_POST['payment_mode']??'Cash',trim($_POST['reference_no']??'')?:null,trim($_POST['remarks']??'')?:null,$_SESSION['user_id']]);
      $pid=(int)db()->lastInsertId();audit('CREATE','fee_payment',$pid,'Fee payment recorded');flash('success','Payment recorded.');redirect(page_url('fees'));
    }
    layout_start('Record Fee Payment');?><form method="post" class="card"><?=csrf_field()?><div class="form-grid"><div class="field field-full"><label>Admission *</label><select name="admission_id" required><option value="">Select</option><?php foreach($ads as $a):?><option value="<?=$a['id']?>"><?=e($a['application_no'].' — '.trim($a['first_name'].' '.$a['last_name']).' — '.$a['course_code'].' — Due structure '.money($a['total_fee']))?></option><?php endforeach;?></select></div><div class="field"><label>Receipt No *</label><input name="receipt_no" required></div><div class="field"><label>Payment Date *</label><input type="date" name="payment_date" value="<?=date('Y-m-d')?>" required></div><div class="field"><label>Amount *</label><input type="number" step="0.01" min="0.01" name="amount" required></div><div class="field"><label>Payment Mode</label><select name="payment_mode"><?php foreach(['Cash','UPI','Card','NEFT/RTGS','Cheque','DD','Other'] as $m):?><option><?=$m?></option><?php endforeach;?></select></div><div class="field"><label>Reference No</label><input name="reference_no"></div><div class="field field-full"><label>Remarks</label><textarea name="remarks"></textarea></div></div><button class="btn btn-primary" style="margin-top:15px">Record Payment</button></form><?php layout_end(); break;

case 'users':
    require_permission('user.view');
    $rows=db()->query("SELECT u.*,r.role_name FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id DESC")->fetchAll();
    layout_start('Users & Roles');?><div class="section-title"><div><h1>Users & roles</h1><div class="muted">Admin-controlled access rights.</div></div><?php if(can('user.manage')):?><a class="btn btn-primary" href="<?=page_url('user_edit')?>">+ Add user</a><?php endif;?></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead><tbody><?php foreach($rows as $u):?><tr><td class="mono"><?=e($u['username'])?></td><td><?=e($u['full_name'])?></td><td><?=e($u['role_name'])?></td><td><?= $u['is_active']?'<span class="badge badge-p">Active</span>':'<span class="badge badge-red">Disabled</span>'?></td><td><?=e($u['last_login_at']??'Never')?></td><td><?php if(can('user.manage')):?><a class="btn btn-light btn-small" href="<?=page_url('user_edit',['id'=>$u['id']])?>">Edit</a><?php endif;?></td></tr><?php endforeach;?></tbody></table></div></div><?php layout_end(); break;

case 'user_edit':
    require_permission('user.manage');$id=(int)($_GET['id']??0);$u=$id?db()->query("SELECT * FROM users WHERE id=$id")->fetch():null;$roles=db()->query("SELECT * FROM roles ORDER BY id")->fetchAll();
    if($_SERVER['REQUEST_METHOD']==='POST'){verify_csrf();$username=trim($_POST['username']??'');$name=trim($_POST['full_name']??'');$roleId=int_post('role_id');$email=trim($_POST['email']??'')?:null;$active=isset($_POST['is_active'])?1:0;
      if(!$username||!$name||!$roleId){flash('error','Username, name and role are required.');redirect(page_url('user_edit',$id?['id'=>$id]:[]));}
      $role=db()->query("SELECT * FROM roles WHERE id=$roleId")->fetch();if(!$role)exit('Invalid role');
      if($id){$old=$u;$sql="UPDATE users SET username=?,full_name=?,email=?,role_id=?,role_name=?,is_active=?";$params=[$username,$name,$email,$roleId,$role['role_name'],$active];if(!empty($_POST['password'])){$sql.=",password_hash=?";$params[]=password_hash($_POST['password'],PASSWORD_DEFAULT);} $sql.=" WHERE id=?";$params[]=$id;db()->prepare($sql)->execute($params);audit('UPDATE','user',$id,'User updated',$old,db()->query("SELECT * FROM users WHERE id=$id")->fetch());}
      else{if(empty($_POST['password'])){flash('error','Password is required for a new user.');redirect(page_url('user_edit'));}db()->prepare("INSERT INTO users(username,full_name,email,password_hash,role_id,role_name,is_active,created_by) VALUES(?,?,?,?,?,?,?,?)")->execute([$username,$name,$email,password_hash($_POST['password'],PASSWORD_DEFAULT),$roleId,$role['role_name'],$active,$_SESSION['user_id']]);$id=(int)db()->lastInsertId();audit('CREATE','user',$id,'User created');}
      flash('success','User saved.');redirect(page_url('users'));
    }
    layout_start($id?'Edit User':'Add User');?><form method="post" class="card"><?=csrf_field()?><div class="form-grid"><div class="field"><label>Username *</label><input name="username" required value="<?=old('username',$u['username']??'')?>"></div><div class="field"><label>Full Name *</label><input name="full_name" required value="<?=old('full_name',$u['full_name']??'')?>"></div><div class="field"><label>Email</label><input type="email" name="email" value="<?=old('email',$u['email']??'')?>"></div><div class="field"><label>Role *</label><select name="role_id" required><?php foreach($roles as $r):?><option value="<?=$r['id']?>" <?=selected((string)($u['role_id']??''),(string)$r['id'])?>><?=e($r['role_name'])?></option><?php endforeach;?></select></div><div class="field"><label>Password <?=$id?'(leave blank to keep)':'*'?></label><input type="password" name="password" <?=$id?'':'required'?>></div><div class="field"><label>Active</label><input type="checkbox" name="is_active" <?=($u['is_active']??1)?'checked':''?> style="width:auto"></div></div><button class="btn btn-primary" style="margin-top:15px">Save User</button></form><?php layout_end(); break;

case 'audit':
    require_permission('audit.view');$q=trim($_GET['q']??'');$st=db()->prepare("SELECT al.*,u.full_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id WHERE (?='' OR al.action LIKE ? OR al.entity_type LIKE ? OR al.description LIKE ? OR u.full_name LIKE ?) ORDER BY al.id DESC LIMIT 500");$like="%$q%";$st->execute([$q,$like,$like,$like,$like]);$rows=$st->fetchAll();
    layout_start('Audit Logs');?><div class="section-title"><div><h1>Audit logs</h1><div class="muted">Who changed what, from where, and when.</div></div></div><div class="card"><form class="report-toolbar" method="get"><input type="hidden" name="page" value="audit"><div class="field"><label>Search</label><input name="q" value="<?=e($q)?>" placeholder="User, action, entity, description"></div><button class="btn btn-light">Search</button></form></div><div class="card" style="margin-top:16px"><div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th><th>IP</th></tr></thead><tbody><?php foreach($rows as $r):?><tr><td><?=e($r['created_at'])?></td><td><?=e($r['full_name']??'System')?></td><td><span class="badge badge-p"><?=e($r['action'])?></span></td><td><?=e($r['entity_type'].' #'.$r['entity_id'])?></td><td><?=e($r['description'])?></td><td class="mono"><?=e($r['ip_address'])?></td></tr><?php endforeach;?></tbody></table></div></div><?php layout_end(); break;

case 'reports':
    require_permission('report.view');
    $type=$_GET['type']??'summary';$quota=$_GET['quota']??'';$phase=$_GET['phase']??'';$course=(int)($_GET['course']??0);$from=$_GET['from']??'';$to=$_GET['to']??'';
    $courses=db()->query("SELECT id,course_code,course_name FROM courses WHERE is_active=1 ORDER BY course_code")->fetchAll();
    $where=[];$p=[];
    if(in_array($quota,['CQ','MQ'],true)){$where[]='a.quota=?';$p[]=$quota;}
    if(in_array($phase,['1','2','3'],true)){$where[]='a.cq_phase=?';$p[]=(int)$phase;}
    if($course){$where[]='s.course_id=?';$p[]=$course;}
    if($from){$where[]='a.admission_date>=?';$p[]=$from;}
    if($to){$where[]='a.admission_date<=?';$p[]=$to;}
    $base="FROM admissions a JOIN students s ON s.id=a.student_id JOIN courses c ON c.id=s.course_id JOIN academic_years y ON y.id=s.academic_year_id LEFT JOIN users u ON u.id=a.created_by";
    $whereSql=$where?' WHERE '.implode(' AND ',$where):'';
    if($type==='by_course'){$sql="SELECT c.course_code,c.course_name,COUNT(*) admissions,SUM(a.quota='CQ') cq,SUM(a.quota='MQ') mq ".$base.$whereSql." GROUP BY c.id ORDER BY c.course_code";}
    elseif($type==='by_quota'){$sql="SELECT a.quota,COALESCE(a.cq_phase,0) phase,COUNT(*) admissions ".$base.$whereSql." GROUP BY a.quota,a.cq_phase ORDER BY a.quota,a.cq_phase";}
    elseif($type==='by_user'){$sql="SELECT COALESCE(u.full_name,'System') entered_by,COUNT(*) admissions ".$base.$whereSql." GROUP BY a.created_by ORDER BY admissions DESC";}
    elseif($type==='daily'){$sql="SELECT a.admission_date,COUNT(*) admissions,SUM(a.quota='CQ') cq,SUM(a.quota='MQ') mq ".$base.$whereSql." GROUP BY a.admission_date ORDER BY a.admission_date DESC";}
    elseif($type==='fees'){$sql="SELECT DATE(fp.payment_date) payment_date,COUNT(*) receipts,SUM(fp.amount) collected ".$base." JOIN fee_payments fp ON fp.admission_id=a.id".($where?' WHERE '.implode(' AND ',$where):'')." GROUP BY DATE(fp.payment_date) ORDER BY payment_date DESC";}
    else{$sql="SELECT COUNT(*) admissions,SUM(a.quota='CQ') cq,SUM(a.quota='MQ') mq,SUM(a.quota='CQ' AND a.cq_phase=1) phase1,SUM(a.quota='CQ' AND a.cq_phase=2) phase2,SUM(a.quota='CQ' AND a.cq_phase=3) phase3 ".$base.$whereSql;}
    $st=db()->prepare($sql);$st->execute($p);$rows=$st->fetchAll();
    $exportUrl=page_url('reports',array_merge($_GET,['export'=>1]));
    if(isset($_GET['export']) && can('report.export')){
      header('Content-Type:text/csv; charset=utf-8');header('Content-Disposition:attachment; filename="admission-report.csv"');$out=fopen('php://output','w');if($rows){fputcsv($out,array_keys($rows[0]));foreach($rows as $r)fputcsv($out,$r);}fclose($out);exit;
    }
    layout_start('Reports'); ?>
    <div class="section-title"><div><h1>Reports</h1><div class="muted">Class/course, CQ phases, MQ, date-wise, user-wise and fee reports.</div></div><?php if(can('report.custom')):?><a class="btn btn-light" href="<?=page_url('custom_report')?>">Custom Report Builder</a><?php endif;?></div>
    <div class="card"><form class="report-toolbar" method="get"><input type="hidden" name="page" value="reports"><div class="field"><label>Report</label><select name="type"><option value="summary" <?=selected($type,'summary')?>>Summary</option><option value="by_course" <?=selected($type,'by_course')?>>Course/Class</option><option value="by_quota" <?=selected($type,'by_quota')?>>CQ/MQ + Phase</option><option value="daily" <?=selected($type,'daily')?>>Date-wise</option><option value="by_user" <?=selected($type,'by_user')?>>User-wise</option><option value="fees" <?=selected($type,'fees')?>>Fee Collection</option></select></div><div class="field"><label>Quota</label><select name="quota"><option value="">All</option><option value="CQ" <?=selected($quota,'CQ')?>>CQ</option><option value="MQ" <?=selected($quota,'MQ')?>>MQ</option></select></div><div class="field"><label>Phase</label><select name="phase"><option value="">All</option><?php for($i=1;$i<=3;$i++):?><option value="<?=$i?>" <?=selected($phase,(string)$i)?>>Phase-<?=$i?></option><?php endfor;?></select></div><div class="field"><label>Course</label><select name="course"><option value="0">All</option><?php foreach($courses as $c):?><option value="<?=$c['id']?>" <?=selected((string)$course,(string)$c['id'])?>><?=e($c['course_code'].' — '.$c['course_name'])?></option><?php endforeach;?></select></div><div class="field"><label>From</label><input type="date" name="from" value="<?=e($from)?>"></div><div class="field"><label>To</label><input type="date" name="to" value="<?=e($to)?>"></div><button class="btn btn-light">Run</button><?php if(can('report.export')):?><a class="btn btn-primary" href="<?=e($exportUrl)?>">Export CSV</a><?php endif;?></form></div>
    <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="table"><thead><tr><?php if($rows):foreach(array_keys($rows[0]) as $h):?><th><?=e(str_replace('_',' ',ucfirst($h)))?></th><?php endforeach;endif;?></tr></thead><tbody><?php foreach($rows as $r):?><tr><?php foreach($r as $v):?><td><?=is_numeric($v)&&str_contains((string)$v,'.')?e(number_format((float)$v,2)):e($v)?></td><?php endforeach;?></tr><?php endforeach;?></tbody></table></div></div>
    <?php layout_end(); break;

case 'custom_report':
    require_permission('report.custom');
    $fields=[
      's.application_no'=>'Application No','s.admission_no'=>'Admission No','s.first_name'=>'First Name','s.last_name'=>'Last Name',
      'c.course_code'=>'Course Code','c.course_name'=>'Course Name','y.year_label'=>'Academic Year','a.quota'=>'Quota',
      'a.cq_phase'=>'CQ Phase','a.admission_date'=>'Admission Date','a.total_fee'=>'Total Fee','u.full_name'=>'Entered By'
    ];
    $selectedFields=$_GET['fields']??array_keys($fields);if(!is_array($selectedFields))$selectedFields=[];
    $valid=array_intersect($selectedFields,array_keys($fields));if(!$valid)$valid=['s.application_no','s.first_name','c.course_name','a.quota','a.cq_phase','a.admission_date'];
    $sql="SELECT ".implode(',',$valid)." FROM admissions a JOIN students s ON s.id=a.student_id JOIN courses c ON c.id=s.course_id JOIN academic_years y ON y.id=s.academic_year_id LEFT JOIN users u ON u.id=a.created_by ORDER BY a.id DESC LIMIT 1000";
    $rows=db()->query($sql)->fetchAll();
    if(isset($_GET['export'])&&can('report.export')){header('Content-Type:text/csv; charset=utf-8');header('Content-Disposition:attachment; filename="custom-admission-report.csv"');$out=fopen('php://output','w');fputcsv($out,array_values(array_intersect_key($fields,array_flip($valid))));foreach($rows as $r)fputcsv($out,$r);fclose($out);exit;}
    layout_start('Custom Report Builder');?><div class="section-title"><div><h1>Custom Report Builder</h1><div class="muted">Select the fields required for an operational report.</div></div></div><form method="get" class="card"><input type="hidden" name="page" value="custom_report"><div class="form-grid"><?php foreach($fields as $key=>$label):?><label class="field" style="flex-direction:row;align-items:center"><input type="checkbox" name="fields[]" value="<?=e($key)?>" <?=in_array($key,$valid,true)?'checked':''?> style="width:auto"><span><?=e($label)?></span></label><?php endforeach;?></div><div class="actions" style="margin-top:15px"><button class="btn btn-primary">Build Report</button><?php if(can('report.export')):?><button class="btn btn-light" name="export" value="1">Export CSV</button><?php endif;?></div></form><div class="card" style="margin-top:16px"><div class="table-wrap"><table class="table"><thead><tr><?php foreach($valid as $v):?><th><?=e($fields[$v])?></th><?php endforeach;?></tr></thead><tbody><?php foreach($rows as $r):?><tr><?php foreach($valid as $v):?><td><?=e($r[$v]??'')?></td><?php endforeach;?></tr><?php endforeach;?></tbody></table></div></div><?php layout_end(); break;

default: http_response_code(404); exit('Page not found.');
}
} catch(Throwable $e) {
    http_response_code(500);
    echo '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="'.BASE_URL.'/assets/css/app.css"></head><body class="login-page"><div class="login-card"><h2>Application error</h2><p class="danger-text">'.e($e->getMessage()).'</p><a class="btn btn-light" href="'.page_url('dashboard').'">Back to dashboard</a></div></body></html>';
}
