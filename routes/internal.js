import { Router } from 'express';
import { Op } from 'sequelize';
import { clerkClient } from '@clerk/express';
import { User } from '../models/User.js';

// Internal (staff) portal endpoints. All routes here are mounted behind
// requireUser + requireRole('internal') in index.js — they proxy read-only and
// management operations against Clerk's Backend API and the users table, so
// the portal never needs the secret key in the browser.

const router = Router();

// Platform-level roles managed here. Org-scoped membership roles (admin /
// basic_member within an org) live on Clerk organization memberships.
const PLATFORM_ROLES = ['internal', 'admin', 'staff', 'customer'];
// Clerk's default organization membership roles.
const ORG_ROLES = ['admin', 'basic_member'];

function clampInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

function toUserRow(u) {
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? null,
    firstName: u.firstName,
    lastName: u.lastName,
    imageUrl: u.imageUrl ?? null,
    createdAt: u.createdAt ?? null,
    lastActiveAt: u.lastActiveAt ?? null
  };
}

// GET /api/internal/stats — headline counts for the portal header.
router.get('/stats', async (_req, res) => {
  try {
    const [users, organizations] = await Promise.all([
      clerkClient.users.getUserList({ limit: 1 }),
      clerkClient.organizations.getOrganizationList({ limit: 1 })
    ]);
    res.json({
      users: users.totalCount,
      organizations: organizations.totalCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /api/internal/users?limit=50&offset=0 — every Clerk user (all tenants),
// with the platform role from the users table.
router.get('/users', async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 50, 100);
    const offset = clampInt(req.query.offset, 0, 100000);
    const { data, totalCount } = await clerkClient.users.getUserList({ limit, offset });

    const profiles = await User.findAll({
      where: { clerkId: { [Op.in]: data.map((u) => u.id) } },
      attributes: ['clerkId', 'role']
    });
    const roleByClerkId = new Map(profiles.map((p) => [p.clerkId, p.role]));

    res.json({
      total: totalCount,
      users: data.map((u) => ({ ...toUserRow(u), role: roleByClerkId.get(u.id) ?? 'customer' }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// PATCH /api/internal/users/:id/role  { role }
// Sets the platform role (users table) and mirrors it into Clerk's
// publicMetadata so the client can display it. Returns the updated row.
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body ?? {};
    if (!PLATFORM_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${PLATFORM_ROLES.join(', ')}` });
    }

    const clerkUser = await clerkClient.users.getUser(req.params.id);

    let profile = await User.findOne({ where: { clerkId: clerkUser.id } });
    if (!profile) {
      profile = await User.create({
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
        emailVerified: true,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl ?? null,
        role
      });
    } else {
      profile.role = role;
      await profile.save();
    }

    await clerkClient.users.updateUser(clerkUser.id, {
      publicMetadata: { ...clerkUser.publicMetadata, role }
    });

    res.json({ user: { ...toUserRow(clerkUser), role: profile.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// GET /api/internal/organizations?limit=50&offset=0 — tenants.
router.get('/organizations', async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 50, 100);
    const offset = clampInt(req.query.offset, 0, 100000);
    const { data, totalCount } = await clerkClient.organizations.getOrganizationList({ limit, offset });
    res.json({
      total: totalCount,
      organizations: data.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        membersCount: o.membersCount ?? o.members_count ?? 0,
        createdAt: o.createdAt ?? null
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load organizations' });
  }
});

// POST /api/internal/organizations  { name, slug? } — create a tenant.
router.post('/organizations', async (req, res) => {
  try {
    const { name, slug } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    const org = await clerkClient.organizations.createOrganization({ name, slug });
    res.status(201).json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        membersCount: org.membersCount ?? 0,
        createdAt: org.createdAt ?? null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /api/internal/organizations/:id/members — who's in the tenant.
router.get('/organizations/:id/members', async (req, res) => {
  try {
    const { data, totalCount } = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: req.params.id,
      limit: 100
    });
    res.json({
      total: totalCount,
      members: data.map((m) => ({
        id: m.id,
        role: m.role,
        userId: m.publicUserData?.userId ?? null,
        email: m.publicUserData?.identifier ?? null,
        firstName: m.publicUserData?.firstName ?? null,
        lastName: m.publicUserData?.lastName ?? null,
        imageUrl: m.publicUserData?.imageUrl ?? null,
        createdAt: m.createdAt ?? null
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// POST /api/internal/organizations/:id/members  { email, role } — add a member.
router.post('/organizations/:id/members', async (req, res) => {
  try {
    const { email, role } = req.body ?? {};
    if (!ORG_ROLES.includes(role)) {
      return res.status(400).json({ error: `Membership role must be one of: ${ORG_ROLES.join(', ')}` });
    }
    const { data: found } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
    const clerkUser = found[0];
    if (!clerkUser) {
      return res.status(404).json({ error: `No user with email ${email}` });
    }
    const membership = await clerkClient.organizations.createOrganizationMembership({
      organizationId: req.params.id,
      userId: clerkUser.id,
      role
    });
    res.status(201).json({ member: { id: membership.id, role: membership.role, userId: membership.publicUserData?.userId ?? null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/internal/organizations/:id/members/:userId — remove a member.
router.delete('/organizations/:id/members/:userId', async (req, res) => {
  try {
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId: req.params.id,
      userId: req.params.userId
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
