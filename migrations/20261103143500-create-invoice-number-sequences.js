'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_number_sequences', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true
      },
      law_firm_id: {
        type: Sequelize.CHAR(36),
        allowNull: false
      },
      sequence_year: {
        type: Sequelize.SMALLINT,
        allowNull: false
      },
      last_number: {
        type: Sequelize.BIGINT,
        allowNull: false
      }
    });

    await queryInterface.addIndex('invoice_number_sequences', ['law_firm_id', 'sequence_year'], {
      unique: true,
      name: 'invoice_number_sequences_firm_year_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoice_number_sequences');
  }
};
