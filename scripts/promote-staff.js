import 'dotenv/config';
import { clerkClient } from '@clerk/express';
import { sequelize } from '../db.js';
import { User } from '../models/User.js';

// Sets a user's platform role (users table) and mirrors it into Clerk's
// publicMetadata. Roles: internal (whole-app oversight), admin (org-level),
// staff (limited), customer (default).
//
// Usage:  node scripts/promote-staff.js <clerk-user-id|email> [role]

const PLATFORM_ROLES = ['internal', 'admin', 'staff', 'customer'];

const target = process.argv[2];
const role = process.argv[3] ?? 'internal';

if (!target) {
  console.error('Usage: node scripts/promote-staff.js <clerk-user-id|email> [role]');
  process.exit(1);
}
if (!PLATFORM_ROLES.includes(role)) {
  console.error(`Invalid role "${role}" — use one of: ${PLATFORM_ROLES.join(', ')}.`);
  process.exit(1);
}

let user;
if (target.startsWith('user_')) {
  user = await clerkClient.users.getUser(target);
} else {
  const { data } = await clerkClient.users.getUserList({ emailAddress: [target], limit: 1 });
  user = data[0];
}

if (!user) {
  console.error(`No Clerk user found for "${target}".`);
  process.exit(1);
}

// 1) Update Clerk's publicMetadata (drives client-side display).
await clerkClient.users.updateUser(user.id, {
  publicMetadata: { ...user.publicMetadata, role }
});

// 2) Upsert the profile row with the role (drives server-side authorization).
const [profile] = await User.findOrCreate({
  where: { clerkId: user.id },
  defaults: {
    email: user.primaryEmailAddress?.emailAddress ?? null,
    emailVerified: true,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl ?? null,
    role
  }
});
if (profile.role !== role) {
  profile.role = role;
  await profile.save();
}

const email = user.primaryEmailAddress?.emailAddress ?? '(no email)';
console.log(`Set role "${role}" for ${email} (${user.id}) in Clerk + users table.`);
console.log('Note: an existing session picks up the new role after its token refreshes or after signing in again.');

await sequelize.close();
