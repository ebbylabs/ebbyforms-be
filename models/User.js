import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

// clerkId is the primary lookup key linking a record to a Clerk user.
// It is nullable so legacy in-site registrations (no Clerk login yet)
// can later be linked to a Clerk account by email.
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
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    imageUrl: DataTypes.STRING
  },
  {
    tableName: 'users',
    underscored: true
  }
);
