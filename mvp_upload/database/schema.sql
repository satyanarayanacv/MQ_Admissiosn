CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY(role_id, permission_id),
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(160) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    role_name VARCHAR(80) NOT NULL DEFAULT 'Staff',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_years (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    year_label VARCHAR(30) NOT NULL UNIQUE,
    start_date DATE NULL,
    end_date DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(30) NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    department VARCHAR(120) NULL,
    duration_years DECIMAL(3,1) NOT NULL DEFAULT 3,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_intakes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    academic_year_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    total_strength INT NOT NULL DEFAULT 0,
    cq_strength INT NOT NULL DEFAULT 0,
    mq_strength INT NOT NULL DEFAULT 0,
    cq_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    mq_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_intake (academic_year_id, course_id),
    FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
    FOREIGN KEY(course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cq_phases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    academic_year_id INT UNSIGNED NOT NULL,
    phase_no TINYINT UNSIGNED NOT NULL,
    phase_name VARCHAR(30) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_phase (academic_year_id, phase_no),
    FOREIGN KEY(academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(60) NOT NULL UNIQUE,
    admission_no VARCHAR(60) NULL UNIQUE,
    academic_year_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80) NULL,
    last_name VARCHAR(80) NULL,
    gender VARCHAR(20) NULL,
    dob DATE NULL,
    mobile VARCHAR(20) NULL,
    alternate_mobile VARCHAR(20) NULL,
    email VARCHAR(160) NULL,
    father_name VARCHAR(160) NULL,
    mother_name VARCHAR(160) NULL,
    guardian_name VARCHAR(160) NULL,
    address TEXT NULL,
    category VARCHAR(50) NULL,
    caste VARCHAR(80) NULL,
    qualifying_exam VARCHAR(100) NULL,
    qualifying_year VARCHAR(10) NULL,
    qualifying_percentage DECIMAL(6,2) NULL,
    remarks TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_by INT UNSIGNED NULL,
    updated_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student_course(course_id),
    INDEX idx_student_year(academic_year_id),
    INDEX idx_student_mobile(mobile)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT UNSIGNED NOT NULL UNIQUE,
    quota ENUM('CQ','MQ') NOT NULL,
    cq_phase TINYINT UNSIGNED NULL,
    admission_date DATE NOT NULL,
    seat_no VARCHAR(60) NULL,
    admission_status VARCHAR(30) NOT NULL DEFAULT 'Admitted',
    fee_structure_id INT UNSIGNED NULL,
    total_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_by INT UNSIGNED NULL,
    updated_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_admission_quota(quota),
    INDEX idx_admission_date(admission_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quota_change_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admission_id BIGINT UNSIGNED NOT NULL,
    old_quota ENUM('CQ','MQ') NOT NULL,
    old_phase TINYINT UNSIGNED NULL,
    new_quota ENUM('CQ','MQ') NOT NULL,
    new_phase TINYINT UNSIGNED NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by INT UNSIGNED NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_quota_history(admission_id, changed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fee_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admission_id BIGINT UNSIGNED NOT NULL,
    receipt_no VARCHAR(80) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL DEFAULT 'Cash',
    reference_no VARCHAR(120) NULL,
    remarks VARCHAR(500) NULL,
    entered_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
    FOREIGN KEY(entered_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_fee_date(payment_date),
    INDEX idx_fee_admission(admission_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    description VARCHAR(1000) NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_created(created_at),
    INDEX idx_audit_user(user_id),
    INDEX idx_audit_entity(entity_type, entity_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO roles(role_name, description) VALUES
('Administrator','Full system control'),
('Admission Staff','Student and admission operations'),
('Accounts Staff','Fees and fee reports'),
('Report User','Reports and read-only access');

INSERT IGNORE INTO permissions(permission_key, description) VALUES
('dashboard.view','View dashboard'),
('student.view','View students'),
('student.create','Create students'),
('student.edit','Edit students'),
('student.delete','Delete students'),
('admission.view','View admissions'),
('admission.create','Create admissions'),
('admission.edit','Edit admissions'),
('admission.change_quota','Change CQ/MQ quota'),
('course.view','View courses'),
('course.manage','Manage courses, intake, fees and dates'),
('fee.view','View fees'),
('fee.manage','Manage fee definitions'),
('fee.payment','Enter fee payments'),
('report.view','View reports'),
('report.export','Export reports'),
('report.custom','Build custom reports'),
('user.view','View users'),
('user.manage','Manage users and roles'),
('audit.view','View audit logs'),
('settings.manage','Manage application settings');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_name='Administrator';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_key IN
('dashboard.view','student.view','student.create','student.edit','admission.view','admission.create','admission.edit','admission.change_quota','course.view','report.view','report.export')
WHERE r.role_name='Admission Staff';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_key IN
('dashboard.view','student.view','admission.view','fee.view','fee.manage','fee.payment','report.view','report.export')
WHERE r.role_name='Accounts Staff';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_key IN
('dashboard.view','student.view','admission.view','course.view','fee.view','report.view','report.export','report.custom')
WHERE r.role_name='Report User';

INSERT IGNORE INTO settings(setting_key,setting_value) VALUES
('institution_name','College Admission Office'),
('academic_year','2026-27');
