-- Agregar columna dni a users
-- El DNI se captura en el auto-registro de clientes (RegisterForm) pero antes
-- se descartaba: ni la tabla users ni customers tenían la columna, por lo que
-- el "Reporte de Clientes" del dashboard de superadmin siempre mostraba "N/A".
-- Nullable (8 dígitos) porque los usuarios admin/super_admin no capturan DNI y
-- los clientes registrados antes de esta migración no tienen el dato (se perdió).
ALTER TABLE users
  ADD COLUMN dni VARCHAR(8);
