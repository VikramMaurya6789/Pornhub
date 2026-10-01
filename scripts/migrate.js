const { execSync } = require('child_process');

try {
  console.log('Applying Prisma database schema push & migrations...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('Prisma schema updated successfully.');
} catch (err) {
  console.warn('Notice: Prisma step did not complete. Continuing build...', err.message);
}
