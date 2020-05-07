var user = require("./user.json");
var purchase = require("./purchase.json");
var purchase_status = require("./purchase_status.json");
var cashback = require("./cashback.json");
var cashback_rule = require("./cashback_rule.json");

module.exports = function() {
  return {
    user: user,
    purchase: purchase,
    purchase_status: purchase_status,
    cashback: cashback,
    cashback_rule: cashback_rule
  };
};
