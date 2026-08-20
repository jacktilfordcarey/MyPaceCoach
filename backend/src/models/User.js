import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  stravaId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'strava_id'
  },
  username: {
    type: DataTypes.STRING
  },
  firstName: {
    type: DataTypes.STRING,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING,
    field: 'last_name'
  },
  email: {
    type: DataTypes.STRING,
    unique: true
  },
  passwordHash: {
    type: DataTypes.STRING,
    field: 'password_hash'
  },
  profile: {
    type: DataTypes.STRING
  },
  profileMedium: {
    type: DataTypes.STRING,
    field: 'profile_medium'
  },
  city: {
    type: DataTypes.STRING
  },
  state: {
    type: DataTypes.STRING
  },
  country: {
    type: DataTypes.STRING
  },
  sex: {
    type: DataTypes.STRING
  },
  premium: {
    type: DataTypes.BOOLEAN
  },
  accessToken: {
    type: DataTypes.TEXT,
    field: 'access_token'
  },
  refreshToken: {
    type: DataTypes.TEXT,
    field: 'refresh_token'
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    field: 'token_expires_at'
  },
  weeklyMileage: {
    type: DataTypes.FLOAT,
    field: 'weekly_mileage'
  },
  monthlyMileage: {
    type: DataTypes.FLOAT,
    field: 'monthly_mileage'
  },
  totalRuns: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_runs'
  },
  coachingStyle: {
    type: DataTypes.ENUM('motivational', 'analytical', 'balanced'),
    defaultValue: 'balanced',
    field: 'coaching_style'
  },
  racePBs: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'race_pbs',
    comment: 'Personal bests for different race distances (5K, 10K, Half Marathon, Marathon) in seconds'
  },
  lastSync: {
    type: DataTypes.DATE,
    field: 'last_sync'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

export default User;
