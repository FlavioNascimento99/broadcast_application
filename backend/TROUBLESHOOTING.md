# Troubleshooting Guide

Guia de troubleshooting para problemas comuns.

## Erro: Authentication failed against database server

```
PrismaClientInitializationError:
Invalid `prisma.$queryRaw()` invocation:
Authentication failed against database server at `localhost`
```

### Causa

Credenciais PostgreSQL incorretas no `.env`.

### Solução

1. **Verifique o `DATABASE_URL` no `.env`**

   Formato correto:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```

2. **Teste as credenciais manualmente**

   ```powershell
   psql -U seu_usuario -d sua_database -h localhost
   ```

3. **Se usar senha padrão do postgres**

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/publisher_db
   ```

4. **Se tiver criado user customizado**

   ```env
   DATABASE_URL=postgresql://publisher_user:sua_senha@localhost:5432/publisher_db
   ```

5. **Reinicie o servidor**

   ```bash
   npm run dev
   ```

---

## Erro: Database does not exist

```
ERROR: database "publisher_db" does not exist
```

### Solução

Crie a database:

```powershell
psql -U postgres
```

```sql
CREATE DATABASE publisher_db;
\q
```

Depois execute:

```bash
npm run prisma:push
```

---

## Erro: could not connect to server

```
could not connect to server: No such file or directory
Is the server running locally and accepting connections on Unix domain socket "/var/run/postgresql/.s.PGSQL.5432"?
```

### Causa

PostgreSQL não está rodando ou não está em `localhost:5432`.

### Solução Windows

1. **Verificar se PostgreSQL está rodando**

   ```powershell
   Get-Service postgresql-x64-15 | Select-Object Status
   ```

   Saída esperada: `Running`

2. **Se não estiver rodando, inicie**

   ```powershell
   net start postgresql-x64-15
   ```

3. **Se ainda não funcionar, reinicie o serviço**

   ```powershell
   net stop postgresql-x64-15
   net start postgresql-x64-15
   ```

### Solução macOS

```bash
brew services start postgresql
```

### Solução Linux

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Erro: role (user) does not exist

```
FATAL: role "publisher_user" does not exist
```

### Causa

O user PostgreSQL não foi criado.

### Solução

Crie o user:

```powershell
psql -U postgres
```

```sql
CREATE USER publisher_user WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE publisher_db TO publisher_user;
\q
```

Atualize `.env`:

```env
DATABASE_URL=postgresql://publisher_user:sua_senha_aqui@localhost:5432/publisher_db
```

---

## Erro: Module.register deprecated warning

```
(node:3424) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
```

### Causa

Aviso do `tsx` ou ferramenta de desenvolvimento.

### Solução

Este é apenas um **aviso**, não afeta o funcionamento. Será resolvido em versões futuras do `tsx`.

**Pode ignorar com segurança.**

---

## Erro: Syntax error in DATABASE_URL

```
Error validating datasource `db`: the URL must start with the protocol `postgresql://`
```

### Causa

A string `DATABASE_URL` não está em formato PostgreSQL.

### Solução

Verifique o formato:

```env
# ❌ Errado
DATABASE_URL=localhost:5432/publisher_db
DATABASE_URL=user:password@localhost

# ✅ Correto
DATABASE_URL=postgresql://user:password@localhost:5432/publisher_db
```

---

## Erro: Port already in use (3000)

```
Error: listen EADDRINUSE: address already in use :::3000
```

### Causa

Outra aplicação está usando porta 3000.

### Solução

**Opção 1: Mudar a porta**

```env
PORT=3001
```

**Opção 2: Encontrar e fechar o processo**

```powershell
# Encontrar processo na porta 3000
Get-Process | Where-Object { $_.Path -match "node" }

# Fechar específico
Stop-Process -Id <PID> -Force
```

---

## Erro: npm install falha

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

### Solução

```powershell
# Limpar cache
npm cache clean --force

# Reinstalar com --legacy-peer-deps se necessário
npm install --legacy-peer-deps
```

---

## Erro: Prisma Client not generated

```
@prisma/client did not initialize yet
```

### Causa

Prisma Client não foi gerado.

### Solução

```bash
npm run prisma:generate
```

---

## Erro: Connection timeout

```
PrismaClientInitializationError: Database connection timed out after 10s
```

### Causa

Banco de dados demorando para responder ou conexão muito lenta.

### Solução

1. **Aumentar timeout no `.env`**

   ```env
   DATABASE_URL=postgresql://user:pass@localhost:5432/db?connect_timeout=20
   ```

2. **Verificar se PostgreSQL está respondendo**

   ```powershell
   psql -U postgres -c "SELECT 1"
   ```

3. **Verificar conexão de rede**

   ```powershell
   ping localhost
   ```

---

## Erro: permission denied

```
permission denied for schema public
```

### Causa

User não tem permissões corretas.

### Solução

```sql
psql -U postgres

GRANT ALL ON SCHEMA public TO publisher_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO publisher_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO publisher_user;
```

---

## Prisma Studio não abre

```
npm run prisma:studio
```

### Causa

Porta 5555 já está em uso ou problema com Prisma.

### Solução

```powershell
# Gerar novamente
npm run prisma:generate

# Tentar abrir em porta diferente
npx prisma studio --browser none
```

---

## API retorna 500 em todas as requisições

```
GET /api/health 500
```

### Checklist

1. ✅ PostgreSQL está rodando?
   ```powershell
   psql -U postgres
   ```

2. ✅ Database existe?
   ```sql
   \l
   ```

3. ✅ `.env` tem `DATABASE_URL` válido?
   ```bash
   cat .env | findstr DATABASE_URL
   ```

4. ✅ Tabelas foram criadas?
   ```bash
   npm run prisma:push
   ```

5. ✅ Dependências instaladas?
   ```bash
   npm install
   ```

6. ✅ Build compilou sem erros?
   ```bash
   npm run build
   ```

Se tudo acima passou, tente:

```bash
# Limpar node_modules
rmdir /s /q node_modules
npm install

# Rebuild
npm run build

# Recompilar Prisma
npm run prisma:generate

# Sincronizar schema
npm run prisma:push

# Iniciar
npm run dev
```

---

## Ainda não funcionou?

1. Verifique o arquivo [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)
2. Verifique o arquivo [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
3. Verifique se todos os logs do servidor estão sendo exibidos
4. Tente resetar banco (⚠️ apaga dados):
   ```bash
   npx prisma migrate reset
   ```
