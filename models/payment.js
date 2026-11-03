'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate = (models) => {
      Payment.belongsTo(models.Invoice, {
        foreignKey: 'invoice_id',
        as: 'invoice'
      });
    };
  }

  Payment.init({
    id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true
    },
    law_firm_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    invoice_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'bank_transfer', 'cheque', 'card'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('recorded', 'voided'),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    received_by: {
      type: DataTypes.CHAR(36),
      allowNull: false
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
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true,
    paranoid: true
  });

  return Payment;
};
