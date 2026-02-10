-- Updates the default seed users' passwords to match the current seed.sql comments/docs.
-- Password: Admin@2024

UPDATE users
SET password_hash = '$sha256$d3fc50c8f714cebd16d6c827826df01205bf519529f9d34775293cf9b70a420e'
WHERE username IN ('admin', 'teacher', 'student');
