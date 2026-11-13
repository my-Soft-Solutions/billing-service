'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {

    static associate = (models) => {
      Invoice.hasMany(models.InvoiceItem, {
        foreignKey: 'invoice_id',
        as: 'items'
      });
      Invoice.hasMany(models.Payment, {
        foreignKey: 'invoice_id',
        as: 'payments'
      });
      Invoice.hasMany(models.InvoiceAuditLog, {
        foreignKey: 'invoice_id',
        as: 'auditLogs'
      });
    };
  }

  Invoice.init({
    id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true
    },
    law_firm_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    client_id: {
      type: DataTypes.CHAR(36),
      allowNull: false
    },
    client_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    client_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    client_phone: {
      type: DataTypes.STRING(30),
      allowNull: false
    },
    case_id: {
      type: DataTypes.CHAR(36),
      allowNull: true
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    issue_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    currency: {
      type: DataTypes.CHAR(3),
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    discount_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    tax_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    tax_rate: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: true
    },
    payment_instructions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    invoice_footer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    total_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    paid_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    balance_due: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'draft',
        'issued',
        'partially_paid',
        'paid',
        'overdue',
        'cancelled'
      ),
      allowNull: false
    },
    email_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    email_sent_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
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
    modelName: 'Invoice',
    tableName: 'invoices',
    timestamps: true,
    paranoid: true,
  
  });

  return Invoice;
};
