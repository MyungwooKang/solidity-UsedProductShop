var UsedProductShop = artifacts.require("./UsedProductShop.sol");

module.exports = function(deployer) {
  deployer.deploy(UsedProductShop);
};
