# PostgreSQL Setup Guide

Guia completo para configurar PostgreSQL e conectar a aplicação.

## Pré-requisitos

- PostgreSQL 12+ instalado e rodando
- Conhecimento básico do PostgreSQL

## Windows - Instalar PostgreSQL

### 1. Download

Baixe do site oficial: [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)

Recomendado: **PostgreSQL 15+** (versão estável mais recente)

### 2. Instalar

Execute o instalador e siga os passos:

1. **Escolha diretório** — Default é OK: `C:\Program Files\PostgreSQL\15\`
2. **Componentes** — Mantenha todos selecionados (incluindo pgAdmin)
3. **Data Directory** — Default é OK: `C:\Program Files\PostgreSQL\15\data`
4. **Senha do superuser (postgres)** — ⚠️ **Memorize essa senha**
5. **Port** — Padrão é `5432` (deixe como está)
6. **Locale** — Escolha a localidade (padrão OK)

### 3. Verificar instalação

Abra PowerShell e teste:

```powershell
psql --version
# Saída esperada: psql (PostgreSQL) 15.x
```

## Criar Database e User

### 1. Conectar ao PostgreSQL (padrão)

```powershell
psql -U postgres
```

Insira a senha que configurou na instalação.

Você verá o prompt: `postgres=#`

### 2. Criar database

```sql
CREATE DATABASE publisher_db;
```

Resposta esperada: `CREATE DATABASE`

### 3. Criar user específico (opcional, mas recomendado)

```sql
CREATE USER publisher_user WITH PASSWORD 'your_secure_password_here';
```

⚠️ **Use uma senha segura em produção!**

### 4. Conceder permissões

```sql
GRANT ALL PRIVILEGES ON DATABASE publisher_db TO publisher_user;
```

Resposta esperada: `GRANT`

### 5. Sair

```sql
\q
```

## Configurar a Aplicação

### 1. Copie o exemplo de env

```bash
copy .env.example .env
```

### 2. Edite `.env` com suas credenciais

Se usou as credenciais padrão (superuser `postgres`):

```env
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/publisher_db
PORT=3000
```

Se criou um user específico:

```env
DATABASE_URL=postgresql://publisher_user:your_secure_password_here@localhost:5432/publisher_db
PORT=3000
```

### 3. Teste a conexão

```bash
npm run prisma:push
```

Saída esperada:
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database at "localhost:5432", schema "public"

 ✔ Database synced, no schema changes or destructive changes detected
```

## Usando pgAdmin (Interface Gráfica)

pgAdmin foi instalado junto com PostgreSQL. É uma interface web para gerenciar o banco.

### 1. Abrir pgAdmin

```powershell
"C:\Program Files\PostgreSQL\15\pgAdmin 4\bin\pgadmin4.exe"
```

Ou procure por "pgAdmin 4" no menu Iniciar.

### 2. Conectar ao servidor

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: sua_senha

### 3. Ver banco e tabelas

Navigate:
```
Servers > PostgreSQL 15 > Databases > publisher_db > Schemas > public > Tables
```

Você verá as tabelas `topics` e `posts` criadas pelo Prisma.

## Conexão Remota (AWS RDS, Heroku, etc)

Se usar um banco hospedado, o `DATABASE_URL` muda:

```env
# AWS RDS exemplo
DATABASE_URL=postgresql://admin:password@publisher-db.c123xyz.us-east-1.rds.amazonaws.com:5432/publisher_db

# Heroku exemplo
DATABASE_URL=postgresql://user:password@ec2-00-00-00-00.compute-1.amazonaws.com:5432/db_name
```

## Troubleshooting

### "FATAL: password authentication failed for user postgres"

A senha está errada. Resete-a:

```powershell
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new_password';"
```

### "FATAL: role 'user' does not exist"

O user não foi criado. Crie novamente:

```sql
CREATE USER publisher_user WITH PASSWORD 'password';
```

### "Database 'publisher_db' does not exist"

Crie a database:

```sql
CREATE DATABASE publisher_db;
```

### "could not connect to server: No such file or directory"

PostgreSQL não está rodando. Reinicie:

```powershell
# Windows
net stop postgresql-x64-15
net start postgresql-x64-15
```

### Prisma: "timed out after 10s"

Aumente o timeout no `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/publisher_db?schema=public&connection_limit=1
```

## Backup e Restore

### Fazer backup

```powershell
pg_dump -U postgres publisher_db > backup.sql
```

### Restaurar

```powershell
psql -U postgres publisher_db < backup.sql
```

## Comandos úteis

```sql
-- Listar databases
\l

-- Conectar a um database
\c publisher_db

-- Listar tabelas
\dt

-- Ver estrutura de uma tabela
\d topics

-- Listar users
\du

-- Deletar database (CUIDADO!)
DROP DATABASE publisher_db;

-- Sair
\q
```

## Próximos Passos

1. ✅ PostgreSQL instalado e rodando
2. ✅ Database e user criados
3. ✅ `.env` configurado com credenciais
4. ✅ `npm run prisma:push` executado com sucesso

Agora você pode:

```bash
# Iniciar servidor
npm run dev

# Testar API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db/ping
```
