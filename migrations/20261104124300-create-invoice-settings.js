'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_settings', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true
      },
      law_firm_id: {
        type: Sequelize.CHAR(36),
        allowNull: false
      },
      default_currency: {
        type: Sequelize.CHAR(3),
        allowNull: false
      },
      invoice_prefix: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      default_due_days: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      default_tax_rate: {
        type: Sequelize.DECIMAL(7, 4),
        allowNull: false
      },
      payment_instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      invoice_footer: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      default_notes: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('invoice_settings', ['law_firm_id'], {
      unique: true,
      name: 'invoice_settings_law_firm_id_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoice_settings');
  }
};
