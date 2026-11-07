'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('invoices', 'tax_rate', {
      type: Sequelize.DECIMAL(7, 4),
      allowNull: true
    });
    await queryInterface.addColumn('invoices', 'payment_instructions', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('invoices', 'invoice_footer', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'invoice_footer');
    await queryInterface.removeColumn('invoices', 'payment_instructions');
    await queryInterface.removeColumn('invoices', 'tax_rate');
  }
};
