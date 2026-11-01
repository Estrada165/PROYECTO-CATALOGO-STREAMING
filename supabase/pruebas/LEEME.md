# Pruebas del esquema

Estas pruebas NO se ejecutan en Supabase. Sirven para verificar el esquema en un
Postgres local antes de cada cambio (67 pruebas de seguridad: roles, RLS,
vencimiento, storage, integridad entre catálogos).

`00_supabase_shim.sql` imita lo mínimo de Supabase (roles, auth, storage).
