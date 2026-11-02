'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {

    static associate = (models) => {
      InvoiceItem.belongsTo(models.Invoice, {
        foreignKey: 'invoice_id',
        as: 'invoice'
      });
    };
  }

  InvoiceItem.init({
    id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true
    },
    invoice_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    billing_type: {
      type: DataTypes.ENUM('fixed', 'hourly'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    unit_price: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
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
    modelName: 'InvoiceItem',
    tableName: 'invoice_items',
    timestamps: true,
    // createdAt: 'created_at',
    // updatedAt: 'updated_at'
  });

 

  return InvoiceItem;
};
