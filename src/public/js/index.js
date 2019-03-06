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
    App.getProductList();
  },

  getProductList : function() {
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
        App.getProductListAction(i);
      }
    }).catch(function(err) {
      console.log(err.message);
    });
  },

  getProductListAction : function(id){
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
        obj.onchain = res.onchain;
        obj.offchain = data;

        if (obj.onchain.state == 0) {
          obj.stateClass = STATE_AVAILABLE_CLASS;
          obj.stateMessage = STATE_AVAILABLE_MESSAGE;
        } else if (obj.onchain.state == 1 || obj.onchain.state == 2) {
          obj.stateClass = STATE_RESERVE_DELIVERY_CLASS;
          if (obj.onchain.state == 1) {
            obj.stateMessage = STATE_RESERVE_MESSAGE;
          } else if(obj.onchain.state == 2){
            obj.stateMessage = STATE_DELIVERY_MESSAGE;
          }
        } else if (obj.onchain.state == 3) {
          obj.stateClass = STATE_COMPLETE_CLASS;
          obj.stateMessage = STATE_COMPLETE_MESSSAGE;
        } else if (obj.onchain.state == 4 || obj.onchain.state ==5 || obj.onchain.state ==6){
          obj.stateClass = STATE_PROBLEM_CLASS;
          obj.stateMessage = STATE_PROBLEM_MESSAGE;
        }

        $("#contents").append("<div id='product_"+obj.onchain.id+"' class='col-md-4'><h2>" + obj.offchain.title + "</h2>" +
          "<img src='" + obj.offchain.imgURL + "'></img>" +
          "<p><h4>Description</h4>" + obj.offchain.description + "</p>" +
          "<p><h4>Contact address</h4>" + obj.onchain.sellerPhone + "</p>" +
          "<p><h4>price</h4>" + obj.onchain.price + " ether</p>" +
          '<p class="' + obj.stateClass + '">' + obj.stateMessage + '</p></div>');

        if(obj.onchain.state == 0) {
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.reserveProduct(' + obj.onchain.id + ')" value="reservation">');
        } else if(obj.onchain.state == 1) {
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.deliverProduct(' + obj.onchain.id + ')" value="delivery(seller)">' +
            '<input type="button" class="btn btn-default" onclick="App.cancelReservationAction(' + obj.onchain.id + ')" value="cancel(buyer)">');
        } else if(obj.onchain.state == 2) {
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.receiveProductAction(' + obj.onchain.id + ')" value="receipt(buyer)">' +
            '<input type="button" class="btn btn-default" onclick="App.completeAction(' + obj.onchain.id + ')" value="complete(seller)">' +
            '<input type="button" class="btn btn-default" onclick="App.reportToOwner(' + obj.onchain.id + ')" value="report to owner">');

        } else if(obj.onchain.state == 3){
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.removePersonalInfoOfBuyer(' + obj.onchain.id + ')" value="clean personal data(buyer)">');
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.removePersonalInfoOfSeller(' + obj.onchain.id + ')" value="clean personal data(seller)">');
          $('#product_'+obj.onchain.id).append('<input type="button" class="btn btn-default" onclick="App.deleteProductBySeller(' + obj.onchain.id + ')" value="delete product(seller)">');
        }
      });
    }).catch(function(err) {
      console.log(err.message);
    });
  },

  registProductAction : function(dataObj) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }

      var account = accounts[0];
      var etherAmount = web3.toBigNumber(1); //REGISTRATION_FEE 1 eth
      var weiValue = web3.toWei(etherAmount, 'ether');

      var contractInstance;
      // res.end(JSON.stringify(tmp));
      App.UsedProductShop.deployed().then(function(instance) {
        contractInstance = instance;
        //onchain
        return contractInstance.registProduct.call(dataObj.price, dataObj.sellerPhone, {
          from: account,
          value: weiValue
        }).then(function(result){
          dataObj.id = result[0].toNumber();

          $.ajax({
            url: "/regist/product",
            type: "POST",
            data: dataObj,
            success: function(res){
              return contractInstance.registProduct(dataObj.price, dataObj.sellerPhone, {
                from: account,
                value: weiValue
              }).then(function(res){
                App.initView();
                $('#registModal').modal('hide');
              });
            },
            error: function(err){
              console.log(err);
              alert("Fail regist product.");
              App.initView();
            }
          });
        }).catch(function(err) {
          console.log(err);
          alert("Fail regist product.");
        });
      });
    });
  },


  reserveProduct : function(id) {
    $('#reserveModal').modal('show');
    $('#reserveProductId').val(id);
  },

  reserveProductAction : function(dataObj) {
    var id = dataObj.id;
    var homeAddress =  dataObj.homeAddress;
    var buyerPhone = dataObj.buyerPhone;

    App.UsedProductShop.deployed().then(function(instance) {
      var contractInstance = instance;

      return contractInstance.viewProductInfo.call(id);
    }).then(function(product) {
      var productObj = {
        "id": product[0].toNumber(),
        "state": product[5].toNumber(),
        "price": product[1].toNumber()
      };

      if(productObj.state !=0){
        throw "Reservation is not possible. (state : "+productObj.state+")";
      }

      return productObj;
    }).then(function(product){
      web3.eth.getAccounts(function(error, accounts) {
        if (error) {
          console.log(error);
        }
        var account = accounts[0];
        var etherAmount = web3.toBigNumber(product.price + 1); //REGISTRATION_FEE 1 eth
        var weiValue = web3.toWei(etherAmount, 'ether');

        App.UsedProductShop.deployed().then(function(instance) {
          var contractInstance = instance;

          return contractInstance.reserveProduct(id, homeAddress, buyerPhone,{
            from: account,
            value: weiValue
          }).then(function(res){
            alert("success regist");
            App.initView();
            $('#reserveModal').modal('hide');
          });
        });
      });
    }).catch(function (err){
      console.log(err);
    });
  },

  cancelReservationAction : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.cancelReservationByBuyer(id, {
          from: account
        }).then(function(res){
          alert("success");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  deliverProduct : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.viewDeliveryInfo.call(id);
      }).then(function(res){
        var confirmMessage = 'This function is required to enter the number of the waybill after shipment.' +
                'Please click the "OK" button after shipping the product to below address.\n\n' +
                'ADDRESS : ' +res[0] +'\n' +
                'Buyer pohne : '+res[1];

        if(!confirm(confirmMessage)){
          return;
        }
        $('#deliverModal').modal('show');
        $('#reserveProductId2').val(id);
      });
    });
  },

  deliverProductAction : function(dataObj) {
    var id = dataObj.id;
    var trackingNumber = dataObj.trackingNumber;
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.deliverProduct(id, trackingNumber, {
          from: account
        }).then(function(res){
          alert("success");
          App.initView();
          $('#deliverModal').modal('hide');
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  receiveProductAction : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.receiveProductAndPayment(id, {
          from: account
        }).then(function(res){
          alert("success");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  completeAction : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.processDeliveryCompletionBySeller(id, {
          from: account
        }).then(function(res){
          alert("success");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  removePersonalInfoOfBuyer : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.deletePersonalDataAboutBuyer(id, {
          from: account
        }).then(function(res){
          alert("success remove your personal data");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  reportToOwner : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.declarateProduct(id, {
          from: account
        }).then(function(res){
          alert("Success. Once processed, the payment is determined by the owner. ");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  removePersonalInfoOfSeller : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.deletePersonalDataAboutSeller(id, {
          from: account
        }).then(function(res){
          alert("success remove your personal data");
          App.initView();
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  deleteProductBySeller : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.deleteProductBySeller(id, {
          from: account
        }).then(function(res){
            $.get('/product/delete/' + id, function(res){
              alert("success remove product");
              App.initView();
            });
        });
      }).catch(function (err){
        console.log(err);
      });
    });
  },

  deleteProductByOwner : function(id) {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
      var account = accounts[0];

      App.UsedProductShop.deployed().then(function(instance) {
        var contractInstance = instance;

        return contractInstance.deleteProductByOwner(id, {
          from: account
        }).then(function(res){
            alert("success remove product");
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

  $('#okRegist').on('click', function(e) {
    var dataObj = {};
    dataObj.title = $('#productTitle').val();
    dataObj.price = $('#productPrice').val();
    dataObj.description = $('#productDescription').val();
    dataObj.imgURL = $('#productImageURL').val();
    dataObj.sellerPhone = $('#sellerPhone').val();

    $('#productTitle').val("");
    $('#productPrice').val("");
    $('#productDescription').val("");
    $('#productImageURL').val("");
    $('#sellerPhone').val("");
    App.registProductAction(dataObj);
  });

  $('#okReserve').on('click', function(e) {
    var dataObj = {};
    dataObj.id = $('#reserveProductId').val();
    dataObj.homeAddress = $('#homeAddress').val();
    dataObj.buyerPhone = $('#buyerPhone').val();

    $('#homeAddress').val("");
    $('#buyerPhone').val("");

    App.reserveProductAction(dataObj);
  });

  $('#okDeliver').on('click', function(e) {
    var dataObj = {};
    dataObj.id = $('#reserveProductId2').val();
    dataObj.trackingNumber = $('#trackingNumber').val();

    $('#trackingNumber').val("");

    App.deliverProductAction(dataObj);
  });
});
