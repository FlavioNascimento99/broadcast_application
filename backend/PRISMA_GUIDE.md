# Getting Started with Prisma

Guia rápido para usar Prisma e executar as primeiras operações.

## O que é Prisma?

Prisma é um ORM (Object-Relational Mapping) moderno para Node.js/TypeScript que:
- ✅ Gera tipos TypeScript automaticamente
- ✅ Cria e gerencia migrações de banco de dados
- ✅ Oferece uma API intuitiva para queries
- ✅ Inclui Prisma Studio para exploração visual do banco

## Setup Inicial

### 1. Instalar dependências

```bash
npm install
```

Isso instala Prisma Client e Prisma CLI.

### 2. Configurar variáveis de ambiente

```bash
copy .env.example .env
```

Edite `.env` com sua URL de conexão PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/publisher_db
PORT=3000
```

### 3. Criar tabelas no banco

Escolha uma das opções:

**Opção A: Push direto (recomendado para desenvolvimento)**

```bash
npm run prisma:push
```

Isso sincroniza o schema do Prisma com o banco de dados, criando tabelas automaticamente.

**Opção B: Criar migrações interativas**

```bash
npm run prisma:migrate
```

Isso cria uma nova migração com um nome descritivo (ex: `migration_init`) e aplica ao banco.

## Explorando o Banco com Prisma Studio

Para visualizar e editar dados no banco via interface gráfica:

```bash
npm run prisma:studio
```

Abre uma UI em `http://localhost:5555` onde você pode:
- Ver estrutura das tabelas
- Inserir, editar e deletar registros
- Executar queries manualmente

## Estrutura Prisma

### Schema (`prisma/schema.prisma`)

Define a estrutura do banco:

```prisma
model Topic {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(255)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  posts       Post[]   @relation("TopicPosts")
  
  @@map("topics")
}

model Post {
  id        String   @id @default(uuid())
  author    String   @db.VarChar(255)
  content   String   @db.Text
  topicId   String   @map("topic_id")
  topic     Topic    @relation("TopicPosts", fields: [topicId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([topicId])
  @@map("posts")
}
```

### Migrations (`prisma/migrations/`)

Criadas automaticamente pelo Prisma ao executar `npm run prisma:migrate`:

```
prisma/migrations/
├── migration_lock.toml
└── 20260511103000_init/
    └── migration.sql
```

Cada migração é um arquivo SQL versionado, permitindo:
- Histórico completo de mudanças no schema
- Rollback para versões anteriores
- Colaboração em equipe sem conflitos

## Usando Prisma nos Repositories

Exemplo de uso no `TopicRepository.ts`:

```typescript
import prisma from "../db";

class TopicRepository {
  // Criar
  async create(input: CreateTopicInput) {
    return await prisma.topic.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });
  }

  // Ler
  async findAll() {
    return await prisma.topic.findMany({
      orderBy: { createdAt: "desc" },
      include: { posts: true },
    });
  }

  // Deletar
  async delete(id: string) {
    return await prisma.topic.delete({ where: { id } });
  }
}
```

## Comandos Úteis

```bash
# Gerar tipos TypeScript (executado automaticamente após npm install)
npm run prisma:generate

# Criar nova migração (recomendado para produção)
npm run prisma:migrate

# Sincronizar schema com banco (para desenvolvimento)
npm run prisma:push

# Abrir interface gráfica Prisma Studio
npm run prisma:studio

# Ver status das migrações
npx prisma migrate status

# Resetar banco de dados (CUIDADO - deleta todos os dados)
npx prisma migrate reset
```

## Fluxo de Desenvolvimento

### 1. Modificar schema

Edite `prisma/schema.prisma`:

```prisma
model Topic {
  // ... campos anteriores ...
  tags String[]  // Novo campo
}
```

### 2. Criar migração

```bash
npm run prisma:migrate
```

Responda às perguntas interativas do CLI.

### 3. Prisma Client atualizado automaticamente

Types gerados em `.prisma/client` já incluem o novo campo.

### 4. Usar nos repositories

```typescript
await prisma.topic.create({
  data: {
    name: "Tech",
    tags: ["javascript", "typescript"],
  },
});
```

## Troubleshooting

**Erro: "Can't reach database"**

Verifique a string `DATABASE_URL` em `.env`:
```bash
# Teste conexão
npx prisma db execute --stdin < echo "SELECT 1"
```

**Erro: "Table already exists"**

Se o schema está fora de sync com o banco, force a sincronização:
```bash
npm run prisma:push -- --force-reset  # CUIDADO: apaga dados
```

**Gerar tipos sem fazer push**

```bash
npm run prisma:generate
```

## Mais Informações

- [Documentação oficial Prisma](https://www.prisma.io/docs/)
- [Prisma ORM](https://www.prisma.io/orm/)
- [Prisma Studio](https://www.prisma.io/studio/)
