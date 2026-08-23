import { getAuth } from '@clerk/express';
import { User } from '../models/User.js';

// Shape the API response. Profile rows contain no credentials, so this is a
// single place to control what clients see (toJSON drops nothing sensitive).
export function sanitizeUser(user) {
  return user.toJSON();
}

// Clerk owns authentication: this middleware requires a valid Clerk session
// token (`Authorization: Bearer <session-token>`), validated by clerkMiddleware.
// On a user's first protected request their profile row is created from the
// session claims (Clerk verified the identity, so email is marked verified).
export async function requireUser(req, res, next) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let user = await User.findOne({ where: { clerkId: userId } });
  if (!user) {
    user = await User.create({
      clerkId: userId,
      email: sessionClaims?.email ?? null,
      emailVerified: true,
      firstName: sessionClaims?.first_name ?? null,
      lastName: sessionClaims?.last_name ?? null,
      imageUrl: sessionClaims?.image_url ?? null,
      // Mirror the role (set on the profile by internal staff) if a Clerk
      // metadata copy exists — otherwise the customer default applies.
      role: sessionClaims?.metadata?.role ?? sessionClaims?.publicMetadata?.role ?? 'customer'
    });
  }

  req.user = user;
  return next();
}

// Role gate for staff tiers. Roles live in the `users` table (app schema) and
// are managed from the internal portal. Usage:
//   app.use(requireUser, requireRole('internal'), ...)        — platform staff
//   app.use(requireUser, requireRole('internal', 'admin'), ...) — org admins too
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// Platform staff — whole-app (multi-org) oversight.
export const requireInternal = requireRole('internal');
