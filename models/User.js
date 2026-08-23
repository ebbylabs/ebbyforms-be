import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

// App-side user profile, keyed by Clerk's user ID. Clerk owns authentication
// (credentials, sessions, email/password, OAuth); this table only mirrors the
// profile fields the app needs — plus room for app-specific columns later
// (plan, role, settings, …). Rows are created on the user's first protected
// request (see middleware/auth.js).
export const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    clerkId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      description: "The user's Clerk user ID (user_...)"
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      description: 'Mirrored from Clerk session claims'
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      description: 'Clerk users are always verified at creation'
    },
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    imageUrl: DataTypes.STRING,
    // Platform-level role, managed from the internal portal:
    //  - internal — staff with whole-app (multi-org) oversight
    //  - admin    — manages the users of the org they're in
    //  - staff    — limited access, scoped by the org's admin
    //  - customer — regular user (default)
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'customer',
      validate: { isIn: [['internal', 'admin', 'staff', 'customer']] }
    }
  },
  {
    tableName: 'users',
    underscored: true
  }
);
