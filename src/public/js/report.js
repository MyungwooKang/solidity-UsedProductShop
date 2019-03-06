App = {

  web3Provider : null,

  //1. init web3
  initWeb3 : async function(){
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8595');
    }
    web3 = new Web3(App.web3Provider);

    App.initContract();
  },

  //2. init contract
  initContract : function(){
    $.get('/init/contract', function(data){
      App.UsedProductShop = TruffleContract(JSON.parse(data));

      App.UsedProductShop.setProvider(App.web3Provider);

      App.initView();
    });
  },

  initView : function(){
    $("#contents").empty();
    $("#ownerMenu").empty();
    App.initOwnerMenu();
    App.getDeclarationList();
  },

  getDeclarationList : function() {
    App.UsedProductShop.deployed().then(function(instance) {
      contractInstance = instance;

      return contractInstance.viewProductLastId.call();
    }).then(function(res) {
      var id = res.toNumber();

      if (id == 0) {
        alert("Empty!");
        return;
      }


      for (var i = 1; i <= id; i++) {
        App.getDeclarationListAction(i);
      }
    });
  },

  getDeclarationListAction : function(id) {

    App.UsedProductShop.deployed().then(function(instance) {
      contractInstance = instance;
      return contractInstance.viewProductInfo.call(id);
    }).then(function(product) {
      var returnObj = {};
      returnObj.onchain = {
        "id": product[0].toNumber(),
        "state": product[5],
        "price": product[1].toNumber(),
        "sellerPhone": product[4],
        "last_state_changed_date" : product[6].toNumber()
      };

      return returnObj;
    }).then(function(res) {
      $.get('/product/data/' + res.onchain.id, function(offchain){
        var data = JSON.parse(offchain);
        var obj = {};
        obj.offchain = data;
        obj.onchain = res.onchain;

        if (obj.onchain.state == 4 || obj.onchain.state == 5 || obj.onchain.state==6) {

          App.UsedProductShop.deployed().then(function(instance) {
            contractInstance = instance;

            return contractInstance.viewDeclarationInfo.call(obj.onchain.id);
          }).then(function(data) {
            var returnObj = {
              "registerAccount" : data[0],
              "sellerPhoneNumber": data[1],
              "buyerPhoneNumber": data[2],
              "trackingNumber": data[3]
            }

            return returnObj;
          }).then(function(obj2){
            $("#contents").append("<div id='product_"+obj.onchain.id+"' class='col-md-4'><h2>" + obj.offchain.title + "</h2>" +
              "<p><h4>reporter</h4>" + obj2.registerAccount + "</p>" +
              "<p><h4>seller phone number</h4>" + obj2.sellerPhoneNumber + "</p>" +
              "<p><h4>buyer phone number</h4>" + obj2.buyerPhoneNumber + "</p>" +
              "<p><h4>trackingNumber</h4>" + obj2.trackingNumber + "</p>");

              if(obj.onchain.state == 4){
                $('#product_'+obj.onchain.id).append("<p><h4>process state</h4>processing</p>");
              }else if (obj.onchain.state ==5){
                $('#product_'+obj.onchain.id).append("<p><h4>process state</h4>done</p>");
              }else if (obj.onchain.state ==6){
                $('#product_'+obj.onchain.id).append("<p><h4>process state</h4>done</p>");
              }

              web3.eth.getAccounts(function(error, accounts) {
                if (error) {
                  console.log(error);
                }
                var account = accounts[0];

                App.UsedProductShop.deployed().then(function(instance) {
                  var contractInstance = instance;

                  return contractInstance.ownerAddress.call();
                }).then(function(res){
                  if(account == res){
                    $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.processDeclarationByOwner(' + obj.onchain.id + ',' + 1 +')" value="Refund to buyer">');
                    $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.processDeclarationByOwner(' + obj.onchain.id + ',' + 2 +')" value="Pay to seller">');
                  }
                }).catch(function (err){
                  console.log(err);
                });
              });
          }).catch(function(err) {
            console.log(err.message);
          });
        }
      });
    }).catch(function(err) {
      console.log(err.message);
    });
  },


  initOwnerMenu : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.ownerAddress.call();

      }).then(function(res){
        if(account == res){
          $('#ownerMenu').append('<input type="button" class="btn btn-default" onclick="App.withdrawFee()" value="withdraw fee">');
          $('#ownerMenu').append('<input type="button" class="btn btn-default" onclick="App.destroyContract()" value="shutdown service">');
        }
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  withdrawFee : function(){
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.withdrawFee({
          from: account
        }).then(function(res){
          alert("Success");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  destroyContract : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.destroyContract(id, {
          from: account
        }).then(function(res){
          alert("Destroy Smart Contract");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  processDeclarationByOwner : function(id,flag) {
    web3.eth.getAccounts(function(error, accounts) {
      if(flag ==1){
        if(!confirm("The product price will be paid to buyer.")){
          return;
        }
      }else if(flag ==2){
        if(!confirm("The product price will be paid to seller.")){
          return;
        }
      }
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.processDeclarationByOwner(id, flag, {
          from: account
        }).then(function(res){
          alert("success");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  }
};

$(document).ready(function() {
  App.initWeb3();
});
