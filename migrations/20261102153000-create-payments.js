'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true
      },
      law_firm_id: {
        type: Sequelize.CHAR(36),
        allowNull: false
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
      payment_reference: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'bank_transfer', 'cheque', 'card'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('recorded', 'voided'),
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      received_by: {
        type: Sequelize.CHAR(36),
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
    await queryInterface.dropTable('payments');
  }
};
