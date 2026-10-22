import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const AnalysisSnapshot = sequelize.define('AnalysisSnapshot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('weekly', 'session', 'race'),
    defaultValue: 'weekly'
  },
  weekStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'week_start'
  },
  totalDistanceKm: {
    type: DataTypes.FLOAT,
    field: 'total_distance_km',
    defaultValue: 0
  },
  sessionCount: {
    type: DataTypes.INTEGER,
    field: 'session_count',
    defaultValue: 0
  },
  load: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  acwr: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  intensityEasy: {
    type: DataTypes.FLOAT,
    field: 'intensity_easy',
    defaultValue: 0
  },
  intensityThreshold: {
    type: DataTypes.FLOAT,
    field: 'intensity_threshold',
    defaultValue: 0
  },
  intensityAboveThreshold: {
    type: DataTypes.FLOAT,
    field: 'intensity_above_threshold',
    defaultValue: 0
  },
  volumeDeltaPercent: {
    type: DataTypes.FLOAT,
    field: 'volume_delta_percent',
    defaultValue: 0
  },
  qualityScore: {
    type: DataTypes.FLOAT,
    field: 'quality_score',
    defaultValue: 0
  },
  summary: {
    type: DataTypes.TEXT,
    defaultValue: 'insufficient_data'
  },
  payload: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'analysis_snapshots',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id', 'week_start'] },
    { fields: ['user_id', 'type', 'week_start'] }
  ]
});

AnalysisSnapshot.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AnalysisSnapshot, { foreignKey: 'userId', as: 'analysisSnapshots' });

export default AnalysisSnapshot;
