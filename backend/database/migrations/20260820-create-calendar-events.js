export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('calendar_events', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('race', 'training'),
        allowNull: false,
        defaultValue: 'training'
      },
      race_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      target_time: {
        type: Sequelize.STRING,
        allowNull: true
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('calendar_events', ['user_id']);
    await queryInterface.addIndex('calendar_events', ['event_date']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('calendar_events');
  }
};
