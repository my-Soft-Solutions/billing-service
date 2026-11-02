'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true
      },
      law_firm_id: {
        type: Sequelize.CHAR(36),
        allowNull: false
      },
      client_id: {
        type: Sequelize.CHAR(36),
        allowNull: false
      },
      case_id: {
        type: Sequelize.CHAR(36),
        allowNull: true
      },
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      issue_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      currency: {
        type: Sequelize.CHAR(3),
        allowNull: false
      },
      subtotal: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      discount_amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      tax_amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      paid_amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      balance_due: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(
          'draft',
          'issued',
          'partially_paid',
          'paid',
          'overdue',
          'cancelled'
        ),
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
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
    await queryInterface.dropTable('invoices');
  }
};
