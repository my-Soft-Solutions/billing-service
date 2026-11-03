'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceNumberSequence extends Model {}

  InvoiceNumberSequence.init({
    id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true
    },
    law_firm_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    sequence_year: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    last_number: {
      type: DataTypes.BIGINT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'InvoiceNumberSequence',
    tableName: 'invoice_number_sequences',
    timestamps: false,
    indexes: [{
      unique: true,
      name: 'invoice_number_sequences_firm_year_unique',
      fields: ['law_firm_id', 'sequence_year']
    }]
  });

  return InvoiceNumberSequence;
};
