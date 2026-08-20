import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const CalendarEvent = sequelize.define('CalendarEvent', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  type: {
    type: DataTypes.ENUM('race', 'training'),
    allowNull: false,
    defaultValue: 'training'
  },
  raceType: {
    type: DataTypes.STRING,
    field: 'race_type'
  },
  targetTime: {
    type: DataTypes.STRING,
    field: 'target_time'
  },
  eventDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'event_date'
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'calendar_events',
  timestamps: true,
  underscored: true
});

CalendarEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(CalendarEvent, { foreignKey: 'userId', as: 'calendarEvents' });

export default CalendarEvent;
