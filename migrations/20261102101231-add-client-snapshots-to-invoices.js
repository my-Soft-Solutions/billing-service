'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('invoices', 'client_name', {
      type: Sequelize.STRING(255),
      allowNull: false
    });
    await queryInterface.addColumn('invoices', 'client_email', {
      type: Sequelize.STRING(255),
      allowNull: false
    });
    await queryInterface.addColumn('invoices', 'client_phone', {
      type: Sequelize.STRING(30),
      allowNull: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'client_phone');
    await queryInterface.removeColumn('invoices', 'client_email');
    await queryInterface.removeColumn('invoices', 'client_name');
  }
};
