'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceAuditLog extends Model {
    static associate = (models) => {
      InvoiceAuditLog.belongsTo(models.Invoice, {
        foreignKey: 'invoice_id',
        as: 'invoice'
      });
    };
  }

  InvoiceAuditLog.init({
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
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    old_values: {
      type: DataTypes.JSON,
      allowNull: true
    },
    new_values: {
      type: DataTypes.JSON,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'InvoiceAuditLog',
    tableName: 'invoice_audit_logs',
    timestamps: false
  });

  return InvoiceAuditLog;
};
