'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_items', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true
      },
      invoice_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      billing_type: {
        type: Sequelize.ENUM('fixed', 'hourly'),
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unit_price: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
     createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoice_items');
  }
};
