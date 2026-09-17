// Isolated current-source probe: fake Prisma only; no database connection or writes.
// Run from repository root: node docs/audits/2026-09-17/auth-reset-race.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRoot = path.resolve(__dirname, '../../../apps/api');
const apiRequire = createRequire(path.join(apiRoot, 'package.json'));
const ts = apiRequire('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
    },
  }).outputText,
  filename,
);

async function main() {
  const bcrypt = apiRequire('bcrypt');
  const actualCompare = bcrypt.compare;
  let releaseComparison;
  let notifyComparison;
  const comparisonStarted = new Promise(resolve => { notifyComparison = resolve; });
  const comparisonGate = new Promise(resolve => { releaseComparison = resolve; });
  // Install before loading AuthService so its imported function is gated.
  bcrypt.compare = async (...args) => {
    notifyComparison();
    await comparisonGate;
    return actualCompare(...args);
  };
  const { AuthService } = require(path.join(apiRoot, 'src/modules/auth/auth.service.ts'));
  const { UsersService } = require(path.join(apiRoot, 'src/modules/users/users.service.ts'));
  const { JwtStrategy } = require(path.join(apiRoot, 'src/modules/auth/jwt.strategy.ts'));
  // These are invented probe credentials; never read configuration or real records.
  const oldPassword = 'probe-only-old-password';
  const newPassword = 'probe-only-new-password';
  const user = {
    id: 'probe-user', orgId: 'probe-org', farmId: 'probe-farm',
    username: 'probe', fullName: 'Isolated Probe', role: 'SUPER_ADMIN',
    isActive: true, password: await bcrypt.hash(oldPassword, 4),
  };
  const sessions = [];
  const tx = {
    user: {
      findFirst: async () => ({ ...user }),
      update: async ({ data }) => Object.assign(user, data),
    },
    userSession: {
      create: async ({ data }) => {
        const session = { id: 'probe-session', revokedAt: null, ...data };
        sessions.push(session);
        return session;
      },
      updateMany: async () => {
        sessions.forEach(session => { session.revokedAt = new Date(); });
        return { count: sessions.length };
      },
    },
    auditEvent: { create: async () => ({}) },
  };
  const prisma = {
    user: { findUnique: async () => ({ ...user }) },
    $transaction: async operation => operation(tx),
    userSession: {
      findFirst: async () => {
        const session = sessions.find(item => !item.revokedAt);
        return session ? { ...session, user: { ...user } } : null;
      },
    },
  };
  try {
    const pendingLogin = new AuthService(prisma, { sign: () => 'probe-token' })
      .login('probe', oldPassword);
    await comparisonStarted;
    await new UsersService(prisma).resetPassword(user.id, newPassword, user.orgId, {
      id: 'probe-admin', orgId: user.orgId, farmId: user.farmId,
    });
    releaseComparison();
    const login = await pendingLogin;
    const validated = await new JwtStrategy(prisma, { get: () => 'x'.repeat(32) })
      .validate({ sub: user.id, sid: 'probe-session' });
    const result = {
      probe: 'old-password login races with completed password reset',
      storage: 'in-memory fake Prisma; no database operations',
      passwordChanged: await actualCompare(newPassword, user.password),
      oldPasswordLoginSucceeded: Boolean(login.accessToken),
      sessionStillAccepted: validated.id === user.id,
    };
    fs.writeFileSync(path.join(__dirname, 'auth-reset-race-result.json'),
      `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result));
  } finally {
    bcrypt.compare = actualCompare;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
