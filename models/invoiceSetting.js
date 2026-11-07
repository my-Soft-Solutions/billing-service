'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceSetting extends Model {}

  InvoiceSetting.init({
    id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true
    },
    law_firm_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    default_currency: {
      type: DataTypes.CHAR(3),
      allowNull: false
    },
    invoice_prefix: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    default_due_days: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    default_tax_rate: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false
    },
    payment_instructions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    invoice_footer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    default_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'InvoiceSetting',
    tableName: 'invoice_settings',
    timestamps: true,
    paranoid: true
  });

  return InvoiceSetting;
};
